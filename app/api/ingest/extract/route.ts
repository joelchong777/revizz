import { NextRequest, NextResponse } from 'next/server';
import { extractQuestionsChunked, normalizeGeminiModel } from '@/lib/ingestion/geminiExtractor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanBase64String(str: string): string {
  const match = str.match(/^data:application\/pdf;base64,(.+)$/);
  return match ? match[1] : str;
}

/**
 * POST /api/ingest/extract
 *
 * Extracts Cambridge MCQ questions by matching Question Paper (QP) and Mark Scheme (MS) PDFs
 * using Gemini Multimodal vision and OCR.
 *
 * Accepts either:
 * 1. multipart/form-data:
 *    - qp: File (PDF)
 *    - ms: File (PDF)
 *    - batch_size / batchSize (optional number, default 10)
 *    - start_question / startQuestion (optional number, default 1)
 *    - end_question / endQuestion (optional number, default 40)
 *    - model (optional string, default 'gemini-3.8-flash'; automatically remaps legacy gemini-2.0 and gemini-1.5 models)
 *    - stream (optional boolean / string, default true)
 *
 * 2. application/json:
 *    - qp / qp_base64 / qpBase64: base64 string
 *    - ms / ms_base64 / msBase64: base64 string
 *    - source_qp_filename (optional string)
 *    - source_ms_filename (optional string)
 *    - batch_size / batchSize (optional number, default 10)
 *    - start_question / startQuestion (optional number, default 1)
 *    - end_question / endQuestion (optional number, default 40)
 *    - model (optional string, default 'gemini-3.8-flash'; automatically remaps legacy gemini-2.0 and gemini-1.5 models)
 *    - stream (optional boolean, default true)
 *
 * Response:
 * - If stream=true (default): Server-Sent Events (text/event-stream) with progress chunks
 *   { stage: 'extracting', currentBatch: 'Q1-Q10', percent: 25, questions: [...] }
 * - If stream=false: Standard JSON response { success: true, total_questions: 40, questions: [...] }
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey =
      process.env.GEMINI_API_KEY ||
      request.headers.get('x-gemini-api-key') ||
      '';

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in your environment or provide x-gemini-api-key header.',
        },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const contentType = request.headers.get('content-type') || '';

    let qpBuffer: Buffer | null = null;
    let msBuffer: Buffer | null = null;
    let qpFilename = 'question_paper.pdf';
    let msFilename = 'mark_scheme.pdf';
    let batchSize = 10;
    let startQuestion = 1;
    let endQuestion = 40;
    let model = 'gemini-3.8-flash';
    let isStreaming = true;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();

      const qpFile =
        formData.get('qp') ||
        formData.get('source_qp') ||
        formData.get('qp_file');
      const msFile =
        formData.get('ms') ||
        formData.get('source_ms') ||
        formData.get('ms_file');

      if (!qpFile || !(qpFile instanceof Blob)) {
        return NextResponse.json(
          { success: false, error: 'Missing Question Paper PDF in form-data field "qp".' },
          { status: 400 }
        );
      }

      if (!msFile || !(msFile instanceof Blob)) {
        return NextResponse.json(
          { success: false, error: 'Missing Mark Scheme PDF in form-data field "ms".' },
          { status: 400 }
        );
      }

      qpBuffer = Buffer.from(await qpFile.arrayBuffer());
      msBuffer = Buffer.from(await msFile.arrayBuffer());

      if ('name' in qpFile && typeof qpFile.name === 'string') {
        qpFilename = qpFile.name;
      }
      if ('name' in msFile && typeof msFile.name === 'string') {
        msFilename = msFile.name;
      }

      const rawBatchSize = formData.get('batch_size') || formData.get('batchSize');
      if (rawBatchSize) batchSize = Math.max(1, parseInt(String(rawBatchSize), 10) || 10);

      const rawStartQ = formData.get('start_question') || formData.get('startQuestion');
      if (rawStartQ) startQuestion = Math.max(1, parseInt(String(rawStartQ), 10) || 1);

      const rawEndQ = formData.get('end_question') || formData.get('endQuestion');
      if (rawEndQ) endQuestion = Math.max(startQuestion, parseInt(String(rawEndQ), 10) || 40);

      const rawModel = formData.get('model');
      if (rawModel) model = String(rawModel).trim();

      const rawStream = formData.get('stream');
      if (rawStream !== null && (rawStream === 'false' || rawStream === '0')) {
        isStreaming = false;
      }
    } else {
      let body: any;
      try {
        body = await request.json();
      } catch (err: any) {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON or multipart request body.' },
          { status: 400 }
        );
      }

      const rawQp = body.qp || body.qp_base64 || body.qpBase64;
      const rawMs = body.ms || body.ms_base64 || body.msBase64;

      if (!rawQp || typeof rawQp !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Missing Question Paper base64 string in "qp" or "qp_base64".' },
          { status: 400 }
        );
      }

      if (!rawMs || typeof rawMs !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Missing Mark Scheme base64 string in "ms" or "ms_base64".' },
          { status: 400 }
        );
      }

      qpBuffer = Buffer.from(cleanBase64String(rawQp), 'base64');
      msBuffer = Buffer.from(cleanBase64String(rawMs), 'base64');

      if (body.source_qp_filename) qpFilename = String(body.source_qp_filename);
      if (body.source_ms_filename) msFilename = String(body.source_ms_filename);

      if (body.batch_size || body.batchSize) {
        batchSize = Math.max(1, parseInt(String(body.batch_size || body.batchSize), 10) || 10);
      }
      if (body.start_question || body.startQuestion) {
        startQuestion = Math.max(1, parseInt(String(body.start_question || body.startQuestion), 10) || 1);
      }
      if (body.end_question || body.endQuestion) {
        endQuestion = Math.max(
          startQuestion,
          parseInt(String(body.end_question || body.endQuestion), 10) || 40
        );
      }
      if (body.model) model = String(body.model).trim();
      if (body.stream === false) isStreaming = false;
    }

    // Normalize model and apply fallback remapping for legacy models (gemini-2.0, gemini-1.5)
    model = normalizeGeminiModel(model);

    if (searchParams.get('stream') === 'false') {
      isStreaming = false;
    } else if (searchParams.get('stream') === 'true') {
      isStreaming = true;
    }

    if (!qpBuffer || qpBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Question Paper PDF buffer is empty.' },
        { status: 400 }
      );
    }

    if (!msBuffer || msBuffer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Mark Scheme PDF buffer is empty.' },
        { status: 400 }
      );
    }

    // 1. Standard JSON mode (stream=false)
    if (!isStreaming) {
      try {
        const questions = await extractQuestionsChunked(qpBuffer, msBuffer, apiKey, {
          batchSize,
          startQuestion,
          endQuestion,
          model,
        });

        return NextResponse.json({
          success: true,
          total_questions: questions.length,
          questions,
          source_metadata: {
            source_qp_filename: qpFilename,
            source_ms_filename: msFilename,
            batch_size: batchSize,
            start_question: startQuestion,
            end_question: endQuestion,
          },
        });
      } catch (extractErr: any) {
        return NextResponse.json(
          {
            success: false,
            error: extractErr?.message || 'Failed to extract questions from Gemini API.',
          },
          { status: 500 }
        );
      }
    }

    // 2. Server-Sent Events (SSE) streaming mode (stream=true)
    const encoder = new TextEncoder();
    const customStream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, any>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent({
            stage: 'start',
            message: 'Starting Cambridge MCQ extraction pipeline...',
            percent: 0,
            source_qp_filename: qpFilename,
            source_ms_filename: msFilename,
          });

          const questions = await extractQuestionsChunked(qpBuffer, msBuffer, apiKey, {
            batchSize,
            startQuestion,
            endQuestion,
            model,
            onProgress: (progress) => {
              sendEvent({
                stage: 'extracting',
                currentBatch: progress.currentBatch,
                percent: progress.percent,
                batchCount: progress.batchCount,
                questions: progress.questions,
              });
            },
          });

          sendEvent({
            stage: 'complete',
            percent: 100,
            total_questions: questions.length,
            questions,
            source_metadata: {
              source_qp_filename: qpFilename,
              source_ms_filename: msFilename,
            },
          });
        } catch (err: any) {
          sendEvent({
            stage: 'error',
            error: err?.message || 'Extraction pipeline failed.',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(customStream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (globalErr: any) {
    return NextResponse.json(
      {
        success: false,
        error: globalErr?.message || 'Internal server error processing extraction request.',
      },
      { status: 500 }
    );
  }
}

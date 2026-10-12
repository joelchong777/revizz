import type {
  StagingQuestion,
  StagingOption,
  BoundingBox as StagingDiagram,
  QuestionValidationStatus,
} from '../../types/ingestion';

export type { StagingQuestion, StagingOption, StagingDiagram };

export interface ExtractionProgress {
  currentBatch: string;
  percent: number;
  batchCount: number;
  questions: StagingQuestion[];
}

export interface ExtractionOptions {
  batchSize?: number;
  startQuestion?: number;
  endQuestion?: number;
  model?: string;
  maxRetries?: number;
  onProgress?: (progress: ExtractionProgress) => void | Promise<void>;
}

/**
 * Normalizes a Gemini model identifier.
 * - Defaults to 'gemini-3.8-flash' if not provided or empty.
 * - Automatically strips any leading 'models/' prefix.
 * - Remaps deprecated models ('gemini-2.0', 'gemini-1.5') to 'gemini-3.8-flash'.
 */
export function normalizeGeminiModel(model?: string): string {
  if (!model) return 'gemini-3.8-flash';
  let trimmed = model.trim();
  if (trimmed.startsWith('models/')) {
    trimmed = trimmed.replace(/^models\//, '');
  }
  if (!trimmed || trimmed.includes('gemini-2.0') || trimmed.includes('gemini-1.5')) {
    return 'gemini-3.8-flash';
  }
  return trimmed;
}

export async function toBase64(
  data: Buffer | Uint8Array | ArrayBuffer | Blob | string
): Promise<string> {
  if (typeof data === 'string') {
    const match = data.match(/^data:application\/pdf;base64,(.+)$/);
    return match ? match[1] : data;
  }
  if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
    return data.toString('base64');
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    const arrayBuffer = await data.arrayBuffer();
    return arrayBufferToBase64(arrayBuffer);
  }
  if (data instanceof ArrayBuffer) {
    return arrayBufferToBase64(data);
  }
  if (data instanceof Uint8Array) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(data).toString('base64');
    }
    return uint8ArrayToBase64(data);
  }
  return String(data);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  return uint8ArrayToBase64(new Uint8Array(buffer));
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 8192) {
    const chunk = bytes.subarray(i, Math.min(i + 8192, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export async function extractQuestionsChunked(
  qpInput: Buffer | Uint8Array | ArrayBuffer | Blob | string,
  msInput: Buffer | Uint8Array | ArrayBuffer | Blob | string,
  apiKey: string,
  options: ExtractionOptions = {}
): Promise<StagingQuestion[]> {
  const batchSize = options.batchSize || 5;
  const startQuestion = options.startQuestion || 1;
  const endQuestion = options.endQuestion || 40;
  const model = normalizeGeminiModel(options.model || 'gemini-3.8-flash');
  const maxRetries = options.maxRetries || 3;

  // Pre-encode base64 once up front to conserve CPU & memory across batch iterations
  const qpBase64 = await toBase64(qpInput);
  const msBase64 = await toBase64(msInput);

  const allQuestions: StagingQuestion[] = [];
  const totalQuestions = Math.max(1, endQuestion - startQuestion + 1);
  let batchIndex = 0;

  for (let currentStart = startQuestion; currentStart <= endQuestion; currentStart += batchSize) {
    const currentEnd = Math.min(currentStart + batchSize - 1, endQuestion);
    batchIndex++;

    let attempt = 0;
    let success = false;
    let batchQuestions: StagingQuestion[] = [];

    while (attempt < maxRetries && !success) {
      try {
        batchQuestions = await extractBatch(
          qpBase64,
          msBase64,
          currentStart,
          currentEnd,
          apiKey,
          model
        );
        allQuestions.push(...batchQuestions);
        success = true;
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          console.error(
            `Failed to extract questions ${currentStart}-${currentEnd} after ${maxRetries} attempts.`,
            error
          );
          throw error;
        }
        // Exponential backoff
        await new Promise((res) => setTimeout(res, Math.pow(2, attempt) * 1000));
      }
    }

    if (options.onProgress) {
      const currentBatchStr = `Q${currentStart}-Q${currentEnd}`;
      const percent = Math.min(100, Math.round((allQuestions.length / totalQuestions) * 100));
      await options.onProgress({
        currentBatch: currentBatchStr,
        percent,
        batchCount: batchIndex,
        questions: batchQuestions,
      });
    }
  }

  return allQuestions;
}

async function extractBatch(
  qpBase64: string,
  msBase64: string,
  startQ: number,
  endQ: number,
  apiKey: string,
  model: string
): Promise<StagingQuestion[]> {
  const normalizedModel = normalizeGeminiModel(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${normalizedModel}:generateContent?key=${apiKey}`;

  const systemPrompt = `You are an expert Cambridge Assessment International Education (CAIE) Examination Ingestion Specialist.
Your task is to extract questions ${startQ} to ${endQ} from the provided Question Paper (QP) PDF and match them strictly with the official CAIE Mark Scheme (MS) PDF.

CRITICAL INSTRUCTIONS & SCHEMA REQUIREMENTS:
1. OFFICIAL CAIE MARK SCHEME ALIGNMENT:
   - Carefully inspect the official Mark Scheme PDF table corresponding to questions ${startQ} through ${endQ}.
   - Locate the exact official answer key (A, B, C, or D) for each question.
   - In the "options" array, the option matching the official Mark Scheme key MUST have "is_correct": true.
   - All other 3 options MUST have "is_correct": false.
   - EXACTLY ONE option must have "is_correct": true. Do NOT guess or alter the official key.

2. DISTRACTOR ANALYSIS (Pedagogical Misconceptions):
   - For every question, populate "distractor_analysis" with a mapping of each option letter ("A", "B", "C", "D") to a detailed explanation:
     - For the correct option: explain why this answer is unequivocally correct based on scientific principles and Cambridge examiner criteria.
     - For incorrect distractors (misconceptions): diagnose the precise error, trap, formula inversion, sign slip, or confusion that leads students to choose that distractor.

3. VISUAL ALIGNMENT & PAGE REFERENCES:
   - Provide "page_number" (integer, 1-indexed) indicating the exact page of the Question Paper PDF where the question stem appears.
   - If diagrams, circuit schematics, apparatus illustrations, graphs, or visual tables are present, provide "diagrams":
     Array of objects with normalized bounding boxes: { "ymin": number, "xmin": number, "ymax": number, "xmax": number, "page_number": number }
     (Coordinates on a 0 to 1000 integer scale: 0 is top/left, 1000 is bottom/right).

4. STEM & EXPLANATION FORMATTING:
   - Use standard Markdown. Format mathematical formulas and physical quantities with KaTeX ($...$ inline, $$...$$ display).
   - "explanation_markdown" must be rich and comprehensive, structured into:
     - **Concept & Key Principles**
     - **Step-by-Step Derivation**
     - **Examiner Commentary & Summary**

5. OUTPUT STRICT JSON:
Output an array of JSON objects conforming exactly to this structure:
[
  {
    "question_number": number,
    "page_number": number,
    "stem_markdown": string,
    "options": [
      { "label": "A", "content_markdown": string, "is_correct": boolean },
      { "label": "B", "content_markdown": string, "is_correct": boolean },
      { "label": "C", "content_markdown": string, "is_correct": boolean },
      { "label": "D", "content_markdown": string, "is_correct": boolean }
    ],
    "distractor_analysis": {
      "A": string,
      "B": string,
      "C": string,
      "D": string
    },
    "explanation_markdown": string,
    "diagrams": [
      { "ymin": number, "xmin": number, "ymax": number, "xmax": number, "page_number": number }
    ]
  }
]
Do not include any markdown wrappers like \`\`\`json around the output. Output pure JSON array.`;

  const payload = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: qpBase64,
            },
          },
          {
            inline_data: {
              mime_type: 'application/pdf',
              data: msBase64,
            },
          },
          {
            text: `Extract questions ${startQ} to ${endQ} and verify against the official Mark Scheme keys as a JSON array.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json',
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (fetchErr: any) {
    if (fetchErr.name === 'AbortError') {
      throw new Error(`Gemini API request timed out after 30s for questions ${startQ}-${endQ}.`);
    }
    throw new Error(`Gemini API connection failed: ${fetchErr.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    let diagnostic = errorText;
    try {
      const errJson = JSON.parse(errorText);
      if (errJson?.error?.message) {
        diagnostic = errJson.error.message;
      }
    } catch {
      // Retain raw error text
    }
    if (response.status === 400 && diagnostic.toLowerCase().includes('api key')) {
      throw new Error(`Invalid Gemini API Key: ${diagnostic}`);
    }
    if (response.status === 429) {
      throw new Error(`Gemini API rate limit exceeded (HTTP 429): ${diagnostic}`);
    }
    if (response.status === 403) {
      throw new Error(`Gemini API access forbidden (HTTP 403): ${diagnostic}`);
    }
    throw new Error(`Gemini API Error (HTTP ${response.status}): ${diagnostic}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('No text returned from Gemini API.');
  }

  const rawQuestions = extractJsonFromMarkdown(text);
  return postProcessQuestions(rawQuestions);
}

/**
 * Post-processes and validates extracted questions:
 * - Enforces CAIE Mark Scheme key alignment (exactly 1 correct option)
 * - Normalizes options, distractor analysis, and source page numbers
 * - Assigns validation_status ('valid' | 'warning' | 'error')
 */
function postProcessQuestions(rawQuestions: any[]): StagingQuestion[] {
  return rawQuestions.map((rawQ) => {
    const qNum = Number(rawQ.question_number);
    const stem = String(rawQ.stem_markdown || '').trim();
    const explanation = String(rawQ.explanation_markdown || '').trim();

    // Normalize options
    const rawOptions = Array.isArray(rawQ.options) ? rawQ.options : [];
    const expectedLabels: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
    const options: StagingOption[] = expectedLabels.map((lbl) => {
      const match = rawOptions.find((o: any) => String(o?.label).toUpperCase() === lbl);
      return {
        label: lbl,
        content_markdown: String(match?.content_markdown || '').trim(),
        is_correct: Boolean(match?.is_correct),
      };
    });

    // Check Mark Scheme alignment
    const correctCount = options.filter((o) => o.is_correct).length;
    let validationStatus: QuestionValidationStatus = 'valid';

    if (correctCount !== 1) {
      validationStatus = 'warning';
      // If none marked correct, attempt to infer from distractor_analysis
      if (correctCount === 0 && rawQ.distractor_analysis && typeof rawQ.distractor_analysis === 'object') {
        for (const lbl of expectedLabels) {
          const rationale = String(rawQ.distractor_analysis[lbl] || '').toLowerCase();
          if (rationale.includes('correct') && !rationale.includes('incorrect')) {
            const opt = options.find((o) => o.label === lbl);
            if (opt) {
              opt.is_correct = true;
              break;
            }
          }
        }
      }
    }

    if (!stem || options.some((o) => !o.content_markdown)) {
      validationStatus = 'error';
    }

    // Normalize distractor analysis
    let distractorAnalysis: Record<string, string> | undefined;
    if (rawQ.distractor_analysis && typeof rawQ.distractor_analysis === 'object') {
      distractorAnalysis = {};
      for (const lbl of expectedLabels) {
        if (rawQ.distractor_analysis[lbl]) {
          distractorAnalysis[lbl] = String(rawQ.distractor_analysis[lbl]).trim();
        }
      }
    }

    // Determine page number (visual alignment)
    let pageNumber: number | undefined = rawQ.page_number ? Number(rawQ.page_number) : undefined;
    if (!pageNumber && Array.isArray(rawQ.diagrams) && rawQ.diagrams.length > 0) {
      const diagPage = Number(rawQ.diagrams[0]?.page_number);
      if (!isNaN(diagPage) && diagPage > 0) {
        pageNumber = diagPage;
      }
    }

    // Process diagrams
    const diagrams: StagingDiagram[] = Array.isArray(rawQ.diagrams)
      ? rawQ.diagrams.map((d: any) => ({
          ymin: Number(d.ymin) || 0,
          xmin: Number(d.xmin) || 0,
          ymax: Number(d.ymax) || 0,
          xmax: Number(d.xmax) || 0,
          page_number: Number(d.page_number) || pageNumber || 1,
        }))
      : [];

    const result: StagingQuestion = {
      question_number: qNum,
      cambridge_source_ref: rawQ.cambridge_source_ref || '',
      topic_name: rawQ.topic_name || 'General',
      stem_markdown: stem,
      options,
      explanation_markdown: explanation,
      status: 'active',
      page_number: pageNumber,
      distractor_analysis: distractorAnalysis,
      validation_status: validationStatus,
      diagrams: diagrams.length > 0 ? diagrams : undefined,
    };

    return result;
  });
}

function extractJsonFromMarkdown(text: string): any[] {
  let jsonStr = text.trim();
  // Fallback to extract JSON substring from markdown fences
  if (jsonStr.startsWith('```')) {
    const firstNewline = jsonStr.indexOf('\n');
    const lastBacktick = jsonStr.lastIndexOf('```');
    if (firstNewline !== -1 && lastBacktick > firstNewline) {
      jsonStr = jsonStr.substring(firstNewline + 1, lastBacktick).trim();
    }
  }

  // Find first [ and last ]
  const firstBracket = jsonStr.indexOf('[');
  const lastBracket = jsonStr.lastIndexOf(']');

  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    jsonStr = jsonStr.substring(firstBracket, lastBracket + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      throw new Error('Parsed JSON is not an array.');
    }
    return parsed;
  } catch (err) {
    console.error('Failed to parse JSON. Raw string:', jsonStr);
    throw err;
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/apiAuth';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  parseMarkSchemePdf,
  parseMarkSchemeText,
  findMarkSchemePdf,
} from '@/lib/ingestion/markSchemeParser';
import {
  verifyPaperAgainstMarkScheme,
  type MarkSchemeMap,
  type MarkSchemeVerificationReport,
} from '@/lib/ingestion/markSchemeChecker';
import {
  remediatePaperWithMarkScheme,
  type RemediationResult,
} from '@/lib/ingestion/markSchemeRemediator';
import type { StagingPaper } from '@/types/ingestion';

/**
 * POST /api/ingest/verify-ms
 *
 * Verifies and optionally auto-remediates a StagingPaper against Cambridge Mark Scheme.
 *
 * Accepts:
 * 1. JSON payload:
 *    {
 *      paperId?: string;
 *      paper?: StagingPaper;
 *      answers?: Record<number, string>;
 *      rawMsText?: string;
 *      customMsPath?: string;
 *      fix?: boolean;
 *    }
 * 2. FormData payload:
 *    - paper: JSON string representing StagingPaper
 *    - ms_file: PDF File object
 *    - fix: "true" | "false"
 *    - rawMsText?: string
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['admin']);
  if (!auth.ok) return auth.response;
  let tempFilePath: string | null = null;

  try {
    const contentType = request.headers.get('content-type') || '';
    let paper: StagingPaper | null = null;
    let paperId: string | undefined;
    let msMap: MarkSchemeMap = {};
    let shouldFix = false;
    let sourceMsPath: string | undefined;
    let rawMsText: string | undefined;
    let customMsPath: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const paperRaw = formData.get('paper');
      const fixRaw = formData.get('fix');
      const textRaw = formData.get('rawMsText');
      const file = formData.get('ms_file') as File | null;

      shouldFix = fixRaw === 'true' || fixRaw === '1';
      if (typeof textRaw === 'string') rawMsText = textRaw;

      if (typeof paperRaw === 'string') {
        try {
          paper = JSON.parse(paperRaw);
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid paper JSON in multipart form data.' },
            { status: 400 }
          );
        }
      }

      if (file && file.size > 0) {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        tempFilePath = path.join(os.tmpdir(), `ms_upload_${Date.now()}_${path.basename(file.name)}`);
        await fs.promises.writeFile(tempFilePath, buffer);
        sourceMsPath = tempFilePath;
        msMap = await parseMarkSchemePdf(tempFilePath);
      }
    } else {
      // JSON body
      let body: any;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid JSON request body.' },
          { status: 400 }
        );
      }

      paperId = body.paperId;
      paper = body.paper || null;
      shouldFix = Boolean(body.fix);
      rawMsText = body.rawMsText;
      customMsPath = body.customMsPath;

      if (body.answers && typeof body.answers === 'object') {
        for (const [k, v] of Object.entries(body.answers)) {
          const num = parseInt(k, 10);
          if (!isNaN(num) && typeof v === 'string') {
            msMap[num] = v.toUpperCase() as any;
          }
        }
      }
    }

    // 1. Resolve paper document if paperId was supplied without in-memory paper
    let diskFilePath: string | null = null;
    if (!paper && paperId) {
      const searchRoots = [
        path.resolve(process.cwd(), 'staging'),
        path.resolve(process.cwd(), '../../staging'),
      ];
      for (const root of searchRoots) {
        const candidate = path.join(root, `${path.basename(paperId, '.json')}.json`);
        if (fs.existsSync(candidate)) {
          diskFilePath = candidate;
          const raw = fs.readFileSync(candidate, 'utf8');
          paper = JSON.parse(raw);
          break;
        }
      }
    }

    if (!paper) {
      return NextResponse.json(
        { success: false, error: 'No valid staging paper provided or found for verification.' },
        { status: 400 }
      );
    }

    // 2. Resolve Mark Scheme if not already extracted
    if (Object.keys(msMap).length === 0) {
      if (rawMsText && rawMsText.trim().length > 0) {
        msMap = parseMarkSchemeText(rawMsText);
        sourceMsPath = 'pasted_text';
      } else {
        const discoveredPath = findMarkSchemePdf(paper, customMsPath);
        if (discoveredPath) {
          sourceMsPath = discoveredPath;
          msMap = await parseMarkSchemePdf(discoveredPath);
        }
      }
    }

    if (Object.keys(msMap).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Could not locate or parse a Cambridge Mark Scheme for this paper. Please provide an explicit PDF or paste mark scheme text.',
        },
        { status: 404 }
      );
    }

    // 3. Verify paper against Mark Scheme
    const report: MarkSchemeVerificationReport = verifyPaperAgainstMarkScheme(
      paper,
      msMap,
      sourceMsPath
    );

    // 4. Optionally auto-remediate
    let fixedPaper: StagingPaper | undefined;
    let remediation: RemediationResult | undefined;

    if (shouldFix) {
      remediation = remediatePaperWithMarkScheme(paper, msMap);
      fixedPaper = remediation.fixedPaper;

      // If loaded from disk, write back
      if (diskFilePath && remediation.fixedCount > 0) {
        try {
          fs.writeFileSync(diskFilePath, JSON.stringify(fixedPaper, null, 2) + '\n');
        } catch (e: any) {
          console.warn(`[verify-ms] Failed to write updated paper to ${diskFilePath}:`, e.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      report,
      fixedPaper,
      remediation,
      markSchemeAnswersCount: Object.keys(msMap).length,
    });
  } catch (err: any) {
    console.error('[verify-ms] Route error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal mark scheme verification error.' },
      { status: 500 }
    );
  } finally {
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await fs.promises.unlink(tempFilePath);
      } catch {
        // Ignore cleanup failure
      }
    }
  }
}

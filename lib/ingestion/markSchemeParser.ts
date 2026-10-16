import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { OptionLabel } from '@/types/quiz';

const execFileAsync = promisify(execFile);

export interface ParseMarkSchemeResult {
  success: boolean;
  answers: Record<number, OptionLabel>;
  total: number;
  source?: string;
  error?: string;
}

/**
 * Parses a Cambridge Mark Scheme PDF file into a question-to-key mapping using PyMuPDF.
 *
 * @param pdfPath Absolute or relative path to the mark scheme PDF
 * @returns Map of question number to correct OptionLabel ('A' | 'B' | 'C' | 'D')
 */
export async function parseMarkSchemePdf(pdfPath: string): Promise<Record<number, OptionLabel>> {
  // Resolve PDF path with fallback to search roots
  let resolvedPdf = path.resolve(process.cwd(), pdfPath);
  if (!fs.existsSync(resolvedPdf)) {
    const parentPdf = path.resolve(process.cwd(), '../..', pdfPath);
    if (fs.existsSync(parentPdf)) {
      resolvedPdf = parentPdf;
    } else {
      throw new Error(`Mark scheme PDF not found at "${pdfPath}" (resolved: "${resolvedPdf}")`);
    }
  }

  // Resolve python parser script
  let scriptPath = path.resolve(process.cwd(), 'scripts/parse_mark_scheme.py');
  if (!fs.existsSync(scriptPath)) {
    const parentScript = path.resolve(process.cwd(), '../../scripts/parse_mark_scheme.py');
    if (fs.existsSync(parentScript)) {
      scriptPath = parentScript;
    } else {
      throw new Error(`Mark scheme parser script not found at "${scriptPath}"`);
    }
  }

  const pythonBin = process.env.PYTHON_BIN || 'python3';

  let stdoutStr = '';
  try {
    const { stdout, stderr } = await execFileAsync(pythonBin, [scriptPath, resolvedPdf], {
      maxBuffer: 10 * 1024 * 1024,
    });
    stdoutStr = stdout;
    if (stderr && stderr.trim().length > 0) {
      console.warn(`[markSchemeParser] stderr: ${stderr.trim()}`);
    }
  } catch (err: any) {
    // If the process failed, check if stdout contains error JSON
    if (err.stdout) {
      stdoutStr = err.stdout;
    } else {
      throw new Error(`Execution of parse_mark_scheme.py failed: ${err.message || String(err)}`);
    }
  }

  let parsed: { success: boolean; answers?: Record<string, string>; error?: string };
  try {
    parsed = JSON.parse(stdoutStr.trim());
  } catch (e: any) {
    throw new Error(`Failed to parse JSON output from parse_mark_scheme.py: ${stdoutStr.slice(0, 300)}`);
  }

  if (!parsed.success || !parsed.answers) {
    throw new Error(parsed.error || 'Failed to extract mark scheme answers from PDF');
  }

  const result: Record<number, OptionLabel> = {};
  for (const [qStr, key] of Object.entries(parsed.answers)) {
    const qNum = parseInt(qStr, 10);
    const upperKey = key.trim().toUpperCase();
    if (!isNaN(qNum) && ['A', 'B', 'C', 'D'].includes(upperKey)) {
      result[qNum] = upperKey as OptionLabel;
    }
  }

  return result;
}

/**
 * Pure TypeScript fallback parser for pasted text / clipboard.
 * Supports single-column, multi-column, comma-separated, and tokenized mark scheme text.
 *
 * @param text Raw mark scheme string
 * @returns Map of question number to correct OptionLabel
 */
export function parseMarkSchemeText(text: string): Record<number, OptionLabel> {
  const answers: Record<number, OptionLabel> = {};
  if (!text || typeof text !== 'string') return answers;

  // Pass 1: Line-by-line regex matching pairs
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Matches '1 D', '1 D 16 C', '1. D', 'Question 1: D', '1: D', '1 - D'
    const matches = Array.from(trimmed.matchAll(/(?:^|\b)(?:question\s*)?(\d{1,2})\s*[:\.\-]?\s+([A-D])\b/gi));
    for (const m of matches) {
      const qNum = parseInt(m[1], 10);
      const key = m[2].toUpperCase() as OptionLabel;
      if (qNum >= 1 && qNum <= 60 && !answers[qNum]) {
        answers[qNum] = key;
      }
    }
  }

  // Pass 2: Token-based fallback for broken/wrapped token streams
  const tokens = text.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i].replace(/[^\w]/g, '');
    const num = parseInt(tok, 10);
    if (!isNaN(num) && num >= 1 && num <= 60) {
      if (i + 1 < tokens.length) {
        const nextTok = tokens[i + 1].toUpperCase().replace(/[^A-D]/g, '');
        if (['A', 'B', 'C', 'D'].includes(nextTok)) {
          if (!answers[num]) {
            answers[num] = nextTok as OptionLabel;
          }
          // If next is '1' (marks count), skip it
          if (i + 2 < tokens.length && tokens[i + 2] === '1') {
            i += 3;
            continue;
          } else {
            i += 2;
            continue;
          }
        }
      }
    }
    i++;
  }

  return answers;
}

/**
 * Discovers a Cambridge Mark Scheme PDF on the local filesystem by inspecting:
 * 1) customPath if specified
 * 2) staging/ directory (in current workspace and parent worktree root)
 * 3) Subject folders like Economics (0455)/... in current workspace and parent worktree root
 *
 * @param paperMetaOrId Paper ID string (e.g. '0455_s24_11') or paper metadata object
 * @param customPath Optional user-provided path
 * @returns Absolute file path to PDF if found, or null
 */
export function findMarkSchemePdf(
  paperMetaOrId:
    | string
    | {
        code?: string;
        series?: string;
        year?: number;
        paper_code?: string;
        source_ms_filename?: string;
        subject?: { code?: string; name?: string };
        paper?: { series?: string; year?: number; paper_code?: string };
      },
  customPath?: string
): string | null {
  const searchRoots = [process.cwd(), path.resolve(process.cwd(), '../..')];

  // 1. Direct custom path check
  if (customPath && customPath.trim().length > 0) {
    const cleanCustom = customPath.trim();
    if (path.isAbsolute(cleanCustom) && fs.existsSync(cleanCustom)) {
      return cleanCustom;
    }
    for (const root of searchRoots) {
      const candidate = path.resolve(root, cleanCustom);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  // 2. Extract metadata parameters
  let code = '0455';
  let series = '';
  let yy = '';
  let paperCode = '';
  let targetFilename = '';

  if (typeof paperMetaOrId === 'string') {
    const base = path.basename(paperMetaOrId, '.json');
    const m = base.match(/^([0-9]{4})_([a-z])([0-9]{2})_([0-9]{1,2})$/i);
    if (m) {
      code = m[1];
      series = m[2].toLowerCase();
      yy = m[3];
      paperCode = m[4];
      targetFilename = `${code}_${series}${yy}_ms_${paperCode}.pdf`;
    } else {
      // In case string was directly a filename like '0455_s24_ms_11.pdf'
      if (base.toLowerCase().includes('ms')) {
        targetFilename = base.endsWith('.pdf') ? base : `${base}.pdf`;
      }
    }
  } else if (paperMetaOrId && typeof paperMetaOrId === 'object') {
    if (paperMetaOrId.source_ms_filename) {
      targetFilename = paperMetaOrId.source_ms_filename;
    }
    code = paperMetaOrId.code || paperMetaOrId.subject?.code || '0455';
    series = (paperMetaOrId.series || paperMetaOrId.paper?.series || '').toLowerCase();
    const yr = paperMetaOrId.year || paperMetaOrId.paper?.year;
    if (yr) yy = String(yr).slice(-2);
    paperCode = paperMetaOrId.paper_code || paperMetaOrId.paper?.paper_code || '';
    if (!targetFilename && code && series && yy && paperCode) {
      targetFilename = `${code}_${series}${yy}_ms_${paperCode}.pdf`;
    }
  }

  // 3. Scan staging/ and subject directories across search roots
  for (const root of searchRoots) {
    if (targetFilename) {
      const stagingCandidate = path.resolve(root, 'staging', targetFilename);
      if (fs.existsSync(stagingCandidate)) {
        return stagingCandidate;
      }
    }

    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });
      for (const ent of entries) {
        if (ent.isDirectory() && ent.name.includes(code)) {
          const subjectDir = path.resolve(root, ent.name);
          const found = recursiveFindMarkScheme(subjectDir, targetFilename, code, series, yy, paperCode);
          if (found) return found;
        }
      }
    } catch {
      // Ignore directory read errors
    }
  }

  return null;
}

function recursiveFindMarkScheme(
  dir: string,
  targetFilename: string,
  code: string,
  series: string,
  yy: string,
  paperCode: string
): string | null {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const found = recursiveFindMarkScheme(fullPath, targetFilename, code, series, yy, paperCode);
        if (found) return found;
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.pdf')) {
        const lowerName = ent.name.toLowerCase();
        // Exact target filename match
        if (targetFilename && lowerName === targetFilename.toLowerCase()) {
          return fullPath;
        }
        // Substring / component match
        if (series && yy && paperCode) {
          if (
            lowerName.includes(series + yy) &&
            lowerName.includes('ms') &&
            (lowerName.includes(`_${paperCode}`) || lowerName.includes(`-${paperCode}`) || lowerName.endsWith(`${paperCode}.pdf`))
          ) {
            return fullPath;
          }
        }
      }
    }
  } catch {
    // Ignore read errors
  }
  return null;
}

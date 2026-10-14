import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateStagingPaper, StagedPaperSummary } from '@/types/ingestion';
export type { StagedPaperSummary };

// Polyfill WebSocket in Node runtime if absent (required by @supabase/supabase-js realtime client)
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

export interface StagedPaperStates {
  archived: string[]; // array of paper cleanIds
  deleted: string[];  // array of paper cleanIds
}

const STORAGE_BUCKET = 'question-diagrams';
const PAPER_STATES_PATH = 'staged_metadata/paper_states.json';
const STAGED_PAPERS_DIR = 'staged_papers';

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmvahcaxixvhgxidmkqs.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdmFoY2F4aXh2aGd4aWRta3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTc4NzQsImV4cCI6MjEwNzAzMzg3NH0.qeqa5hQ84xnIOljKmu7SUhcko53qM1gO_dCmYvjnf-4';

  return createClient(supabaseUrl, supabaseKey);
}

export async function fetchPersistentPaperStates(): Promise<StagedPaperStates> {
  try {
    const supabase = getSupabaseClient();
    const {
      data: { publicUrl },
    } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(PAPER_STATES_PATH);

    const res = await fetch(`${publicUrl}?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!res.ok) {
      return { archived: [], deleted: [] };
    }

    const text = await res.text();
    const parsed = JSON.parse(text);
    return {
      archived: Array.isArray(parsed?.archived)
        ? parsed.archived.filter((id: any) => typeof id === 'string' && id.trim())
        : [],
      deleted: Array.isArray(parsed?.deleted)
        ? parsed.deleted.filter((id: any) => typeof id === 'string' && id.trim())
        : [],
    };
  } catch (err: any) {
    console.warn('[Staged Paper Route] Failed to fetch persistent paper states, fallback to empty:', err?.message);
    return { archived: [], deleted: [] };
  }
}

export async function savePersistentPaperStates(states: StagedPaperStates): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const deletedList = Array.from(new Set(states.deleted || [])).filter(Boolean);
    const deletedSet = new Set(deletedList);
    const archivedList = Array.from(new Set(states.archived || []))
      .filter(Boolean)
      .filter((id) => !deletedSet.has(id));

    const cleanStates: StagedPaperStates = {
      archived: archivedList,
      deleted: deletedList,
    };

    const payload = JSON.stringify(cleanStates, null, 2);
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(PAPER_STATES_PATH, payload, {
        contentType: 'application/json',
        upsert: true,
        cacheControl: '0',
      });

    if (error) {
      console.warn('[Staged Paper Route] Failed to save persistent paper states:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[Staged Paper Route] Exception saving persistent paper states:', err?.message);
    return false;
  }
}

async function checkPaperExists(
  cleanId: string,
  stagingDir: string,
  archiveDir: string
): Promise<{ exists: boolean; isLocallyActive: boolean; isLocallyArchived: boolean; isRemote: boolean }> {
  const activeFilePath = path.join(stagingDir, `${cleanId}.json`);
  const archiveFilePath = path.join(archiveDir, `${cleanId}.json`);

  const isLocallyActive = fs.existsSync(activeFilePath);
  const isLocallyArchived = fs.existsSync(archiveFilePath);

  if (isLocallyActive || isLocallyArchived) {
    return { exists: true, isLocallyActive, isLocallyArchived, isRemote: false };
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(STAGED_PAPERS_DIR, { search: `${cleanId}.json` });

    if (!error && Array.isArray(data) && data.some((f) => f.name === `${cleanId}.json`)) {
      return { exists: true, isLocallyActive: false, isLocallyArchived: false, isRemote: true };
    }
  } catch (err: any) {
    console.warn('[Staged Paper Route] Error checking remote paper existence:', err?.message);
  }

  return { exists: false, isLocallyActive: false, isLocallyArchived: false, isRemote: false };
}

interface PublishedPaperRow {
  id: string;
  series: string;
  paper_code: string;
  year: number;
  subject_id?: string;
  subjects?:
    | {
        id: string;
        code: string;
      }
    | Array<{ id: string; code: string }>
    | null;
}

function normalizeKey(str: string | number | undefined | null): string {
  return String(str ?? '').toLowerCase().trim();
}

function makeLookupKey(
  subjectCode: string | undefined | null,
  series: string | undefined | null,
  year: number | string | undefined | null,
  paperCode: string | undefined | null
): string {
  const sCode = normalizeKey(subjectCode);
  const sSeries = normalizeKey(series);
  const sYear = normalizeKey(year);
  // Strip optional 'paper ' prefix (e.g. 'paper 12' -> '12')
  const sPaperCode = normalizeKey(paperCode).replace(/^paper\s*/i, '');
  return `${sCode}__${sSeries}__${sYear}__${sPaperCode}`;
}

/**
 * Parses Cambridge paper naming convention (e.g. "0455_s24_12") as fallback metadata.
 */
function parseMetadataFromFilename(name: string): {
  subjectCode?: string;
  series?: string;
  year?: number;
  paperCode?: string;
} {
  const clean = path.basename(name).replace(/\.json$/i, '');
  const match = clean.match(/^([0-9]{4})_([a-zA-Z])([0-9]{2})_([0-9]+)$/);
  if (match) {
    const rawYear = parseInt(match[3], 10);
    const fullYear = rawYear < 70 ? 2000 + rawYear : 1900 + rawYear;
    return {
      subjectCode: match[1],
      series: match[2].toLowerCase(),
      year: fullYear,
      paperCode: match[4],
    };
  }
  return {};
}

async function fetchPublishedPapersMap(): Promise<Map<string, PublishedPaperRow>> {
  const map = new Map<string, PublishedPaperRow>();
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('papers')
      .select('id, series, paper_code, year, subjects ( id, code )');

    if (error) {
      console.warn('[Staged Paper Route] Supabase papers query warning:', error.message);
      return map;
    }

    if (Array.isArray(data)) {
      for (const row of data as PublishedPaperRow[]) {
        let code = '';
        if (row.subjects) {
          if (Array.isArray(row.subjects) && row.subjects.length > 0) {
            code = row.subjects[0].code;
          } else if (typeof row.subjects === 'object' && 'code' in row.subjects) {
            code = (row.subjects as any).code;
          }
        }
        const key = makeLookupKey(code, row.series, row.year, row.paper_code);
        if (key && key !== '________') {
          map.set(key, row);
        }
      }
    }
  } catch (err: any) {
    console.warn('[Staged Paper Route] Supabase connection failed, falling back to local only:', err?.message);
  }
  return map;
}

/**
 * GET /api/ingest/staged-paper
 * 
 * Query parameters:
 * - `id` (optional): Clean ID or filename of the staged paper (e.g. `0455_s24_12` or `0455_s24_12.json`).
 *   If provided: Reads `staging/${cleanId}.json` (or `staging/archive/${cleanId}.json`, or Supabase Storage),
 *   validates with `validateStagingPaper`, and returns `{ success: true, paper, is_published, published_exam_paper_id, is_archived }`.
 * - `include_archived` (optional): If 'true' or '1', also includes archived papers.
 *   If omitted or false: Lists all active papers and returns `{ success: true, papers: [...], stagedPapers: [...] }`.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawId = searchParams.get('id');
    const includeArchived =
      searchParams.get('include_archived') === 'true' ||
      searchParams.get('include_archived') === '1';

    const stagingDir = path.resolve(process.cwd(), 'staging');
    const archiveDir = path.join(stagingDir, 'archive');

    const paperStates = await fetchPersistentPaperStates();
    const deletedSet = new Set(paperStates.deleted);
    const archivedSet = new Set(paperStates.archived);

    // Scenario 1: Specific paper requested by ID
    if (rawId) {
      if (rawId.includes('..') || rawId.includes('/') || rawId.includes('\\')) {
        return NextResponse.json(
          { success: false, error: `Invalid paper ID: "${rawId}". Directory traversal is not permitted.` },
          { status: 400 }
        );
      }

      // Sanitize input to prevent directory traversal
      const cleanId = path.basename(rawId).replace(/\.json$/i, '').trim();

      if (!cleanId || !/^[a-zA-Z0-9_\-]+$/.test(cleanId)) {
        return NextResponse.json(
          { success: false, error: `Invalid paper ID: "${rawId}"` },
          { status: 400 }
        );
      }

      if (deletedSet.has(cleanId)) {
        return NextResponse.json(
          { success: false, error: `Staged paper "${cleanId}" not found in staging directory.` },
          { status: 404 }
        );
      }

      const activeFilePath = path.join(stagingDir, `${cleanId}.json`);
      const archiveFilePath = path.join(archiveDir, `${cleanId}.json`);
      let fileContent: string | null = null;
      let isArchived = archivedSet.has(cleanId);
      let foundLocally = false;

      if (fs.existsSync(activeFilePath)) {
        try {
          fileContent = fs.readFileSync(activeFilePath, 'utf8');
          foundLocally = true;
        } catch (readErr: any) {
          return NextResponse.json(
            { success: false, error: `Failed to read file for "${cleanId}": ${readErr?.message}` },
            { status: 500 }
          );
        }
      } else if (fs.existsSync(archiveFilePath)) {
        try {
          fileContent = fs.readFileSync(archiveFilePath, 'utf8');
          isArchived = true;
          foundLocally = true;
        } catch (readErr: any) {
          return NextResponse.json(
            { success: false, error: `Failed to read archive file for "${cleanId}": ${readErr?.message}` },
            { status: 500 }
          );
        }
      }

      if (!foundLocally) {
        // Attempt download from Supabase Storage
        try {
          const supabase = getSupabaseClient();
          const { data: blob, error: dlErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .download(`${STAGED_PAPERS_DIR}/${cleanId}.json`);
          if (!dlErr && blob) {
            fileContent = await blob.text();
          }
        } catch (storageErr: any) {
          console.warn(`[Staged Paper Route] Supabase download error for "${cleanId}":`, storageErr?.message);
        }
      }

      if (!fileContent) {
        return NextResponse.json(
          { success: false, error: `Staged paper "${cleanId}" not found in staging directory.` },
          { status: 404 }
        );
      }

      let parsedJson: any;
      try {
        parsedJson = JSON.parse(fileContent);
      } catch (jsonErr: any) {
        return NextResponse.json(
          { success: false, error: `Corrupted JSON in "${cleanId}.json": ${jsonErr?.message}` },
          { status: 500 }
        );
      }

      // Validate paper against schema and business rules (allowing partial/custom batches e.g. 30/40 questions)
      const validation = validateStagingPaper(parsedJson, { allowPartialBatch: true });
      if (!validation.success || !validation.data) {
        return NextResponse.json(
          {
            success: false,
            error: `Staged paper "${cleanId}" failed schema validation.`,
            details: validation.errors,
          },
          { status: 422 }
        );
      }

      const paper = validation.data;

      // Check if published in Supabase
      const publishedMap = await fetchPublishedPapersMap();
      const fallbackMeta = parseMetadataFromFilename(cleanId);
      const subjectCode = paper.subject?.code || fallbackMeta.subjectCode;
      const series = paper.paper?.series || fallbackMeta.series;
      const year = paper.paper?.year ?? fallbackMeta.year;
      const paperCode = paper.paper?.paper_code || fallbackMeta.paperCode;

      const lookupKey = makeLookupKey(subjectCode, series, year, paperCode);
      const matchedPaper = publishedMap.get(lookupKey);
      const isPublished = Boolean(matchedPaper);

      if (isPublished) {
        paper.lifecycle_state = 'published';
      }

      return NextResponse.json({
        success: true,
        paper,
        is_published: isPublished,
        published_exam_paper_id: matchedPaper?.id || null,
        is_archived: isArchived,
      });
    }

    // Scenario 2: List all available staged JSON papers with rich metadata
    interface DiscoveredPaper {
      cleanId: string;
      filename: string;
      isLocallyArchived: boolean;
      localPath?: string;
      remotePath?: string;
    }

    const discoveredMap = new Map<string, DiscoveredPaper>();

    if (fs.existsSync(stagingDir)) {
      try {
        const entries = fs.readdirSync(stagingDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
            const cleanId = entry.name.replace(/\.json$/i, '');
            discoveredMap.set(cleanId, {
              cleanId,
              filename: entry.name,
              isLocallyArchived: false,
              localPath: path.join(stagingDir, entry.name),
            });
          }
        }
      } catch (fsErr: any) {
        console.warn('[Staged Paper Route] Failed to read staging directory:', fsErr?.message);
      }
    }

    if (fs.existsSync(archiveDir)) {
      try {
        const entries = fs.readdirSync(archiveDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
            const cleanId = entry.name.replace(/\.json$/i, '');
            if (!discoveredMap.has(cleanId)) {
              discoveredMap.set(cleanId, {
                cleanId,
                filename: entry.name,
                isLocallyArchived: true,
                localPath: path.join(archiveDir, entry.name),
              });
            }
          }
        }
      } catch (fsErr: any) {
        console.warn('[Staged Paper Route] Failed to read archive directory:', fsErr?.message);
      }
    }

    try {
      const supabase = getSupabaseClient();
      const { data: remoteList, error: remoteErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(STAGED_PAPERS_DIR);

      if (!remoteErr && Array.isArray(remoteList)) {
        for (const item of remoteList) {
          if (item.name && item.name.toLowerCase().endsWith('.json')) {
            const cleanId = item.name.replace(/\.json$/i, '');
            if (!discoveredMap.has(cleanId)) {
              discoveredMap.set(cleanId, {
                cleanId,
                filename: item.name,
                isLocallyArchived: false,
                remotePath: `${STAGED_PAPERS_DIR}/${item.name}`,
              });
            }
          }
        }
      }
    } catch (storageErr: any) {
      console.warn('[Staged Paper Route] Supabase storage list warning:', storageErr?.message);
    }

    const publishedMap = await fetchPublishedPapersMap();
    const papers: string[] = [];
    const stagedPapers: StagedPaperSummary[] = [];

    const sortedCleanIds = Array.from(discoveredMap.keys()).sort((a, b) => a.localeCompare(b));

    for (const cleanId of sortedCleanIds) {
      if (deletedSet.has(cleanId)) {
        continue;
      }

      const item = discoveredMap.get(cleanId)!;
      const isArchived = archivedSet.has(cleanId) || item.isLocallyArchived;

      if (!includeArchived && isArchived) {
        continue;
      }

      papers.push(cleanId);

      let fileContent: string | null = null;
      try {
        if (item.localPath && fs.existsSync(item.localPath)) {
          fileContent = fs.readFileSync(item.localPath, 'utf8');
        } else if (item.remotePath) {
          const supabase = getSupabaseClient();
          const { data: blob } = await supabase.storage
            .from(STORAGE_BUCKET)
            .download(item.remotePath);
          if (blob) {
            fileContent = await blob.text();
          }
        }
      } catch (readErr: any) {
        console.warn(`[Staged Paper Route] Failed reading content for "${cleanId}":`, readErr?.message);
      }

      if (!fileContent) {
        const fallbackMeta = parseMetadataFromFilename(item.filename);
        const lookupKey = makeLookupKey(
          fallbackMeta.subjectCode,
          fallbackMeta.series,
          fallbackMeta.year,
          fallbackMeta.paperCode
        );
        const matchedPaper = publishedMap.get(lookupKey);
        const isPublished = Boolean(matchedPaper);

        stagedPapers.push({
          id: cleanId,
          filename: item.filename,
          questionsCount: 0,
          diagramsCount: 0,
          lifecycle_state: isPublished ? 'published' : 'draft',
          is_published: isPublished,
          published_exam_paper_id: matchedPaper?.id || null,
          is_archived: isArchived,
          isValid: false,
        });
        continue;
      }

      try {
        const parsedJson = JSON.parse(fileContent);
        const questions = Array.isArray(parsedJson?.questions) ? parsedJson.questions : [];
        const diagramsCount = questions.filter(
          (q: any) => Boolean(q?.diagram?.has_diagram || q?.has_diagram || q?.diagram?.image_url || q?.image_url)
        ).length;

        const fallbackMeta = parseMetadataFromFilename(item.filename);
        const subjectCode = parsedJson?.subject?.code || fallbackMeta.subjectCode;
        const series = parsedJson?.paper?.series || fallbackMeta.series;
        const year = parsedJson?.paper?.year ?? fallbackMeta.year;
        const paperCode = parsedJson?.paper?.paper_code || fallbackMeta.paperCode;

        const lookupKey = makeLookupKey(subjectCode, series, year, paperCode);
        const matchedPaper = publishedMap.get(lookupKey);

        const isPublished = Boolean(matchedPaper);
        const publishedExamPaperId = matchedPaper?.id || null;
        const lifecycleState = isPublished
          ? 'published'
          : (parsedJson?.lifecycle_state || parsedJson?.state || 'review');

        stagedPapers.push({
          id: typeof parsedJson?.id === 'string' && parsedJson.id ? parsedJson.id : cleanId,
          filename: item.filename,
          subject: parsedJson?.subject
            ? {
                code: parsedJson.subject.code,
                name: parsedJson.subject.name,
                icon: parsedJson.subject.icon,
              }
            : fallbackMeta.subjectCode
            ? { code: fallbackMeta.subjectCode }
            : undefined,
          paper: parsedJson?.paper
            ? {
                year: parsedJson.paper.year,
                series: parsedJson.paper.series,
                paper_code: parsedJson.paper.paper_code,
              }
            : (fallbackMeta.year && fallbackMeta.series && fallbackMeta.paperCode)
            ? {
                year: fallbackMeta.year,
                series: fallbackMeta.series,
                paper_code: fallbackMeta.paperCode,
              }
            : undefined,
          questionsCount: questions.length,
          diagramsCount,
          lifecycle_state: lifecycleState,
          is_published: isPublished,
          published_exam_paper_id: publishedExamPaperId,
          is_archived: isArchived,
          isValid: questions.length > 0,
        });
      } catch {
        const fallbackMeta = parseMetadataFromFilename(item.filename);
        const lookupKey = makeLookupKey(
          fallbackMeta.subjectCode,
          fallbackMeta.series,
          fallbackMeta.year,
          fallbackMeta.paperCode
        );
        const matchedPaper = publishedMap.get(lookupKey);
        const isPublished = Boolean(matchedPaper);

        stagedPapers.push({
          id: cleanId,
          filename: item.filename,
          questionsCount: 0,
          diagramsCount: 0,
          lifecycle_state: isPublished ? 'published' : 'draft',
          is_published: isPublished,
          published_exam_paper_id: matchedPaper?.id || null,
          is_archived: isArchived,
          isValid: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      papers,
      stagedPapers,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error while processing staged paper.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ingest/staged-paper
 * 
 * Supports two payload shapes:
 * 1. Action Operations (Archive, Unarchive, Delete):
 *    { action: 'archive' | 'unarchive' | 'delete', id: string }
 * 
 * 2. Paper Staging & Updates:
 *    { paper: StagingPaper, id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    // Branch 1: Action operations (archive, unarchive, delete)
    if (body?.action !== undefined) {
      const { action, id: rawId } = body;

      if (!action || !['archive', 'unarchive', 'delete'].includes(action)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid or missing "action". Must be one of: "archive", "unarchive", "delete".',
          },
          { status: 400 }
        );
      }

      if (!rawId || typeof rawId !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Missing or invalid "id" parameter.' },
          { status: 400 }
        );
      }

      if (rawId.includes('..') || rawId.includes('/') || rawId.includes('\\')) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid paper ID: "${rawId}". Directory traversal is not permitted.`,
          },
          { status: 400 }
        );
      }

      // Sanitize id to prevent directory traversal
      const cleanId = path.basename(rawId).replace(/\.json$/i, '').trim();
      if (!cleanId || !/^[a-zA-Z0-9_\-]+$/.test(cleanId)) {
        return NextResponse.json(
          {
            success: false,
            error: `Invalid paper ID: "${rawId}". Only alphanumeric characters, dashes, and underscores allowed.`,
          },
          { status: 400 }
        );
      }

      const stagingDir = path.resolve(process.cwd(), 'staging');
      const archiveDir = path.join(stagingDir, 'archive');
      const activeFilePath = path.join(stagingDir, `${cleanId}.json`);
      const archiveFilePath = path.join(archiveDir, `${cleanId}.json`);

      const paperStates = await fetchPersistentPaperStates();
      const existence = await checkPaperExists(cleanId, stagingDir, archiveDir);

      if (action === 'archive') {
        if (paperStates.deleted.includes(cleanId) || !existence.exists) {
          return NextResponse.json(
            {
              success: false,
              error: `Staged paper "${cleanId}.json" not found in staging directory.`,
            },
            { status: 404 }
          );
        }

        // Check if already archived
        if (paperStates.archived.includes(cleanId) || (existence.isLocallyArchived && !existence.isLocallyActive)) {
          if (!paperStates.archived.includes(cleanId)) {
            paperStates.archived.push(cleanId);
            await savePersistentPaperStates(paperStates);
          }
          return NextResponse.json({
            success: true,
            action: 'archive',
            id: cleanId,
            message: 'Paper is already archived.',
          });
        }

        // Attempt local move, catching read-only filesystem errors gracefully
        try {
          if (fs.existsSync(activeFilePath)) {
            if (!fs.existsSync(archiveDir)) {
              fs.mkdirSync(archiveDir, { recursive: true });
            }
            fs.renameSync(activeFilePath, archiveFilePath);
          }
        } catch (fsErr: any) {
          console.warn('[Staged Paper Route] Local filesystem move failed (read-only environment):', fsErr?.message);
        }

        if (!paperStates.archived.includes(cleanId)) {
          paperStates.archived.push(cleanId);
        }
        paperStates.deleted = paperStates.deleted.filter((id) => id !== cleanId);
        await savePersistentPaperStates(paperStates);

        return NextResponse.json({
          success: true,
          action: 'archive',
          id: cleanId,
        });
      }

      if (action === 'unarchive') {
        if (paperStates.deleted.includes(cleanId) || !existence.exists) {
          return NextResponse.json(
            {
              success: false,
              error: `Archived paper "${cleanId}.json" not found in archive directory.`,
            },
            { status: 404 }
          );
        }

        if (!paperStates.archived.includes(cleanId) && existence.isLocallyActive && !existence.isLocallyArchived) {
          return NextResponse.json({
            success: true,
            action: 'unarchive',
            id: cleanId,
            message: 'Paper is already in active staging.',
          });
        }

        // Attempt local move, catching read-only filesystem errors gracefully
        try {
          if (fs.existsSync(archiveFilePath)) {
            if (!fs.existsSync(stagingDir)) {
              fs.mkdirSync(stagingDir, { recursive: true });
            }
            fs.renameSync(archiveFilePath, activeFilePath);
          }
        } catch (fsErr: any) {
          console.warn('[Staged Paper Route] Local filesystem move back failed (read-only environment):', fsErr?.message);
        }

        paperStates.archived = paperStates.archived.filter((id) => id !== cleanId);
        await savePersistentPaperStates(paperStates);

        return NextResponse.json({
          success: true,
          action: 'unarchive',
          id: cleanId,
        });
      }

      if (action === 'delete') {
        if (paperStates.deleted.includes(cleanId) || !existence.exists) {
          return NextResponse.json(
            {
              success: false,
              error: `Paper "${cleanId}.json" not found in staging or archive directory.`,
            },
            { status: 404 }
          );
        }

        // Attempt local unlink, catching read-only filesystem errors gracefully
        try {
          if (fs.existsSync(activeFilePath)) {
            fs.unlinkSync(activeFilePath);
          }
        } catch (fsErr: any) {
          console.warn('[Staged Paper Route] Local active file unlink failed:', fsErr?.message);
        }

        try {
          if (fs.existsSync(archiveFilePath)) {
            fs.unlinkSync(archiveFilePath);
          }
        } catch (fsErr: any) {
          console.warn('[Staged Paper Route] Local archive file unlink failed:', fsErr?.message);
        }

        // Remove from remote storage if present
        try {
          const supabase = getSupabaseClient();
          await supabase.storage.from(STORAGE_BUCKET).remove([`${STAGED_PAPERS_DIR}/${cleanId}.json`]);
        } catch (storageErr: any) {
          console.warn('[Staged Paper Route] Storage remove error:', storageErr?.message);
        }

        if (!paperStates.deleted.includes(cleanId)) {
          paperStates.deleted.push(cleanId);
        }
        paperStates.archived = paperStates.archived.filter((id) => id !== cleanId);
        await savePersistentPaperStates(paperStates);

        return NextResponse.json({
          success: true,
          action: 'delete',
          id: cleanId,
        });
      }

      return NextResponse.json(
        { success: false, error: `Unhandled action: "${action}".` },
        { status: 400 }
      );
    }

    // Branch 2: Paper Staging & Direct Save
    const rawPaper = body?.paper ?? body;
    if (!rawPaper || typeof rawPaper !== 'object' || (!rawPaper.subject && !rawPaper.questions)) {
      return NextResponse.json(
        { success: false, error: 'Missing paper object in request body.' },
        { status: 400 }
      );
    }

    const validation = validateStagingPaper(rawPaper, { allowPartialBatch: true });
    if (!validation.success || !validation.data) {
      return NextResponse.json(
        { success: false, error: 'Paper failed validation', details: validation.errors },
        { status: 422 }
      );
    }

    const paper = validation.data;
    const stagingDir = path.resolve(process.cwd(), 'staging');

    const cleanSubject = (paper.subject.code || 'paper').replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanSeries = (paper.paper.series || 's').toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanYear = String(paper.paper.year).slice(-2);
    const cleanPaperCode = (paper.paper.paper_code || '1').replace(/[^a-zA-Z0-9_-]/g, '');
    const defaultId = `${cleanSubject}_${cleanSeries}${cleanYear}_${cleanPaperCode}`;
    const rawId = body.id || paper.id || defaultId;
    const cleanId = path.basename(rawId).replace(/\.json$/i, '').trim() || defaultId;

    const filePath = path.join(stagingDir, `${cleanId}.json`);
    const paperToSave = { ...paper, id: cleanId };

    let savedLocally = false;
    try {
      if (!fs.existsSync(stagingDir)) {
        fs.mkdirSync(stagingDir, { recursive: true });
      }
      fs.writeFileSync(filePath, JSON.stringify(paperToSave, null, 2), 'utf8');
      savedLocally = true;
    } catch (fsErr: any) {
      console.warn('[Staged Paper Route] Local filesystem write failed (read-only environment):', fsErr?.message);
    }

    if (!savedLocally) {
      const supabase = getSupabaseClient();
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(`${STAGED_PAPERS_DIR}/${cleanId}.json`, JSON.stringify(paperToSave, null, 2), {
          contentType: 'application/json',
          upsert: true,
        });

      if (uploadError) {
        console.error('[Staged Paper Route] Failed to save paper to Supabase storage:', uploadError);
        return NextResponse.json(
          { success: false, error: `Failed to save paper to storage: ${uploadError.message}` },
          { status: 500 }
        );
      }
    }

    // Resurrect paper if previously deleted
    const paperStates = await fetchPersistentPaperStates();
    if (paperStates.deleted.includes(cleanId)) {
      paperStates.deleted = paperStates.deleted.filter((id) => id !== cleanId);
      await savePersistentPaperStates(paperStates);
    }

    return NextResponse.json({
      success: true,
      id: cleanId,
      filename: `${cleanId}.json`,
      paper: paperToSave,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error while executing staging paper operation.',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ingest/staged-paper
 * Optional REST convenience endpoint delegating to delete action.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let rawId = searchParams.get('id');

    if (!rawId) {
      try {
        const body = await request.json();
        rawId = body?.id;
      } catch {
        // ignore
      }
    }

    if (!rawId || typeof rawId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "id" parameter.' },
        { status: 400 }
      );
    }

    if (rawId.includes('..') || rawId.includes('/') || rawId.includes('\\')) {
      return NextResponse.json(
        { success: false, error: `Invalid paper ID: "${rawId}". Directory traversal is not permitted.` },
        { status: 400 }
      );
    }

    const cleanId = path.basename(rawId).replace(/\.json$/i, '').trim();
    if (!cleanId || !/^[a-zA-Z0-9_\-]+$/.test(cleanId)) {
      return NextResponse.json(
        { success: false, error: `Invalid paper ID: "${rawId}"` },
        { status: 400 }
      );
    }

    const stagingDir = path.resolve(process.cwd(), 'staging');
    const archiveDir = path.join(stagingDir, 'archive');
    const activeFilePath = path.join(stagingDir, `${cleanId}.json`);
    const archiveFilePath = path.join(archiveDir, `${cleanId}.json`);

    const paperStates = await fetchPersistentPaperStates();
    const existence = await checkPaperExists(cleanId, stagingDir, archiveDir);

    if (paperStates.deleted.includes(cleanId) || !existence.exists) {
      return NextResponse.json(
        { success: false, error: `Paper "${cleanId}.json" not found in staging or archive directory.` },
        { status: 404 }
      );
    }

    try {
      if (fs.existsSync(activeFilePath)) {
        fs.unlinkSync(activeFilePath);
      }
    } catch (fsErr: any) {
      console.warn('[Staged Paper Route] Local active file unlink failed:', fsErr?.message);
    }

    try {
      if (fs.existsSync(archiveFilePath)) {
        fs.unlinkSync(archiveFilePath);
      }
    } catch (fsErr: any) {
      console.warn('[Staged Paper Route] Local archive file unlink failed:', fsErr?.message);
    }

    try {
      const supabase = getSupabaseClient();
      await supabase.storage.from(STORAGE_BUCKET).remove([`${STAGED_PAPERS_DIR}/${cleanId}.json`]);
    } catch (storageErr: any) {
      console.warn('[Staged Paper Route] Storage remove error:', storageErr?.message);
    }

    if (!paperStates.deleted.includes(cleanId)) {
      paperStates.deleted.push(cleanId);
    }
    paperStates.archived = paperStates.archived.filter((id) => id !== cleanId);
    await savePersistentPaperStates(paperStates);

    return NextResponse.json({
      success: true,
      action: 'delete',
      id: cleanId,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error while deleting staging paper.',
      },
      { status: 500 }
    );
  }
}

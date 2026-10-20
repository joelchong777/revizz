import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { validateStagingPaper, StagedPaperSummary, StagingPaper } from '@/types/ingestion';
import {
  fetchPersistentPaperStates,
  savePersistentPaperStates,
  getSupabaseClient,
  fetchLiveSupabasePapers,
  fetchLiveSupabasePaperDetail,
  STORAGE_BUCKET,
  PAPER_STATES_PATH,
  STAGED_PAPERS_DIR,
  StagingLocation,
  getStagingLocations,
  getFallbackStagingPaper,
} from '@/lib/ingestion/stagedPaperStorage';

async function checkPaperExists(
  cleanId: string,
  locations: StagingLocation[]
): Promise<{
  exists: boolean;
  isLocallyActive: boolean;
  isLocallyArchived: boolean;
  isRemote: boolean;
  activeFilePath?: string;
  archiveFilePath?: string;
}> {
  for (const loc of locations) {
    const activeFilePath = path.join(loc.stagingDir, `${cleanId}.json`);
    const archiveFilePath = path.join(loc.archiveDir, `${cleanId}.json`);

    const isLocallyActive = fs.existsSync(activeFilePath);
    const isLocallyArchived = fs.existsSync(archiveFilePath);

    if (isLocallyActive || isLocallyArchived) {
      return {
        exists: true,
        isLocallyActive,
        isLocallyArchived,
        isRemote: false,
        activeFilePath: isLocallyActive ? activeFilePath : undefined,
        archiveFilePath: isLocallyArchived ? archiveFilePath : undefined,
      };
    }
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

    const locations = getStagingLocations();
    const primaryStagingDir = locations[0]?.stagingDir ?? path.resolve(process.cwd(), 'staging');
    const primaryArchiveDir = locations[0]?.archiveDir ?? path.join(primaryStagingDir, 'archive');

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

      // Check if matching a live paper in Supabase (by UUID or clean ID e.g. 0455_w24_11)
      const liveDbPaper = await fetchLiveSupabasePaperDetail(rawId);
      if (liveDbPaper) {
        return NextResponse.json({
          success: true,
          paper: liveDbPaper.paper,
          is_published: true,
          published_exam_paper_id: liveDbPaper.publishedExamPaperId,
          is_archived: false,
          source: 'database',
        });
      }

      if (deletedSet.has(cleanId)) {
        return NextResponse.json(
          { success: false, error: `Staged paper "${cleanId}" not found in staging directory.` },
          { status: 404 }
        );
      }

      let fileContent: string | null = null;
      let isArchived = archivedSet.has(cleanId);
      let foundLocally = false;
      let localBirthtime: string | null = null;
      let localMtime: string | null = null;

      // Scan all staging directories in precedence order (worktree first, then root)
      for (const loc of locations) {
        const activeFilePath = path.join(loc.stagingDir, `${cleanId}.json`);
        const archiveFilePath = path.join(loc.archiveDir, `${cleanId}.json`);

        if (fs.existsSync(activeFilePath)) {
          try {
            fileContent = fs.readFileSync(activeFilePath, 'utf8');
            foundLocally = true;
            try {
              const stat = fs.statSync(activeFilePath);
              localBirthtime = stat.birthtime ? stat.birthtime.toISOString() : null;
              localMtime = stat.mtime ? stat.mtime.toISOString() : null;
            } catch {
              // ignore
            }
            break;
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
            try {
              const stat = fs.statSync(archiveFilePath);
              localBirthtime = stat.birthtime ? stat.birthtime.toISOString() : null;
              localMtime = stat.mtime ? stat.mtime.toISOString() : null;
            } catch {
              // ignore
            }
            break;
          } catch (readErr: any) {
            return NextResponse.json(
              { success: false, error: `Failed to read archive file for "${cleanId}": ${readErr?.message}` },
              { status: 500 }
            );
          }
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

      // Fallback data if paper not found in staging/storage but requested ID is default fallback
      if (!fileContent && cleanId === '0455_s24_12') {
        const fallback = getFallbackStagingPaper();
        fileContent = JSON.stringify(fallback);
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

      paper.ingested_at = paper.ingested_at || localBirthtime || localMtime || undefined;
      paper.updated_at = paper.updated_at || localMtime || paper.ingested_at || undefined;
      if (isPublished && !paper.published_at) {
        paper.published_at = paper.updated_at || undefined;
      }

      return NextResponse.json({
        success: true,
        paper,
        is_published: isPublished,
        published_exam_paper_id: matchedPaper?.id || null,
        is_archived: isArchived,
        source: isPublished ? 'database' : 'staging',
      });
    }

    // Scenario 2: List all available staged JSON papers with rich metadata
    interface DiscoveredPaper {
      cleanId: string;
      filename: string;
      isLocallyArchived: boolean;
      localPath?: string;
      remotePath?: string;
      remoteCreatedAt?: string | null;
      remoteUpdatedAt?: string | null;
      isFallback?: boolean;
    }

    const discoveredMap = new Map<string, DiscoveredPaper>();

    // Scan staging locations in order of precedence (worktree first, root second)
    for (const loc of locations) {
      if (fs.existsSync(loc.stagingDir)) {
        try {
          const entries = fs.readdirSync(loc.stagingDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
              const cleanId = entry.name.replace(/\.json$/i, '');
              // Worktree takes precedence: only set if not already discovered
              if (!discoveredMap.has(cleanId)) {
                discoveredMap.set(cleanId, {
                  cleanId,
                  filename: entry.name,
                  isLocallyArchived: false,
                  localPath: path.join(loc.stagingDir, entry.name),
                });
              }
            }
          }
        } catch (fsErr: any) {
          console.warn(`[Staged Paper Route] Failed to read staging directory (${loc.stagingDir}):`, fsErr?.message);
        }
      }

      if (fs.existsSync(loc.archiveDir)) {
        try {
          const entries = fs.readdirSync(loc.archiveDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
              const cleanId = entry.name.replace(/\.json$/i, '');
              if (!discoveredMap.has(cleanId)) {
                discoveredMap.set(cleanId, {
                  cleanId,
                  filename: entry.name,
                  isLocallyArchived: true,
                  localPath: path.join(loc.archiveDir, entry.name),
                });
              }
            }
          }
        } catch (fsErr: any) {
          console.warn(`[Staged Paper Route] Failed to read archive directory (${loc.archiveDir}):`, fsErr?.message);
        }
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
                remoteCreatedAt: (item as any).created_at || null,
                remoteUpdatedAt: (item as any).updated_at || null,
              });
            }
          }
        }
      }
    } catch (storageErr: any) {
      console.warn('[Staged Paper Route] Supabase storage list warning:', storageErr?.message);
    }

    // Query live published papers from Supabase papers table & question counts
    const livePapersData = await fetchLiveSupabasePapers();
    const livePaperSummaries: StagedPaperSummary[] = livePapersData.map((lp) => ({
      id: lp.cleanId,
      filename: `${lp.cleanId}.json`,
      subject: lp.subject,
      paper: lp.paper,
      questionsCount: lp.questionsCount,
      diagramsCount: lp.diagramsCount,
      activeCount: lp.activeCount,
      needsReviewCount: lp.needsReviewCount,
      withdrawnCount: lp.withdrawnCount,
      topicsCount: lp.topicsCount,
      topicBreakdown: lp.topicBreakdown,
      ingested_at: (lp.paperRow as any).created_at || null,
      updated_at: (lp.paperRow as any).created_at || null,
      published_at: (lp.paperRow as any).created_at || null,
      source_qp_filename: null,
      source_ms_filename: null,
      lifecycle_state: 'published',
      is_published: true,
      published_exam_paper_id: lp.paperRow.id,
      is_archived: false,
      isValid: lp.questionsCount > 0,
      source: 'database',
    }));
    const liveCleanIdSet = new Set(livePaperSummaries.map((p) => p.id));

    // Fallback: if no papers found at all, check if fallback 0455_s24_12 is available and not deleted
    const activeCleanIds = Array.from(discoveredMap.keys()).filter((id) => !deletedSet.has(id));
    if (activeCleanIds.length === 0 && livePaperSummaries.length === 0 && !deletedSet.has('0455_s24_12')) {
      discoveredMap.set('0455_s24_12', {
        cleanId: '0455_s24_12',
        filename: '0455_s24_12.json',
        isLocallyArchived: false,
        isFallback: true,
      });
    }

    const publishedMap = await fetchPublishedPapersMap();
    const stagedSummaries: StagedPaperSummary[] = [];

    const sortedCleanIds = Array.from(discoveredMap.keys()).sort((a, b) => a.localeCompare(b));

    for (const cleanId of sortedCleanIds) {
      if (deletedSet.has(cleanId)) {
        continue;
      }

      // If already present as a live published paper in Supabase, live database paper takes priority!
      if (liveCleanIdSet.has(cleanId)) {
        continue;
      }

      const item = discoveredMap.get(cleanId)!;
      const isArchived = archivedSet.has(cleanId) || item.isLocallyArchived;

      if (!includeArchived && isArchived) {
        continue;
      }

      let localBirthtime: string | null = null;
      let localMtime: string | null = null;
      if (item.localPath && fs.existsSync(item.localPath)) {
        try {
          const stat = fs.statSync(item.localPath);
          localBirthtime = stat.birthtime ? stat.birthtime.toISOString() : null;
          localMtime = stat.mtime ? stat.mtime.toISOString() : null;
        } catch {
          // ignore
        }
      }

      let fileContent: string | null = null;
      if (item.isFallback) {
        fileContent = JSON.stringify(getFallbackStagingPaper());
      } else {
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

        const ingestedAt = localBirthtime || localMtime || item.remoteCreatedAt || item.remoteUpdatedAt || null;
        const updatedAt = localMtime || item.remoteUpdatedAt || ingestedAt || null;
        const publishedAt = isPublished ? updatedAt : null;

        stagedSummaries.push({
          id: cleanId,
          filename: item.filename,
          questionsCount: 0,
          diagramsCount: 0,
          activeCount: 0,
          needsReviewCount: 0,
          withdrawnCount: 0,
          topicsCount: 0,
          topicBreakdown: [],
          ingested_at: ingestedAt,
          updated_at: updatedAt,
          published_at: publishedAt,
          source_qp_filename: null,
          source_ms_filename: null,
          lifecycle_state: isPublished ? 'published' : 'draft',
          is_published: isPublished,
          published_exam_paper_id: matchedPaper?.id || null,
          is_archived: isArchived,
          isValid: false,
          source: isPublished ? 'database' : 'staging',
        });
        continue;
      }

      try {
        const parsedJson = JSON.parse(fileContent);
        const questions = Array.isArray(parsedJson?.questions) ? parsedJson.questions : [];
        const diagramsCount = questions.filter(
          (q: any) => Boolean(q?.diagram?.has_diagram || q?.has_diagram || q?.diagram?.image_url || q?.image_url)
        ).length;

        let activeCount = 0;
        let needsReviewCount = 0;
        let withdrawnCount = 0;
        const topicCounts = new Map<string, number>();

        for (const q of questions) {
          if (q?.status === 'needs_review') {
            needsReviewCount++;
          } else if (q?.status === 'withdrawn') {
            withdrawnCount++;
          } else {
            activeCount++;
          }

          const tName = (typeof q?.topic_name === 'string' && q.topic_name.trim()) ? q.topic_name.trim() : 'General';
          topicCounts.set(tName, (topicCounts.get(tName) || 0) + 1);
        }

        const topicBreakdown = Array.from(topicCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        const topicsCount = topicBreakdown.length;

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

        const ingestedAt = parsedJson?.ingested_at || localBirthtime || localMtime || item.remoteCreatedAt || item.remoteUpdatedAt || null;
        const updatedAt = parsedJson?.updated_at || localMtime || item.remoteUpdatedAt || ingestedAt || null;
        const publishedAt = parsedJson?.published_at || (isPublished ? updatedAt : null);

        stagedSummaries.push({
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
          activeCount,
          needsReviewCount,
          withdrawnCount,
          topicsCount,
          topicBreakdown,
          ingested_at: ingestedAt,
          updated_at: updatedAt,
          published_at: publishedAt,
          source_qp_filename: parsedJson?.source_qp_filename || null,
          source_ms_filename: parsedJson?.source_ms_filename || null,
          lifecycle_state: lifecycleState,
          is_published: isPublished,
          published_exam_paper_id: publishedExamPaperId,
          is_archived: isArchived,
          isValid: questions.length > 0,
          source: isPublished ? 'database' : 'staging',
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

        const ingestedAt = localBirthtime || localMtime || item.remoteCreatedAt || item.remoteUpdatedAt || null;
        const updatedAt = localMtime || item.remoteUpdatedAt || ingestedAt || null;
        const publishedAt = isPublished ? updatedAt : null;

        stagedSummaries.push({
          id: cleanId,
          filename: item.filename,
          questionsCount: 0,
          diagramsCount: 0,
          activeCount: 0,
          needsReviewCount: 0,
          withdrawnCount: 0,
          topicsCount: 0,
          topicBreakdown: [],
          ingested_at: ingestedAt,
          updated_at: updatedAt,
          published_at: publishedAt,
          source_qp_filename: null,
          source_ms_filename: null,
          lifecycle_state: isPublished ? 'published' : 'draft',
          is_published: isPublished,
          published_exam_paper_id: matchedPaper?.id || null,
          is_archived: isArchived,
          isValid: false,
          source: isPublished ? 'database' : 'staging',
        });
      }
    }

    // Sort with live published papers first, followed by staged papers
    const allStagedPapers: StagedPaperSummary[] = [...livePaperSummaries, ...stagedSummaries];
    const papers: string[] = allStagedPapers.map((p) => p.id);

    return NextResponse.json({
      success: true,
      papers,
      stagedPapers: allStagedPapers,
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

      const locations = getStagingLocations();
      const paperStates = await fetchPersistentPaperStates();
      const existence = await checkPaperExists(cleanId, locations);

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
          if (existence.activeFilePath && fs.existsSync(existence.activeFilePath)) {
            const activeDir = path.dirname(existence.activeFilePath);
            const targetArchiveDir = path.join(activeDir, 'archive');
            if (!fs.existsSync(targetArchiveDir)) {
              fs.mkdirSync(targetArchiveDir, { recursive: true });
            }
            const targetArchiveFilePath = path.join(targetArchiveDir, `${cleanId}.json`);
            fs.renameSync(existence.activeFilePath, targetArchiveFilePath);
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
          if (existence.archiveFilePath && fs.existsSync(existence.archiveFilePath)) {
            const archiveDir = path.dirname(existence.archiveFilePath);
            const targetStagingDir = path.dirname(archiveDir);
            if (!fs.existsSync(targetStagingDir)) {
              fs.mkdirSync(targetStagingDir, { recursive: true });
            }
            const targetActiveFilePath = path.join(targetStagingDir, `${cleanId}.json`);
            fs.renameSync(existence.archiveFilePath, targetActiveFilePath);
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

        // Unlink across all staging locations
        for (const loc of locations) {
          const actPath = path.join(loc.stagingDir, `${cleanId}.json`);
          const arcPath = path.join(loc.archiveDir, `${cleanId}.json`);
          try {
            if (fs.existsSync(actPath)) fs.unlinkSync(actPath);
          } catch (fsErr: any) {
            console.warn('[Staged Paper Route] Local active file unlink failed:', fsErr?.message);
          }
          try {
            if (fs.existsSync(arcPath)) fs.unlinkSync(arcPath);
          } catch (fsErr: any) {
            console.warn('[Staged Paper Route] Local archive file unlink failed:', fsErr?.message);
          }
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

    let existingIngestedAt: string | null = null;
    if (fs.existsSync(filePath)) {
      try {
        const existingContent = fs.readFileSync(filePath, 'utf8');
        const existingParsed = JSON.parse(existingContent);
        if (existingParsed?.ingested_at) {
          existingIngestedAt = existingParsed.ingested_at;
        } else {
          const stat = fs.statSync(filePath);
          existingIngestedAt = stat.birthtime ? stat.birthtime.toISOString() : null;
        }
      } catch {
        // ignore
      }
    }

    const nowIso = new Date().toISOString();
    const paperToSave = {
      ...paper,
      id: cleanId,
      ingested_at: paper.ingested_at || existingIngestedAt || nowIso,
      updated_at: nowIso,
    };

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

    const locations = getStagingLocations();
    const paperStates = await fetchPersistentPaperStates();
    const existence = await checkPaperExists(cleanId, locations);

    if (paperStates.deleted.includes(cleanId) || !existence.exists) {
      return NextResponse.json(
        { success: false, error: `Paper "${cleanId}.json" not found in staging or archive directory.` },
        { status: 404 }
      );
    }

    for (const loc of locations) {
      const actPath = path.join(loc.stagingDir, `${cleanId}.json`);
      const arcPath = path.join(loc.archiveDir, `${cleanId}.json`);
      try {
        if (fs.existsSync(actPath)) fs.unlinkSync(actPath);
      } catch (fsErr: any) {
        console.warn('[Staged Paper Route] Local active file unlink failed:', fsErr?.message);
      }
      try {
        if (fs.existsSync(arcPath)) fs.unlinkSync(arcPath);
      } catch (fsErr: any) {
        console.warn('[Staged Paper Route] Local archive file unlink failed:', fsErr?.message);
      }
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

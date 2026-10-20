// Polyfill WebSocket in Node runtime if absent (required by @supabase/supabase-js realtime client)
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { StagingPaper, StagingQuestion, validateStagingPaper } from '@/types/ingestion';

export interface StagedPaperStates {
  archived: string[]; // array of paper cleanIds
  deleted: string[];  // array of paper cleanIds
}

export const STORAGE_BUCKET = 'question-diagrams';
export const PAPER_STATES_PATH = 'staged_metadata/paper_states.json';
export const STAGED_PAPERS_DIR = 'staged_papers';

export function getSupabaseClient(): SupabaseClient {
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
        ? parsed.deleted.filter(
            (id: any) => typeof id === 'string' && id.trim()
          )
        : [],
    };
  } catch (err: any) {
    console.warn('[Staged Paper Storage] Failed to fetch persistent paper states, fallback to empty:', err?.message);
    return { archived: [], deleted: [] };
  }
}

export async function savePersistentPaperStates(states: StagedPaperStates): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    const deletedList = Array.from(new Set(states.deleted || []))
      .filter(Boolean);
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
      console.warn('[Staged Paper Storage] Failed to save persistent paper states:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[Staged Paper Storage] Exception saving persistent paper states:', err?.message);
    return false;
  }
}

export interface StagingLocation {
  stagingDir: string;
  archiveDir: string;
  isWorktree: boolean;
}

export function getStagingLocations(): StagingLocation[] {
  const locations: StagingLocation[] = [];
  const primaryStaging = path.resolve(process.cwd(), 'staging');
  locations.push({
    stagingDir: primaryStaging,
    archiveDir: path.join(primaryStaging, 'archive'),
    isWorktree: true,
  });

  const rootStaging = path.resolve(process.cwd(), '../../staging');
  if (rootStaging !== primaryStaging && fs.existsSync(rootStaging)) {
    try {
      const statPrimary = fs.existsSync(primaryStaging) ? fs.statSync(primaryStaging) : null;
      const statRoot = fs.statSync(rootStaging);
      // Ensure root staging is distinct from worktree staging
      if (!statPrimary || statPrimary.ino !== statRoot.ino || statPrimary.dev !== statRoot.dev) {
        locations.push({
          stagingDir: rootStaging,
          archiveDir: path.join(rootStaging, 'archive'),
          isWorktree: false,
        });
      }
    } catch {
      if (rootStaging !== primaryStaging) {
        locations.push({
          stagingDir: rootStaging,
          archiveDir: path.join(rootStaging, 'archive'),
          isWorktree: false,
        });
      }
    }
  }

  return locations;
}

export function getFallbackStagingPaper(customLocations?: StagingLocation[]): StagingPaper {
  const locs = customLocations ?? getStagingLocations();
  for (const loc of locs) {
    const filePath = path.join(loc.stagingDir, '0455_s24_12.json');
    if (fs.existsSync(filePath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          return {
            ...parsed,
            id: parsed.id || '0455_s24_12',
            lifecycle_state: parsed.lifecycle_state || 'review',
          };
        }
      } catch (err: any) {
        console.warn('[Staged Paper Route] Error reading local 0455_s24_12.json for fallback:', err?.message);
      }
    }
  }

  // Pure static fallback object with zero client-hook dependencies
  return {
    id: '0455_s24_12',
    lifecycle_state: 'review',
    subject: {
      code: '0455',
      name: 'Economics',
      icon: 'trending-up',
    },
    paper: {
      series: 's',
      paper_code: '12',
      year: 2024,
    },
    syllabus_topics: [
      { name: 'The basic economic problem', order_index: 1 },
      { name: 'The allocation of resources', order_index: 2 },
      { name: 'Microeconomic decision makers', order_index: 3 },
      { name: 'Government and the macroeconomy', order_index: 4 },
      { name: 'Economic development', order_index: 5 },
      { name: 'International trade and globalisation', order_index: 6 },
    ],
    questions: [
      {
        question_number: 1,
        cambridge_source_ref: 'Cambridge IGCSE Economics 0455/12 May/June 2024 Q1',
        topic_name: 'The basic economic problem',
        stem_markdown: 'Why will scarcity always exist?',
        diagram: {
          has_diagram: false,
        },
        options: [
          { label: 'A', content_markdown: 'There are high costs of production.', is_correct: false },
          { label: 'B', content_markdown: 'There are low levels of education.', is_correct: false },
          { label: 'C', content_markdown: 'There are unlimited resources.', is_correct: false },
          { label: 'D', content_markdown: 'There are unlimited wants.', is_correct: true },
        ],
        explanation_markdown: 'Scarcity occurs when wants are unlimited but resources are finite.',
        status: 'active',
      },
      {
        question_number: 2,
        cambridge_source_ref: 'Cambridge IGCSE Economics 0455/12 May/June 2024 Q2',
        topic_name: 'The basic economic problem',
        stem_markdown: 'A student decides to take up a two-year apprenticeship for which she will earn \\$10,000 per year. After that, she expects to earn \\$25,000 per year. She could take an unskilled job which pays \\$16,000 per year instead of the apprenticeship.\n\nWhat is the opportunity cost in the two years of completing the apprenticeship?',
        diagram: {
          has_diagram: false,
        },
        options: [
          { label: 'A', content_markdown: '\\$10,000', is_correct: false },
          { label: 'B', content_markdown: '\\$12,000', is_correct: true },
          { label: 'C', content_markdown: '\\$25,000', is_correct: false },
          { label: 'D', content_markdown: '\\$32,000', is_correct: false },
        ],
        explanation_markdown: 'Opportunity cost is the next best alternative forgone: ($16,000 - $10,000) * 2 = $12,000.',
        status: 'active',
      },
    ],
  };
}

export function generateCleanPaperId(
  subjectCode: string | undefined | null,
  series: string | undefined | null,
  year: number | string | undefined | null,
  paperCode: string | number | undefined | null
): string {
  const code = String(subjectCode || '0455').trim();
  const s = String(series || 's').trim().toLowerCase();
  const rawY = String(year || '24').trim();
  const y = rawY.length === 4 ? rawY.slice(2) : rawY;
  const p = String(paperCode || '12').trim().replace(/^paper\s*/i, '');
  return `${code}_${s}${y}_${p}`;
}

export interface LiveSupabasePaperSummary {
  paperRow: any;
  cleanId: string;
  subject: { code: string; name: string; icon: string };
  paper: { year: number; series: string; paper_code: string };
  questionsCount: number;
  diagramsCount: number;
  activeCount: number;
  needsReviewCount: number;
  withdrawnCount: number;
  topicsCount: number;
  topicBreakdown: { name: string; count: number }[];
}

export async function fetchLiveSupabasePapers(): Promise<LiveSupabasePaperSummary[]> {
  try {
    const supabase = getSupabaseClient();
    const { data: papersData, error: papersErr } = await supabase
      .from('papers')
      .select('id, series, paper_code, year, subjects(id, code, name, icon)');

    if (papersErr || !Array.isArray(papersData) || papersData.length === 0) {
      if (papersErr) {
        console.warn('[fetchLiveSupabasePapers] Supabase papers query warning:', papersErr.message);
      }
      return [];
    }

    const { data: questionsData, error: qErr } = await supabase
      .from('questions')
      .select('paper_id, id, diagram_metadata, image_url, status, topic_id, topics(name)');

    if (qErr) {
      console.warn('[fetchLiveSupabasePapers] Questions query warning:', qErr.message);
    }

    const qMap = new Map<string, Array<any>>();
    if (Array.isArray(questionsData)) {
      for (const q of questionsData) {
        if (!q.paper_id) continue;
        const list = qMap.get(q.paper_id) || [];
        list.push(q);
        qMap.set(q.paper_id, list);
      }
    }

    const summaries: LiveSupabasePaperSummary[] = [];

    for (const row of papersData) {
      const subj = Array.isArray(row.subjects) ? row.subjects[0] : row.subjects;
      const subjectCode = subj?.code || '0455';
      const subjectName = subj?.name || 'Economics';
      const subjectIcon = subj?.icon || 'trending-up';
      const cleanId = generateCleanPaperId(subjectCode, row.series, row.year, row.paper_code);

      const paperQuestions = qMap.get(row.id) || [];
      const questionsCount = paperQuestions.length;

      let diagramsCount = 0;
      let activeCount = 0;
      let needsReviewCount = 0;
      let withdrawnCount = 0;
      const topicCounts = new Map<string, number>();

      for (const q of paperQuestions) {
        const hasDiag = Boolean(q.diagram_metadata?.has_diagram || q.image_url);
        if (hasDiag) diagramsCount++;

        const s = (q.status || '').toLowerCase();
        if (s.includes('withdrawn')) withdrawnCount++;
        else if (s.includes('review')) needsReviewCount++;
        else activeCount++;

        const tName = q.topics?.name || 'General';
        topicCounts.set(tName, (topicCounts.get(tName) || 0) + 1);
      }

      const topicBreakdown = Array.from(topicCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      summaries.push({
        paperRow: row,
        cleanId,
        subject: {
          code: subjectCode,
          name: subjectName,
          icon: subjectIcon,
        },
        paper: {
          year: row.year,
          series: row.series,
          paper_code: String(row.paper_code),
        },
        questionsCount,
        diagramsCount,
        activeCount,
        needsReviewCount,
        withdrawnCount,
        topicsCount: topicBreakdown.length,
        topicBreakdown,
      });
    }

    // Sort live papers by year desc, series, paper_code asc (e.g. 0455_w24_11, 0455_w24_12, 0455_w24_13)
    summaries.sort((a, b) => {
      if (b.paper.year !== a.paper.year) return b.paper.year - a.paper.year;
      if (a.paper.series !== b.paper.series) return a.paper.series.localeCompare(b.paper.series);
      return a.paper.paper_code.localeCompare(b.paper.paper_code);
    });

    return summaries;
  } catch (err: any) {
    console.warn('[fetchLiveSupabasePapers] Unexpected error:', err?.message);
    return [];
  }
}

export async function fetchLiveSupabasePaperDetail(
  paperIdOrCleanId: string
): Promise<{ paper: StagingPaper; publishedExamPaperId: string } | null> {
  try {
    const supabase = getSupabaseClient();
    const clean = path.basename(paperIdOrCleanId).replace(/\.json$/i, '').trim();

    // Query all papers from Supabase
    const { data: papersData, error: papersErr } = await supabase
      .from('papers')
      .select('id, series, paper_code, year, subjects(id, code, name, icon)');

    if (papersErr || !Array.isArray(papersData) || papersData.length === 0) {
      return null;
    }

    // Match by UUID or clean ID (e.g. 0455_w24_11)
    const matchedPaper = papersData.find((p) => {
      if (p.id === clean || p.id === paperIdOrCleanId) return true;
      const subj = Array.isArray(p.subjects) ? p.subjects[0] : p.subjects;
      const candId = generateCleanPaperId(subj?.code, p.series, p.year, p.paper_code);
      return candId.toLowerCase() === clean.toLowerCase();
    });

    if (!matchedPaper) {
      return null;
    }

    const { data: dbQuestions, error: qErr } = await supabase
      .from('questions')
      .select('*, question_options(*), topics(*)')
      .eq('paper_id', matchedPaper.id)
      .order('question_number', { ascending: true });

    if (qErr || !Array.isArray(dbQuestions) || dbQuestions.length === 0) {
      console.warn(
        `[fetchLiveSupabasePaperDetail] No questions found for paper ${matchedPaper.id}:`,
        qErr?.message
      );
      return null;
    }

    const subj = Array.isArray(matchedPaper.subjects) ? matchedPaper.subjects[0] : matchedPaper.subjects;
    const cleanId = generateCleanPaperId(
      subj?.code,
      matchedPaper.series,
      matchedPaper.year,
      matchedPaper.paper_code
    );

    const topicMap = new Map<string, { name: string; order_index: number }>();
    for (const q of dbQuestions) {
      if (q.topics && q.topics.name) {
        if (!topicMap.has(q.topics.name)) {
          topicMap.set(q.topics.name, {
            name: q.topics.name,
            order_index: q.topics.order_index ?? topicMap.size + 1,
          });
        }
      }
    }
    const syllabus_topics = Array.from(topicMap.values());
    if (syllabus_topics.length === 0) {
      syllabus_topics.push({ name: 'General', order_index: 1 });
    }

    const questions: StagingQuestion[] = dbQuestions.map((dbQ) => {
      const hasDiag = Boolean(dbQ.diagram_metadata?.has_diagram || dbQ.image_url);
      const options = (dbQ.question_options || [])
        .slice()
        .sort((a: any, b: any) => String(a.label || '').localeCompare(String(b.label || '')))
        .map((opt: any) => ({
          label: (opt.label || 'A') as 'A' | 'B' | 'C' | 'D',
          content_markdown: opt.content_markdown || '',
          is_correct: Boolean(opt.is_correct),
        }));

      const distractorAnalysis: Record<string, string> = {};
      for (const opt of dbQ.question_options || []) {
        if (opt.distractor_reasoning && opt.label) {
          distractorAnalysis[opt.label] = opt.distractor_reasoning;
        }
      }

      const s = (dbQ.status || '').toLowerCase();
      let status: 'active' | 'withdrawn' | 'needs_review' = 'active';
      if (s.includes('withdrawn')) status = 'withdrawn';
      else if (s.includes('review')) status = 'needs_review';

      return {
        question_number: dbQ.question_number,
        cambridge_source_ref: dbQ.cambridge_source_ref || '',
        topic_name: dbQ.topics?.name || 'General',
        stem_markdown: dbQ.stem_markdown || '',
        diagram: {
          has_diagram: hasDiag,
          image_url: dbQ.diagram_metadata?.image_url || dbQ.image_url || undefined,
          bounding_box: dbQ.diagram_metadata?.bounding_box || undefined,
          storage_path: dbQ.diagram_metadata?.storage_path || undefined,
          alt_description: dbQ.diagram_metadata?.alt_description || undefined,
        },
        options,
        explanation_markdown: dbQ.explanation_markdown || '',
        status,
        distractor_analysis:
          Object.keys(distractorAnalysis).length > 0 ? distractorAnalysis : undefined,
      };
    });

    const stagedPaper: StagingPaper = {
      id: cleanId,
      lifecycle_state: 'published',
      source: 'database',
      subject: {
        code: subj?.code || '0455',
        name: subj?.name || 'Economics',
        icon: subj?.icon || 'trending-up',
      },
      paper: {
        series: matchedPaper.series,
        paper_code: String(matchedPaper.paper_code),
        year: matchedPaper.year,
      },
      syllabus_topics,
      questions,
      ingested_at: (dbQuestions[0] as any)?.created_at || new Date().toISOString(),
      updated_at: (dbQuestions[0] as any)?.created_at || new Date().toISOString(),
      published_at: (dbQuestions[0] as any)?.created_at || new Date().toISOString(),
    };

    const validation = validateStagingPaper(stagedPaper, { allowPartialBatch: true });
    return {
      paper: validation.data || stagedPaper,
      publishedExamPaperId: matchedPaper.id,
    };
  } catch (err: any) {
    console.warn(
      `[fetchLiveSupabasePaperDetail] Failed to load "${paperIdOrCleanId}":`,
      err?.message
    );
    return null;
  }
}


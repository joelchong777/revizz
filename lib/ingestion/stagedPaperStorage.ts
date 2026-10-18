// Polyfill WebSocket in Node runtime if absent (required by @supabase/supabase-js realtime client)
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { StagingPaper } from '@/types/ingestion';

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
        ? parsed.deleted.filter((id: any) => typeof id === 'string' && id.trim())
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

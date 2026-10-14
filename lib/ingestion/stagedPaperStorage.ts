// Polyfill WebSocket in Node runtime if absent (required by @supabase/supabase-js realtime client)
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';

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

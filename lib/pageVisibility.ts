/**
 * Page visibility: admins can hide student and teacher pages.
 * The server stores only the hidden ids; a missing row means the page is shown.
 * Every fetch fails open (returns no hidden pages) so an outage never locks users out.
 */
import { useCallback, useEffect, useState } from 'react';

export type PageAudience = 'student' | 'teacher';

export const PAGE_REGISTRY = [
  // Teacher portal (ids match DEFAULT_PORTAL_NAV_ITEMS in lib/portal/menuConfig.ts)
  { id: 'overview', label: 'Overview', audience: 'teacher', description: 'Teacher portal home' },
  { id: 'roster', label: 'Classes', audience: 'teacher', description: 'Class rosters and invites' },
  { id: 'assign', label: 'Assign rounds', audience: 'teacher', description: 'Set homework for classes' },
  { id: 'compiler', label: 'Test compiler', audience: 'teacher', description: 'Build and print papers' },
  { id: 'mastery', label: 'Mastery analytics', audience: 'teacher', description: 'Topic mastery by class' },
  { id: 'xp', label: 'Leaderboard & XP', audience: 'teacher', description: 'XP and leaderboard settings' },
  { id: 'bank', label: 'Question bank', audience: 'teacher', description: 'Browse all questions' },
  { id: 'flagged', label: 'Flagged questions', audience: 'teacher', description: 'Questions reported by students' },
  { id: 'school', label: 'School', audience: 'teacher', description: 'School account settings' },
  // Student app
  { id: 'quiz', label: 'Quiz', audience: 'student', description: 'The quiz home page (/)' },
  { id: 'profile', label: 'Profile', audience: 'student', description: 'Profile hub overview (/profile)' },
  { id: 'stats', label: 'Stats', audience: 'student', description: 'Progress and mastery stats' },
  { id: 'review', label: 'Review pile', audience: 'student', description: 'Missed questions to revisit' },
  { id: 'homework', label: 'Homework', audience: 'student', description: '/homework and the profile homework tab' },
  { id: 'achievements', label: 'Achievements', audience: 'student', description: 'Badges and achievements' },
  { id: 'leaderboard', label: 'Leaderboard', audience: 'student', description: 'Leaderboard modal in the header' },
  { id: 'student-settings', label: 'Student settings', audience: 'student', description: 'Profile settings tab' },
] as const satisfies ReadonlyArray<{ id: string; label: string; audience: PageAudience; description: string }>;

export type PageId = (typeof PAGE_REGISTRY)[number]['id'];

export const PAGE_VISIBILITY_CHANGE_EVENT = 'revizz_page_visibility_changed';
export const PAGE_VISIBILITY_ENDPOINT = '/api/page-visibility';
export const ADMIN_PAGE_VISIBILITY_ENDPOINT = '/api/admin/page-visibility';

export function isKnownPageId(id: unknown): id is PageId {
  return typeof id === 'string' && PAGE_REGISTRY.some((p) => p.id === id);
}

export function isPageHidden(hidden: string[], id: string): boolean {
  return hidden.includes(id);
}

/** Returns items whose id is not hidden. */
export function filterHidden<T extends { id: string }>(items: T[], hidden: string[]): T[] {
  return items.filter((item) => !isPageHidden(hidden, item.id));
}

export async function fetchHiddenPages(): Promise<string[]> {
  try {
    const res = await fetch(PAGE_VISIBILITY_ENDPOINT, { cache: 'no-store' });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.hidden) ? json.hidden.filter((x: unknown) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function notifyChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PAGE_VISIBILITY_CHANGE_EVENT));
}

async function sendAdmin(method: 'PUT' | 'POST', body: unknown): Promise<void> {
  const { authFetch } = await import('./authFetch');
  const res = await authFetch(ADMIN_PAGE_VISIBILITY_ENDPOINT, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Could not save (HTTP ${res.status})`;
    try {
      const json = await res.json();
      if (json?.error) message = String(json.error);
    } catch {
      // keep the default message
    }
    throw new Error(message);
  }
  notifyChanged();
}

export async function setPageEnabled(id: string, enabled: boolean): Promise<void> {
  await sendAdmin('PUT', { pageId: id, enabled });
}

/** Re-enables every page. */
export async function resetPageVisibility(): Promise<void> {
  await sendAdmin('POST', { reset: true });
}

// Module-level cache so many components share one request.
let cachedHidden: string[] = [];
let cacheLoaded = false;
let inflight: Promise<string[]> | null = null;
const subscribers = new Set<() => void>();

function loadShared(force = false): Promise<string[]> {
  if (inflight) return inflight;
  if (cacheLoaded && !force) return Promise.resolve(cachedHidden);
  inflight = fetchHiddenPages()
    .then((hidden) => {
      cachedHidden = hidden;
      cacheLoaded = true;
      subscribers.forEach((fn) => fn());
      return hidden;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function usePageVisibility(): {
  hidden: string[];
  loaded: boolean;
  isHidden: (id: string) => boolean;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState({ hidden: cachedHidden, loaded: cacheLoaded });

  useEffect(() => {
    const sync = () => setState({ hidden: cachedHidden, loaded: cacheLoaded });
    subscribers.add(sync);
    const onChange = () => {
      void loadShared(true);
    };
    window.addEventListener(PAGE_VISIBILITY_CHANGE_EVENT, onChange);
    void loadShared();
    sync();
    return () => {
      subscribers.delete(sync);
      window.removeEventListener(PAGE_VISIBILITY_CHANGE_EVENT, onChange);
    };
  }, []);

  const isHidden = useCallback((id: string) => isPageHidden(state.hidden, id), [state.hidden]);
  const refresh = useCallback(async () => {
    await loadShared(true);
  }, []);

  return { hidden: state.hidden, loaded: state.loaded, isHidden, refresh };
}

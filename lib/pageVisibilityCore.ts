/**
 * Core registry, types, and pure helpers for Page Visibility.
 * Server-safe: Zero React dependencies so it can be safely imported by API route handlers.
 */

export type PageAudience = 'student' | 'teacher';

export const PAGE_REGISTRY = [
  // Teacher portal (ids match DEFAULT_PORTAL_NAV_ITEMS in lib/portal/menuConfig.ts)
  { id: 'overview', label: 'Overview', audience: 'teacher', description: 'Educator portal home' },
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

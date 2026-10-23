/**
 * Revizz Topic Mastery & Review Pile Engine
 * 
 * Manages:
 * 1. Topic Mastery calculations with Novice / Proficient / Master badges
 * 2. Persistent Review Pile in localStorage for guest students
 * 3. First-attempt correct history for accurate mastery progression
 */

export const REVIEW_PILE_KEY = 'revizz_guest_review_pile';
export const FIRST_TRY_CORRECT_KEY = 'revizz_first_try_correct_ids';

export type MasteryTier = 'novice' | 'proficient' | 'master';

export interface MasteryBadge {
  tier: MasteryTier;
  label: string;
  icon: string;
  chipClass: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  progressColorClass: string;
}

export interface ReviewPileEntry {
  questionId: string;
  mistakeCount: number;
  lastMistakeAt: number;
}

export type ReviewPileMap = Record<string, { mistakeCount: number; lastMistakeAt: number }>;

/**
 * Mastery badge definitions adhering to Revizz specs:
 * - Novice: < 50% (Bronze chip / 🌱 badge)
 * - Proficient: 50% - 80% (Silver chip / ⚡ badge)
 * - Master: > 80% (Gold chip / 👑 badge)
 */
export function getMasteryTier(percentage: number): MasteryTier {
  if (percentage > 80) return 'master';
  if (percentage >= 50) return 'proficient';
  return 'novice';
}

export function getMasteryBadge(percentage: number): MasteryBadge {
  const tier = getMasteryTier(percentage);

  switch (tier) {
    case 'master':
      return {
        tier: 'master',
        label: 'Master',
        icon: '👑',
        chipClass: 'bg-amber-100 text-amber-900 border-2 border-amber-400 shadow-xs',
        textClass: 'text-amber-900',
        bgClass: 'bg-amber-100',
        borderClass: 'border-amber-400',
        progressColorClass: 'bg-gradient-to-r from-amber-400 to-yellow-500',
      };
    case 'proficient':
      return {
        tier: 'proficient',
        label: 'Proficient',
        icon: '⚡',
        chipClass: 'bg-slate-100 text-slate-800 border-2 border-slate-300 shadow-xs',
        textClass: 'text-slate-800',
        bgClass: 'bg-slate-100',
        borderClass: 'border-slate-300',
        progressColorClass: 'bg-gradient-to-r from-teal-400 to-emerald-500',
      };
    case 'novice':
    default:
      return {
        tier: 'novice',
        label: 'Novice',
        icon: '🌱',
        chipClass: 'bg-orange-50 text-orange-900 border-2 border-orange-300 shadow-xs',
        textClass: 'text-orange-900',
        bgClass: 'bg-orange-50',
        borderClass: 'border-orange-300',
        progressColorClass: 'bg-gradient-to-r from-orange-300 to-amber-400',
      };
  }
}

/**
 * Calculates mastery percentage:
 * (Unique questions answered correctly on 1st attempt) / (Total questions in topic) * 100
 */
export function calculateMasteryPercentage(
  firstTryCorrectCount: number,
  totalQuestions: number
): number {
  if (!totalQuestions || totalQuestions <= 0) return 0;
  const pct = (firstTryCorrectCount / totalQuestions) * 100;
  return Math.min(100, Math.max(0, Math.round(pct)));
}

/* ==========================================================================
   Review Pile Management (localStorage)
   ========================================================================== */

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function notifyReviewPileChanged(): void {
  if (!isClient()) return;
  try {
    window.dispatchEvent(new CustomEvent('revizz_review_pile_changed'));
  } catch (err) {
    console.warn('Error dispatching review pile event:', err);
  }
}

export function getReviewPile(): ReviewPileMap {
  if (!isClient()) return {};
  try {
    const raw = localStorage.getItem(REVIEW_PILE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as ReviewPileMap;
    }
  } catch (err) {
    console.warn('Failed to parse review pile from localStorage:', err);
  }
  return {};
}

/**
 * Merges review-pile rows from the server into the local pile (pure).
 * Union by question id; keeps the higher mistake count and the later lastMistakeAt.
 * A remote row without a timestamp keeps the local time, or 0 when it is new to this device.
 */
export function mergeReviewPile(
  local: ReviewPileMap,
  remote: Array<{ questionId: string; mistakeCount: number; lastMistakeAt?: number }>
): ReviewPileMap {
  const merged: ReviewPileMap = { ...(local || {}) };
  for (const row of remote || []) {
    if (!row || !row.questionId) continue;
    const count = Number(row.mistakeCount) || 0;
    const at = Number(row.lastMistakeAt) || 0;
    const existing = merged[row.questionId];
    merged[row.questionId] = existing
      ? {
          mistakeCount: Math.max(existing.mistakeCount || 0, count),
          lastMistakeAt: Math.max(existing.lastMistakeAt || 0, at),
        }
      : { mistakeCount: Math.max(1, count), lastMistakeAt: at };
  }
  return merged;
}

/**
 * Returns array of question IDs currently in the review pile.
 */
export function getReviewPileIds(): string[] {
  const pile = getReviewPile();
  return Object.keys(pile);
}

/**
 * Returns the count of questions currently waiting in the review pile.
 */
export function getReviewPileCount(): number {
  return getReviewPileIds().length;
}

/**
 * Adds a question ID to the review pile or increments its mistake count.
 */
export function addToReviewPile(questionId: string): void {
  if (!isClient() || !questionId) return;
  try {
    const pile = getReviewPile();
    const current = pile[questionId] || { mistakeCount: 0, lastMistakeAt: Date.now() };
    pile[questionId] = {
      mistakeCount: current.mistakeCount + 1,
      lastMistakeAt: Date.now(),
    };
    localStorage.setItem(REVIEW_PILE_KEY, JSON.stringify(pile));
    notifyReviewPileChanged();
  } catch (err) {
    console.warn('Failed to add question to review pile:', err);
  }
}

/**
 * Removes/resolves a question from the review pile.
 */
export function resolveFromReviewPile(questionId: string): void {
  if (!isClient() || !questionId) return;
  try {
    const pile = getReviewPile();
    if (pile[questionId]) {
      delete pile[questionId];
      localStorage.setItem(REVIEW_PILE_KEY, JSON.stringify(pile));
      notifyReviewPileChanged();
    }
  } catch (err) {
    console.warn('Failed to resolve question from review pile:', err);
  }
}

/**
 * Clears the entire review pile.
 */
export function clearReviewPile(): void {
  if (!isClient()) return;
  try {
    localStorage.removeItem(REVIEW_PILE_KEY);
    notifyReviewPileChanged();
  } catch (err) {
    console.warn('Failed to clear review pile:', err);
  }
}

/* ==========================================================================
   First-Attempt Mastery History Tracking
   ========================================================================== */

export function getFirstTryCorrectIds(): string[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(FIRST_TRY_CORRECT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse first-try correct list:', err);
  }
  return [];
}

/**
 * Records a unique question ID answered correctly on the 1st attempt.
 */
export function recordFirstTryCorrect(questionId: string): void {
  if (!isClient() || !questionId) return;
  try {
    const ids = new Set(getFirstTryCorrectIds());
    if (!ids.has(questionId)) {
      ids.add(questionId);
      localStorage.setItem(FIRST_TRY_CORRECT_KEY, JSON.stringify(Array.from(ids)));
      window.dispatchEvent(new CustomEvent('revizz_mastery_updated'));
    }
  } catch (err) {
    console.warn('Failed to record first-try correct question:', err);
  }
}

export function isFirstTryCorrect(questionId: string): boolean {
  const ids = new Set(getFirstTryCorrectIds());
  return ids.has(questionId);
}

export function subscribeMasteryChanges(listener: () => void): () => void {
  if (!isClient()) return () => {};

  const handler = () => listener();
  window.addEventListener('revizz_review_pile_changed', handler);
  window.addEventListener('revizz_mastery_updated', handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener('revizz_review_pile_changed', handler);
    window.removeEventListener('revizz_mastery_updated', handler);
    window.removeEventListener('storage', handler);
  };
}

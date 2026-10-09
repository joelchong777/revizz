/**
 * Revizz Scoring & Streak Multiplier Engine
 * 
 * Rules:
 * - Base question value: 10 XP
 * - 1st try correct at 0 streak: 10 XP (1.0x)
 * - 1st try correct at 3 streak: 12 XP (1.2x)
 * - 1st try correct at 5 streak: 15 XP (1.5x)
 * - 1st try wrong: 0 XP, streak reset to 0, queued to review pile
 * - 2nd try retry correct: 5 XP (50% XP), kept in review pile
 * - 2nd try wrong / Timeout: 0 XP, streak reset to 0, queued to review pile
 */

export const BASE_QUESTION_XP = 10;
export const RETRY_CORRECT_XP = 5;
export const WRONG_XP = 0;
export const TIMEOUT_XP = 0;

export type AttemptOutcome =
  | 'first-correct'
  | 'first-wrong'
  | 'retry-correct'
  | 'wrong'
  | 'timeout';

export interface ScoreCalculation {
  xpAwarded: number;
  newStreak: number;
  multiplier: number;
  shouldAddToReview: boolean;
}

/**
 * Returns streak multiplier based on streak count:
 * - streak >= 5 -> 1.5x
 * - streak >= 3 -> 1.2x
 * - otherwise  -> 1.0x
 */
export function getStreakMultiplier(streak: number): number {
  if (streak >= 5) return 1.5;
  if (streak >= 3) return 1.2;
  return 1.0;
}

/**
 * Calculates score, multiplier, streak updates, and review pile queuing for an attempt.
 */
export function calculateAttemptScore(
  outcome: AttemptOutcome,
  currentStreak: number = 0
): ScoreCalculation {
  switch (outcome) {
    case 'first-correct': {
      const newStreak = currentStreak + 1;
      const multiplier = getStreakMultiplier(newStreak);
      const xpAwarded = Math.floor(BASE_QUESTION_XP * multiplier);
      return {
        xpAwarded,
        newStreak,
        multiplier,
        shouldAddToReview: false,
      };
    }
    case 'first-wrong': {
      return {
        xpAwarded: WRONG_XP,
        newStreak: 0,
        multiplier: 0,
        shouldAddToReview: true,
      };
    }
    case 'retry-correct': {
      return {
        xpAwarded: RETRY_CORRECT_XP,
        newStreak: 0,
        multiplier: 0.5,
        shouldAddToReview: true,
      };
    }
    case 'wrong': {
      return {
        xpAwarded: WRONG_XP,
        newStreak: 0,
        multiplier: 0,
        shouldAddToReview: true,
      };
    }
    case 'timeout': {
      return {
        xpAwarded: TIMEOUT_XP,
        newStreak: 0,
        multiplier: 0,
        shouldAddToReview: true,
      };
    }
  }
}

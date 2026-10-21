// server-only: pure scoring decisions for /api/quiz/answer. No I/O.
import type { QuizAnswerRequest } from '@/types/quiz';
import type { AttemptOutcome } from '@/lib/scoring';

export interface AnswerHistoryEvent {
  attempt_no: number;
  outcome: string;
  is_final: boolean;
  created_at: string;
  xp_awarded?: number;
  option_label?: string | null;
}

export type AttemptDecision =
  | { attempt: 1 | 2; outcome: AttemptOutcome; final: boolean; correct: boolean | null }
  | { error: string };

export const OPEN_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h: a short window would let a student eliminate one wrong option per window and still score first-correct
export const XP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** The newest event is an open first-wrong (< 24h old) => the next event is attempt 2. */
export function openFirstWrong(history: AnswerHistoryEvent[], now: Date): AnswerHistoryEvent | null {
  const latest = history[0];
  if (!latest || latest.is_final || latest.attempt_no !== 1 || latest.outcome !== 'first-wrong') return null;
  const age = now.getTime() - new Date(latest.created_at).getTime();
  return age < OPEN_WINDOW_MS ? latest : null;
}

export function decideAttempt(
  history: AnswerHistoryEvent[],
  req: QuizAnswerRequest,
  now: Date,
  isCorrect: boolean = false
): AttemptDecision {
  const open = openFirstWrong(history, now);
  const attempt: 1 | 2 = open ? 2 : 1;

  if (req.event === 'timeout') {
    return { attempt, outcome: 'timeout', final: true, correct: null };
  }
  if (req.event === 'give-up') {
    if (!open) return { error: 'Nothing to give up on' };
    return { attempt: 2, outcome: 'wrong', final: true, correct: null };
  }
  if (req.event !== 'answer') return { error: 'Unknown event' };
  if (!req.optionLabel) return { error: 'optionLabel required' };

  if (attempt === 1) {
    return isCorrect
      ? { attempt: 1, outcome: 'first-correct', final: true, correct: true }
      : { attempt: 1, outcome: 'first-wrong', final: false, correct: false };
  }
  if (open && !isCorrect && open.option_label && open.option_label === req.optionLabel) {
    return { error: 'That option was already tried' };
  }
  return isCorrect
    ? { attempt: 2, outcome: 'retry-correct', final: true, correct: true }
    : { attempt: 2, outcome: 'wrong', final: true, correct: false };
}

export function xpCooldownActive(
  history: Pick<AnswerHistoryEvent, 'xp_awarded' | 'created_at'>[],
  now: Date
): boolean {
  return history.some(
    (e) => (e.xp_awarded ?? 0) > 0 && now.getTime() - new Date(e.created_at).getTime() < XP_COOLDOWN_MS
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { getCaller, getServiceClient, serverErrorResponse } from '@/lib/apiAuth';
import { calculateAttemptScore } from '@/lib/scoring';
import { getAnswerKeys, isUuid, labelForOption, normalizeLabel } from '@/lib/server/answerKeys';
import {
  AnswerHistoryEvent,
  decideAttempt,
  openFirstWrong,
  xpCooldownActive,
} from '@/lib/server/answerScoring';
import type { QuizAnswerRequest, QuizAnswerResponse, QuizScoring } from '@/types/quiz';

export const dynamic = 'force-dynamic';

let warnedMissingTable = false;
function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  return !!err && (err.code === '42P01' || err.code === 'PGRST205' || /answer_events/.test(err.message ?? '') && /not find|does not exist/i.test(err.message ?? ''));
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ success: false, error: msg }, { status });
}

export async function POST(req: NextRequest) {
  try {
    let raw: any;
    try {
      raw = await req.json();
    } catch {
      return bad('Invalid JSON');
    }
    const questionId = raw?.questionId;
    const event = raw?.event;
    if (typeof questionId !== 'string' || !questionId || questionId.length > 100) return bad('questionId required');
    if (event !== 'answer' && event !== 'timeout' && event !== 'give-up') return bad('Invalid event');
    if (raw?.attempt !== 1 && raw?.attempt !== 2) return bad('attempt must be 1 or 2');
    let optionLabel = undefined as QuizAnswerRequest['optionLabel'];
    if (event === 'answer') {
      const l = typeof raw?.optionLabel === 'string' && raw.optionLabel === raw.optionLabel.toUpperCase() ? normalizeLabel(raw.optionLabel) : null;
      if (!l) return bad('optionLabel must be A-D');
      optionLabel = l;
    }
    const t = Number(raw?.timeSpentMs);
    const timeSpentMs = Number.isFinite(t) ? Math.min(3_600_000, Math.max(0, Math.round(t))) : 0;
    const body: QuizAnswerRequest = { questionId, event, attempt: raw.attempt, optionLabel, timeSpentMs };

    const keys = await getAnswerKeys([questionId]);
    const key = keys.get(questionId);
    if (!key) return bad('Question not found', 404);
    const isCorrect = event === 'answer' ? labelForOption(key, optionLabel) : false;
    const now = new Date();

    const caller = await getCaller(req);
    const signedIn = !!caller && isUuid(caller.id);

    // Guest-style: attempt comes from the body, nothing is written.
    const bodyHistory = (): AnswerHistoryEvent[] =>
      body.attempt === 2
        ? [{ attempt_no: 1, outcome: 'first-wrong', is_final: false, created_at: now.toISOString() }]
        : [];

    let history: AnswerHistoryEvent[] = [];
    let eventsAvailable = false;
    const db = signedIn ? getServiceClient() : null;
    if (signedIn && db) {
      const { data, error } = await db
        .from('answer_events')
        .select('attempt_no, outcome, is_final, created_at, xp_awarded, option_label')
        .eq('user_id', caller!.id)
        .eq('question_id', questionId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) {
        if (isMissingTable(error)) {
          if (!warnedMissingTable) {
            warnedMissingTable = true;
            console.warn('[quiz/answer] answer_events is missing; trusting the body attempt until the migration is applied.');
          }
          history = bodyHistory();
        } else {
          throw new Error(error.message);
        }
      } else {
        eventsAvailable = true;
        history = (data ?? []) as AnswerHistoryEvent[];
      }
    } else {
      history = bodyHistory();
    }

    const decision = decideAttempt(history, body, now, isCorrect);
    if ('error' in decision) return bad(decision.error, 409);

    let scoring: QuizScoring | null = null;
    if (signedIn && db) {
      let cooldown = false;
      if (eventsAvailable) {
        const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
        const { data: paid } = await db
          .from('answer_events')
          .select('xp_awarded, created_at')
          .eq('user_id', caller!.id)
          .eq('question_id', questionId)
          .gt('xp_awarded', 0)
          .gte('created_at', since)
          .limit(1);
        cooldown = xpCooldownActive((paid ?? []) as any[], now);
      }

      const { data: profile, error: pErr } = await db
        .from('profiles')
        .select('total_xp, current_streak')
        .eq('id', caller!.id)
        .maybeSingle();
      if (pErr) throw new Error(pErr.message);
      const curXp = Number(profile?.total_xp) || 0;
      const curStreak = Number(profile?.current_streak) || 0;

      let xp = 0;
      let streak = curStreak;
      let totalXp = curXp;
      if (!cooldown) {
        const calc = calculateAttemptScore(decision.outcome, curStreak);
        xp = calc.xpAwarded;
        streak = calc.newStreak;
        totalXp = curXp + xp;
        if (profile && (xp > 0 || streak !== curStreak)) {
          const { error: uErr } = await db
            .from('profiles')
            .update({ total_xp: totalXp, current_streak: streak })
            .eq('id', caller!.id);
          if (uErr) throw new Error(uErr.message);
        }
      }
      scoring = { xpAwarded: xp, streak, totalXp, counted: !cooldown };

      if (eventsAvailable) {
        const { error: eErr } = await db.from('answer_events').insert({
          user_id: caller!.id,
          question_id: questionId,
          attempt_no: decision.attempt,
          option_label: optionLabel ?? null,
          outcome: decision.outcome,
          is_final: decision.final,
          xp_awarded: xp,
        });
        if (eErr) throw new Error(eErr.message);
      }

      if (isUuid(questionId)) {
        if (decision.final) {
          const { error: aErr } = await db.from('user_attempts').insert({
            user_id: caller!.id,
            question_id: questionId,
            first_attempt_correct: decision.outcome === 'first-correct',
            retry_correct: decision.outcome === 'retry-correct',
            xp_awarded: xp,
            time_spent_ms: timeSpentMs,
          });
          if (aErr) console.error('[quiz/answer] user_attempts insert failed:', aErr.message);
        }
        const opensMistake =
          decision.outcome === 'first-wrong' ||
          (decision.outcome === 'timeout' && !openFirstWrong(history, now));
        if (opensMistake) {
          const { data: existing } = await db
            .from('review_pile')
            .select('mistakes_count')
            .eq('user_id', caller!.id)
            .eq('question_id', questionId)
            .maybeSingle();
          const { error: rErr } = await db.from('review_pile').upsert(
            {
              user_id: caller!.id,
              question_id: questionId,
              mistakes_count: (Number(existing?.mistakes_count) || 0) + 1,
              resolved_at: null,
            },
            { onConflict: 'user_id,question_id' }
          );
          if (rErr) console.error('[quiz/answer] review_pile upsert failed:', rErr.message);
        }
      }
    }

    const res: QuizAnswerResponse = {
      success: true,
      correct: decision.correct,
      attempt: decision.attempt,
      final: decision.final,
      reveal: decision.final ? key : null,
      scoring,
    };
    return NextResponse.json(res);
  } catch (err) {
    return serverErrorResponse(err);
  }
}

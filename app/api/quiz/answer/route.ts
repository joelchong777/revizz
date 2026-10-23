import { NextRequest, NextResponse, after } from 'next/server';
import { getCallerUserId, getServiceClient, serverErrorResponse } from '@/lib/apiAuth';
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

    // Phase A: answer key and caller identity are independent, so fetch them together.
    const [keys, callerId] = await Promise.all([getAnswerKeys([questionId]), getCallerUserId(req)]);
    const key = keys.get(questionId);
    if (!key) return bad('Question not found', 404);
    const isCorrect = event === 'answer' ? labelForOption(key, optionLabel) : false;
    const now = new Date();

    const signedIn = !!callerId && isUuid(callerId);
    const userId = callerId as string;

    // Guest-style: attempt comes from the body, nothing is written.
    const bodyHistory = (): AnswerHistoryEvent[] =>
      body.attempt === 2
        ? [{ attempt_no: 1, outcome: 'first-wrong', is_final: false, created_at: now.toISOString() }]
        : [];

    let history: AnswerHistoryEvent[] = [];
    let eventsAvailable = false;
    let cooldown = false;
    let profile: { total_xp?: unknown; current_streak?: unknown } | null = null;
    const db = signedIn ? getServiceClient() : null;
    if (signedIn && db) {
      // Phase B: history, XP cooldown and profile reads are independent, so run them together.
      const since = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
      const [histRes, paidRes, profRes] = await Promise.all([
        db
          .from('answer_events')
          .select('attempt_no, outcome, is_final, created_at, xp_awarded, option_label')
          .eq('user_id', userId)
          .eq('question_id', questionId)
          .order('created_at', { ascending: false })
          .limit(10),
        db
          .from('answer_events')
          .select('xp_awarded, created_at')
          .eq('user_id', userId)
          .eq('question_id', questionId)
          .gt('xp_awarded', 0)
          .gte('created_at', since)
          .limit(1),
        db.from('profiles').select('total_xp, current_streak').eq('id', userId).maybeSingle(),
      ]);
      const { data, error } = histRes;
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
        cooldown = xpCooldownActive((paidRes.data ?? []) as any[], now);
      }
      if (profRes.error) throw new Error(profRes.error.message);
      profile = profRes.data;
    } else {
      history = bodyHistory();
    }

    const decision = decideAttempt(history, body, now, isCorrect);
    if ('error' in decision) return bad(decision.error, 409);

    // Analytics (aggregate, anonymous). Never affects grading: errors are logged and swallowed.
    const sessionId = typeof raw?.sessionId === 'string' && isUuid(raw.sessionId) ? raw.sessionId : null;
    const deviceId = typeof raw?.deviceId === 'string' && isUuid(raw.deviceId) ? raw.deviceId : null;
    const analyticsWrite: Promise<void> = !(sessionId && (deviceId || signedIn))
      ? Promise.resolve()
      : (async () => {
      try {
        const { error: aErr } = await getServiceClient().rpc('analytics_record_answer', {
          p_session_id: sessionId,
          p_user_id: signedIn ? userId : null,
          p_device_id: deviceId,
          p_question_id: questionId,
          p_attempt: decision.attempt,
          p_option: optionLabel ?? null,
          p_outcome: decision.outcome,
          p_is_final: decision.final,
          p_time_ms: timeSpentMs,
        });
        if (aErr) console.warn('[quiz/answer] analytics skipped:', aErr.message);
      } catch (e) {
        console.warn('[quiz/answer] analytics skipped:', (e as Error)?.message);
      }
    })();

    let scoring: QuizScoring | null = null;
    if (signedIn && db) {
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
      }
      scoring = { xpAwarded: xp, streak, totalXp, counted: !cooldown };

      // Phase C: independent writes run in parallel.
      const writes: Promise<void>[] = [];
      if (!cooldown && profile && (xp > 0 || streak !== curStreak)) {
        writes.push(
          (async () => {
            const { error: uErr } = await db
              .from('profiles')
              .update({ total_xp: totalXp, current_streak: streak })
              .eq('id', userId);
            if (uErr) throw new Error(uErr.message);
          })()
        );
      }
      if (eventsAvailable) {
        writes.push(
          (async () => {
            const { error: eErr } = await db.from('answer_events').insert({
              user_id: userId,
              question_id: questionId,
              attempt_no: decision.attempt,
              option_label: optionLabel ?? null,
              outcome: decision.outcome,
              is_final: decision.final,
              xp_awarded: xp,
            });
            if (eErr) throw new Error(eErr.message);
          })()
        );
      }
      if (isUuid(questionId)) {
        if (decision.final) {
          writes.push(
            (async () => {
              const { error: aErr } = await db.from('user_attempts').insert({
                user_id: userId,
                question_id: questionId,
                first_attempt_correct: decision.outcome === 'first-correct',
                retry_correct: decision.outcome === 'retry-correct',
                xp_awarded: xp,
                time_spent_ms: timeSpentMs,
              });
              if (aErr) console.error('[quiz/answer] user_attempts insert failed:', aErr.message);
            })()
          );
        }
        const opensMistake =
          decision.outcome === 'first-wrong' ||
          (decision.outcome === 'timeout' && !openFirstWrong(history, now));
        if (opensMistake) {
          writes.push(
            (async () => {
              const { data: existing } = await db
                .from('review_pile')
                .select('mistakes_count')
                .eq('user_id', userId)
                .eq('question_id', questionId)
                .maybeSingle();
              const { error: rErr } = await db.from('review_pile').upsert(
                {
                  user_id: userId,
                  question_id: questionId,
                  mistakes_count: (Number(existing?.mistakes_count) || 0) + 1,
                  resolved_at: null,
                },
                { onConflict: 'user_id,question_id' }
              );
              if (rErr) console.error('[quiz/answer] review_pile upsert failed:', rErr.message);
            })()
          );
        }
      }
      await Promise.all(writes);
    }

    // Finish the analytics write after the response so it never adds answer latency.
    after(analyticsWrite);

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

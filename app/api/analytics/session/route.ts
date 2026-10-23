import { NextRequest, NextResponse } from 'next/server';
import { getCallerUserId, getServiceClient } from '@/lib/apiAuth';
import { parseSessionRequest } from '@/lib/server/analyticsSession';
import { isUuid } from '@/lib/server/answerKeys';

export const dynamic = 'force-dynamic';

const fail = (error: string, status: number) => NextResponse.json({ success: false, error }, { status });

/** POST /api/analytics/session  start/end a quiz session. Bearer optional; guests are a random device id. */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = parseSessionRequest(raw);
    if (!parsed.ok) return fail(parsed.error, 400);
    const body = parsed.value;

    const callerId = await getCallerUserId(req);
    const userId = callerId && isUuid(callerId) ? callerId : null;
    const db = getServiceClient();

    if (body.action === 'start') {
      const since = new Date(Date.now() - 3600 * 1000).toISOString();
      const { count, error: cErr } = await db
        .from('analytics_quiz_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('device_id', body.deviceId)
        .gte('started_at', since);
      if (cErr) throw new Error(cErr.message);
      if ((count ?? 0) > 120) return fail('Too many sessions', 429);
      const { error } = await db.from('analytics_quiz_sessions').upsert(
        {
          id: body.sessionId,
          user_id: userId,
          device_id: body.deviceId,
          mode: body.mode,
          subject: body.subject ?? null,
          source_ref: body.sourceRef ?? null,
          planned_length: body.plannedLength,
          is_timed: body.isTimed,
          device_type: body.deviceType,
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );
      if (error) throw new Error(error.message);
      return NextResponse.json({ success: true });
    }

    const now = new Date().toISOString();
    let q = db
      .from('analytics_quiz_sessions')
      .update({ completed_at: now, ended_early: body.endedEarly, last_activity_at: now })
      .eq('id', body.sessionId)
      .is('completed_at', null);
    q = userId ? q.eq('user_id', userId) : q.is('user_id', null).eq('device_id', body.deviceId);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[analytics/session]', (err as Error)?.message);
    return fail('Could not record session', 500);
  }
}

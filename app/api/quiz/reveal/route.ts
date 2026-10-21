import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, requireRole, serverErrorResponse } from '@/lib/apiAuth';
import { getAnswerKeys } from '@/lib/server/answerKeys';
import type { QuizRevealResponse } from '@/types/quiz';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['student', 'teacher', 'admin']);
    if (!auth.ok) return auth.response;
    const body = await req.json().catch(() => null);
    const ids: unknown = body?.questionIds;
    if (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string')) {
      return NextResponse.json({ success: false, error: 'questionIds must be a string array' }, { status: 400 });
    }
    const unique = Array.from(new Set(ids as string[]));
    if (unique.length > 200) {
      return NextResponse.json({ success: false, error: 'At most 200 ids' }, { status: 400 });
    }
    if (unique.length === 0) return NextResponse.json({ success: true, reveals: [] } as QuizRevealResponse);

    const db = getServiceClient();
    const finished = new Set<string>();
    const { data: ev, error: evErr } = await db
      .from('answer_events')
      .select('question_id')
      .eq('user_id', auth.caller.id)
      .eq('is_final', true)
      .in('question_id', unique);
    if (!evErr) for (const r of ev ?? []) finished.add(r.question_id);
    // evErr (e.g. table not migrated yet) is tolerated: user_attempts below still counts.
    const { data: at } = await db
      .from('user_attempts')
      .select('question_id')
      .eq('user_id', auth.caller.id)
      .in('question_id', unique);
    for (const r of at ?? []) finished.add(r.question_id);

    const keys = await getAnswerKeys(unique.filter((i) => finished.has(i)));
    return NextResponse.json({ success: true, reveals: Array.from(keys.values()) } as QuizRevealResponse);
  } catch (err) {
    return serverErrorResponse(err);
  }
}

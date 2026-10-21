import { NextRequest, NextResponse } from 'next/server';
import { requireRole, serverErrorResponse } from '@/lib/apiAuth';
import { getAnswerKeys } from '@/lib/server/answerKeys';
import type { AnswerKeysResponse } from '@/types/quiz';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole(req, ['teacher', 'admin']);
    if (!auth.ok) return auth.response;
    const body = await req.json().catch(() => null);
    const ids: unknown = body?.questionIds;
    if (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string')) {
      return NextResponse.json({ success: false, error: 'questionIds must be a string array' }, { status: 400 });
    }
    const unique = Array.from(new Set(ids as string[]));
    if (unique.length > 500) {
      return NextResponse.json({ success: false, error: 'At most 500 ids' }, { status: 400 });
    }
    const keys = await getAnswerKeys(unique);
    return NextResponse.json({ success: true, keys: Array.from(keys.values()) } as AnswerKeysResponse);
  } catch (err) {
    return serverErrorResponse(err);
  }
}

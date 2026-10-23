import { NextResponse } from 'next/server';
import { getCaller, getServiceClient, serverErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/account/delete: a signed-in student or teacher deletes their own account.
 * Admins are refused (another admin must do it). profiles, user_attempts, review_pile,
 * answer_events and analytics_quiz_sessions cascade from auth.users; roster_invites does not.
 */
export async function POST(req: Request) {
  try {
    const caller = await getCaller(req);
    if (!caller) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }
    if (caller.role === 'admin') {
      return NextResponse.json(
        { error: "Admin accounts can't be deleted from the app. Ask another admin." },
        { status: 403 }
      );
    }

    const db = getServiceClient();
    if (caller.email) {
      const { error: inviteError } = await db
        .from('roster_invites')
        .delete()
        .ilike('email', caller.email.replace(/[\\%_]/g, '\\$&'));
      if (inviteError) throw inviteError;
    }

    const { error: deleteError } = await db.auth.admin.deleteUser(caller.id);
    if (deleteError) throw deleteError;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return serverErrorResponse(err);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, requireRole } from '@/lib/apiAuth';
import { buildInviteLink, sendInviteEmail } from '@/lib/email';
import {
  BULK_CHUNK_SIZE,
  validateBulkRows,
  type BulkInviteResult,
  type BulkUserRow,
} from '@/lib/bulkInvites';

export const maxDuration = 60;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * POST /api/admin/users/bulk
 * Body: { rows: BulkUserRow[] } (1..BULK_CHUNK_SIZE). Creates pending roster_invites (drafts) and emails each.
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }
    const input: any[] = Array.isArray(body?.rows) ? body.rows : [];
    if (input.length < 1 || input.length > BULK_CHUNK_SIZE) {
      return NextResponse.json(
        { success: false, error: `Send between 1 and ${BULK_CHUNK_SIZE} rows per request` },
        { status: 400 }
      );
    }

    // Re-validate server-side by round-tripping through the same CSV validator.
    const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const results: (BulkInviteResult | null)[] = input.map(() => null);
    const valid: { idx: number; row: BulkUserRow }[] = [];
    input.forEach((raw, idx) => {
      const line = Number(raw?.line) || idx + 2;
      const csv = `email,full_name,role,cohort\r\n${q(raw?.email)},${q(raw?.fullName)},${q(raw?.role)},${q(raw?.cohort)}`;
      const { rows, errors } = validateBulkRows(csv);
      if (rows.length === 1) {
        valid.push({ idx, row: { ...rows[0], line } });
      } else {
        results[idx] = {
          line,
          email: String(raw?.email ?? '').trim().toLowerCase(),
          status: 'failed',
          reason: errors[0]?.message || 'Invalid row',
          emailSent: false,
        };
      }
    });

    // Duplicate emails within this request
    const seenInChunk = new Set<string>();
    const unique: { idx: number; row: BulkUserRow }[] = [];
    for (const v of valid) {
      if (seenInChunk.has(v.row.email)) {
        results[v.idx] = { line: v.row.line, email: v.row.email, status: 'skipped', reason: 'Duplicate in this upload', emailSent: false };
      } else {
        seenInChunk.add(v.row.email);
        unique.push(v);
      }
    }

    const supabase = getServiceClient();
    const emails = unique.map((v) => v.row.email);
    const toInvite: { idx: number; row: BulkUserRow; id: string }[] = [];

    if (emails.length > 0) {
      const [profilesRes, invitesRes] = await Promise.all([
        supabase.from('profiles').select('email').in('email', emails),
        supabase.from('roster_invites').select('email').eq('status', 'pending').in('email', emails),
      ]);
      if (profilesRes.error || invitesRes.error) {
        const msg = profilesRes.error?.message || invitesRes.error?.message || 'Lookup failed';
        return NextResponse.json({ success: false, error: msg }, { status: 500 });
      }
      const hasAccount = new Set((profilesRes.data || []).map((p: any) => String(p.email || '').toLowerCase()));
      const hasDraft = new Set((invitesRes.data || []).map((p: any) => String(p.email || '').toLowerCase()));
      for (const v of unique) {
        if (hasAccount.has(v.row.email)) {
          results[v.idx] = { line: v.row.line, email: v.row.email, status: 'skipped', reason: 'Already has an account', emailSent: false };
        } else if (hasDraft.has(v.row.email)) {
          results[v.idx] = { line: v.row.line, email: v.row.email, status: 'skipped', reason: 'Already invited (draft exists)', emailSent: false };
        } else {
          toInvite.push({ ...v, id: crypto.randomUUID() });
        }
      }
    }

    if (toInvite.length > 0) {
      const now = new Date().toISOString();
      const { error } = await supabase.from('roster_invites').insert(
        toInvite.map((t) => ({
          id: t.id,
          email: t.row.email,
          display_name: t.row.fullName || null,
          role: t.row.role,
          cohort: t.row.cohort,
          invited_by: 'Bulk upload',
          status: 'pending',
          created_at: now,
        }))
      );
      if (error) {
        console.error('Bulk insert into roster_invites failed:', error);
        for (const t of toInvite) {
          results[t.idx] = { line: t.row.line, email: t.row.email, status: 'failed', reason: error.message, emailSent: false };
        }
      } else {
        let origin = req.headers.get('origin');
        if (!origin) {
          const referer = req.headers.get('referer');
          if (referer) {
            try {
              origin = new URL(referer).origin;
            } catch {
              origin = referer;
            }
          }
        }
        if (!origin) origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        for (let n = 0; n < toInvite.length; n++) {
          const t = toInvite[n];
          if (n > 0) await sleep(300);
          const inviteLink = buildInviteLink({ origin, inviteId: t.id, email: t.row.email });
          let emailSent = false;
          let reason: string | undefined;
          try {
            const delivery: any = await sendInviteEmail({
              email: t.row.email,
              name: t.row.fullName,
              role: t.row.role,
              cohort: t.row.cohort,
              inviteLink,
            });
            emailSent = Boolean(delivery?.sent);
            if (!emailSent) reason = delivery?.error || delivery?.reason || 'Email was not delivered';
          } catch (err: any) {
            reason = err?.message || 'Email was not delivered';
          }
          results[t.idx] = { line: t.row.line, email: t.row.email, status: 'invited', reason, emailSent, inviteLink };
        }
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error('Error in POST /api/admin/users/bulk:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}

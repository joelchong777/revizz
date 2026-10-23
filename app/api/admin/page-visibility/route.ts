import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, requireRole, serverErrorResponse } from '@/lib/apiAuth';
import { isKnownPageId } from '@/lib/pageVisibilityCore';

export const dynamic = 'force-dynamic';

async function readHidden(supabase: ReturnType<typeof getServiceClient>): Promise<string[]> {
  const { data, error } = await supabase.from('page_visibility').select('page_id').eq('enabled', false);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { page_id: string }) => r.page_id);
}

/** PUT /api/admin/page-visibility  body { pageId, enabled } */
export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json().catch(() => null);
    if (!body || !isKnownPageId(body.pageId)) {
      return NextResponse.json({ success: false, error: 'Unknown page' }, { status: 400 });
    }
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'enabled must be true or false' }, { status: 400 });
    }
    const supabase = getServiceClient();
    const { error } = await supabase.from('page_visibility').upsert(
      {
        page_id: body.pageId,
        enabled: body.enabled,
        updated_at: new Date().toISOString(),
        updated_by: auth.caller.id,
      },
      { onConflict: 'page_id' }
    );
    if (error) throw new Error(error.message);
    return NextResponse.json({ hidden: await readHidden(supabase) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return serverErrorResponse(err);
  }
}

/** POST /api/admin/page-visibility  body { reset: true } re-enables every page. */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json().catch(() => null);
    if (!body || body.reset !== true) {
      return NextResponse.json({ success: false, error: 'Send { "reset": true } to re-enable all pages' }, { status: 400 });
    }
    const supabase = getServiceClient();
    const { error } = await supabase.from('page_visibility').delete().neq('page_id', '');
    if (error) throw new Error(error.message);
    return NextResponse.json({ hidden: await readHidden(supabase) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return serverErrorResponse(err);
  }
}

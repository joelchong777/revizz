import { NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** GET /api/page-visibility: ids of pages an admin has hidden. Fails open with an empty list. */
export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.from('page_visibility').select('page_id').eq('enabled', false);
    if (error) {
      console.warn('GET /api/page-visibility:', error.message);
      return NextResponse.json({ hidden: [] }, { headers: NO_STORE });
    }
    return NextResponse.json({ hidden: (data ?? []).map((r: { page_id: string }) => r.page_id) }, { headers: NO_STORE });
  } catch (err) {
    console.warn('GET /api/page-visibility:', (err as Error)?.message);
    return NextResponse.json({ hidden: [] }, { headers: NO_STORE });
  }
}

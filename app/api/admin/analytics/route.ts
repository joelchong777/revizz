import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, requireRole, serverErrorResponse } from '@/lib/apiAuth';
import { parseAnalyticsRange, rangeStart } from '@/lib/server/analyticsSession';
import type { AppAnalyticsResponse, AppAnalyticsSummary } from '@/types/analytics';

export const dynamic = 'force-dynamic';

/** GET /api/admin/analytics?range=7d|30d|90d|all  (admin only) */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const range = parseAnalyticsRange(new URL(req.url).searchParams.get('range'));
    const from = rangeStart(range, new Date());
    const { data, error } = await getServiceClient().rpc('admin_analytics_summary', { p_from: from ? from.toISOString() : null });
    if (error) {
      if (error.code === 'PGRST202' || error.code === '42883' || /admin_analytics_summary/.test(error.message ?? '')) {
        return NextResponse.json(
          { success: false, code: 'NOT_MIGRATED', error: 'Analytics tables are not set up yet.' } satisfies AppAnalyticsResponse,
          { status: 503, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      throw new Error(error.message);
    }
    const summary: AppAnalyticsSummary = {
      ...(data as Omit<AppAnalyticsSummary, 'generatedAt' | 'range' | 'rangeStart' | 'timezone'>),
      generatedAt: new Date().toISOString(),
      range,
      rangeStart: from ? from.toISOString() : null,
      timezone: 'Asia/Singapore',
    };
    return NextResponse.json({ success: true, summary } satisfies AppAnalyticsResponse, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return serverErrorResponse(err);
  }
}

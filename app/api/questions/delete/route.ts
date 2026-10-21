import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, requireRole } from '@/lib/apiAuth';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { questionIds } = body || {};

    if (!Array.isArray(questionIds)) {
      return NextResponse.json(
        { success: false, error: 'questionIds must be an array of question IDs' },
        { status: 400 }
      );
    }

    if (questionIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'questionIds array cannot be empty' },
        { status: 400 }
      );
    }

    if (questionIds.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Maximum batch size of 500 exceeded' },
        { status: 400 }
      );
    }

    const validIds = Array.from(
      new Set(
        questionIds
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .map((id) => id.trim())
      )
    );

    if (validIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid question IDs provided' },
        { status: 400 }
      );
    }

    const uuidIds = validIds.filter((id) => UUID_REGEX.test(id));
    let deletedIds = validIds;

    if (uuidIds.length > 0) {
      const supabase = getServiceClient();
      const { data, error } = await supabase
        .from('questions')
        .delete()
        .in('id', uuidIds)
        .select('id');

      if (error) {
        console.error('Supabase deletion error:', error.message);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }

      const deletedUuids = Array.isArray(data) && data.length > 0 ? data.map((d: any) => d.id) : uuidIds;
      const nonUuidIds = validIds.filter((id) => !UUID_REGEX.test(id));
      deletedIds = Array.from(new Set([...deletedUuids, ...nonUuidIds]));
    }

    const count = deletedIds.length;

    return NextResponse.json(
      {
        success: true,
        count,
        deletedIds,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Unexpected error in questions delete route:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

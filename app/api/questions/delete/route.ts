import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Polyfill WebSocket in Node runtime if absent
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmvahcaxixvhgxidmkqs.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdmFoY2F4aXh2aGd4aWRta3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTc4NzQsImV4cCI6MjEwNzAzMzg3NH0.qeqa5hQ84xnIOljKmu7SUhcko53qM1gO_dCmYvjnf-4';

  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(req: NextRequest) {
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
      const supabase = getSupabaseClient();
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

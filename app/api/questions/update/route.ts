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

    const { questionIds, updates } = body || {};

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

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'updates object is required' },
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

    const supabase = getSupabaseClient();

    // Resolve topic name to topic_id if provided
    let targetTopicId = updates.topicId;
    if (!targetTopicId && updates.topicName && typeof updates.topicName === 'string') {
      const { data: topicData, error: topicErr } = await supabase
        .from('topics')
        .select('id')
        .ilike('name', updates.topicName.trim())
        .maybeSingle();

      if (!topicErr && topicData?.id) {
        targetTopicId = topicData.id;
      }
    }

    const uuidIds = validIds.filter((id) => UUID_REGEX.test(id));

    if (uuidIds.length > 0) {
      // Fetch existing diagram_metadata to preserve existing crops and image URLs
      const { data: existingRows, error: fetchErr } = await supabase
        .from('questions')
        .select('id, diagram_metadata')
        .in('id', uuidIds);

      if (fetchErr) {
        console.error('Failed to fetch existing questions for update:', fetchErr.message);
        return NextResponse.json(
          { success: false, error: fetchErr.message },
          { status: 500 }
        );
      }

      const activeVal =
        updates.status !== undefined ? updates.status === 'Live' : undefined;

      // Update in parallel chunks
      const updatePromises = (existingRows || []).map((row) => {
        const currentMeta =
          row.diagram_metadata && typeof row.diagram_metadata === 'object'
            ? { ...row.diagram_metadata }
            : {};

        if (updates.status) {
          currentMeta.bank_status = updates.status;
        }
        if (updates.difficulty) {
          currentMeta.difficulty = updates.difficulty;
        }

        const patch: Record<string, any> = {
          diagram_metadata: currentMeta,
        };

        if (activeVal !== undefined) {
          patch.active = activeVal;
        }
        if (targetTopicId !== undefined) {
          patch.topic_id = targetTopicId;
        }

        return supabase.from('questions').update(patch).eq('id', row.id);
      });

      const results = await Promise.all(updatePromises);
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        console.error('Error updating question row in Supabase:', failed.error.message);
        return NextResponse.json(
          { success: false, error: failed.error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        success: true,
        updatedCount: validIds.length,
        resolvedTopicId: targetTopicId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('Unexpected error in questions update route:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

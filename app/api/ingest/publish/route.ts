import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StagingPaper, validateStagingPaper } from '@/types/ingestion';

// Polyfill WebSocket in Node runtime if absent
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmvahcaxixvhgxidmkqs.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdmFoY2F4aXh2aGd4aWRta3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTc4NzQsImV4cCI6MjEwNzAzMzg3NH0.qeqa5hQ84xnIOljKmu7SUhcko53qM1gO_dCmYvjnf-4';

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * POST /api/ingest/publish
 * 
 * Body: { paper: StagingPaper }
 * 
 * Validates the paper, performs relational idempotent upserts into Supabase:
 * 1. public.subjects
 * 2. public.topics
 * 3. public.papers (on conflict: subject_id, series, paper_code, year)
 * 4. public.questions (on conflict: paper_id, question_number)
 * 5. public.question_options (on conflict: question_id, label)
 * 
 * Returns: { success: true, paper_id, questions_count, options_count }
 */
export async function POST(request: NextRequest) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch (parseErr: any) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body.' },
        { status: 400 }
      );
    }

    const rawPaper = body?.paper ?? body;
    if (!rawPaper) {
      return NextResponse.json(
        { success: false, error: 'Missing required "paper" object in request body.' },
        { status: 400 }
      );
    }

    // Validate staging paper using the canonical validator
    const validation = validateStagingPaper(rawPaper, { allowPartialBatch: true });
    if (!validation.success || !validation.data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Paper failed schema or structural validation.',
          details: validation.errors,
        },
        { status: 422 }
      );
    }

    const paper: StagingPaper = validation.data;
    const supabase = getSupabaseClient();

    // 1. Upsert Subject
    const { data: subjectData, error: subjectError } = await supabase
      .from('subjects')
      .upsert(
        {
          code: paper.subject.code,
          name: paper.subject.name,
          icon: paper.subject.icon || 'book-open',
        },
        { onConflict: 'code' }
      )
      .select('id')
      .single();

    if (subjectError || !subjectData) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to upsert subject (${paper.subject.code}): ${subjectError?.message}`,
        },
        { status: 500 }
      );
    }
    const subjectId = subjectData.id;

    // 2. Upsert Syllabus Topics & Ad-Hoc Question Topics
    const topicMap = new Map<string, string>();

    if (paper.syllabus_topics && paper.syllabus_topics.length > 0) {
      for (const t of paper.syllabus_topics) {
        const { data: topicData, error: topicError } = await supabase
          .from('topics')
          .upsert(
            {
              subject_id: subjectId,
              name: t.name,
              order_index: t.order_index,
            },
            { onConflict: 'subject_id,name' }
          )
          .select('id')
          .single();

        if (topicError || !topicData) {
          console.warn(`Warning: failed to upsert topic "${t.name}":`, topicError?.message);
        } else {
          topicMap.set(t.name, topicData.id);
        }
      }
    }

    // Ensure topics mentioned in questions exist in topics table
    for (const q of paper.questions) {
      if (q.topic_name && !topicMap.has(q.topic_name)) {
        const { data: topicData, error: topicError } = await supabase
          .from('topics')
          .upsert(
            {
              subject_id: subjectId,
              name: q.topic_name,
              order_index: topicMap.size + 1,
            },
            { onConflict: 'subject_id,name' }
          )
          .select('id')
          .single();

        if (topicError || !topicData) {
          console.warn(`Warning: failed to upsert ad-hoc topic "${q.topic_name}":`, topicError?.message);
        } else {
          topicMap.set(q.topic_name, topicData.id);
        }
      }
    }

    // 3. Upsert Paper
    const { data: paperData, error: paperError } = await supabase
      .from('papers')
      .upsert(
        {
          subject_id: subjectId,
          series: paper.paper.series,
          paper_code: paper.paper.paper_code,
          year: paper.paper.year,
        },
        { onConflict: 'subject_id,series,paper_code,year' }
      )
      .select('id')
      .single();

    if (paperError || !paperData) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to upsert paper (${paper.paper.paper_code}): ${paperError?.message}`,
        },
        { status: 500 }
      );
    }
    const paperId = paperData.id;

    // 4. Upsert Questions
    const questionsPayload = paper.questions.map((q) => ({
      subject_id: subjectId,
      paper_id: paperId,
      topic_id: topicMap.get(q.topic_name) || null,
      question_number: q.question_number,
      stem_markdown: q.stem_markdown,
      image_url: q.diagram?.image_url || null,
      explanation_markdown: q.explanation_markdown,
      cambridge_source_ref: q.cambridge_source_ref,
      active: q.status !== 'withdrawn',
    }));

    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .upsert(questionsPayload, { onConflict: 'paper_id,question_number' })
      .select('id, question_number');

    if (questionsError || !questionsData) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to upsert questions: ${questionsError?.message}`,
        },
        { status: 500 }
      );
    }

    const questionIdMap = new Map<number, string>();
    for (const qRow of questionsData) {
      questionIdMap.set(qRow.question_number, qRow.id);
    }

    // 5. Upsert Options
    const optionsPayload: Array<{
      question_id: string;
      label: string;
      content_markdown: string;
      is_correct: boolean;
    }> = [];

    for (const q of paper.questions) {
      const qId = questionIdMap.get(q.question_number);
      if (!qId) {
        return NextResponse.json(
          {
            success: false,
            error: `Failed to correlate question ID for Q${q.question_number}.`,
          },
          { status: 500 }
        );
      }
      for (const opt of q.options) {
        optionsPayload.push({
          question_id: qId,
          label: opt.label,
          content_markdown: opt.content_markdown,
          is_correct: opt.is_correct,
        });
      }
    }

    const { error: optionsError } = await supabase
      .from('question_options')
      .upsert(optionsPayload, { onConflict: 'question_id,label' });

    if (optionsError) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to upsert question options: ${optionsError.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paper_id: paperId,
      questions_count: paper.questions.length,
      options_count: paper.questions.length * 4,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error while publishing paper.',
      },
      { status: 500 }
    );
  }
}

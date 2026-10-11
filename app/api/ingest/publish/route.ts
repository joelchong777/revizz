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
 * Extract distractor explanation for an option from question explanation markdown.
 * Matches sections such as:
 *   ### Distractor Analysis
 *   - **A (O and Q)**: Reasoning...
 *   - **B**: Reasoning...
 *   - **Option C**: Reasoning...
 */
function extractDistractorReasoning(
  explanationMarkdown: string | null | undefined,
  label: string
): string | null {
  if (!explanationMarkdown) return null;
  const regex = new RegExp(
    `(?:^|\\n)\\s*[-*]?\\s*\\*\\*(?:Option\\s+)?${label}(?:[^*]*?)\\*\\*[:\\s]+([^\\n]+(?:\\n(?!\\s*[-*]?\\s*\\*\\*(?:Option\\s+)?[A-D]).*)*)`,
    'i'
  );
  const match = explanationMarkdown.match(regex);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

export interface PublishReceipt {
  success: boolean;
  paper_id: string;
  subjects_count: number;
  topics_count: number;
  questions_count: number;
  options_count: number;
}

/**
 * POST /api/ingest/publish
 * 
 * Body: {
 *   paper: StagingPaper,
 *   selected_question_numbers?: number[],
 *   publish_options?: { selected_question_numbers?: number[] }
 * }
 * 
 * Validates the paper, performs relational idempotent upserts into Supabase:
 * 1. public.subjects (code, name, icon)
 * 2. public.topics (name, subject_id, order_index)
 * 3. public.papers (subject_id, series, paper_code, year)
 * 4. public.questions (paper_id, topic_id, question_number, stem_markdown, explanation_markdown, diagram metadata)
 * 5. public.question_options (question_id, label, content_markdown, is_correct, distractor_reasoning)
 * 
 * Returns detailed receipt:
 * { success: true, paper_id: string, subjects_count: number, topics_count: number, questions_count: number, options_count: number }
 */
export async function POST(request: NextRequest) {
  let stage = 'request_parsing';

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
    if (!rawPaper || typeof rawPaper !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Missing required "paper" object in request body.' },
        { status: 400 }
      );
    }

    stage = 'validation';
    // Validate staging paper using the canonical validator
    const validation = validateStagingPaper(rawPaper, { allowPartialBatch: true });
    if (!validation.success || !validation.data) {
      console.warn('[Ingest Publish] Paper failed validation:', validation.errors);
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

    // Support partial publish options if specified (e.g. publishing selected question numbers)
    const selectedQuestionNumbers: number[] | undefined =
      body?.selected_question_numbers ??
      body?.question_numbers ??
      body?.publish_options?.selected_question_numbers ??
      body?.options?.selected_question_numbers;

    let targetQuestions = paper.questions;
    if (Array.isArray(selectedQuestionNumbers) && selectedQuestionNumbers.length > 0) {
      const selectedSet = new Set(selectedQuestionNumbers);
      targetQuestions = paper.questions.filter((q) => selectedSet.has(q.question_number));
      if (targetQuestions.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `No questions found matching selected question numbers: [${selectedQuestionNumbers.join(', ')}].`,
          },
          { status: 400 }
        );
      }
      console.log(
        `[Ingest Publish] Partial publish enabled: filtered to ${targetQuestions.length} of ${paper.questions.length} questions.`
      );
    }

    console.log(
      `[Ingest Publish] Initiating publish for subject "${paper.subject.code}" (${paper.subject.name}), ` +
      `paper "${paper.paper.series} ${paper.paper.year} Paper ${paper.paper.paper_code}", with ${targetQuestions.length} questions.`
    );

    // 1. Upsert Subject
    stage = 'upsert_subject';
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
      console.error(`[Ingest Publish] Subject upsert failed (${paper.subject.code}):`, subjectError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to upsert subject (${paper.subject.code}): ${subjectError?.message || 'Database error'}`,
          stage,
        },
        { status: 500 }
      );
    }
    const subjectId = subjectData.id;
    console.log(`[Ingest Publish] [1/5] Subject upserted: ID="${subjectId}", Code="${paper.subject.code}"`);

    // 2. Upsert Topics (Syllabus & Question Topics)
    stage = 'upsert_topics';
    const topicMap = new Map<string, string>();
    const seenTopicNames = new Set<string>();
    const topicsToUpsert: Array<{ subject_id: string; name: string; order_index: number }> = [];

    if (paper.syllabus_topics && paper.syllabus_topics.length > 0) {
      for (const t of paper.syllabus_topics) {
        if (t.name && !seenTopicNames.has(t.name)) {
          seenTopicNames.add(t.name);
          topicsToUpsert.push({
            subject_id: subjectId,
            name: t.name,
            order_index: t.order_index ?? (topicsToUpsert.length + 1),
          });
        }
      }
    }

    for (const q of targetQuestions) {
      const qTopic = q.topic_name || 'General';
      if (!seenTopicNames.has(qTopic)) {
        seenTopicNames.add(qTopic);
        topicsToUpsert.push({
          subject_id: subjectId,
          name: qTopic,
          order_index: topicsToUpsert.length + 1,
        });
      }
    }

    if (topicsToUpsert.length > 0) {
      const { data: topicsData, error: topicsError } = await supabase
        .from('topics')
        .upsert(topicsToUpsert, { onConflict: 'subject_id,name' })
        .select('id, name');

      if (topicsError) {
        console.warn('[Ingest Publish] Batch topic upsert warning, falling back to sequential:', topicsError.message);
        for (const t of topicsToUpsert) {
          const { data: singleTopic, error: singleError } = await supabase
            .from('topics')
            .upsert(t, { onConflict: 'subject_id,name' })
            .select('id, name')
            .single();

          if (!singleError && singleTopic) {
            topicMap.set(singleTopic.name, singleTopic.id);
          } else {
            console.warn(`[Ingest Publish] Warning: failed to upsert topic "${t.name}":`, singleError?.message);
          }
        }
      } else if (topicsData) {
        for (const tRow of topicsData) {
          topicMap.set(tRow.name, tRow.id);
        }
      }
    }

    // Ensure all existing topics for this subject are populated in topicMap
    const { data: existingTopics } = await supabase
      .from('topics')
      .select('id, name')
      .eq('subject_id', subjectId);

    if (existingTopics) {
      for (const et of existingTopics) {
        topicMap.set(et.name, et.id);
      }
    }
    console.log(`[Ingest Publish] [2/5] Topics mapped: count=${topicMap.size}`);

    // 3. Upsert Paper
    stage = 'upsert_paper';
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
      console.error(`[Ingest Publish] Paper upsert failed:`, paperError);
      return NextResponse.json(
        {
          success: false,
          error: `Failed to upsert paper (${paper.paper.paper_code}): ${paperError?.message || 'Database error'}`,
          stage,
        },
        { status: 500 }
      );
    }
    const paperId = paperData.id;
    console.log(`[Ingest Publish] [3/5] Paper upserted: ID="${paperId}"`);

    // 4. Upsert Questions
    stage = 'upsert_questions';
    const questionsPayload = targetQuestions.map((q) => {
      const diagramMeta = q.diagram
        ? {
            has_diagram: Boolean(q.diagram.has_diagram),
            bounding_box: q.diagram.bounding_box || null,
            image_url: q.diagram.image_url || null,
            storage_path: q.diagram.storage_path || null,
            alt_description: q.diagram.alt_description || null,
          }
        : null;

      return {
        subject_id: subjectId,
        paper_id: paperId,
        topic_id: topicMap.get(q.topic_name || '') || null,
        question_number: q.question_number,
        stem_markdown: q.stem_markdown,
        image_url: q.diagram?.image_url || null,
        explanation_markdown: q.explanation_markdown || null,
        cambridge_source_ref:
          q.cambridge_source_ref ||
          `${paper.subject.code}/${paper.paper.paper_code}/${paper.paper.series}/${paper.paper.year}/Q${q.question_number}`,
        active: q.status !== 'withdrawn',
        diagram_metadata: diagramMeta,
      };
    });

    let questionsData: Array<{ id: string; question_number: number }> | null = null;
    const { data: qData, error: questionsError } = await supabase
      .from('questions')
      .upsert(questionsPayload, { onConflict: 'paper_id,question_number' })
      .select('id, question_number');

    if (questionsError) {
      // Fallback if diagram_metadata column is not in DB schema
      if (questionsError.message?.toLowerCase().includes('diagram_metadata')) {
        console.warn('[Ingest Publish] Retrying questions upsert without diagram_metadata column...');
        const fallbackPayload = questionsPayload.map(({ diagram_metadata, ...rest }) => rest);
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('questions')
          .upsert(fallbackPayload, { onConflict: 'paper_id,question_number' })
          .select('id, question_number');

        if (fallbackError) {
          console.error('[Ingest Publish] Questions fallback upsert failed:', fallbackError);
          return NextResponse.json(
            {
              success: false,
              error: `Failed to upsert questions: ${fallbackError.message}`,
              stage,
            },
            { status: 500 }
          );
        }
        questionsData = fallbackData;
      } else {
        console.error('[Ingest Publish] Questions upsert failed:', questionsError);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to upsert questions: ${questionsError.message}`,
            stage,
          },
          { status: 500 }
        );
      }
    } else {
      questionsData = qData;
    }

    const questionIdMap = new Map<number, string>();
    if (questionsData) {
      for (const qRow of questionsData) {
        questionIdMap.set(qRow.question_number, qRow.id);
      }
    }

    // Lookup any missing question IDs if needed
    if (questionIdMap.size < targetQuestions.length) {
      const { data: currentQuestions } = await supabase
        .from('questions')
        .select('id, question_number')
        .eq('paper_id', paperId);

      if (currentQuestions) {
        for (const cq of currentQuestions) {
          questionIdMap.set(cq.question_number, cq.id);
        }
      }
    }
    console.log(`[Ingest Publish] [4/5] Questions upserted & mapped: count=${questionIdMap.size}`);

    // 5. Upsert Question Options
    stage = 'upsert_question_options';
    const optionsPayload: Array<{
      question_id: string;
      label: string;
      content_markdown: string;
      is_correct: boolean;
      distractor_reasoning: string | null;
    }> = [];

    for (const q of targetQuestions) {
      const qId = questionIdMap.get(q.question_number);
      if (!qId) {
        console.error(`[Ingest Publish] Failed to correlate question ID for Q${q.question_number}`);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to correlate question ID for Q${q.question_number}.`,
            stage,
          },
          { status: 500 }
        );
      }

      for (const opt of q.options) {
        let reasoning: string | null = (opt as any).distractor_reasoning ?? null;
        if (!reasoning && !opt.is_correct) {
          reasoning = extractDistractorReasoning(q.explanation_markdown, opt.label);
        }

        optionsPayload.push({
          question_id: qId,
          label: opt.label,
          content_markdown: opt.content_markdown,
          is_correct: opt.is_correct,
          distractor_reasoning: reasoning,
        });
      }
    }

    const { error: optionsError } = await supabase
      .from('question_options')
      .upsert(optionsPayload, { onConflict: 'question_id,label' });

    if (optionsError) {
      // Fallback if distractor_reasoning column is not in DB schema
      if (optionsError.message?.toLowerCase().includes('distractor_reasoning')) {
        console.warn('[Ingest Publish] Retrying question options upsert without distractor_reasoning column...');
        const fallbackOptions = optionsPayload.map(({ distractor_reasoning, ...rest }) => rest);
        const { error: fallbackOptError } = await supabase
          .from('question_options')
          .upsert(fallbackOptions, { onConflict: 'question_id,label' });

        if (fallbackOptError) {
          console.error('[Ingest Publish] Question options fallback upsert failed:', fallbackOptError);
          return NextResponse.json(
            {
              success: false,
              error: `Failed to upsert question options: ${fallbackOptError.message}`,
              stage,
            },
            { status: 500 }
          );
        }
      } else {
        console.error('[Ingest Publish] Question options upsert failed:', optionsError);
        return NextResponse.json(
          {
            success: false,
            error: `Failed to upsert question options: ${optionsError.message}`,
            stage,
          },
          { status: 500 }
        );
      }
    }

    console.log(
      `[Ingest Publish] [5/5] Question options upserted: count=${optionsPayload.length}. Publish complete!`
    );

    const receipt: PublishReceipt = {
      success: true,
      paper_id: paperId,
      subjects_count: 1,
      topics_count: topicMap.size,
      questions_count: targetQuestions.length,
      options_count: optionsPayload.length,
    };

    return NextResponse.json(receipt);
  } catch (err: any) {
    console.error(`[Ingest Publish] Unexpected exception at stage "${stage}":`, err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Internal server error while publishing paper.',
        stage,
      },
      { status: 500 }
    );
  }
}

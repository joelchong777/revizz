#!/usr/bin/env node
/**
 * Revizz Cambridge Staging Paper Database Seeder & Ingestion Publisher
 *
 * Automated CLI utility to validate and publish Cambridge exam papers from staging/*.json
 * directly into Supabase (subjects, topics, papers, questions, question_options).
 *
 * Features:
 * - Reads validated Cambridge staging papers from staging/*.json or custom paths.
 * - Strict schema validation via canonical validateStagingPaper (types/ingestion.ts).
 * - Safe by default: Defaults to --dry-run to preview questions, papers, topics,
 *   diagrams, and distractor reasoning without writing to DB.
 * - Supports --publish (or --push) to execute idempotent relational upserts into Supabase.
 * - Automatically parses distractor reasoning from explanation markdown, question distractor_analysis,
 *   or option metadata.
 * - Backward compatibility fallbacks if optional columns (diagram_metadata, distractor_reasoning)
 *   are missing from remote database schemas.
 *
 * Usage:
 *   npx tsx scripts/publish-staging-papers.ts --dry-run
 *   npx tsx scripts/publish-staging-papers.ts staging/0455_s24_12.json --dry-run
 *   npx tsx scripts/publish-staging-papers.ts --file staging/0455_s24_12.json --publish
 *   npx tsx scripts/publish-staging-papers.ts --dir staging --pattern "0455_s24_*" --dry-run
 *   npx tsx scripts/publish-staging-papers.ts --publish
 */

// Node 20 WebSocket polyfill for @supabase/supabase-js in CLI environments
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  StagingPaper,
  StagingQuestion,
  validateStagingPaper,
  ValidationResult,
} from '../types/ingestion';

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Searches and loads environment variables from .env.local and .env files.
 * Checks current working directory and parent paths.
 */
export function loadEnvironment(): void {
  const candidateDirs = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '../..'),
  ];
  const envFiles = ['.env.local', '.env'];

  for (const dir of candidateDirs) {
    for (const envFile of envFiles) {
      const fullPath = path.join(dir, envFile);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const line of content.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              const key = trimmed.substring(0, eqIdx).trim();
              let val = trimmed.substring(eqIdx + 1).trim();
              if (
                (val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))
              ) {
                val = val.substring(1, val.length - 1);
              }
              if (!process.env[key]) {
                process.env[key] = val;
              }
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }
}

loadEnvironment();

/**
 * Initialize a configured SupabaseClient for database operations.
 */
export function getSupabaseClient(customUrl?: string, customKey?: string): SupabaseClient {
  const supabaseUrl =
    customUrl ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://dmvahcaxixvhgxidmkqs.supabase.co';
  const supabaseKey =
    customKey ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdmFoY2F4aXh2aGd4aWRta3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTc4NzQsImV4cCI6MjEwNzAzMzg3NH0.qeqa5hQ84xnIOljKmu7SUhcko53qM1gO_dCmYvjnf-4';

  return createClient(supabaseUrl, supabaseKey);
}

// ============================================================================
// Distractor Extraction Logic
// ============================================================================

/**
 * Extract distractor explanation for an option from question explanation markdown.
 * Matches standard Cambridge explanation patterns such as:
 *   ### Distractor Analysis
 *   - **A (High costs)**: Reasoning...
 *   - **B**: Reasoning...
 *   - **Option C**: Reasoning...
 */
export function extractDistractorReasoning(
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

// ============================================================================
// Types & Summaries
// ============================================================================

export interface PublishPaperOptions {
  dryRun?: boolean;
  verbose?: boolean;
  batchSize?: number;
  allowPartialBatch?: boolean;
}

export interface PaperPublishSummary {
  filename: string;
  paperKey: string;
  subjectCode: string;
  subjectName: string;
  paperCode: string;
  series: string;
  year: number;
  questionsCount: number;
  topicsCount: number;
  optionsCount: number;
  diagramsCount: number;
  distractorReasoningsCount: number;
  correctDistribution: Record<string, number>;
  subjectId?: string;
  paperId?: string;
  dryRun: boolean;
  success: boolean;
  errors?: string[];
}

// ============================================================================
// Preview / Dry-Run Analysis
// ============================================================================

/**
 * Analyzes and generates a preview summary of a staging paper without performing DB writes.
 */
export function previewStagingPaper(
  paper: StagingPaper,
  filename: string = 'inline'
): PaperPublishSummary {
  const paperKey = `${paper.subject.code}_${paper.paper.series}${paper.paper.year.toString().slice(-2)}_${paper.paper.paper_code}`;
  const seenTopics = new Set<string>();

  if (paper.syllabus_topics) {
    for (const t of paper.syllabus_topics) {
      if (t.name) seenTopics.add(t.name);
    }
  }

  let diagramsCount = 0;
  let optionsCount = 0;
  let distractorCount = 0;
  const correctDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };

  for (const q of paper.questions) {
    if (q.topic_name) seenTopics.add(q.topic_name);
    if (q.diagram && q.diagram.has_diagram) {
      diagramsCount++;
    }

    for (const opt of q.options) {
      optionsCount++;
      if (opt.is_correct) {
        correctDist[opt.label] = (correctDist[opt.label] || 0) + 1;
      }

      let reasoning: string | null = (opt as any).distractor_reasoning ?? null;
      if (!reasoning && (q as any).distractor_analysis?.[opt.label]) {
        reasoning = (q as any).distractor_analysis[opt.label];
      }
      if (!reasoning) {
        reasoning = extractDistractorReasoning(q.explanation_markdown, opt.label);
      }

      if (reasoning) {
        distractorCount++;
      }
    }
  }

  return {
    filename,
    paperKey,
    subjectCode: paper.subject.code,
    subjectName: paper.subject.name,
    paperCode: paper.paper.paper_code,
    series: paper.paper.series,
    year: paper.paper.year,
    questionsCount: paper.questions.length,
    topicsCount: seenTopics.size,
    optionsCount,
    diagramsCount,
    distractorReasoningsCount: distractorCount,
    correctDistribution: correctDist,
    dryRun: true,
    success: true,
  };
}

// ============================================================================
// Supabase Ingestion / Seeding Engine
// ============================================================================

/**
 * Publishes a validated StagingPaper document into Supabase relational tables:
 * 1. public.subjects (code, name, icon)
 * 2. public.topics (subject_id, name, order_index)
 * 3. public.papers (subject_id, series, paper_code, year)
 * 4. public.questions (subject_id, paper_id, topic_id, question_number, stem_markdown, etc.)
 * 5. public.question_options (question_id, label, content_markdown, is_correct, distractor_reasoning)
 */
export async function publishStagingPaperToSupabase(
  paper: StagingPaper,
  supabase: SupabaseClient,
  options?: PublishPaperOptions,
  filename: string = 'inline'
): Promise<PaperPublishSummary> {
  const paperKey = `${paper.subject.code}_${paper.paper.series}${paper.paper.year.toString().slice(-2)}_${paper.paper.paper_code}`;
  const errors: string[] = [];

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
    const msg = `Subject upsert failed (${paper.subject.code}): ${subjectError?.message || 'Database error'}`;
    return {
      filename,
      paperKey,
      subjectCode: paper.subject.code,
      subjectName: paper.subject.name,
      paperCode: paper.paper.paper_code,
      series: paper.paper.series,
      year: paper.paper.year,
      questionsCount: paper.questions.length,
      topicsCount: 0,
      optionsCount: 0,
      diagramsCount: 0,
      distractorReasoningsCount: 0,
      correctDistribution: {},
      dryRun: false,
      success: false,
      errors: [msg],
    };
  }

  const subjectId = subjectData.id;

  // 2. Upsert Topics
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

  for (const q of paper.questions) {
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
      // Sequential fallback on conflict error
      for (const t of topicsToUpsert) {
        const { data: singleTopic, error: singleError } = await supabase
          .from('topics')
          .upsert(t, { onConflict: 'subject_id,name' })
          .select('id, name')
          .single();

        if (!singleError && singleTopic) {
          topicMap.set(singleTopic.name, singleTopic.id);
        } else if (singleError) {
          errors.push(`Topic upsert failed (${t.name}): ${singleError.message}`);
        }
      }
    } else if (topicsData) {
      for (const tRow of topicsData) {
        topicMap.set(tRow.name, tRow.id);
      }
    }
  }

  // Populate any existing topics from DB for this subject
  const { data: existingTopics } = await supabase
    .from('topics')
    .select('id, name')
    .eq('subject_id', subjectId);

  if (existingTopics) {
    for (const et of existingTopics) {
      topicMap.set(et.name, et.id);
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
    const msg = `Paper upsert failed (${paper.paper.paper_code}): ${paperError?.message || 'Database error'}`;
    return {
      filename,
      paperKey,
      subjectCode: paper.subject.code,
      subjectName: paper.subject.name,
      paperCode: paper.paper.paper_code,
      series: paper.paper.series,
      year: paper.paper.year,
      questionsCount: paper.questions.length,
      topicsCount: topicMap.size,
      optionsCount: 0,
      diagramsCount: 0,
      distractorReasoningsCount: 0,
      correctDistribution: {},
      subjectId,
      dryRun: false,
      success: false,
      errors: [msg],
    };
  }

  const paperId = paperData.id;

  // 4. Upsert Questions
  let diagramsCount = 0;
  const questionsPayload = paper.questions.map((q) => {
    if (q.diagram && q.diagram.has_diagram) {
      diagramsCount++;
    }

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
    if (questionsError.message?.toLowerCase().includes('diagram_metadata')) {
      // Fallback omitting diagram_metadata column if absent in DB schema
      const fallbackPayload = questionsPayload.map(({ diagram_metadata, ...rest }) => rest);
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('questions')
        .upsert(fallbackPayload, { onConflict: 'paper_id,question_number' })
        .select('id, question_number');

      if (fallbackError) {
        errors.push(`Questions upsert fallback failed: ${fallbackError.message}`);
      } else {
        questionsData = fallbackData;
      }
    } else {
      errors.push(`Questions upsert failed: ${questionsError.message}`);
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

  // Populate any missing question IDs by querying the paper
  if (questionIdMap.size < paper.questions.length) {
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

  // 5. Upsert Question Options & Distractor Reasoning
  let optionsCount = 0;
  let distractorCount = 0;
  const correctDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
  const optionsPayload: Array<{
    question_id: string;
    label: string;
    content_markdown: string;
    is_correct: boolean;
    distractor_reasoning: string | null;
  }> = [];

  for (const q of paper.questions) {
    const qId = questionIdMap.get(q.question_number);
    if (!qId) {
      errors.push(`Missing question ID for Q${q.question_number}`);
      continue;
    }

    for (const opt of q.options) {
      optionsCount++;
      if (opt.is_correct) {
        correctDist[opt.label] = (correctDist[opt.label] || 0) + 1;
      }

      let reasoning: string | null = (opt as any).distractor_reasoning ?? null;
      if (!reasoning && (q as any).distractor_analysis?.[opt.label]) {
        reasoning = (q as any).distractor_analysis[opt.label];
      }
      if (!reasoning) {
        reasoning = extractDistractorReasoning(q.explanation_markdown, opt.label);
      }

      if (reasoning) {
        distractorCount++;
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

  if (optionsPayload.length > 0) {
    // Process in batches of 100 for network safety
    const chunkSize = options?.batchSize || 100;
    for (let i = 0; i < optionsPayload.length; i += chunkSize) {
      const chunk = optionsPayload.slice(i, i + chunkSize);
      const { error: optionsError } = await supabase
        .from('question_options')
        .upsert(chunk, { onConflict: 'question_id,label' });

      if (optionsError) {
        if (optionsError.message?.toLowerCase().includes('distractor_reasoning')) {
          // Fallback omitting distractor_reasoning column if absent
          const fallbackChunk = chunk.map(({ distractor_reasoning, ...rest }) => rest);
          const { error: fallbackOptError } = await supabase
            .from('question_options')
            .upsert(fallbackChunk, { onConflict: 'question_id,label' });

          if (fallbackOptError) {
            errors.push(`Question options chunk failed: ${fallbackOptError.message}`);
          }
        } else {
          errors.push(`Question options chunk failed: ${optionsError.message}`);
        }
      }
    }
  }

  return {
    filename,
    paperKey,
    subjectCode: paper.subject.code,
    subjectName: paper.subject.name,
    paperCode: paper.paper.paper_code,
    series: paper.paper.series,
    year: paper.paper.year,
    questionsCount: paper.questions.length,
    topicsCount: topicMap.size,
    optionsCount,
    diagramsCount,
    distractorReasoningsCount: distractorCount,
    correctDistribution: correctDist,
    subjectId,
    paperId,
    dryRun: false,
    success: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================================================
// CLI Formatting & User Experience
// ============================================================================

function printUsage(): void {
  console.log(`
================================================================================
  REVIZZ CAMBRIDGE PAPERS DATABASE SEEDER & PUBLISHER
================================================================================

Publishes Cambridge MCQ exam papers from staging/*.json directly into Supabase.

Usage:
  npx tsx scripts/publish-staging-papers.ts [flags] [target_file]

Flags:
  --dry-run             Preview papers, schema validation, and question stats
                        without database writes (SAFE DEFAULT).
  --publish, --push     Execute idempotent relational upserts to live Supabase DB.
  --file <path>         Target a specific staging paper JSON file.
  --dir <path>          Directory containing staging papers (default: 'staging').
  --pattern <filter>    Filter staging filenames (e.g. '0455_s24_*' or 's24').
  --limit <num>         Maximum number of papers to process.
  --verbose, -v         Display detailed question stems, options, and distractors.
  --batch-size <num>    Chunk size for question options batch upsert (default: 100).
  --help, -h            Show this help dialog.

Examples:
  1. Dry-run preview of specific staging paper:
     npx tsx scripts/publish-staging-papers.ts staging/0455_s24_12.json --dry-run

  2. Dry-run preview of all staging papers:
     npx tsx scripts/publish-staging-papers.ts --dry-run

  3. Dry-run preview with verbose question inspection:
     npx tsx scripts/publish-staging-papers.ts staging/0455_s24_12.json --dry-run --verbose

  4. Publish a single verified paper to Supabase:
     npx tsx scripts/publish-staging-papers.ts staging/0455_s24_12.json --publish

  5. Batch publish all 2024 Economics papers:
     npx tsx scripts/publish-staging-papers.ts --pattern "0455_*24_*" --publish
`);
}

export interface CliArguments {
  dryRun: boolean;
  publish: boolean;
  filePath?: string;
  dirPath: string;
  pattern?: string;
  limit?: number;
  verbose: boolean;
  batchSize: number;
  help: boolean;
}

export function parseCliArguments(argv: string[]): CliArguments {
  const args = argv.slice(2);
  const result: CliArguments = {
    dryRun: false,
    publish: false,
    dirPath: 'staging',
    verbose: false,
    batchSize: 100,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--publish' || arg === '--push') {
      result.publish = true;
    } else if (arg === '--file' && i + 1 < args.length) {
      result.filePath = args[++i];
    } else if (arg === '--dir' && i + 1 < args.length) {
      result.dirPath = args[++i];
    } else if (arg === '--pattern' && i + 1 < args.length) {
      result.pattern = args[++i];
    } else if (arg === '--limit' && i + 1 < args.length) {
      const num = parseInt(args[++i], 10);
      if (!isNaN(num) && num > 0) result.limit = num;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--batch-size' && i + 1 < args.length) {
      const bs = parseInt(args[++i], 10);
      if (!isNaN(bs) && bs > 0) result.batchSize = bs;
    } else if (!arg.startsWith('--') && !result.filePath) {
      result.filePath = arg;
    }
  }

  // Safe default: if --publish is not passed, dryRun is enabled
  if (!result.publish) {
    result.dryRun = true;
  }

  return result;
}

// ============================================================================
// Main CLI Runner
// ============================================================================

export async function main(): Promise<void> {
  const args = parseCliArguments(process.argv);

  if (args.help) {
    printUsage();
    return;
  }

  console.log(`\n================================================================================`);
  console.log(` Revizz Cambridge Staging Paper Database Seeder`);
  console.log(` Mode: ${args.publish ? '\x1b[33m🚀 LIVE DATABASE PUBLISH\x1b[0m' : '\x1b[36m🔍 DRY-RUN PREVIEW (No DB writes)\x1b[0m'}`);
  console.log(` Target: ${args.filePath ? args.filePath : `Directory "${args.dirPath}"`}${args.pattern ? ` [pattern: ${args.pattern}]` : ''}`);
  console.log(`================================================================================\n`);

  // Collect target file list
  const filesToProcess: string[] = [];

  if (args.filePath) {
    const resolvedPath = path.resolve(process.cwd(), args.filePath);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`\x1b[31m❌ Error:\x1b[0m Specified file does not exist: ${resolvedPath}`);
      process.exit(1);
    }
    filesToProcess.push(resolvedPath);
  } else {
    const resolvedDir = path.resolve(process.cwd(), args.dirPath);
    if (!fs.existsSync(resolvedDir)) {
      console.error(`\x1b[31m❌ Error:\x1b[0m Staging directory does not exist: ${resolvedDir}`);
      process.exit(1);
    }

    const allEntries = fs.readdirSync(resolvedDir);
    let matchedFiles = allEntries.filter((f) => f.endsWith('.json') && !f.startsWith('.'));

    if (args.pattern) {
      const globPattern = args.pattern.replace(/\*/g, '.*');
      const reg = new RegExp(`^${globPattern}$`, 'i');
      matchedFiles = matchedFiles.filter((f) => reg.test(f) || f.includes(args.pattern!));
    }

    matchedFiles.sort();

    if (args.limit && args.limit > 0) {
      matchedFiles = matchedFiles.slice(0, args.limit);
    }

    for (const f of matchedFiles) {
      filesToProcess.push(path.join(resolvedDir, f));
    }
  }

  if (filesToProcess.length === 0) {
    console.warn(`\x1b[33m⚠️ Warning:\x1b[0m No JSON staging papers found to process.`);
    return;
  }

  console.log(`Discovered ${filesToProcess.length} staging paper(s) to process.\n`);

  let supabase: SupabaseClient | null = null;
  if (args.publish) {
    supabase = getSupabaseClient();
    console.log(`Supabase Client initialized with endpoint: ${process.env.NEXT_PUBLIC_SUPABASE_URL || 'default'}\n`);
  }

  const summaries: PaperPublishSummary[] = [];

  for (let idx = 0; idx < filesToProcess.length; idx++) {
    const file = filesToProcess[idx];
    const filename = path.basename(file);
    console.log(`[${idx + 1}/${filesToProcess.length}] Reading: ${filename}...`);

    let rawData: unknown;
    try {
      const fileText = fs.readFileSync(file, 'utf8');
      rawData = JSON.parse(fileText);
    } catch (parseErr: any) {
      console.error(`  \x1b[31m✖ JSON Parse Error:\x1b[0m ${parseErr.message}`);
      summaries.push({
        filename,
        paperKey: filename.replace('.json', ''),
        subjectCode: 'unknown',
        subjectName: 'unknown',
        paperCode: 'unknown',
        series: 'unknown',
        year: 0,
        questionsCount: 0,
        topicsCount: 0,
        optionsCount: 0,
        diagramsCount: 0,
        distractorReasoningsCount: 0,
        correctDistribution: {},
        dryRun: args.dryRun,
        success: false,
        errors: [`JSON parse error: ${parseErr.message}`],
      });
      continue;
    }

    // Schema Validation
    const validation: ValidationResult<StagingPaper> = validateStagingPaper(rawData, {
      allowPartialBatch: true,
    });

    if (!validation.success || !validation.data) {
      console.error(`  \x1b[31m✖ Schema Validation Failed:\x1b[0m`);
      validation.errors?.forEach((e) => console.error(`    - ${e}`));
      summaries.push({
        filename,
        paperKey: filename.replace('.json', ''),
        subjectCode: 'unknown',
        subjectName: 'unknown',
        paperCode: 'unknown',
        series: 'unknown',
        year: 0,
        questionsCount: 0,
        topicsCount: 0,
        optionsCount: 0,
        diagramsCount: 0,
        distractorReasoningsCount: 0,
        correctDistribution: {},
        dryRun: args.dryRun,
        success: false,
        errors: validation.errors,
      });
      continue;
    }

    const paper = validation.data;

    if (args.dryRun) {
      const summary = previewStagingPaper(paper, filename);
      summaries.push(summary);
      console.log(`  \x1b[32m✔ Validated Schema:\x1b[0m ${paper.subject.code} (${paper.subject.name}) ${paper.paper.series} ${paper.paper.year} Paper ${paper.paper.paper_code}`);
      console.log(`    - Questions: ${summary.questionsCount} | Topics: ${summary.topicsCount} | Options: ${summary.optionsCount}`);
      console.log(`    - Diagrams: ${summary.diagramsCount} | Distractor Explanations: ${summary.distractorReasoningsCount}`);
      console.log(`    - Answer Keys: A=${summary.correctDistribution.A || 0}, B=${summary.correctDistribution.B || 0}, C=${summary.correctDistribution.C || 0}, D=${summary.correctDistribution.D || 0}`);

      if (args.verbose) {
        console.log(`\n    --- Verbose Question Breakdown (First 3 Questions) ---`);
        for (const sampleQ of paper.questions.slice(0, 3)) {
          console.log(`    Q${sampleQ.question_number} [${sampleQ.topic_name}]: ${sampleQ.stem_markdown.slice(0, 60)}...`);
          for (const opt of sampleQ.options) {
            const dist = extractDistractorReasoning(sampleQ.explanation_markdown, opt.label);
            console.log(`      [${opt.label}] ${opt.is_correct ? '★' : ' '} ${opt.content_markdown.slice(0, 40)} | Reasoning: ${dist ? dist.slice(0, 50) + '...' : '(none)'}`);
          }
        }
        console.log(`    ------------------------------------------------------\n`);
      }
    } else if (args.publish && supabase) {
      console.log(`  🚀 Publishing to Supabase...`);
      const summary = await publishStagingPaperToSupabase(paper, supabase, {
        batchSize: args.batchSize,
      }, filename);
      summaries.push(summary);

      if (summary.success) {
        console.log(`  \x1b[32m✔ Published Successfully!\x1b[0m Paper ID: ${summary.paperId}`);
        console.log(`    - Subject ID: ${summary.subjectId}`);
        console.log(`    - Questions: ${summary.questionsCount} | Options: ${summary.optionsCount} | Topics: ${summary.topicsCount}`);
      } else {
        console.error(`  \x1b[31m✖ Publication Errors:\x1b[0m`);
        summary.errors?.forEach((e) => console.error(`    - ${e}`));
      }
    }
  }

  // Final Summary Table
  console.log(`\n================================================================================`);
  console.log(` Summary Report`);
  console.log(`================================================================================`);
  console.log(
    `Status  | Paper Key         | Subject        | Year/Series | Qs  | Diag | Dist | Result`
  );
  console.log(`--------|-------------------|----------------|-------------|-----|------|------|--------`);

  let totalQuestions = 0;
  let totalDiagrams = 0;
  let totalDistractors = 0;
  let passedCount = 0;

  for (const s of summaries) {
    if (s.success) passedCount++;
    totalQuestions += s.questionsCount;
    totalDiagrams += s.diagramsCount;
    totalDistractors += s.distractorReasoningsCount;

    const statusBadge = s.success ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    const paperKeyCol = s.paperKey.padEnd(17).slice(0, 17);
    const subCol = s.subjectName.padEnd(14).slice(0, 14);
    const yrCol = `${s.year} ${s.series}/${s.paperCode}`.padEnd(11).slice(0, 11);
    const qsCol = s.questionsCount.toString().padStart(3);
    const diagCol = s.diagramsCount.toString().padStart(4);
    const distCol = s.distractorReasoningsCount.toString().padStart(4);
    const resCol = s.dryRun ? 'Dry-Run OK' : s.success ? 'Seeded' : 'Error';

    console.log(`${statusBadge}    | ${paperKeyCol} | ${subCol} | ${yrCol} | ${qsCol} | ${diagCol} | ${distCol} | ${resCol}`);
  }

  console.log(`================================================================================`);
  console.log(`Total Papers: ${summaries.length} | Passed: ${passedCount} | Failed: ${summaries.length - passedCount}`);
  console.log(`Total Questions: ${totalQuestions} | Diagrams: ${totalDiagrams} | Distractor Analyses: ${totalDistractors}`);
  console.log(`Execution Mode: ${args.publish ? 'LIVE DATABASE WRITE' : 'DRY-RUN (No writes made)'}`);
  console.log(`================================================================================\n`);

  if (passedCount !== summaries.length) {
    process.exit(1);
  }
}

// Direct execution guard
if (
  typeof require !== 'undefined' &&
  require.main === module
) {
  main().catch((err) => {
    console.error('\n\x1b[31mUncaught CLI Execution Error:\x1b[0m', err);
    process.exit(1);
  });
} else if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('publish-staging-papers.ts') || process.argv[1].endsWith('publish-staging-papers.js'))
) {
  main().catch((err) => {
    console.error('\n\x1b[31mUncaught CLI Execution Error:\x1b[0m', err);
    process.exit(1);
  });
}

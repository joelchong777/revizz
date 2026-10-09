#!/usr/bin/env node
/**
 * Revizz Cambridge Ingestion CLI Orchestrator & Staging Manager
 *
 * Command-line tool to process Cambridge Assessment International Education (CAIE)
 * Question Papers (QP), Mark Schemes (MS), and Syllabus documents:
 * - Multimodal Gemini extraction in configurable chunked batches
 * - KaTeX typography & unit normalization
 * - High-resolution 300 DPI diagram cropping and Supabase Storage upload
 * - Strict schema validation into staging/[paper_code].json
 * - Idempotent relational upserts into Supabase (subjects, papers, topics, questions, question_options)
 *
 * Usage:
 *   npx tsx scripts/ingest-paper.ts --qp <path> --ms <path> [--syllabus <path>] [--batch-size 10] [--dry-run]
 *   npx tsx scripts/ingest-paper.ts --push staging/sample_0625_s23_12.json
 *   npx tsx scripts/ingest-paper.ts --qp <path> --ms <path> --push
 */

// Node 20 WebSocket polyfill for @supabase/supabase-js in CLI environment
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  StagingPaper,
  StagingQuestion,
  StagingOption,
  validateStagingPaper,
} from '../types/ingestion';
import { extractQuestionsChunked } from '../lib/ingestion/geminiExtractor';
import { cropAndUploadDiagram } from '../lib/ingestion/diagramCropper';
import { sanitizeKaTeX } from '../lib/ingestion/katexSanitizer';

// Load .env.local or .env if present in project root
function loadEnvironment(): void {
  const envPaths = ['.env.local', '.env'];
  for (const envFile of envPaths) {
    const fullPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      for (const line of lines) {
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
    }
  }
}

loadEnvironment();

export interface CliOptions {
  qp?: string;
  ms?: string;
  syllabus?: string;
  batchSize: number;
  dryRun: boolean;
  push: boolean;
  stagingPath?: string;
  paperCode?: string;
  subjectCode?: string;
  subjectName?: string;
  series?: string;
  year?: number;
  apiKey?: string;
  help?: boolean;
}

export function parseCliArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    batchSize: 10,
    dryRun: false,
    push: false,
  };

  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--qp' && i + 1 < args.length) {
      options.qp = args[++i];
    } else if (arg === '--ms' && i + 1 < args.length) {
      options.ms = args[++i];
    } else if (arg === '--syllabus' && i + 1 < args.length) {
      options.syllabus = args[++i];
    } else if (arg === '--batch-size' && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (!isNaN(parsed) && parsed > 0) {
        options.batchSize = parsed;
      }
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--push') {
      options.push = true;
      // If next argument looks like a staging file path (e.g. staging/0625_s23_12.json)
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        options.stagingPath = args[++i];
      }
    } else if (arg === '--staging' && i + 1 < args.length) {
      options.stagingPath = args[++i];
    } else if (arg === '--paper' && i + 1 < args.length) {
      options.paperCode = args[++i];
    } else if (arg === '--subject-code' && i + 1 < args.length) {
      options.subjectCode = args[++i];
    } else if (arg === '--subject-name' && i + 1 < args.length) {
      options.subjectName = args[++i];
    } else if (arg === '--series' && i + 1 < args.length) {
      options.series = args[++i];
    } else if (arg === '--year' && i + 1 < args.length) {
      const parsed = parseInt(args[++i], 10);
      if (!isNaN(parsed)) options.year = parsed;
    } else if (arg === '--api-key' && i + 1 < args.length) {
      options.apiKey = args[++i];
    }
  }

  return options;
}

// Known Cambridge Subject Code mappings
const CAMBRIDGE_SUBJECT_LOOKUP: Record<string, { name: string; icon: string }> = {
  '0625': { name: 'Physics', icon: 'atom' },
  '0455': { name: 'Economics', icon: 'trending-up' },
  '0620': { name: 'Chemistry', icon: 'flask-conical' },
  '0610': { name: 'Biology', icon: 'dna' },
  '0580': { name: 'Mathematics', icon: 'calculator' },
  '9708': { name: 'Economics', icon: 'trending-up' },
  '9702': { name: 'Physics', icon: 'atom' },
  '9701': { name: 'Chemistry', icon: 'flask-conical' },
  '9700': { name: 'Biology', icon: 'dna' },
  '5070': { name: 'Chemistry', icon: 'flask-conical' },
  '5054': { name: 'Physics', icon: 'atom' },
  '2281': { name: 'Economics', icon: 'trending-up' },
};

export interface InferredMetadata {
  subjectCode: string;
  subjectName: string;
  subjectIcon: string;
  series: string;
  paperCode: string;
  year: number;
  seriesSlug: string;
  paperKey: string;
}

/**
 * Infers Cambridge examination metadata from filename conventions
 * (e.g. '0625_s23_qp_12.pdf' or '0455_w24_ms_22.pdf').
 */
export function inferCambridgeMetadata(
  filePath: string,
  overrides?: Partial<InferredMetadata>
): InferredMetadata {
  const filename = path.basename(filePath);
  // Match pattern: 0625_s23_qp_12 or 0625_s23_12
  const match = filename.match(/([0-9]{4})_([smw])([0-9]{2})_(?:qp_|ms_)?([0-9]{2})/i);

  let subjectCode = overrides?.subjectCode || '0625';
  let series = overrides?.series || 'May/June';
  let seriesSlug = overrides?.seriesSlug || 's23';
  let year = overrides?.year || 2023;
  let paperCode = overrides?.paperCode || '12';

  if (match) {
    subjectCode = overrides?.subjectCode || match[1];
    const seasonChar = match[2].toLowerCase();
    const shortYear = parseInt(match[3], 10);
    year = overrides?.year || 2000 + shortYear;
    paperCode = overrides?.paperCode || match[4];
    seriesSlug = `${seasonChar}${match[3]}`;

    if (!overrides?.series) {
      if (seasonChar === 's') series = 'May/June';
      else if (seasonChar === 'w') series = 'October/November';
      else if (seasonChar === 'm') series = 'Feb/March';
    }
  }

  const lookup = CAMBRIDGE_SUBJECT_LOOKUP[subjectCode];
  const subjectName = overrides?.subjectName || lookup?.name || `Subject ${subjectCode}`;
  const subjectIcon = overrides?.subjectIcon || lookup?.icon || 'book-open';
  const paperKey = `${subjectCode}_${seriesSlug}_${paperCode}`;

  return {
    subjectCode,
    subjectName,
    subjectIcon,
    series,
    paperCode,
    year,
    seriesSlug,
    paperKey,
  };
}

/**
 * Executes idempotent upserts to Supabase tables:
 * - public.subjects
 * - public.papers
 * - public.topics
 * - public.questions
 * - public.question_options
 */
export async function upsertStagingPaperToSupabase(
  stagingPaper: StagingPaper,
  supabaseClient: SupabaseClient
): Promise<{
  success: boolean;
  subjectId: string;
  paperId: string;
  questionsUpserted: number;
  errors?: string[];
}> {
  const errors: string[] = [];

  // 1. Upsert Subject
  const { data: subjectData, error: subjectError } = await supabaseClient
    .from('subjects')
    .upsert(
      {
        code: stagingPaper.subject.code,
        name: stagingPaper.subject.name,
        icon: stagingPaper.subject.icon || 'book-open',
      },
      { onConflict: 'code' }
    )
    .select('id')
    .single();

  if (subjectError || !subjectData) {
    throw new Error(`Failed to upsert subject (${stagingPaper.subject.code}): ${subjectError?.message}`);
  }
  const subjectId = subjectData.id;

  // 2. Upsert Paper
  const { data: paperData, error: paperError } = await supabaseClient
    .from('papers')
    .upsert(
      {
        subject_id: subjectId,
        series: stagingPaper.paper.series,
        paper_code: stagingPaper.paper.paper_code,
        year: stagingPaper.paper.year,
      },
      { onConflict: 'subject_id,year,series,paper_code' }
    )
    .select('id')
    .single();

  if (paperError || !paperData) {
    throw new Error(`Failed to upsert paper (${stagingPaper.paper.paper_code}): ${paperError?.message}`);
  }
  const paperId = paperData.id;

  // 3. Upsert Syllabus Topics
  const topicMap = new Map<string, string>();
  for (const topic of stagingPaper.syllabus_topics) {
    const { data: topicData, error: topicError } = await supabaseClient
      .from('topics')
      .upsert(
        {
          subject_id: subjectId,
          name: topic.name,
          order_index: topic.order_index,
        },
        { onConflict: 'subject_id,name' }
      )
      .select('id')
      .single();

    if (topicError || !topicData) {
      errors.push(`Topic upsert failed (${topic.name}): ${topicError?.message}`);
    } else {
      topicMap.set(topic.name, topicData.id);
    }
  }

  // Check if any question has a topic not present in syllabus_topics
  for (const q of stagingPaper.questions) {
    if (q.topic_name && !topicMap.has(q.topic_name)) {
      const { data: topicData, error: topicError } = await supabaseClient
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
        errors.push(`Ad-hoc topic upsert failed (${q.topic_name}): ${topicError?.message}`);
      } else {
        topicMap.set(q.topic_name, topicData.id);
      }
    }
  }

  // 4. Upsert Questions & Options
  let questionsUpserted = 0;

  for (const q of stagingPaper.questions) {
    const topicId = topicMap.get(q.topic_name) || null;
    const imageUrl = q.diagram?.image_url || null;

    const { data: questionData, error: questionError } = await supabaseClient
      .from('questions')
      .upsert(
        {
          subject_id: subjectId,
          paper_id: paperId,
          topic_id: topicId,
          question_number: q.question_number,
          stem_markdown: q.stem_markdown,
          image_url: imageUrl,
          explanation_markdown: q.explanation_markdown,
          cambridge_source_ref: q.cambridge_source_ref,
          active: q.status !== 'withdrawn',
        },
        { onConflict: 'paper_id,question_number' }
      )
      .select('id')
      .single();

    if (questionError || !questionData) {
      errors.push(`Question Q${q.question_number} failed: ${questionError?.message}`);
      continue;
    }

    const questionId = questionData.id;

    // Upsert Options
    const optionsPayload = q.options.map((opt) => ({
      question_id: questionId,
      label: opt.label,
      content_markdown: opt.content_markdown,
      is_correct: opt.is_correct,
    }));

    const { error: optionsError } = await supabaseClient
      .from('question_options')
      .upsert(optionsPayload, { onConflict: 'question_id,label' });

    if (optionsError) {
      errors.push(`Options for Q${q.question_number} failed: ${optionsError.message}`);
    } else {
      questionsUpserted++;
    }
  }

  return {
    success: errors.length === 0,
    subjectId,
    paperId,
    questionsUpserted,
    errors: errors.length > 0 ? errors : undefined,
  };
}

function printUsage(): void {
  console.log(`
================================================================================
  REVIZZ CAMBRIDGE INGESTION CLI
================================================================================

Commands & Flags:
  --qp <path>           Question Paper PDF file path
  --ms <path>           Mark Scheme PDF file path
  --syllabus <path>     Subject Syllabus PDF file path (optional)
  --batch-size <num>    Chunk batch size for Gemini extraction (default: 10)
  --dry-run             Generate and validate staging/[paper_code].json without Supabase writes
  --push [<path>]       Read validated staging JSON and execute idempotent Supabase upserts
  --staging <path>      Explicit path to staging JSON file
  --paper <key>         Paper code identifier (e.g. 0625_s23_12)
  --subject-code <code> Override subject code (e.g. 0625)
  --subject-name <name> Override subject name (e.g. Physics)
  --series <series>     Override series (e.g. "May/June")
  --year <year>         Override year (e.g. 2023)
  --api-key <key>       Gemini API Key (default: GEMINI_API_KEY from environment)
  --help, -h            Show this help dialog

Examples:
  1. Dry Run Extraction (generates & validates staging/0625_s23_12.json):
     npm run ingest -- --qp data/0625_s23_qp_12.pdf --ms data/0625_s23_ms_12.pdf --dry-run

  2. Direct Push of Staged Paper to Supabase:
     npm run ingest -- --push staging/sample_0625_s23_12.json

  3. Full Pipeline (Extract, Stage, Crop Diagrams & Push):
     npm run ingest -- --qp data/0625_s23_qp_12.pdf --ms data/0625_s23_ms_12.pdf --push
`);
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv);

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  // Ensure staging directory exists
  const stagingDir = path.resolve(process.cwd(), 'staging');
  if (!fs.existsSync(stagingDir)) {
    fs.mkdirSync(stagingDir, { recursive: true });
  }

  // Initialize Supabase Client
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmvahcaxixvhgxidmkqs.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  // Scenario A: Pushing an existing staged JSON file
  if (options.push && (options.stagingPath || !options.qp)) {
    const targetFile =
      options.stagingPath ||
      (options.paperCode ? path.join('staging', `${options.paperCode}.json`) : undefined);

    if (!targetFile) {
      console.error('❌ Error: --push requires a staging file path (e.g. --push staging/sample_0625_s23_12.json).');
      process.exit(1);
    }

    const resolvedPath = path.resolve(process.cwd(), targetFile);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`❌ Error: Staging file not found at: ${resolvedPath}`);
      process.exit(1);
    }

    console.log(`\n📦 Reading staging document: ${targetFile}...`);
    const rawContent = fs.readFileSync(resolvedPath, 'utf8');
    const parsedData = JSON.parse(rawContent);

    // Validate staging document
    const validation = validateStagingPaper(parsedData, { allowPartialBatch: true });
    if (!validation.success || !validation.data) {
      console.error('❌ Staging validation failed:');
      validation.errors?.forEach((err) => console.error(`  - ${err}`));
      process.exit(1);
    }

    console.log(`✅ Staging validation passed (${validation.data.questions.length} questions).`);
    console.log(`🚀 Executing idempotent upserts to Supabase (${supabaseUrl})...`);

    const result = await upsertStagingPaperToSupabase(validation.data, supabaseClient);
    if (!result.success) {
      console.warn('⚠️ Supabase upsert completed with warnings:');
      result.errors?.forEach((e) => console.warn(`  - ${e}`));
    }

    console.log(`\n🎉 Success! Upserted paper to Supabase:`);
    console.log(`  - Subject ID: ${result.subjectId}`);
    console.log(`  - Paper ID: ${result.paperId}`);
    console.log(`  - Questions Upserted: ${result.questionsUpserted}/${validation.data.questions.length}`);
    return;
  }

  // Scenario B: Extracting from Question Paper & Mark Scheme PDFs
  if (!options.qp || !options.ms) {
    console.error('❌ Error: Both --qp and --ms are required for extraction.');
    printUsage();
    process.exit(1);
  }

  const qpPath = path.resolve(process.cwd(), options.qp);
  const msPath = path.resolve(process.cwd(), options.ms);

  if (!fs.existsSync(qpPath)) {
    console.error(`❌ Error: Question Paper PDF not found at: ${qpPath}`);
    process.exit(1);
  }
  if (!fs.existsSync(msPath)) {
    console.error(`❌ Error: Mark Scheme PDF not found at: ${msPath}`);
    process.exit(1);
  }

  const meta = inferCambridgeMetadata(qpPath, {
    subjectCode: options.subjectCode,
    subjectName: options.subjectName,
    series: options.series,
    year: options.year,
    paperCode: options.paperCode,
  });

  console.log(`\n================================================================================`);
  console.log(` Cambridge Ingestion Pipeline: ${meta.subjectName} (${meta.subjectCode})`);
  console.log(` Paper: ${meta.series} ${meta.year} Paper ${meta.paperCode} [${meta.paperKey}]`);
  console.log(` Batch Size: ${options.batchSize} | Mode: ${options.dryRun ? 'DRY-RUN (Local Staging)' : options.push ? 'PUSH TO SUPABASE' : 'STAGE ONLY'}`);
  console.log(`================================================================================\n`);

  const apiKey = options.apiKey || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: GEMINI_API_KEY is not set in environment or --api-key.');
    process.exit(1);
  }

  console.log(`📄 Loading PDF buffers...`);
  const qpBuffer = fs.readFileSync(qpPath);
  const msBuffer = fs.readFileSync(msPath);

  console.log(`🤖 Invoking chunked extraction engine (Gemini Flash)...`);
  const rawQuestions = await extractQuestionsChunked(qpBuffer, msBuffer, apiKey, {
    batchSize: options.batchSize,
    startQuestion: 1,
    endQuestion: 40,
  });

  console.log(`✨ Extracted ${rawQuestions.length} questions from PDF.`);

  // Process diagrams and map to StagingQuestion objects
  console.log(`🖼️  Processing diagrams and KaTeX typography...`);
  const stagingQuestions: StagingQuestion[] = [];
  const discoveredTopics = new Set<string>();

  for (const rawQ of rawQuestions) {
    let diagramMeta: StagingQuestion['diagram'] = { has_diagram: false };

    if (rawQ.diagrams && rawQ.diagrams.length > 0) {
      const primaryBbox = rawQ.diagrams[0];
      const targetFilename = `${meta.paperKey}_q${rawQ.question_number.toString().padStart(2, '0')}.png`;

      try {
        const cropRes = await cropAndUploadDiagram(
          qpPath,
          primaryBbox,
          targetFilename,
          options.push ? supabaseClient : undefined
        );

        diagramMeta = {
          has_diagram: true,
          bounding_box: {
            ymin: primaryBbox.ymin,
            xmin: primaryBbox.xmin,
            ymax: primaryBbox.ymax,
            xmax: primaryBbox.xmax,
            page_number: primaryBbox.page_number,
          },
          image_url: cropRes.publicUrl || cropRes.webPath || `/questions/${targetFilename}`,
          storage_path: targetFilename,
          alt_description: `Diagram for Question ${rawQ.question_number}`,
        };
      } catch (cropErr: any) {
        console.warn(`⚠️ Diagram crop error for Q${rawQ.question_number}: ${cropErr.message}`);
      }
    }

    const topicName = (rawQ as any).topic_name || `${meta.subjectName} Core`;
    discoveredTopics.add(topicName);

    const cambridgeCitation = `Cambridge IGCSE ${meta.subjectName} ${meta.subjectCode}/${meta.paperCode} ${meta.series} ${meta.year} Q${rawQ.question_number}`;

    const sanitizedStem = sanitizeKaTeX(rawQ.stem_markdown);
    const sanitizedExplanation = sanitizeKaTeX(rawQ.explanation_markdown);
    const sanitizedOptions: StagingOption[] = rawQ.options.map((opt) => ({
      label: opt.label,
      content_markdown: sanitizeKaTeX(opt.content_markdown),
      is_correct: opt.is_correct,
    }));

    stagingQuestions.push({
      question_number: rawQ.question_number,
      cambridge_source_ref: cambridgeCitation,
      topic_name: topicName,
      stem_markdown: sanitizedStem,
      diagram: diagramMeta,
      options: sanitizedOptions,
      explanation_markdown: sanitizedExplanation,
      status: 'active',
    });
  }

  // Build Syllabus Topics list
  const syllabusTopics = Array.from(discoveredTopics).map((name, idx) => ({
    name,
    order_index: idx + 1,
  }));

  // Build Final StagingPaper Document
  const stagingPaper: StagingPaper = {
    subject: {
      code: meta.subjectCode,
      name: meta.subjectName,
      icon: meta.subjectIcon,
    },
    paper: {
      series: meta.series,
      paper_code: meta.paperCode,
      year: meta.year,
    },
    syllabus_topics: syllabusTopics,
    questions: stagingQuestions,
  };

  // Validate Staging Document
  console.log(`🔍 Validating staging document schema...`);
  const validation = validateStagingPaper(stagingPaper, {
    allowPartialBatch: stagingQuestions.length < 40,
  });

  if (!validation.success) {
    console.error('❌ Staging validation failed:');
    validation.errors?.forEach((err) => console.error(`  - ${err}`));
    process.exit(1);
  }

  // Write staging file to staging/[paper_key].json
  const stagingFilePath = path.join(stagingDir, `${meta.paperKey}.json`);
  fs.writeFileSync(stagingFilePath, JSON.stringify(stagingPaper, null, 2), 'utf8');
  console.log(`💾 Staging document written to: ${stagingFilePath}`);

  if (options.dryRun) {
    console.log(`\n🏁 [DRY-RUN COMPLETE] Validated staging file generated without database writes.`);
    return;
  }

  if (options.push) {
    console.log(`\n🚀 Pushing staged paper to live Supabase database...`);
    const pushResult = await upsertStagingPaperToSupabase(stagingPaper, supabaseClient);
    if (!pushResult.success) {
      console.warn('⚠️ Push finished with warnings:');
      pushResult.errors?.forEach((e) => console.warn(`  - ${e}`));
    }
    console.log(`\n🎉 Ingestion & Push Complete!`);
    console.log(`  - Subject: ${meta.subjectName} (${meta.subjectCode})`);
    console.log(`  - Paper: ${meta.series} ${meta.year} Paper ${meta.paperCode}`);
    console.log(`  - Questions Ingested: ${pushResult.questionsUpserted}/${stagingQuestions.length}`);
  } else {
    console.log(`\n✅ Staged paper is ready for review in Admin CMS or pushing via:`);
    console.log(`   npx tsx scripts/ingest-paper.ts --push ${stagingFilePath}`);
  }
}

// Execute CLI when run directly
if (require.main === module || (typeof process !== 'undefined' && process.argv[1]?.includes('ingest-paper'))) {
  main().catch((err) => {
    console.error('\n❌ Uncaught Ingestion Error:', err);
    process.exit(1);
  });
}

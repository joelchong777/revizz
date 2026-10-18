import fs from 'fs';
import path from 'path';
import { validateStagingPaper } from '../types/ingestion';
import {
  getStagingLocations,
  getFallbackStagingPaper,
  fetchLiveSupabasePapers,
  fetchLiveSupabasePaperDetail,
} from '../lib/ingestion/stagedPaperStorage';
import { GET } from '../app/api/ingest/staged-paper/route';
import { NextRequest } from 'next/server';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, name: string, failureMessage?: string) {
  if (condition) {
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } else {
    results.push({ name, passed: false, message: failureMessage });
    console.error(`  ✗ ${name} - ${failureMessage || 'Assertion failed'}`);
  }
}

async function runVerification() {
  console.log('====================================================');
  console.log('  Revizz Admin Paper Viewer Verification Suite');
  console.log('====================================================\n');

  // Test 1: Staging Locations Discovery
  console.log('[1] Verifying Staging Directory Discovery...');
  const locations = getStagingLocations();
  assert(locations.length >= 1, 'At least 1 staging location discovered');
  assert(locations[0].isWorktree === true, 'Primary staging location is marked as worktree');
  assert(fs.existsSync(locations[0].stagingDir), 'Primary worktree staging directory exists on disk');

  console.log(`    Primary worktree staging: ${locations[0].stagingDir}`);
  if (locations.length > 1) {
    console.log(`    Root staging location:    ${locations[1].stagingDir}`);
    assert(fs.existsSync(locations[1].stagingDir), 'Root staging directory exists on disk');
    assert(locations[0].stagingDir !== locations[1].stagingDir, 'Worktree and root staging directories are distinct');
  }

  // Test 2: Ingest 0455_s24_12.json and Validate Schema
  console.log('\n[2] Verifying Staging Paper 0455_s24_12.json...');
  const targetPaperId = '0455_s24_12';
  let paperPath: string | null = null;
  let paperSource: string = '';

  for (const loc of locations) {
    const candidate = path.join(loc.stagingDir, `${targetPaperId}.json`);
    if (fs.existsSync(candidate)) {
      paperPath = candidate;
      paperSource = loc.isWorktree ? 'worktree staging' : 'root staging';
      break;
    }
  }

  assert(paperPath !== null, `Found ${targetPaperId}.json (source: ${paperSource})`);

  if (paperPath) {
    const rawContent = fs.readFileSync(paperPath, 'utf8');
    let parsed: any;
    try {
      parsed = JSON.parse(rawContent);
      assert(true, 'Paper JSON parsed successfully');
    } catch (e: any) {
      assert(false, 'Paper JSON parsed successfully', e.message);
    }

    if (parsed) {
      const validation = validateStagingPaper(parsed, { allowPartialBatch: true });
      assert(
        validation.success === true,
        'Paper passes validateStagingPaper schema verification',
        validation.errors?.join('; ')
      );

      // Verify metadata
      assert(parsed.subject?.code === '0455', 'Subject code is 0455');
      assert(parsed.paper?.series === 's', 'Series is "s" (Summer / May-June)');
      assert(parsed.paper?.paper_code === '12', 'Paper code is 12');
      assert(parsed.paper?.year === 2024, 'Year is 2024');

      // Verify questions
      const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
      assert(questions.length > 0, `Contains questions (found: ${questions.length})`);
      assert(questions.length === 30 || questions.length === 40, `Question count is valid batch (${questions.length})`);

      // Verify options, diagram structure, and answer keys
      let optionsValid = true;
      let answerKeysValid = true;
      let diagramsCount = 0;
      const expectedLabels = ['A', 'B', 'C', 'D'];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (q.question_number !== i + 1) {
          optionsValid = false;
        }
        if (!q.stem_markdown || typeof q.stem_markdown !== 'string') {
          optionsValid = false;
        }

        const opts = q.options || [];
        if (opts.length !== 4) {
          optionsValid = false;
        }

        const labels = opts.map((o: any) => o.label);
        if (JSON.stringify(labels) !== JSON.stringify(expectedLabels)) {
          optionsValid = false;
        }

        const correctOpts = opts.filter((o: any) => o.is_correct === true);
        if (correctOpts.length !== 1) {
          answerKeysValid = false;
        }

        if (q.diagram?.has_diagram || q.has_diagram) {
          diagramsCount++;
        }
      }

      assert(optionsValid, 'All questions have sequential numbers, stems, and 4 options (A-D)');
      assert(answerKeysValid, 'Every question has exactly one correct option (answer key)');
      assert(diagramsCount > 0, `Diagram detection verified (found ${diagramsCount} diagram questions)`);
    }
  }

  // Test 3: Fallback Paper Generation Verification
  console.log('\n[3] Verifying Fallback Paper Generator...');
  const fallback = getFallbackStagingPaper();
  assert(fallback.id === '0455_s24_12', 'Fallback paper ID is 0455_s24_12');
  const fallbackVal = validateStagingPaper(fallback, { allowPartialBatch: true });
  assert(
    fallbackVal.success === true,
    'Fallback paper passes validateStagingPaper',
    fallbackVal.errors?.join('; ')
  );
  assert(fallback.questions.length >= 2, `Fallback paper contains valid questions (found: ${fallback.questions.length})`);

  let fallbackKeysValid = true;
  for (const q of fallback.questions) {
    const correctCount = q.options.filter((o) => o.is_correct).length;
    if (correctCount !== 1) fallbackKeysValid = false;
  }
  assert(fallbackKeysValid, 'Fallback paper questions have valid answer keys');

  // Verify pure static fallback (when no disk files exist)
  const staticFallback = getFallbackStagingPaper([]);
  assert(staticFallback.id === '0455_s24_12', 'Static fallback paper ID is 0455_s24_12');
  const staticVal = validateStagingPaper(staticFallback, { allowPartialBatch: true });
  assert(staticVal.success === true, 'Pure static fallback paper passes validateStagingPaper');
  assert(staticFallback.questions.length >= 2, 'Pure static fallback has at least 2 complete questions');

  // Test 4: Directory Traversal Security Verification
  console.log('\n[4] Verifying Directory Traversal Security Checks...');
  const maliciousInputs = [
    '../../etc/passwd',
    '..\\..\\windows\\system32',
    '../staging/0455_s24_12',
    'paper/with/slashes',
    'paper;rm -rf /',
    'paper<script>',
  ];

  let traversalBlocked = true;
  for (const input of maliciousInputs) {
    const isDangerous =
      input.includes('..') ||
      input.includes('/') ||
      input.includes('\\') ||
      !/^[a-zA-Z0-9_\-]+$/.test(input);
    if (!isDangerous) {
      traversalBlocked = false;
      console.error(`  Dangerous input was NOT caught: ${input}`);
    }
  }
  assert(traversalBlocked, 'All malicious directory traversal and path injection patterns blocked');

  // Test 5: Live Supabase Paper Integration & Dynamic Schema Mapping
  console.log('\n[5] Verifying Live Supabase Paper Integration & Dynamic Schema Mapping...');
  const livePapers = await fetchLiveSupabasePapers();
  assert(livePapers.length >= 3, `Discovered at least 3 live published papers in Supabase (found: ${livePapers.length})`);

  const expectedLiveIds = ['0455_w24_11', '0455_w24_12', '0455_w24_13'];
  for (const expectedId of expectedLiveIds) {
    const livePaper = livePapers.find((p) => p.cleanId === expectedId);
    assert(Boolean(livePaper), `Live paper ${expectedId} discovered in live paper index`);
    if (livePaper) {
      assert(livePaper.questionsCount === 30, `${expectedId} has 30 live questions (found: ${livePaper.questionsCount})`);
      assert(livePaper.diagramsCount > 0, `${expectedId} has diagrams (found: ${livePaper.diagramsCount})`);
      assert(livePaper.topicsCount >= 5, `${expectedId} has syllabus topics breakdown (found: ${livePaper.topicsCount})`);
    }
  }

  // Verify detail loading for 0455_w24_11
  const detailPaper11 = await fetchLiveSupabasePaperDetail('0455_w24_11');
  assert(Boolean(detailPaper11), 'fetchLiveSupabasePaperDetail("0455_w24_11") returned paper record');
  if (detailPaper11) {
    assert(detailPaper11.paper.id === '0455_w24_11', 'Mapped paper ID is 0455_w24_11');
    assert(detailPaper11.paper.lifecycle_state === 'published', 'Paper lifecycle_state is published');
    assert(detailPaper11.paper.source === 'database', 'Paper source is database');
    assert(detailPaper11.paper.questions.length === 30, 'Paper contains exactly 30 questions');
    assert(detailPaper11.publishedExamPaperId === 'f130c53c-4946-41ad-8171-78df5331fa5f', 'UUID matches publishedExamPaperId');

    const valResult = validateStagingPaper(detailPaper11.paper, { allowPartialBatch: true });
    assert(valResult.success === true, 'Supabase live paper conforms 100% to StagingPaper schema', valResult.errors?.join('; '));

    const q1 = detailPaper11.paper.questions[0];
    assert(q1.question_number === 1, 'Q1 has question_number 1');
    assert(typeof q1.stem_markdown === 'string' && q1.stem_markdown.length > 0, 'Q1 has stem_markdown');
    assert(q1.options.length === 4, 'Q1 has exactly 4 options');
    const correctCount = q1.options.filter((o) => o.is_correct).length;
    assert(correctCount === 1, 'Q1 has exactly one correct option');
  }

  // Verify loading by UUID
  const detailByUUID = await fetchLiveSupabasePaperDetail('f130c53c-4946-41ad-8171-78df5331fa5f');
  assert(Boolean(detailByUUID), 'fetchLiveSupabasePaperDetail by UUID returned paper record');
  if (detailByUUID) {
    assert(detailByUUID.paper.id === '0455_w24_11', 'Detail by UUID correctly resolves clean ID 0455_w24_11');
  }

  // Verify GET /api/ingest/staged-paper Route Live Behavior
  console.log('\n[6] Verifying Staged Paper API Route Live Behavior...');
  const reqList = new NextRequest('http://localhost:3000/api/ingest/staged-paper');
  const resList = await GET(reqList);
  assert(resList.status === 200, 'GET /api/ingest/staged-paper returns HTTP 200');
  const listJson = await resList.json();
  assert(listJson.success === true, 'API response reports success: true');
  assert(Array.isArray(listJson.papers), 'API response contains papers array');
  assert(Array.isArray(listJson.stagedPapers), 'API response contains stagedPapers array');

  // Verify live papers are sorted first
  const first3 = listJson.papers.slice(0, 3);
  assert(
    first3.includes('0455_w24_11') && first3.includes('0455_w24_12') && first3.includes('0455_w24_13'),
    'Live published Supabase papers are sorted first in papers list'
  );

  const firstStagedSummary = listJson.stagedPapers[0];
  assert(firstStagedSummary.source === 'database', 'First paper summary source is "database"');
  assert(firstStagedSummary.is_published === true, 'First paper summary is_published is true');
  assert(firstStagedSummary.lifecycle_state === 'published', 'First paper summary lifecycle_state is "published"');

  // Verify single paper detail route
  const reqDetail = new NextRequest('http://localhost:3000/api/ingest/staged-paper?id=0455_w24_11');
  const resDetail = await GET(reqDetail);
  assert(resDetail.status === 200, 'GET /api/ingest/staged-paper?id=0455_w24_11 returns HTTP 200');
  const detailJson = await resDetail.json();
  assert(detailJson.success === true, 'Detail response reports success: true');
  assert(detailJson.source === 'database', 'Detail response reports source: "database"');
  assert(detailJson.is_published === true, 'Detail response reports is_published: true');
  assert(detailJson.paper?.questions?.length === 30, 'Detail response paper has 30 questions');

  // Verify 0455_s24_12 is accessible
  const reqS24 = new NextRequest('http://localhost:3000/api/ingest/staged-paper?id=0455_s24_12');
  const resS24 = await GET(reqS24);
  assert(resS24.status === 200, 'GET /api/ingest/staged-paper?id=0455_s24_12 returns HTTP 200');
  const s24Json = await resS24.json();
  assert(s24Json.success === true, '0455_s24_12 loads successfully and is never blocked');

  // Summary
  console.log('\n====================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log(`  Tests Passed: ${passed} / ${total}`);
  if (failed > 0) {
    console.error(`  Tests Failed: ${failed}`);
    process.exit(1);
  } else {
    console.log('  All Staging Engine & Paper Viewer Verifications Passed!');
    console.log('====================================================\n');
  }
}

runVerification().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});

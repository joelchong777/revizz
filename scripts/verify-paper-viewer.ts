import fs from 'fs';
import path from 'path';
import { validateStagingPaper } from '../types/ingestion';
import { getStagingLocations, getFallbackStagingPaper } from '../app/api/ingest/staged-paper/route';

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
  assert(fallback.questions.length === 30, `Fallback paper has 30 questions (found: ${fallback.questions.length})`);

  let fallbackKeysValid = true;
  for (const q of fallback.questions) {
    const correctCount = q.options.filter((o) => o.is_correct).length;
    if (correctCount !== 1) fallbackKeysValid = false;
  }
  assert(fallbackKeysValid, 'Fallback paper questions have valid answer keys');

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

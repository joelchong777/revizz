/**
 * Automated Verification Test Suite: Publish Staging Papers CLI & Engine
 *
 * Verifies:
 * 1. CLI argument parser (parseCliArguments) - dry-run default safety, flag overrides, path parsing.
 * 2. Distractor extraction engine (extractDistractorReasoning) across multiple Cambridge formats:
 *    - Standard: "- **A (High costs)**: Explanation..."
 *    - Explicit Option prefix: "- **Option B**: Explanation..."
 *    - Complex parenthetical label: "- **A (O and Q)**: Reasoning..."
 *    - Null / missing explanation markdown safe handling.
 * 3. Staging paper preview analysis (previewStagingPaper) on staging/0455_s24_12.json:
 *    - Subject & Paper metadata validation
 *    - Question count (30)
 *    - Option count (120)
 *    - Diagram count (5)
 *    - Distractor reasonings count (120)
 *    - Answer key distribution matching
 * 4. End-to-end dry-run CLI execution on staging/0455_s24_12.json with clean exit code 0.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import {
  extractDistractorReasoning,
  previewStagingPaper,
  parseCliArguments,
} from './publish-staging-papers';
import { validateStagingPaper } from '../types/ingestion';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(name: string, details?: string) {
  totalTests++;
  passedTests++;
  console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}${details ? ` (${details})` : ''}`);
}

function fail(name: string, error: string) {
  totalTests++;
  failedTests++;
  console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}\n    -> Error: ${error}`);
}

function assert(condition: boolean, testName: string, errorMsg?: string) {
  if (condition) {
    pass(testName);
  } else {
    fail(testName, errorMsg || 'Assertion failed');
  }
}

function assertEqual<T>(actual: T, expected: T, testName: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    pass(testName);
  } else {
    fail(testName, `Expected ${expectedStr}, received ${actualStr}`);
  }
}

async function runVerification() {
  console.log(`\n================================================================================`);
  console.log(` Automated Verification: Cambridge Staging Papers Seeding & Publishing`);
  console.log(`================================================================================\n`);

  // --------------------------------------------------------------------------
  // Suite 1: CLI Argument Parsing & Safety Defaults
  // --------------------------------------------------------------------------
  console.log(`Suite 1: CLI Argument Parsing & Safety Defaults`);

  const emptyArgs = parseCliArguments(['node', 'script.js']);
  assert(emptyArgs.dryRun === true, 'Defaults to dry-run when no flags passed');
  assert(emptyArgs.publish === false, 'Publish flag remains false by default');
  assertEqual(emptyArgs.dirPath, 'staging', 'Default directory is "staging"');

  const dryRunExplicit = parseCliArguments(['node', 'script.js', '--dry-run', 'staging/test.json']);
  assert(dryRunExplicit.dryRun === true, 'Explicit --dry-run sets dryRun=true');
  assertEqual(dryRunExplicit.filePath, 'staging/test.json', 'Positional path assigned to filePath');

  const publishExplicit = parseCliArguments([
    'node',
    'script.js',
    '--publish',
    '--pattern',
    '0455_*',
    '--limit',
    '5',
    '--verbose',
  ]);
  assert(publishExplicit.publish === true, 'Explicit --publish sets publish=true');
  assert(publishExplicit.dryRun === false, '--publish disables dryRun');
  assertEqual(publishExplicit.pattern, '0455_*', 'Pattern option parsed correctly');
  assertEqual(publishExplicit.limit, 5, 'Limit option parsed correctly');
  assert(publishExplicit.verbose === true, 'Verbose option parsed correctly');

  // --------------------------------------------------------------------------
  // Suite 2: Distractor Reasoning Extraction Engine
  // --------------------------------------------------------------------------
  console.log(`\nSuite 2: Distractor Reasoning Extraction Engine`);

  const sampleExplanation = `
### Concept & Definition
Opportunity cost definition.

### Distractor Analysis
- **A (High costs of production)**: High costs affect firm supply and pricing, not scarcity itself.
- **Option B (Low education)**: Education affects labor quality, but scarcity persists regardless.
- **C (Unlimited resources)**: False economic premise; resources are strictly finite.
- **D (Unlimited wants) [Correct]**: Accurately reflects that wants are boundless.
`;

  const reasonA = extractDistractorReasoning(sampleExplanation, 'A');
  assertEqual(
    reasonA,
    'High costs affect firm supply and pricing, not scarcity itself.',
    'Extracts distractor reasoning for option A with parenthetical label'
  );

  const reasonB = extractDistractorReasoning(sampleExplanation, 'B');
  assertEqual(
    reasonB,
    'Education affects labor quality, but scarcity persists regardless.',
    'Extracts distractor reasoning with "Option B" label'
  );

  const reasonC = extractDistractorReasoning(sampleExplanation, 'C');
  assertEqual(
    reasonC,
    'False economic premise; resources are strictly finite.',
    'Extracts distractor reasoning for option C'
  );

  const reasonD = extractDistractorReasoning(sampleExplanation, 'D');
  assertEqual(
    reasonD,
    'Accurately reflects that wants are boundless.',
    'Extracts reasoning for correct option D'
  );

  const nullReason = extractDistractorReasoning(null, 'A');
  assertEqual(nullReason, null, 'Handles null explanation markdown safely');

  const emptyReason = extractDistractorReasoning('', 'A');
  assertEqual(emptyReason, null, 'Handles empty string explanation markdown safely');

  // --------------------------------------------------------------------------
  // Suite 3: Staging Paper Preview & Schema Analysis (staging/0455_s24_12.json)
  // --------------------------------------------------------------------------
  console.log(`\nSuite 3: Staging Paper Preview & Schema Analysis (staging/0455_s24_12.json)`);

  const filePath = path.resolve(process.cwd(), 'staging/0455_s24_12.json');
  assert(fs.existsSync(filePath), 'staging/0455_s24_12.json file exists on disk');

  const rawJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const validation = validateStagingPaper(rawJson, { allowPartialBatch: true });
  assert(validation.success, 'Paper passes canonical validateStagingPaper check');

  if (validation.data) {
    const summary = previewStagingPaper(validation.data, '0455_s24_12.json');
    assertEqual(summary.subjectCode, '0455', 'Subject code is 0455');
    assertEqual(summary.subjectName, 'Economics', 'Subject name is Economics');
    assertEqual(summary.series, 's', 'Series is "s" (May/June)');
    assertEqual(summary.paperCode, '12', 'Paper code is 12');
    assertEqual(summary.year, 2024, 'Year is 2024');
    assertEqual(summary.questionsCount, 30, 'Question count is exactly 30');
    assertEqual(summary.topicsCount, 6, 'Contains 6 syllabus topics');
    assertEqual(summary.optionsCount, 120, 'Contains 120 total options (4 per question)');
    assertEqual(summary.diagramsCount, 5, 'Accurately identifies 5 diagram questions');
    assertEqual(summary.distractorReasoningsCount, 120, 'Extracted distractor reasoning for all 120 options');
    assertEqual(summary.correctDistribution, { A: 10, B: 8, C: 3, D: 9 }, 'Answer keys distribution matches answer key');
  }

  // --------------------------------------------------------------------------
  // Suite 4: End-to-End CLI Dry-Run Execution
  // --------------------------------------------------------------------------
  console.log(`\nSuite 4: End-to-End CLI Dry-Run Execution`);

  try {
    const cliOutput = execSync(
      'npx tsx scripts/publish-staging-papers.ts staging/0455_s24_12.json --dry-run',
      { encoding: 'utf8', cwd: process.cwd() }
    );
    assert(cliOutput.includes('PASS'), 'CLI output contains PASS status');
    assert(cliOutput.includes('0455_s24_12'), 'CLI output contains paper key 0455_s24_12');
    assert(cliOutput.includes('Total Papers: 1 | Passed: 1 | Failed: 0'), 'CLI summary reports 1 paper passed, 0 failed');
    assert(cliOutput.includes('DRY-RUN'), 'CLI logs state DRY-RUN mode');
  } catch (err: any) {
    fail('CLI Dry-run execution', err.message);
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log(`\n================================================================================`);
  console.log(` Verification Summary: ${passedTests}/${totalTests} Tests Passed (${failedTests} Failed)`);
  console.log(`================================================================================\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

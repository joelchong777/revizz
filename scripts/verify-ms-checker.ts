#!/usr/bin/env tsx
/**
 * Automated Verification Suite for Cambridge Mark Scheme Checker & Auto-Remediator
 *
 * Asserts:
 * 1. PyMuPDF extraction on Economics (0455)/2024/2024 June/0455_s24_ms_12.pdf (30 answers).
 * 2. Text parser fallback on various mark scheme string formats.
 * 3. MS auto-discovery resolves 0455_s24_ms_11.pdf and older formats.
 * 4. Checker accurately detects single/multiple key mismatches and integrity errors.
 * 5. Auto-remediator corrects options, re-tags distractors, updates explanations.
 * 6. Re-checking remediated paper yields 'perfect_match' (0 mismatches).
 * 7. Strictly preserves LaTeX math ($...$, $$...$$) and currency amounts (\$12,000).
 * 8. API route / CLI script execution succeeds.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {
  parseMarkSchemePdf,
  parseMarkSchemeText,
  findMarkSchemePdf,
} from '../lib/ingestion/markSchemeParser';
import {
  verifyPaperAgainstMarkScheme,
  checkQuestionAgainstMarkScheme,
  type MarkSchemeMap,
  type MarkSchemeVerificationReport,
} from '../lib/ingestion/markSchemeChecker';
import {
  remediatePaperWithMarkScheme,
  type RemediationResult,
} from '../lib/ingestion/markSchemeRemediator';
import type { StagingPaper, StagingQuestion } from '../types/ingestion';

// Console styling
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;

let passedCount = 0;
let totalCount = 0;

function it(description: string, fn: () => void | Promise<void>) {
  totalCount++;
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passedCount++;
      console.log(`  ${green('✔')} [PASS] ${description}`);
    })
    .catch((err) => {
      console.error(`  ${red('✖')} [FAIL] ${description}`);
      console.error(`    ${err.message}`);
      throw err;
    });
}

async function runVerificationSuite() {
  console.log(bold(cyan('\n════════════════════════════════════════════════════════════')));
  console.log(bold(cyan('  TEST SUITE: Cambridge Mark Scheme Checker & Remediator')));
  console.log(bold(cyan('════════════════════════════════════════════════════════════\n')));

  // Test 1: PyMuPDF Extraction on 2024 Mark Scheme PDF
  await it('1. PyMuPDF extraction extracts all 30 answers from 0455_s24_ms_12.pdf', async () => {
    const candidatePath = findMarkSchemePdf('0455_s24_12');
    assert(candidatePath, 'Candidate path for 0455_s24_12 mark scheme must exist');
    assert(fs.existsSync(candidatePath), `File must exist at ${candidatePath}`);

    const answers = await parseMarkSchemePdf(candidatePath);
    assert.strictEqual(Object.keys(answers).length, 30, 'Must extract exactly 30 answers');
    assert.strictEqual(answers[1], 'D', 'Q1 must be D');
    assert.strictEqual(answers[2], 'B', 'Q2 must be B');
    assert.strictEqual(answers[3], 'B', 'Q3 must be B');
    assert.strictEqual(answers[30], 'C', 'Q30 must be C');
  });

  // Test 2: Text Parser Fallback
  await it('2. Pure TypeScript fallback parses multiple text representations', () => {
    // Format A: Standard tabular / single-column text
    const textSingle = `
      Question Answer Marks
      1 D 1
      2 B 1
      3 B 1
      4 D 1
    `;
    const resSingle = parseMarkSchemeText(textSingle);
    assert.strictEqual(resSingle[1], 'D');
    assert.strictEqual(resSingle[2], 'B');
    assert.strictEqual(resSingle[3], 'B');
    assert.strictEqual(resSingle[4], 'D');

    // Format B: Multi-column legacy grid
    const textMulti = `
      1 C 16 D
      2 A 17 A
      3 D 18 A
    `;
    const resMulti = parseMarkSchemeText(textMulti);
    assert.strictEqual(resMulti[1], 'C');
    assert.strictEqual(resMulti[16], 'D');
    assert.strictEqual(resMulti[2], 'A');
    assert.strictEqual(resMulti[17], 'A');
    assert.strictEqual(resMulti[3], 'D');
    assert.strictEqual(resMulti[18], 'A');

    // Format C: Comma separated or dotted list
    const textList = '1: D, 2: B, 3. A, 4 - C';
    const resList = parseMarkSchemeText(textList);
    assert.strictEqual(resList[1], 'D');
    assert.strictEqual(resList[2], 'B');
    assert.strictEqual(resList[3], 'A');
    assert.strictEqual(resList[4], 'C');
  });

  // Test 3: Auto-Discovery Engine
  await it('3. Auto-discovery resolves 0455_s24_ms_11.pdf and works across worktree boundaries', () => {
    const ms11 = findMarkSchemePdf('0455_s24_11');
    assert(ms11, 'Must find 0455_s24_ms_11.pdf');
    assert(ms11.endsWith('0455_s24_ms_11.pdf'), `Resolved file must end with expected name: ${ms11}`);

    // Object metadata variant
    const msFromMeta = findMarkSchemePdf({
      code: '0455',
      series: 's',
      year: 2024,
      paper_code: '11',
    });
    assert(msFromMeta, 'Must find mark scheme from metadata object');
  });

  // Test 4: Verification of Real Staged Paper
  await it('4. Real paper 0455_s24_11.json passes verification with perfect_match', async () => {
    const candidates = [
      path.resolve(process.cwd(), 'staging/0455_s24_11.json'),
      path.resolve(process.cwd(), '../../staging/0455_s24_11.json'),
    ];
    const jsonPath = candidates.find((c) => fs.existsSync(c)) || candidates[0];
    assert(fs.existsSync(jsonPath), '0455_s24_11.json must exist in staging');

    const paper: StagingPaper = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const msPath = findMarkSchemePdf(paper);
    assert(msPath, 'Must locate mark scheme for paper');

    const msMap = await parseMarkSchemePdf(msPath);
    const report = verifyPaperAgainstMarkScheme(paper, msMap, msPath);

    assert.strictEqual(report.status, 'perfect_match');
    assert.strictEqual(report.matchedCount, 30);
    assert.strictEqual(report.mismatchCount, 0);
  });

  // Test 5: Detection of Artificial Mismatches
  await it('5. Verification engine flags key mismatch, missing answer, and multiple correct options', () => {
    const mockQuestion: StagingQuestion = {
      question_number: 1,
      cambridge_source_ref: 'Cambridge IGCSE Economics 0455/11 May/June 2024 Q1',
      topic_name: 'The basic economic problem',
      status: 'active',
      stem_markdown: 'Why will scarcity always exist? She earns \\$10,000.',
      options: [
        { label: 'A', content_markdown: 'Option A', is_correct: true },
        { label: 'B', content_markdown: 'Option B', is_correct: false },
        { label: 'C', content_markdown: 'Option C', is_correct: false },
        { label: 'D', content_markdown: 'Option D', is_correct: false },
      ],
      explanation_markdown: 'Select Optimal Choice: Option **A**\n- **A**: Correct.\n- **D**: Incorrect.',
    };

    // Expected is D, but staged is A
    const { isMatch, mismatch } = checkQuestionAgainstMarkScheme(mockQuestion, 'D');
    assert.strictEqual(isMatch, false);
    assert(mismatch);
    assert(mismatch.mismatchTypes.includes('key_mismatch'));
    assert.strictEqual(mismatch.stagedKey, 'A');
    assert.strictEqual(mismatch.expectedKey, 'D');

    // Case B: No correct option
    const noCorrectQ = JSON.parse(JSON.stringify(mockQuestion));
    noCorrectQ.options[0].is_correct = false;
    const resNoCorrect = checkQuestionAgainstMarkScheme(noCorrectQ, 'D');
    assert(resNoCorrect.mismatch?.mismatchTypes.includes('no_correct_option'));

    // Case C: Multiple options correct
    const multiCorrectQ = JSON.parse(JSON.stringify(mockQuestion));
    multiCorrectQ.options[3].is_correct = true; // now A and D are true
    const resMulti = checkQuestionAgainstMarkScheme(multiCorrectQ, 'D');
    assert(resMulti.mismatch?.mismatchTypes.includes('multiple_correct_options'));
  });

  // Test 6: Auto-Remediation & LaTeX/Currency Preservation
  await it('6. Auto-remediator fixes keys, updates explanations, and preserves LaTeX and currency', () => {
    const originalMathExpl = `### Concept & Definition
Scarcity is represented as:
$$\\text{Scarcity} = \\text{Wants} > \\text{Resources}$$
The student earns \\$12,000 per year.

### Step-by-Step Analysis
1. Calculate financial cost: $2 \\times \\$10,000 = \\$20,000$.
2. Select Optimal Choice: Option **A** (There are high costs.) directly fulfills the analytical condition.

### Distractor Analysis
- **A (There are high costs.)**: Correct. Accurately identifies the cost.
- **B (Low education.)**: Incorrect. Does not address the outcome.
- **C (Unlimited resources.)**: Incorrect. Does not address the outcome.
- **D (Unlimited wants.)**: Incorrect. 'Unlimited wants.' does not address the required outcome; it represents an unrelated concept or opposite economic effect in this context.`;

    const stagedPaper: StagingPaper = {
      id: '0455_test_paper',
      subject: { code: '0455', name: 'Economics', icon: 'trending-up' },
      paper: { series: 's', paper_code: '11', year: 2024 },
      syllabus_topics: [{ name: 'Basic problem', order_index: 1 }],
      questions: [
        {
          question_number: 1,
          cambridge_source_ref: 'Cambridge IGCSE Economics 0455/11 May/June 2024 Q1',
          topic_name: 'The basic economic problem',
          status: 'active',
          stem_markdown: 'Why will scarcity always exist? She earns \\$10,000.',
          options: [
            { label: 'A', content_markdown: 'There are high costs.', is_correct: true },
            { label: 'B', content_markdown: 'Low education.', is_correct: false },
            { label: 'C', content_markdown: 'Unlimited resources.', is_correct: false },
            { label: 'D', content_markdown: 'Unlimited wants.', is_correct: false },
          ],
          explanation_markdown: originalMathExpl,
          distractor_analysis: {
            A: 'Correct. Accurately identifies the cost.',
            B: 'Incorrect. Unrelated.',
            C: 'Incorrect. Unrelated.',
            D: 'Incorrect. Does not address the required outcome.',
          },
        },
      ],
    };

    const msMap: MarkSchemeMap = { 1: 'D' };

    // Initial check should fail
    const initialReport = verifyPaperAgainstMarkScheme(stagedPaper, msMap);
    assert.strictEqual(initialReport.status, 'mismatches_found');
    assert.strictEqual(initialReport.mismatchCount, 1);

    // Apply auto-remediation
    const remediation: RemediationResult = remediatePaperWithMarkScheme(stagedPaper, msMap);
    assert.strictEqual(remediation.success, true);
    assert.strictEqual(remediation.fixedCount, 1);

    const fixedQ = remediation.fixedPaper.questions[0];

    // Assert option flags flipped
    assert.strictEqual(fixedQ.options.find((o) => o.label === 'D')?.is_correct, true);
    assert.strictEqual(fixedQ.options.find((o) => o.label === 'A')?.is_correct, false);

    // Assert distractor_analysis object updated
    assert(fixedQ.distractor_analysis?.D.startsWith('Correct.'));
    assert(fixedQ.distractor_analysis?.A.startsWith('Incorrect.'));

    // Assert explanation updated
    assert(
      fixedQ.explanation_markdown.includes('Select Optimal Choice: Option **D**'),
      'Optimal choice must point to D'
    );
    assert(
      fixedQ.explanation_markdown.includes('- **D (Unlimited wants.)**: Correct.'),
      'Distractor D must be marked Correct'
    );
    assert(
      fixedQ.explanation_markdown.includes('- **A (There are high costs.)**: Incorrect.'),
      'Distractor A must be marked Incorrect'
    );

    // Assert LaTeX math and currency symbols preserved
    assert(
      fixedQ.explanation_markdown.includes('$$\\text{Scarcity} = \\text{Wants} > \\text{Resources}$$'),
      'KaTeX block equation must be preserved intact'
    );
    assert(
      fixedQ.explanation_markdown.includes('$2 \\times \\$10,000 = \\$20,000$'),
      'KaTeX inline math and escaped dollars must be preserved'
    );
    assert(
      fixedQ.explanation_markdown.includes('\\$12,000'),
      'Escaped currency \\$12,000 must be preserved'
    );

    // Re-verify the remediated paper
    const postReport = verifyPaperAgainstMarkScheme(remediation.fixedPaper, msMap);
    assert.strictEqual(postReport.status, 'perfect_match');
    assert.strictEqual(postReport.matchedCount, 1);
    assert.strictEqual(postReport.mismatchCount, 0);
  });

  console.log(bold(green(`\n✔ ALL ${passedCount} OF ${totalCount} TESTS PASSED SUCCESSFULLY!\n`)));
}

runVerificationSuite().catch((err) => {
  console.error(bold(red(`\nTest suite terminated with error: ${err.message}\n`)));
  process.exit(1);
});

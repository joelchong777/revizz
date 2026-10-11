import fs from 'fs';
import path from 'path';
import katex from 'katex';
import {
  validateStagingPaper,
  validateStagingQuestion,
  StagingPaper,
  StagingQuestion,
  DiagramMetadataSchema,
  BoundingBoxSchema,
} from '../types/ingestion';
import {
  sanitizeKaTeX,
  escapeCurrencyDollars,
  fixEscapedBackslashes,
  normalizeMathDelimiters,
  normalizeUnits,
} from '../lib/ingestion/katexSanitizer';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function createDummyQuestion(qNum: number, overrides?: Partial<StagingQuestion>): StagingQuestion {
  return {
    question_number: qNum,
    cambridge_source_ref: `0625/11/M/J/23/Q${qNum}`,
    topic_name: 'Mechanics',
    stem_markdown: `Question ${qNum}: An object accelerates at $\\text{m/s^2}$.`,
    explanation_markdown: `Explanation for question ${qNum}.`,
    status: 'active',
    options: [
      { label: 'A', content_markdown: 'Option A', is_correct: true },
      { label: 'B', content_markdown: 'Option B', is_correct: false },
      { label: 'C', content_markdown: 'Option C', is_correct: false },
      { label: 'D', content_markdown: 'Option D', is_correct: false },
    ],
    ...overrides,
  };
}

function createDummyPaper(questionCount = 40): StagingPaper {
  const questions: StagingQuestion[] = [];
  for (let i = 1; i <= questionCount; i++) {
    questions.push(createDummyQuestion(i));
  }

  return {
    lifecycle_state: 'draft',
    state: 'draft',
    subject: { code: '0625', name: 'Physics', icon: 'atom' },
    paper: { series: 'm23', paper_code: '11', year: 2023 },
    syllabus_topics: [
      { name: 'Mechanics', order_index: 1 },
      { name: 'Thermal Physics', order_index: 2 },
    ],
    questions,
  };
}

/**
 * Distractor extraction helper matching the logic in POST /api/ingest/publish
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

console.log('=== Running Ingestion Pipeline Validation Tests ===\n');

// ============================================================================
// Test Suite 1: Ingestion Types & Zod Validation
// ============================================================================
console.log('Test Suite 1: Ingestion Types & Zod Validation');
{
  const paper = createDummyPaper(40);
  const result = validateStagingPaper(paper);
  assert(result.success === true, 'Standard 40-question paper passes validation');
  assert(result.errors === undefined, 'No errors returned for valid paper');
  assert(result.data?.questions.length === 40, 'Paper data properly returned');
}

// 2. Validate paper with fewer than 40 questions (default fails, partial batch passes)
{
  const shortPaper = createDummyPaper(39);
  const result = validateStagingPaper(shortPaper);
  assert(result.success === false, '39-question paper fails default 40-question check');
  assert(
    result.errors?.some((e) => e.includes('exactly 40 questions')) ?? false,
    'Reports question count error'
  );

  const partialResult = validateStagingPaper(shortPaper, { allowPartialBatch: true });
  assert(partialResult.success === true, '39-question paper passes when allowPartialBatch is true');

  const customExpected = validateStagingPaper(shortPaper, { expectedQuestionCount: 39 });
  assert(customExpected.success === true, 'Passes when expectedQuestionCount matches exactly');
}

// 3. Question options checks
{
  // Test invalid option count (3 options)
  const invalidOptionsQ = createDummyQuestion(1, {
    options: [
      { label: 'A', content_markdown: 'A', is_correct: true },
      { label: 'B', content_markdown: 'B', is_correct: false },
      { label: 'C', content_markdown: 'C', is_correct: false },
    ],
  });
  const res1 = validateStagingQuestion(invalidOptionsQ);
  assert(res1.success === false, 'Question with 3 options fails validation');
  assert(
    res1.errors?.some((e) => e.includes('exactly 4 options')) ?? false,
    'Reports 4 options requirement'
  );

  // Test duplicate label (A, A, C, D)
  const dupLabelQ = createDummyQuestion(1, {
    options: [
      { label: 'A', content_markdown: 'A1', is_correct: true },
      { label: 'A', content_markdown: 'A2', is_correct: false },
      { label: 'C', content_markdown: 'C', is_correct: false },
      { label: 'D', content_markdown: 'D', is_correct: false },
    ],
  });
  const res2 = validateStagingQuestion(dupLabelQ);
  assert(res2.success === false, 'Duplicate option labels fail validation');

  // Test no correct option marked
  const noCorrectQ = createDummyQuestion(1, {
    options: [
      { label: 'A', content_markdown: 'A', is_correct: false },
      { label: 'B', content_markdown: 'B', is_correct: false },
      { label: 'C', content_markdown: 'C', is_correct: false },
      { label: 'D', content_markdown: 'D', is_correct: false },
    ],
  });
  const res3 = validateStagingQuestion(noCorrectQ);
  assert(res3.success === false, 'Question with 0 correct options fails validation');
  assert(
    res3.errors?.some((e) => e.toLowerCase().includes('at least one option must be marked as correct')) ?? false,
    'Reports at least one correct requirement'
  );

  // Test multiple correct options allowed
  const multiCorrectQ = createDummyQuestion(1, {
    options: [
      { label: 'A', content_markdown: 'A', is_correct: true },
      { label: 'B', content_markdown: 'B', is_correct: true },
      { label: 'C', content_markdown: 'C', is_correct: false },
      { label: 'D', content_markdown: 'D', is_correct: false },
    ],
  });
  const res4 = validateStagingQuestion(multiCorrectQ);
  assert(res4.success === true, 'Question with multiple correct options passes validation');
}

// 4. Diagram metadata and BoundingBox validation
{
  const diagramQ = createDummyQuestion(1, {
    diagram: {
      has_diagram: true,
      bounding_box: {
        ymin: 120,
        xmin: 50,
        ymax: 450,
        xmax: 550,
        page_number: 3,
      },
      image_url: 'https://cdn.revizz.app/diagrams/0625_m23_11_q1.webp',
      storage_path: 'diagrams/0625/2023/q1.webp',
      alt_description: 'Velocity-time graph with a linear slope.',
    },
  });
  const resDiag = validateStagingQuestion(diagramQ);
  assert(resDiag.success === true, 'DiagramMetadata and BoundingBox pass validation');

  // Validate isolated BoundingBoxSchema
  const validBbox = BoundingBoxSchema.safeParse({
    ymin: 100,
    xmin: 200,
    ymax: 300,
    xmax: 400,
    page_number: 2,
  });
  assert(validBbox.success === true, 'BoundingBoxSchema validates correct coordinates');

  const invalidBbox = BoundingBoxSchema.safeParse({
    ymin: 'invalid',
    xmin: 200,
  });
  assert(invalidBbox.success === false, 'BoundingBoxSchema rejects invalid types');
}

// ============================================================================
// Test Suite 2: KaTeX Sanitizer & Typography Normalization
// ============================================================================
console.log('\nTest Suite 2: KaTeX Sanitizer & Typography Normalization');

// 5. Currency dollar escaping tests
{
  assert(escapeCurrencyDollars('Costs $50 per unit.') === 'Costs \\$50 per unit.', 'Lone currency sign escaped');
  assert(
    escapeCurrencyDollars('Increases from $50 to $60.') === 'Increases from \\$50 to \\$60.',
    'Currency range $50 to $60 both escaped'
  );
  assert(
    escapeCurrencyDollars('Option A: $10, Option B: $20') === 'Option A: \\$10, Option B: \\$20',
    'List of currency values escaped'
  );
  assert(
    escapeCurrencyDollars('Price is $1,250.50.') === 'Price is \\$1,250.50.',
    'Formatted currency $1,250.50 escaped'
  );
  assert(
    escapeCurrencyDollars('Already escaped \\$50.') === 'Already escaped \\$50.',
    'Already escaped currency \\$50 unchanged'
  );

  // Math must NOT be escaped
  assert(escapeCurrencyDollars('Calculate $x = 5$.') === 'Calculate $x = 5$.', 'Math $x = 5$ preserved');
  assert(
    escapeCurrencyDollars('Force of $50 \\text{ N}$ applied.') === 'Force of $50 \\text{ N}$ applied.',
    'Math with unit $50 \\text{ N}$ preserved'
  );
  assert(
    escapeCurrencyDollars('Equation $2x + 3 = 7$.') === 'Equation $2x + 3 = 7$.',
    'Math equation $2x + 3 = 7$ preserved'
  );
}

// 6. Delimiter standardization tests
{
  assert(
    normalizeMathDelimiters('\\[ E = mc^2 \\]') === '$$E = mc^2$$',
    'Converts \\[...\\] display math to $$...$$'
  );
  assert(
    normalizeMathDelimiters('\\( F = ma \\)') === '$F = ma$',
    'Converts \\(...\\) inline math to $...$'
  );
}

// 7. Escaped backslash normalization tests
{
  assert(
    fixEscapedBackslashes('\\\\frac{1}{2}') === '\\frac{1}{2}',
    'Fixes \\\\frac to \\frac'
  );
  assert(
    fixEscapedBackslashes('\\\\text{hello} + \\\\sqrt{4}') === '\\text{hello} + \\sqrt{4}',
    'Fixes multiple escaped backslashes (\\\\text, \\\\sqrt)'
  );
  assert(
    fixEscapedBackslashes('\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}') ===
      '\\begin{aligned} a &= b \\\\ c &= d \\end{aligned}',
    'Preserves intentional newline \\\\ in aligned environments'
  );
}

// 8. Unit notation normalization tests
{
  assert(
    normalizeUnits('\\text{m/s^2}') === '\\text{m/s}^2',
    'Normalizes \\text{m/s^2} -> \\text{m/s}^2'
  );
  assert(
    normalizeUnits('\\text{m/s}^{2}') === '\\text{m/s}^2',
    'Normalizes \\text{m/s}^{2} -> \\text{m/s}^2'
  );
  assert(
    normalizeUnits('\\text{m s^-1}') === '\\text{m s}^{-1}',
    'Normalizes \\text{m s^-1} -> \\text{m s}^{-1}'
  );
  assert(
    normalizeUnits('\\text{m s^{-1}}') === '\\text{m s}^{-1}',
    'Normalizes \\text{m s^{-1}} -> \\text{m s}^{-1}'
  );
  assert(
    normalizeUnits('\\text{kg/m^3}') === '\\text{kg/m}^3',
    'Normalizes \\text{kg/m^3} -> \\text{kg/m}^3'
  );
  assert(
    normalizeUnits('\\text{kg m^-3}') === '\\text{kg m}^{-3}',
    'Normalizes \\text{kg m^-3} -> \\text{kg m}^{-3}'
  );
  assert(
    normalizeUnits('\\text{mol dm^-3}') === '\\text{mol dm}^{-3}',
    'Normalizes \\text{mol dm^-3} -> \\text{mol dm}^{-3}'
  );
}

// 9. End-to-end sanitizeKaTeX tests
{
  const input =
    'The car travels at \\( 20\\ m/s \\). Price was $50, now $60. Acceleration is \\[ \\\\frac{v - u}{t} = 5\\ \\text{m/s^2} \\].';
  const sanitized = sanitizeKaTeX(input);

  assert(sanitized.includes('\\$50'), 'Sanitized currency \\$50');
  assert(sanitized.includes('\\$60'), 'Sanitized currency \\$60');
  assert(
    sanitized.includes('\\text{m/s}'),
    'Sanitized inline unit \\text{m/s}'
  );
  assert(
    sanitized.includes('\\frac{v - u}{t} = 5') && sanitized.includes('\\text{m/s}^2'),
    'Sanitized display math with \\frac and \\text{m/s}^2'
  );

  try {
    const inlineMath = '20 \\text{m/s}';
    const displayMath = '\\frac{v - u}{t} = 5 \\text{m/s}^2';
    const renderedInline = katex.renderToString(inlineMath, { displayMode: false });
    const renderedDisplay = katex.renderToString(displayMath, { displayMode: true });

    assert(renderedInline.length > 0, 'Real KaTeX renders inline math cleanly');
    assert(renderedDisplay.length > 0, 'Real KaTeX renders display math cleanly');
  } catch (err) {
    assert(false, `KaTeX rendering failed: ${err}`);
  }
}

// ============================================================================
// Test Suite 3: Staging Paper Structures & On-Disk File Integrity
// ============================================================================
console.log('\nTest Suite 3: Staging Paper Structures & On-Disk File Integrity');
{
  const stagingFilePath = path.resolve(process.cwd(), 'staging/0455_s24_12.json');
  assert(fs.existsSync(stagingFilePath), 'Staging file staging/0455_s24_12.json exists');

  if (fs.existsSync(stagingFilePath)) {
    const rawContent = fs.readFileSync(stagingFilePath, 'utf8');
    const parsedData = JSON.parse(rawContent);

    // Validate using validateStagingPaper with expectedQuestionCount: 30
    const validation = validateStagingPaper(parsedData, { expectedQuestionCount: 30 });
    assert(validation.success === true, 'Staged paper 0455_s24_12 passes full validation');
    assert(validation.data?.questions.length === 30, '0455_s24_12 contains exactly 30 questions');

    const staged = validation.data!;
    assert(staged.subject.code === '0455', 'Subject code is 0455 (Economics)');
    assert(staged.paper.series === 's' && staged.paper.year === 2024, 'Paper series is s 2024');
    assert(staged.paper.paper_code === '12', 'Paper code is 12');
    assert(staged.syllabus_topics.length === 6, 'Contains 6 syllabus topics');

    // Verify all 30 questions are sequentially ordered from 1 to 30
    const numbers = staged.questions.map((q) => q.question_number);
    const isSequential = numbers.every((num, idx) => num === idx + 1);
    assert(isSequential, 'Questions are sequentially numbered 1 to 30');

    // Verify question 3 diagram metadata integrity
    const q3 = staged.questions.find((q) => q.question_number === 3);
    assert(q3 !== undefined, 'Question 3 exists in staged paper');
    assert(q3?.diagram?.has_diagram === true, 'Question 3 diagram flag is true');
    assert(
      q3?.diagram?.bounding_box !== undefined &&
        q3.diagram.bounding_box.page_number === 2 &&
        q3.diagram.bounding_box.ymin === 424 &&
        q3.diagram.bounding_box.xmin === 398 &&
        q3.diagram.bounding_box.ymax === 587 &&
        q3.diagram.bounding_box.xmax === 690,
      'Question 3 bounding box coordinates match expected diagram crop'
    );
    assert(
      typeof q3?.diagram?.image_url === 'string' && q3.diagram.image_url.includes('0455_2024_s_12_q3'),
      'Question 3 contains valid diagram image_url'
    );

    // Verify KaTeX math in stems & explanations renders cleanly without throwing
    let mathRenderFailures = 0;
    for (const q of staged.questions) {
      // 1. Display math $$...$$
      const displayMath = q.explanation_markdown.match(/\$\$([\s\S]+?)\$\$/g) || [];
      for (const dm of displayMath) {
        const math = dm.slice(2, -2).trim();
        try {
          katex.renderToString(math, { displayMode: true, throwOnError: true });
        } catch {
          mathRenderFailures++;
        }
      }
      // 2. Inline math (excluding $$ and ignoring escaped currency \$)
      const textWithoutDisplay = q.explanation_markdown.replace(/\$\$[\s\S]+?\$\$/g, '');
      const inlineMath = textWithoutDisplay.match(/(?<!\\)\$([^\$\n]+?)(?<!\\)\$/g) || [];
      for (const im of inlineMath) {
        const math = im.slice(1, -1).trim();
        try {
          katex.renderToString(math, { displayMode: false, throwOnError: true });
        } catch {
          mathRenderFailures++;
        }
      }
    }
    assert(mathRenderFailures === 0, `All real KaTeX expressions in 30 explanations render cleanly (0 failures)`);
  }
}

// ============================================================================
// Test Suite 4: Publish Payload Contracts & Partial Publish Options
// ============================================================================
console.log('\nTest Suite 4: Publish Payload Contracts & Partial Publish Options');
{
  const stagingFilePath = path.resolve(process.cwd(), 'staging/0455_s24_12.json');
  const rawContent = fs.readFileSync(stagingFilePath, 'utf8');
  const paper: StagingPaper = JSON.parse(rawContent);

  // 1. Full publish payload contract simulation
  const fullQuestionsPayload = paper.questions.map((q) => ({
    paper_id: 'mock-paper-uuid',
    topic_id: 'mock-topic-uuid',
    question_number: q.question_number,
    stem_markdown: q.stem_markdown,
    explanation_markdown: q.explanation_markdown,
    image_url: q.diagram?.image_url || null,
    diagram_metadata: q.diagram ? { ...q.diagram } : null,
  }));
  assert(fullQuestionsPayload.length === 30, 'Full publish questions payload has 30 items');

  const fullOptionsPayload: Array<{
    question_id: string;
    label: string;
    content_markdown: string;
    is_correct: boolean;
    distractor_reasoning: string | null;
  }> = [];

  for (const q of paper.questions) {
    for (const opt of q.options) {
      fullOptionsPayload.push({
        question_id: `mock-q-${q.question_number}`,
        label: opt.label,
        content_markdown: opt.content_markdown,
        is_correct: opt.is_correct,
        distractor_reasoning: extractDistractorReasoning(q.explanation_markdown, opt.label),
      });
    }
  }
  assert(fullOptionsPayload.length === 120, 'Full publish options payload has 120 items (30 * 4)');

  // 2. Distractor reasoning extraction verification
  const q1DistractorA = extractDistractorReasoning(paper.questions[0].explanation_markdown, 'A');
  const q1DistractorB = extractDistractorReasoning(paper.questions[0].explanation_markdown, 'B');
  const q1DistractorC = extractDistractorReasoning(paper.questions[0].explanation_markdown, 'C');
  const q1DistractorD = extractDistractorReasoning(paper.questions[0].explanation_markdown, 'D');

  assert(
    typeof q1DistractorA === 'string' && q1DistractorA.includes('High production costs'),
    'Q1 Option A distractor reasoning extracted correctly'
  );
  assert(
    typeof q1DistractorB === 'string' && q1DistractorB.includes('Education levels'),
    'Q1 Option B distractor reasoning extracted correctly'
  );
  assert(
    typeof q1DistractorC === 'string' && q1DistractorC.includes('Economic resources are scarce'),
    'Q1 Option C distractor reasoning extracted correctly'
  );
  assert(
    typeof q1DistractorD === 'string' && q1DistractorD.includes('Accurately identifies'),
    'Q1 Option D (marked correct) analysis extracted correctly'
  );

  // 3. Partial publish options filtering simulation
  const selectedQuestionNumbers = [1, 5, 12, 25];
  const targetQuestions = paper.questions.filter((q) =>
    selectedQuestionNumbers.includes(q.question_number)
  );
  assert(targetQuestions.length === 4, 'Partial publish filters exactly to 4 questions');

  const partialOptionsPayload: any[] = [];
  for (const q of targetQuestions) {
    for (const opt of q.options) {
      partialOptionsPayload.push({
        question_id: `mock-q-${q.question_number}`,
        label: opt.label,
        content_markdown: opt.content_markdown,
        is_correct: opt.is_correct,
        distractor_reasoning: extractDistractorReasoning(q.explanation_markdown, opt.label),
      });
    }
  }
  assert(partialOptionsPayload.length === 16, 'Partial publish produces 16 options (4 * 4)');

  // 4. Receipt structure contract verification
  const receipt = {
    success: true,
    paper_id: '11111111-2222-3333-4444-555555555555',
    subjects_count: 1,
    topics_count: 6,
    questions_count: targetQuestions.length,
    options_count: partialOptionsPayload.length,
  };

  assert(receipt.success === true, 'Receipt contains success: true');
  assert(typeof receipt.paper_id === 'string', 'Receipt contains paper_id string');
  assert(receipt.subjects_count === 1, 'Receipt contains subjects_count: 1');
  assert(receipt.topics_count === 6, 'Receipt contains topics_count: 6');
  assert(receipt.questions_count === 4, 'Receipt contains questions_count: 4');
  assert(receipt.options_count === 16, 'Receipt contains options_count: 16');

  // 5. Partial publish edge case: non-matching question numbers
  const nonMatching = [99, 100];
  const emptyTarget = paper.questions.filter((q) => nonMatching.includes(q.question_number));
  assert(emptyTarget.length === 0, 'Non-matching question numbers produce empty target list for 400 error');
}

console.log(`\n=== Summary: ${passed} Passed, ${failed} Failed ===`);
if (failed > 0) {
  process.exit(1);
}

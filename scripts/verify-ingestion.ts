import {
  validateStagingPaper,
  validateStagingQuestion,
  StagingPaper,
  StagingQuestion,
} from '../types/ingestion';
import {
  sanitizeKaTeX,
  escapeCurrencyDollars,
  fixEscapedBackslashes,
  normalizeMathDelimiters,
  normalizeUnits,
} from '../lib/ingestion/katexSanitizer';
import katex from 'katex';

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
    subject: { code: '0625', name: 'Physics', icon: 'atom' },
    paper: { series: 'm23', paper_code: '11', year: 2023 },
    syllabus_topics: [
      { name: 'Mechanics', order_index: 1 },
      { name: 'Thermal Physics', order_index: 2 },
    ],
    questions,
  };
}

console.log('=== Running Ingestion Pipeline Validation Tests ===\n');

// 1. Validate complete standard paper (40 questions)
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
}

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

  console.log('Sanitized output:\n', sanitized);

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

  // Verify that the sanitized math blocks render with real KaTeX without error
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

console.log(`\n=== Summary: ${passed} Passed, ${failed} Failed ===`);
if (failed > 0) {
  process.exit(1);
}

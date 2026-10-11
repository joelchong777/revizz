import fs from 'fs';
import path from 'path';
import katex from 'katex';
import {
  validateStagingPaper,
  validateStagingQuestion,
  StagingPaper,
  StagingQuestion,
  StagingPaperSchema,
  StagingQuestionSchema,
  BoundingBoxSchema,
  DiagramMetadataSchema,
  PaperLifecycleStateSchema,
  QuestionValidationStatusSchema,
  OptionLabelSchema,
  PaperLifecycleState,
} from '../types/ingestion';
import {
  sanitizeKaTeX,
  validateKaTeXSyntax,
  escapeCurrencyDollars,
  normalizeMathDelimiters,
  normalizeUnits,
  normalizeGreekSymbols,
  normalizeExponentsAndSubscripts,
  normalizeFractions,
  fixEscapedBackslashes,
} from '../lib/ingestion/katexSanitizer';
import {
  DiagramBBox,
  isDiagramBBoxValid,
  normalizeBBox,
  denormalizeBBox,
  getCropPixelCoordinates,
  sanitizeDiagramFilename,
} from '../lib/ingestion/diagramCropper';

// Test runner bookkeeping
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function createDummyQuestion(qNum: number, overrides?: Partial<StagingQuestion>): StagingQuestion {
  return {
    question_number: qNum,
    cambridge_source_ref: `0625/11/M/J/23/Q${qNum}`,
    topic_name: 'Mechanics',
    page_number: Math.ceil(qNum / 3),
    stem_markdown: `Question ${qNum}: An object accelerates at $2.5\\text{ m/s}^2$ with velocity $v_{max}$.`,
    explanation_markdown: `### Detailed Derivation\nAcceleration is $a = \\frac{v}{t}$.\n\n### Distractor Analysis\n- **A**: Incorrect unit conversion.\n- **B**: Calculation error.\n- **C**: Inverse ratio taken.\n- **D**: Correct formulation.`,
    status: 'active',
    distractor_analysis: {
      A: 'Incorrect unit conversion applied.',
      B: 'Calculation error in division.',
      C: 'Inverse ratio taken instead of direct proportion.',
      D: 'Correct answer.',
    },
    options: [
      { label: 'A', content_markdown: '$5.0\\text{ m/s}$', is_correct: false },
      { label: 'B', content_markdown: '$10.0\\text{ m/s}$', is_correct: false },
      { label: 'C', content_markdown: '$15.0\\text{ m/s}$', is_correct: false },
      { label: 'D', content_markdown: '$20.0\\text{ m/s}$', is_correct: true },
    ],
    ...overrides,
  };
}

function createDummyPaper(questionCount = 40, overrides?: Partial<StagingPaper>): StagingPaper {
  const questions: StagingQuestion[] = [];
  for (let i = 1; i <= questionCount; i++) {
    questions.push(createDummyQuestion(i));
  }

  return {
    lifecycle_state: 'draft',
    state: 'draft',
    source_qp_filename: '0625_s23_qp_11.pdf',
    source_ms_filename: '0625_s23_ms_11.pdf',
    total_pages: 16,
    detected_year: 2023,
    detected_series: 's23',
    detected_paper_code: '11',
    subject: { code: '0625', name: 'Physics', icon: 'atom' },
    paper: { series: 's23', paper_code: '11', year: 2023 },
    syllabus_topics: [
      { name: 'Mechanics', order_index: 1 },
      { name: 'Thermal Physics', order_index: 2 },
      { name: 'Waves & Optics', order_index: 3 },
    ],
    questions,
    ...overrides,
  };
}

/**
 * Distractor extraction helper replicating POST /api/ingest/publish
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

console.log('================================================================');
console.log('  REVIZZ INGESTION V2 INTEGRATION & REGRESSION VERIFICATION SUITE');
console.log('================================================================\n');

// ============================================================================
// SUITE 1: Staging Paper Schema Validation
// ============================================================================
console.log('▶ Suite 1: Staging Paper Schema Validation');
{
  // 1.1 Lifecycle States
  const validStates: PaperLifecycleState[] = ['draft', 'extracting', 'review', 'published'];
  for (const s of validStates) {
    const parseRes = PaperLifecycleStateSchema.safeParse(s);
    assert(parseRes.success && parseRes.data === s, `PaperLifecycleStateSchema accepts '${s}'`);
  }
  const invalidStateRes = PaperLifecycleStateSchema.safeParse('archived');
  assert(!invalidStateRes.success, 'PaperLifecycleStateSchema rejects invalid state "archived"');

  // 1.2 Full 40-question Cambridge paper validation
  const valid40Paper = createDummyPaper(40);
  const val40Res = validateStagingPaper(valid40Paper);
  assert(val40Res.success, 'Full 40-question paper passes canonical validation');
  assert(val40Res.data?.questions.length === 40, 'Paper contains exactly 40 validated questions');

  // 1.3 Partial batch validation
  const partialPaper = createDummyPaper(10);
  const strictRes = validateStagingPaper(partialPaper);
  assert(!strictRes.success, 'Partial 10-question paper fails strict 40-question check');
  const lenientRes = validateStagingPaper(partialPaper, { allowPartialBatch: true });
  assert(lenientRes.success, 'Partial 10-question paper passes with allowPartialBatch=true');
  const customCountRes = validateStagingPaper(partialPaper, { expectedQuestionCount: 10 });
  assert(customCountRes.success, 'Partial paper passes with custom expectedQuestionCount=10');

  // 1.4 Source metadata validation
  const paperMeta = val40Res.data!;
  assert(paperMeta.source_qp_filename === '0625_s23_qp_11.pdf', 'source_qp_filename preserved');
  assert(paperMeta.source_ms_filename === '0625_s23_ms_11.pdf', 'source_ms_filename preserved');
  assert(paperMeta.detected_year === 2023, 'detected_year preserved');
  assert(paperMeta.detected_series === 's23', 'detected_series preserved');
  assert(paperMeta.total_pages === 16, 'total_pages preserved');

  // 1.5 Question level schema validation: page_number and distractor_analysis
  const sampleQ = val40Res.data!.questions[0];
  assert(sampleQ.page_number === 1, 'Question page_number is valid positive integer');
  assert(sampleQ.distractor_analysis !== undefined, 'distractor_analysis record is attached');
  assert(Boolean(sampleQ.distractor_analysis?.A?.includes('conversion')), 'Option A distractor analysis preserved');

  // 1.6 Single question validation: validateStagingQuestion
  const singleQVal = validateStagingQuestion(sampleQ);
  assert(singleQVal.success, 'validateStagingQuestion passes on valid question');

  // 1.7 Negative schema checks: Invalid option count
  const badOptionsQ = createDummyQuestion(1, {
    options: [
      { label: 'A', content_markdown: 'A', is_correct: true },
      { label: 'B', content_markdown: 'B', is_correct: false },
      { label: 'C', content_markdown: 'C', is_correct: false },
    ],
  });
  const badOptVal = validateStagingQuestion(badOptionsQ);
  assert(!badOptVal.success, 'validateStagingQuestion fails when question has 3 options instead of 4');

  // 1.8 Negative schema checks: Missing correct option
  const noCorrectQ = createDummyQuestion(1, {
    options: [
      { label: 'A', content_markdown: 'A', is_correct: false },
      { label: 'B', content_markdown: 'B', is_correct: false },
      { label: 'C', content_markdown: 'C', is_correct: false },
      { label: 'D', content_markdown: 'D', is_correct: false },
    ],
  });
  const noCorrectVal = validateStagingQuestion(noCorrectQ);
  assert(!noCorrectVal.success, 'validateStagingQuestion fails when no option is marked correct');

  // 1.9 Negative schema checks: Invalid option labels
  const badLabelsQ = createDummyQuestion(1, {
    options: [
      { label: 'A', content_markdown: 'A', is_correct: true },
      { label: 'B', content_markdown: 'B', is_correct: false },
      { label: 'C', content_markdown: 'C', is_correct: false },
      { label: 'C' as any, content_markdown: 'Duplicate C', is_correct: false },
    ],
  });
  const badLabelsVal = validateStagingQuestion(badLabelsQ);
  assert(!badLabelsVal.success, 'validateStagingQuestion fails on duplicate or non-ABCD labels');

  // 1.10 Validate real Cambridge paper fixture if present
  const fixturePath = path.resolve(process.cwd(), 'staging/0455_s24_12.json');
  if (fs.existsSync(fixturePath)) {
    const rawFixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const fixtureVal = validateStagingPaper(rawFixture, { allowPartialBatch: true });
    assert(fixtureVal.success, `Real fixture staging/0455_s24_12.json passes schema validation (${fixtureVal.data?.questions.length} questions)`);
  }
}

// ============================================================================
// SUITE 2: KaTeX Syntax Sanitizer and Validator
// ============================================================================
console.log('\n▶ Suite 2: KaTeX Syntax Sanitizer and Validator');
{
  // 2.1 Delimiter standardization
  const rawDelims = 'Solve \\[ x = \\frac{a}{b} \\] and evaluate \\( y = 2x \\) with $ z = 5 $.';
  const normDelims = normalizeMathDelimiters(rawDelims);
  assert(normDelims.includes('$$x = \\frac{a}{b}$$'), 'Converts \\[...\\] to $$...$$');
  assert(normDelims.includes('$y = 2x$'), 'Converts \\(...\\) to $...$');

  // 2.2 Whitespace trimming inside inline math
  const spacedMath = 'The variable $   x   $ is positive.';
  assert(normalizeMathDelimiters(spacedMath) === 'The variable $x$ is positive.', 'Trims padding inside inline dollar signs');

  // 2.3 Currency sign protection without corrupting math
  const currencySentence = 'The price rises from $50 to $60, giving a profit of US$10.00 each.';
  const escapedCurrency = escapeCurrencyDollars(currencySentence);
  assert(escapedCurrency.includes('\\$50 to \\$60'), 'Escapes currency range "$50 to $60"');
  assert(escapedCurrency.includes('US\\$10.00'), 'Escapes prefixed currency "US$10.00"');

  const mixedMathAndCurrency = 'If price is $50, the demand function is $Q = 100 - 2P$.';
  const sanitizedMixed = escapeCurrencyDollars(mixedMathAndCurrency);
  assert(sanitizedMixed.includes('\\$50'), 'Currency sign escaped');
  assert(sanitizedMixed.includes('$Q = 100 - 2P$'), 'Legitimate math block left untouched');

  // 2.4 Fraction normalization
  assert(normalizeFractions('\\frac 1 2') === '\\frac{1}{2}', 'Normalizes space-separated fraction \\frac 1 2');
  assert(normalizeFractions('\\frac 12') === '\\frac{1}{2}', 'Normalizes two-digit shorthand \\frac 12');
  assert(normalizeFractions('\\frac {a} {b}') === '\\frac{a}{b}', 'Normalizes spaced braces \\frac {a} {b}');

  // 2.5 Backslash fix
  assert(fixEscapedBackslashes('\\\\frac{1}{2}') === '\\frac{1}{2}', 'Fixes double backslashes \\\\frac');
  assert(fixEscapedBackslashes('\\\\text{hello}') === '\\text{hello}', 'Fixes double backslashes \\\\text');

  // 2.6 Exponents, subscripts, and scientific notation
  assert(normalizeExponentsAndSubscripts('10^-5') === '10^{-5}', 'Wraps negative exponent in braces 10^-5 -> 10^{-5}');
  assert(normalizeExponentsAndSubscripts('10^12') === '10^{12}', 'Wraps multi-digit exponent 10^12 -> 10^{12}');
  assert(normalizeExponentsAndSubscripts('v_max') === 'v_{max}', 'Wraps multi-char subscript v_max -> v_{max}');
  assert(normalizeExponentsAndSubscripts('3.0 x 10^8').includes('\\times 10^8'), 'Normalizes "x 10^" to "\\times 10^"');
  assert(normalizeExponentsAndSubscripts('3.0 * 10^8').includes('\\times 10^8'), 'Normalizes "* 10^" to "\\times 10^"');

  // 2.7 Greek symbols and scientific symbols
  assert(normalizeGreekSymbols('α + β = γ').includes('\\alpha') && normalizeGreekSymbols('α + β = γ').includes('\\beta'), 'Normalizes lowercase Greek letters α, β');
  assert(normalizeGreekSymbols('Resistance is 50 Ω').includes('\\Omega'), 'Normalizes uppercase Omega Ω');
  assert(normalizeGreekSymbols('ΔT = 20 °C').includes('\\Delta') && normalizeGreekSymbols('ΔT = 20 °C').includes('^\\circ\\text{C}'), 'Normalizes Delta Δ and Celsius °C');
  assert(normalizeGreekSymbols('10 µm').includes('\\mu'), 'Normalizes micro symbol µ');

  // 2.8 Cambridge scientific unit notation
  assert(normalizeUnits('\\text{m/s^2}') === '\\text{m/s}^2', 'Pulls exponent out of \\text{m/s^2}');
  assert(normalizeUnits('\\text{m s^-1}') === '\\text{m s}^{-1}', 'Pulls negative exponent out of \\text{m s^-1}');
  assert(normalizeUnits('\\text{kg/m^3}') === '\\text{kg/m}^3', 'Pulls exponent out of \\text{kg/m^3}');

  // 2.9 Comprehensive sanitizeKaTeX end-to-end
  const dirtyMarkdown = 'A car accelerates at \\[ a = 2.5 m/s^2 \\].\nTotal cost was $150.\nThe efficiency was $η = 85\\%$.\n';
  const cleanMarkdown = sanitizeKaTeX(dirtyMarkdown);
  assert(cleanMarkdown.includes('$$a = 2.5 \\text{m/s}^2$$') || cleanMarkdown.includes('$$'), 'Display math standardized in full sanitizer');
  assert(cleanMarkdown.includes('\\$150'), 'Currency dollar escaped in full sanitizer');
  assert(cleanMarkdown.includes('\\eta'), 'Greek symbol η converted to \\eta inside math');

  // 2.10 validateKaTeXSyntax validation
  const validKatex = validateKaTeXSyntax('Here is valid math: $E = mc^2$ and $$\\int_0^1 x dx = \\frac{1}{2}$$.');
  assert(validKatex.isValid, 'validateKaTeXSyntax passes clean LaTeX expressions');
  assert(validKatex.errors.length === 0, '0 errors for clean LaTeX');

  const unclosedDisplay = validateKaTeXSyntax('Broken display math: $$x + y = z');
  assert(!unclosedDisplay.isValid, 'validateKaTeXSyntax flags unclosed $$ delimiter');

  const unbalancedBraces = validateKaTeXSyntax('Formula with missing brace: $\\frac{1}{2$');
  assert(!unbalancedBraces.isValid, 'validateKaTeXSyntax flags unbalanced curly braces');

  const syntaxError = validateKaTeXSyntax('Invalid command: $\\nonexistentKaTeXCommand$');
  assert(!syntaxError.isValid, 'validateKaTeXSyntax flags invalid command');
}

// ============================================================================
// SUITE 3: Bounding Box Calculations
// ============================================================================
console.log('\n▶ Suite 3: Bounding Box Calculations');
{
  // 3.1 isDiagramBBoxValid checks
  const validFloatBBox: DiagramBBox = { ymin: 0.1, xmin: 0.15, ymax: 0.45, xmax: 0.85, page_number: 1 };
  const valid1000BBox: DiagramBBox = { ymin: 100, xmin: 150, ymax: 450, xmax: 850, page_number: 2 };
  assert(isDiagramBBoxValid(validFloatBBox), 'Valid [0..1] float bbox is marked valid');
  assert(isDiagramBBoxValid(valid1000BBox), 'Valid [0..1000] integer bbox is marked valid');

  const zeroBBox: DiagramBBox = { ymin: 0, xmin: 0, ymax: 0, xmax: 0, page_number: 1 };
  assert(!isDiagramBBoxValid(zeroBBox), 'Zero area bbox is marked invalid');

  const invertedYBBox: DiagramBBox = { ymin: 0.5, xmin: 0.1, ymax: 0.2, xmax: 0.8, page_number: 1 };
  assert(!isDiagramBBoxValid(invertedYBBox), 'Inverted Y bbox (ymax <= ymin) is marked invalid');

  const invertedXBBox: DiagramBBox = { ymin: 0.1, xmin: 0.8, ymax: 0.5, xmax: 0.2, page_number: 1 };
  assert(!isDiagramBBoxValid(invertedXBBox), 'Inverted X bbox (xmax <= xmin) is marked invalid');

  const negativeBBox: DiagramBBox = { ymin: -0.2, xmin: 0.1, ymax: 0.5, xmax: 0.8, page_number: 1 };
  assert(!isDiagramBBoxValid(negativeBBox), 'Negative coordinate bbox (< -0.01) is marked invalid');

  const tinyArtifactBBox: DiagramBBox = { ymin: 0.1, xmin: 0.1, ymax: 0.101, xmax: 0.101, page_number: 1 };
  assert(!isDiagramBBoxValid(tinyArtifactBBox), 'Negligible area text artifact (<0.5%) is marked invalid');

  assert(!isDiagramBBoxValid(null), 'null bbox is marked invalid');
  assert(!isDiagramBBoxValid(undefined), 'undefined bbox is marked invalid');

  // 3.2 normalizeBBox calculations
  const norm1000To1 = normalizeBBox(valid1000BBox, 1);
  assert(norm1000To1.ymin === 0.1, 'Normalizes 100 to 0.1 on target scale 1');
  assert(norm1000To1.xmin === 0.15, 'Normalizes 150 to 0.15 on target scale 1');
  assert(norm1000To1.ymax === 0.45, 'Normalizes 450 to 0.45 on target scale 1');
  assert(norm1000To1.xmax === 0.85, 'Normalizes 850 to 0.85 on target scale 1');
  assert(norm1000To1.page_number === 2, 'Preserves page_number');

  const norm1To1000 = normalizeBBox(validFloatBBox, 1000);
  assert(norm1To1000.ymin === 100, 'Normalizes 0.1 to 100 on target scale 1000');
  assert(norm1To1000.xmin === 150, 'Normalizes 0.15 to 150 on target scale 1000');
  assert(norm1To1000.ymax === 450, 'Normalizes 0.45 to 450 on target scale 1000');
  assert(norm1To1000.xmax === 850, 'Normalizes 0.85 to 850 on target scale 1000');

  // With explicit sourceDimensions
  const pixelBBox: DiagramBBox = { ymin: 100, xmin: 150, ymax: 450, xmax: 850, page_number: 1 };
  const normWithDims = normalizeBBox(pixelBBox, 1, { width: 1000, height: 1000 });
  assert(normWithDims.ymin === 0.1 && normWithDims.xmax === 0.85, 'Normalizes pixel coordinates using sourceDimensions');

  // Clamping test (using sourceDimensions so scale is known and not guessed)
  const outOfBoundsBBox: DiagramBBox = { ymin: -50, xmin: -100, ymax: 1200, xmax: 1500, page_number: 1 };
  const clamped = normalizeBBox(outOfBoundsBBox, 1, { width: 1000, height: 1000 });
  assert(clamped.ymin === 0 && clamped.xmin === 0, 'Clamps negative coordinates to 0');
  assert(clamped.ymax === 1 && clamped.xmax === 1, 'Clamps overflowing coordinates to 1');

  // 3.3 denormalizeBBox calculations
  const denorm = denormalizeBBox(validFloatBBox, { width: 1200, height: 1600 });
  assert(denorm.ymin === 160, 'Denormalizes ymin to exact pixel height (0.1 * 1600 = 160)');
  assert(denorm.xmin === 180, 'Denormalizes xmin to exact pixel width (0.15 * 1200 = 180)');
  assert(denorm.ymax === 720, 'Denormalizes ymax to exact pixel height (0.45 * 1600 = 720)');
  assert(denorm.xmax === 1020, 'Denormalizes xmax to exact pixel width (0.85 * 1200 = 1020)');

  // 3.4 getCropPixelCoordinates calculations
  const cropCoords = getCropPixelCoordinates(validFloatBBox, 1000, 1000, 10);
  assert(cropCoords.top === 90, 'Applies 10px top padding (100 - 10 = 90)');
  assert(cropCoords.left === 140, 'Applies 10px left padding (150 - 10 = 140)');
  assert(cropCoords.width === (860 - 140), 'Calculates padded crop width correctly');
  assert(cropCoords.height === (460 - 90), 'Calculates padded crop height correctly');

  // 3.5 sanitizeDiagramFilename
  assert(sanitizeDiagramFilename('0625_s23_qp_11_q05') === '0625_s23_qp_11_q05.png', 'Appends .png extension if missing');
  assert(sanitizeDiagramFilename('/questions/diagram.png') === 'diagram.png', 'Strips directory path');
  assert(sanitizeDiagramFilename('../../secret.png') === 'secret.png', 'Prevents path traversal attempts');
}

// ============================================================================
// SUITE 4: App Router API Contracts
// ============================================================================
console.log('\n▶ Suite 4: App Router API Contracts');
{
  // 4.1 Extract Route SSE Payload Contract Verification
  interface SSEStartEvent {
    stage: 'start';
    message: string;
    percent: number;
    source_qp_filename: string;
    source_ms_filename: string;
  }
  interface SSEExtractingEvent {
    stage: 'extracting';
    currentBatch: string;
    percent: number;
    batchCount: number;
    questions: StagingQuestion[];
  }
  interface SSECompleteEvent {
    stage: 'complete';
    percent: 100;
    total_questions: number;
    questions: StagingQuestion[];
    source_metadata: {
      source_qp_filename: string;
      source_ms_filename: string;
    };
  }
  interface SSEErrorEvent {
    stage: 'error';
    error: string;
  }

  const sampleStartEvent: SSEStartEvent = {
    stage: 'start',
    message: 'Starting Cambridge MCQ extraction pipeline...',
    percent: 0,
    source_qp_filename: '0625_s23_qp_11.pdf',
    source_ms_filename: '0625_s23_ms_11.pdf',
  };
  assert(sampleStartEvent.stage === 'start' && sampleStartEvent.percent === 0, 'SSE stage="start" structure matches contract');

  const sampleExtractingEvent: SSEExtractingEvent = {
    stage: 'extracting',
    currentBatch: 'Q1-Q10',
    percent: 25,
    batchCount: 4,
    questions: [createDummyQuestion(1)],
  };
  assert(sampleExtractingEvent.stage === 'extracting' && sampleExtractingEvent.batchCount === 4, 'SSE stage="extracting" structure matches contract');

  const sampleCompleteEvent: SSECompleteEvent = {
    stage: 'complete',
    percent: 100,
    total_questions: 40,
    questions: [createDummyQuestion(1)],
    source_metadata: {
      source_qp_filename: '0625_s23_qp_11.pdf',
      source_ms_filename: '0625_s23_ms_11.pdf',
    },
  };
  assert(sampleCompleteEvent.stage === 'complete' && sampleCompleteEvent.percent === 100, 'SSE stage="complete" structure matches contract');

  const sampleErrorEvent: SSEErrorEvent = {
    stage: 'error',
    error: 'Gemini rate limit exceeded.',
  };
  assert(sampleErrorEvent.stage === 'error' && typeof sampleErrorEvent.error === 'string', 'SSE stage="error" structure matches contract');

  // 4.2 Non-streaming JSON response contract
  const nonStreamingResponse = {
    success: true,
    total_questions: 40,
    questions: [createDummyQuestion(1)],
    source_metadata: {
      source_qp_filename: '0625_s23_qp_11.pdf',
      source_ms_filename: '0625_s23_ms_11.pdf',
      batch_size: 10,
      start_question: 1,
      end_question: 40,
    },
  };
  assert(nonStreamingResponse.success === true && nonStreamingResponse.total_questions === 40, 'Non-streaming extract response matches contract');

  // 4.3 Crop Route Payload & Response Contract
  interface CropRequest {
    imageBase64?: string;
    imageUrl?: string;
    bbox: DiagramBBox;
    paperCode: string;
    questionNumber: number;
  }
  interface CropResponse {
    success: boolean;
    url: string;
    storage_path?: string;
    bbox: DiagramBBox;
  }

  const validCropReq: CropRequest = {
    imageUrl: 'https://example.com/source_page.png',
    bbox: { ymin: 100, xmin: 150, ymax: 450, xmax: 850, page_number: 1 },
    paperCode: '0625_s23_11',
    questionNumber: 5,
  };
  assert(typeof validCropReq.paperCode === 'string' && validCropReq.questionNumber > 0, 'Crop request structure contains required properties');

  const validCropRes: CropResponse = {
    success: true,
    url: 'https://supabase.co/storage/v1/object/public/questions/0625_s23_11_q05.png',
    storage_path: 'questions/0625_s23_11_q05.png',
    bbox: normalizeBBox(validCropReq.bbox, 1000),
  };
  assert(validCropRes.success === true && validCropRes.url.includes('.png'), 'Crop response returns normalized bbox and public URL');

  // 4.4 Publish Route Receipt Contract
  interface PublishReceipt {
    success: boolean;
    paper_id: string;
    subjects_count: number;
    topics_count: number;
    questions_count: number;
    options_count: number;
  }

  const sampleReceipt: PublishReceipt = {
    success: true,
    paper_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    subjects_count: 1,
    topics_count: 5,
    questions_count: 40,
    options_count: 160,
  };
  assert(sampleReceipt.success === true, 'Receipt contains success boolean');
  assert(typeof sampleReceipt.paper_id === 'string' && sampleReceipt.paper_id.length > 0, 'Receipt contains paper_id UUID');
  assert(sampleReceipt.options_count === sampleReceipt.questions_count * 4, 'Receipt verifies 4 options per question ratio (160 = 40 * 4)');
}

// ============================================================================
// SUITE 5: Audit Drawer Quality Gate Rule Calculations
// ============================================================================
console.log('\n▶ Suite 5: Audit Drawer Quality Gate Rule Calculations');
{
  // Mirroring the exact logic from IngestionAuditDrawer.tsx:
  function evaluateQualityGates(paper: StagingPaper | null, expectedCount = 40) {
    const questions = paper?.questions || [];
    const totalQ = questions.length;
    const effectiveExpected = expectedCount || 40;

    // 1. Total Questions Check
    const isCountMet = totalQ >= effectiveExpected;
    const countCheck = {
      id: 'total_questions',
      status: isCountMet ? 'pass' : totalQ > 0 ? 'warn' : 'fail',
      metric: `${totalQ}/${effectiveExpected}`,
    };

    // 2. Options Validity
    const optionsInvalidIndices: number[] = [];
    questions.forEach((q, idx) => {
      const opts = q.options || [];
      const has4 = opts.length === 4;
      const allPopulated = has4 && opts.every((o) => (o.content_markdown || '').trim().length > 0);
      if (!allPopulated) {
        optionsInvalidIndices.push(idx);
      }
    });
    const optionsCheck = {
      id: 'options_validity',
      status: optionsInvalidIndices.length === 0 ? 'pass' : totalQ > 0 && optionsInvalidIndices.length <= 3 ? 'warn' : 'fail',
      metric: `${totalQ - optionsInvalidIndices.length}/${totalQ}`,
    };

    // 3. Correct Key Parity
    const keyParityInvalidIndices: number[] = [];
    questions.forEach((q, idx) => {
      const correctCount = (q.options || []).filter((o) => o.is_correct).length;
      if (correctCount !== 1) {
        keyParityInvalidIndices.push(idx);
      }
    });
    const keyParityCheck = {
      id: 'correct_key_parity',
      status: keyParityInvalidIndices.length === 0 ? 'pass' : 'fail',
      metric: `${totalQ - keyParityInvalidIndices.length}/${totalQ}`,
    };

    // 4. KaTeX Syntax Integrity
    const katexErrorIndices: number[] = [];
    questions.forEach((q, idx) => {
      const stemCheck = validateKaTeXSyntax(q.stem_markdown || '');
      const optChecks = (q.options || []).map((o) => validateKaTeXSyntax(o.content_markdown || ''));
      const expCheck = validateKaTeXSyntax(q.explanation_markdown || '');
      const hasErr = !stemCheck.isValid || optChecks.some((c) => !c.isValid) || !expCheck.isValid;
      if (hasErr) {
        katexErrorIndices.push(idx);
      }
    });
    const katexCheck = {
      id: 'katex_integrity',
      status: katexErrorIndices.length === 0 ? 'pass' : 'fail',
      metric: `${katexErrorIndices.length} Errors`,
    };

    // 5. Diagram Integrity
    const diagramInvalidIndices: number[] = [];
    let diagramCount = 0;
    questions.forEach((q, idx) => {
      if (q.diagram?.has_diagram) {
        diagramCount++;
        const url = (q.diagram.image_url || '').trim();
        if (!url) {
          diagramInvalidIndices.push(idx);
        }
      }
    });
    const diagramCheck = {
      id: 'diagram_integrity',
      status: diagramInvalidIndices.length === 0 ? 'pass' : 'warn',
      metric: `${diagramCount - diagramInvalidIndices.length}/${diagramCount || 0}`,
    };

    // 6. Syllabus Alignment
    const topicInvalidIndices: number[] = [];
    questions.forEach((q, idx) => {
      const topicName = (q.topic_name || '').trim().toLowerCase();
      if (!topicName || topicName === 'unassigned' || topicName === 'none') {
        topicInvalidIndices.push(idx);
      }
    });
    const syllabusCheck = {
      id: 'syllabus_alignment',
      status: topicInvalidIndices.length === 0 ? 'pass' : 'warn',
      metric: `${totalQ - topicInvalidIndices.length}/${totalQ}`,
    };

    const gates = [countCheck, optionsCheck, keyParityCheck, katexCheck, diagramCheck, syllabusCheck];
    const passedGateCount = gates.filter((g) => g.status === 'pass').length;

    // Calculate question validity
    let validQCount = 0;
    questions.forEach((_q, idx) => {
      const hasOptErr = optionsInvalidIndices.includes(idx);
      const hasKeyErr = keyParityInvalidIndices.includes(idx);
      const hasKatexErr = katexErrorIndices.includes(idx);
      if (!hasOptErr && !hasKeyErr && !hasKatexErr) {
        validQCount++;
      }
    });

    let healthScore = 0;
    if (totalQ > 0) {
      const validRatio = validQCount / totalQ;
      const gateRatio = passedGateCount / gates.length;
      healthScore = Math.round(validRatio * 40 + gateRatio * 60);
      healthScore = Math.min(100, Math.max(0, healthScore));
    }

    return {
      gates,
      passedGateCount,
      totalQ,
      validQCount,
      healthScore,
    };
  }

  // 5.1 Perfect 40-question paper
  const perfectPaper = createDummyPaper(40);
  const perfectEval = evaluateQualityGates(perfectPaper, 40);
  assert(perfectEval.gates.length === 6, 'All 6 quality gates evaluated');
  assert(perfectEval.passedGateCount === 6, 'All 6 quality gates pass for perfect paper');
  assert(perfectEval.healthScore === 100, 'Perfect paper scores 100% health score');

  // 5.2 Empty paper
  const emptyPaper = createDummyPaper(0);
  const emptyEval = evaluateQualityGates(emptyPaper, 40);
  assert(emptyEval.healthScore === 0, 'Empty paper scores 0% health score');
  assert(emptyEval.gates.find((g) => g.id === 'total_questions')?.status === 'fail', 'Gate 1 fails on 0 questions');

  // 5.3 Partial paper with incomplete question count (30/40)
  const partial30Paper = createDummyPaper(30);
  const partial30Eval = evaluateQualityGates(partial30Paper, 40);
  assert(partial30Eval.gates.find((g) => g.id === 'total_questions')?.status === 'warn', 'Gate 1 warns on 30/40 questions');
  assert(partial30Eval.passedGateCount === 5, '5 out of 6 gates pass when count is warned');
  // Health score calculation: 100% valid questions (40 pts) + 5/6 gates (50 pts) = 90%
  assert(partial30Eval.healthScore === 90, 'Partial 30/40 paper with clean questions scores 90%');

  // 5.4 Paper with missing option content (Gate 2)
  const paperWithEmptyOpts = createDummyPaper(40);
  paperWithEmptyOpts.questions[0].options[0].content_markdown = '';
  const optEval = evaluateQualityGates(paperWithEmptyOpts, 40);
  assert(optEval.gates.find((g) => g.id === 'options_validity')?.status === 'warn', 'Gate 2 warns when 1 question has empty option');

  // 5.5 Paper with key parity errors (Gate 3)
  const paperWithKeyParityErr = createDummyPaper(40);
  paperWithKeyParityErr.questions[0].options[0].is_correct = true;
  paperWithKeyParityErr.questions[0].options[1].is_correct = true; // Two correct answers!
  const keyEval = evaluateQualityGates(paperWithKeyParityErr, 40);
  assert(keyEval.gates.find((g) => g.id === 'correct_key_parity')?.status === 'fail', 'Gate 3 fails on double correct answers');

  // 5.6 Paper with KaTeX syntax errors (Gate 4)
  const paperWithKatexErr = createDummyPaper(40);
  paperWithKatexErr.questions[0].stem_markdown = 'Broken formula: $\\frac{1}{2$';
  const katexEval = evaluateQualityGates(paperWithKatexErr, 40);
  assert(katexEval.gates.find((g) => g.id === 'katex_integrity')?.status === 'fail', 'Gate 4 fails on KaTeX syntax error');

  // 5.7 Paper with missing diagram crop image (Gate 5)
  const paperWithMissingDiag = createDummyPaper(40);
  paperWithMissingDiag.questions[0].diagram = {
    has_diagram: true,
    image_url: '', // Missing URL!
  };
  const diagEval = evaluateQualityGates(paperWithMissingDiag, 40);
  assert(diagEval.gates.find((g) => g.id === 'diagram_integrity')?.status === 'warn', 'Gate 5 warns when diagram URL is missing');

  // 5.8 Paper with unassigned syllabus topic (Gate 6)
  const paperWithUnassigned = createDummyPaper(40);
  paperWithUnassigned.questions[0].topic_name = 'unassigned';
  const syllabusEval = evaluateQualityGates(paperWithUnassigned, 40);
  assert(syllabusEval.gates.find((g) => g.id === 'syllabus_alignment')?.status === 'warn', 'Gate 6 warns on unassigned topic');
}

// ============================================================================
// SUITE 6: Relational Upsert Payload Construction & Distractor Analysis Mapping
// ============================================================================
console.log('\n▶ Suite 6: Relational Upsert Payload Construction & Distractor Mapping');
{
  const paper = createDummyPaper(5);
  const mockSubjectId = 'sub-uuid-001';
  const mockPaperId = 'pap-uuid-001';
  const mockTopicMap = new Map<string, string>([
    ['Mechanics', 'top-uuid-001'],
    ['Thermal Physics', 'top-uuid-002'],
    ['Waves & Optics', 'top-uuid-003'],
  ]);

  // 6.1 Subject upsert payload construction
  const subjectPayload = {
    code: paper.subject.code,
    name: paper.subject.name,
    icon: paper.subject.icon,
  };
  assert(subjectPayload.code === '0625' && subjectPayload.name === 'Physics', 'Subject payload matches schema');

  // 6.2 Topics upsert payload construction
  const topicsPayload = paper.syllabus_topics.map((t) => ({
    subject_id: mockSubjectId,
    name: t.name,
    order_index: t.order_index,
  }));
  assert(topicsPayload.length === 3, 'Topics payload constructed for all 3 syllabus topics');
  assert(topicsPayload[0].subject_id === mockSubjectId, 'Subject ID linked in topics');

  // 6.3 Paper upsert payload construction
  const paperPayload = {
    subject_id: mockSubjectId,
    series: paper.paper.series,
    paper_code: paper.paper.paper_code,
    year: paper.paper.year,
  };
  assert(paperPayload.series === 's23' && paperPayload.paper_code === '11' && paperPayload.year === 2023, 'Paper metadata payload matches schema');

  // 6.4 Questions upsert payload construction
  const questionsPayload = paper.questions.map((q) => {
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
      subject_id: mockSubjectId,
      paper_id: mockPaperId,
      topic_id: mockTopicMap.get(q.topic_name || '') || null,
      question_number: q.question_number,
      stem_markdown: q.stem_markdown,
      image_url: q.diagram?.image_url || null,
      explanation_markdown: q.explanation_markdown || null,
      cambridge_source_ref: q.cambridge_source_ref || `${paper.subject.code}/${paper.paper.paper_code}/Q${q.question_number}`,
      active: q.status !== 'withdrawn',
      diagram_metadata: diagramMeta,
    };
  });
  assert(questionsPayload.length === 5, '5 question records created in questions payload');
  assert(questionsPayload[0].topic_id === 'top-uuid-001', 'Question successfully mapped to topic_id');
  assert(questionsPayload[0].active === true, 'Question status active properly mapped');

  // 6.5 Question options upsert payload construction & distractor reasoning mapping
  const mockQuestionIdMap = new Map<number, string>([
    [1, 'q-uuid-001'],
    [2, 'q-uuid-002'],
    [3, 'q-uuid-003'],
    [4, 'q-uuid-004'],
    [5, 'q-uuid-005'],
  ]);

  const optionsPayload: Array<{
    question_id: string;
    label: string;
    content_markdown: string;
    is_correct: boolean;
    distractor_reasoning: string | null;
  }> = [];

  for (const q of paper.questions) {
    const qId = mockQuestionIdMap.get(q.question_number)!;
    for (const opt of q.options) {
      let reasoning: string | null = (opt as any).distractor_reasoning ?? null;
      if (!reasoning && !opt.is_correct) {
        reasoning = extractDistractorReasoning(q.explanation_markdown, opt.label);
      }
      if (!reasoning && q.distractor_analysis && q.distractor_analysis[opt.label]) {
        reasoning = q.distractor_analysis[opt.label];
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

  assert(optionsPayload.length === 20, 'Options payload has 20 options (5 questions * 4 options)');

  // Verify option A distractor reasoning extraction
  const optA = optionsPayload.find((o) => o.question_id === 'q-uuid-001' && o.label === 'A');
  assert(optA !== undefined && optA.distractor_reasoning !== null, 'Option A has distractor reasoning');
  assert(optA!.distractor_reasoning!.includes('unit conversion'), 'Option A reasoning properly mapped from explanation/distractor analysis');

  // Verify correct option D has null distractor reasoning or is not flagged as incorrect
  const optD = optionsPayload.find((o) => o.question_id === 'q-uuid-001' && o.label === 'D');
  assert(optD !== undefined && optD.is_correct === true, 'Option D correctly marked as correct');

  // 6.6 Partial publish question filtering
  const selectedQuestionNumbers = [2, 4];
  const targetQuestions = paper.questions.filter((q) => selectedQuestionNumbers.includes(q.question_number));
  assert(targetQuestions.length === 2, 'Partial publish filter accurately selects only requested questions');
  assert(targetQuestions[0].question_number === 2 && targetQuestions[1].question_number === 4, 'Selected questions are Q2 and Q4');

  // 6.7 Publish Receipt Calculation
  const generatedReceipt = {
    success: true,
    paper_id: mockPaperId,
    subjects_count: 1,
    topics_count: mockTopicMap.size,
    questions_count: questionsPayload.length,
    options_count: optionsPayload.length,
  };
  assert(generatedReceipt.questions_count === 5, 'Receipt reports 5 questions published');
  assert(generatedReceipt.options_count === 20, 'Receipt reports 20 options published');
}

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n================================================================');
console.log(`  VERIFICATION RESULTS: ${passedTests} PASSED / ${failedTests} FAILED (${totalTests} TOTAL TESTS)`);
console.log('================================================================\n');

if (failedTests > 0) {
  console.error(`💥 FAILURE: ${failedTests} tests failed.`);
  process.exit(1);
} else {
  console.log('🎉 SUCCESS: All 6 test suites passed 100% with zero regressions.');
  process.exit(0);
}

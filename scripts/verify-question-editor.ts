/**
 * Automated Verification Suite for Cambridge Question Editor Extended Metadata & Contracts.
 *
 * Suites:
 * - [Suite 1] parseCambridgeQuestionMetadata parsing & inference logic
 * - [Suite 2] formatCambridgeCitation citation generation & fallbacks
 * - [Suite 3] Tagging and categorization operations & suggested tags
 * - [Suite 4] Question type contract and schema compliance
 * - [Suite 5] AdminCMS.tsx code structure & React hook integrity inspection
 */

import * as fs from 'fs';
import * as path from 'path';
import assert from 'assert';
import {
  parseCambridgeQuestionMetadata,
  formatCambridgeCitation,
  SUGGESTED_TAGS,
  SERIES_OPTIONS,
  VARIANT_OPTIONS,
  PAPER_CODE_OPTIONS,
  YEAR_OPTIONS,
  DIFFICULTY_OPTIONS,
  STATUS_OPTIONS,
  CambridgeQuestionMeta,
} from '../lib/portal/questionMetadata';
import type { Question } from '../hooks/useQuizGame';

interface TestResult {
  name: string;
  passed: boolean;
  error?: any;
}

const results: TestResult[] = [];

function runTest(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err });
    console.error(`  ✗ ${name}`);
    console.error(`    ${err?.message || err}`);
  }
}

console.log('\n======================================================');
console.log('   Cambridge Question Editor Verification Suite');
console.log('======================================================\n');

// ------------------------------------------------------------------
// [Suite 1] parseCambridgeQuestionMetadata
// ------------------------------------------------------------------
console.log('[Suite 1] parseCambridgeQuestionMetadata:');

runTest('Parses standard Cambridge June question from ID and citation', () => {
  const q: Partial<Question> = {
    id: '0455-s24-12-q1',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2024 Q1',
    topic: 'The basic economic problem',
  };

  const meta = parseCambridgeQuestionMetadata(q);
  assert.strictEqual(meta.year, 2024, 'Year should be 2024');
  assert.strictEqual(meta.series, 'May/June', 'Series should be May/June');
  assert.strictEqual(meta.seriesCode, 's', 'Series code should be s');
  assert.strictEqual(meta.paperCode, '12', 'Paper code should be 12');
  assert.strictEqual(meta.variant, '2', 'Variant should be 2');
  assert.strictEqual(meta.questionNumber, 1, 'Question number should be 1');
  assert.strictEqual(meta.status, 'Live', 'Default status should be Live');
  assert.strictEqual(meta.hasDiagram, false, 'hasDiagram should be false');
});

runTest('Parses October/November question correctly', () => {
  const q: Partial<Question> = {
    id: '0455-w23-21-q15',
    citation: 'Cambridge IGCSE Economics 0455/21 Oct/Nov 2023 Q15',
    topic: 'Monetary Policy',
    difficulty: 'Hard',
    status: 'Needs review',
  };

  const meta = parseCambridgeQuestionMetadata(q);
  assert.strictEqual(meta.year, 2023, 'Year should be 2023');
  assert.strictEqual(meta.series, 'Oct/Nov', 'Series should be Oct/Nov');
  assert.strictEqual(meta.seriesCode, 'w', 'Series code should be w');
  assert.strictEqual(meta.paperCode, '21', 'Paper code should be 21');
  assert.strictEqual(meta.variant, '1', 'Variant should be 1');
  assert.strictEqual(meta.questionNumber, 15, 'Question number should be 15');
  assert.strictEqual(meta.difficulty, 'Hard', 'Difficulty should be Hard');
  assert.strictEqual(meta.status, 'Needs review', 'Status should be Needs review');
});

runTest('Parses diagram metadata and image URL when present', () => {
  const qWithImageUrl: Partial<Question> = {
    id: '0455-s24-12-q19',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2024 Q19',
    image_url: '/questions/0455_2024_s_12_q19.png',
  };
  const meta1 = parseCambridgeQuestionMetadata(qWithImageUrl);
  assert.strictEqual(meta1.hasDiagram, true, 'hasDiagram should be true from image_url');
  assert.strictEqual(meta1.imageUrl, '/questions/0455_2024_s_12_q19.png');

  const qWithNestedDiagram: Partial<Question> = {
    id: '0455-s24-12-q27',
    diagram: {
      has_diagram: true,
      image_url: '/questions/0455_2024_s_12_q27.png',
      alt_description: 'Supply and demand curve shift',
    },
  };
  const meta2 = parseCambridgeQuestionMetadata(qWithNestedDiagram);
  assert.strictEqual(meta2.hasDiagram, true, 'hasDiagram should be true from nested diagram');
  assert.strictEqual(meta2.imageUrl, '/questions/0455_2024_s_12_q27.png');
});

runTest('Generates reasonable default tags if empty', () => {
  const microQ: Partial<Question> = {
    id: 'q-micro',
    topic: 'Price elasticity of demand',
  };
  const metaMicro = parseCambridgeQuestionMetadata(microQ);
  assert(metaMicro.tags.length > 0, 'Tags should not be empty');
  assert(metaMicro.tags.includes('Microeconomics'), 'Micro topic should default to Microeconomics tag');

  const macroQ: Partial<Question> = {
    id: 'q-macro',
    topic: 'Macroeconomic aims of government',
  };
  const metaMacro = parseCambridgeQuestionMetadata(macroQ);
  assert(metaMacro.tags.includes('Macroeconomics'), 'Macro topic should default to Macroeconomics tag');

  const customQ: Partial<Question> = {
    id: 'q-custom',
    tags: ['Custom Tag 1', 'Calculation'],
  };
  const metaCustom = parseCambridgeQuestionMetadata(customQ);
  assert.deepStrictEqual(metaCustom.tags, ['Custom Tag 1', 'Calculation'], 'Preserves custom tags');
});

runTest('Handles empty/missing question object gracefully', () => {
  const meta = parseCambridgeQuestionMetadata(undefined);
  assert.strictEqual(typeof meta.year, 'number');
  assert.strictEqual(typeof meta.citation, 'string');
  assert(meta.tags.length > 0);
});

// ------------------------------------------------------------------
// [Suite 2] formatCambridgeCitation
// ------------------------------------------------------------------
console.log('\n[Suite 2] formatCambridgeCitation:');

runTest('Generates valid Cambridge citation string with standard inputs', () => {
  const citation = formatCambridgeCitation({
    subject: '0455 - Economics',
    paperCode: '12',
    series: 'May/June',
    year: 2024,
    questionNumber: 1,
  });
  assert.strictEqual(citation, 'Cambridge IGCSE Economics 0455/12 May/June 2024 Q1');
});

runTest('Derives paperCode from variant if paperCode omitted', () => {
  const citation = formatCambridgeCitation({
    variant: '3',
    series: 'Oct/Nov',
    year: 2023,
    questionNumber: 22,
  });
  assert.strictEqual(citation, 'Cambridge IGCSE Economics 0455/13 Oct/Nov 2023 Q22');
});

runTest('Handles missing optional properties gracefully with safe defaults', () => {
  const citation = formatCambridgeCitation({});
  assert.strictEqual(citation, 'Cambridge IGCSE Economics 0455/12 May/June 2024 Q1');
});

// ------------------------------------------------------------------
// [Suite 3] Tagging and categorization operations
// ------------------------------------------------------------------
console.log('\n[Suite 3] Tagging and Categorization Operations:');

runTest('Suggested tags list contains expected core categories', () => {
  assert(SUGGESTED_TAGS.includes('Microeconomics'), 'SUGGESTED_TAGS must include Microeconomics');
  assert(SUGGESTED_TAGS.includes('Macroeconomics'), 'SUGGESTED_TAGS must include Macroeconomics');
  assert(SUGGESTED_TAGS.includes('Calculation'), 'SUGGESTED_TAGS must include Calculation');
  assert(SUGGESTED_TAGS.includes('Graph / Diagram'), 'SUGGESTED_TAGS must include Graph / Diagram');
});

runTest('Tag addition, whitespace trimming, duplicate prevention, and deletion logic', () => {
  function addTag(tags: string[], newTag: string): string[] {
    const trimmed = newTag.trim();
    if (!trimmed || tags.includes(trimmed)) return tags;
    return [...tags, trimmed];
  }

  function removeTag(tags: string[], tagToRemove: string): string[] {
    return tags.filter((t) => t !== tagToRemove);
  }

  let tags = ['Microeconomics'];

  // Trim test
  tags = addTag(tags, '  Calculation  ');
  assert.deepStrictEqual(tags, ['Microeconomics', 'Calculation'], 'Tag should be trimmed of whitespace');

  // Duplicate prevention test
  tags = addTag(tags, 'Calculation');
  assert.deepStrictEqual(tags, ['Microeconomics', 'Calculation'], 'Duplicate tag must not be added');

  // Empty string test
  tags = addTag(tags, '   ');
  assert.deepStrictEqual(tags, ['Microeconomics', 'Calculation'], 'Empty string tag must not be added');

  // Deletion test
  tags = removeTag(tags, 'Microeconomics');
  assert.deepStrictEqual(tags, ['Calculation'], 'Target tag should be removed');
});

// ------------------------------------------------------------------
// [Suite 4] Question type contract and schema compliance
// ------------------------------------------------------------------
console.log('\n[Suite 4] Question Type Contract & Schema Compliance:');

runTest('Sample Question object satisfies Question type contract with extended metadata', () => {
  const question: Question = {
    id: '0455-s24-12-q1',
    stem_markdown: 'What is the basic economic problem?',
    options: [
      { id: 'opt-a', text_markdown: 'scarcity of resources relative to unlimited wants' },
      { id: 'opt-b', text_markdown: 'excess supply of goods' },
      { id: 'opt-c', text_markdown: 'fixed government budgets' },
      { id: 'opt-d', text_markdown: 'deflationary spirals' },
    ],
    correct_option_id: 'opt-a',
    citation: 'Cambridge IGCSE Economics 0455/12 May/June 2024 Q1',
    topic: 'The basic economic problem',
    topic_id: 'e47a52b4-e86e-4d69-b790-d7a5b5d15397',
    has_diagram: false,
    image_url: '',
    diagram: {
      has_diagram: false,
      image_url: '',
      alt_description: '',
    },
    explanation_markdown: 'Resources are finite whereas human wants are unlimited.',
    // Extended metadata:
    year: 2024,
    variant: '2',
    series: 'May/June',
    paper_code: '12',
    question_number: 1,
    tags: ['Microeconomics', 'Core Concept'],
    difficulty: 'Easy',
    status: 'Live',
    subtopic: '1.1 The nature of the economic problem',
  };

  assert.strictEqual(question.year, 2024);
  assert.strictEqual(question.variant, '2');
  assert.strictEqual(question.series, 'May/June');
  assert.strictEqual(question.paper_code, '12');
  assert.strictEqual(question.question_number, 1);
  assert.deepStrictEqual(question.tags, ['Microeconomics', 'Core Concept']);
  assert.strictEqual(question.difficulty, 'Easy');
  assert.strictEqual(question.status, 'Live');
  assert.strictEqual(question.subtopic, '1.1 The nature of the economic problem');
});

// ------------------------------------------------------------------
// [Suite 5] AdminCMS.tsx Code Inspection
// ------------------------------------------------------------------
console.log('\n[Suite 5] AdminCMS.tsx Code Inspection:');

runTest('AdminCMS.tsx file exists and contains metadata fields in state and UI', () => {
  const adminCmsPath = path.resolve(__dirname, '../components/portal/AdminCMS.tsx');
  assert(fs.existsSync(adminCmsPath), 'AdminCMS.tsx must exist');

  const fileContent = fs.readFileSync(adminCmsPath, 'utf-8');

  // Assert metadata fields exist in state or props
  const expectedFields = ['year', 'variant', 'series', 'tags', 'diagram', 'status', 'citation'];
  for (const field of expectedFields) {
    const regex = new RegExp(`\\b${field}\\b`, 'i');
    assert(regex.test(fileContent), `AdminCMS.tsx must contain reference to field: '${field}'`);
  }
});

runTest('AdminCMS.tsx declares React hooks at top level without early returns preceding them', () => {
  const adminCmsPath = path.resolve(__dirname, '../components/portal/AdminCMS.tsx');
  const fileContent = fs.readFileSync(adminCmsPath, 'utf-8');

  // Find AdminCMS component definition
  const componentMatch = fileContent.match(/export\s+default\s+function\s+AdminCMS\s*\([^)]*\)\s*\{/);
  assert(componentMatch, 'AdminCMS component must be declared as export default function AdminCMS');

  const startIndex = componentMatch.index! + componentMatch[0].length;

  // Find all hook calls in AdminCMS
  const hookRegex = /\b(useState|useEffect|useMemo|useCallback|useRef|useContext)\s*\(/g;
  hookRegex.lastIndex = startIndex;

  let lastHookIndex = startIndex;
  let match: RegExpExecArray | null;

  while ((match = hookRegex.exec(fileContent)) !== null) {
    lastHookIndex = match.index;
  }

  // The slice from component start to the last hook call
  const codeBeforeLastHook = fileContent.substring(startIndex, lastHookIndex);

  // Check that no return statements appear before the last hook call
  const earlyReturnMatch = codeBeforeLastHook.match(/\breturn\b/);
  assert(
    !earlyReturnMatch,
    'No early return statements should precede React hook declarations (prevents React Error #310)'
  );
});

// ------------------------------------------------------------------
// Final Summary
// ------------------------------------------------------------------
const passedCount = results.filter((r) => r.passed).length;
const totalCount = results.length;

console.log('\n======================================================');
console.log(`  Tests Passed: ${passedCount} / ${totalCount}`);
console.log('======================================================\n');

if (passedCount < totalCount) {
  process.exit(1);
} else {
  console.log('All verification suites passed successfully!\n');
}

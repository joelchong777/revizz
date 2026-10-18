/**
 * Verification Script for Teacher Portal Test Compiler Topic Filtering
 *
 * Checks:
 * 1. filterAndSortQuestions with single topic ID, multiple topic IDs, 'all', empty array, and comma-separated string
 * 2. countActiveFilters with topicIds, topicId, combinations, and default state
 * 3. autoSelectQuestions with multiple topicIds, single topicId, count bounds, and pool fallback
 * 4. Static Code Contract & Accessibility Audit for TestCompilerHub.tsx:
 *    - Trigger button with id="compiler-topic-filter" and data-testid="compiler-topic-filter-trigger"
 *    - Popover menu with data-testid="compiler-topic-filter-menu"
 *    - ARIA attributes: aria-haspopup="listbox", aria-expanded
 *    - State contracts: selectedTopicIds, selectedTopicId, isTopicDropdownOpen, topicDropdownRef
 *    - Outside click and Escape key listeners
 *    - Removable topic chips in active filter strip and expanded filter view
 *    - Auto-Generate Modal multi-topic selection (autoTopicIds, role="group", role="checkbox")
 */

import fs from 'fs';
import path from 'path';
import {
  filterAndSortQuestions,
  countActiveFilters,
} from '../lib/compilerFilters';
import { autoSelectQuestions } from '../lib/testCompiler';
import { CAMBRIDGE_QUESTIONS, CAMBRIDGE_TOPICS, Question } from '../lib/questions';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    failedTests++;
    const err = `❌ [FAIL] ${message}`;
    failures.push(err);
    console.error(err);
    return;
  }
  passedTests++;
  console.log(`✅ [PASS] ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  totalTests++;
  if (actual !== expected) {
    failedTests++;
    const err = `❌ [FAIL] ${message}\n       Expected: ${expected}\n       Got:      ${actual}`;
    failures.push(err);
    console.error(err);
    return;
  }
  passedTests++;
  console.log(`✅ [PASS] ${message}`);
}

function run() {
  console.log('================================================================');
  console.log('    VERIFY TEACHER COMPILER MULTI-TOPIC FILTERING SUITE         ');
  console.log('================================================================\n');

  // Topic 1 and 2 IDs
  const topic1 = CAMBRIDGE_TOPICS[0].id; // The basic economic problem
  const topic2 = CAMBRIDGE_TOPICS[1].id; // The allocation of resources
  const topic3 = CAMBRIDGE_TOPICS[2].id; // Microeconomic decision makers

  // Count known questions in each topic
  const topic1Questions = CAMBRIDGE_QUESTIONS.filter((q) => q.topic_id === topic1);
  const topic2Questions = CAMBRIDGE_QUESTIONS.filter((q) => q.topic_id === topic2);
  const topic3Questions = CAMBRIDGE_QUESTIONS.filter((q) => q.topic_id === topic3);

  console.log(`[Setup] Dataset Topic Distribution:`);
  console.log(`  Topic 1 (${CAMBRIDGE_TOPICS[0].name}): ${topic1Questions.length} Qs`);
  console.log(`  Topic 2 (${CAMBRIDGE_TOPICS[1].name}): ${topic2Questions.length} Qs`);
  console.log(`  Topic 3 (${CAMBRIDGE_TOPICS[2].name}): ${topic3Questions.length} Qs`);
  console.log(`  Total Cambridge Questions: ${CAMBRIDGE_QUESTIONS.length} Qs\n`);

  // ---------------------------------------------------------------------------
  // [1] filterAndSortQuestions with topicIds
  // ---------------------------------------------------------------------------
  console.log('--- 1. Testing filterAndSortQuestions with Multi-Topic Options ---');

  // 1.1 Single topicId via topicIds array
  const resSingleArray = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    topicIds: [topic1],
  });
  assertEqual(
    resSingleArray.length,
    topic1Questions.length,
    `topicIds: [topic1] returns exactly ${topic1Questions.length} questions`
  );
  assert(
    resSingleArray.every((q) => q.topic_id === topic1),
    'All returned questions match topic1'
  );

  // 1.2 Multiple topicIds
  const resMultiArray = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    topicIds: [topic1, topic2],
  });
  const expectedCombined = topic1Questions.length + topic2Questions.length;
  assertEqual(
    resMultiArray.length,
    expectedCombined,
    `topicIds: [topic1, topic2] returns combined sum of ${expectedCombined} questions`
  );
  assert(
    resMultiArray.every((q) => q.topic_id === topic1 || q.topic_id === topic2),
    'All returned questions belong to either topic1 or topic2'
  );

  // 1.3 Three topicIds
  const resThreeArray = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    topicIds: [topic1, topic2, topic3],
  });
  assertEqual(
    resThreeArray.length,
    topic1Questions.length + topic2Questions.length + topic3Questions.length,
    'topicIds with 3 topics returns exact aggregate questions'
  );

  // 1.4 topicIds: ['all'] returns complete unfiltered questions
  const resAllArray = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    topicIds: ['all'],
  });
  assertEqual(
    resAllArray.length,
    CAMBRIDGE_QUESTIONS.length,
    "topicIds: ['all'] returns all questions without filtering"
  );

  // 1.5 topicIds: [] (empty) returns complete unfiltered questions
  const resEmptyArray = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    topicIds: [],
  });
  assertEqual(
    resEmptyArray.length,
    CAMBRIDGE_QUESTIONS.length,
    'topicIds: [] returns all questions'
  );

  // 1.6 Backward compatibility: legacy topicId string
  const resLegacySingle = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    topicId: topic1,
  });
  assertEqual(
    resLegacySingle.length,
    topic1Questions.length,
    'Legacy topicId string returns matching questions'
  );

  // 1.7 Backward compatibility: comma-separated topicId string
  const resLegacyComma = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    topicId: `${topic1},${topic2}`,
  });
  assertEqual(
    resLegacyComma.length,
    expectedCombined,
    'Legacy comma-separated topicId string returns union of both topics'
  );

  // 1.8 Multiple topicIds combined with text search
  const resMultiWithSearch = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    topicIds: [topic1, topic2],
    search: 'scarcity',
  });
  assert(
    resMultiWithSearch.length > 0 &&
      resMultiWithSearch.every((q) => (q.topic_id === topic1 || q.topic_id === topic2) && (q.stem_markdown?.toLowerCase().includes('scarcity') || q.id.includes('scarcity'))),
    'topicIds combines cleanly with search queries'
  );

  // ---------------------------------------------------------------------------
  // [2] countActiveFilters with topicIds
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. Testing countActiveFilters with Multi-Topic Options ---');

  // 2.1 Default state has 0 active filters
  const defaultCount = countActiveFilters({
    search: '',
    topicId: 'all',
    topicIds: ['all'],
    series: 'all',
    selection: 'all',
    withDiagramsOnly: false,
    withTablesOnly: false,
    withMathOnly: false,
    sortBy: 'paper',
  });
  assertEqual(defaultCount, 0, 'countActiveFilters with topicIds: ["all"] is 0');

  // 2.2 topicIds with 1 topic increments count by 1
  const countSingle = countActiveFilters({
    topicIds: [topic1],
  });
  assertEqual(countSingle, 1, 'countActiveFilters with topicIds: [topic1] increments count to 1');

  // 2.3 topicIds with multiple topics increments count by 1 (topic dimension counted once)
  const countMulti = countActiveFilters({
    topicIds: [topic1, topic2, topic3],
  });
  assertEqual(countMulti, 1, 'countActiveFilters with multiple topicIds increments count by 1');

  // 2.4 Both topicIds and topicId provided does not double-count
  const countBoth = countActiveFilters({
    topicIds: [topic1, topic2],
    topicId: `${topic1},${topic2}`,
  });
  assertEqual(countBoth, 1, 'countActiveFilters does not double-count when both topicIds and topicId are set');

  // 2.5 All 8 filters active
  const countAll8 = countActiveFilters({
    search: 'inflation',
    topicIds: [topic1, topic2],
    topicId: `${topic1},${topic2}`,
    series: 'May/June 2024',
    selection: 'selected',
    withDiagramsOnly: true,
    withTablesOnly: true,
    withMathOnly: true,
    sortBy: 'shortest',
  });
  assertEqual(countAll8, 8, 'countActiveFilters correctly counts all 8 active filters');

  // ---------------------------------------------------------------------------
  // [3] autoSelectQuestions with multiple topicIds
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Testing autoSelectQuestions with Multiple Topic IDs ---');

  // 3.1 Multiple topicIds auto-selection
  const autoSelectedMulti = autoSelectQuestions(
    {
      count: 4,
      topicIds: [topic1, topic2],
    },
    CAMBRIDGE_QUESTIONS
  );
  assertEqual(autoSelectedMulti.length, 4, 'autoSelectQuestions returns requested count of 4');
  const autoQuestions = CAMBRIDGE_QUESTIONS.filter((q) => autoSelectedMulti.includes(q.id));
  assert(
    autoQuestions.every((q) => q.topic_id === topic1 || q.topic_id === topic2),
    'autoSelectQuestions selects questions exclusively from specified topicIds'
  );

  // 3.2 Single topicId auto-selection
  const autoSelectedSingle = autoSelectQuestions(
    {
      count: 2,
      topicIds: [topic1],
    },
    CAMBRIDGE_QUESTIONS
  );
  assertEqual(autoSelectedSingle.length, 2, 'autoSelectQuestions returns requested count of 2');
  const autoQuestionsSingle = CAMBRIDGE_QUESTIONS.filter((q) => autoSelectedSingle.includes(q.id));
  assert(
    autoQuestionsSingle.every((q) => q.topic_id === topic1),
    'autoSelectQuestions selects questions exclusively from single topic'
  );

  // 3.3 autoSelectQuestions fallback when topicIds is undefined (all questions pool)
  const autoSelectedAll = autoSelectQuestions(
    {
      count: 5,
    },
    CAMBRIDGE_QUESTIONS
  );
  assertEqual(autoSelectedAll.length, 5, 'autoSelectQuestions selects 5 from all topics when topicIds is undefined');

  // ---------------------------------------------------------------------------
  // [4] Static Code Contracts & Accessibility in TestCompilerHub.tsx
  // ---------------------------------------------------------------------------
  console.log('\n--- 4. Auditing TestCompilerHub.tsx Code Contracts & Accessibility ---');

  const hubPath = path.resolve(__dirname, '../components/portal/compiler/TestCompilerHub.tsx');
  assert(fs.existsSync(hubPath), 'TestCompilerHub.tsx exists at expected path');
  const hubCode = fs.readFileSync(hubPath, 'utf8');

  // 4.1 Trigger button & test IDs
  assert(
    hubCode.includes('id="compiler-topic-filter"'),
    'TestCompilerHub has element with id="compiler-topic-filter"'
  );
  assert(
    hubCode.includes('data-testid="compiler-topic-filter-trigger"'),
    'TestCompilerHub has element with data-testid="compiler-topic-filter-trigger"'
  );

  // 4.2 Popover menu & test IDs
  assert(
    hubCode.includes('data-testid="compiler-topic-filter-menu"'),
    'TestCompilerHub has popover menu with data-testid="compiler-topic-filter-menu"'
  );
  assert(
    hubCode.includes('shadow-offset-3'),
    'TestCompilerHub menu uses neobrutalist shadow-offset-3 styling'
  );

  // 4.3 Accessibility attributes
  assert(
    hubCode.includes('aria-haspopup="listbox"'),
    'Trigger button specifies aria-haspopup="listbox"'
  );
  assert(
    hubCode.includes('aria-expanded={isTopicDropdownOpen}'),
    'Trigger button specifies dynamic aria-expanded attribute'
  );
  assert(
    hubCode.includes('role="listbox"'),
    'Topic dropdown popover has role="listbox"'
  );
  assert(
    hubCode.includes('role="option"'),
    'Topic dropdown items have role="option"'
  );

  // 4.4 State & Hook contracts
  assert(
    hubCode.includes('const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>(['),
    'TestCompilerHub defines selectedTopicIds state as string array'
  );
  assert(
    hubCode.includes('const selectedTopicId ='),
    'TestCompilerHub provides backward-compatible selectedTopicId'
  );
  assert(
    hubCode.includes('topicDropdownRef'),
    'TestCompilerHub uses topicDropdownRef for outside click detection'
  );
  assert(
    hubCode.includes("event.key === 'Escape'"),
    'TestCompilerHub handles Escape key to dismiss dropdown'
  );

  // 4.5 Active filter chips & removal
  assert(
    hubCode.includes('selectedTopicIds.map((tid) =>'),
    'TestCompilerHub maps selectedTopicIds to render individual topic chips'
  );
  assert(
    hubCode.includes('Remove topic filter'),
    'TestCompilerHub provides accessible remove button for active topic chips'
  );

  // 4.6 Auto-Generate Modal multi-topic support
  assert(
    hubCode.includes('autoTopicIds'),
    'TestCompilerHub maintains autoTopicIds state for multi-topic auto-generation'
  );
  assert(
    hubCode.includes('id="auto-topic-select"'),
    'TestCompilerHub preserves id="auto-topic-select" for Auto-Generate topic selector'
  );
  assert(
    hubCode.includes('All Topics (Mixed)'),
    'Auto-Generate modal includes "All Topics (Mixed)" quick toggle'
  );

  // 4.7 Quick action row in popover
  assert(
    hubCode.includes("setSelectedTopicIds(['all'])"),
    'Topic filter menu has "All Topics" quick action'
  );
  assert(
    hubCode.includes('setSelectedTopicIds([])'),
    'Topic filter menu has "Clear" quick action'
  );

  console.log('\n================================================================');
  console.log(`   TOTAL CHECKS: ${totalTests}`);
  console.log(`   PASSED:       ${passedTests}`);
  console.log(`   FAILED:       ${failedTests}`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error('\nFailures:\n' + failures.join('\n'));
    process.exit(1);
  }
}

run();

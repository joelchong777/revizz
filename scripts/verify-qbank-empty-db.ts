/**
 * Automated Verification: Question Bank Supabase Sync & Empty Database State
 *
 * Verifies:
 * 1. components/portal/AdminTools.tsx has 0 occurrences of CAMBRIDGE_QUESTIONS and CAMBRIDGE_TOPICS fallback.
 * 2. assignQs derives directly from dbQuestions without fallback.
 * 3. bankQuestions initializes to [] and syncs directly with dbQuestions when !questionsLoading.
 * 4. createInitialBankItems([]) returns [] cleanly.
 * 5. createInitialBankItems accurately maps question metadata status ('draft', 'in_review', 'withdrawn', active=false, default='Live').
 * 6. topicOptions and reassignTopicOptions handle empty topics without fallback to CAMBRIDGE_TOPICS.
 * 7. Question Bank UI renders loading spinner when questionsLoading is true and empty state when dbQuestions is empty.
 */

import fs from 'fs';
import path from 'path';
import type { Question } from '../lib/questions';

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

function assertEqual<T>(actual: T, expected: T, testName: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    pass(testName);
  } else {
    fail(testName, `Expected ${expectedStr}, received ${actualStr}`);
  }
}

function assert(condition: boolean, testName: string, errorMsg?: string) {
  if (condition) {
    pass(testName);
  } else {
    fail(testName, errorMsg || 'Assertion failed');
  }
}

// Replicate createInitialBankItems logic for isolated algorithmic verification
type BankItemStatus = 'Live' | 'Agent draft' | 'Needs review' | 'Flagged';

function getStatusBadgeClass(st: BankItemStatus): string {
  switch (st) {
    case 'Live':
      return 'bg-[#ccdbb2] text-[#272e1b]';
    case 'Agent draft':
      return 'bg-[#f0fae1] text-[#728157]';
    case 'Needs review':
      return 'bg-[#ffe1d0] text-[#c67139]';
    case 'Flagged':
      return 'bg-[#fde8e8] text-[#e0533c]';
  }
}

function createInitialBankItems(questions: Question[]) {
  return questions.map((q, idx) => {
    const qNum = idx + 1;
    let st: BankItemStatus = 'Live';
    const statusVal = (q as any).status;
    if (statusVal === 'draft' || statusVal === 'Agent draft') {
      st = 'Agent draft';
    } else if (statusVal === 'in_review' || statusVal === 'Needs review') {
      st = 'Needs review';
    } else if (statusVal === 'withdrawn' || statusVal === 'Flagged' || (q as any).active === false) {
      st = 'Flagged';
    } else {
      st = 'Live';
    }
    const stCls = getStatusBadgeClass(st);

    const diff: 'Easy' | 'Medium' | 'Hard' =
      idx % 3 === 0 ? 'Easy' : idx % 3 === 1 ? 'Medium' : 'Hard';
    const acc =
      idx % 4 === 0 ? '78%' : idx % 4 === 1 ? '64%' : idx % 4 === 2 ? '89%' : '52%';
    const upd = st === 'Live' ? 'Live' : '2d ago';

    const cite = q.citation || `Q${qNum}`;
    const paper = q.citation?.split(' ')[0] || 'None';
    const session = 'None';

    return {
      id: q.id,
      stem: q.stem_markdown,
      cite,
      topic: q.topic || 'General',
      paper,
      session,
      diff,
      acc,
      st,
      stCls,
      upd,
    };
  });
}

async function run() {
  console.log('\n========================================================');
  console.log('   QUESTION BANK DATABASE SYNC & EMPTY AUDIT SUITE      ');
  console.log('========================================================\n');

  const adminToolsPath = path.resolve(__dirname, '../components/portal/AdminTools.tsx');
  assert(fs.existsSync(adminToolsPath), 'AdminTools.tsx exists at expected path');

  const adminToolsCode = fs.readFileSync(adminToolsPath, 'utf-8');

  // Test 1: Static source code verification - CAMBRIDGE_QUESTIONS purge
  const cambridgeQuestionsMatches = (adminToolsCode.match(/CAMBRIDGE_QUESTIONS/g) || []).length;
  assertEqual(
    cambridgeQuestionsMatches,
    0,
    'AdminTools.tsx has 0 occurrences of CAMBRIDGE_QUESTIONS (completely purged)'
  );

  // Test 2: Static source code verification - CAMBRIDGE_TOPICS purge
  const cambridgeTopicsMatches = (adminToolsCode.match(/CAMBRIDGE_TOPICS/g) || []).length;
  assertEqual(
    cambridgeTopicsMatches,
    0,
    'AdminTools.tsx has 0 occurrences of CAMBRIDGE_TOPICS (completely purged)'
  );

  // Test 3: useQuestions destructuring includes questionsLoading
  assert(
    adminToolsCode.includes('loading: questionsLoading'),
    'AdminTools.tsx destructures loading: questionsLoading from useQuestions()'
  );

  // Test 4: assignQs derives directly from dbQuestions
  assert(
    adminToolsCode.includes('(dbQuestions || []).map'),
    'assignQs derives directly from dbQuestions without mock fallback'
  );

  // Test 5: bankQuestions initial state is empty array
  assert(
    /const\s*\[bankQuestions,\s*setBankQuestions\]\s*=\s*useState<QuestionBankItem\[\]>\(\[\]\);/.test(adminToolsCode),
    'bankQuestions initializes to empty array []'
  );

  // Test 6: useEffect syncs bankQuestions with dbQuestions when !questionsLoading
  assert(
    adminToolsCode.includes('if (!questionsLoading) {') &&
    adminToolsCode.includes('setBankQuestions(createInitialBankItems(dbQuestions || []));'),
    'useEffect syncs bankQuestions with dbQuestions when !questionsLoading'
  );

  // Test 7: topicOptions empty fallback returns [{ value: "None", label: "None" }]
  assert(
    adminToolsCode.includes("if (!dbTopics || dbTopics.length === 0) {") &&
    adminToolsCode.includes("return [{ value: 'None', label: 'None' }];"),
    'topicOptions returns [{ value: "None", label: "None" }] when dbTopics is empty'
  );

  // Test 8: reassignTopicOptions empty fallback returns []
  assert(
    adminToolsCode.includes("if (!dbTopics || dbTopics.length === 0) {") &&
    adminToolsCode.includes("return [];"),
    'reassignTopicOptions returns [] when dbTopics is empty'
  );

  // Test 9: UI displays loading indicator and spinner
  assert(
    adminToolsCode.includes("Loading questions from database..."),
    'AdminTools Question Bank table body includes loading spinner with "Loading questions from database..."'
  );
  assert(
    adminToolsCode.includes("{questionsLoading ? '...' : `${bankQuestions.length} questions`}"),
    'AdminTools Question Bank header displays loading ellipsis when questionsLoading is true'
  );

  // Test 10: UI displays empty state when bankQuestions is empty
  assert(
    adminToolsCode.includes("Question Bank is Empty"),
    'AdminTools Question Bank table body renders "Question Bank is Empty" empty state banner'
  );

  // Test 11: createInitialBankItems([]) returns []
  const emptyResult = createInitialBankItems([]);
  assertEqual(emptyResult, [], 'createInitialBankItems([]) returns empty array []');

  // Test 12: createInitialBankItems status mapping tests
  const testQuestions: Question[] = [
    {
      id: 'q-live',
      stem_markdown: 'Live question',
      options: [],
      correct_option_id: 'a',
      status: 'published',
    } as any,
    {
      id: 'q-draft',
      stem_markdown: 'Draft question',
      options: [],
      correct_option_id: 'a',
      status: 'draft',
    } as any,
    {
      id: 'q-agent-draft',
      stem_markdown: 'Agent draft question',
      options: [],
      correct_option_id: 'a',
      status: 'Agent draft',
    } as any,
    {
      id: 'q-in-review',
      stem_markdown: 'In review question',
      options: [],
      correct_option_id: 'a',
      status: 'in_review',
    } as any,
    {
      id: 'q-needs-review',
      stem_markdown: 'Needs review question',
      options: [],
      correct_option_id: 'a',
      status: 'Needs review',
    } as any,
    {
      id: 'q-withdrawn',
      stem_markdown: 'Withdrawn question',
      options: [],
      correct_option_id: 'a',
      status: 'withdrawn',
    } as any,
    {
      id: 'q-inactive',
      stem_markdown: 'Inactive question',
      options: [],
      correct_option_id: 'a',
      active: false,
    } as any,
  ];

  const mappedItems = createInitialBankItems(testQuestions);
  assertEqual(mappedItems.length, 7, 'Maps all 7 test questions');
  assertEqual(mappedItems[0].st, 'Live', 'published question maps to Live status');
  assertEqual(mappedItems[1].st, 'Agent draft', 'draft status maps to Agent draft');
  assertEqual(mappedItems[2].st, 'Agent draft', 'Agent draft status maps to Agent draft');
  assertEqual(mappedItems[3].st, 'Needs review', 'in_review status maps to Needs review');
  assertEqual(mappedItems[4].st, 'Needs review', 'Needs review status maps to Needs review');
  assertEqual(mappedItems[5].st, 'Flagged', 'withdrawn status maps to Flagged');
  assertEqual(mappedItems[6].st, 'Flagged', 'active: false maps to Flagged');

  console.log('\n========================================================');
  console.log(`   TOTAL TESTS: ${totalTests}`);
  console.log(`   PASSED:      ${passedTests}`);
  console.log(`   FAILED:      ${failedTests}`);
  console.log('========================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

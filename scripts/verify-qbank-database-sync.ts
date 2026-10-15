/**
 * scripts/verify-qbank-database-sync.ts
 *
 * Automated Headless Test Suite:
 * Question Bank Database Sync & Zero-Fallback Data Layer Contract (Memory Rule 6)
 *
 * Verifies:
 * 1. components/portal/AdminTools.tsx contains 0 occurrences of CAMBRIDGE_QUESTIONS.
 * 2. components/portal/AdminTools.tsx contains 0 fallback references to CAMBRIDGE_TOPICS.
 * 3. components/admin/AppAdminHub.tsx contains 0 occurrences of CAMBRIDGE_QUESTIONS.
 * 4. createInitialBankItems([]) returns [] (empty array).
 * 5. When questions array is empty, empty state message ("Question Bank is Empty") is present in component definitions.
 * 6. When questions array contains database items with UUIDs, they map accurately to ID, stem, citation, topic, and status.
 */

import fs from 'fs';
import path from 'path';
import { createInitialBankItems, getStatusBadgeClass } from '../components/portal/AdminTools';
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

async function run() {
  console.log('\n========================================================');
  console.log('   QUESTION BANK DATABASE SYNC & ZERO-FALLBACK SUITE    ');
  console.log('========================================================\n');

  const adminToolsPath = path.resolve(__dirname, '../components/portal/AdminTools.tsx');
  const appAdminHubPath = path.resolve(__dirname, '../components/admin/AppAdminHub.tsx');

  assert(fs.existsSync(adminToolsPath), 'AdminTools.tsx exists at expected path');
  assert(fs.existsSync(appAdminHubPath), 'AppAdminHub.tsx exists at expected path');

  const adminToolsCode = fs.readFileSync(adminToolsPath, 'utf-8');
  const appAdminHubCode = fs.readFileSync(appAdminHubPath, 'utf-8');

  // ---------------------------------------------------------
  // Suite 1: Static Decoupling & Zero-Fallback Code Asserts
  // ---------------------------------------------------------
  console.log('[Suite 1] Static Code Decoupling & Zero-Fallback Auditing');

  // Task 1.1: Assert components/portal/AdminTools.tsx contains 0 occurrences of CAMBRIDGE_QUESTIONS
  const adminToolsCQCount = (adminToolsCode.match(/CAMBRIDGE_QUESTIONS/g) || []).length;
  assertEqual(
    adminToolsCQCount,
    0,
    'components/portal/AdminTools.tsx contains 0 occurrences of CAMBRIDGE_QUESTIONS'
  );

  // Task 1.2: Assert components/portal/AdminTools.tsx contains 0 fallback references to CAMBRIDGE_TOPICS
  const adminToolsCTCount = (adminToolsCode.match(/CAMBRIDGE_TOPICS/g) || []).length;
  assertEqual(
    adminToolsCTCount,
    0,
    'components/portal/AdminTools.tsx contains 0 fallback references to CAMBRIDGE_TOPICS'
  );

  // Task 1.3: Assert components/admin/AppAdminHub.tsx contains 0 occurrences of CAMBRIDGE_QUESTIONS
  const appAdminHubCQCount = (appAdminHubCode.match(/CAMBRIDGE_QUESTIONS/g) || []).length;
  assertEqual(
    appAdminHubCQCount,
    0,
    'components/admin/AppAdminHub.tsx contains 0 occurrences of CAMBRIDGE_QUESTIONS'
  );

  // Additional static checks for database sync adherence
  assert(
    adminToolsCode.includes('loading: questionsLoading'),
    'AdminTools binds loading state to questionsLoading from useQuestions()'
  );
  assert(
    adminToolsCode.includes('setBankQuestions(createInitialBankItems(dbQuestions || []));'),
    'AdminTools syncs bankQuestions directly from dbQuestions via createInitialBankItems'
  );
  assert(
    adminToolsCode.includes('(dbQuestions || []).map'),
    'AdminTools assignQs derives directly from dbQuestions with zero mock fallback'
  );

  // ---------------------------------------------------------
  // Suite 2: Empty State & Component Definitions
  // ---------------------------------------------------------
  console.log('\n[Suite 2] Empty State & Component Definition Assertions');

  // Task 1.5: Test that when questions array is empty, empty state message ("Question Bank is Empty") is present
  assert(
    adminToolsCode.includes('Question Bank is Empty'),
    'AdminTools contains "Question Bank is Empty" empty state banner heading'
  );
  assert(
    adminToolsCode.includes('There are no questions in the repository yet. Ingest and publish exam papers in Ingestion Studio to build your question bank.'),
    'AdminTools contains descriptive guidance on how to populate empty question bank'
  );
  assert(
    adminToolsCode.includes('bankQuestions.length === 0'),
    'AdminTools conditionally checks bankQuestions.length === 0 to render the empty state'
  );
  assert(
    adminToolsCode.includes('Loading questions from database...'),
    'AdminTools renders dedicated loading feedback prior to resolving empty or populated state'
  );

  // ---------------------------------------------------------
  // Suite 3: Functional Tests for createInitialBankItems
  // ---------------------------------------------------------
  console.log('\n[Suite 3] createInitialBankItems Empty State & Mapping');

  // Task 1.4: Test createInitialBankItems([]) returns [] (empty array)
  const emptyOutput = createInitialBankItems([]);
  assert(Array.isArray(emptyOutput), 'createInitialBankItems([]) returns an array');
  assertEqual(emptyOutput.length, 0, 'createInitialBankItems([]) returns an empty array with length 0');
  assertEqual(emptyOutput, [], 'createInitialBankItems([]) strictly deep-equals []');

  // Task 1.6: Test that when questions array contains database items with UUIDs,
  // they map accurately to ID, stem, citation, topic, and status.
  console.log('\n[Suite 4] Database UUID Items Accurate Mapping');

  const mockDbUuidQuestions: Question[] = [
    {
      id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      stem_markdown: 'What is the opportunity cost of building a new hospital?',
      options: [
        { id: 'opt-1', text_markdown: 'Cost of materials' },
        { id: 'opt-2', text_markdown: 'Next best alternative forgone' },
        { id: 'opt-3', text_markdown: 'Tax revenue' },
        { id: 'opt-4', text_markdown: 'Wages of nurses' },
      ],
      correct_option_id: 'opt-2',
      citation: '0455/12/M/J/24 Q1',
      topic: 'The basic economic problem',
      topic_id: 'e47a52b4-e86e-4d69-b790-d7a5b5d15397',
      // Published / active by default
    } as any,
    {
      id: '8a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
      stem_markdown: 'Which factor causes a shift in the supply curve for coffee?',
      options: [
        { id: 'opt-5', text_markdown: 'A change in consumer taste' },
        { id: 'opt-6', text_markdown: 'A good harvest in coffee producing nations' },
        { id: 'opt-7', text_markdown: 'An increase in coffee consumer income' },
        { id: 'opt-8', text_markdown: 'A fall in tea prices' },
      ],
      correct_option_id: 'opt-6',
      citation: '0455/22/O/N/23 Q5',
      topic: 'The allocation of resources',
      topic_id: '6b7bf963-f082-467c-a7ca-812891a838ab',
      status: 'draft',
    } as any,
    {
      id: '9b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e',
      stem_markdown: 'How does a commercial bank create credit in an economy?',
      options: [
        { id: 'opt-9', text_markdown: 'Printing banknotes' },
        { id: 'opt-10', text_markdown: 'Making loans from customer deposits' },
        { id: 'opt-11', text_markdown: 'Purchasing government bonds' },
        { id: 'opt-12', text_markdown: 'Setting the minimum reserve requirement' },
      ],
      correct_option_id: 'opt-10',
      citation: '0455/11/M/J/22 Q14',
      topic: 'Microeconomic decision makers',
      topic_id: '76de1d41-45e1-46a2-9a23-714d283948f2',
      status: 'in_review',
    } as any,
    {
      id: '1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f',
      stem_markdown: 'Which measure is most likely to reduce cyclical unemployment?',
      options: [
        { id: 'opt-13', text_markdown: 'Increasing interest rates' },
        { id: 'opt-14', text_markdown: 'Expansionary fiscal policy' },
        { id: 'opt-15', text_markdown: 'Reducing unemployment benefits' },
        { id: 'opt-16', text_markdown: 'Encouraging early retirement' },
      ],
      correct_option_id: 'opt-14',
      citation: '0455/13/O/N/24 Q22',
      topic: 'Government and the macroeconomy',
      topic_id: '09266079-92a1-44f2-961d-daf0c1b2ac2b',
      status: 'withdrawn',
    } as any,
    {
      id: '2d3e4f5a-6b7c-8d9e-0f1a-2b3c4d5e6f7a',
      stem_markdown: 'A question that was deactivated by teacher or admin moderation',
      options: [],
      correct_option_id: '',
      citation: '0455/12/F/M/24 Q18',
      topic: 'Economic development',
      active: false,
    } as any,
    {
      id: '3e4f5a6b-7c8d-9e0f-1a2b-3c4d5e6f7a8b',
      stem_markdown: 'A question with minimal metadata to test fallbacks',
      options: [],
      correct_option_id: '',
      // citation is undefined -> should fallback to Q6
      // topic is undefined -> should fallback to 'General'
      // status is undefined, active is undefined -> default 'Live'
    } as any,
  ];

  const mapped = createInitialBankItems(mockDbUuidQuestions);

  assertEqual(mapped.length, 6, 'createInitialBankItems maps all 6 database items');

  // Verify Item 0: Published / Live with UUID
  assertEqual(mapped[0].id, 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Item 0 ID matches database UUID');
  assertEqual(mapped[0].stem, 'What is the opportunity cost of building a new hospital?', 'Item 0 stem accurately preserved');
  assertEqual(mapped[0].cite, '0455/12/M/J/24 Q1', 'Item 0 citation accurately preserved');
  assertEqual(mapped[0].paper, '0455/12/M/J/24', 'Item 0 paper code extracted from citation');
  assertEqual(mapped[0].topic, 'The basic economic problem', 'Item 0 topic accurately preserved');
  assertEqual(mapped[0].st, 'Live', 'Item 0 status maps to "Live"');
  assertEqual(mapped[0].stCls, getStatusBadgeClass('Live'), 'Item 0 badge class matches Live style');

  // Verify Item 1: Draft status with UUID
  assertEqual(mapped[1].id, '8a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'Item 1 ID matches database UUID');
  assertEqual(mapped[1].stem, 'Which factor causes a shift in the supply curve for coffee?', 'Item 1 stem accurately preserved');
  assertEqual(mapped[1].cite, '0455/22/O/N/23 Q5', 'Item 1 citation accurately preserved');
  assertEqual(mapped[1].topic, 'The allocation of resources', 'Item 1 topic accurately preserved');
  assertEqual(mapped[1].st, 'Agent draft', 'Item 1 status="draft" maps to "Agent draft"');
  assertEqual(mapped[1].stCls, getStatusBadgeClass('Agent draft'), 'Item 1 badge class matches Agent draft style');

  // Verify Item 2: In review status with UUID
  assertEqual(mapped[2].id, '9b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', 'Item 2 ID matches database UUID');
  assertEqual(mapped[2].stem, 'How does a commercial bank create credit in an economy?', 'Item 2 stem accurately preserved');
  assertEqual(mapped[2].cite, '0455/11/M/J/22 Q14', 'Item 2 citation accurately preserved');
  assertEqual(mapped[2].topic, 'Microeconomic decision makers', 'Item 2 topic accurately preserved');
  assertEqual(mapped[2].st, 'Needs review', 'Item 2 status="in_review" maps to "Needs review"');
  assertEqual(mapped[2].stCls, getStatusBadgeClass('Needs review'), 'Item 2 badge class matches Needs review style');

  // Verify Item 3: Withdrawn status with UUID
  assertEqual(mapped[3].id, '1c2d3e4f-5a6b-7c8d-9e0f-1a2b3c4d5e6f', 'Item 3 ID matches database UUID');
  assertEqual(mapped[3].stem, 'Which measure is most likely to reduce cyclical unemployment?', 'Item 3 stem accurately preserved');
  assertEqual(mapped[3].cite, '0455/13/O/N/24 Q22', 'Item 3 citation accurately preserved');
  assertEqual(mapped[3].topic, 'Government and the macroeconomy', 'Item 3 topic accurately preserved');
  assertEqual(mapped[3].st, 'Flagged', 'Item 3 status="withdrawn" maps to "Flagged"');
  assertEqual(mapped[3].stCls, getStatusBadgeClass('Flagged'), 'Item 3 badge class matches Flagged style');

  // Verify Item 4: Inactive (active: false) with UUID
  assertEqual(mapped[4].id, '2d3e4f5a-6b7c-8d9e-0f1a-2b3c4d5e6f7a', 'Item 4 ID matches database UUID');
  assertEqual(mapped[4].st, 'Flagged', 'Item 4 active=false maps to "Flagged"');
  assertEqual(mapped[4].stCls, getStatusBadgeClass('Flagged'), 'Item 4 badge class matches Flagged style');

  // Verify Item 5: Fallback metadata handling for minimal questions
  assertEqual(mapped[5].id, '3e4f5a6b-7c8d-9e0f-1a2b-3c4d5e6f7a8b', 'Item 5 ID matches database UUID');
  assertEqual(mapped[5].cite, 'Q6', 'Item 5 citation defaults to Q{index+1} when citation is missing');
  assertEqual(mapped[5].paper, 'None', 'Item 5 paper defaults to "None" when citation is missing');
  assertEqual(mapped[5].topic, 'General', 'Item 5 topic defaults to "General" when topic is missing');
  assertEqual(mapped[5].st, 'Live', 'Item 5 status defaults to "Live" when undefined');

  // ---------------------------------------------------------
  // Summary
  // ---------------------------------------------------------
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
  console.error('Fatal test error in verify-qbank-database-sync:', err);
  process.exit(1);
});

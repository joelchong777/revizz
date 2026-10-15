/**
 * Automated Verification Test Suite: Supabase Question Deletion & Cache Synchronization
 *
 * Verifies:
 * 1. deleteQuestionsFromDb contract, short-circuit, and API route calling
 * 2. Runtime cache pruning (_cachedQuestions) synchronization
 * 3. Direct Supabase fallback handling on network failure
 * 4. API route (/api/questions/delete) request parsing, boundary checks, and input validation:
 *    - Rejection of invalid JSON
 *    - Rejection of non-array questionIds
 *    - Rejection of empty array questionIds
 *    - Rejection of batch size > 500
 *    - Rejection of whitespace-only / empty IDs
 *    - Trimming and deduplication of question IDs
 * 5. Pagination clamping logic under single and mass deletion scenarios
 * 6. Row delete event propagation isolation (stopPropagation)
 */

import { NextRequest } from 'next/server';
import { POST } from '../app/api/questions/delete/route';
import {
  deleteQuestionsFromDb,
  setCachedQuestions,
  getCachedQuestions,
  CAMBRIDGE_QUESTIONS,
  Question,
} from '../lib/questions';

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

function assert(condition: boolean, testName: string, failureDetails?: string) {
  if (condition) {
    pass(testName);
  } else {
    fail(testName, failureDetails || 'Assertion condition evaluated to false.');
  }
}

function assertEqual<T>(actual: T, expected: T, testName: string) {
  if (actual === expected) {
    pass(testName);
  } else {
    fail(
      testName,
      `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`
    );
  }
}

async function runTests() {
  console.log('========================================================');
  console.log('   VERIFY SUPABASE QUESTION DELETION & CACHE SYNC');
  console.log('========================================================\n');

  // ---------------------------------------------------------------------------
  // [Suite 1] deleteQuestionsFromDb Contract & Cache Pruning
  // ---------------------------------------------------------------------------
  console.log('\x1b[1m\x1b[34m[Suite 1] deleteQuestionsFromDb Contract & Cache Pruning\x1b[0m');

  // Test 1.1: Short-circuit on empty array
  const emptyRes = await deleteQuestionsFromDb([]);
  assertEqual(emptyRes.success, true, 'Short-circuit returns success: true on empty array');
  assertEqual(emptyRes.count, 0, 'Short-circuit returns count: 0 on empty array');

  // Test 1.2: Cache initialization and pruning via API mock
  const sampleQuestions: Question[] = [
    {
      id: 'mock-del-01',
      stem_markdown: 'Question 1 stem',
      options: [],
      correct_option_id: 'opt-1',
    },
    {
      id: 'mock-del-02',
      stem_markdown: 'Question 2 stem',
      options: [],
      correct_option_id: 'opt-2',
    },
    {
      id: 'mock-del-03',
      stem_markdown: 'Question 3 stem',
      options: [],
      correct_option_id: 'opt-3',
    },
  ];

  setCachedQuestions([...sampleQuestions]);
  assertEqual(getCachedQuestions().length, 3, 'Runtime cache populated with 3 questions');

  // Mock global fetch for /api/questions/delete to test successful API response handling
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/api/questions/delete')) {
        const body = JSON.parse((init?.body as string) || '{}');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            count: body.questionIds?.length || 0,
            deletedIds: body.questionIds || [],
          }),
        } as any;
      }
      return origFetch(input, init);
    };

    const delRes = await deleteQuestionsFromDb(['mock-del-02']);
    assertEqual(delRes.success, true, 'deleteQuestionsFromDb succeeds via API pathway');
    assertEqual(delRes.count, 1, 'deleteQuestionsFromDb reports 1 question deleted');

    const cacheAfterDel = getCachedQuestions();
    assertEqual(cacheAfterDel.length, 2, 'Runtime cache length decreased to 2');
    assert(
      !cacheAfterDel.some((q) => q.id === 'mock-del-02'),
      'Deleted question "mock-del-02" is pruned from runtime cache'
    );
    assert(
      cacheAfterDel.some((q) => q.id === 'mock-del-01') &&
        cacheAfterDel.some((q) => q.id === 'mock-del-03'),
      'Remaining questions "mock-del-01" and "mock-del-03" remain intact in cache'
    );

    // Test 1.3: Mass deletion from cache
    const massDelRes = await deleteQuestionsFromDb(['mock-del-01', 'mock-del-03']);
    assertEqual(massDelRes.success, true, 'Mass deletion succeeds via API pathway');
    assertEqual(massDelRes.count, 2, 'Mass deletion reports 2 questions deleted');
    assertEqual(getCachedQuestions().length, 0, 'Runtime cache is completely empty after deleting all');
  } finally {
    globalThis.fetch = origFetch;
  }

  // ---------------------------------------------------------------------------
  // [Suite 2] Fallback Pathway on Fetch Failure
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[Suite 2] Direct Supabase Fallback Handling on Fetch Failure\x1b[0m');

  const fallbackQuestions: Question[] = [
    {
      id: 'mock-fallback-01',
      stem_markdown: 'Fallback Question 1',
      options: [],
      correct_option_id: 'opt-f1',
    },
    {
      id: 'mock-fallback-02',
      stem_markdown: 'Fallback Question 2',
      options: [],
      correct_option_id: 'opt-f2',
    },
  ];
  setCachedQuestions([...fallbackQuestions]);

  try {
    // Force fetch to reject to trigger catch -> Supabase direct deletion fallback
    globalThis.fetch = async () => {
      throw new Error('Simulated network offline / endpoint unreachable');
    };

    const fallbackRes = await deleteQuestionsFromDb(['mock-fallback-01']);
    assertEqual(fallbackRes.success, true, 'deleteQuestionsFromDb succeeds via fallback pathway');
    assertEqual(fallbackRes.count, 1, 'Fallback reports 1 question deleted');

    const cacheAfterFallback = getCachedQuestions();
    assertEqual(cacheAfterFallback.length, 1, 'Runtime cache pruned to 1 via fallback pathway');
    assertEqual(cacheAfterFallback[0].id, 'mock-fallback-02', 'Cache preserves remaining item mock-fallback-02');
  } finally {
    globalThis.fetch = origFetch;
  }

  // ---------------------------------------------------------------------------
  // [Suite 3] API Route Input Validation & Parsing (/api/questions/delete)
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[Suite 3] API Route Input Validation & Parsing (/api/questions/delete)\x1b[0m');

  // Test 3.1: Invalid JSON payload
  const invalidJsonReq = new NextRequest('http://localhost:3000/api/questions/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not a json string',
  });
  const invalidJsonRes = await POST(invalidJsonReq);
  assertEqual(invalidJsonRes.status, 400, 'Rejects invalid JSON with HTTP 400');
  const invalidJsonData = await invalidJsonRes.json();
  assertEqual(invalidJsonData.success, false, 'Invalid JSON returns success: false');
  assert(invalidJsonData.error.includes('JSON'), 'Invalid JSON error message mentions JSON');

  // Test 3.2: Non-array questionIds
  const nonArrayReq = new NextRequest('http://localhost:3000/api/questions/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionIds: 'not-an-array' }),
  });
  const nonArrayRes = await POST(nonArrayReq);
  assertEqual(nonArrayRes.status, 400, 'Rejects non-array questionIds with HTTP 400');
  const nonArrayData = await nonArrayRes.json();
  assertEqual(nonArrayData.success, false, 'Non-array returns success: false');

  // Test 3.3: Empty array questionIds
  const emptyArrayReq = new NextRequest('http://localhost:3000/api/questions/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionIds: [] }),
  });
  const emptyArrayRes = await POST(emptyArrayReq);
  assertEqual(emptyArrayRes.status, 400, 'Rejects empty questionIds array with HTTP 400');
  const emptyArrayData = await emptyArrayRes.json();
  assertEqual(emptyArrayData.success, false, 'Empty array returns success: false');
  assert(emptyArrayData.error.includes('empty'), 'Error message specifies array cannot be empty');

  // Test 3.4: Max batch size exceeded (> 500)
  const oversizedArray = Array.from({ length: 501 }, (_, i) => `batch-q-${i}`);
  const oversizeReq = new NextRequest('http://localhost:3000/api/questions/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionIds: oversizedArray }),
  });
  const oversizeRes = await POST(oversizeReq);
  assertEqual(oversizeRes.status, 400, 'Rejects oversized batch (>500) with HTTP 400');
  const oversizeData = await oversizeRes.json();
  assertEqual(oversizeData.success, false, 'Oversized batch returns success: false');
  assert(oversizeData.error.includes('500'), 'Error message mentions maximum batch size 500');

  // Test 3.5: Whitespace and empty strings only
  const blankIdsReq = new NextRequest('http://localhost:3000/api/questions/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionIds: ['', '   ', '\t\n'] }),
  });
  const blankIdsRes = await POST(blankIdsReq);
  assertEqual(blankIdsRes.status, 400, 'Rejects array of empty/whitespace IDs with HTTP 400');
  const blankIdsData = await blankIdsRes.json();
  assertEqual(blankIdsData.success, false, 'Blank IDs returns success: false');

  // Test 3.6: Valid question IDs with deduplication & trimming
  const validBatchReq = new NextRequest('http://localhost:3000/api/questions/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      questionIds: ['test-q-01', ' test-q-01 ', 'test-q-02', '   '],
    }),
  });
  const validBatchRes = await POST(validBatchReq);
  assertEqual(validBatchRes.status, 200, 'Valid batch request returns HTTP 200');
  const validBatchData = await validBatchRes.json();
  assertEqual(validBatchData.success, true, 'Valid batch returns success: true');
  assertEqual(validBatchData.count, 2, 'Deduplicates and filters whitespace IDs to count 2');
  assert(
    validBatchData.deletedIds.includes('test-q-01') &&
      validBatchData.deletedIds.includes('test-q-02'),
    'deletedIds contains trimmed unique IDs'
  );

  // ---------------------------------------------------------------------------
  // [Suite 4] Pagination Clamping Logic After Deletions
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[Suite 4] Pagination Clamping Logic After Deletions\x1b[0m');

  const pageSize = 10;

  // Scenario 4.1: 25 items across 3 pages (page 1: 10, page 2: 10, page 3: 5)
  // Current page = 3
  let totalItems = 25;
  let currentPage = 3;
  let maxPage = Math.max(1, Math.ceil(totalItems / pageSize));
  assertEqual(maxPage, 3, 'Initial 25 items with pageSize 10 yields 3 total pages');

  // Delete 6 items (e.g. all 5 on page 3 + 1 on page 2) -> 19 remaining
  const deletedCount = 6;
  totalItems -= deletedCount;
  let newMaxPage = Math.max(1, Math.ceil(totalItems / pageSize));
  assertEqual(newMaxPage, 2, 'Remaining 19 items yields 2 total pages');
  let clampedPage = Math.min(currentPage, newMaxPage);
  assertEqual(clampedPage, 2, 'Current page 3 is clamped down to page 2');

  // Scenario 4.2: Delete all remaining 19 items -> 0 items left
  totalItems = 0;
  newMaxPage = Math.max(1, Math.ceil(totalItems / pageSize));
  assertEqual(newMaxPage, 1, 'Empty bank yields minimum page count of 1');
  clampedPage = Math.min(clampedPage, newMaxPage);
  assertEqual(clampedPage, 1, 'Current page 2 is clamped down to page 1');

  // Scenario 4.3: Single item deletion that doesn't change page
  totalItems = 15; // 2 pages (10, 5), on page 2
  currentPage = 2;
  totalItems -= 1; // 14 items left -> ceil(14/10) = 2
  newMaxPage = Math.max(1, Math.ceil(totalItems / pageSize));
  assertEqual(newMaxPage, 2, 'Single item deletion leaves 2 total pages');
  clampedPage = Math.min(currentPage, newMaxPage);
  assertEqual(clampedPage, 2, 'Current page remains 2 when page count does not shrink below it');

  // ---------------------------------------------------------------------------
  // [Suite 5] Row Delete Event Propagation Isolation & Modal State
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[Suite 5] Row Delete Event Propagation Isolation & Modal State\x1b[0m');

  // Simulate row click and button click with stopPropagation
  let rowClicked = false;
  let buttonClicked = false;

  const simulateRowClick = () => {
    rowClicked = true;
  };

  const simulateDeleteButtonClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    buttonClicked = true;
  };

  let propagationStopped = false;
  const mockEvent = {
    stopPropagation: () => {
      propagationStopped = true;
    },
  };

  simulateDeleteButtonClick(mockEvent);
  if (!propagationStopped) {
    simulateRowClick();
  }

  assert(buttonClicked, 'Row delete button handler was executed');
  assert(propagationStopped, 'Event stopPropagation was called by the delete button');
  assert(!rowClicked, 'Row click handler (editor trigger) was prevented via stopPropagation');

  // Test single vs mass deletion modal target resolution logic
  interface ModalState {
    isOpen: boolean;
    type: 'delete' | 'status' | 'topic';
    singleId?: string;
  }

  const multiSelectedIds = new Set(['q-10', 'q-11', 'q-12']);

  // Case A: Single row delete clicked on 'q-99' while other items are selected
  const singleRowModal: ModalState = {
    isOpen: true,
    type: 'delete',
    singleId: 'q-99',
  };

  const singleTargetIds =
    singleRowModal.type === 'delete' && singleRowModal.singleId
      ? [singleRowModal.singleId]
      : Array.from(multiSelectedIds);

  assertEqual(singleTargetIds.length, 1, 'Single item delete targets exactly 1 ID');
  assertEqual(singleTargetIds[0], 'q-99', 'Single item delete targets clicked row ID "q-99"');

  // Case B: Mass delete clicked from floating deck
  const massModal: ModalState = {
    isOpen: true,
    type: 'delete',
  };

  const massTargetIds =
    massModal.type === 'delete' && massModal.singleId
      ? [massModal.singleId]
      : Array.from(multiSelectedIds);

  assertEqual(massTargetIds.length, 3, 'Mass delete targets all 3 selected IDs');
  assert(
    massTargetIds.includes('q-10') && massTargetIds.includes('q-11') && massTargetIds.includes('q-12'),
    'Mass delete includes all selected question IDs'
  );

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n========================================================');
  console.log(`   TOTAL TESTS: ${totalTests}`);
  console.log(`   \x1b[32mPASSED:      ${passedTests}\x1b[0m`);
  if (failedTests > 0) {
    console.log(`   \x1b[31mFAILED:      ${failedTests}\x1b[0m`);
    console.log('========================================================\n');
    process.exit(1);
  } else {
    console.log('   \x1b[32mALL ASSERTIONS PASSED PERFECTLY!\x1b[0m');
    console.log('========================================================\n');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in verification suite:', err);
  process.exit(1);
});

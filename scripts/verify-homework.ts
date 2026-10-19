/**
 * Revizz Student Homework & Online Assessment Engine Verification Suite
 * Standalone TypeScript verification script (pure TS, zero TSX).
 *
 * Verifies:
 * 1. Default seed Cambridge assignments (ECO-0455-HW1, ECO-0455-HW2, ECO-0455-HW3)
 * 2. Case-insensitive findAssignmentByTestCode lookup
 * 3. Submission persistence and retrieval (saveHomeworkSubmission / getHomeworkSubmissions)
 * 4. Homework status calculation (pending, completed, overdue)
 * 5. Teacher online assignment integration (listOnlineAssignments + seed assignments)
 */

// Polyfill in-memory localStorage & window for Node test environment
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }

  get length(): number {
    return this.store.size;
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = {
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
};

import {
  getHomeworkAssignments,
  findAssignmentByTestCode,
  getHomeworkSubmissions,
  saveHomeworkSubmission,
  getSeedHomeworkAssignments,
  HOMEWORK_SUBMISSIONS_KEY,
  HomeworkSubmission,
} from '../lib/homework';
import { saveOnlineAssignment, listOnlineAssignments } from '../lib/testCompiler';
import { OnlineQuizAssignment } from '../types/testCompiler';

// Assertion helpers
let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, message: string): void {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ ${message}`);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  totalTests++;
  if (actual !== expected) {
    console.error(`❌ FAIL: ${message} (Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ ${message}`);
}

function runTests() {
  console.log('\n======================================================');
  console.log('  RUNNING REVIZZ STUDENT HOMEWORK VERIFICATION SUITE  ');
  console.log('======================================================\n');

  // -------------------------------------------------------------------------
  // Test 1: getHomeworkAssignments returns default seed assignments on empty storage
  // -------------------------------------------------------------------------
  console.log('[Test 1] Default Seed Assignments on Clean State:');
  mockStorage.clear();

  const initialItems = getHomeworkAssignments();
  assertEqual(initialItems.length, 3, 'Returns exactly 3 seed assignments when localStorage is clean');

  const hw1 = initialItems.find((i) => i.testCode === 'ECO-0455-HW1');
  assert(Boolean(hw1), 'Seed assignment ECO-0455-HW1 is present');
  assertEqual(hw1?.subjectCode, '0455', 'ECO-0455-HW1 has subjectCode 0455');
  assertEqual(hw1?.subjectName, 'Economics', 'ECO-0455-HW1 has subjectName Economics');
  assertEqual(hw1?.cohortName, 'Year 10 Cambridge Economics', 'ECO-0455-HW1 has Year 10 Cambridge Economics cohort');
  assertEqual(hw1?.questionIds.length, 5, 'ECO-0455-HW1 has 5 Cambridge question IDs');
  assertEqual(hw1?.status, 'pending', 'ECO-0455-HW1 has initial status pending');
  assertEqual(hw1?.isOverdue, false, 'ECO-0455-HW1 is not overdue');
  assert((hw1?.daysRemaining || 0) > 0, 'ECO-0455-HW1 has positive days remaining');

  const hw2 = initialItems.find((i) => i.testCode === 'ECO-0455-HW2');
  assert(Boolean(hw2), 'Seed assignment ECO-0455-HW2 is present');
  assertEqual(hw2?.status, 'pending', 'ECO-0455-HW2 has initial status pending');

  const hw3 = initialItems.find((i) => i.testCode === 'ECO-0455-HW3');
  assert(Boolean(hw3), 'Seed assignment ECO-0455-HW3 is present');
  assertEqual(hw3?.status, 'pending', 'ECO-0455-HW3 has initial status pending');

  // -------------------------------------------------------------------------
  // Test 2: findAssignmentByTestCode lookup
  // -------------------------------------------------------------------------
  console.log('\n[Test 2] Case-Insensitive findAssignmentByTestCode:');

  const foundUpper = findAssignmentByTestCode('ECO-0455-HW1');
  assert(Boolean(foundUpper), 'findAssignmentByTestCode finds ECO-0455-HW1 in uppercase');
  assertEqual(foundUpper?.id, 'ECO-0455-HW1', 'Matched assignment has expected ID');

  const foundLower = findAssignmentByTestCode('eco-0455-hw1');
  assert(Boolean(foundLower), 'findAssignmentByTestCode finds assignment case-insensitively with lowercase input');
  assertEqual(foundLower?.testCode, 'ECO-0455-HW1', 'Matched test code normalized');

  const foundWithWhitespace = findAssignmentByTestCode('   ECO-0455-HW2   ');
  assert(Boolean(foundWithWhitespace), 'findAssignmentByTestCode handles leading/trailing whitespace');
  assertEqual(foundWithWhitespace?.testCode, 'ECO-0455-HW2', 'Matched ECO-0455-HW2');

  const notFound = findAssignmentByTestCode('INVALID-CODE-999');
  assertEqual(notFound, null, 'findAssignmentByTestCode returns null for nonexistent code');

  const emptyCode = findAssignmentByTestCode('');
  assertEqual(emptyCode, null, 'findAssignmentByTestCode returns null for empty string');

  // -------------------------------------------------------------------------
  // Test 3: saveHomeworkSubmission and getHomeworkSubmissions persistence
  // -------------------------------------------------------------------------
  console.log('\n[Test 3] Submission Recording & Persistence:');

  const emptySubmissions = getHomeworkSubmissions();
  assertEqual(Object.keys(emptySubmissions).length, 0, 'getHomeworkSubmissions returns empty object initially');

  const submission1: HomeworkSubmission = {
    assignmentId: 'ECO-0455-HW1',
    testCode: 'ECO-0455-HW1',
    completedAt: new Date().toISOString(),
    score: 5,
    totalQuestions: 5,
    percentage: 100,
    timeSpentSeconds: 145,
    answers: {
      '0455-s24-12-q01': '0455-s24-12-q01-opt-d',
      '0455-s24-12-q02': '0455-s24-12-q02-opt-c',
    },
  };

  saveHomeworkSubmission(submission1);

  const storedSubmissions = getHomeworkSubmissions();
  assert(Boolean(storedSubmissions['ECO-0455-HW1']), 'Submission is retrieved by assignmentId');
  assertEqual(storedSubmissions['ECO-0455-HW1'].score, 5, 'Stored submission has score 5');
  assertEqual(storedSubmissions['ECO-0455-HW1'].percentage, 100, 'Stored submission has percentage 100');
  assertEqual(storedSubmissions['ECO-0455-HW1'].timeSpentSeconds, 145, 'Stored submission tracks time spent');

  // -------------------------------------------------------------------------
  // Test 4: Status calculation - Pending -> Completed
  // -------------------------------------------------------------------------
  console.log('\n[Test 4] Status Calculation (Pending -> Completed):');

  const itemsAfterSub = getHomeworkAssignments();
  const completedHw1 = itemsAfterSub.find((i) => i.testCode === 'ECO-0455-HW1');
  assert(Boolean(completedHw1), 'ECO-0455-HW1 still in homework list');
  assertEqual(completedHw1?.status, 'completed', 'ECO-0455-HW1 status updated to completed');
  assertEqual(completedHw1?.isOverdue, false, 'Completed assignment is not overdue');
  assert(Boolean(completedHw1?.submission), 'Completed assignment includes submission data');
  assertEqual(completedHw1?.submission?.percentage, 100, 'Submission percentage is 100%');

  // Verify other assignments remain pending
  const hw2After = itemsAfterSub.find((i) => i.testCode === 'ECO-0455-HW2');
  assertEqual(hw2After?.status, 'pending', 'ECO-0455-HW2 remains pending');

  // -------------------------------------------------------------------------
  // Test 5: Overdue status calculation
  // -------------------------------------------------------------------------
  console.log('\n[Test 5] Status Calculation (Overdue & Recovery):');

  const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const overdueAssignment: OnlineQuizAssignment = {
    id: 'OVERDUE-TEST-01',
    title: 'IGCSE Past Deadline Task',
    subjectCode: '0455',
    subjectName: 'Economics',
    cohortName: 'Year 10 Cambridge Economics',
    dueDate: pastDate,
    durationMinutes: 15,
    questionIds: ['0455-s24-12-q01', '0455-s24-12-q02'],
    testCode: 'OVERDUE-01',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  };

  saveOnlineAssignment(overdueAssignment);

  const itemsWithOverdue = getHomeworkAssignments();
  const overdueItem = itemsWithOverdue.find((i) => i.id === 'OVERDUE-TEST-01');
  assert(Boolean(overdueItem), 'Overdue assignment appears in homework list');
  assertEqual(overdueItem?.status, 'overdue', 'Past-due unsubmitted assignment has status overdue');
  assertEqual(overdueItem?.isOverdue, true, 'isOverdue flag is true for past-due unsubmitted assignment');
  assert((overdueItem?.daysRemaining || 0) <= 0, 'daysRemaining is non-positive for overdue assignment');

  // Now submit the overdue assignment - it should become completed
  const overdueSubmission: HomeworkSubmission = {
    assignmentId: 'OVERDUE-TEST-01',
    testCode: 'OVERDUE-01',
    completedAt: new Date().toISOString(),
    score: 2,
    totalQuestions: 2,
    percentage: 100,
  };
  saveHomeworkSubmission(overdueSubmission);

  const itemsAfterOverdueSub = getHomeworkAssignments();
  const resolvedOverdue = itemsAfterOverdueSub.find((i) => i.id === 'OVERDUE-TEST-01');
  assertEqual(resolvedOverdue?.status, 'completed', 'Submitted overdue assignment transitions to completed');
  assertEqual(resolvedOverdue?.isOverdue, false, 'Submitted overdue assignment has isOverdue: false');

  // -------------------------------------------------------------------------
  // Test 6: Teacher Online Assignment + Seed Combinations
  // -------------------------------------------------------------------------
  console.log('\n[Test 6] Teacher-Created Online Assignments Combination:');

  const teacherAssignment: OnlineQuizAssignment = {
    id: 'TEACHER-ASSIGN-01',
    title: 'IGCSE Biology: Cell Structure and Microscopy',
    subjectCode: '0610',
    subjectName: 'Biology',
    cohortName: 'Year 10 Cambridge Science',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 20,
    questionIds: ['0455-s24-12-q01', '0455-s24-12-q02', '0455-s24-12-q03'],
    testCode: 'BIO-0610-HW1',
    createdAt: new Date().toISOString(),
  };

  saveOnlineAssignment(teacherAssignment);

  // Verify listOnlineAssignments contains the teacher assignments
  const teacherList = listOnlineAssignments();
  assert(teacherList.some((t) => t.testCode === 'BIO-0610-HW1'), 'Teacher assignment saved to localStorage');

  // Verify getHomeworkAssignments combines teacher + seed assignments
  const allHomework = getHomeworkAssignments();
  assert(allHomework.some((h) => h.testCode === 'BIO-0610-HW1'), 'Teacher assignment included in homework list');
  assert(allHomework.some((h) => h.testCode === 'ECO-0455-HW2'), 'Seed assignments still present alongside teacher assignments');

  // Verify findAssignmentByTestCode finds teacher-created assignment
  const foundTeacher = findAssignmentByTestCode('BIO-0610-HW1');
  assert(Boolean(foundTeacher), 'findAssignmentByTestCode finds teacher assignment BIO-0610-HW1');
  assertEqual(foundTeacher?.subjectCode, '0610', 'Teacher assignment subjectCode is 0610');

  console.log('\n======================================================');
  console.log(`  ALL ${passedTests}/${totalTests} HOMEWORK TESTS PASSED PERFECTLY!`);
  console.log('======================================================\n');
}

runTests();

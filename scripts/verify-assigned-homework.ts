/**
 * Revizz QA & Verification Test Suite
 *
 * Account-Unique Assigned Homework Engine & Data Invariants Verification
 * File: scripts/verify-assigned-homework.ts
 *
 * Test Suites Covered:
 * 1. Account Isolation & Educator Uniqueness
 * 2. CRUD Operations & Full Metadata Fidelity
 * 3. Student Submissions & Score Tracking Invariants
 * 4. Access Code Lookup & Universal Resolution
 * 5. Due Date Evaluation & Filter Invariants
 * 6. Demo Seeding & Idempotency
 * 7. Change Event Subscription & Storage Interoperability
 */

// ============================================================================
// 1. IN-MEMORY LOCALSTORAGE & WINDOW POLYFILL FOR NODE RUNTIME
// ============================================================================

class MockLocalStorage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
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
    const keys = Array.from(this.store.keys());
    return keys[index] ?? null;
  }
}

const mockStorage = new MockLocalStorage();

type EventListener = (event: any) => void;

class MockWindow {
  public localStorage = mockStorage;
  private listeners: Record<string, EventListener[]> = {};

  addEventListener(type: string, listener: EventListener): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
  }

  dispatchEvent(event: any): boolean {
    const type = event?.type;
    if (type && this.listeners[type]) {
      for (const fn of this.listeners[type]) {
        try {
          fn(event);
        } catch (e) {
          console.error('Error in window listener:', e);
        }
      }
    }
    return true;
  }
}

class MockCustomEvent {
  public type: string;
  public detail: any;
  constructor(type: string, init?: { detail?: any }) {
    this.type = type;
    this.detail = init?.detail;
  }
}

// Inject globals before module evaluation
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = new MockWindow();
(globalThis as any).CustomEvent = MockCustomEvent;

// ============================================================================
// 2. IMPORT MODULE UNDER TEST
// ============================================================================

import {
  AssignedHomeworkRound,
  StudentSubmission,
  getAssignedHomeworkList,
  getAssignedHomeworkById,
  getAssignedHomeworkByCode,
  findHomeworkByIdAnyTeacher,
  saveAssignedHomework,
  deleteAssignedHomework,
  recordStudentSubmission,
  computeHomeworkMetrics,
  isHomeworkDue,
  seedInitialHomeworkIfEmpty,
  subscribeToHomeworkChanges,
  getStorageKey,
  HOMEWORK_CHANGED_EVENT,
} from '../lib/portal/assignedHomework';

import { listOnlineAssignments } from '../lib/testCompiler';

// ============================================================================
// 3. TEST HARNESS & ASSERTIONS
// ============================================================================

interface TestCase {
  id: string;
  suite: string;
  name: string;
  fn: () => void;
}

const testCases: TestCase[] = [];

function registerTest(id: string, suite: string, name: string, fn: () => void) {
  testCases.push({ id, suite, name, fn });
}

function assert(condition: boolean, msg: string): void {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
}

function assertEqual<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    throw new Error(
      `Assertion Failed: ${msg} | Expected [${expected}] (${typeof expected}) but got [${actual}] (${typeof actual})`
    );
  }
}

function assertDeepEqual<T>(actual: T, expected: T, msg: string): void {
  const actJson = JSON.stringify(actual);
  const expJson = JSON.stringify(expected);
  if (actJson !== expJson) {
    throw new Error(
      `Assertion Failed: ${msg} | Expected:\n${expJson}\nGot:\n${actJson}`
    );
  }
}

// Helper to reset mock storage between suites if needed
function resetStorage(): void {
  mockStorage.clear();
}

// Sample Round Factory
function createSampleRound(
  overrides: Partial<AssignedHomeworkRound> = {}
): AssignedHomeworkRound {
  const id = overrides.id || `hw-test-${Math.random().toString(36).substring(2, 9)}`;
  return {
    id,
    teacherId: 'teacher-101',
    teacherName: 'Dr. Jane Smith',
    title: 'Macroeconomics Inflation Drill',
    subjectCode: '0455',
    subjectName: 'Economics',
    cohortName: '10 Economics',
    testCode: overrides.testCode || `REV-${Math.floor(100 + Math.random() * 900)}`,
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 20,
    timerMode: 'Exam',
    roundLength: 10,
    topics: ['Inflation', 'Monetary Policy'],
    questionIds: ['q_0455_01', 'q_0455_02', 'q_0455_03'],
    status: 'active',
    settings: {
      allowRetry: true,
      retryXpPercentage: 50,
      addToReviewPile: true,
      shuffleOptions: true,
    },
    totalStudents: 25,
    submissions: [],
    ...overrides,
  };
}

// ============================================================================
// SUITE 1: ACCOUNT ISOLATION & EDUCATOR UNIQUENESS
// ============================================================================

registerTest(
  'ISO_01',
  'Account Isolation',
  'Storage keys are distinct and account-unique per educator ID',
  () => {
    resetStorage();
    const keyA = getStorageKey('teacher-101');
    const keyB = getStorageKey('teacher-202');
    const keyUpper = getStorageKey('  TEACHER-101  ');

    assert(keyA !== keyB, 'Keys for different teachers must not collide');
    assertEqual(keyA, 'revizz_assigned_homework_v1_teacher-101', 'Key matches format');
    assertEqual(keyA, keyUpper, 'getStorageKey normalizes trimming and lowercase');
  }
);

registerTest(
  'ISO_02',
  'Account Isolation',
  'Homework lists are strictly partitioned between Teacher A and Teacher B',
  () => {
    resetStorage();
    const teacherA = 'teacher-101';
    const teacherB = 'teacher-202';

    const roundA1 = createSampleRound({ id: 'hw-a1', teacherId: teacherA, title: 'Teacher A Round 1' });
    const roundA2 = createSampleRound({ id: 'hw-a2', teacherId: teacherA, title: 'Teacher A Round 2' });
    const roundB1 = createSampleRound({ id: 'hw-b1', teacherId: teacherB, title: 'Teacher B Round 1' });

    saveAssignedHomework(teacherA, roundA1);
    saveAssignedHomework(teacherA, roundA2);
    saveAssignedHomework(teacherB, roundB1);

    const listA = getAssignedHomeworkList(teacherA);
    const listB = getAssignedHomeworkList(teacherB);

    assertEqual(listA.length, 2, 'Teacher A should have exactly 2 assignments');
    assertEqual(listB.length, 1, 'Teacher B should have exactly 1 assignment');

    assert(listA.some((h) => h.id === 'hw-a1'), 'List A contains hw-a1');
    assert(listA.some((h) => h.id === 'hw-a2'), 'List A contains hw-a2');
    assert(!listA.some((h) => h.id === 'hw-b1'), 'List A must NOT contain Teacher B assignments');

    assert(listB.some((h) => h.id === 'hw-b1'), 'List B contains hw-b1');
    assert(!listB.some((h) => h.id === 'hw-a1'), 'List B must NOT contain Teacher A assignments');
  }
);

registerTest(
  'ISO_03',
  'Account Isolation',
  'Teacher B cannot read Teacher A assignments via scoped getAssignedHomeworkById',
  () => {
    resetStorage();
    const teacherA = 'teacher-101';
    const teacherB = 'teacher-202';

    const roundA = createSampleRound({ id: 'hw-secret-a', teacherId: teacherA });
    saveAssignedHomework(teacherA, roundA);

    // Reading with Teacher A credentials succeeds
    const foundA = getAssignedHomeworkById(teacherA, 'hw-secret-a');
    assert(foundA !== null, 'Teacher A can read own homework');
    assertEqual(foundA?.id, 'hw-secret-a', 'ID matches');

    // Reading with Teacher B credentials returns null
    const foundB = getAssignedHomeworkById(teacherB, 'hw-secret-a');
    assertEqual(foundB, null, 'Teacher B cannot read Teacher A homework via scoped lookup');
  }
);

registerTest(
  'ISO_04',
  'Account Isolation',
  'Teacher B cannot delete Teacher A assignments',
  () => {
    resetStorage();
    const teacherA = 'teacher-101';
    const teacherB = 'teacher-202';

    const roundA = createSampleRound({ id: 'hw-protected-a', teacherId: teacherA });
    saveAssignedHomework(teacherA, roundA);

    // Teacher B tries to delete Teacher A's homework
    const deleteResult = deleteAssignedHomework(teacherB, 'hw-protected-a');
    assertEqual(deleteResult, false, 'deleteAssignedHomework must return false for cross-account delete');

    // Verify Teacher A's homework was not deleted
    const listA = getAssignedHomeworkList(teacherA);
    assertEqual(listA.length, 1, 'Teacher A homework must remain intact');
    assertEqual(listA[0].id, 'hw-protected-a', 'hw-protected-a is preserved');
  }
);

registerTest(
  'ISO_05',
  'Account Isolation',
  'Empty or undefined teacher IDs safely map to guest-educator-local fallback',
  () => {
    resetStorage();
    const guestKey1 = getStorageKey('');
    const guestKey2 = getStorageKey(undefined as any);
    const guestKey3 = getStorageKey('guest-educator-local');

    assertEqual(guestKey1, 'revizz_assigned_homework_v1_guest-educator-local', 'Empty maps to guest key');
    assertEqual(guestKey2, 'revizz_assigned_homework_v1_guest-educator-local', 'Undefined maps to guest key');
    assertEqual(guestKey1, guestKey3, 'Empty matches explicit guest key');
  }
);

// ============================================================================
// SUITE 2: CRUD OPERATIONS & FULL METADATA FIDELITY
// ============================================================================

registerTest(
  'CRUD_01',
  'CRUD Operations',
  'Create and save new assignment with all metadata attributes',
  () => {
    resetStorage();
    const teacherId = 'teacher-crud';
    const newRound: AssignedHomeworkRound = {
      id: 'hw-crud-001',
      teacherId,
      teacherName: 'Prof. Alistair Finch',
      title: 'Electromagnetism Master Quiz',
      subjectCode: '0625',
      subjectName: 'Physics',
      cohortName: '11A Physics',
      testCode: 'REV-999',
      createdAt: '2026-10-19T10:00:00.000Z',
      dueDate: '2026-10-26T23:59:59.000Z',
      durationMinutes: 30,
      timerMode: 'Exam',
      roundLength: 15,
      topics: ['Electromagnetism', 'Right-hand rule', 'Transformers'],
      questionIds: ['q-em-01', 'q-em-02', 'q-em-03', 'q-em-04'],
      status: 'active',
      settings: {
        allowRetry: false,
        retryXpPercentage: 0,
        addToReviewPile: true,
        shuffleOptions: true,
      },
      totalStudents: 32,
      submissions: [],
    };

    saveAssignedHomework(teacherId, newRound);

    const saved = getAssignedHomeworkById(teacherId, 'hw-crud-001');
    assert(saved !== null, 'Saved assignment must be retrievable');
    assertEqual(saved?.id, newRound.id, 'id matches');
    assertEqual(saved?.title, newRound.title, 'title matches');
    assertEqual(saved?.cohortName, newRound.cohortName, 'cohort matches');
    assertEqual(saved?.subjectCode, newRound.subjectCode, 'subjectCode matches');
    assertEqual(saved?.dueDate, newRound.dueDate, 'dueDate matches');
    assertEqual(saved?.durationMinutes, 30, 'durationMinutes matches');
    assertEqual(saved?.timerMode, 'Exam', 'timerMode matches');
    assertEqual(saved?.roundLength, 15, 'roundLength matches');
    assertEqual(saved?.settings.allowRetry, false, 'settings.allowRetry matches');
    assertEqual(saved?.settings.shuffleOptions, true, 'settings.shuffleOptions matches');
    assertDeepEqual(saved?.topics, newRound.topics, 'topics match');
    assertDeepEqual(saved?.questionIds, newRound.questionIds, 'questionIds match');
  }
);

registerTest(
  'CRUD_02',
  'CRUD Operations',
  'Update assignment fields persists in place without creating duplicates',
  () => {
    resetStorage();
    const teacherId = 'teacher-crud';
    const initialRound = createSampleRound({
      id: 'hw-updatable',
      teacherId,
      title: 'Initial Title',
      status: 'active',
      roundLength: 5,
    });

    saveAssignedHomework(teacherId, initialRound);
    assertEqual(getAssignedHomeworkList(teacherId).length, 1, 'Initial list length is 1');

    // Update round properties
    const updatedRound: AssignedHomeworkRound = {
      ...initialRound,
      title: 'Updated Title V2',
      status: 'closed',
      roundLength: 10,
      durationMinutes: 25,
      topics: ['Updated Topic 1', 'Updated Topic 2'],
    };

    saveAssignedHomework(teacherId, updatedRound);

    const listAfter = getAssignedHomeworkList(teacherId);
    assertEqual(listAfter.length, 1, 'Update should modify entry in place, not duplicate');

    const retrieved = getAssignedHomeworkById(teacherId, 'hw-updatable');
    assertEqual(retrieved?.title, 'Updated Title V2', 'Title was updated');
    assertEqual(retrieved?.status, 'closed', 'Status was updated');
    assertEqual(retrieved?.roundLength, 10, 'roundLength was updated');
    assertEqual(retrieved?.durationMinutes, 25, 'durationMinutes was updated');
    assertDeepEqual(retrieved?.topics, ['Updated Topic 1', 'Updated Topic 2'], 'topics updated');
  }
);

registerTest(
  'CRUD_03',
  'CRUD Operations',
  'Delete assignment removes item from storage and returns appropriate booleans',
  () => {
    resetStorage();
    const teacherId = 'teacher-crud';
    const round1 = createSampleRound({ id: 'hw-del-1', teacherId });
    const round2 = createSampleRound({ id: 'hw-del-2', teacherId });

    saveAssignedHomework(teacherId, round1);
    saveAssignedHomework(teacherId, round2);
    assertEqual(getAssignedHomeworkList(teacherId).length, 2, '2 items in list');

    // Delete first item
    const success = deleteAssignedHomework(teacherId, 'hw-del-1');
    assertEqual(success, true, 'deleteAssignedHomework returns true on success');

    const listAfter = getAssignedHomeworkList(teacherId);
    assertEqual(listAfter.length, 1, 'List length reduced to 1');
    assertEqual(listAfter[0].id, 'hw-del-2', 'Remaining item is hw-del-2');
    assertEqual(getAssignedHomeworkById(teacherId, 'hw-del-1'), null, 'hw-del-1 is null');

    // Deleting non-existent item returns false
    const deleteAgain = deleteAssignedHomework(teacherId, 'hw-del-1');
    assertEqual(deleteAgain, false, 'deleteAssignedHomework returns false for non-existent item');
  }
);

// ============================================================================
// SUITE 3: STUDENT SUBMISSIONS & SCORE TRACKING INVARIANTS
// ============================================================================

registerTest(
  'SUB_01',
  'Student Submissions',
  'Record multiple student submissions and verify submission attributes',
  () => {
    resetStorage();
    const teacherId = 'teacher-metrics';
    const round = createSampleRound({ id: 'hw-metric-round', teacherId, roundLength: 10 });
    saveAssignedHomework(teacherId, round);

    const sub1: StudentSubmission = {
      studentId: 'std-alex',
      studentName: 'Alex Thorne',
      score: 9,
      totalQuestions: 10,
      accuracyPercentage: 90,
      xpEarned: 135,
      completedAt: '2026-10-19T09:30:00.000Z',
      timeSpentSeconds: 420,
    };

    const sub2: StudentSubmission = {
      studentId: 'std-beatrice',
      studentName: 'Beatrice Vance',
      score: 8,
      totalQuestions: 10,
      accuracyPercentage: 80,
      xpEarned: 120,
      completedAt: '2026-10-19T09:45:00.000Z',
      timeSpentSeconds: 510,
    };

    const ok1 = recordStudentSubmission(teacherId, 'hw-metric-round', sub1);
    const ok2 = recordStudentSubmission(teacherId, 'hw-metric-round', sub2);

    assert(ok1 && ok2, 'Both submissions recorded successfully');

    const updated = getAssignedHomeworkById(teacherId, 'hw-metric-round');
    assert(updated !== null, 'Updated round exists');
    assertEqual(updated?.submissions.length, 2, '2 submissions recorded');

    const rec1 = updated?.submissions.find((s) => s.studentId === 'std-alex');
    assertEqual(rec1?.studentName, 'Alex Thorne', 'Name matches');
    assertEqual(rec1?.score, 9, 'Score matches');
    assertEqual(rec1?.accuracyPercentage, 90, 'Accuracy matches');
    assertEqual(rec1?.timeSpentSeconds, 420, 'Time spent matches');
    assertEqual(rec1?.xpEarned, 135, 'XP matches');
  }
);

registerTest(
  'SUB_02',
  'Student Submissions',
  'Submitting a retake updates existing student submission in place',
  () => {
    resetStorage();
    const teacherId = 'teacher-metrics';
    const round = createSampleRound({ id: 'hw-retake-round', teacherId, roundLength: 10 });
    saveAssignedHomework(teacherId, round);

    const firstAttempt: StudentSubmission = {
      studentId: 'std-carter',
      studentName: 'Carter Wu',
      score: 6,
      totalQuestions: 10,
      accuracyPercentage: 60,
      xpEarned: 90,
      completedAt: '2026-10-19T08:00:00.000Z',
      timeSpentSeconds: 600,
    };
    recordStudentSubmission(teacherId, 'hw-retake-round', firstAttempt);

    const secondAttempt: StudentSubmission = {
      studentId: 'std-carter',
      studentName: 'Carter Wu',
      score: 10,
      totalQuestions: 10,
      accuracyPercentage: 100,
      xpEarned: 150,
      completedAt: '2026-10-19T10:00:00.000Z',
      timeSpentSeconds: 380,
    };
    recordStudentSubmission(teacherId, 'hw-retake-round', secondAttempt);

    const fetched = getAssignedHomeworkById(teacherId, 'hw-retake-round');
    assertEqual(fetched?.submissions.length, 1, 'Should have exactly 1 record for student (no duplicates)');
    assertEqual(fetched?.submissions[0].score, 10, 'Score updated to second attempt');
    assertEqual(fetched?.submissions[0].accuracyPercentage, 100, 'Accuracy updated');
  }
);

registerTest(
  'SUB_03',
  'Student Submissions',
  'computeHomeworkMetrics accurately computes totals, active counts, and average accuracy',
  () => {
    resetStorage();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Round 1: Active + future due date (Active count +1)
    const round1 = createSampleRound({
      id: 'round-1',
      status: 'active',
      dueDate: new Date(now + 2 * dayMs).toISOString(),
      submissions: [
        {
          studentId: 's1',
          studentName: 'Student 1',
          score: 8,
          totalQuestions: 10,
          accuracyPercentage: 80,
          xpEarned: 120,
          completedAt: new Date().toISOString(),
          timeSpentSeconds: 300,
        },
        {
          studentId: 's2',
          studentName: 'Student 2',
          score: 10,
          totalQuestions: 10,
          accuracyPercentage: 100,
          xpEarned: 150,
          completedAt: new Date().toISOString(),
          timeSpentSeconds: 250,
        },
      ],
    });

    // Round 2: Active + past due date (Expired, active count +0)
    const round2 = createSampleRound({
      id: 'round-2',
      status: 'active',
      dueDate: new Date(now - 1 * dayMs).toISOString(),
      submissions: [
        {
          studentId: 's3',
          studentName: 'Student 3',
          score: 6,
          totalQuestions: 10,
          accuracyPercentage: 60,
          xpEarned: 90,
          completedAt: new Date().toISOString(),
          timeSpentSeconds: 400,
        },
      ],
    });

    // Round 3: Closed (active count +0)
    const round3 = createSampleRound({
      id: 'round-3',
      status: 'closed',
      dueDate: new Date(now + 10 * dayMs).toISOString(),
      submissions: [],
    });

    const metrics = computeHomeworkMetrics([round1, round2, round3]);

    assertEqual(metrics.totalAssigned, 3, 'totalAssigned is 3');
    assertEqual(metrics.activeCount, 1, 'activeCount is 1 (only round1 is active and unexpired)');
    assertEqual(metrics.totalSubmissions, 3, 'totalSubmissions is 3 (2 + 1 + 0)');
    // Average accuracy: (80 + 100 + 60) / 3 = 240 / 3 = 80
    assertEqual(metrics.averageAccuracy, 80, 'averageAccuracy is 80%');

    // Verify empty array metrics
    const emptyMetrics = computeHomeworkMetrics([]);
    assertEqual(emptyMetrics.totalAssigned, 0, 'empty totalAssigned');
    assertEqual(emptyMetrics.activeCount, 0, 'empty activeCount');
    assertEqual(emptyMetrics.totalSubmissions, 0, 'empty totalSubmissions');
    assertEqual(emptyMetrics.averageAccuracy, 0, 'empty averageAccuracy');
  }
);

registerTest(
  'SUB_04',
  'Student Submissions',
  'recordStudentSubmission resolves owning teacher when submitted with mismatched or generic teacherId',
  () => {
    resetStorage();
    const owningTeacher = 'teacher-owner-99';
    const round = createSampleRound({ id: 'hw-cross-resolve', teacherId: owningTeacher });
    saveAssignedHomework(owningTeacher, round);

    // Submission sent with generic student/mismatched teacherId
    const studentSub: StudentSubmission = {
      studentId: 'std-global',
      studentName: 'Global Student',
      score: 10,
      totalQuestions: 10,
      accuracyPercentage: 100,
      xpEarned: 150,
      completedAt: new Date().toISOString(),
      timeSpentSeconds: 310,
    };

    const recorded = recordStudentSubmission('mismatched-teacher-id', 'hw-cross-resolve', studentSub);
    assertEqual(recorded, true, 'Submission routed to owning teacher successfully');

    const updatedOwnerRound = getAssignedHomeworkById(owningTeacher, 'hw-cross-resolve');
    assert(updatedOwnerRound !== null, 'Owning teacher round updated');
    assertEqual(updatedOwnerRound?.submissions.length, 1, 'Submission stored in owning teacher account');
    assertEqual(updatedOwnerRound?.submissions[0].studentName, 'Global Student', 'Student name stored');
  }
);

registerTest(
  'SUB_05',
  'Student Submissions',
  'recordStudentSubmission returns false for non-existent homework ID',
  () => {
    resetStorage();
    const ghostSub: StudentSubmission = {
      studentId: 'std-ghost',
      studentName: 'Ghost',
      score: 5,
      totalQuestions: 10,
      accuracyPercentage: 50,
      xpEarned: 50,
      completedAt: new Date().toISOString(),
      timeSpentSeconds: 120,
    };
    const result = recordStudentSubmission('any-teacher', 'hw-does-not-exist', ghostSub);
    assertEqual(result, false, 'Returns false for unknown homework ID');
  }
);

// ============================================================================
// SUITE 4: ACCESS CODE LOOKUP & UNIVERSAL RESOLUTION
// ============================================================================

registerTest(
  'CODE_01',
  'Access Code Lookup',
  'getAssignedHomeworkByCode resolves assignment by test code case-insensitively',
  () => {
    resetStorage();
    const round = createSampleRound({
      id: 'hw-code-target',
      teacherId: 'teacher-code-host',
      testCode: 'REV-482',
    });
    saveAssignedHomework('teacher-code-host', round);

    // Exact match
    const exact = getAssignedHomeworkByCode('REV-482');
    assert(exact !== null, 'Exact match resolves');
    assertEqual(exact?.id, 'hw-code-target', 'Resolves correct assignment');

    // Lowercase query
    const lower = getAssignedHomeworkByCode('rev-482');
    assert(lower !== null, 'Lowercase query resolves');
    assertEqual(lower?.id, 'hw-code-target', 'Resolves correct assignment');

    // Mixed case with spaces
    const mixed = getAssignedHomeworkByCode('  Rev-482  ');
    assert(mixed !== null, 'Whitespace and mixed case resolves');
    assertEqual(mixed?.id, 'hw-code-target', 'Resolves correct assignment');
  }
);

registerTest(
  'CODE_02',
  'Access Code Lookup',
  'findHomeworkByIdAnyTeacher resolves assignment by ID across any teacher profile',
  () => {
    resetStorage();
    const round = createSampleRound({
      id: 'hw-special-unique-id',
      teacherId: 'teacher-any-host',
      testCode: 'REV-111',
    });
    saveAssignedHomework('teacher-any-host', round);

    const byId = findHomeworkByIdAnyTeacher('hw-special-unique-id');
    assert(byId !== null, 'Lookup by id resolves');
    assertEqual(byId?.testCode, 'REV-111', 'Resolves matching round');
    assertEqual(byId?.teacherId, 'teacher-any-host', 'Resolves teacher ID');
  }
);

registerTest(
  'CODE_03',
  'Access Code Lookup',
  'Non-existent test code returns null without throwing',
  () => {
    resetStorage();
    const result = getAssignedHomeworkByCode('REV-NONEXISTENT-999');
    assertEqual(result, null, 'Returns null for unknown test code');

    const empty = getAssignedHomeworkByCode('');
    assertEqual(empty, null, 'Returns null for empty string');
  }
);

// ============================================================================
// SUITE 5: DUE DATE EVALUATION & FILTER INVARIANTS
// ============================================================================

registerTest(
  'DUE_01',
  'Due Date Invariants',
  'isHomeworkDue correctly identifies expired vs active dates',
  () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const futureRound = createSampleRound({
      dueDate: new Date(now + 3 * dayMs).toISOString(),
    });
    assertEqual(isHomeworkDue(futureRound), false, 'Future due date is not due');

    const pastRound = createSampleRound({
      dueDate: new Date(now - 2 * dayMs).toISOString(),
    });
    assertEqual(isHomeworkDue(pastRound), true, 'Past due date is due');

    const noDueDateRound = createSampleRound({
      dueDate: '',
    });
    assertEqual(isHomeworkDue(noDueDateRound), false, 'Empty due date is not due');
  }
);

registerTest(
  'FILTER_01',
  'Filter Invariants',
  'Filter homework list by cohort and status subsets',
  () => {
    resetStorage();
    const teacherId = 'teacher-filter';

    const rounds: AssignedHomeworkRound[] = [
      createSampleRound({ id: 'f1', teacherId, cohortName: '10B Physics', status: 'active' }),
      createSampleRound({ id: 'f2', teacherId, cohortName: '10B Physics', status: 'closed' }),
      createSampleRound({ id: 'f3', teacherId, cohortName: '10 Economics', status: 'active' }),
      createSampleRound({ id: 'f4', teacherId, cohortName: '11A Physics', status: 'scheduled' }),
    ];

    for (const r of rounds) {
      saveAssignedHomework(teacherId, r);
    }

    const all = getAssignedHomeworkList(teacherId);
    assertEqual(all.length, 4, 'All 4 loaded');

    // Cohort filtering
    const physics10B = all.filter((r) => r.cohortName === '10B Physics');
    assertEqual(physics10B.length, 2, '2 rounds for 10B Physics');

    const economics10 = all.filter((r) => r.cohortName === '10 Economics');
    assertEqual(economics10.length, 1, '1 round for 10 Economics');

    // Status filtering
    const activeRounds = all.filter((r) => r.status === 'active');
    assertEqual(activeRounds.length, 2, '2 active rounds');

    const closedRounds = all.filter((r) => r.status === 'closed');
    assertEqual(closedRounds.length, 1, '1 closed round');

    const scheduledRounds = all.filter((r) => r.status === 'scheduled');
    assertEqual(scheduledRounds.length, 1, '1 scheduled round');
  }
);

// ============================================================================
// SUITE 6: ZERO FAKE DATA INVARIANTS & LEGACY PURGING
// ============================================================================

registerTest(
  'SEED_01',
  'Zero Fake Data Invariants',
  'getAssignedHomeworkList returns [] on empty storage and seedInitialHomeworkIfEmpty returns []',
  () => {
    resetStorage();
    const freshTeacher = 'teacher-fresh-clean';

    // Verify initially empty
    const listBefore = getAssignedHomeworkList(freshTeacher);
    assertEqual(listBefore.length, 0, 'Initially empty list');
    assertDeepEqual(listBefore, [], 'Expected empty array []');

    // Call seedInitialHomeworkIfEmpty
    const seeded = seedInitialHomeworkIfEmpty(freshTeacher, 'Ms. Laura Davis');
    assertEqual(seeded.length, 0, 'seedInitialHomeworkIfEmpty must return empty array []');
    assertDeepEqual(seeded, [], 'Expected empty array []');

    // Verify storage remains empty
    const listAfter = getAssignedHomeworkList(freshTeacher);
    assertEqual(listAfter.length, 0, 'Storage remains empty after seeding call');
  }
);

registerTest(
  'SEED_02',
  'Zero Fake Data Invariants',
  'seedInitialHomeworkIfEmpty never writes fake data into storage',
  () => {
    resetStorage();
    const teacherId = 'teacher-no-fake-data';

    // Call seed
    seedInitialHomeworkIfEmpty(teacherId, 'Educator 1');

    // Storage raw check
    const raw = mockStorage.getItem(`revizz_assigned_homework_v1_${teacherId}`);
    assertEqual(raw, null, 'Storage key must not be populated with fake data');

    // Online assignment check - verify no online fake assignments were registered
    const online = listOnlineAssignments();
    const fakeSeeded = online.filter((a) => a.id.startsWith('hw-seed-'));
    assertEqual(fakeSeeded.length, 0, 'Online assignments must contain 0 fake seeded rounds');
  }
);

registerTest(
  'SEED_03',
  'Zero Fake Data Invariants',
  'legacy hw-seed- items are purged on read and rewritten to clean storage',
  () => {
    resetStorage();
    const teacherId = 'teacher-legacy-purge';
    const key = `revizz_assigned_homework_v1_${teacherId}`;

    // Inject legacy fake seeded items directly into storage
    const legacyFake = [
      createSampleRound({ id: 'hw-seed-01-kinematics', teacherId }),
      createSampleRound({ id: 'hw-seed-02-macro-fiscal', teacherId }),
      createSampleRound({ id: 'hw-real-legit-01', teacherId, title: 'Real Educator Test' }),
    ];
    mockStorage.setItem(key, JSON.stringify(legacyFake));

    // getAssignedHomeworkList must purge hw-seed- items and return only real items
    const cleaned = getAssignedHomeworkList(teacherId);
    assertEqual(cleaned.length, 1, 'Only real non-seed assignment is returned');
    assertEqual(cleaned[0].id, 'hw-real-legit-01', 'Retained legitimate assignment');

    // Verify localStorage was rewritten in-place without the fake items
    const rawAfter = mockStorage.getItem(key);
    assert(rawAfter !== null, 'Key still exists in storage');
    const parsedAfter = JSON.parse(rawAfter!);
    assertEqual(parsedAfter.length, 1, 'Storage was purged in place to 1 item');
    assertEqual(parsedAfter[0].id, 'hw-real-legit-01', 'Purged hw-seed- items permanently');

    // Verify findHomeworkByIdAnyTeacher ignores hw-seed-
    const fakeFoundByCode = findHomeworkByIdAnyTeacher('hw-seed-01-kinematics');
    assertEqual(fakeFoundByCode, null, 'findHomeworkByIdAnyTeacher ignores hw-seed- items');
  }
);

// ============================================================================
// SUITE 7: CHANGE EVENT NOTIFICATION & ONLINE COMPILER INTEROPERABILITY
// ============================================================================

registerTest(
  'INTEROP_01',
  'Event & Interop',
  'saveAssignedHomework synchronizes with online quiz assignment registry',
  () => {
    resetStorage();
    const teacherId = 'teacher-sync';
    const round = createSampleRound({
      id: 'hw-sync-01',
      teacherId,
      title: 'Online Synchronized Quiz',
      subjectCode: '0455',
      subjectName: 'Economics',
      cohortName: '10 Economics',
      dueDate: '2026-11-01T00:00:00.000Z',
      durationMinutes: 25,
      testCode: 'REV-SYNC',
      questionIds: ['q1', 'q2', 'q3'],
    });

    saveAssignedHomework(teacherId, round);

    const onlineList = listOnlineAssignments();
    const foundOnline = onlineList.find((a) => a.id === 'hw-sync-01');
    assert(foundOnline !== undefined, 'Found in online assignments registry');
    assertEqual(foundOnline?.title, 'Online Synchronized Quiz', 'Title matches online assignment');
    assertEqual(foundOnline?.testCode, 'REV-SYNC', 'testCode matches');
    assertEqual(foundOnline?.durationMinutes, 25, 'durationMinutes matches');
    assertDeepEqual(foundOnline?.questionIds, ['q1', 'q2', 'q3'], 'questionIds match');
  }
);

registerTest(
  'INTEROP_02',
  'Event & Interop',
  'subscribeToHomeworkChanges receives notifications on save and delete',
  () => {
    resetStorage();
    let changeEventsFired = 0;
    const unsubscribe = subscribeToHomeworkChanges(() => {
      changeEventsFired++;
    });

    const teacherId = 'teacher-events';
    const round = createSampleRound({ id: 'hw-event-1', teacherId });

    // 1. Save dispatches event
    saveAssignedHomework(teacherId, round);
    assertEqual(changeEventsFired, 1, 'Event fired on saveAssignedHomework');

    // 2. Delete dispatches event
    deleteAssignedHomework(teacherId, 'hw-event-1');
    assertEqual(changeEventsFired, 2, 'Event fired on deleteAssignedHomework');

    // 3. Unsubscribe stops events
    unsubscribe();
    saveAssignedHomework(teacherId, round);
    assertEqual(changeEventsFired, 2, 'No further events after unsubscribe');
  }
);

// ============================================================================
// 4. TEST RUNNER & REPORTER
// ============================================================================

console.log('='.repeat(80));
console.log(' REVIZZ QA VERIFICATION SUITE: ACCOUNT-UNIQUE ASSIGNED HOMEWORK');
console.log(' Target Module: lib/portal/assignedHomework.ts');
console.log('='.repeat(80));

let passCount = 0;
let failCount = 0;
const failures: { id: string; suite: string; name: string; error: string }[] = [];

// Group by suite
const suites = Array.from(new Set(testCases.map((t) => t.suite)));

for (const suite of suites) {
  console.log(`\n\x1b[1m\x1b[36m▶ Suite: ${suite}\x1b[0m`);
  const testsInSuite = testCases.filter((t) => t.suite === suite);

  for (const test of testsInSuite) {
    try {
      test.fn();
      console.log(`  \x1b[32m✔ PASS\x1b[0m [${test.id}] ${test.name}`);
      passCount++;
    } catch (err: any) {
      console.log(`  \x1b[31m✖ FAIL\x1b[0m [${test.id}] ${test.name}`);
      console.log(`       \x1b[31m↳ ${err?.message || err}\x1b[0m`);
      failCount++;
      failures.push({
        id: test.id,
        suite: test.suite,
        name: test.name,
        error: err?.message || String(err),
      });
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log(
  `\x1b[1mSUMMARY: Total: ${testCases.length} | Passed: \x1b[32m${passCount}\x1b[0m\x1b[1m | Failed: \x1b[${
    failCount > 0 ? '31m' : '32m'
  }${failCount}\x1b[0m`
);
console.log('='.repeat(80));

if (failCount > 0) {
  console.log('\n\x1b[31m❌ The following tests failed:\x1b[0m');
  for (const f of failures) {
    console.log(`  - [${f.id}] (${f.suite}) ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('\n\x1b[32m✨ All Assigned Homework QA Tests Passed with 100% Green Output!\x1b[0m\n');
  process.exit(0);
}

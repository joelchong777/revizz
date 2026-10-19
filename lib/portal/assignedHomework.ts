import { saveOnlineAssignment } from '../testCompiler';
import type { OnlineQuizAssignment } from '@/types/testCompiler';

export interface StudentSubmission {
  studentId: string;
  studentName: string;
  score: number;
  totalQuestions: number;
  accuracyPercentage: number;
  xpEarned: number;
  completedAt: string;
  timeSpentSeconds: number;
}

export interface AssignedHomeworkRound {
  id: string;
  teacherId: string; // Account unique!
  teacherName: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  cohortName: string;
  testCode: string; // e.g. "REV-482"
  createdAt: string;
  dueDate: string;
  durationMinutes: number | null;
  timerMode: 'Chill' | 'Exam' | 'Standard';
  roundLength: number;
  topics: string[];
  questionIds: string[];
  status: 'active' | 'scheduled' | 'closed';
  settings: {
    allowRetry: boolean;
    retryXpPercentage: number;
    addToReviewPile: boolean;
    shuffleOptions: boolean;
  };
  totalStudents: number;
  submissions: StudentSubmission[];
}

export interface HomeworkMetricsSummary {
  totalAssigned: number;
  activeCount: number;
  totalSubmissions: number;
  averageAccuracy: number;
}

const STORAGE_PREFIX = 'revizz_assigned_homework_v1_';
export const HOMEWORK_CHANGED_EVENT = 'revizz_assigned_homework_changed';

/**
 * Account-unique storage key for an educator
 */
export function getStorageKey(teacherId: string): string {
  const safeId = (teacherId || 'guest-educator-local').trim().toLowerCase();
  return `${STORAGE_PREFIX}${safeId}`;
}

function notifyChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HOMEWORK_CHANGED_EVENT));
  }
}

export function isHomeworkDue(homework: AssignedHomeworkRound): boolean {
  if (!homework.dueDate) return false;
  const dueTime = new Date(homework.dueDate).getTime();
  return !isNaN(dueTime) && dueTime < Date.now();
}

export function computeHomeworkMetrics(rounds: AssignedHomeworkRound[]): HomeworkMetricsSummary {
  if (!rounds || rounds.length === 0) {
    return {
      totalAssigned: 0,
      activeCount: 0,
      totalSubmissions: 0,
      averageAccuracy: 0,
    };
  }

  let totalSubs = 0;
  let totalAccuracySum = 0;
  let activeCount = 0;

  for (const round of rounds) {
    const isDue = isHomeworkDue(round);
    if (round.status === 'active' && !isDue) {
      activeCount++;
    }
    for (const sub of round.submissions) {
      totalSubs++;
      totalAccuracySum += sub.accuracyPercentage;
    }
  }

  const averageAccuracy = totalSubs > 0 ? Math.round(totalAccuracySum / totalSubs) : 0;

  return {
    totalAssigned: rounds.length,
    activeCount,
    totalSubmissions: totalSubs,
    averageAccuracy,
  };
}

export function getAssignedHomeworkList(teacherId: string): AssignedHomeworkRound[] {
  if (typeof window === 'undefined') return [];
  const key = getStorageKey(teacherId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Filter out any legacy seeded fake rounds starting with 'hw-seed-'
    const filtered = parsed.filter(
      (item) => item && typeof item.id === 'string' && !item.id.startsWith('hw-seed-')
    );

    // If any legacy seed items were found, rewrite localStorage without them
    if (filtered.length !== parsed.length) {
      localStorage.setItem(key, JSON.stringify(filtered));
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error('Failed to parse assigned homework list for', teacherId, err);
    return [];
  }
}

export function getAssignedHomeworkById(teacherId: string, homeworkId: string): AssignedHomeworkRound | null {
  const list = getAssignedHomeworkList(teacherId);
  return list.find((item) => item.id === homeworkId) || null;
}

export function getAssignedHomeworkByCode(testCode: string): AssignedHomeworkRound | null {
  if (typeof window === 'undefined' || !testCode) return null;
  const cleanCode = testCode.trim().toUpperCase();

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw) as AssignedHomeworkRound[];
          if (Array.isArray(list)) {
            const found = list.find(
              (item) =>
                item &&
                typeof item.id === 'string' &&
                !item.id.startsWith('hw-seed-') &&
                (item.testCode?.toUpperCase() === cleanCode || item.id === cleanCode)
            );
            if (found) return found;
          }
        }
      } catch (e) {}
    }
  }
  return null;
}

export function findHomeworkByIdAnyTeacher(homeworkId: string): AssignedHomeworkRound | null {
  if (typeof window === 'undefined' || !homeworkId) return null;
  const target = homeworkId.trim();
  if (target.startsWith('hw-seed-')) return null;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw) as AssignedHomeworkRound[];
          if (Array.isArray(list)) {
            const match = list.find(
              (item) =>
                item &&
                typeof item.id === 'string' &&
                !item.id.startsWith('hw-seed-') &&
                (item.id === target || item.testCode?.toUpperCase() === target.toUpperCase())
            );
            if (match) return match;
          }
        }
      } catch (e) {}
    }
  }
  return null;
}

export function saveAssignedHomework(teacherId: string, homework: AssignedHomeworkRound): void {
  if (typeof window === 'undefined') return;
  const key = getStorageKey(teacherId);
  const current = getAssignedHomeworkList(teacherId);
  const existingIdx = current.findIndex((h) => h.id === homework.id);

  if (existingIdx >= 0) {
    current[existingIdx] = homework;
  } else {
    current.unshift(homework);
  }

  try {
    localStorage.setItem(key, JSON.stringify(current));
  } catch (err) {
    console.error('Failed to save assigned homework round:', err);
  }

  // Interop with student online assignment registry
  try {
    const onlineAssignment: OnlineQuizAssignment = {
      id: homework.id,
      title: homework.title,
      subjectCode: homework.subjectCode,
      subjectName: homework.subjectName,
      cohortName: homework.cohortName,
      dueDate: homework.dueDate,
      durationMinutes: homework.durationMinutes ?? 0,
      questionIds: homework.questionIds,
      testCode: homework.testCode,
      createdAt: homework.createdAt,
    };
    saveOnlineAssignment(onlineAssignment);
  } catch (err) {
    console.error('Failed to sync online assignment:', err);
  }

  notifyChange();
}

export function deleteAssignedHomework(teacherId: string, homeworkId: string): boolean {
  if (typeof window === 'undefined') return false;
  const key = getStorageKey(teacherId);
  const current = getAssignedHomeworkList(teacherId);
  const filtered = current.filter((h) => h.id !== homeworkId);

  if (filtered.length === current.length) {
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(filtered));
    notifyChange();
    return true;
  } catch (err) {
    console.error('Failed to delete assigned homework:', err);
    return false;
  }
}

export function recordStudentSubmission(
  teacherId: string,
  homeworkId: string,
  submission: StudentSubmission
): boolean {
  if (typeof window === 'undefined') return false;
  const round = getAssignedHomeworkById(teacherId, homeworkId);
  if (!round) {
    // If not found in this teacher's account, try searching across all teacher profiles
    const anyRound = findHomeworkByIdAnyTeacher(homeworkId);
    if (anyRound) {
      return recordStudentSubmission(anyRound.teacherId, homeworkId, submission);
    }
    return false;
  }

  const existingSubIdx = round.submissions.findIndex((s) => s.studentId === submission.studentId);
  if (existingSubIdx >= 0) {
    round.submissions[existingSubIdx] = submission;
  } else {
    round.submissions.push(submission);
  }

  saveAssignedHomework(teacherId, round);
  return true;
}

export function subscribeToHomeworkChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(HOMEWORK_CHANGED_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(HOMEWORK_CHANGED_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * Zero fake data invariant: seedInitialHomeworkIfEmpty never populates fake data.
 * Always returns an empty array and never writes to storage.
 */
export function seedInitialHomeworkIfEmpty(
  _teacherId?: string,
  _teacherName: string = 'Educator'
): AssignedHomeworkRound[] {
  return [];
}

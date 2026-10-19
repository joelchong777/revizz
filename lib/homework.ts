import { OnlineQuizAssignment } from '../types/testCompiler';
import { listOnlineAssignments } from './testCompiler';
import { Question } from './questions';

export type HomeworkStatus = 'pending' | 'completed' | 'overdue';

export interface HomeworkSubmission {
  assignmentId: string;
  testCode: string;
  completedAt: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpentSeconds?: number;
  answers?: Record<string, string>; // questionId -> selectedOptionId
}

export interface HomeworkItem extends OnlineQuizAssignment {
  status: HomeworkStatus;
  submission?: HomeworkSubmission;
  isOverdue: boolean;
  daysRemaining: number;
}

export const HOMEWORK_SUBMISSIONS_KEY = 'revizz_homework_submissions_v1';
export const HOMEWORK_CHANGE_EVENT = 'revizz:homework-updated';

/**
 * Returns default realistic Cambridge IGCSE homework assignments.
 * These serve as seed assignments when no custom teacher assignments exist.
 */
export function getSeedHomeworkAssignments(): OnlineQuizAssignment[] {
  return [];
}

/**
 * Notifies all listeners across the window and storage that homework state changed.
 */
export function notifyHomeworkChanged(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      window.dispatchEvent(new CustomEvent(HOMEWORK_CHANGE_EVENT));
    } catch (err) {
      console.warn('Failed to dispatch homework update event:', err);
    }
  }
}

/**
 * Subscribes to homework submission updates.
 */
export function subscribeHomeworkChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(HOMEWORK_CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(HOMEWORK_CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/**
 * Reads all recorded homework submissions from localStorage.
 */
export function getHomeworkSubmissions(): Record<string, HomeworkSubmission> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(HOMEWORK_SUBMISSIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, HomeworkSubmission>;
  } catch (err) {
    console.warn('Failed to parse homework submissions from storage:', err);
    return {};
  }
}

/**
 * Saves a completed homework submission to localStorage and dispatches a change event.
 */
export function saveHomeworkSubmission(submission: HomeworkSubmission): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const submissions = getHomeworkSubmissions();
    submissions[submission.assignmentId] = submission;
    if (submission.testCode && submission.testCode !== submission.assignmentId) {
      submissions[submission.testCode] = submission;
    }
    localStorage.setItem(HOMEWORK_SUBMISSIONS_KEY, JSON.stringify(submissions));
    notifyHomeworkChanged();
  } catch (err) {
    console.warn('Failed to save homework submission to storage:', err);
  }
}

/**
 * Retrieves all homework assignments (teacher-created assignments combined with default seeds),
 * joining student submissions to calculate status, overdue flag, and days remaining.
 */
export function getHomeworkAssignments(availableQuestions?: Question[]): HomeworkItem[] {
  const teacherAssignments = listOnlineAssignments();
  const seedAssignments = getSeedHomeworkAssignments();

  // Combine teacher assignments and default seeds (deduplicating by testCode and id)
  const existingKeys = new Set<string>();
  for (const t of teacherAssignments) {
    if (t.id) existingKeys.add(t.id.toUpperCase());
    if (t.testCode) existingKeys.add(t.testCode.toUpperCase());
  }

  const combined: OnlineQuizAssignment[] = [
    ...teacherAssignments,
    ...seedAssignments.filter((s) => !existingKeys.has(s.id.toUpperCase()) && !existingKeys.has(s.testCode.toUpperCase())),
  ];

  const submissions = getHomeworkSubmissions();
  const now = Date.now();

  const items: HomeworkItem[] = combined.map((assignment) => {
    const sub = submissions[assignment.id] || (assignment.testCode ? submissions[assignment.testCode] : undefined);
    const dueDateMs = new Date(assignment.dueDate).getTime();
    const diffMs = dueDateMs - now;
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isPastDue = diffMs < 0;

    let status: HomeworkStatus = 'pending';
    if (sub) {
      status = 'completed';
    } else if (isPastDue) {
      status = 'overdue';
    } else {
      status = 'pending';
    }

    const isOverdue = !sub && isPastDue;

    return {
      ...assignment,
      status,
      submission: sub,
      isOverdue,
      daysRemaining,
    };
  });

  // Sort assignments: pending and overdue first (by due date ascending), completed last (by completedAt descending)
  return items.sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (a.status !== 'completed' && b.status === 'completed') return -1;
    if (a.status === 'completed' && b.status === 'completed') {
      const aTime = a.submission?.completedAt ? new Date(a.submission.completedAt).getTime() : 0;
      const bTime = b.submission?.completedAt ? new Date(b.submission.completedAt).getTime() : 0;
      return bTime - aTime;
    }
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });
}

/**
 * Finds an online assignment by test code or assignment ID (case-insensitive).
 */
export function findAssignmentByTestCode(code: string): OnlineQuizAssignment | null {
  if (!code || typeof code !== 'string') return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const teacherAssignments = listOnlineAssignments();
  const seedAssignments = getSeedHomeworkAssignments();
  const allAssignments = [...teacherAssignments, ...seedAssignments];

  for (const item of allAssignments) {
    if (
      (item.testCode && item.testCode.trim().toUpperCase() === normalized) ||
      (item.id && item.id.trim().toUpperCase() === normalized)
    ) {
      return item;
    }
  }

  return null;
}

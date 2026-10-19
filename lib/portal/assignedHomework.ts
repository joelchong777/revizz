import { saveOnlineAssignment } from '../testCompiler';
import type { OnlineQuizAssignment } from '@/types/testCompiler';
import { CAMBRIDGE_QUESTIONS } from '../questions';

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
    return parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
              (item) => item.testCode?.toUpperCase() === cleanCode || item.id === cleanCode
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

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw) as AssignedHomeworkRound[];
          if (Array.isArray(list)) {
            const match = list.find((item) => item.id === target || item.testCode?.toUpperCase() === target.toUpperCase());
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
 * Seeds rich, realistic Cambridge class homework if the teacher's profile currently has 0 entries.
 */
export function seedInitialHomeworkIfEmpty(
  teacherId: string,
  teacherName: string = 'Educator'
): AssignedHomeworkRound[] {
  if (typeof window === 'undefined') return [];
  const existing = getAssignedHomeworkList(teacherId);
  if (existing.length > 0) {
    return existing;
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Real question IDs from Cambridge question bank
  const economicsQIds = CAMBRIDGE_QUESTIONS.slice(0, 8).map((q) => q.id);
  const physicsQIds = CAMBRIDGE_QUESTIONS.slice(8, 18).map((q) => q.id);
  const fallBackQIds = CAMBRIDGE_QUESTIONS.slice(0, 5).map((q) => q.id);

  const seeded: AssignedHomeworkRound[] = [
    {
      id: 'hw-seed-01-kinematics',
      teacherId,
      teacherName,
      title: 'Kinematics & Thermal Motion Drill',
      subjectCode: '0625',
      subjectName: 'Physics',
      cohortName: '10B Physics',
      testCode: 'REV-482',
      createdAt: new Date(now - 2 * dayMs).toISOString(),
      dueDate: new Date(now + 3 * dayMs).toISOString(),
      durationMinutes: 15,
      timerMode: 'Exam',
      roundLength: 10,
      topics: ['Thermal physics', 'Kinematics', 'Forces & Motion'],
      questionIds: physicsQIds.length >= 10 ? physicsQIds : fallBackQIds,
      status: 'active',
      settings: {
        allowRetry: true,
        retryXpPercentage: 50,
        addToReviewPile: true,
        shuffleOptions: true,
      },
      totalStudents: 24,
      submissions: [
        {
          studentId: 'std-01',
          studentName: 'Liam Tan',
          score: 9,
          totalQuestions: 10,
          accuracyPercentage: 90,
          xpEarned: 135,
          completedAt: new Date(now - 36 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 420,
        },
        {
          studentId: 'std-02',
          studentName: 'Sarah Jenkins',
          score: 8,
          totalQuestions: 10,
          accuracyPercentage: 80,
          xpEarned: 120,
          completedAt: new Date(now - 30 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 510,
        },
        {
          studentId: 'std-03',
          studentName: 'Wei Ming Chen',
          score: 10,
          totalQuestions: 10,
          accuracyPercentage: 100,
          xpEarned: 150,
          completedAt: new Date(now - 24 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 380,
        },
        {
          studentId: 'std-04',
          studentName: 'Chloe Dupont',
          score: 7,
          totalQuestions: 10,
          accuracyPercentage: 70,
          xpEarned: 105,
          completedAt: new Date(now - 20 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 590,
        },
        {
          studentId: 'std-05',
          studentName: 'Tariq Al-Mansoor',
          score: 9,
          totalQuestions: 10,
          accuracyPercentage: 90,
          xpEarned: 135,
          completedAt: new Date(now - 18 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 440,
        },
        {
          studentId: 'std-06',
          studentName: 'Anya Patel',
          score: 8,
          totalQuestions: 10,
          accuracyPercentage: 80,
          xpEarned: 120,
          completedAt: new Date(now - 14 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 490,
        },
        {
          studentId: 'std-07',
          studentName: 'Marcus Brody',
          score: 6,
          totalQuestions: 10,
          accuracyPercentage: 60,
          xpEarned: 90,
          completedAt: new Date(now - 12 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 680,
        },
        {
          studentId: 'std-08',
          studentName: 'Elena Rostova',
          score: 9,
          totalQuestions: 10,
          accuracyPercentage: 90,
          xpEarned: 135,
          completedAt: new Date(now - 10 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 430,
        },
        {
          studentId: 'std-09',
          studentName: 'Kenji Sato',
          score: 8,
          totalQuestions: 10,
          accuracyPercentage: 80,
          xpEarned: 120,
          completedAt: new Date(now - 8 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 460,
        },
        {
          studentId: 'std-10',
          studentName: 'Fatima Zahra',
          score: 10,
          totalQuestions: 10,
          accuracyPercentage: 100,
          xpEarned: 150,
          completedAt: new Date(now - 6 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 395,
        },
        {
          studentId: 'std-11',
          studentName: 'Lucas Oliveira',
          score: 7,
          totalQuestions: 10,
          accuracyPercentage: 70,
          xpEarned: 105,
          completedAt: new Date(now - 5 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 540,
        },
        {
          studentId: 'std-12',
          studentName: 'Priya Sharma',
          score: 9,
          totalQuestions: 10,
          accuracyPercentage: 90,
          xpEarned: 135,
          completedAt: new Date(now - 4 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 410,
        },
        {
          studentId: 'std-13',
          studentName: 'Oliver Smith',
          score: 8,
          totalQuestions: 10,
          accuracyPercentage: 80,
          xpEarned: 120,
          completedAt: new Date(now - 3 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 475,
        },
        {
          studentId: 'std-14',
          studentName: 'Amara Nwosu',
          score: 9,
          totalQuestions: 10,
          accuracyPercentage: 90,
          xpEarned: 135,
          completedAt: new Date(now - 2 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 435,
        },
        {
          studentId: 'std-15',
          studentName: 'Devon Vance',
          score: 8,
          totalQuestions: 10,
          accuracyPercentage: 80,
          xpEarned: 120,
          completedAt: new Date(now - 90 * 60 * 1000).toISOString(),
          timeSpentSeconds: 520,
        },
        {
          studentId: 'std-16',
          studentName: 'Hannah Abbott',
          score: 10,
          totalQuestions: 10,
          accuracyPercentage: 100,
          xpEarned: 150,
          completedAt: new Date(now - 60 * 60 * 1000).toISOString(),
          timeSpentSeconds: 370,
        },
        {
          studentId: 'std-17',
          studentName: 'Gabriel Mendoza',
          score: 7,
          totalQuestions: 10,
          accuracyPercentage: 70,
          xpEarned: 105,
          completedAt: new Date(now - 30 * 60 * 1000).toISOString(),
          timeSpentSeconds: 610,
        },
        {
          studentId: 'std-18',
          studentName: 'Mia Lindqvist',
          score: 9,
          totalQuestions: 10,
          accuracyPercentage: 90,
          xpEarned: 135,
          completedAt: new Date(now - 15 * 60 * 1000).toISOString(),
          timeSpentSeconds: 450,
        },
      ],
    },
    {
      id: 'hw-seed-02-macro-fiscal',
      teacherId,
      teacherName,
      title: 'Macroeconomic Fiscal Policy & Inflation Quiz',
      subjectCode: '0455',
      subjectName: 'Economics',
      cohortName: '10 Economics',
      testCode: 'REV-305',
      createdAt: new Date(now - 4 * dayMs).toISOString(),
      dueDate: new Date(now + 5 * dayMs).toISOString(),
      durationMinutes: null,
      timerMode: 'Standard',
      roundLength: 8,
      topics: ['Government and the macroeconomy', 'The allocation of resources'],
      questionIds: economicsQIds.length >= 8 ? economicsQIds : fallBackQIds,
      status: 'active',
      settings: {
        allowRetry: true,
        retryXpPercentage: 50,
        addToReviewPile: true,
        shuffleOptions: true,
      },
      totalStudents: 20,
      submissions: [
        {
          studentId: 'std-e01',
          studentName: 'Wei Ming Chen',
          score: 8,
          totalQuestions: 8,
          accuracyPercentage: 100,
          xpEarned: 120,
          completedAt: new Date(now - 2 * dayMs).toISOString(),
          timeSpentSeconds: 310,
        },
        {
          studentId: 'std-e02',
          studentName: 'Liam Tan',
          score: 7,
          totalQuestions: 8,
          accuracyPercentage: 88,
          xpEarned: 105,
          completedAt: new Date(now - 36 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 340,
        },
        {
          studentId: 'std-e03',
          studentName: 'Chloe Dupont',
          score: 6,
          totalQuestions: 8,
          accuracyPercentage: 75,
          xpEarned: 90,
          completedAt: new Date(now - 28 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 410,
        },
        {
          studentId: 'std-e04',
          studentName: 'Tariq Al-Mansoor',
          score: 8,
          totalQuestions: 8,
          accuracyPercentage: 100,
          xpEarned: 120,
          completedAt: new Date(now - 20 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 290,
        },
        {
          studentId: 'std-e05',
          studentName: 'Anya Patel',
          score: 7,
          totalQuestions: 8,
          accuracyPercentage: 88,
          xpEarned: 105,
          completedAt: new Date(now - 12 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 350,
        },
        {
          studentId: 'std-e06',
          studentName: 'Fatima Zahra',
          score: 8,
          totalQuestions: 8,
          accuracyPercentage: 100,
          xpEarned: 120,
          completedAt: new Date(now - 8 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 280,
        },
        {
          studentId: 'std-e07',
          studentName: 'Oliver Smith',
          score: 6,
          totalQuestions: 8,
          accuracyPercentage: 75,
          xpEarned: 90,
          completedAt: new Date(now - 4 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 390,
        },
        {
          studentId: 'std-e08',
          studentName: 'Hannah Abbott',
          score: 7,
          totalQuestions: 8,
          accuracyPercentage: 88,
          xpEarned: 105,
          completedAt: new Date(now - 2 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 330,
        },
      ],
    },
    {
      id: 'hw-seed-03-momentum-prep',
      teacherId,
      teacherName,
      title: "Forces, Momentum & Newton's Laws Prep",
      subjectCode: '0625',
      subjectName: 'Physics',
      cohortName: '11A Physics',
      testCode: 'REV-198',
      createdAt: new Date(now - 8 * dayMs).toISOString(),
      dueDate: new Date(now - 2 * dayMs).toISOString(),
      durationMinutes: 15,
      timerMode: 'Exam',
      roundLength: 10,
      topics: ['General physics', 'Momentum & Impulse', 'Newtonian Mechanics'],
      questionIds: physicsQIds.length >= 10 ? physicsQIds : fallBackQIds,
      status: 'closed',
      settings: {
        allowRetry: false,
        retryXpPercentage: 0,
        addToReviewPile: true,
        shuffleOptions: true,
      },
      totalStudents: 22,
      submissions: [
        {
          studentId: 'std-p01',
          studentName: 'Wei Ming Chen',
          score: 10,
          totalQuestions: 10,
          accuracyPercentage: 100,
          xpEarned: 150,
          completedAt: new Date(now - 3 * dayMs).toISOString(),
          timeSpentSeconds: 410,
        },
        {
          studentId: 'std-p02',
          studentName: 'Liam Tan',
          score: 9,
          totalQuestions: 10,
          accuracyPercentage: 90,
          xpEarned: 135,
          completedAt: new Date(now - 3 * dayMs).toISOString(),
          timeSpentSeconds: 430,
        },
        {
          studentId: 'std-p03',
          studentName: 'Sarah Jenkins',
          score: 9,
          totalQuestions: 10,
          accuracyPercentage: 90,
          xpEarned: 135,
          completedAt: new Date(now - 3 * dayMs).toISOString(),
          timeSpentSeconds: 470,
        },
        {
          studentId: 'std-p04',
          studentName: 'Kenji Sato',
          score: 8,
          totalQuestions: 10,
          accuracyPercentage: 80,
          xpEarned: 120,
          completedAt: new Date(now - 4 * dayMs).toISOString(),
          timeSpentSeconds: 510,
        },
        {
          studentId: 'std-p05',
          studentName: 'Anya Patel',
          score: 8,
          totalQuestions: 10,
          accuracyPercentage: 80,
          xpEarned: 120,
          completedAt: new Date(now - 4 * dayMs).toISOString(),
          timeSpentSeconds: 490,
        },
      ],
    },
    {
      id: 'hw-seed-04-elasticity',
      teacherId,
      teacherName,
      title: 'Price Elasticity & Market Equilibrium',
      subjectCode: '0455',
      subjectName: 'Economics',
      cohortName: '10 Economics',
      testCode: 'REV-519',
      createdAt: new Date(now - 1 * dayMs).toISOString(),
      dueDate: new Date(now + 1 * dayMs).toISOString(),
      durationMinutes: null,
      timerMode: 'Chill',
      roundLength: 5,
      topics: ['The allocation of resources', 'The basic economic problem'],
      questionIds: fallBackQIds,
      status: 'active',
      settings: {
        allowRetry: true,
        retryXpPercentage: 50,
        addToReviewPile: true,
        shuffleOptions: false,
      },
      totalStudents: 20,
      submissions: [
        {
          studentId: 'std-e10',
          studentName: 'Wei Ming Chen',
          score: 5,
          totalQuestions: 5,
          accuracyPercentage: 100,
          xpEarned: 75,
          completedAt: new Date(now - 12 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 160,
        },
        {
          studentId: 'std-e11',
          studentName: 'Liam Tan',
          score: 5,
          totalQuestions: 5,
          accuracyPercentage: 100,
          xpEarned: 75,
          completedAt: new Date(now - 8 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 180,
        },
        {
          studentId: 'std-e12',
          studentName: 'Sarah Jenkins',
          score: 4,
          totalQuestions: 5,
          accuracyPercentage: 80,
          xpEarned: 60,
          completedAt: new Date(now - 4 * 3600 * 1000).toISOString(),
          timeSpentSeconds: 210,
        },
      ],
    },
  ];

  try {
    localStorage.setItem(getStorageKey(teacherId), JSON.stringify(seeded));
    // Also sync to online quiz assignments
    for (const h of seeded) {
      saveOnlineAssignment({
        id: h.id,
        title: h.title,
        subjectCode: h.subjectCode,
        subjectName: h.subjectName,
        cohortName: h.cohortName,
        dueDate: h.dueDate,
        durationMinutes: h.durationMinutes ?? 0,
        questionIds: h.questionIds,
        testCode: h.testCode,
        createdAt: h.createdAt,
      });
    }
    notifyChange();
  } catch (err) {
    console.error('Failed to seed homework list:', err);
  }

  return seeded;
}

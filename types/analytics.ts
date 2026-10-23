// App analytics contract shared by the quiz client, /api/analytics/session,
// /api/quiz/answer and /api/admin/analytics. Aggregates only: nothing here
// identifies a person to anyone but an App Admin, and guests are a random device id.

export type QuizSessionMode =
  | 'topic'
  | 'paper'
  | 'random'
  | 'review'
  | 'mistakes'
  | 'drill'
  | 'homework'
  | 'custom'
  | 'replay';

export const QUIZ_SESSION_MODES: readonly QuizSessionMode[] = [
  'topic', 'paper', 'random', 'review', 'mistakes', 'drill', 'homework', 'custom', 'replay',
];

export type DeviceType = 'phone' | 'tablet' | 'desktop' | 'unknown';

export const DEVICE_TYPES: readonly DeviceType[] = ['phone', 'tablet', 'desktop', 'unknown'];

// POST /api/analytics/session (bearer optional). Fire-and-forget from the client.
export interface AnalyticsSessionStartRequest {
  action: 'start';
  sessionId: string; // client-generated uuid, so answers can carry it before the start lands
  deviceId: string; // random uuid kept in localStorage
  mode: QuizSessionMode;
  subject?: string;
  sourceRef?: string; // topic id, paper id or assignment id
  plannedLength: number | null; // null = endless
  isTimed: boolean;
  deviceType: DeviceType;
}

export interface AnalyticsSessionEndRequest {
  action: 'end';
  sessionId: string;
  deviceId: string;
  endedEarly: boolean; // true when the student pressed finish before the last question
}

export type AnalyticsSessionRequest = AnalyticsSessionStartRequest | AnalyticsSessionEndRequest;

export interface AnalyticsSessionResponse {
  success: boolean;
  error?: string;
}

// GET /api/admin/analytics?range=7d|30d|90d|all (admin only)
export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';

export const ANALYTICS_RANGES: readonly AnalyticsRange[] = ['7d', '30d', '90d', 'all'];

/** Rates are fractions 0-1; null when the denominator is 0. Days are YYYY-MM-DD in Asia/Singapore. */
export interface AppAnalyticsSummary {
  generatedAt: string;
  range: AnalyticsRange;
  rangeStart: string | null; // null for 'all'
  trackingSince: string | null; // first analytics session ever, null if none yet
  timezone: 'Asia/Singapore';

  users: {
    registered: number;
    students: number;
    teachers: number;
    admins: number;
    schoolAccounts: number;
    individualAccounts: number;
    newSignups: number; // profiles created in range
    guestDevices: number; // distinct guest devices active in range
    activeToday: number; // distinct learners (user or guest device) with a session today
    active7d: number;
    active30d: number;
    stickiness: number | null; // activeToday / active30d
    streakBuckets: { label: string; count: number }[]; // '0', '1-2', '3-6', '7-29', '30+'
  };

  quizzes: {
    started: number;
    completed: number; // reached the last question, or finished an endless round
    endedEarly: number; // pressed finish before the end (subset of neither completed nor abandoned)
    abandoned: number; // no end and no activity for 30 minutes
    inProgress: number;
    completionRate: number | null; // completed / started
    avgAnsweredPerSession: number | null;
    avgSessionSeconds: number | null;
    timedShare: number | null;
    byMode: { key: string; started: number; completed: number }[];
    byDevice: { key: string; sessions: number }[];
  };

  answers: {
    total: number; // final answers (one per question per session)
    firstTryAccuracy: number | null;
    retryRecoveryRate: number | null; // retry-correct / (first-wrong finals)
    timeoutRate: number | null;
    avgAnswerSeconds: number | null;
    medianSessionAnswerSeconds: number | null; // median of each session's average time
  };

  daily: {
    day: string;
    activeLearners: number;
    sessionsStarted: number;
    sessionsCompleted: number;
    answers: number;
    firstTryAccuracy: number | null;
  }[];

  heatmap: { weekday: number; hour: number; sessions: number }[]; // weekday 0 = Monday, hour 0-23 SGT

  retention: {
    cohortWeek: string; // Monday of the week the learner was first seen
    size: number;
    week1: number | null; // fraction of the cohort active again in week N
    week2: number | null;
    week3: number | null;
    week4: number | null;
  }[];

  topics: { topicId: string; name: string; answers: number; firstTryAccuracy: number | null; avgAnswerSeconds: number | null }[];

  papers: { paperId: string; title: string; sessions: number; completed: number }[];

  hardestQuestions: AnalyticsQuestionStat[]; // lowest first-try accuracy, min 5 attempts
  slowestQuestions: AnalyticsQuestionStat[]; // highest average time, min 5 attempts
}

export interface AnalyticsQuestionStat {
  questionId: string;
  label: string; // e.g. "0455/12 Feb/Mar 2024 · Q7", falls back to the id
  topic: string | null;
  attempts: number;
  firstTryAccuracy: number | null;
  avgAnswerSeconds: number | null;
  correctLabel: string | null;
  topWrongLabel: string | null; // most picked wrong option on the first attempt
  topWrongShare: number | null; // its share of first-attempt picks
  possibleKeyIssue: boolean; // a wrong option drew more first picks than the correct one
}

export interface AppAnalyticsResponse {
  success: boolean;
  summary?: AppAnalyticsSummary;
  error?: string;
  code?: 'NOT_MIGRATED';
}

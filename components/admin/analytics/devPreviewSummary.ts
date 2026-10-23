// DEV PREVIEW ONLY. Clearly fake numbers so the layout can be checked before the
// analytics migration exists. Loaded solely when NODE_ENV === 'development'.
import type { AppAnalyticsSummary } from '@/types/analytics';

function buildDaily(): AppAnalyticsSummary['daily'] {
  const out: AppAnalyticsSummary['daily'] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const wave = 1 + Math.sin(i / 3);
    const started = Math.round(20 + wave * 14);
    out.push({
      day,
      activeLearners: Math.round(10 + wave * 8),
      sessionsStarted: started,
      sessionsCompleted: Math.round(started * 0.7),
      answers: started * 7,
      firstTryAccuracy: 0.6 + (wave - 1) * 0.05,
    });
  }
  return out;
}

const q = (n: number, issue = false) => ({
  questionId: `sample-${n}`,
  label: `SAMPLE 0000/00 · Q${n}`,
  topic: n % 2 ? 'Sample topic A' : 'Sample topic B',
  attempts: 40 - n,
  firstTryAccuracy: 0.2 + n * 0.05,
  avgAnswerSeconds: 30 + n * 6,
  correctLabel: 'B',
  topWrongLabel: issue ? 'B' : 'C',
  topWrongShare: issue ? 0.55 : 0.4,
  possibleKeyIssue: issue,
});

export const devPreviewSummary: AppAnalyticsSummary = {
  generatedAt: new Date().toISOString(),
  range: '30d',
  rangeStart: null,
  trackingSince: new Date(Date.now() - 45 * 86400000).toISOString(),
  timezone: 'Asia/Singapore',
  users: {
    registered: 123, students: 100, teachers: 15, admins: 3, schoolAccounts: 40, individualAccounts: 83,
    newSignups: 17, guestDevices: 52, activeToday: 14, active7d: 61, active30d: 118, stickiness: 0.119,
    streakBuckets: [
      { label: '0', count: 40 }, { label: '1-2', count: 33 }, { label: '3-6', count: 25 },
      { label: '7-29', count: 18 }, { label: '30+', count: 7 },
    ],
  },
  quizzes: {
    started: 640, completed: 410, endedEarly: 120, abandoned: 95, inProgress: 15, completionRate: 0.64,
    avgAnsweredPerSession: 6.2, avgSessionSeconds: 310, timedShare: 0.58,
    byMode: [
      { key: 'topic', started: 250, completed: 170 }, { key: 'paper', started: 90, completed: 40 },
      { key: 'random', started: 120, completed: 85 }, { key: 'review', started: 70, completed: 55 },
      { key: 'mistakes', started: 40, completed: 28 }, { key: 'drill', started: 30, completed: 18 },
      { key: 'homework', started: 25, completed: 8 }, { key: 'replay', started: 15, completed: 6 },
    ],
    byDevice: [{ key: 'phone', sessions: 410 }, { key: 'desktop', sessions: 190 }, { key: 'tablet', sessions: 40 }],
  },
  answers: {
    total: 3980, firstTryAccuracy: 0.612, retryRecoveryRate: 0.47, timeoutRate: 0.04,
    avgAnswerSeconds: 41.3, medianSessionAnswerSeconds: 37.5,
  },
  daily: buildDaily(),
  heatmap: Array.from({ length: 7 * 24 }, (_, i) => {
    const weekday = Math.floor(i / 24);
    const hour = i % 24;
    const evening = Math.exp(-Math.pow((hour - 20) / 3, 2));
    return { weekday, hour, sessions: Math.round(evening * (weekday > 4 ? 6 : 12)) };
  }),
  retention: [
    { cohortWeek: '2026-09-28', size: 42, week1: 0.38, week2: 0.27, week3: 0.2, week4: 0.17 },
    { cohortWeek: '2026-10-05', size: 51, week1: 0.35, week2: 0.24, week3: 0.19, week4: null },
    { cohortWeek: '2026-10-12', size: 47, week1: 0.4, week2: 0.29, week3: null, week4: null },
    { cohortWeek: '2026-10-19', size: 30, week1: null, week2: null, week3: null, week4: null },
  ],
  topics: [
    { topicId: 't1', name: 'Sample topic A', answers: 800, firstTryAccuracy: 0.42, avgAnswerSeconds: 52 },
    { topicId: 't2', name: 'Sample topic B', answers: 640, firstTryAccuracy: 0.58, avgAnswerSeconds: 44 },
    { topicId: 't3', name: 'Sample topic C', answers: 920, firstTryAccuracy: 0.71, avgAnswerSeconds: 36 },
  ],
  papers: [
    { paperId: 'p1', title: 'SAMPLE Paper 1', sessions: 60, completed: 28 },
    { paperId: 'p2', title: 'SAMPLE Paper 2', sessions: 30, completed: 12 },
  ],
  hardestQuestions: [q(1, true), q(2), q(3), q(4)],
  slowestQuestions: [q(5), q(6), q(7, true)],
};

/**
 * Revizz Student Profile & Revision Engine
 *
 * Provides:
 * 1. Storage Keys, Events, and reactive change subscription.
 * 2. Student Preferences & Cambridge Exam Countdowns (Feb/Mar, May/June, Oct/Nov).
 * 3. Bookmarked & Starred Question curation with personal notes.
 * 4. Completed Quiz Round telemetry history and 7-day daily goal progress.
 * 5. Student XP Rank Tiers (Levels 1-7) & Cambridge Revision Achievements.
 * 6. Topic Mastery & Bank-wide Revision Stats summary aggregation.
 *
 * Strict SSR-Safe: all window/localStorage interactions are guarded.
 * Pure EdTech Engine: zero fake user, cohort, or school data.
 */

import {
  getMasteryTier,
  getFirstTryCorrectIds,
  getReviewPile,
  MasteryTier,
  ReviewPileMap,
} from './mastery';
import type { DiagramFilter } from '../hooks/useQuizGame';

/* ==========================================================================
   1. Storage Keys, Events & Tabs
   ========================================================================== */

export const STUDENT_PREFS_KEY = 'revizz_student_prefs_v1';
export const BOOKMARKED_QUESTIONS_KEY = 'revizz_bookmarked_questions_v1';
export const ROUND_HISTORY_KEY = 'revizz_student_round_history_v1';
/** Profile data lives in localStorage; the active user's id is appended so accounts on one device never share it. */
let storageScope: string | null = null;

export function setStudentStorageScope(userId: string | null | undefined): boolean {
  const next = userId || null;
  if (next === storageScope) return false;
  storageScope = next;
  return true;
}

function scopedKey(base: string): string {
  return storageScope ? `${base}:${storageScope}` : base;
}

export const STUDENT_PROFILE_EVENT = 'revizz:student-profile-updated';

export type StudentProfileTab = 'overview' | 'homework' | 'stats' | 'review' | 'achievements' | 'settings';

function isClient(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function notifyStudentProfileChanged(): void {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent(STUDENT_PROFILE_EVENT));
    } catch (err) {
      console.warn('Failed to dispatch student profile update event:', err);
    }
  }
}

export function subscribeStudentProfileChanges(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(STUDENT_PROFILE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(STUDENT_PROFILE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

/* ==========================================================================
   2. Preferences & Exam Countdown
   ========================================================================== */

export type ExamSeriesCode = 'Feb/Mar' | 'May/June' | 'Oct/Nov';

export interface StudentPreferences {
  displayNameOverride: string;
  avatarEmoji: string;
  primarySubject: string;
  targetExamSeries: ExamSeriesCode;
  targetExamYear: number;
  dailyQuestionGoal: number;
  defaultRoundLength: 3 | 5 | 10 | 30;
  defaultTimedMode: boolean;
  defaultDiagramFilter: DiagramFilter;
}

export interface ExamCountdownInfo {
  daysRemaining: number;
  targetDateIso: string;
  seriesLabel: string;
  urgencyTier: 'calm' | 'focused' | 'sprint';
}

export function getDefaultStudentPreferences(): StudentPreferences {
  return {
    displayNameOverride: '',
    avatarEmoji: '🎓',
    primarySubject: 'Economics 0455',
    targetExamSeries: 'May/June',
    targetExamYear: 2027,
    dailyQuestionGoal: 10,
    defaultRoundLength: 5,
    defaultTimedMode: true,
    defaultDiagramFilter: 'mixed',
  };
}

export function getStudentPreferences(): StudentPreferences {
  const defaults = getDefaultStudentPreferences();
  if (!isClient()) return defaults;

  try {
    const raw = localStorage.getItem(scopedKey(STUDENT_PREFS_KEY));
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    return {
      displayNameOverride:
        typeof parsed.displayNameOverride === 'string'
          ? parsed.displayNameOverride
          : defaults.displayNameOverride,
      avatarEmoji:
        typeof parsed.avatarEmoji === 'string' && parsed.avatarEmoji
          ? parsed.avatarEmoji
          : defaults.avatarEmoji,
      primarySubject:
        typeof parsed.primarySubject === 'string' && parsed.primarySubject
          ? parsed.primarySubject
          : defaults.primarySubject,
      targetExamSeries:
        parsed.targetExamSeries === 'Feb/Mar' ||
        parsed.targetExamSeries === 'May/June' ||
        parsed.targetExamSeries === 'Oct/Nov'
          ? parsed.targetExamSeries
          : defaults.targetExamSeries,
      targetExamYear:
        typeof parsed.targetExamYear === 'number' && parsed.targetExamYear > 2000
          ? parsed.targetExamYear
          : defaults.targetExamYear,
      dailyQuestionGoal:
        typeof parsed.dailyQuestionGoal === 'number' && parsed.dailyQuestionGoal > 0
          ? parsed.dailyQuestionGoal
          : defaults.dailyQuestionGoal,
      defaultRoundLength:
        parsed.defaultRoundLength === 3 ||
        parsed.defaultRoundLength === 5 ||
        parsed.defaultRoundLength === 10 ||
        parsed.defaultRoundLength === 30
          ? parsed.defaultRoundLength
          : defaults.defaultRoundLength,
      defaultTimedMode:
        typeof parsed.defaultTimedMode === 'boolean'
          ? parsed.defaultTimedMode
          : defaults.defaultTimedMode,
      defaultDiagramFilter:
        parsed.defaultDiagramFilter === 'all' ||
        parsed.defaultDiagramFilter === 'mixed' ||
        parsed.defaultDiagramFilter === 'graph' ||
        parsed.defaultDiagramFilter === 'diagram' ||
        parsed.defaultDiagramFilter === 'diagrams' ||
        parsed.defaultDiagramFilter === 'text' ||
        parsed.defaultDiagramFilter === 'no-diagrams'
          ? parsed.defaultDiagramFilter
          : defaults.defaultDiagramFilter,
    };
  } catch (err) {
    console.warn('Failed to parse student preferences:', err);
    return defaults;
  }
}

export function saveStudentPreferences(partial: Partial<StudentPreferences>): StudentPreferences {
  const current = getStudentPreferences();
  const updated: StudentPreferences = {
    ...current,
    ...partial,
  };

  if (isClient()) {
    try {
      localStorage.setItem(scopedKey(STUDENT_PREFS_KEY), JSON.stringify(updated));

      // Synchronize shared config with StartFlow's revizz_last_config
      const rawConfig = localStorage.getItem('revizz_last_config');
      const existingConfig = rawConfig ? JSON.parse(rawConfig) : {};
      const updatedConfig = { ...existingConfig };
      let configChanged = false;

      if (partial.defaultRoundLength !== undefined) {
        updatedConfig.roundLength = partial.defaultRoundLength;
        configChanged = true;
      }
      if (partial.defaultTimedMode !== undefined) {
        updatedConfig.isTimed = partial.defaultTimedMode;
        configChanged = true;
      }
      if (partial.defaultDiagramFilter !== undefined) {
        updatedConfig.diagramFilter = partial.defaultDiagramFilter;
        configChanged = true;
      }
      if (partial.primarySubject !== undefined) {
        updatedConfig.subject = partial.primarySubject;
        configChanged = true;
      }

      if (configChanged) {
        localStorage.setItem('revizz_last_config', JSON.stringify(updatedConfig));
      }

      notifyStudentProfileChanged();
    } catch (err) {
      console.warn('Failed to save student preferences:', err);
    }
  }

  return updated;
}

export function getExamCountdown(
  series: ExamSeriesCode,
  year: number,
  nowMs: number = Date.now()
): ExamCountdownInfo {
  let targetDateIso: string;
  let seriesLabel: string;

  switch (series) {
    case 'Feb/Mar':
      targetDateIso = `${year}-02-15T09:00:00Z`;
      seriesLabel = `Feb/Mar ${year}`;
      break;
    case 'Oct/Nov':
      targetDateIso = `${year}-10-01T09:00:00Z`;
      seriesLabel = `Oct/Nov ${year}`;
      break;
    case 'May/June':
    default:
      targetDateIso = `${year}-05-04T09:00:00Z`;
      seriesLabel = `May/June ${year}`;
      break;
  }

  const targetMs = new Date(targetDateIso).getTime();
  const daysRemaining = Math.max(0, Math.ceil((targetMs - nowMs) / 86_400_000));

  let urgencyTier: 'calm' | 'focused' | 'sprint' = 'calm';
  if (daysRemaining <= 30) {
    urgencyTier = 'sprint';
  } else if (daysRemaining <= 90) {
    urgencyTier = 'focused';
  }

  return {
    daysRemaining,
    targetDateIso,
    seriesLabel,
    urgencyTier,
  };
}

/* ==========================================================================
   3. Bookmarked / Starred Questions
   ========================================================================== */

export interface BookmarkEntry {
  questionId: string;
  savedAt: number;
  note?: string;
  subject?: string;
  topicId?: string;
}

export function getBookmarkedQuestions(): BookmarkEntry[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(scopedKey(BOOKMARKED_QUESTIONS_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is BookmarkEntry => Boolean(item && typeof item.questionId === 'string')
      );
    }
  } catch (err) {
    console.warn('Failed to parse bookmarked questions:', err);
  }
  return [];
}

export function getBookmarkedQuestionIds(): string[] {
  return getBookmarkedQuestions().map((b) => b.questionId);
}

export function isQuestionBookmarked(questionId: string): boolean {
  if (!questionId) return false;
  return getBookmarkedQuestions().some((b) => b.questionId === questionId);
}

export function toggleQuestionBookmark(
  questionId: string,
  meta?: { subject?: string; topicId?: string; note?: string }
): boolean {
  if (!questionId) return false;
  const current = getBookmarkedQuestions();
  const exists = current.some((b) => b.questionId === questionId);

  if (exists) {
    removeQuestionBookmark(questionId);
    return false;
  }

  const entry: BookmarkEntry = {
    questionId,
    savedAt: Date.now(),
    ...(meta?.subject ? { subject: meta.subject } : {}),
    ...(meta?.topicId ? { topicId: meta.topicId } : {}),
    ...(meta?.note ? { note: meta.note } : {}),
  };

  const updated = [entry, ...current.filter((b) => b.questionId !== questionId)];
  if (isClient()) {
    try {
      localStorage.setItem(scopedKey(BOOKMARKED_QUESTIONS_KEY), JSON.stringify(updated));
      notifyStudentProfileChanged();
    } catch (err) {
      console.warn('Failed to save bookmark:', err);
    }
  }
  return true;
}

export function removeQuestionBookmark(questionId: string): void {
  if (!questionId) return;
  const current = getBookmarkedQuestions();
  const updated = current.filter((b) => b.questionId !== questionId);
  if (isClient()) {
    try {
      localStorage.setItem(scopedKey(BOOKMARKED_QUESTIONS_KEY), JSON.stringify(updated));
      notifyStudentProfileChanged();
    } catch (err) {
      console.warn('Failed to remove bookmark:', err);
    }
  }
}

export function updateBookmarkNote(questionId: string, note: string): void {
  if (!questionId) return;
  const current = getBookmarkedQuestions();
  let changed = false;
  const updated = current.map((b) => {
    if (b.questionId === questionId) {
      changed = true;
      return { ...b, note };
    }
    return b;
  });

  if (changed && isClient()) {
    try {
      localStorage.setItem(scopedKey(BOOKMARKED_QUESTIONS_KEY), JSON.stringify(updated));
      notifyStudentProfileChanged();
    } catch (err) {
      console.warn('Failed to update bookmark note:', err);
    }
  }
}

export function clearBookmarkedQuestions(): void {
  if (isClient()) {
    try {
      localStorage.removeItem(scopedKey(BOOKMARKED_QUESTIONS_KEY));
      notifyStudentProfileChanged();
    } catch (err) {
      console.warn('Failed to clear bookmarked questions:', err);
    }
  }
}

/* ==========================================================================
   4. Completed Quiz Round History & Daily Goal Progress
   ========================================================================== */

export interface CompletedRoundRecord {
  id: string;
  completedAt: number;
  subject: string;
  sourceType: 'topic' | 'paper' | 'random' | 'review';
  sourceLabel: string;
  totalQuestions: number;
  correctFirstTry: number;
  correctRetry: number;
  wrongCount: number;
  accuracyPct: number;
  xpEarned: number;
  peakStreak: number;
  isTimed: boolean;
}

export interface DailyGoalProgress {
  questionsAnsweredToday: number;
  dailyGoal: number;
  progressPct: number;
  isGoalMet: boolean;
  activeDaysLast7: { dateStr: string; dayShort: string; count: number; active: boolean }[];
}

export function getRoundHistory(): CompletedRoundRecord[] {
  if (!isClient()) return [];
  try {
    const raw = localStorage.getItem(scopedKey(ROUND_HISTORY_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (err) {
    console.warn('Failed to parse round history:', err);
  }
  return [];
}

export function recordCompletedRound(
  input: Omit<CompletedRoundRecord, 'id' | 'completedAt' | 'accuracyPct'> & {
    id?: string;
    completedAt?: number;
    accuracyPct?: number;
  }
): CompletedRoundRecord {
  const id =
    input.id ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `round_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  const completedAt = input.completedAt ?? Date.now();
  const accuracyPct =
    input.accuracyPct !== undefined
      ? input.accuracyPct
      : input.totalQuestions > 0
        ? Math.round((input.correctFirstTry / input.totalQuestions) * 100)
        : 0;

  const record: CompletedRoundRecord = {
    id,
    completedAt,
    subject: input.subject,
    sourceType: input.sourceType,
    sourceLabel: input.sourceLabel,
    totalQuestions: input.totalQuestions,
    correctFirstTry: input.correctFirstTry,
    correctRetry: input.correctRetry,
    wrongCount: input.wrongCount,
    accuracyPct,
    xpEarned: input.xpEarned,
    peakStreak: input.peakStreak,
    isTimed: input.isTimed,
  };

  const current = getRoundHistory();
  const updated = [record, ...current]
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, 50);

  if (isClient()) {
    try {
      localStorage.setItem(scopedKey(ROUND_HISTORY_KEY), JSON.stringify(updated));
      notifyStudentProfileChanged();
    } catch (err) {
      console.warn('Failed to save round history:', err);
    }
  }

  return record;
}

export function clearRoundHistory(): void {
  if (isClient()) {
    try {
      localStorage.removeItem(scopedKey(ROUND_HISTORY_KEY));
      notifyStudentProfileChanged();
    } catch (err) {
      console.warn('Failed to clear round history:', err);
    }
  }
}

function toLocalDateStr(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDailyGoalProgress(
  history?: CompletedRoundRecord[],
  dailyGoal?: number,
  nowMs: number = Date.now()
): DailyGoalProgress {
  const now = new Date(nowMs);
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const activeDaysLast7: { dateStr: string; dayShort: string; count: number; active: boolean }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    activeDaysLast7.push({
      dateStr: toLocalDateStr(d),
      dayShort: dayNames[d.getDay()],
      count: 0,
      active: false,
    });
  }

  const dayMap = new Map<string, (typeof activeDaysLast7)[number]>();
  for (const day of activeDaysLast7) {
    dayMap.set(day.dateStr, day);
  }

  const rounds = history ?? (isClient() ? getRoundHistory() : []);
  for (const round of rounds) {
    const roundDate = new Date(round.completedAt);
    const roundDateStr = toLocalDateStr(roundDate);
    const matched = dayMap.get(roundDateStr);
    if (matched) {
      matched.count += round.totalQuestions;
      matched.active = matched.count > 0;
    }
  }

  const todayStr = toLocalDateStr(now);
  const todayEntry = dayMap.get(todayStr);
  const questionsAnsweredToday = todayEntry ? todayEntry.count : 0;

  const targetGoal =
    dailyGoal && dailyGoal > 0
      ? dailyGoal
      : isClient()
        ? getStudentPreferences().dailyQuestionGoal
        : getDefaultStudentPreferences().dailyQuestionGoal;

  const progressPct =
    targetGoal > 0 ? Math.min(100, Math.round((questionsAnsweredToday / targetGoal) * 100)) : 0;
  const isGoalMet = questionsAnsweredToday >= targetGoal;

  return {
    questionsAnsweredToday,
    dailyGoal: targetGoal,
    progressPct,
    isGoalMet,
    activeDaysLast7,
  };
}

/* ==========================================================================
   5. Student XP Rank Tiers & Achievements
   ========================================================================== */

export interface StudentRankInfo {
  level: number;
  title: string;
  badgeEmoji: string;
  currentXp: number;
  currentLevelMinXp: number;
  nextLevelXp: number;
  progressPct: number;
}

export interface StudentAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'streak' | 'mastery' | 'volume' | 'precision' | 'review';
  unlocked: boolean;
  progressCurrent: number;
  progressTarget: number;
  progressPct: number;
}

export interface AchievementEvalInput {
  totalXp: number;
  currentStreak: number;
  firstTryCorrectCount: number;
  reviewPileCount: number;
  bookmarkedCount: number;
  roundsCompleted: number;
  perfectRoundsCount: number;
  masteredTopicsCount: number;
}

const XP_TIERS = [
  { level: 1, minXp: 0, nextXp: 250, title: 'Revision Rookie', badgeEmoji: '🌱' },
  { level: 2, minXp: 250, nextXp: 600, title: 'Syllabus Explorer', badgeEmoji: '🧭' },
  { level: 3, minXp: 600, nextXp: 1200, title: 'Concept Builder', badgeEmoji: '🧱' },
  { level: 4, minXp: 1200, nextXp: 2200, title: 'Distractor Hunter', badgeEmoji: '🎯' },
  { level: 5, minXp: 2200, nextXp: 3500, title: 'Exam Strategist', badgeEmoji: '⚡' },
  { level: 6, minXp: 3500, nextXp: 5000, title: 'Cambridge Scholar', badgeEmoji: '📜' },
  { level: 7, minXp: 5000, nextXp: 5000, title: 'Master of Revision', badgeEmoji: '👑' },
] as const;

export function calculateStudentRank(totalXp: number): StudentRankInfo {
  const currentXp = Math.max(0, Math.round(totalXp || 0));

  let tier: (typeof XP_TIERS)[number] = XP_TIERS[0];
  for (let i = XP_TIERS.length - 1; i >= 0; i--) {
    if (currentXp >= XP_TIERS[i].minXp) {
      tier = XP_TIERS[i];
      break;
    }
  }

  const isMaxLevel = tier.level === 7;
  const progressPct = isMaxLevel
    ? 100
    : Math.min(
        100,
        Math.max(0, Math.round(((currentXp - tier.minXp) / (tier.nextXp - tier.minXp)) * 100))
      );

  return {
    level: tier.level,
    title: tier.title,
    badgeEmoji: tier.badgeEmoji,
    currentXp,
    currentLevelMinXp: tier.minXp,
    nextLevelXp: tier.nextXp,
    progressPct,
  };
}

export function evaluateStudentAchievements(input: AchievementEvalInput): StudentAchievement[] {
  const achievementsConfig: {
    id: string;
    title: string;
    description: string;
    icon: string;
    category: 'streak' | 'mastery' | 'volume' | 'precision' | 'review';
    progressCurrent: number;
    progressTarget: number;
  }[] = [
    {
      id: 'first-round',
      title: 'First Step',
      description: 'Complete your first revision quiz round',
      icon: '🚀',
      category: 'volume',
      progressCurrent: Math.max(0, input.roundsCompleted),
      progressTarget: 1,
    },
    {
      id: 'streak-5',
      title: 'Hot Streak',
      description: 'Reach a 5-question answer streak',
      icon: '🔥',
      category: 'streak',
      progressCurrent: Math.max(0, input.currentStreak),
      progressTarget: 5,
    },
    {
      id: 'streak-10',
      title: 'Unstoppable',
      description: 'Reach a 10-question answer streak',
      icon: '⚡',
      category: 'streak',
      progressCurrent: Math.max(0, input.currentStreak),
      progressTarget: 10,
    },
    {
      id: 'first-try-25',
      title: 'First-Try Ace',
      description: 'Answer 25 questions correctly on your first attempt',
      icon: '🎯',
      category: 'precision',
      progressCurrent: Math.max(0, input.firstTryCorrectCount),
      progressTarget: 25,
    },
    {
      id: 'first-try-100',
      title: 'Century Club',
      description: 'Answer 100 questions correctly on your first attempt',
      icon: '💯',
      category: 'precision',
      progressCurrent: Math.max(0, input.firstTryCorrectCount),
      progressTarget: 100,
    },
    {
      id: 'perfect-round',
      title: 'Flawless Round',
      description: 'Score 100% accuracy on first attempts in a quiz round',
      icon: '⭐',
      category: 'precision',
      progressCurrent: Math.max(0, input.perfectRoundsCount),
      progressTarget: 1,
    },
    {
      id: 'topic-master',
      title: 'Topic Champion',
      description: 'Reach Master tier (>80% mastery) in at least one syllabus topic',
      icon: '👑',
      category: 'mastery',
      progressCurrent: Math.max(0, input.masteredTopicsCount),
      progressTarget: 1,
    },
    {
      id: 'study-curator',
      title: 'Study Curator',
      description: 'Bookmark 5 or more tricky questions to your revision pile',
      icon: '📌',
      category: 'review',
      progressCurrent: Math.max(0, input.bookmarkedCount),
      progressTarget: 5,
    },
  ];

  return achievementsConfig.map((item) => {
    const currentClamped = Math.min(item.progressTarget, item.progressCurrent);
    const unlocked = item.progressCurrent >= item.progressTarget;
    const progressPct =
      item.progressTarget > 0
        ? Math.min(100, Math.round((currentClamped / item.progressTarget) * 100))
        : 0;

    return {
      id: item.id,
      title: item.title,
      description: item.description,
      icon: item.icon,
      category: item.category,
      unlocked,
      progressCurrent: currentClamped,
      progressTarget: item.progressTarget,
      progressPct,
    };
  });
}

/* ==========================================================================
   6. Topic & Overall Stats Aggregation
   ========================================================================== */

export interface TopicStatItem {
  topicId: string;
  topicName: string;
  totalQuestions: number;
  firstTryCorrectCount: number;
  masteryPct: number;
  tier: 'novice' | 'proficient' | 'master';
  reviewMistakeCount: number;
  bookmarkedCount: number;
}

export interface StudentStatsSummary {
  totalQuestionsInBank: number;
  totalFirstTryCorrect: number;
  overallMasteryPct: number;
  roundsCompleted: number;
  totalQuestionsAttemptedInRounds: number;
  averageRoundAccuracyPct: number;
  bestRoundStreak: number;
  reviewPileQuestionCount: number;
  totalReviewMistakes: number;
  bookmarkedQuestionCount: number;
  masteredTopicsCount: number;
  proficientTopicsCount: number;
  noviceTopicsCount: number;
  topicStats: TopicStatItem[];
  weakestTopics: TopicStatItem[];
  strongestTopics: TopicStatItem[];
}

export function computeStudentStatsSummary(params: {
  questions: { id: string; topic_id?: string; topic?: string }[];
  topics: { id: string; name: string }[];
  firstTryIds?: string[];
  reviewPile?: Record<string, { mistakeCount: number; lastMistakeAt: number }>;
  bookmarks?: BookmarkEntry[];
  roundHistory?: CompletedRoundRecord[];
}): StudentStatsSummary {
  const { questions } = params;

  // Resolve topics with graceful fallback
  let topics = params.topics;
  if (!topics || topics.length === 0) {
    const derived = new Map<string, string>();
    for (const q of questions) {
      const tid = q.topic_id || q.topic;
      if (tid && !derived.has(tid)) {
        derived.set(tid, q.topic || tid);
      }
    }
    topics = Array.from(derived.entries()).map(([id, name]) => ({ id, name }));
  }

  // Resolve first-try correct set
  const firstTryList = params.firstTryIds ?? (isClient() ? getFirstTryCorrectIds() : []);
  const firstTrySet = new Set(firstTryList);

  // Resolve review pile
  const pile: ReviewPileMap = params.reviewPile ?? (isClient() ? getReviewPile() : {});

  // Resolve bookmarks
  const bookmarksList = params.bookmarks ?? (isClient() ? getBookmarkedQuestions() : []);
  const bookmarkedQuestionSet = new Set(bookmarksList.map((b) => b.questionId));

  // Resolve round history
  const history = params.roundHistory ?? (isClient() ? getRoundHistory() : []);

  // Compute per-topic statistics
  const topicStats: TopicStatItem[] = topics.map((topic) => {
    // Match questions belonging to this topic
    const topicQuestions = questions.filter((q) => {
      if (q.topic_id && q.topic_id === topic.id) return true;
      if (q.topic && q.topic === topic.name) return true;
      if (q.topic_id && q.topic_id === topic.name) return true;
      if (q.topic && q.topic === topic.id) return true;
      return false;
    });

    const totalQuestions = topicQuestions.length;
    const firstTryCorrectCount = topicQuestions.filter((q) => firstTrySet.has(q.id)).length;
    const masteryPct =
      totalQuestions > 0
        ? Math.min(100, Math.max(0, Math.round((firstTryCorrectCount / totalQuestions) * 100)))
        : 0;

    const tier: MasteryTier = getMasteryTier(masteryPct);

    let reviewMistakeCount = 0;
    for (const q of topicQuestions) {
      const entry = pile[q.id];
      if (entry && typeof entry.mistakeCount === 'number') {
        reviewMistakeCount += entry.mistakeCount;
      }
    }

    const bookmarkedCount = topicQuestions.filter((q) => bookmarkedQuestionSet.has(q.id)).length;

    return {
      topicId: topic.id,
      topicName: topic.name,
      totalQuestions,
      firstTryCorrectCount,
      masteryPct,
      tier,
      reviewMistakeCount,
      bookmarkedCount,
    };
  });

  // Calculate overall metrics
  const totalQuestionsInBank = questions.length;
  const totalFirstTryCorrect = questions.filter((q) => firstTrySet.has(q.id)).length;
  const overallMasteryPct =
    totalQuestionsInBank > 0
      ? Math.min(100, Math.max(0, Math.round((totalFirstTryCorrect / totalQuestionsInBank) * 100)))
      : 0;

  const roundsCompleted = history.length;
  const totalQuestionsAttemptedInRounds = history.reduce(
    (sum, r) => sum + (r.totalQuestions || 0),
    0
  );
  const averageRoundAccuracyPct =
    roundsCompleted > 0
      ? Math.round(history.reduce((sum, r) => sum + (r.accuracyPct || 0), 0) / roundsCompleted)
      : 0;
  const bestRoundStreak = history.reduce((max, r) => Math.max(max, r.peakStreak || 0), 0);

  const reviewPileQuestionCount = Object.keys(pile).length;
  const totalReviewMistakes = Object.values(pile).reduce(
    (sum, item) => sum + (item.mistakeCount || 0),
    0
  );

  const bookmarkedQuestionCount = bookmarksList.length;

  const masteredTopicsCount = topicStats.filter((t) => t.tier === 'master').length;
  const proficientTopicsCount = topicStats.filter((t) => t.tier === 'proficient').length;
  const noviceTopicsCount = topicStats.filter((t) => t.tier === 'novice').length;

  // Weakest topics: lowest mastery percentage, tie-break on highest review mistakes
  const weakestTopics = [...topicStats]
    .sort((a, b) => {
      if (a.masteryPct !== b.masteryPct) return a.masteryPct - b.masteryPct;
      if (b.reviewMistakeCount !== a.reviewMistakeCount)
        return b.reviewMistakeCount - a.reviewMistakeCount;
      return b.totalQuestions - a.totalQuestions;
    })
    .slice(0, 3);

  // Strongest topics: highest mastery percentage, tie-break on question volume
  const strongestTopics = [...topicStats]
    .sort((a, b) => {
      if (a.masteryPct !== b.masteryPct) return b.masteryPct - a.masteryPct;
      if (a.reviewMistakeCount !== b.reviewMistakeCount)
        return a.reviewMistakeCount - b.reviewMistakeCount;
      return b.totalQuestions - a.totalQuestions;
    })
    .slice(0, 3);

  return {
    totalQuestionsInBank,
    totalFirstTryCorrect,
    overallMasteryPct,
    roundsCompleted,
    totalQuestionsAttemptedInRounds,
    averageRoundAccuracyPct,
    bestRoundStreak,
    reviewPileQuestionCount,
    totalReviewMistakes,
    bookmarkedQuestionCount,
    masteredTopicsCount,
    proficientTopicsCount,
    noviceTopicsCount,
    topicStats,
    weakestTopics,
    strongestTopics,
  };
}

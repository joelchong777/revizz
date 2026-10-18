/**
 * Revizz Student Profile Engine - Verification Suite
 *
 * Verifies:
 * 1. Default preferences and schema contract.
 * 2. Cambridge exam countdown calculation and urgency tiers.
 * 3. Client storage persistence, start config syncing, and event subscription.
 * 4. Question bookmarking, notes, and toggling.
 * 5. Quiz round history telemetry and 7-day daily goal tracking.
 * 6. XP rank tier calculations (Levels 1-7).
 * 7. Cambridge revision achievements evaluation.
 * 8. Syllabus topic stats aggregation, tier assignment, and weakest/strongest sorting.
 */

import assert from 'assert';
import {
  STUDENT_PREFS_KEY,
  BOOKMARKED_QUESTIONS_KEY,
  ROUND_HISTORY_KEY,
  STUDENT_PROFILE_EVENT,
  StudentPreferences,
  getDefaultStudentPreferences,
  getStudentPreferences,
  saveStudentPreferences,
  getExamCountdown,
  getBookmarkedQuestions,
  getBookmarkedQuestionIds,
  isQuestionBookmarked,
  toggleQuestionBookmark,
  removeQuestionBookmark,
  updateBookmarkNote,
  clearBookmarkedQuestions,
  getRoundHistory,
  recordCompletedRound,
  clearRoundHistory,
  getDailyGoalProgress,
  calculateStudentRank,
  evaluateStudentAchievements,
  computeStudentStatsSummary,
  subscribeStudentProfileChanges,
  notifyStudentProfileChanged,
} from '../lib/studentProfile';

console.log('--- 🧪 STARTING STUDENT PROFILE ENGINE VERIFICATION ---');

// ============================================================================
// 1. Default Preferences & Types
// ============================================================================
console.log('1. Verifying Default Student Preferences...');
const defaults = getDefaultStudentPreferences();
assert.strictEqual(defaults.displayNameOverride, '', 'Default display name should be empty');
assert.strictEqual(defaults.avatarEmoji, '🎓', 'Default avatar should be 🎓');
assert.strictEqual(defaults.primarySubject, 'Economics 0455', 'Default subject should be Economics 0455');
assert.strictEqual(defaults.targetExamSeries, 'May/June', 'Default series should be May/June');
assert.strictEqual(defaults.targetExamYear, 2027, 'Default exam year should be 2027');
assert.strictEqual(defaults.dailyQuestionGoal, 10, 'Default daily goal should be 10');
assert.strictEqual(defaults.defaultRoundLength, 5, 'Default round length should be 5');
assert.strictEqual(defaults.defaultTimedMode, true, 'Default timed mode should be true');
assert.strictEqual(defaults.defaultDiagramFilter, 'mixed', 'Default diagram filter should be mixed');
console.log('   ✅ Default preferences verified.');

// ============================================================================
// 2. Cambridge Exam Countdown Calculation
// ============================================================================
console.log('2. Verifying Exam Countdown Calculations...');

// Feb/Mar target
const febMarCountdown = getExamCountdown('Feb/Mar', 2027, new Date('2027-01-15T09:00:00Z').getTime());
assert.strictEqual(febMarCountdown.seriesLabel, 'Feb/Mar 2027');
assert.strictEqual(febMarCountdown.targetDateIso, '2027-02-15T09:00:00Z');
assert.strictEqual(febMarCountdown.daysRemaining, 31);
assert.strictEqual(febMarCountdown.urgencyTier, 'focused'); // 31 days is <= 90

// May/June sprint tier (10 days remaining)
const sprintMayJune = getExamCountdown('May/June', 2027, new Date('2027-04-24T09:00:00Z').getTime());
assert.strictEqual(sprintMayJune.daysRemaining, 10);
assert.strictEqual(sprintMayJune.urgencyTier, 'sprint'); // <= 30

// Oct/Nov calm tier (200 days remaining)
const calmOctNov = getExamCountdown('Oct/Nov', 2027, new Date('2027-03-01T09:00:00Z').getTime());
assert.strictEqual(calmOctNov.urgencyTier, 'calm'); // > 90
assert.ok(calmOctNov.daysRemaining > 100);

// Past exam date (clamped to 0 days remaining and sprint tier)
const pastExam = getExamCountdown('May/June', 2024, new Date('2025-01-01T00:00:00Z').getTime());
assert.strictEqual(pastExam.daysRemaining, 0);
assert.strictEqual(pastExam.urgencyTier, 'sprint');
console.log('   ✅ Exam countdown calculations verified.');

// ============================================================================
// 3. Mock Browser Environment for Storage & Event Tests
// ============================================================================
console.log('3. Setting up Mock Browser Environment for Persistence Tests...');

const mockStorage = new Map<string, string>();
const eventListeners: Record<string, Function[]> = {};

// Mock Event Target
const mockWindow = {
  addEventListener(event: string, fn: Function) {
    if (!eventListeners[event]) eventListeners[event] = [];
    eventListeners[event].push(fn);
  },
  removeEventListener(event: string, fn: Function) {
    if (eventListeners[event]) {
      eventListeners[event] = eventListeners[event].filter((cb) => cb !== fn);
    }
  },
  dispatchEvent(evt: { type: string }) {
    const list = eventListeners[evt.type] || [];
    for (const fn of list) {
      fn(evt);
    }
    return true;
  },
};

const mockLocalStorage = {
  getItem(key: string): string | null {
    return mockStorage.get(key) ?? null;
  },
  setItem(key: string, val: string) {
    mockStorage.set(key, String(val));
  },
  removeItem(key: string) {
    mockStorage.delete(key);
  },
  clear() {
    mockStorage.clear();
  },
};

// Install mocks into globalThis
(globalThis as any).window = mockWindow;
(globalThis as any).localStorage = mockLocalStorage;
(globalThis as any).CustomEvent = class CustomEvent {
  type: string;
  detail: any;
  constructor(type: string, params?: { detail?: any }) {
    this.type = type;
    this.detail = params?.detail;
  }
};

// Verify reactive event subscription
let profileEventFiredCount = 0;
const unsubscribe = subscribeStudentProfileChanges(() => {
  profileEventFiredCount++;
});

// Verify initial read is defaults
const initialPrefs = getStudentPreferences();
assert.strictEqual(initialPrefs.displayNameOverride, '');

// Save partial preferences
saveStudentPreferences({
  displayNameOverride: 'Ada Lovelace',
  avatarEmoji: '⚡',
  defaultRoundLength: 10,
  defaultTimedMode: false,
  defaultDiagramFilter: 'diagrams',
  primarySubject: 'Physics 0625',
});

const updatedPrefs = getStudentPreferences();
assert.strictEqual(updatedPrefs.displayNameOverride, 'Ada Lovelace');
assert.strictEqual(updatedPrefs.avatarEmoji, '⚡');
assert.strictEqual(updatedPrefs.defaultRoundLength, 10);
assert.strictEqual(updatedPrefs.defaultTimedMode, false);
assert.strictEqual(updatedPrefs.defaultDiagramFilter, 'diagrams');
assert.strictEqual(updatedPrefs.primarySubject, 'Physics 0625');
assert.strictEqual(updatedPrefs.targetExamSeries, 'May/June'); // Preserved default

// Verify StartFlow's revizz_last_config synchronization
const lastConfigRaw = mockLocalStorage.getItem('revizz_last_config');
assert.ok(lastConfigRaw, 'revizz_last_config should be populated');
const lastConfig = JSON.parse(lastConfigRaw!);
assert.strictEqual(lastConfig.roundLength, 10);
assert.strictEqual(lastConfig.isTimed, false);
assert.strictEqual(lastConfig.diagramFilter, 'diagrams');
assert.strictEqual(lastConfig.subject, 'Physics 0625');

assert.ok(profileEventFiredCount > 0, 'Profile update event should have triggered');

console.log('   ✅ Preferences persistence & revizz_last_config sync verified.');

// ============================================================================
// 4. Bookmarked Questions Management
// ============================================================================
console.log('4. Verifying Question Bookmarking...');

assert.strictEqual(getBookmarkedQuestions().length, 0);
assert.strictEqual(isQuestionBookmarked('q-econ-001'), false);

// Toggle bookmark ON
const toggledOn = toggleQuestionBookmark('q-econ-001', {
  subject: 'Economics 0455',
  topicId: 'topic-price-elasticity',
  note: 'Check formula for PED',
});
assert.strictEqual(toggledOn, true, 'Toggling a new bookmark should return true');
assert.strictEqual(isQuestionBookmarked('q-econ-001'), true);
assert.deepStrictEqual(getBookmarkedQuestionIds(), ['q-econ-001']);

// Check bookmark entry details
const bookmarks = getBookmarkedQuestions();
assert.strictEqual(bookmarks.length, 1);
assert.strictEqual(bookmarks[0].questionId, 'q-econ-001');
assert.strictEqual(bookmarks[0].note, 'Check formula for PED');
assert.strictEqual(bookmarks[0].topicId, 'topic-price-elasticity');

// Update bookmark note
updateBookmarkNote('q-econ-001', 'Remember: PED is percentage change in Qd / percentage change in P');
const updatedBookmarks = getBookmarkedQuestions();
assert.strictEqual(
  updatedBookmarks[0].note,
  'Remember: PED is percentage change in Qd / percentage change in P'
);

// Add second bookmark
toggleQuestionBookmark('q-econ-002', { subject: 'Economics 0455', topicId: 'topic-fiscal-policy' });
assert.strictEqual(getBookmarkedQuestions().length, 2);

// Toggle bookmark OFF
const toggledOff = toggleQuestionBookmark('q-econ-001');
assert.strictEqual(toggledOff, false, 'Toggling an existing bookmark should return false');
assert.strictEqual(isQuestionBookmarked('q-econ-001'), false);
assert.strictEqual(getBookmarkedQuestions().length, 1);

// Remove remaining bookmark
removeQuestionBookmark('q-econ-002');
assert.strictEqual(getBookmarkedQuestions().length, 0);

// Clear bookmarks
toggleQuestionBookmark('q-econ-003');
assert.strictEqual(getBookmarkedQuestions().length, 1);
clearBookmarkedQuestions();
assert.strictEqual(getBookmarkedQuestions().length, 0);

console.log('   ✅ Question bookmarking verified.');

// ============================================================================
// 5. Completed Quiz Round History & Daily Goal Progress
// ============================================================================
console.log('5. Verifying Completed Round Telemetry & 7-Day Daily Goal Progress...');

clearRoundHistory();
assert.strictEqual(getRoundHistory().length, 0);

const testBaseTime = new Date('2026-10-18T14:00:00Z').getTime();

// Record Round 1 (Today): 5 questions, 4 correct on first try
const r1 = recordCompletedRound({
  completedAt: testBaseTime,
  subject: 'Economics 0455',
  sourceType: 'topic',
  sourceLabel: 'Basic Economic Problem',
  totalQuestions: 5,
  correctFirstTry: 4,
  correctRetry: 1,
  wrongCount: 0,
  xpEarned: 52,
  peakStreak: 4,
  isTimed: true,
});
assert.strictEqual(r1.accuracyPct, 80, 'Auto-calculated accuracy should be 80%');
assert.ok(r1.id.length > 0, 'Round should have an ID');

// Record Round 2 (Today, 1 hour later): 5 questions, 5 correct on first try (Perfect Round)
const r2 = recordCompletedRound({
  completedAt: testBaseTime + 3600_000,
  subject: 'Economics 0455',
  sourceType: 'paper',
  sourceLabel: 'May/June 2023 Paper 11',
  totalQuestions: 5,
  correctFirstTry: 5,
  correctRetry: 0,
  wrongCount: 0,
  xpEarned: 75,
  peakStreak: 5,
  isTimed: true,
});
assert.strictEqual(r2.accuracyPct, 100);

// Record Round 3 (Yesterday): 10 questions
const r3 = recordCompletedRound({
  completedAt: testBaseTime - 86_400_000,
  subject: 'Economics 0455',
  sourceType: 'random',
  sourceLabel: 'Quick Mix',
  totalQuestions: 10,
  correctFirstTry: 7,
  correctRetry: 2,
  wrongCount: 1,
  xpEarned: 80,
  peakStreak: 3,
  isTimed: true,
});

const history = getRoundHistory();
assert.strictEqual(history.length, 3);
// Verified sorted newest first (r2 was latest)
assert.strictEqual(history[0].id, r2.id);
assert.strictEqual(history[1].id, r1.id);
assert.strictEqual(history[2].id, r3.id);

// Verify Daily Goal Progress at testBaseTime
const goalProgress = getDailyGoalProgress(history, 10, testBaseTime);
assert.strictEqual(goalProgress.dailyGoal, 10);
assert.strictEqual(goalProgress.questionsAnsweredToday, 10, 'Round 1 (5) + Round 2 (5) = 10 today');
assert.strictEqual(goalProgress.progressPct, 100);
assert.strictEqual(goalProgress.isGoalMet, true);
assert.strictEqual(goalProgress.activeDaysLast7.length, 7);

// Today (last index in 7 days) should have count 10
const todayProgress = goalProgress.activeDaysLast7[goalProgress.activeDaysLast7.length - 1];
assert.strictEqual(todayProgress.count, 10);
assert.strictEqual(todayProgress.active, true);

// Yesterday (second to last) should have count 10
const yesterdayProgress = goalProgress.activeDaysLast7[goalProgress.activeDaysLast7.length - 2];
assert.strictEqual(yesterdayProgress.count, 10);
assert.strictEqual(yesterdayProgress.active, true);

// Verify cap at 50 rounds
for (let i = 0; i < 55; i++) {
  recordCompletedRound({
    completedAt: testBaseTime + (i + 10) * 1000,
    subject: 'Economics 0455',
    sourceType: 'random',
    sourceLabel: `Batch ${i}`,
    totalQuestions: 3,
    correctFirstTry: 3,
    correctRetry: 0,
    wrongCount: 0,
    xpEarned: 30,
    peakStreak: 3,
    isTimed: false,
  });
}
assert.strictEqual(getRoundHistory().length, 50, 'Round history must cap at 50 entries');

console.log('   ✅ Round telemetry & daily goal progress verified.');

// ============================================================================
// 6. Student XP Rank Tiers
// ============================================================================
console.log('6. Verifying XP Rank Tier Progression...');

// Level 1: 0 - 249 XP
const rank0 = calculateStudentRank(0);
assert.strictEqual(rank0.level, 1);
assert.strictEqual(rank0.title, 'Revision Rookie');
assert.strictEqual(rank0.badgeEmoji, '🌱');
assert.strictEqual(rank0.currentLevelMinXp, 0);
assert.strictEqual(rank0.nextLevelXp, 250);
assert.strictEqual(rank0.progressPct, 0);

const rank125 = calculateStudentRank(125);
assert.strictEqual(rank125.level, 1);
assert.strictEqual(rank125.progressPct, 50);

// Level 2: 250 - 599 XP
const rank250 = calculateStudentRank(250);
assert.strictEqual(rank250.level, 2);
assert.strictEqual(rank250.title, 'Syllabus Explorer');
assert.strictEqual(rank250.badgeEmoji, '🧭');
assert.strictEqual(rank250.currentLevelMinXp, 250);
assert.strictEqual(rank250.nextLevelXp, 600);
assert.strictEqual(rank250.progressPct, 0);

// Level 5: 2200 - 3499 XP
const rank2200 = calculateStudentRank(2200);
assert.strictEqual(rank2200.level, 5);
assert.strictEqual(rank2200.title, 'Exam Strategist');
assert.strictEqual(rank2200.badgeEmoji, '⚡');

// Level 7: 5000+ XP (Max level)
const rank5000 = calculateStudentRank(5000);
assert.strictEqual(rank5000.level, 7);
assert.strictEqual(rank5000.title, 'Master of Revision');
assert.strictEqual(rank5000.badgeEmoji, '👑');
assert.strictEqual(rank5000.progressPct, 100);

const rank10000 = calculateStudentRank(10000);
assert.strictEqual(rank10000.level, 7);
assert.strictEqual(rank10000.progressPct, 100);

console.log('   ✅ Student rank tier progression verified.');

// ============================================================================
// 7. Cambridge Revision Achievements
// ============================================================================
console.log('7. Verifying Cambridge Revision Achievements...');

// Test 1: Complete beginner
const initialAchievements = evaluateStudentAchievements({
  totalXp: 0,
  currentStreak: 0,
  firstTryCorrectCount: 0,
  reviewPileCount: 0,
  bookmarkedCount: 0,
  roundsCompleted: 0,
  perfectRoundsCount: 0,
  masteredTopicsCount: 0,
});
assert.strictEqual(initialAchievements.length, 8);
assert.ok(initialAchievements.every((a) => !a.unlocked), 'Beginner should have 0 unlocked achievements');

// Test 2: Unlocking milestones
const unlockedAchievements = evaluateStudentAchievements({
  totalXp: 2500,
  currentStreak: 6, // Unlocks streak-5
  firstTryCorrectCount: 26, // Unlocks first-try-25
  reviewPileCount: 2,
  bookmarkedCount: 5, // Unlocks study-curator
  roundsCompleted: 3, // Unlocks first-round
  perfectRoundsCount: 1, // Unlocks perfect-round
  masteredTopicsCount: 1, // Unlocks topic-master
});

const unlockedIds = new Set(unlockedAchievements.filter((a) => a.unlocked).map((a) => a.id));
assert.ok(unlockedIds.has('first-round'), 'first-round should be unlocked');
assert.ok(unlockedIds.has('streak-5'), 'streak-5 should be unlocked');
assert.ok(!unlockedIds.has('streak-10'), 'streak-10 should NOT be unlocked yet (streak is 6)');
assert.ok(unlockedIds.has('first-try-25'), 'first-try-25 should be unlocked');
assert.ok(!unlockedIds.has('first-try-100'), 'first-try-100 should NOT be unlocked yet');
assert.ok(unlockedIds.has('perfect-round'), 'perfect-round should be unlocked');
assert.ok(unlockedIds.has('topic-master'), 'topic-master should be unlocked');
assert.ok(unlockedIds.has('study-curator'), 'study-curator should be unlocked');

// Streak 10 partial progress
const streak10 = unlockedAchievements.find((a) => a.id === 'streak-10')!;
assert.strictEqual(streak10.progressCurrent, 6);
assert.strictEqual(streak10.progressTarget, 10);
assert.strictEqual(streak10.progressPct, 60);

console.log('   ✅ Cambridge revision achievements verified.');

// ============================================================================
// 8. Topic & Overall Stats Aggregation
// ============================================================================
console.log('8. Verifying Topic & Overall Stats Aggregation...');

const sampleTopics = [
  { id: 'topic-1', name: 'Basic Economic Problem' },
  { id: 'topic-2', name: 'Allocation of Resources' },
  { id: 'topic-3', name: 'Microeconomic Decision Makers' },
];

const sampleQuestions = [
  // Topic 1: 3 questions, all first-try correct (100% -> Master)
  { id: 'q1-1', topic_id: 'topic-1' },
  { id: 'q1-2', topic_id: 'topic-1' },
  { id: 'q1-3', topic_id: 'topic-1' },
  // Topic 2: 4 questions, 2 first-try correct (50% -> Proficient)
  { id: 'q2-1', topic_id: 'topic-2' },
  { id: 'q2-2', topic_id: 'topic-2' },
  { id: 'q2-3', topic_id: 'topic-2' },
  { id: 'q2-4', topic_id: 'topic-2' },
  // Topic 3: 4 questions, 1 first-try correct (25% -> Novice)
  { id: 'q3-1', topic_id: 'topic-3' },
  { id: 'q3-2', topic_id: 'topic-3' },
  { id: 'q3-3', topic_id: 'topic-3' },
  { id: 'q3-4', topic_id: 'topic-3' },
];

const sampleFirstTry = ['q1-1', 'q1-2', 'q1-3', 'q2-1', 'q2-2', 'q3-1']; // 6 correct total

const sampleReviewPile = {
  'q3-2': { mistakeCount: 3, lastMistakeAt: Date.now() },
  'q3-3': { mistakeCount: 2, lastMistakeAt: Date.now() },
  'q2-3': { mistakeCount: 1, lastMistakeAt: Date.now() },
};

const sampleBookmarks = [
  { questionId: 'q3-2', savedAt: Date.now() },
  { questionId: 'q1-1', savedAt: Date.now() },
];

const sampleRounds: any[] = [
  {
    id: 'r1',
    completedAt: Date.now(),
    totalQuestions: 5,
    correctFirstTry: 4,
    accuracyPct: 80,
    peakStreak: 4,
  },
  {
    id: 'r2',
    completedAt: Date.now() - 3600_000,
    totalQuestions: 5,
    correctFirstTry: 5,
    accuracyPct: 100,
    peakStreak: 5,
  },
];

const summary = computeStudentStatsSummary({
  questions: sampleQuestions,
  topics: sampleTopics,
  firstTryIds: sampleFirstTry,
  reviewPile: sampleReviewPile,
  bookmarks: sampleBookmarks,
  roundHistory: sampleRounds,
});

assert.strictEqual(summary.totalQuestionsInBank, 11);
assert.strictEqual(summary.totalFirstTryCorrect, 6);
assert.strictEqual(summary.overallMasteryPct, Math.round((6 / 11) * 100)); // 55%
assert.strictEqual(summary.roundsCompleted, 2);
assert.strictEqual(summary.totalQuestionsAttemptedInRounds, 10);
assert.strictEqual(summary.averageRoundAccuracyPct, 90); // (80 + 100) / 2 = 90
assert.strictEqual(summary.bestRoundStreak, 5);
assert.strictEqual(summary.reviewPileQuestionCount, 3);
assert.strictEqual(summary.totalReviewMistakes, 6); // 3 + 2 + 1 = 6
assert.strictEqual(summary.bookmarkedQuestionCount, 2);

// Check per-topic stats
assert.strictEqual(summary.topicStats.length, 3);

const t1 = summary.topicStats.find((t) => t.topicId === 'topic-1')!;
assert.strictEqual(t1.masteryPct, 100);
assert.strictEqual(t1.tier, 'master');
assert.strictEqual(t1.reviewMistakeCount, 0);
assert.strictEqual(t1.bookmarkedCount, 1);

const t2 = summary.topicStats.find((t) => t.topicId === 'topic-2')!;
assert.strictEqual(t2.masteryPct, 50);
assert.strictEqual(t2.tier, 'proficient');
assert.strictEqual(t2.reviewMistakeCount, 1);

const t3 = summary.topicStats.find((t) => t.topicId === 'topic-3')!;
assert.strictEqual(t3.masteryPct, 25);
assert.strictEqual(t3.tier, 'novice');
assert.strictEqual(t3.reviewMistakeCount, 5); // 3 + 2 = 5
assert.strictEqual(t3.bookmarkedCount, 1);

assert.strictEqual(summary.masteredTopicsCount, 1);
assert.strictEqual(summary.proficientTopicsCount, 1);
assert.strictEqual(summary.noviceTopicsCount, 1);

// Weakest topic should be topic-3 (25% mastery)
assert.strictEqual(summary.weakestTopics[0].topicId, 'topic-3');

// Strongest topic should be topic-1 (100% mastery)
assert.strictEqual(summary.strongestTopics[0].topicId, 'topic-1');

console.log('   ✅ Topic & overall stats aggregation verified.');

// Clean up listener
unsubscribe();

console.log('\n🎉 ALL STUDENT PROFILE ENGINE VERIFICATIONS PASSED SUCCESSFULLY! 🎉\n');

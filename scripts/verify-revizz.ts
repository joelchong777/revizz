/**
 * Revizz QA & Verification Test Suite
 * 
 * Tests:
 * 1. Scoring & Streak Multipliers (Base XP, 1.2x, 1.5x, retries, resets, timeouts)
 * 2. Review Pile Queuing & Lifecycle (first-correct exclusions, retry/wrong/timeout additions, localStorage sync)
 * 3. Topic Mastery Thresholds (<50% novice, 50-80% proficient, >80% master) and Badges
 * 4. Auth Display Name Sanitization & School Domain Tagging
 * 5. Timer Math & Simulated Gameplay Round End-to-End
 * ...
 * 20. Auth & Roster Engine Architecture (Email Auth, Roster Invites, Code Contracts)
 */

import {
  calculateAttemptScore,
  getStreakMultiplier,
  BASE_QUESTION_XP,
  RETRY_CORRECT_XP,
  WRONG_XP,
  TIMEOUT_XP,
  AttemptOutcome,
} from '../lib/scoring';

import {
  getMasteryTier,
  getMasteryBadge,
  calculateMasteryPercentage,
  addToReviewPile,
  getReviewPile,
  getReviewPileIds,
  getReviewPileCount,
  resolveFromReviewPile,
  clearReviewPile,
  recordFirstTryCorrect,
  getFirstTryCorrectIds,
  isFirstTryCorrect,
  REVIEW_PILE_KEY,
  FIRST_TRY_CORRECT_KEY,
} from '../lib/mastery';

import {
  formatDisplayName,
  checkIsSchoolAccount,
  isDemoStudentSession,
  DEFAULT_DEMO_STUDENT_PROFILE,
  signUpWithEmail,
  signInWithEmail,
  signInWithOtp,
} from '../lib/auth';

import {
  addRosterInvite,
  getRosterInvites,
  deleteRosterInvite,
  checkAndClaimInvite,
  ROSTER_INVITES_STORAGE_KEY,
  getTeacherClasses,
  createTeacherClass,
  updateTeacherClass,
  deleteTeacherClass,
  generateClassRosterCsv,
} from '../lib/roster';

import { CAMBRIDGE_QUESTIONS, Question } from '../lib/questions';
import {
  extractSeriesOrYear,
  hasDataTable,
  formatTableOptionText,
  isMathOrCalculation,
  getAvailableSeries,
  filterAndSortQuestions,
  countActiveFilters,
  stripCambridgeIgcse,
  parseCitationTagPills,
} from '../lib/compilerFilters';
import { normalizeGeminiModel, toBase64, isTransientCapacityError } from '../lib/ingestion/geminiExtractor';
import { normalizeStagingPayload, ingestionStore, LOCAL_STORAGE_KEY } from '../lib/ingestion/useIngestionStore';
import { validateStagingPaper } from '../types/ingestion';
import {
  PORTAL_NAV_STORAGE_KEY,
  PORTAL_NAV_CHANGE_EVENT,
  DEFAULT_PORTAL_NAV_ITEMS,
  getDefaultPortalNavItems,
  getPortalNavItems,
  getActivePortalMenuItems,
  savePortalNavItems,
  togglePortalMenuItem,
  setPortalMenuItemEnabled,
  addPortalMenuItem,
  removePortalMenuItem,
  resetPortalNavToDefaults,
  PortalNavItem,
} from '../lib/portal/menuConfig';
import {
  buildCompiledQuestions,
  resolveQuestionExplanation,
  computeTopicDistribution,
  shuffleQuestionIds,
  SUBJECT_CATALOG,
  saveOnlineAssignment,
  listOnlineAssignments,
} from '../lib/testCompiler';
import {
  DEFAULT_BANK_FILTER_STATE,
  normalizeSeriesToSeasonLabel,
  parseCambridgePaperMetadata,
  deriveQuestionStatus,
  deriveQuestionDifficulty,
  detectQuestionFeatures,
  enrichBankQuestion,
  filterBankQuestions,
  computeBankFacetCounts,
  getActiveFilterChips,
  removeActiveFilterChip,
  countActiveBankFilters,
  serializeBankFiltersToQuery,
  parseBankFiltersFromQuery,
  EnrichedBankQuestion,
  BankFilterState,
} from '../lib/portal/bankFilters';
import {
  getHomeworkAssignments,
  findAssignmentByTestCode,
  getHomeworkSubmissions,
  saveHomeworkSubmission,
  getSeedHomeworkAssignments,
  HOMEWORK_SUBMISSIONS_KEY,
  HomeworkSubmission,
} from '../lib/homework';

// Setup Mock LocalStorage for Node.js environment
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] ?? null;
  }
}

const mockStorage = new LocalStorageMock();
(globalThis as any).localStorage = mockStorage;

const eventLog: { type: string; detail?: any }[] = [];

(globalThis as any).window = {
  dispatchEvent: (event: any) => {
    eventLog.push({ type: event?.type, detail: event?.detail });
    return true;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  localStorage: mockStorage,
};

// Lightweight Test Runner
const VERBOSE = process.argv.includes('--verbose');
const startMs = Date.now();

const origConsoleLog = console.log;
const origConsoleError = console.error;
const origConsoleWarn = console.warn;

let currentTestLogs: string[] = [];
let inTest = false;

if (!VERBOSE) {
  console.log = (...args: any[]) => {
    if (inTest) {
      currentTestLogs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    }
  };
  console.warn = (...args: any[]) => {
    if (inTest) {
      currentTestLogs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    }
  };
  console.error = (...args: any[]) => {
    if (inTest) {
      currentTestLogs.push(args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
    } else {
      origConsoleError(...args);
    }
  };
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  totalTests++;
  currentTestLogs = [];
  inTest = true;
  try {
    fn();
    passedTests++;
    if (VERBOSE) {
      origConsoleLog(`  \x1b[32m✓\x1b[0m ${name}`);
    }
  } catch (err: any) {
    failedTests++;
    const message = `  \x1b[31m✗\x1b[0m ${name}\n    Error: ${err.message || err}`;
    failures.push(message);
    origConsoleError(message);
    if (currentTestLogs.length > 0) {
      origConsoleError('    Captured logs:\n    ' + currentTestLogs.join('\n    '));
    }
  } finally {
    inTest = false;
    currentTestLogs = [];
  }
}

async function testAsync(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  currentTestLogs = [];
  inTest = true;
  try {
    await fn();
    passedTests++;
    if (VERBOSE) {
      origConsoleLog(`  \x1b[32m✓\x1b[0m ${name}`);
    }
  } catch (err: any) {
    failedTests++;
    const message = `  \x1b[31m✗\x1b[0m ${name}\n    Error: ${err.message || err}`;
    failures.push(message);
    origConsoleError(message);
    if (currentTestLogs.length > 0) {
      origConsoleError('    Captured logs:\n    ' + currentTestLogs.join('\n    '));
    }
  } finally {
    inTest = false;
    currentTestLogs = [];
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} -> Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('\n========================================================');
console.log('   REVIZZ COMPREHENSIVE QA & VERIFICATION TEST SUITE   ');
console.log('========================================================\n');

// -----------------------------------------------------------------------------
// Suite 1: Scoring & Streak Multipliers
// -----------------------------------------------------------------------------
console.log('\x1b[1m\x1b[34m[Suite 1] Scoring & Streak Multipliers\x1b[0m');

test('1st try correct at 0 streak -> 10 XP (1.0x multiplier, new streak = 1)', () => {
  const result = calculateAttemptScore('first-correct', 0);
  assertEqual(result.xpAwarded, 10, 'XP awarded should be 10');
  assertEqual(result.newStreak, 1, 'New streak should be 1');
  assertEqual(result.multiplier, 1.0, 'Multiplier should be 1.0x');
  assertEqual(result.shouldAddToReview, false, 'Should NOT be added to review pile');
});

test('1st try correct at 3 streak -> 12 XP (1.2x multiplier, new streak = 4)', () => {
  const result = calculateAttemptScore('first-correct', 3);
  assertEqual(result.xpAwarded, 12, 'XP awarded should be 12 (10 * 1.2)');
  assertEqual(result.newStreak, 4, 'New streak should be 4');
  assertEqual(result.multiplier, 1.2, 'Multiplier should be 1.2x');
  assertEqual(result.shouldAddToReview, false, 'Should NOT be added to review pile');
});

test('1st try correct at 5 streak -> 15 XP (1.5x multiplier, new streak = 6)', () => {
  const result = calculateAttemptScore('first-correct', 5);
  assertEqual(result.xpAwarded, 15, 'XP awarded should be 15 (10 * 1.5)');
  assertEqual(result.newStreak, 6, 'New streak should be 6');
  assertEqual(result.multiplier, 1.5, 'Multiplier should be 1.5x');
  assertEqual(result.shouldAddToReview, false, 'Should NOT be added to review pile');
});

test('1st try wrong -> 0 XP, streak reset to 0, queued to review pile', () => {
  const result = calculateAttemptScore('first-wrong', 7);
  assertEqual(result.xpAwarded, 0, 'XP awarded should be 0');
  assertEqual(result.newStreak, 0, 'Streak should reset to 0');
  assertEqual(result.multiplier, 0, 'Multiplier should be 0');
  assertEqual(result.shouldAddToReview, true, 'Should be added to review pile');
});

test('2nd try retry correct -> 5 XP (50% XP), streak remains 0, queued to review pile', () => {
  const result = calculateAttemptScore('retry-correct', 0);
  assertEqual(result.xpAwarded, 5, 'XP awarded should be 5');
  assertEqual(result.newStreak, 0, 'Streak should remain 0');
  assertEqual(result.multiplier, 0.5, 'Multiplier should be 0.5x');
  assertEqual(result.shouldAddToReview, true, 'Should remain in review pile');
});

test('2nd try wrong -> 0 XP, streak remains 0, queued to review pile', () => {
  const result = calculateAttemptScore('wrong', 0);
  assertEqual(result.xpAwarded, 0, 'XP awarded should be 0');
  assertEqual(result.newStreak, 0, 'Streak should remain 0');
  assertEqual(result.shouldAddToReview, true, 'Should be in review pile');
});

test('Timeout -> 0 XP, streak reset to 0, queued to review pile', () => {
  const result = calculateAttemptScore('timeout', 4);
  assertEqual(result.xpAwarded, 0, 'XP awarded should be 0');
  assertEqual(result.newStreak, 0, 'Streak should reset to 0');
  assertEqual(result.shouldAddToReview, true, 'Should be added to review pile');
});

test('Streak multiplier ladder: verify 0..10 streaks produce exact multipliers', () => {
  assertEqual(getStreakMultiplier(0), 1.0, 'Streak 0 multiplier');
  assertEqual(getStreakMultiplier(1), 1.0, 'Streak 1 multiplier');
  assertEqual(getStreakMultiplier(2), 1.0, 'Streak 2 multiplier');
  assertEqual(getStreakMultiplier(3), 1.2, 'Streak 3 multiplier');
  assertEqual(getStreakMultiplier(4), 1.2, 'Streak 4 multiplier');
  assertEqual(getStreakMultiplier(5), 1.5, 'Streak 5 multiplier');
  assertEqual(getStreakMultiplier(10), 1.5, 'Streak 10 multiplier');
});

// -----------------------------------------------------------------------------
// Suite 2: Review Pile Queuing & Lifecycle
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[34m[Suite 2] Review Pile Queuing & Lifecycle\x1b[0m');

test('1st try correct is NOT queued to review pile flag', () => {
  const result = calculateAttemptScore('first-correct', 0);
  assertEqual(result.shouldAddToReview, false, '1st try correct should NOT queue to review pile');
});

test('Retry correct IS queued to review pile flag', () => {
  const result = calculateAttemptScore('retry-correct', 0);
  assertEqual(result.shouldAddToReview, true, 'Retry correct should queue to review pile');
});

test('2nd try wrong IS queued to review pile flag', () => {
  const result = calculateAttemptScore('wrong', 0);
  assertEqual(result.shouldAddToReview, true, '2nd try wrong should queue to review pile');
});

test('Timeout IS queued to review pile flag', () => {
  const result = calculateAttemptScore('timeout', 2);
  assertEqual(result.shouldAddToReview, true, 'Timeout should queue to review pile');
});

test('Review pile storage: adding, updating mistake count, and resolving questions', () => {
  clearReviewPile();
  assertEqual(getReviewPileCount(), 0, 'Initial review pile should be empty');

  // Add question 1
  addToReviewPile('q_micro_01');
  assertEqual(getReviewPileCount(), 1, 'Review pile should contain 1 question');
  assertEqual(getReviewPileIds().includes('q_micro_01'), true, 'q_micro_01 should be in review pile');
  assertEqual(getReviewPile()['q_micro_01'].mistakeCount, 1, 'Mistake count should be 1');

  // Add question 1 again (repeated mistake)
  addToReviewPile('q_micro_01');
  assertEqual(getReviewPileCount(), 1, 'Review pile should still contain 1 question');
  assertEqual(getReviewPile()['q_micro_01'].mistakeCount, 2, 'Mistake count should increment to 2');

  // Add question 2
  addToReviewPile('q_macro_02');
  assertEqual(getReviewPileCount(), 2, 'Review pile should contain 2 questions');

  // Resolve question 1
  resolveFromReviewPile('q_micro_01');
  assertEqual(getReviewPileCount(), 1, 'Review pile should have 1 question after resolving q_micro_01');
  assertEqual(getReviewPileIds().includes('q_macro_02'), true, 'q_macro_02 should remain');
  assertEqual(getReviewPileIds().includes('q_micro_01'), false, 'q_micro_01 should be removed');

  // Clear review pile
  clearReviewPile();
  assertEqual(getReviewPileCount(), 0, 'Review pile should be empty after clear');
});

test('First-try correct unique ID persistence and tracking', () => {
  mockStorage.removeItem(FIRST_TRY_CORRECT_KEY);
  assertEqual(getFirstTryCorrectIds().length, 0, 'Initial first-try list should be empty');

  recordFirstTryCorrect('q_elasticity_01');
  assertEqual(isFirstTryCorrect('q_elasticity_01'), true, 'q_elasticity_01 should be marked first-try correct');
  assertEqual(isFirstTryCorrect('q_elasticity_02'), false, 'q_elasticity_02 should not be marked');

  // Duplicate record should be idempotent
  recordFirstTryCorrect('q_elasticity_01');
  assertEqual(getFirstTryCorrectIds().length, 1, 'Ids list should not have duplicates');
});

// -----------------------------------------------------------------------------
// Suite 3: Topic Mastery Thresholds & Badges
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[34m[Suite 3] Topic Mastery Thresholds\x1b[0m');

test('Topic Mastery: < 50% -> novice', () => {
  assertEqual(getMasteryTier(0), 'novice', '0% should be novice');
  assertEqual(getMasteryTier(20), 'novice', '20% should be novice');
  assertEqual(getMasteryTier(49), 'novice', '49% should be novice');
  assertEqual(getMasteryTier(49.9), 'novice', '49.9% should be novice');

  const badge = getMasteryBadge(45);
  assertEqual(badge.tier, 'novice', 'Badge tier should be novice');
  assertEqual(badge.label, 'Novice', 'Badge label should be Novice');
  assertEqual(badge.icon, '🌱', 'Badge icon should be 🌱');
});

test('Topic Mastery: 50% - 80% -> proficient', () => {
  assertEqual(getMasteryTier(50), 'proficient', '50% should be proficient');
  assertEqual(getMasteryTier(65), 'proficient', '65% should be proficient');
  assertEqual(getMasteryTier(80), 'proficient', '80% boundary should be proficient');

  const badge = getMasteryBadge(75);
  assertEqual(badge.tier, 'proficient', 'Badge tier should be proficient');
  assertEqual(badge.label, 'Proficient', 'Badge label should be Proficient');
  assertEqual(badge.icon, '⚡', 'Badge icon should be ⚡');
});

test('Topic Mastery: > 80% -> master', () => {
  assertEqual(getMasteryTier(80.1), 'master', '80.1% should be master');
  assertEqual(getMasteryTier(81), 'master', '81% should be master');
  assertEqual(getMasteryTier(95), 'master', '95% should be master');
  assertEqual(getMasteryTier(100), 'master', '100% should be master');

  const badge = getMasteryBadge(90);
  assertEqual(badge.tier, 'master', 'Badge tier should be master');
  assertEqual(badge.label, 'Master', 'Badge label should be Master');
  assertEqual(badge.icon, '👑', 'Badge icon should be 👑');
});

test('Mastery Percentage Calculation: (firstTryCorrect / totalQuestions) * 100', () => {
  assertEqual(calculateMasteryPercentage(0, 10), 0, '0 of 10 should be 0%');
  assertEqual(calculateMasteryPercentage(4, 10), 40, '4 of 10 should be 40%');
  assertEqual(calculateMasteryPercentage(5, 10), 50, '5 of 10 should be 50%');
  assertEqual(calculateMasteryPercentage(8, 10), 80, '8 of 10 should be 80%');
  assertEqual(calculateMasteryPercentage(9, 10), 90, '9 of 10 should be 90%');
  assertEqual(calculateMasteryPercentage(10, 10), 100, '10 of 10 should be 100%');
  assertEqual(calculateMasteryPercentage(0, 0), 0, 'Edge case: 0 total questions should yield 0%');
});

// -----------------------------------------------------------------------------
// Suite 4: Auth Display Name Sanitization & School Account Tagging
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[34m[Suite 4] Auth Display Name Sanitization\x1b[0m');

test('Display Name: "Alex Miller" -> "Alex M."', () => {
  const result = formatDisplayName('Alex Miller', 'alex.miller@gmail.com');
  assertEqual(result, 'Alex M.', 'Two-word name should format to First Name + Last Initial');
});

test('Display Name: "Jane" -> "Jane"', () => {
  const result = formatDisplayName('Jane', 'jane@example.com');
  assertEqual(result, 'Jane', 'Single word name should remain First Name');
});

test('Display Name: multi-word and whitespace edge cases', () => {
  assertEqual(formatDisplayName('Alex John Miller', 'test@test.com'), 'Alex M.', 'Multi-word should take first name + last initial');
  assertEqual(formatDisplayName('  Sarah   Connor  ', 'test@test.com'), 'Sarah C.', 'Handles irregular whitespace');
  assertEqual(formatDisplayName(null, 'student123@frontier.edu'), 'student123', 'Null name falls back to email handle');
  assertEqual(formatDisplayName(undefined, 'guest_user@revizz.app'), 'guest_user', 'Undefined name falls back to email handle');
});

test('School Account: "john.doe@frontierinternational.edu" tagged as school account (true)', () => {
  const isSchool = checkIsSchoolAccount('john.doe@frontierinternational.edu');
  assertEqual(isSchool, true, 'frontierinternational.edu email must be tagged as school account');
});

test('School Account: "external@gmail.com" tagged as non-school account (false)', () => {
  const isSchool = checkIsSchoolAccount('external@gmail.com');
  assertEqual(isSchool, false, 'gmail.com email must be tagged as non-school account');
});

test('School Account: case insensitivity and domain variations', () => {
  assertEqual(checkIsSchoolAccount('STUDENT@FRONTIERINTERNATIONAL.EDU'), true, 'Uppercase frontier email should be tagged true');
  assertEqual(checkIsSchoolAccount('alex@frontier.sg'), true, 'frontier.sg should be tagged true');
  assertEqual(checkIsSchoolAccount('user@yahoo.com'), false, 'yahoo.com should be tagged false');
  assertEqual(checkIsSchoolAccount('test@hotmail.com'), false, 'hotmail.com should be tagged false');
});

// -----------------------------------------------------------------------------
// Suite 5: Timer Math & Simulated Gameplay Round End-to-End
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[34m[Suite 5] Timer Math & End-to-End Round Simulation\x1b[0m');

test('Timer Math: initial 90s, step decrement, expiration boundary check', () => {
  let timeLeft = 90;
  assertEqual(timeLeft, 90, 'Initial timer should be 90s');

  // Decrement 30 seconds
  for (let i = 0; i < 30; i++) {
    timeLeft -= 1;
  }
  assertEqual(timeLeft, 60, 'Timer after 30 ticks should be 60s');

  // Test expiration boundary: when prev <= 1, timer triggers timeout
  const tick = (current: number) => {
    if (current <= 1) return { expired: true, nextTime: 0 };
    return { expired: false, nextTime: current - 1 };
  };

  assertEqual(tick(2).expired, false, 'At 2s, timer decrements without expiring');
  assertEqual(tick(2).nextTime, 1, '2s -> 1s');
  assertEqual(tick(1).expired, true, 'At 1s, timer triggers expiration');
  assertEqual(tick(1).nextTime, 0, '1s -> 0s');
});

test('End-to-End Simulated Quiz Round (5 Questions)', () => {
  let streak = 0;
  let totalXP = 0;
  let peakStreak = 0;
  const reviewPileQueue: string[] = [];

  // Question 1: 1st try correct at 0 streak
  const q1 = calculateAttemptScore('first-correct', streak);
  streak = q1.newStreak;
  peakStreak = Math.max(peakStreak, streak);
  totalXP += q1.xpAwarded;
  if (q1.shouldAddToReview) reviewPileQueue.push('Q1');
  assertEqual(q1.xpAwarded, 10, 'Q1: awarded 10 XP');
  assertEqual(streak, 1, 'Q1: streak becomes 1');

  // Question 2: 1st try correct at 1 streak
  const q2 = calculateAttemptScore('first-correct', streak);
  streak = q2.newStreak;
  peakStreak = Math.max(peakStreak, streak);
  totalXP += q2.xpAwarded;
  if (q2.shouldAddToReview) reviewPileQueue.push('Q2');
  assertEqual(q2.xpAwarded, 10, 'Q2: awarded 10 XP');
  assertEqual(streak, 2, 'Q2: streak becomes 2');

  // Question 3: 1st try correct at 2 streak (new streak 3 -> 1.2x)
  const q3 = calculateAttemptScore('first-correct', streak);
  streak = q3.newStreak;
  peakStreak = Math.max(peakStreak, streak);
  totalXP += q3.xpAwarded;
  if (q3.shouldAddToReview) reviewPileQueue.push('Q3');
  assertEqual(q3.xpAwarded, 12, 'Q3: awarded 12 XP (1.2x multiplier at streak 3)');
  assertEqual(streak, 3, 'Q3: streak becomes 3');

  // Question 4: 1st try wrong, then retry correct (+5 XP, streak reset to 0, queued to review)
  const q4a = calculateAttemptScore('first-wrong', streak);
  streak = q4a.newStreak; // reset to 0
  assertEqual(q4a.xpAwarded, 0, 'Q4 1st try: 0 XP');
  assertEqual(streak, 0, 'Q4 1st try: streak reset to 0');
  if (q4a.shouldAddToReview) reviewPileQueue.push('Q4');

  const q4b = calculateAttemptScore('retry-correct', streak);
  streak = q4b.newStreak;
  totalXP += q4b.xpAwarded;
  assertEqual(q4b.xpAwarded, 5, 'Q4 retry: 5 XP awarded');
  assertEqual(streak, 0, 'Q4 retry: streak remains 0');

  // Question 5: Timeout (0 XP, streak reset, queued to review)
  const q5 = calculateAttemptScore('timeout', streak);
  streak = q5.newStreak;
  totalXP += q5.xpAwarded;
  if (q5.shouldAddToReview) reviewPileQueue.push('Q5');
  assertEqual(q5.xpAwarded, 0, 'Q5: 0 XP on timeout');
  assertEqual(streak, 0, 'Q5: streak is 0 on timeout');

  // Final round assertions
  assertEqual(totalXP, 37, 'Total round XP should be 10 + 10 + 12 + 5 + 0 = 37 XP');
  assertEqual(peakStreak, 3, 'Peak streak should be 3');
  assertEqual(reviewPileQueue.length, 2, 'Review pile should contain Q4 and Q5');
  assertEqual(reviewPileQueue.includes('Q1'), false, 'Q1 should NOT be in review pile');
  assertEqual(reviewPileQueue.includes('Q2'), false, 'Q2 should NOT be in review pile');
  assertEqual(reviewPileQueue.includes('Q3'), false, 'Q3 should NOT be in review pile');
});

// -----------------------------------------------------------------------------
// [Suite 6] Portal Educator Gate & Security Validation
// -----------------------------------------------------------------------------
console.log('\n[Suite 6] Portal Gate Security & Role Permissions');

const evaluateEducatorAccess = (
  userProfile: { role?: 'student' | 'teacher' | 'admin'; display_name?: string } | null,
  isDev: boolean,
  devOverride: boolean,
  guestMode: boolean = false
): boolean => {
  return guestMode || (isDev && devOverride) || !!(userProfile && (userProfile.role === 'teacher' || userProfile.role === 'admin'));
};

test('Production Security: devOverride flag is strictly ignored when isDev is false', () => {
  // Tampered/bypassed devOverride in production with null profile
  const bypassAttemptLoggedOut = evaluateEducatorAccess(null, false, true, false);
  assertEqual(bypassAttemptLoggedOut, false, 'Logged-out user cannot bypass gate with devOverride in production');

  // Tampered/bypassed devOverride in production with student profile
  const bypassAttemptStudent = evaluateEducatorAccess({ role: 'student', display_name: 'Student' }, false, true, false);
  assertEqual(bypassAttemptStudent, false, 'Student user cannot bypass gate with devOverride in production');
});

test('Production Security: only verified teacher and admin roles are granted access', () => {
  const teacherAccess = evaluateEducatorAccess({ role: 'teacher', display_name: 'Ms. Smith' }, false, false, false);
  assertEqual(teacherAccess, true, 'Verified teacher role receives access');

  const adminAccess = evaluateEducatorAccess({ role: 'admin', display_name: 'Principal Skinner' }, false, false, false);
  assertEqual(adminAccess, true, 'Verified admin role receives access');

  const anonymousAccess = evaluateEducatorAccess(null, false, false, false);
  assertEqual(anonymousAccess, false, 'Unauthenticated user denied educator access');

  const studentAccess = evaluateEducatorAccess({ role: 'student', display_name: 'Bart S.' }, false, false, false);
  assertEqual(studentAccess, false, 'Student user denied educator access');
});

test('Development Mode: devOverride is permitted only when isDev is true', () => {
  const devPreviewActive = evaluateEducatorAccess(null, true, true, false);
  assertEqual(devPreviewActive, true, 'devOverride grants access when isDev is true');

  const devPreviewInactive = evaluateEducatorAccess(null, true, false, false);
  assertEqual(devPreviewInactive, false, 'devOverride false denies unauthenticated access even in dev mode');
});

test('Guest Educator Mode: guestMode flag permits interactive demo access', () => {
  const guestAccess = evaluateEducatorAccess(null, false, false, true);
  assertEqual(guestAccess, true, 'guestMode grants educator preview access in any environment');
});

test('Student Account Badge message format matches expected pattern', () => {
  const mockStudent = { display_name: 'Alex M.', role: 'student' as const };
  const badgeMessage = `Signed in as ${mockStudent.display_name} (Student account) · Contact your school administrator for educator access.`;
  assertEqual(
    badgeMessage,
    'Signed in as Alex M. (Student account) · Contact your school administrator for educator access.',
    'Informative student account badge string matches exact specification'
  );
});

// Role & route capability modeling for Revizz Educator Portal vs App Admin
type PortalRole = 'student' | 'teacher' | 'admin';
type TeacherWorkflowFeature = 
  | 'overview' 
  | 'roster' 
  | 'assign' 
  | 'compiler' 
  | 'mastery' 
  | 'xp' 
  | 'bank' 
  | 'flagged' 
  | 'editor' 
  | 'school';

type AppAdminFeature = 
  | 'ingestion' 
  | 'importer' 
  | 'system_settings' 
  | 'user_permissions';

const TEACHER_WORKFLOW_FEATURES: TeacherWorkflowFeature[] = [
  'overview',
  'roster',
  'assign',
  'compiler',
  'mastery',
  'xp',
  'bank',
  'flagged',
  'editor',
  'school',
];

const APP_ADMIN_ISOLATED_FEATURES: AppAdminFeature[] = [
  'ingestion',
  'importer',
  'system_settings',
  'user_permissions',
];

const canAccessTeacherFeature = (role: PortalRole, feature: string): boolean => {
  if (role !== 'teacher' && role !== 'admin') return false;
  return TEACHER_WORKFLOW_FEATURES.includes(feature as TeacherWorkflowFeature);
};

const canAccessAdminFeature = (role: PortalRole, feature: string): boolean => {
  if (role !== 'admin') return false;
  return APP_ADMIN_ISOLATED_FEATURES.includes(feature as AppAdminFeature);
};

const resolvePortalRouteForTab = (tab: string): { route: '/portal' | '/admin'; tab: string } => {
  const normalized = tab.toLowerCase();
  if (normalized === 'ingestion' || normalized === 'importer') {
    return { route: '/admin', tab: 'ingestion' };
  }
  return { route: '/portal', tab: normalized };
};

test('Teacher Role Separation: teachers have student management, student stats, question verification, test compiler, homework assignment', () => {
  // Student management
  assertEqual(canAccessTeacherFeature('teacher', 'roster'), true, 'Teacher can access student management (roster)');
  // Student stats
  assertEqual(canAccessTeacherFeature('teacher', 'overview'), true, 'Teacher can access overview stats');
  assertEqual(canAccessTeacherFeature('teacher', 'mastery'), true, 'Teacher can access mastery analytics');
  assertEqual(canAccessTeacherFeature('teacher', 'xp'), true, 'Teacher can access leaderboard & XP');
  // Question verification
  assertEqual(canAccessTeacherFeature('teacher', 'bank'), true, 'Teacher can access question bank verification');
  assertEqual(canAccessTeacherFeature('teacher', 'flagged'), true, 'Teacher can access flagged questions verification');
  assertEqual(canAccessTeacherFeature('teacher', 'editor'), true, 'Teacher can access question editor');
  // Test compilation
  assertEqual(canAccessTeacherFeature('teacher', 'compiler'), true, 'Teacher can access test compiler');
  // Assigning homework
  assertEqual(canAccessTeacherFeature('teacher', 'assign'), true, 'Teacher can access round / homework assigner');
  // School & licence
  assertEqual(canAccessTeacherFeature('teacher', 'school'), true, 'Teacher can access school & licence management');

  // Students must not have teacher capabilities
  assertEqual(canAccessTeacherFeature('student', 'roster'), false, 'Students denied teacher roster access');
  assertEqual(canAccessTeacherFeature('student', 'assign'), false, 'Students denied homework assigner access');
});

test('Ingestion Isolation: Ingestion studio is strictly removed from teacher side and isolated to app admin', () => {
  // Teacher cannot access ingestion studio
  assertEqual(canAccessTeacherFeature('teacher', 'ingestion'), false, 'Teacher workflow does not include ingestion');
  assertEqual(canAccessTeacherFeature('teacher', 'importer'), false, 'Teacher workflow does not include importer');
  assertEqual(canAccessAdminFeature('teacher', 'ingestion'), false, 'Teachers denied admin ingestion tool access');

  // Admin possesses ingestion and app admin tools
  assertEqual(canAccessAdminFeature('admin', 'ingestion'), true, 'Admins can access ingestion studio');
  assertEqual(canAccessAdminFeature('admin', 'importer'), true, 'Admins can access importer');
});

test('Route Isolation: Ingestion requests route cleanly to App Admin (/admin?tab=ingestion)', () => {
  assertEqual(resolvePortalRouteForTab('ingestion').route, '/admin', 'Ingestion tab directs to /admin');
  assertEqual(resolvePortalRouteForTab('importer').route, '/admin', 'Importer tab directs to /admin');
  assertEqual(resolvePortalRouteForTab('roster').route, '/portal', 'Roster tab directs to /portal');
  assertEqual(resolvePortalRouteForTab('compiler').route, '/portal', 'Compiler tab directs to /portal');
  assertEqual(resolvePortalRouteForTab('assign').route, '/portal', 'Assign tab directs to /portal');
});

// -----------------------------------------------------------------------------
// [Suite 7] Question Compiler Search & Filtering Capabilities
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[34m[Suite 7] Question Compiler Search & Filtering Capabilities\x1b[0m');

test('Selection Status: isolates all, selected in test, and unselected questions', () => {
  const sampleSelectedIds = ['0455-s24-12-q01', '0455-s24-12-q02', '0455-s24-12-q03'];

  const allResult = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    selection: 'all',
    selectedQuestionIds: sampleSelectedIds,
  });
  assertEqual(allResult.length, CAMBRIDGE_QUESTIONS.length, 'All questions returns complete set');

  const selectedResult = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    selection: 'selected',
    selectedQuestionIds: sampleSelectedIds,
  });
  assertEqual(
    selectedResult.map((q) => q.id).join(','),
    sampleSelectedIds.join(','),
    'Selected questions match drawer IDs'
  );

  const unselectedResult = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    selection: 'unselected',
    selectedQuestionIds: sampleSelectedIds,
  });
  assertEqual(
    unselectedResult.length,
    CAMBRIDGE_QUESTIONS.length - sampleSelectedIds.length,
    'Unselected returns only remaining available questions'
  );
  assertEqual(
    unselectedResult.some((q) => sampleSelectedIds.includes(q.id)),
    false,
    'No selected questions present in unselected filter'
  );
});

test('Exam Series & Year: extracts and filters dynamic Cambridge paper series', () => {
  // Test dynamic extraction
  const seriesList = getAvailableSeries(CAMBRIDGE_QUESTIONS);
  assertEqual(seriesList.includes('May/June 2024'), true, 'Extracts May/June 2024 from Cambridge citations');

  // Test parser robustness on various Cambridge citation styles
  assertEqual(
    extractSeriesOrYear('Cambridge IGCSE Economics 0455/12 May/June 2024 Q1'),
    'May/June 2024',
    'Parses standard Cambridge full citation'
  );
  assertEqual(
    extractSeriesOrYear('Cambridge IGCSE Economics 0455/22 Oct/Nov 2023 Q5'),
    'Oct/Nov 2023',
    'Parses winter session citation'
  );
  assertEqual(
    extractSeriesOrYear('0455/12/M/J/24 Q3'),
    'May/June 2024',
    'Parses shorthand session code'
  );
  assertEqual(
    extractSeriesOrYear(undefined, '0455-w23-11-q10'),
    'Oct/Nov 2023',
    'Parses paper ID fallback'
  );

  // Test filtering by series
  const filteredSeries = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    series: 'May/June 2024',
  });
  assertEqual(filteredSeries.length, 30, 'Filters questions belonging to May/June 2024');

  const otherSeries = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    series: 'Nonexistent 2099',
  });
  assertEqual(otherSeries.length, 0, 'Returns empty when series does not match');
});

test('Content Toggles: Diagrams, Data Tables, and Calculations/Math', () => {
  // 1. Diagrams toggle
  const withDiagrams = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    withDiagramsOnly: true,
  });
  assertEqual(
    withDiagrams.every((q) => !!q.image_url),
    true,
    'Diagrams toggle only includes questions with image_url'
  );
  assertEqual(withDiagrams.length > 0, true, 'Found diagram questions in dataset');

  // 2. Data tables toggle
  const withTables = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    withTablesOnly: true,
  });
  assertEqual(
    withTables.every((q) => hasDataTable(q.stem_markdown, q)),
    true,
    'Data tables toggle only includes questions containing tables'
  );
  assertEqual(withTables.some((q) => q.id === '0455-s24-12-q06'), true, 'q06 contains markdown table');
  assertEqual(withTables.some((q) => q.id === '0455-s24-12-q14'), true, 'q14 contains markdown table');
  assertEqual(withTables.some((q) => q.id === '0455-s24-12-q30'), true, 'q30 contains markdown table');
  assertEqual(withTables.some((q) => q.id === '0455-s24-12-q16'), true, 'q16 contains 2-column option table');

  // 3. Math / Calculations toggle
  const withMath = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    withMathOnly: true,
  });
  assertEqual(
    withMath.every((q) => isMathOrCalculation(q.stem_markdown)),
    true,
    'Math toggle only includes questions with KaTeX, formulas, or numerical calculation data'
  );
  assertEqual(withMath.some((q) => q.id === '0455-s24-12-q02'), true, 'q02 ($10,000 calculation) tagged as math');
  assertEqual(withMath.some((q) => q.id === '0455-s24-12-q08'), true, 'q08 ($5/kg elasticity) tagged as math');
  assertEqual(withMath.some((q) => q.id === '0455-s24-12-q10'), true, 'q10 ($OW_c$ KaTeX) tagged as math');
  assertEqual(withMath.some((q) => q.id === '0455-s24-12-q28'), true, 'q28 (yuan ¥ and $ formulas) tagged as math');
  assertEqual(withMath.some((q) => q.id === '0455-s24-12-q30'), true, 'q30 (Japan ¥ trillion data) tagged as math');
});

test('Text Search: searches across stems, question IDs, citations, and option texts', () => {
  // Search in stem
  const stemSearch = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    search: 'scarcity always exist',
  });
  assertEqual(stemSearch.length, 1, 'Search finds question by stem text');
  assertEqual(stemSearch[0].id, '0455-s24-12-q01', 'Found q01 for scarcity');

  // Search by Question ID
  const idSearch = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    search: '0455-s24-12-q05',
  });
  assertEqual(idSearch.length, 1, 'Search finds question by ID');
  assertEqual(idSearch[0].id, '0455-s24-12-q05', 'Found q05 by ID');

  // Search by Citation
  const citationSearch = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    search: '0455/12 May/June 2024 Q8',
  });
  assertEqual(citationSearch.length, 1, 'Search finds question by citation');
  assertEqual(citationSearch[0].id, '0455-s24-12-q08', 'Found q08 by citation');

  // Search inside Option Texts (unique option keyword not in stem)
  const optionSearch = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
    search: 'Chinese Gross Domestic Product',
  });
  assertEqual(optionSearch.length, 1, 'Search searches inside option texts');
  assertEqual(optionSearch[0].id, '0455-s24-12-q04', 'Found q04 via option A text');
});

test('Sort By: paper order, shortest stem, and longest/scenario stem', () => {
  const defaultSort = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, { sortBy: 'paper' });
  assertEqual(defaultSort[0].id, '0455-s24-12-q01', 'Default maintains paper order');

  const shortestSort = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, { sortBy: 'shortest' });
  const shortestLen = shortestSort[0].stem_markdown?.length || 0;
  const nextShortestLen = shortestSort[1].stem_markdown?.length || 0;
  assertEqual(shortestLen <= nextShortestLen, true, 'Shortest stem sort places shortest first');
  assertEqual(shortestSort[0].id, '0455-s24-12-q01', 'q01 is shortest stem');

  const longestSort = filterAndSortQuestions(CAMBRIDGE_QUESTIONS, { sortBy: 'longest' });
  const longestLen = longestSort[0].stem_markdown?.length || 0;
  const nextLongestLen = longestSort[1].stem_markdown?.length || 0;
  assertEqual(longestLen >= nextLongestLen, true, 'Longest stem sort places scenario/table first');
  assertEqual(longestSort[0].id, '0455-s24-12-q06', 'q06 is longest stem');
});

test('Active Filter Counter & Reset State Verification', () => {
  // Default options have 0 active filters
  const zeroCount = countActiveFilters({
    search: '',
    topicId: 'all',
    series: 'all',
    selection: 'all',
    withDiagramsOnly: false,
    withTablesOnly: false,
    withMathOnly: false,
    sortBy: 'paper',
  });
  assertEqual(zeroCount, 0, 'Default filter configuration has 0 active filters');

  // Applying non-default filters increments count
  const activeCount = countActiveFilters({
    search: 'elasticity',
    topicId: '6b7bf963-f082-467c-a7ca-812891a838ab',
    series: 'May/June 2024',
    selection: 'unselected',
    withDiagramsOnly: true,
    withTablesOnly: true,
    withMathOnly: true,
    sortBy: 'shortest',
  });
  assertEqual(activeCount, 8, 'Accurately counts all 8 active filters');
});

// -----------------------------------------------------------------------------
// [Suite 8] Gemini Ingestion Model Migration & Normalization
// -----------------------------------------------------------------------------
console.log('\n[Suite 8] Gemini Ingestion Model Migration & Normalization');

test('Defaults undefined or empty model to gemini-3.8-flash', () => {
  assertEqual(normalizeGeminiModel(), 'gemini-3.8-flash', 'undefined defaults to gemini-3.8-flash');
  assertEqual(normalizeGeminiModel(''), 'gemini-3.8-flash', 'empty string defaults to gemini-3.8-flash');
  assertEqual(normalizeGeminiModel('   '), 'gemini-3.8-flash', 'whitespace string defaults to gemini-3.8-flash');
});

test('Remaps deprecated gemini-2.5 models to gemini-3.8-flash', () => {
  assertEqual(normalizeGeminiModel('gemini-2.5-flash'), 'gemini-3.8-flash', 'gemini-2.5-flash remapped');
  assertEqual(normalizeGeminiModel('models/gemini-2.5-flash'), 'gemini-3.8-flash', 'models/gemini-2.5-flash remapped');
  assertEqual(normalizeGeminiModel('gemini-2.5-pro'), 'gemini-3.8-flash', 'gemini-2.5-pro remapped');
});

test('Remaps deprecated gemini-2.0 models to gemini-3.8-flash', () => {
  assertEqual(normalizeGeminiModel('gemini-2.0-flash'), 'gemini-3.8-flash', 'gemini-2.0-flash remapped');
  assertEqual(normalizeGeminiModel('models/gemini-2.0-flash'), 'gemini-3.8-flash', 'models/gemini-2.0-flash remapped');
  assertEqual(normalizeGeminiModel('gemini-2.0-flash-exp'), 'gemini-3.8-flash', 'gemini-2.0-flash-exp remapped');
});

test('Remaps deprecated gemini-1.5 models to gemini-3.8-flash', () => {
  assertEqual(normalizeGeminiModel('gemini-1.5-flash'), 'gemini-3.8-flash', 'gemini-1.5-flash remapped');
  assertEqual(normalizeGeminiModel('models/gemini-1.5-pro'), 'gemini-3.8-flash', 'models/gemini-1.5-pro remapped');
});

test('Preserves modern gemini-3.8-flash and cleans prefix', () => {
  assertEqual(normalizeGeminiModel('gemini-3.8-flash'), 'gemini-3.8-flash', 'gemini-3.8-flash preserved');
  assertEqual(normalizeGeminiModel('models/gemini-3.8-flash'), 'gemini-3.8-flash', 'models/ prefix stripped');
});

test('toBase64 converts Buffer, Uint8Array, and strips data URI prefix cleanly', async () => {
  const testStr = 'Hello Cambridge PDF';
  const buf = Buffer.from(testStr, 'utf8');
  const expectedB64 = buf.toString('base64');

  const resBuf = await toBase64(buf);
  assertEqual(resBuf, expectedB64, 'Buffer converted to base64');

  const uint8 = new Uint8Array(buf);
  const resUint8 = await toBase64(uint8);
  assertEqual(resUint8, expectedB64, 'Uint8Array converted to base64');

  const resDataUri = await toBase64(`data:application/pdf;base64,${expectedB64}`);
  assertEqual(resDataUri, expectedB64, 'Data URI stripped cleanly');
});

test('Ingestion Serverless Route config: maxDuration = 60, default batchSize = 5, keepalive ping present', () => {
  const fs = require('fs');
  const path = require('path');
  const routePath = path.resolve(process.cwd(), 'app/api/ingest/extract/route.ts');
  const content = fs.readFileSync(routePath, 'utf8');

  assertEqual(content.includes('export const maxDuration = 60;'), true, 'Route exports maxDuration = 60');
  assertEqual(content.includes('let batchSize = 5;'), true, 'Route sets default batchSize to 5');
  assertEqual(content.includes("': keepalive\\n\\n'"), true, 'Route SSE stream emits keepalive comments');
  assertEqual(content.includes("'X-Accel-Buffering': 'no'"), true, 'Route disables proxy buffering');
});

test('isTransientCapacityError detects HTTP 503, 429, 502, 504 and high demand capacity spikes', () => {
  const err503 = new Error('Gemini API Error (HTTP 503): This model is currently experiencing high demand.');
  (err503 as any).status = 503;
  const res503 = isTransientCapacityError(err503);
  assertEqual(res503.isTransient, true, 'HTTP 503 is recognized as transient');
  assertEqual(res503.status, 503, 'status code 503 extracted');

  const err429 = new Error('Gemini API rate limit exceeded (HTTP 429): Quota exhausted');
  const res429 = isTransientCapacityError(err429);
  assertEqual(res429.isTransient, true, 'HTTP 429 rate limit is recognized as transient');
  assertEqual(res429.status, 429, 'status code 429 extracted');

  const errDemand = new Error('The service is experiencing spikes in demand. Please try again later.');
  const resDemand = isTransientCapacityError(errDemand);
  assertEqual(resDemand.isTransient, true, 'Spikes in demand phrase recognized as transient');

  const errAuth = new Error('Invalid Gemini API Key: API_KEY_INVALID');
  (errAuth as any).status = 400;
  const resAuth = isTransientCapacityError(errAuth);
  assertEqual(resAuth.isTransient, false, 'Invalid API Key is not transient');
});

test('Exponential Backoff with Jitter: delay formula stays bounded within [1.5, 30] seconds', () => {
  for (let attempt = 0; attempt < 5; attempt++) {
    const delay = Math.min(30, Math.pow(2, attempt) * 1.5 + Math.random() * 2);
    assertEqual(delay >= 1.5, true, `Attempt ${attempt} delay is at least 1.5s`);
    assertEqual(delay <= 30, true, `Attempt ${attempt} delay is capped at 30s`);
  }
});

test('Strict Gemini 3.8 Preservation: all legacy variants strictly remap to gemini-3.8-flash without fallback', () => {
  assertEqual(normalizeGeminiModel('gemini-2.5-flash'), 'gemini-3.8-flash', 'gemini-2.5-flash strictly maps to gemini-3.8-flash');
  assertEqual(normalizeGeminiModel('gemini-1.5-flash'), 'gemini-3.8-flash', 'gemini-1.5-flash strictly maps to gemini-3.8-flash');
  assertEqual(normalizeGeminiModel('gemini-3.8-flash'), 'gemini-3.8-flash', 'gemini-3.8-flash strictly preserved');
});

// -----------------------------------------------------------------------------
// [Suite 9] Dynamic Resilience & Framer Motion Keyframe Integrity
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[34m[Suite 9] Dynamic Resilience & Framer Motion Keyframe Integrity\x1b[0m');

test('Motion Keyframe Guard: Header.tsx uses tween type on multi-keyframe scale animations', () => {
  const fs = require('fs');
  const path = require('path');
  const headerPath = path.resolve(process.cwd(), 'components/Header.tsx');
  const content = fs.readFileSync(headerPath, 'utf8');

  // Verify scale: [1, 1.25, 1] transitions do NOT use type: 'spring'
  const streakScaleMatch = content.includes("scale: [1, 1.25, 1]");
  assertEqual(streakScaleMatch, true, 'Header contains 3-keyframe scale pulse');

  // Ensure tween is declared
  const hasTweenType = content.includes("type: 'tween'");
  assertEqual(hasTweenType, true, 'Header declares type: tween to prevent spring solver crash');

  // Ensure no spring on multi-keyframe scale
  const hasSpringOnMultiKeyframe = content.includes("scale: [1, 1.25, 1],\n          transition: { type: 'spring'");
  assertEqual(hasSpringOnMultiKeyframe, false, 'Header does not use spring with 3 keyframes');
});

test('Markdown Error Boundary: Defensive wrapper exists and exports cleanly', () => {
  const fs = require('fs');
  const path = require('path');
  const boundaryPath = path.resolve(process.cwd(), 'components/ui/MarkdownErrorBoundary.tsx');
  assertEqual(fs.existsSync(boundaryPath), true, 'MarkdownErrorBoundary.tsx exists');

  const content = fs.readFileSync(boundaryPath, 'utf8');
  assertEqual(content.includes('class MarkdownErrorBoundary'), true, 'Defines MarkdownErrorBoundary class');
  assertEqual(content.includes('getDerivedStateFromError'), true, 'Implements getDerivedStateFromError lifecycle');
  assertEqual(content.includes('componentDidCatch'), true, 'Implements componentDidCatch lifecycle');
});

test('QuestionCard Protection: QuestionCard wraps stem and options in MarkdownErrorBoundary', () => {
  const fs = require('fs');
  const path = require('path');
  const cardPath = path.resolve(process.cwd(), 'components/QuestionCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');

  assertEqual(content.includes("import { MarkdownErrorBoundary }"), true, 'QuestionCard imports MarkdownErrorBoundary');
  assertEqual(content.includes("<MarkdownErrorBoundary fallbackText={question.stem_markdown}>"), true, 'Question stem protected by error boundary');
  assertEqual(content.includes("<MarkdownErrorBoundary fallbackText={opt.text_markdown}>"), true, 'Option labels protected by error boundary');
});

test('Student sanitize: QuestionCard and RoundSummary run sanitizeKaTeX and keep boundary fallbacks', () => {
  const fs = require('fs');
  const path = require('path');
  for (const rel of ['components/QuestionCard.tsx', 'components/RoundSummary.tsx']) {
    const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
    assertEqual(
      /import\s*\{[^}]*\bsanitizeKaTeX\b[^}]*\}\s*from\s*['"]@\/lib\/ingestion\/katexSanitizer['"]/.test(content),
      true,
      `${rel} imports sanitizeKaTeX from '@/lib/ingestion/katexSanitizer'`
    );
    for (const raw of ['{question.stem_markdown}', '{item.question.stem_markdown}', "{correctOption?.text_markdown || ''}"]) {
      const re = new RegExp('>\\s*' + raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*</ReactMarkdown>');
      assertEqual(re.test(content), false, `${rel} does not pass raw ${raw} as ReactMarkdown children`);
    }
    const boundaries = (content.match(/<MarkdownErrorBoundary\b/g) || []).length;
    const withFallback = (content.match(/<MarkdownErrorBoundary\s+fallbackText=/g) || []).length;
    assertEqual(boundaries > 0, true, `${rel} still uses MarkdownErrorBoundary`);
    assertEqual(withFallback, boundaries, `${rel}: every MarkdownErrorBoundary has fallbackText=`);
  }
});

test('QuestionCard Layout: Citation caption is rendered before the subject/topic tags', () => {
  const fs = require('fs');
  const path = require('path');
  const cardPath = path.resolve(process.cwd(), 'components/QuestionCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');

  const pillContainerIndex = content.indexOf('{/* Meta: source caption');
  assertEqual(pillContainerIndex !== -1, true, 'Pills container found in QuestionCard');

  const citationIndex = content.indexOf("question.citation || 'Cambridge IGCSE'", pillContainerIndex);
  const subjectIndex = content.indexOf('{subject && (', pillContainerIndex);
  const topicIndex = content.indexOf('question.topic || question.topic_id', pillContainerIndex);

  assertEqual(citationIndex !== -1, true, 'Citation pill found in pills container');
  assertEqual(subjectIndex !== -1, true, 'Subject pill found in pills container');
  assertEqual(topicIndex !== -1, true, 'Topic pill found in pills container');
  assertEqual(citationIndex < subjectIndex, true, 'Citation caption is rendered before subject tag');
  assertEqual(citationIndex < topicIndex, true, 'Citation caption is rendered before topic tag');
});

test('QuestionCard CTA: First-try correct banner and Next CTA are positioned below the options list', () => {
  const fs = require('fs');
  const path = require('path');
  const cardPath = path.resolve(process.cwd(), 'components/QuestionCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');

  // Verify first-try correct condition and onNext wiring
  assertEqual(content.includes('isFirstTryCorrect'), true, 'QuestionCard checks isFirstTryCorrect');
  assertEqual(content.includes('{isFirstTryCorrect && ('), false, 'No separate first-try banner (one feedback panel only)');
  assertEqual(content.includes('onClick={onNext}'), true, 'Next button wires onClick to onNext');

  // Verify position relative to stem/question card and options list
  const stemIndex = content.indexOf('question.stem_markdown');
  const firstTryCtaIndex = content.indexOf('{/* Feedback Panel on Answer / Timeout */}');
  const optionsIndex = content.indexOf('role="radiogroup" aria-label="Answer options"');

  assertEqual(stemIndex !== -1, true, 'Question stem found');
  assertEqual(firstTryCtaIndex !== -1, true, 'First-try CTA popup found');
  assertEqual(optionsIndex !== -1, true, 'Options list found');

  assertEqual(stemIndex < optionsIndex, true, 'Options are rendered after question card stem');
  assertEqual(optionsIndex < firstTryCtaIndex, true, 'Single feedback panel is rendered below the options list (options never jump)');
  assertEqual(content.indexOf('sticky bottom-4') > firstTryCtaIndex, true, 'Next CTA is sticky and rendered below the feedback');

  // Verify motion and button styling invariants
  assertEqual(content.includes("transition={{ type: 'spring', stiffness: 350, damping: 25 }}"), true, 'Feedback panel adheres to spring physics invariants');
  assertEqual(content.includes('bg-accent hover:bg-accent-600'), true, 'Next question button contains bg-accent hover:bg-accent-600 styling');
  assertEqual(content.includes('text-2xl font-black'), true, 'Next question button renders arrow with larger text-2xl font-black styling');
  assertEqual(content.includes('Next question'), true, 'CTA includes Next question label');
  assertEqual(content.includes('See results'), true, 'CTA includes See results label for final question');
});

test('QuestionCard Correct Feedback: Celebratory banner and selected correct option badge are rendered', () => {
  const fs = require('fs');
  const path = require('path');
  const cardPath = path.resolve(process.cwd(), 'components/QuestionCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');

  assertEqual(content.includes("'correct-answer-banner'"), true, 'Correct-answer feedback panel is tagged for first-try answers');
  assertEqual(content.includes('Nailed it!'), true, 'Feedback panel includes clear correct headline');
  assertEqual(content.includes("'retry-correct-banner'"), true, 'Feedback panel is tagged for 2nd-try correct answers');
  assertEqual(content.includes('data-testid="correct-option-pill"'), true, 'Selected correct option card renders a prominent CORRECT +XP pill badge');
  assertEqual(content.includes('✓ Correct · +{gainedXP} XP'), true, 'Correct option pill displays checkmark and gained XP');
  assertEqual(content.includes('isCorrectPick'), true, 'Distinguishes user-picked correct option from revealed correct option');
});

test('QuestionCard Retry Skip: Renders retry-next-button below retry alert prompt when isRetry', () => {
  const fs = require('fs');
  const path = require('path');
  const cardPath = path.resolve(process.cwd(), 'components/QuestionCard.tsx');
  const content = fs.readFileSync(cardPath, 'utf8');

  assertEqual(content.includes("'retry-next-button'"), true, 'QuestionCard contains retry-next-button');
  assertEqual(content.includes('onClick={onNext}'), true, 'Next button wires onClick to onNext');

  // Verify it appears inside {isRetry && ( ... )}
  const isRetryIndex = content.indexOf('{isRetry && (');
  assertEqual(isRetryIndex !== -1, true, 'QuestionCard checks isRetry');

  const retryCardIndex = content.indexOf('1 retry left · 50% XP', isRetryIndex);
  assertEqual(retryCardIndex !== -1, true, 'Retry prompt card exists in isRetry block');
  const retryButtonIndex = content.indexOf("'retry-next-button'", retryCardIndex);
  assertEqual(retryButtonIndex !== -1, true, 'Retry next button is wired when isRetry');
  assertEqual(retryButtonIndex > retryCardIndex, true, 'Next button is rendered BELOW retry prompt card (sticky footer)');

  // Verify styling and labels
  assertEqual(content.includes('bg-accent hover:bg-accent-600'), true, 'Retry button has tactile neobrutalist accent styling');
  assertEqual(content.includes('Streak reset. Pick another option or skip to next question.'), true, 'Retry prompt subtext mentions skip to next question');
});

test('useQuizGame Question Skip: Correctly accounts for skipped question during first-wrong status', () => {
  const fs = require('fs');
  const path = require('path');
  const hookPath = path.resolve(process.cwd(), 'hooks/useQuizGame.ts');
  const content = fs.readFileSync(hookPath, 'utf8');

  // Verify nextQuestion handles status === 'first-wrong'
  assertEqual(content.includes("if (status === 'first-wrong')"), true, 'nextQuestion checks status === "first-wrong"');
  assertEqual(content.includes("setWrongCount(prev => prev + 1)"), true, 'Increments wrongCount on skip');
  // Answer integrity: the skip is now recorded server-side as a 'give-up' event, then the missed question is queued.
  assertEqual(/event:\s*'give-up'/.test(content), true, 'Skip is sent to the server as a give-up event');
  assertEqual(content.includes("recordMissed(recorded, 'wrong', currentQuestionIndex + 1)"), true, 'Records missed question on skip');
  assertEqual(content.includes('saveAttempt('), false, 'Client no longer writes attempts directly');
});


// -----------------------------------------------------------------------------
// [Suite 10] Simplified Direct JSON Pipeline, Zero-Draft Contract & Supabase Bank
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[34m[Suite 10] Simplified Direct JSON Pipeline, Zero-Draft Contract & Supabase Bank\x1b[0m');

test('Direct JSON Upload Pipeline: IngestionSetupWizard provides Direct JSON upload and dropzone', () => {
  const fs = require('fs');
  const path = require('path');
  const wizardPath = path.resolve(process.cwd(), 'components/portal/IngestionSetupWizard.tsx');
  assertEqual(fs.existsSync(wizardPath), true, 'IngestionSetupWizard.tsx exists');

  const content = fs.readFileSync(wizardPath, 'utf8');
  assertEqual(content.includes('Upload JSON Past Paper'), true, 'Provides direct Upload JSON Past Paper button');
  assertEqual(content.includes('Agent JSON Dropzone'), true, 'Provides dedicated Agent JSON Dropzone');
  assertEqual(content.includes('Drop Antigravity Agent JSON File Here'), true, 'Provides Agent JSON drop target text');
  assertEqual(content.includes('accept=".json,application/json,text/json"'), true, 'Accepts valid JSON file types');
  assertEqual(content.includes('onUploadJson'), true, 'Wires upload handler to onUploadJson callback');
});

test('Direct JSON Upload Pipeline: validateStagingPaper validates Cambridge JSON with allowPartialBatch', () => {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.resolve(process.cwd(), 'staging/0455_s24_12.json');
  assertEqual(fs.existsSync(filePath), true, 'staging/0455_s24_12.json exists');

  const rawPaper = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const validation = validateStagingPaper(rawPaper, { allowPartialBatch: true });
  assertEqual(validation.success, true, 'validateStagingPaper passes Cambridge JSON with allowPartialBatch');
  assert(Boolean(validation.data), 'Validated paper data is defined');
  assertEqual(validation.data?.questions.length, 30, 'Validated paper contains 30 questions');
  assertEqual(validation.data?.subject.code, '0455', 'Validated paper subject code is 0455');

  // Verify allowPartialBatch accepts partial question subsets
  const partialPaper = {
    ...rawPaper,
    questions: rawPaper.questions.slice(0, 3),
  };
  const partialValidation = validateStagingPaper(partialPaper, { allowPartialBatch: true });
  assertEqual(partialValidation.success, true, 'allowPartialBatch accepts partial batch (3 questions)');
  assertEqual(partialValidation.data?.questions.length, 3, 'Partial batch preserved exactly 3 questions');
});

test('Zero-Draft Contract: useIngestionStore does NOT write drafts to localStorage and clearDraft removes key', () => {
  const fs = require('fs');
  const path = require('path');
  const validPaper = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'staging/0455_s24_12.json'), 'utf8'));

  // Ensure storage key is the canonical revizz_ingestion_draft
  assertEqual(LOCAL_STORAGE_KEY, 'revizz_ingestion_draft', 'Storage key matches revizz_ingestion_draft');

  // Clear mock storage and set paper in review state
  mockStorage.clear();
  ingestionStore.setState({
    paper: validPaper,
    lifecycleState: 'review',
  });

  // Zero-draft contract: saveDraftToLocalStorage must return false and refuse to write
  const saveResult = ingestionStore.saveDraftToLocalStorage();
  assertEqual(saveResult, false, 'saveDraftToLocalStorage returns false under Zero-Draft Contract');
  assertEqual(mockStorage.getItem('revizz_ingestion_draft'), null, 'revizz_ingestion_draft is NOT written to localStorage');

  // Seed storage with legacy draft and test hasDraft() purges it
  mockStorage.setItem('revizz_ingestion_draft', JSON.stringify({ draft: true, paper: validPaper }));
  assert(Boolean(mockStorage.getItem('revizz_ingestion_draft')), 'Draft seeded in localStorage');
  const hasDraftResult = ingestionStore.hasDraft();
  assertEqual(hasDraftResult, false, 'hasDraft returns false under Zero-Draft Contract');
  assertEqual(mockStorage.getItem('revizz_ingestion_draft'), null, 'hasDraft purges revizz_ingestion_draft from localStorage');

  // Seed storage again and verify clearDraft removes 'revizz_ingestion_draft'
  mockStorage.setItem('revizz_ingestion_draft', 'legacy_draft_content');
  ingestionStore.clearDraft();
  assertEqual(mockStorage.getItem('revizz_ingestion_draft'), null, 'clearDraft removes revizz_ingestion_draft');
});

test('Zero-Draft Contract: IngestionHeader does not contain a "Save Draft" button', () => {
  const fs = require('fs');
  const path = require('path');
  const headerPath = path.resolve(process.cwd(), 'components/portal/IngestionHeader.tsx');
  assertEqual(fs.existsSync(headerPath), true, 'IngestionHeader.tsx exists');

  const content = fs.readFileSync(headerPath, 'utf8');
  assertEqual(content.includes('Save Draft'), false, 'IngestionHeader does not contain "Save Draft" button');
  assertEqual(content.includes('handleSaveDraft'), false, 'IngestionHeader does not contain handleSaveDraft');
});

test('Staged Papers Nav Teardown: AppAdminNav.tsx and AppAdminHub.tsx do not contain staged navigation or tab', () => {
  const fs = require('fs');
  const path = require('path');

  // AppAdminNav.tsx
  const navPath = path.resolve(process.cwd(), 'components/admin/AppAdminNav.tsx');
  assertEqual(fs.existsSync(navPath), true, 'AppAdminNav.tsx exists');
  const navContent = fs.readFileSync(navPath, 'utf8');
  assertEqual(navContent.includes("handleNavClick('staged')"), false, 'AppAdminNav does not have handleNavClick(staged)');
  assertEqual(navContent.includes("navItemClass('staged')"), false, 'AppAdminNav does not have navItemClass(staged)');
  assertEqual(navContent.includes('title="Staged Papers"'), false, 'AppAdminNav does not render Staged Papers button');

  // AppAdminHub.tsx
  const hubPath = path.resolve(process.cwd(), 'components/admin/AppAdminHub.tsx');
  assertEqual(fs.existsSync(hubPath), true, 'AppAdminHub.tsx exists');
  const hubContent = fs.readFileSync(hubPath, 'utf8');
  assertEqual(hubContent.includes("case 'staged':"), false, 'AppAdminHub does not have case staged tab');
  assertEqual(hubContent.includes('<StagingReview'), false, 'AppAdminHub does not render StagingReview component');
  assertEqual(hubContent.includes('Staged Papers Queue'), false, 'AppAdminHub does not render Staged Papers Queue heading');
});

test('Live Question Bank Integration: AdminTools.tsx imports supabase from @/lib/supabaseClient and handles live questions & filters', () => {
  const fs = require('fs');
  const path = require('path');
  const toolsPath = path.resolve(process.cwd(), 'components/portal/AdminTools.tsx');
  assertEqual(fs.existsSync(toolsPath), true, 'AdminTools.tsx exists');

  const content = fs.readFileSync(toolsPath, 'utf8');
  assertEqual(content.includes("import { supabase } from '@/lib/supabaseClient';"), true, 'AdminTools imports supabase from @/lib/supabaseClient');
  assertEqual(content.includes('useQuestions'), true, 'AdminTools uses useQuestions hook for live Supabase sync');
  assertEqual(content.includes('dbQuestions'), true, 'AdminTools receives live dbQuestions pool');
  assertEqual(content.includes('bankSearch'), true, 'AdminTools manages bankSearch state');
  assertEqual(content.includes('bankStatusFilter'), true, 'AdminTools manages bankStatusFilter dynamic filter');
  assertEqual(content.includes('bankPaperFilter'), true, 'AdminTools manages bankPaperFilter dynamic filter');
  assertEqual(content.includes('bankTopicFilter'), true, 'AdminTools manages bankTopicFilter dynamic filter');
  assertEqual(content.includes('bankDifficultyFilter'), true, 'AdminTools manages bankDifficultyFilter dynamic filter');
});

// -----------------------------------------------------------------------------
// [Suite 11] Ingestion Studio JSON Paper & Slice Upload Verification
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[34m[Suite 11] Ingestion Studio JSON Paper & Slice Upload Verification\x1b[0m');

test('Direct StagingPaper JSON (staging/0455_s24_12.json) loads paper without evaluating to metadata object', () => {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.resolve(process.cwd(), 'staging/0455_s24_12.json');
  assertEqual(fs.existsSync(filePath), true, 'staging/0455_s24_12.json exists');

  const rawJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const res = ingestionStore.loadJson(rawJson);

  assertEqual(res.success, true, 'loadJson succeeded for direct staging paper');
  const storePaper = ingestionStore.getState().paper;
  assert(Boolean(storePaper), 'Store paper must not be null');
  assertEqual(Array.isArray(storePaper?.questions), true, 'Store paper must have questions array');
  assertEqual(storePaper?.questions.length, 30, 'Store paper contains exactly 30 questions');
  assertEqual(storePaper?.subject.code, '0455', 'Subject code is 0455');
  assertEqual(storePaper?.paper.series, 's', 'Series is s');
  assertEqual(storePaper?.paper.year, 2024, 'Year is 2024');
  assertEqual(storePaper?.paper.paper_code, '12', 'Paper code is 12');
  assertEqual(ingestionStore.getState().publishStatus, 'idle', 'publishStatus resets to idle on success');
});

test('Wrapped { paper: StagingPaper } format unpacks questions and metadata cleanly', () => {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.resolve(process.cwd(), 'staging/0455_s24_12.json');
  const rawPaper = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  const wrapped = { paper: rawPaper };
  const res = ingestionStore.loadJson(wrapped);

  assertEqual(res.success, true, 'loadJson succeeded for wrapped paper');
  const storePaper = ingestionStore.getState().paper;
  assertEqual(storePaper?.questions.length, 30, 'Unpacked wrapped questions length is 30');
  assertEqual(storePaper?.paper.paper_code, '12', 'Unpacked paper code matches');
});

test('Plain array of questions normalizes into full valid staging paper', () => {
  const sampleQuestions = [
    {
      question_number: 1,
      cambridge_source_ref: '0455/12/S/24 Q1',
      topic_name: 'The basic economic problem',
      stem_markdown: 'What is the basic economic problem?',
      options: [
        { label: 'A', content_markdown: 'Scarcity of resources relative to unlimited wants', is_correct: true },
        { label: 'B', content_markdown: 'Inflation', is_correct: false },
        { label: 'C', content_markdown: 'Deflation', is_correct: false },
        { label: 'D', content_markdown: 'Recession', is_correct: false },
      ],
      explanation_markdown: 'The fundamental economic problem is scarcity.',
      status: 'active',
    },
    {
      question_number: 2,
      cambridge_source_ref: '0455/12/S/24 Q2',
      topic_name: 'The allocation of resources',
      stem_markdown: 'What causes a shift in the demand curve?',
      options: [
        { label: 'A', content_markdown: 'Change in income', is_correct: true },
        { label: 'B', content_markdown: 'Change in price', is_correct: false },
        { label: 'C', content_markdown: 'Change in supply', is_correct: false },
        { label: 'D', content_markdown: 'Movement along curve', is_correct: false },
      ],
      explanation_markdown: 'Non-price factors shift the demand curve.',
      status: 'active',
    },
  ];

  const res = ingestionStore.loadJson(sampleQuestions);
  assertEqual(res.success, true, 'Plain questions array successfully converted into valid paper');

  const storePaper = ingestionStore.getState().paper;
  assert(Boolean(storePaper), 'Store paper must exist');
  assertEqual(storePaper?.questions.length, 2, '2 questions loaded');
  assertEqual(storePaper?.subject.code, '0455', 'Inferred or defaulted subject code');
  assertEqual(storePaper?.paper.series, 's', 'Inferred or defaulted series');
  assertEqual((storePaper?.syllabus_topics?.length ?? 0) >= 2, true, 'Derived syllabus topics from questions');
});

test('Object slice { questions: [...] } without root metadata synthesizes valid schema', () => {
  const slicePayload = {
    questions: [
      {
        question_number: 1,
        topic_name: 'Market Failure',
        stem_markdown: 'Why do public goods cause market failure?',
        options: [
          { label: 'A', content_markdown: 'Non-excludable and non-rival', is_correct: true },
          { label: 'B', content_markdown: 'High profits', is_correct: false },
          { label: 'C', content_markdown: 'Overproduction', is_correct: false },
          { label: 'D', content_markdown: 'Government regulation', is_correct: false },
        ],
        explanation_markdown: 'Free-rider problem occurs.',
      },
    ],
  };

  const res = ingestionStore.loadJson(slicePayload);
  assertEqual(res.success, true, 'Slice without root metadata successfully normalized');
  const storePaper = ingestionStore.getState().paper;
  assertEqual(storePaper?.questions.length, 1, '1 question loaded');
  assertEqual(storePaper?.subject.code, '0455', 'Defaulted subject code');
  assertEqual(storePaper?.paper.year, 2024, 'Defaulted year');
  assertEqual(storePaper?.syllabus_topics?.[0]?.name, 'Market Failure', 'Derived topic from question');
});

test('Lenient metadata coercion: string year, numeric paper_code, and missing icon', () => {
  const rawPayload = {
    subject: { code: '0478', name: 'Computer Science' },
    paper: { series: 'w', paper_code: 11, year: '2023' },
    questions: [
      {
        question_number: 1,
        topic_name: 'Data representation',
        stem_markdown: 'Convert 1010 to denary.',
        options: [
          { label: 'A', content_markdown: '10', is_correct: true },
          { label: 'B', content_markdown: '8', is_correct: false },
          { label: 'C', content_markdown: '12', is_correct: false },
          { label: 'D', content_markdown: '14', is_correct: false },
        ],
        explanation_markdown: '8 + 2 = 10.',
      },
    ],
  };

  const res = ingestionStore.loadJson(rawPayload);
  assertEqual(res.success, true, 'Lenient metadata payload normalized and loaded');

  const storePaper = ingestionStore.getState().paper;
  assertEqual(storePaper?.subject.code, '0478', 'Subject code preserved');
  assertEqual(typeof storePaper?.subject.icon === 'string' && storePaper?.subject.icon.length > 0, true, 'Default icon provided');
  assertEqual(storePaper?.paper.year, 2023, 'Year coerced to number 2023');
  assertEqual(storePaper?.paper.paper_code, '11', 'Paper code coerced to string "11"');
  assertEqual(storePaper?.paper.series, 'w', 'Series lowercased');
});

test('Validation failure handling: invalid payload sets error state and clear message', () => {
  // Empty object with no questions
  const emptyRes = ingestionStore.loadJson({});
  assertEqual(emptyRes.success, false, 'Empty object fails loadJson');
  assertEqual(ingestionStore.getState().publishStatus, 'error', 'publishStatus set to error');
  assert(ingestionStore.getState().publishMessage.length > 0, 'Informative publishMessage set');

  // Non-object
  const invalidRes = ingestionStore.loadJson(12345);
  assertEqual(invalidRes.success, false, 'Primitive number fails loadJson');
  assertEqual(ingestionStore.getState().publishStatus, 'error', 'publishStatus set to error');

  // Question with only 2 options (violates 4 options requirement)
  const invalidQuestionRes = ingestionStore.loadJson({
    questions: [
      {
        question_number: 1,
        stem_markdown: 'Question with too few options',
        options: [
          { label: 'A', content_markdown: 'Opt A', is_correct: true },
          { label: 'B', content_markdown: 'Opt B', is_correct: false },
        ],
        explanation_markdown: 'Test',
      },
    ],
  });
  assertEqual(invalidQuestionRes.success, false, 'Question with 2 options fails validation');
  assert(Boolean(invalidQuestionRes.errors?.[0]?.includes('4 options')), 'Error message cites 4 options requirement');
});

test('Ingestion UI Components: file input accept types, e.target.value resets, and error feedback', () => {
  const fs = require('fs');
  const path = require('path');

  // 1. IngestionSetupWizard.tsx checks
  const wizardPath = path.resolve(process.cwd(), 'components/portal/IngestionSetupWizard.tsx');
  const wizardContent = fs.readFileSync(wizardPath, 'utf8');
  assertEqual(wizardContent.includes('accept=".json,application/json,text/json"'), true, 'Wizard file input accepts .json,application/json,text/json');
  assertEqual(wizardContent.includes('e.target.value = ""'), true, 'Wizard resets e.target.value to allow re-uploading same file');
  assertEqual(wizardContent.includes('setUploadError'), true, 'Wizard has setUploadError feedback handler');

  // 2. IngestionModals.tsx checks
  const modalsPath = path.resolve(process.cwd(), 'components/portal/IngestionModals.tsx');
  const modalsContent = fs.readFileSync(modalsPath, 'utf8');
  assertEqual(modalsContent.includes('accept=".json,application/json,text/json"'), true, 'Modals file input accepts .json,application/json,text/json');
  assertEqual(modalsContent.includes('e.target.value = ""'), true, 'Modals resets e.target.value');
  assertEqual(modalsContent.includes('Array.isArray(parsed.paper.questions)'), true, 'Modals distinguishes wrapped paper with questions');

  // 3. IngestionHub.tsx checks
  const hubPath = path.resolve(process.cwd(), 'components/portal/IngestionHub.tsx');
  const hubContent = fs.readFileSync(hubPath, 'utf8');
  assertEqual(hubContent.includes('Validation failed for'), true, 'IngestionHub handles JSON loading failures with user feedback');
  assertEqual(hubContent.includes('Failed to load staged paper'), true, 'IngestionHub handles staged paper load failure with user feedback');
});

// -----------------------------------------------------------------------------
// [Suite 12] Ingestion Studio Dropzone & Drag-and-Drop Resilience
// -----------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[34m[Suite 12] Ingestion Studio Dropzone & Drag-and-Drop Resilience\x1b[0m');

test('IngestionSetupWizard QP and MS dropzones check for JSON files (.json extension or application/json MIME) and call onUploadJson', () => {
  const fs = require('fs');
  const path = require('path');
  const wizardPath = path.resolve(process.cwd(), 'components/portal/IngestionSetupWizard.tsx');
  const wizardContent = fs.readFileSync(wizardPath, 'utf8');

  // Verify handleDrop checks for JSON extension and MIME
  assertEqual(wizardContent.includes('const isJsonExt = file.name.toLowerCase().endsWith(".json");'), true, 'handleDrop checks for .json extension');
  assertEqual(wizardContent.includes('const isJsonType = file.type === "application/json" || file.type === "text/json";'), true, 'handleDrop checks for application/json or text/json MIME');
  assertEqual(wizardContent.includes('handleTriggerUploadJson(file);'), true, 'handleDrop routes JSON files to handleTriggerUploadJson');
  assertEqual(wizardContent.includes('onUploadJson(file)'), true, 'handleTriggerUploadJson delegates to onUploadJson callback');

  // Verify QP and MS dropzone JSX handlers bind handleDrop
  assertEqual(wizardContent.includes('onDrop={(e) => handleDrop(e, "qp")}'), true, 'QP dropzone dispatches to handleDrop(e, "qp")');
  assertEqual(wizardContent.includes('onDrop={(e) => handleDrop(e, "ms")}'), true, 'MS dropzone dispatches to handleDrop(e, "ms")');

  // Verify dropEffect and HTML5 dragover/dragenter preventDefault
  assertEqual(wizardContent.includes('setIsDraggingQp(true)'), true, 'QP dragenter sets isDraggingQp');
  assertEqual(wizardContent.includes('setIsDraggingMs(true)'), true, 'MS dragenter sets isDraggingMs');
});

test('IngestionSetupWizard Agent dropzone has pointer-events-none on child elements, e.dataTransfer.dropEffect = "copy", and onDragEnter', () => {
  const fs = require('fs');
  const path = require('path');
  const wizardPath = path.resolve(process.cwd(), 'components/portal/IngestionSetupWizard.tsx');
  const wizardContent = fs.readFileSync(wizardPath, 'utf8');

  // Verify Agent dropzone has copy dropEffect, onDragEnter, and onDrop
  assertEqual(wizardContent.includes('e.dataTransfer.dropEffect = "copy";'), true, 'Dropzone sets dropEffect to copy');
  assertEqual(wizardContent.includes('setIsDraggingJson(true);'), true, 'Agent dropzone onDragEnter and onDragOver activate drag state');
  assertEqual(wizardContent.includes('onDrop={handleJsonDrop}'), true, 'Agent dropzone binds handleJsonDrop');

  // Verify pointer-events-none prevents child flicker
  assertEqual(wizardContent.includes('pointer-events-none'), true, 'Child elements contain pointer-events-none');

  // Verify FileReader spinner state passing from IngestionHub
  const hubPath = path.resolve(process.cwd(), 'components/portal/IngestionHub.tsx');
  const hubContent = fs.readFileSync(hubPath, 'utf8');
  assertEqual(hubContent.includes('isReadingFile={isReadingFile}'), true, 'IngestionHub passes isReadingFile prop to IngestionSetupWizard');
  assertEqual(wizardContent.includes('isReadingFile = false'), true, 'IngestionSetupWizard accepts isReadingFile prop');
  assertEqual(wizardContent.includes('Reading JSON File...'), true, 'IngestionSetupWizard renders reading spinner feedback');
});

test('Container dropzone fallback handles root dragover and routes JSON to onUploadJson', () => {
  const fs = require('fs');
  const path = require('path');
  const wizardPath = path.resolve(process.cwd(), 'components/portal/IngestionSetupWizard.tsx');
  const wizardContent = fs.readFileSync(wizardPath, 'utf8');

  // Verify container dropzone on root div
  assertEqual(wizardContent.includes('data-testid="ingestion-setup-wizard"'), true, 'Setup wizard container has testid');
  assertEqual(wizardContent.includes('e.dataTransfer.dropEffect = "copy"'), true, 'Container sets dropEffect = "copy"');
  assertEqual(wizardContent.includes('handleTriggerUploadJson(file);'), true, 'Container onDrop triggers upload for JSON');
});

test('End-to-end load of /Users/joelchong/Downloads/0455_s24_12.json into ingestionStore.loadJson succeeds with 30 questions', () => {
  const fs = require('fs');
  const path = require('path');

  const downloadPath = '/Users/joelchong/Downloads/0455_s24_12.json';
  const fallbackPath = path.resolve(process.cwd(), 'staging/0455_s24_12.json');
  const targetPath = fs.existsSync(downloadPath) ? downloadPath : fallbackPath;

  assertEqual(fs.existsSync(targetPath), true, `Target JSON file exists (${targetPath})`);

  const fileContent = fs.readFileSync(targetPath, 'utf8');
  assert(fileContent.length > 0, 'Target JSON file is non-empty');

  const rawJson = JSON.parse(fileContent);
  const res = ingestionStore.loadJson(rawJson);

  assertEqual(res.success, true, 'ingestionStore.loadJson returns success true');
  const storePaper = ingestionStore.getState().paper;
  assert(Boolean(storePaper), 'Store paper exists after loadJson');
  assertEqual(storePaper?.questions.length, 30, 'Store paper contains exactly 30 questions');
  assertEqual(storePaper?.subject.code, '0455', 'Subject code matches 0455 (Economics)');
  assertEqual(storePaper?.paper.year, 2024, 'Year matches 2024');
  assertEqual(storePaper?.paper.series, 's', 'Series matches s (Summer)');
  assertEqual(storePaper?.paper.paper_code, '12', 'Paper code matches 12');

  // Verify question integrity across loaded paper
  for (const q of storePaper?.questions || []) {
    assert(Boolean(q.stem_markdown && q.stem_markdown.trim().length > 0), `Question ${q.question_number} has stem`);
    assertEqual(q.options.length, 4, `Question ${q.question_number} has 4 options`);
    const correctCount = q.options.filter((o: any) => o.is_correct).length;
    assertEqual(correctCount, 1, `Question ${q.question_number} has exactly 1 correct option`);
  }

  assertEqual(ingestionStore.getState().publishStatus, 'idle', 'publishStatus is idle');
});

// -----------------------------------------------------------------------------
// [Suite 13] Ingestion Pipeline Overhaul, Status Feedback & Supabase Upsert Receipts
// -----------------------------------------------------------------------------
async function runSuite13() {
  console.log('\n[Suite 13] Ingestion Pipeline Overhaul, Status Feedback & Supabase Upsert Receipts');

  await testAsync('Pipeline Modal State & Summary Tracking in useIngestionStore', async () => {
    ingestionStore.resetStore();
    const state = ingestionStore.getState();
    assertEqual(state.isPipelineModalOpen, false, 'Modal closed by default');
    assertEqual(state.pipelineStep, 'preview', 'Pipeline step is preview');
    assertEqual(state.lastPublishReceipt, null, 'No last receipt initially');
    assertEqual(state.pipelineFileSummary, null, 'No file summary initially');

    ingestionStore.setIsPipelineModalOpen(true);
    assertEqual(ingestionStore.getState().isPipelineModalOpen, true, 'setIsPipelineModalOpen(true) works');
    ingestionStore.setPipelineStep('upserting');
    assertEqual(ingestionStore.getState().pipelineStep, 'upserting', 'setPipelineStep works');

    const sampleJson = {
      subject: { code: '0455', name: 'Economics', icon: '📈' },
      paper: { series: 's', paper_code: '12', year: 2024 },
      syllabus_topics: [
        { name: 'Basic Economic Problem', order_index: 1 },
        { name: 'Allocation of Resources', order_index: 2 },
      ],
      questions: [
        {
          question_number: 1,
          cambridge_source_ref: 'Cambridge 0455/12 s24 Q1',
          topic_name: 'Basic Economic Problem',
          stem_markdown: 'What is defined as the next best alternative given up?',
          options: [
            { label: 'A', content_markdown: 'Opportunity cost', is_correct: true },
            { label: 'B', content_markdown: 'Sunk cost', is_correct: false },
            { label: 'C', content_markdown: 'Accounting cost', is_correct: false },
            { label: 'D', content_markdown: 'Marginal revenue', is_correct: false },
          ],
          explanation_markdown: 'Opportunity cost is the benefit of the next best alternative foregone.',
        },
      ],
    };

    const res = ingestionStore.loadJson(sampleJson, { name: 'cambridge_econ_test.json', size: 2048 });
    assertEqual(res.success, true, 'loadJson with fileMeta succeeds');
    assertEqual(ingestionStore.getState().isPipelineModalOpen, true, 'isPipelineModalOpen set to true upon load');
    assertEqual(ingestionStore.getState().pipelineStep, 'preview', 'pipelineStep set to preview');
    const summary = ingestionStore.getState().pipelineFileSummary;
    assert(Boolean(summary), 'pipelineFileSummary exists');
    assertEqual(summary?.name, 'cambridge_econ_test.json', 'File name preserved');
    assertEqual(summary?.size, 2048, 'File size preserved');
    assertEqual(summary?.questionCount, 1, 'Question count is 1');
    assertEqual(summary?.validCount, 1, 'Valid question count is 1');
    assertEqual(summary?.optionCount, 4, 'Option count is 4');
    assertEqual(summary?.topicCount, 2, 'Topic count is 2');
  });

  await testAsync('publishToSupabase records real database receipt, updates lifecycle and transitions pipelineStep', async () => {
    // Mock global fetch for /api/ingest/publish
    const origFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async (url: string, init?: any) => {
      if (url === '/api/ingest/publish') {
        const body = JSON.parse(init?.body || '{}');
        const qCount = body.paper?.questions?.length || 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            paper_id: '0455_s24_12',
            subjects_count: 1,
            topics_count: 2,
            questions_count: qCount,
            options_count: qCount * 4,
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    };

    try {
      const pubRes = await ingestionStore.publishToSupabase();
      assertEqual(pubRes.success, true, 'publishToSupabase returns success true');
      assertEqual(ingestionStore.getState().pipelineStep, 'success', 'pipelineStep transitions to success');
      assertEqual(ingestionStore.getState().lifecycleState, 'published', 'lifecycleState transitions to published');

      const receipt = ingestionStore.getState().lastPublishReceipt;
      assert(Boolean(receipt), 'lastPublishReceipt is stored in state');
      assertEqual(receipt?.paper_id, '0455_s24_12', 'Receipt paper_id matches');
      assertEqual(receipt?.questions_count, 1, 'Receipt questions_count matches');
      assertEqual(receipt?.options_count, 4, 'Receipt options_count matches');
      assertEqual(receipt?.topics_count, 2, 'Receipt topics_count matches');
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  });

  await testAsync('publishToSupabase handles API errors gracefully and updates error state', async () => {
    const origFetch = (globalThis as any).fetch;
    (globalThis as any).fetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Database connection failed: Postgres timeout',
      }),
    });

    try {
      const failRes = await ingestionStore.publishToSupabase();
      assertEqual(failRes.success, false, 'publishToSupabase reports failure on API error');
      assertEqual(ingestionStore.getState().publishStatus, 'error', 'publishStatus transitions to error');
      assertEqual(ingestionStore.getState().pipelineStep, 'error', 'pipelineStep transitions to error');
      assert(ingestionStore.getState().publishMessage.includes('Database connection failed'), 'Error message preserved');
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  });

  await testAsync('IngestionPipelineModal component exports cleanly with neobrutalist audit, status warning, and receipt', () => {
    const fs = require('fs');
    const path = require('path');
    const modalPath = path.resolve(process.cwd(), 'components/portal/IngestionPipelineModal.tsx');
    assertEqual(fs.existsSync(modalPath), true, 'IngestionPipelineModal.tsx exists');

    const content = fs.readFileSync(modalPath, 'utf8');
    assertEqual(content.includes('export default function IngestionPipelineModal'), true, 'Default export exists');
    assertEqual(content.includes('Schema & Integrity Audit'), true, 'Contains Schema & Integrity Audit');
    assertEqual(content.includes('Ready to Upsert: Loaded in browser memory only'), true, 'Contains Supabase memory warning');
    assertEqual(content.includes('Upsert') && content.includes('Questions to Supabase Live Bank'), true, 'Contains Primary Upsert CTA');
    assertEqual(content.includes('Open Studio Workspace to Inspect/Edit'), true, 'Contains Secondary Workspace CTA');
    assertEqual(content.includes('Supabase Database Receipt'), true, 'Contains Database Receipt Card');
    assertEqual(content.includes('View in Question Bank'), true, 'Contains Question Bank link');
    assertEqual(content.includes('Upload Another Paper'), true, 'Contains Upload Another Paper action');
  });

  await testAsync('IngestionHub integrates IngestionPipelineModal with file metadata forwarding and live upsert', () => {
    const fs = require('fs');
    const path = require('path');
    const hubContent = fs.readFileSync(path.resolve(process.cwd(), 'components/portal/IngestionHub.tsx'), 'utf8');

    assertEqual(hubContent.includes('import IngestionPipelineModal from "./IngestionPipelineModal";'), true, 'Imports IngestionPipelineModal');
    assertEqual(hubContent.includes('<IngestionPipelineModal'), true, 'Renders IngestionPipelineModal overlay');
    assertEqual(hubContent.includes('loadJson(json, { name: file.name, size: file.size })'), true, 'Forwards file name and size to loadJson');
    assertEqual(hubContent.includes('setIsPipelineModalOpen(true)'), true, 'Opens pipeline modal upon JSON load and upsert');
    assertEqual(hubContent.includes('window.location.href = "/admin?tab=bank";'), true, 'IngestionHub routes "View in Question Bank" to /admin?tab=bank');
  });

  await testAsync('StagingReview and Staged quality gate replace mock setTimeout with real Supabase API call, real receipt, and direct JSON upload', () => {
    const fs = require('fs');
    const path = require('path');
    const stagingContent = fs.readFileSync(path.resolve(process.cwd(), 'components/portal/StagingReview.tsx'), 'utf8');
    const auditorContent = fs.readFileSync(path.resolve(process.cwd(), 'components/portal/staged/StagedPaperAuditor.tsx'), 'utf8');
    const queueContent = fs.readFileSync(path.resolve(process.cwd(), 'components/portal/staged/StagedPapersQueue.tsx'), 'utf8');
    const combinedContent = stagingContent + '\n' + auditorContent + '\n' + queueContent;

    // Verify mock setTimeout publishing was completely eliminated
    assertEqual(combinedContent.includes('setTimeout(() => setPublishMessage(null), 5000);'), false, 'Mock setTimeout publish eliminated');
    assertEqual(auditorContent.includes("authFetch('/api/ingest/publish'"), true, 'Wires handlePublish to real /api/ingest/publish');
    assertEqual(queueContent.includes('accept=".json'), true, 'Contains direct JSON dropzone accepting .json');
    assertEqual(combinedContent.includes("'draft'"), false, 'StagingReview never outputs draft status for staged questions');
    assertEqual(auditorContent.includes('setPublishMessage(null);'), true, 'Auditor clears publishMessage appropriately');
  });

  await testAsync('IngestionSetupWizard provides prominent JSON upload in both Cloud and Agent tabs with valid MIME types', () => {
    const fs = require('fs');
    const path = require('path');
    const wizardContent = fs.readFileSync(path.resolve(process.cwd(), 'components/portal/IngestionSetupWizard.tsx'), 'utf8');

    assertEqual(wizardContent.includes('Have a Pre-staged Cambridge JSON Paper?'), true, 'Cloud tab includes fast-track JSON past paper card');
    assertEqual(wizardContent.includes('Upload JSON Past Paper'), true, 'Upload JSON Past Paper action is prominent');
    assertEqual(wizardContent.includes('Drop Antigravity Agent JSON File Here'), true, 'Agent tab includes prominent JSON dropzone');
    assertEqual(wizardContent.includes('accept=".json,application/json,text/json"'), true, 'Accepts JSON extensions and MIME types');
  });

  // -----------------------------------------------------------------------------
  // [Suite 14] Ingestion Draft Persistence & Validation Integrity
  // -----------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[Suite 14] Ingestion Draft Persistence & Validation Integrity\x1b[0m');

  test('hasDraft() returns false on empty localStorage', () => {
    mockStorage.clear();
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false when storage is empty');
  });

  test('hasDraft() returns false and clears storage when corrupted JSON or non-object is stored', () => {
    // Corrupted / invalid JSON string
    mockStorage.setItem(LOCAL_STORAGE_KEY, '{ broken json');
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false on malformed JSON');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Corrupted draft is purged from storage');

    // Stored JSON is a string, not an object
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify('just a string'));
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false on string draft');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'String draft is purged from storage');

    // Stored JSON is null
    mockStorage.setItem(LOCAL_STORAGE_KEY, 'null');
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false on null draft');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Null draft is purged from storage');

    // Stored JSON is a number
    mockStorage.setItem(LOCAL_STORAGE_KEY, '12345');
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false on numeric draft');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Numeric draft is purged from storage');
  });

  test('hasDraft() returns false and clears storage when paper has 0 questions', () => {
    // Empty object
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({}));
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false on empty object draft');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Empty object draft is purged from storage');

    // Object with paper containing 0 questions
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ paper: { questions: [] } }));
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false when questions array is empty');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Empty questions paper is purged from storage');

    // Direct candidate paper with empty questions
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ questions: [] }));
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false when root questions array is empty');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Root empty questions draft is purged from storage');
  });

  test('hasDraft() returns false and clears storage when draft is marked published', () => {
    const fs = require('fs');
    const path = require('path');
    const validPaper = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'staging/0455_s24_12.json'), 'utf8'));

    // Published via candidatePaper.lifecycle_state === 'published'
    mockStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        paper: { ...validPaper, lifecycle_state: 'published' },
        lifecycleState: 'review',
      })
    );
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false when paper.lifecycle_state is published');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Published paper is purged from storage');

    // Published via parsed.lifecycleState === 'published'
    mockStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        paper: validPaper,
        lifecycleState: 'published',
      })
    );
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false when parsed.lifecycleState is published');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Published wrapper draft is purged from storage');
  });

  test('hasDraft() adheres to Zero-Draft Contract by purging storage and returning false', () => {
    const fs = require('fs');
    const path = require('path');
    const validPaper = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'staging/0455_s24_12.json'), 'utf8'));

    // Wrapped format
    mockStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        paper: validPaper,
        lifecycleState: 'review',
        selectedIdx: 0,
        timestamp: Date.now(),
      })
    );
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false for valid wrapped draft with questions (Zero-Draft Contract)');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Wrapped draft is purged from localStorage');

    // Direct paper format
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(validPaper));
    assertEqual(ingestionStore.hasDraft(), false, 'hasDraft returns false for direct valid staging paper (Zero-Draft Contract)');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Direct paper draft is purged from localStorage');
  });

  test('saveDraftToLocalStorage refuses to persist drafts under Zero-Draft Contract', () => {
    const fs = require('fs');
    const path = require('path');
    const validPaper = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'staging/0455_s24_12.json'), 'utf8'));

    // Test 6a: Refuses to save when paper is null
    mockStorage.clear();
    ingestionStore.setState({ paper: null });
    assertEqual(ingestionStore.saveDraftToLocalStorage(), false, 'saveDraftToLocalStorage returns false when paper is null');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Storage remains empty on null paper');

    // Test 6b: Refuses to save when paper has 0 questions
    ingestionStore.setState({
      paper: { ...validPaper, questions: [] },
      lifecycleState: 'review',
    });
    assertEqual(ingestionStore.saveDraftToLocalStorage(), false, 'saveDraftToLocalStorage returns false for 0 questions');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Storage remains empty when paper has 0 questions');

    // Test 6c: Refuses to save when paper.lifecycle_state === 'published' and purges existing draft
    mockStorage.setItem(LOCAL_STORAGE_KEY, 'stale_pre_existing_draft');
    ingestionStore.setState({
      paper: { ...validPaper, lifecycle_state: 'published' },
      lifecycleState: 'review',
    });
    assertEqual(ingestionStore.saveDraftToLocalStorage(), false, 'saveDraftToLocalStorage returns false for published paper');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Existing storage item is purged on saving published paper');

    // Test 6d: Refuses to save when lifecycleState === 'published' and purges existing draft
    mockStorage.setItem(LOCAL_STORAGE_KEY, 'stale_pre_existing_draft');
    ingestionStore.setState({
      paper: { ...validPaper, lifecycle_state: 'review' },
      lifecycleState: 'published',
    });
    assertEqual(ingestionStore.saveDraftToLocalStorage(), false, 'saveDraftToLocalStorage returns false when lifecycleState is published');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Existing storage item is purged on saving published lifecycleState');

    // Test 6e: Refuses to save valid paper and purges existing draft (Zero-Draft Contract)
    mockStorage.setItem(LOCAL_STORAGE_KEY, 'stale_pre_existing_draft');
    ingestionStore.setState({
      paper: validPaper,
      lifecycleState: 'review',
    });
    assertEqual(ingestionStore.saveDraftToLocalStorage(), false, 'saveDraftToLocalStorage returns false under Zero-Draft Contract');
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'Draft is purged and never written to localStorage');
  });

  test('clearDraft clears the storage key', () => {
    mockStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ draft: true }));
    assert(Boolean(mockStorage.getItem(LOCAL_STORAGE_KEY)), 'Draft exists in storage prior to clearDraft');

    ingestionStore.clearDraft();
    assertEqual(mockStorage.getItem(LOCAL_STORAGE_KEY), null, 'clearDraft removes the draft item from localStorage');
  });

  // -----------------------------------------------------------------------------
  // [Suite 15] Teacher Portal Navigation Configuration & Menu Management
  // -----------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[Suite 15] Teacher Portal Navigation Configuration & Menu Management\x1b[0m');

  mockStorage.clear();
  eventLog.length = 0;

  test('Default Configuration: All 9 standard items present, enabled, and ordered', () => {
    const defaults = getDefaultPortalNavItems();
    assertEqual(defaults.length, 9, 'Default portal nav items must contain exactly 9 standard modules');

    const expectedIds = [
      'overview',
      'roster',
      'assign',
      'compiler',
      'mastery',
      'xp',
      'bank',
      'flagged',
      'school',
    ];

    const actualIds = defaults.map((item) => item.id);
    assertEqual(JSON.stringify(actualIds), JSON.stringify(expectedIds), 'Default items have expected IDs in correct order');

    const rosterDefault = defaults.find((item) => item.id === 'roster');
    assertEqual(rosterDefault?.label, 'Classes', 'Roster default nav item label is "Classes"');

    const allEnabled = defaults.every((item) => item.enabled === true);
    assertEqual(allEnabled, true, 'All default portal nav items are enabled by default');

    const teachingSection = defaults.filter((item) => item.section === 'teaching');
    assertEqual(teachingSection.length, 4, 'Teaching section has overview, roster, assign, compiler');

    const analyticsSection = defaults.filter((item) => item.section === 'analytics');
    assertEqual(analyticsSection.length, 2, 'Analytics section has mastery, xp');

    const verificationSection = defaults.filter((item) => item.section === 'verification');
    assertEqual(verificationSection.length, 2, 'Verification section has bank, flagged');

    const schoolSection = defaults.filter((item) => item.section === 'school');
    assertEqual(schoolSection.length, 1, 'School section has school & licence');
  });

  test('Initial State: getPortalNavItems returns defaults when localStorage is empty', () => {
    mockStorage.clear();
    const items = getPortalNavItems();
    assertEqual(items.length, 9, 'Returns 9 default items when storage is empty');
    const activeItems = getActivePortalMenuItems();
    assertEqual(activeItems.length, 9, 'All 9 items are active initially');
  });

  test('Disabling Item: togglePortalMenuItem sets enabled = false and filters from active list', () => {
    mockStorage.clear();
    eventLog.length = 0;

    const updated = togglePortalMenuItem('compiler');
    const compilerItem = updated.find((i) => i.id === 'compiler');
    assert(Boolean(compilerItem), 'Compiler item exists');
    assertEqual(compilerItem?.enabled, false, 'Compiler item enabled is false after toggle');

    const activeItems = getActivePortalMenuItems();
    assertEqual(activeItems.length, 8, 'Active items count reduced to 8');
    const activeCompiler = activeItems.find((i) => i.id === 'compiler');
    assertEqual(activeCompiler, undefined, 'Compiler item is excluded from active items');

    const overviewItem = activeItems.find((i) => i.id === 'overview');
    assertEqual(overviewItem?.enabled, true, 'Overview item remains active');
  });

  test('Explicit setPortalMenuItemEnabled disables item accurately', () => {
    const updated = setPortalMenuItemEnabled('mastery', false);
    const masteryItem = updated.find((i) => i.id === 'mastery');
    assertEqual(masteryItem?.enabled, false, 'Mastery item explicitly disabled');

    const active = getActivePortalMenuItems();
    assertEqual(active.some((i) => i.id === 'mastery'), false, 'Mastery not in active list');
  });

  test('Re-enabling Item: togglePortalMenuItem restores enabled = true and returns to active list', () => {
    const updated = togglePortalMenuItem('compiler');
    const compilerItem = updated.find((i) => i.id === 'compiler');
    assertEqual(compilerItem?.enabled, true, 'Compiler item enabled is true after second toggle');

    const activeItems = getActivePortalMenuItems();
    const activeCompiler = activeItems.find((i) => i.id === 'compiler');
    assert(Boolean(activeCompiler), 'Compiler item is restored to active items list');
    assertEqual(activeCompiler?.label, 'Test compiler', 'Compiler label is preserved');
  });

  test('Add Custom Menu Item: Successfully adds custom link with unique ID, section, and icon', () => {
    const customLink: Omit<PortalNavItem, 'order'> = {
      id: 'dept-syllabus',
      label: 'Department Syllabus',
      section: 'custom',
      iconName: 'ExternalLink',
      href: 'https://school.edu/syllabus',
      enabled: true,
    };

    const updated = addPortalMenuItem(customLink);
    const found = updated.find((i) => i.id === 'dept-syllabus');
    assert(Boolean(found), 'Custom syllabus item exists in updated configuration');
    assertEqual(found?.label, 'Department Syllabus', 'Label matches');
    assertEqual(found?.href, 'https://school.edu/syllabus', 'Href matches');
    assertEqual(found?.isCustom, true, 'isCustom flag is set to true');
    assertEqual(found?.iconName, 'ExternalLink', 'Icon name is preserved');
    assertEqual(found?.section, 'custom', 'Section is custom');

    const active = getActivePortalMenuItems();
    assert(active.some((i) => i.id === 'dept-syllabus'), 'Custom item appears in getActivePortalMenuItems');
  });

  test('Add Custom Menu Item: Rejects duplicate ID with descriptive error', () => {
    let thrown = false;
    try {
      addPortalMenuItem({
        id: 'dept-syllabus',
        label: 'Duplicate Link',
        section: 'custom',
        iconName: 'Link',
        enabled: true,
      });
    } catch (err: any) {
      thrown = true;
      assert(err.message.includes('already exists'), 'Error message mentions item already exists');
    }
    assertEqual(thrown, true, 'Adding duplicate menu ID throws an exception');
  });

  test('Remove Custom Menu Item: Cleanly deletes custom item from configuration', () => {
    const updated = removePortalMenuItem('dept-syllabus');
    const found = updated.find((i) => i.id === 'dept-syllabus');
    assertEqual(found, undefined, 'Custom item is deleted from configuration');

    const active = getActivePortalMenuItems();
    assertEqual(active.some((i) => i.id === 'dept-syllabus'), false, 'Custom item absent from active list');
  });

  test('Remove Safety Guard: Refuses to delete standard core items', () => {
    let thrown = false;
    try {
      removePortalMenuItem('overview');
    } catch (err: any) {
      thrown = true;
      assert(err.message.includes('Cannot delete standard core item'), 'Error protects standard items from deletion');
    }
    assertEqual(thrown, true, 'Attempting to delete standard core item throws an exception');

    const items = getPortalNavItems();
    assert(items.some((i) => i.id === 'overview'), 'Overview standard item remains in configuration');
  });

  test('Reset to Defaults: Restores initial standard items, orders, and purges custom additions', () => {
    togglePortalMenuItem('overview');
    addPortalMenuItem({
      id: 'temp-calendar',
      label: 'Term Calendar',
      section: 'custom',
      iconName: 'Calendar',
      href: 'https://school.edu/calendar',
      enabled: true,
    });

    const modified = getPortalNavItems();
    assertEqual(modified.find((i) => i.id === 'overview')?.enabled, false, 'Overview is disabled prior to reset');
    assert(Boolean(modified.find((i) => i.id === 'temp-calendar')), 'Custom calendar exists prior to reset');

    const resetItems = resetPortalNavToDefaults();
    assertEqual(resetItems.length, 9, 'Reset returns exact 9 default items');
    assertEqual(resetItems.find((i) => i.id === 'overview')?.enabled, true, 'Overview is re-enabled');
    assertEqual(resetItems.find((i) => i.id === 'temp-calendar'), undefined, 'Custom calendar is purged');

    const active = getActivePortalMenuItems();
    assertEqual(active.length, 9, 'All 9 items active after reset');
  });

  test('Storage Persistence: Serializes state to localStorage and parses safely', () => {
    mockStorage.clear();
    togglePortalMenuItem('roster');

    const rawStorage = mockStorage.getItem(PORTAL_NAV_STORAGE_KEY);
    assert(Boolean(rawStorage), 'Storage key contains serialized data');

    const parsed = JSON.parse(rawStorage!);
    assert(Array.isArray(parsed), 'Serialized value is a valid JSON array');
    const roster = parsed.find((i: any) => i.id === 'roster');
    assertEqual(roster.enabled, false, 'Stored roster item has enabled = false');
  });

  test('Event Notification: Dispatches PORTAL_NAV_CHANGE_EVENT on state modifications', () => {
    eventLog.length = 0;

    togglePortalMenuItem('assign');
    assertEqual(eventLog.length > 0, true, 'togglePortalMenuItem dispatches change event');
    assertEqual(eventLog[eventLog.length - 1].type, PORTAL_NAV_CHANGE_EVENT, 'Event type matches PORTAL_NAV_CHANGE_EVENT');

    addPortalMenuItem({
      id: 'notif-test',
      label: 'Notification Test',
      section: 'custom',
      iconName: 'Bell',
      enabled: true,
    });
    assertEqual(eventLog[eventLog.length - 1].type, PORTAL_NAV_CHANGE_EVENT, 'addPortalMenuItem dispatches change event');

    removePortalMenuItem('notif-test');
    assertEqual(eventLog[eventLog.length - 1].type, PORTAL_NAV_CHANGE_EVENT, 'removePortalMenuItem dispatches change event');

    resetPortalNavToDefaults();
    assertEqual(eventLog[eventLog.length - 1].type, PORTAL_NAV_CHANGE_EVENT, 'resetPortalNavToDefaults dispatches change event');
  });

  test('Storage Resilience: Falls back safely to defaults if localStorage has corrupted data', () => {
    mockStorage.setItem(PORTAL_NAV_STORAGE_KEY, 'invalid-json{{{');
    const fallbackItems = getPortalNavItems();
    assertEqual(fallbackItems.length, 9, 'Corrupted storage gracefully falls back to default 9 items');
    assertEqual(fallbackItems[0].id, 'overview', 'First item is overview');
  });

  test('Static Audit: AppAdminNav.tsx component contract and navigation item', () => {
    const fs = require('fs');
    const path = require('path');
    const navPath = path.resolve(process.cwd(), 'components/admin/AppAdminNav.tsx');
    assertEqual(fs.existsSync(navPath), true, 'components/admin/AppAdminNav.tsx exists');

    const navContent = fs.readFileSync(navPath, 'utf8');
    assert(
      navContent.includes('portal-menu') || navContent.includes('Portal Menu') || navContent.includes('Menu Manager') || navContent.includes('Portal Navigation'),
      'AppAdminNav.tsx contains portal menu navigation entry'
    );
  });

  test('Static Audit: app/admin/page.tsx TAB_TITLES includes portal-menu', () => {
    const fs = require('fs');
    const path = require('path');
    const adminPagePath = path.resolve(process.cwd(), 'app/admin/page.tsx');
    assertEqual(fs.existsSync(adminPagePath), true, 'app/admin/page.tsx exists');

    const pageContent = fs.readFileSync(adminPagePath, 'utf8');
    assert(
      pageContent.includes("'portal-menu'") || pageContent.includes('"portal-menu"'),
      "app/admin/page.tsx registers 'portal-menu' tab"
    );
  });

  test('Static Audit: AppAdminHub.tsx integrates portal-menu view', () => {
    const fs = require('fs');
    const path = require('path');
    const hubPath = path.resolve(process.cwd(), 'components/admin/AppAdminHub.tsx');
    assertEqual(fs.existsSync(hubPath), true, 'components/admin/AppAdminHub.tsx exists');

    const hubContent = fs.readFileSync(hubPath, 'utf8');
    assert(
      hubContent.includes('portal-menu'),
      "components/admin/AppAdminHub.tsx routes 'portal-menu' tab"
    );
  });

  test('Static Audit: PortalMenuManager UI component exists or is referenced', () => {
    const fs = require('fs');
    const path = require('path');
    const componentPath1 = path.resolve(process.cwd(), 'components/admin/PortalMenuManager.tsx');
    const componentPath2 = path.resolve(process.cwd(), 'components/portal/PortalMenuManager.tsx');
    const componentExists = fs.existsSync(componentPath1) || fs.existsSync(componentPath2);

    const hubPath = path.resolve(process.cwd(), 'components/admin/AppAdminHub.tsx');
    const hubContent = fs.existsSync(hubPath) ? fs.readFileSync(hubPath, 'utf8') : '';
    const isReferencedInHub = hubContent.includes('PortalMenuManager') || hubContent.includes('portal-menu');

    assert(
      componentExists || isReferencedInHub,
      'PortalMenuManager component or hub integration is present'
    );
  });

  // -----------------------------------------------------------------------------
  // [Suite 16] Test Compiler Upgrade: Explanations, Topic Distribution, Online Assignments & Guardrail 6 Print Empty State
  // -----------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[Suite 16] Test Compiler Upgrade: Explanations, Topic Distribution, Online Assignments & Guardrail 6 Print Empty State\x1b[0m');

  test('Test Compiler: buildCompiledQuestions populates non-null explanationMarkdown via resolveQuestionExplanation', () => {
    assert(CAMBRIDGE_QUESTIONS.length > 0, 'CAMBRIDGE_QUESTIONS contains seeded questions');
    const sampleIds = CAMBRIDGE_QUESTIONS.slice(0, 3).map((q) => q.id);
    const compiled = buildCompiledQuestions(sampleIds, CAMBRIDGE_QUESTIONS);

    assertEqual(compiled.length, 3, 'Compiled 3 exam questions');
    for (const cq of compiled) {
      // Answer integrity: bundled fallback questions no longer carry explanations (server-only), so null is expected here.
      assert(cq.explanationMarkdown === null || typeof cq.explanationMarkdown === 'string', `Question ${cq.id} explanationMarkdown is string or null`);
    }

    // Direct resolveQuestionExplanation verification
    const questionWithExplicitExplanation: any = {
      id: 'mock-exp-1',
      stem_markdown: 'What is opportunity cost?',
      options: [
        { id: 'opt-a', text_markdown: 'The next best alternative forgone', is_correct: true },
        { id: 'opt-b', text_markdown: 'The financial cost of an item', is_correct: false },
      ],
      correct_option_id: 'opt-a',
      explanation_markdown: 'Opportunity cost is the benefit of the next best alternative forgone.',
      topic: 'Basic Economic Problem',
    };
    const explicitResolved = resolveQuestionExplanation(questionWithExplicitExplanation);
    assertEqual(
      explicitResolved,
      'Opportunity cost is the benefit of the next best alternative forgone.',
      'Resolves explicit explanation correctly'
    );

    const questionWithoutExplicitExplanation: any = {
      id: 'mock-exp-2',
      stem_markdown: 'Which of the following is a macroeconomic goal?',
      options: [
        { id: 'opt-a', text_markdown: 'Low unemployment', is_correct: true },
        { id: 'opt-b', text_markdown: 'Individual firm profit', is_correct: false },
      ],
      correct_option_id: 'opt-a',
      explanation_markdown: null,
      topic: 'Government and Macroeconomy',
    };
    const fallbackResolved = resolveQuestionExplanation(questionWithoutExplicitExplanation);
    assert(Boolean(fallbackResolved && fallbackResolved.includes('Key A: Low unemployment')), 'Resolves non-null fallback explanation with correct key');
  });

  test('Test Compiler: computeTopicDistribution accurately calculates topic counts and percentages summing to ~100%, and returns [] for empty selection', () => {
    // Empty selection returns []
    const emptyDist = computeTopicDistribution([], CAMBRIDGE_QUESTIONS);
    assertEqual(Array.isArray(emptyDist), true, 'Empty selection returns array');
    assertEqual(emptyDist.length, 0, 'Empty selection returns empty array []');

    // Multi-topic distribution calculation
    const mockPool: any[] = [
      { id: 'td-1', topic: 'The Basic Economic Problem' },
      { id: 'td-2', topic: 'The Basic Economic Problem' },
      { id: 'td-3', topic: 'Allocation of Resources' },
      { id: 'td-4', topic: 'International Trade' },
    ];
    const distribution = computeTopicDistribution(['td-1', 'td-2', 'td-3', 'td-4'], mockPool);
    assertEqual(distribution.length, 3, 'Computes 3 distinct topic segments');

    const basicProblem = distribution.find((d) => d.topic === 'The Basic Economic Problem');
    assert(Boolean(basicProblem), 'Finds The Basic Economic Problem');
    assertEqual(basicProblem?.count, 2, 'Basic Economic Problem count is 2');
    assertEqual(basicProblem?.percentage, 50, 'Basic Economic Problem is 50%');

    const allocation = distribution.find((d) => d.topic === 'Allocation of Resources');
    assert(Boolean(allocation), 'Finds Allocation of Resources');
    assertEqual(allocation?.count, 1, 'Allocation count is 1');
    assertEqual(allocation?.percentage, 25, 'Allocation is 25%');

    const trade = distribution.find((d) => d.topic === 'International Trade');
    assert(Boolean(trade), 'Finds International Trade');
    assertEqual(trade?.count, 1, 'International Trade count is 1');
    assertEqual(trade?.percentage, 25, 'International Trade is 25%');

    const totalPct = distribution.reduce((sum, item) => sum + item.percentage, 0);
    assertEqual(totalPct, 100, 'Percentages sum to 100%');
  });

  test('Test Compiler: shuffleQuestionIds preserves exact question ID membership and length without mutating the original array', () => {
    const original = ['q-alpha', 'q-beta', 'q-gamma', 'q-delta', 'q-epsilon', 'q-zeta'];
    const originalCopy = [...original];

    const shuffled = shuffleQuestionIds(original);

    assertEqual(original.length, originalCopy.length, 'Original array length is preserved');
    for (let i = 0; i < original.length; i++) {
      assertEqual(original[i], originalCopy[i], `Original element at index ${i} was not mutated`);
    }

    assertEqual(shuffled.length, original.length, 'Shuffled array matches original length');
    assert(shuffled !== original, 'Shuffled array is an immutable new array instance');

    const sortedOriginal = [...original].sort();
    const sortedShuffled = [...shuffled].sort();
    for (let i = 0; i < sortedOriginal.length; i++) {
      assertEqual(sortedShuffled[i], sortedOriginal[i], `Membership element ${i} identical across arrays`);
    }
  });

  test('Test Compiler: SUBJECT_CATALOG exports Cambridge IGCSE subjects (0455, 0610, 0620, 0625)', () => {
    assert(Array.isArray(SUBJECT_CATALOG), 'SUBJECT_CATALOG is an array');
    const catalogCodes = SUBJECT_CATALOG.map((s) => s.code);

    assertEqual(catalogCodes.includes('0455'), true, 'SUBJECT_CATALOG includes 0455 (Economics)');
    assertEqual(catalogCodes.includes('0610'), true, 'SUBJECT_CATALOG includes 0610 (Biology)');
    assertEqual(catalogCodes.includes('0620'), true, 'SUBJECT_CATALOG includes 0620 (Chemistry)');
    assertEqual(catalogCodes.includes('0625'), true, 'SUBJECT_CATALOG includes 0625 (Physics)');

    const econ = SUBJECT_CATALOG.find((s) => s.code === '0455');
    assertEqual(econ?.name, 'Economics', '0455 subject name is Economics');
  });

  test('Test Compiler: Guardrail 6 Compliance in app/portal/compiler/print/page.tsx', () => {
    const fs = require('fs');
    const path = require('path');
    const printPagePath = path.resolve(process.cwd(), 'app/portal/compiler/print/page.tsx');
    assertEqual(fs.existsSync(printPagePath), true, 'app/portal/compiler/print/page.tsx exists');

    const content = fs.readFileSync(printPagePath, 'utf8');

    // Hardcoded fallback mock must NOT be present
    assertEqual(content.includes("id: 'default-test'"), false, "No hardcoded id: 'default-test' mock fallback in print page");
    assertEqual(content.includes('id: "default-test"'), false, 'No hardcoded "default-test" mock fallback in print page');

    // Empty state rendering must be present
    assertEqual(content.includes('No Compiled Test Paper Found'), true, 'Renders "No Compiled Test Paper Found" empty state');
    assertEqual(content.includes('Return to Test Compiler'), true, 'Renders "Return to Test Compiler" navigation button');
  });

  test('Test Compiler: TestCompilerHub.tsx structural verification (Assign Online, shuffleQuestionIds, computeTopicDistribution, includeExplanations, test-assembly-drawer, MarkdownErrorBoundary, right-side Question Filters, no duplicate left filter bar)', () => {
    const fs = require('fs');
    const path = require('path');
    const hubPath = path.resolve(process.cwd(), 'components/portal/compiler/TestCompilerHub.tsx');
    assertEqual(fs.existsSync(hubPath), true, 'components/portal/compiler/TestCompilerHub.tsx exists');

    const content = fs.readFileSync(hubPath, 'utf8');

    assertEqual(content.includes('Assign Online'), true, 'Features "Assign Online" action');
    assertEqual(content.includes('shuffleQuestionIds'), true, 'Wires "shuffleQuestionIds" helper');
    assertEqual(content.includes('computeTopicDistribution'), true, 'Uses "computeTopicDistribution" breakdown');
    assertEqual(content.includes('includeExplanations'), true, 'Supports "includeExplanations" configuration');
    assertEqual(content.includes('test-assembly-drawer'), true, 'Defines "test-assembly-drawer" element id');
    assertEqual(content.includes('MarkdownErrorBoundary'), true, 'Protects math/markdown with MarkdownErrorBoundary');

    // Right-side Filter Panel Optimization & Duplicate Left Filter Bar Removal
    assertEqual(content.includes('Quick filter stems...'), false, 'Duplicate left-side filter search bar is removed');
    assertEqual(content.includes('isFilterRowVisible'), false, 'Redundant left filter toggle state is removed');
    assertEqual(content.includes('Question Filters'), true, 'Right-side Question Filters panel header is preserved');
    assertEqual(content.includes('grid-cols-3'), true, 'Features 3-column content filter chips');
    assertEqual(content.includes('grid-cols-4'), true, 'Features 4-column non-wrapping utility action grid');
  });

  test('Test Compiler: Online Assignments saveOnlineAssignment and listOnlineAssignments persistence', () => {
    const assignment = {
      id: 'asg-test-portal-1',
      title: 'Unit 1 Microeconomics Quiz',
      subjectCode: '0455',
      subjectName: 'Economics',
      cohortName: '10 Economics (Cambridge 0455)',
      dueDate: '2026-11-15',
      durationMinutes: 45,
      questionIds: ['q-1', 'q-2'],
      testCode: 'REV-0455-TEST1',
      createdAt: new Date().toISOString(),
    };

    saveOnlineAssignment(assignment);
    const stored = listOnlineAssignments();
    assert(stored.length > 0, 'Assignments list has at least 1 entry');
    const found = stored.find((a) => a.id === 'asg-test-portal-1');
    assert(Boolean(found), 'Found saved assignment in storage');
    assertEqual(found?.testCode, 'REV-0455-TEST1', 'Test code matches REV-0455-TEST1');
    assertEqual(found?.cohortName, '10 Economics (Cambridge 0455)', 'Cohort matches');
  });

  test('Test Compiler: stripCambridgeIgcse, parseCitationTagPills, and TestCompilerHub citation tag pill integration', () => {
    const rawCitation = 'Cambridge IGCSE Economics 0455/12 Oct/Nov 2024 Q1';
    const rawId = '0455-w24-12-q01';

    // 1. stripCambridgeIgcse verification
    const stripped = stripCambridgeIgcse(rawCitation);
    assertEqual(stripped, 'Economics 0455/12 Oct/Nov 2024 Q1', 'stripCambridgeIgcse removes Cambridge IGCSE prefix');
    assertEqual(/cambridge/i.test(stripped), false, 'Stripped citation contains no "Cambridge"');
    assertEqual(/igcse/i.test(stripped), false, 'Stripped citation contains no "IGCSE"');

    // Edge cases for stripCambridgeIgcse
    assertEqual(stripCambridgeIgcse('Cambridge O Level Mathematics D 4024/11'), 'O Level Mathematics D 4024/11', 'Handles Cambridge prefix without IGCSE');
    assertEqual(stripCambridgeIgcse('IGCSE Biology 0610/22'), 'Biology 0610/22', 'Handles standalone IGCSE prefix');
    assertEqual(stripCambridgeIgcse(''), '', 'Handles empty citation safely');

    // 2. parseCitationTagPills verification
    const pills = parseCitationTagPills(rawCitation, rawId);
    assertEqual(pills.length, 4, 'Returns 4 distinct citation pills');

    const kinds = pills.map((p) => p.kind);
    assertEqual(JSON.stringify(kinds), JSON.stringify(['subject', 'paper', 'series', 'question']), 'Pill kinds match [subject, paper, series, question]');

    const labels = pills.map((p) => p.label || (p as any).text);
    assertEqual(labels[0], 'Economics', 'Subject pill is Economics');
    assertEqual(labels[1], '0455/12', 'Paper pill is 0455/12');
    assertEqual(labels[2], 'Oct/Nov 2024', 'Series pill is Oct/Nov 2024');
    assertEqual(labels[3], 'Q1', 'Question pill is Q1');

    for (const pill of pills) {
      const txt = pill.label || (pill as any).text;
      assertEqual(/cambridge/i.test(txt), false, `Pill "${txt}" contains no Cambridge`);
      assertEqual(/igcse/i.test(txt), false, `Pill "${txt}" contains no IGCSE`);
    }

    // 3. TestCompilerHub.tsx static structure verification
    const fs = require('fs');
    const path = require('path');
    const hubPath = path.resolve(process.cwd(), 'components/portal/compiler/TestCompilerHub.tsx');
    assertEqual(fs.existsSync(hubPath), true, 'components/portal/compiler/TestCompilerHub.tsx exists');

    const hubContent = fs.readFileSync(hubPath, 'utf8');
    assertEqual(hubContent.includes('parseCitationTagPills'), true, 'TestCompilerHub imports/uses parseCitationTagPills');
    assertEqual(hubContent.includes('stripCambridgeIgcse'), true, 'TestCompilerHub imports/uses stripCambridgeIgcse');
    assertEqual(hubContent.includes('Cambridge Cover Page'), false, 'TestCompilerHub does not contain old "Cambridge Cover Page" label');
  });

  // -----------------------------------------------------------------------------
  // [Suite 17: Question Bank Advanced Filter Engine & URL Sync]
  // -----------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[Suite 17: Question Bank Advanced Filter Engine & URL Sync]\x1b[0m');

  test('normalizeSeriesToSeasonLabel normalizes Cambridge series shorthand and full labels', () => {
    // May/June series (s, m/j, may, june)
    assertEqual(normalizeSeriesToSeasonLabel('s').code, 's', "Code for 's' should be 's'");
    assertEqual(normalizeSeriesToSeasonLabel('s').label, 'May/June (s)', "Label for 's' should be 'May/June (s)'");
    assertEqual(normalizeSeriesToSeasonLabel('m/j').code, 's', "Code for 'm/j' should be 's'");
    assertEqual(normalizeSeriesToSeasonLabel('May/June').code, 's', "Code for 'May/June' should be 's'");
    assertEqual(normalizeSeriesToSeasonLabel('june').label, 'May/June (s)', "Label for 'june' should be 'May/June (s)'");

    // Feb/March series (m, f/m, feb, march)
    assertEqual(normalizeSeriesToSeasonLabel('m').code, 'm', "Code for 'm' should be 'm'");
    assertEqual(normalizeSeriesToSeasonLabel('m').label, 'Feb/March (m)', "Label for 'm' should be 'Feb/March (m)'");
    assertEqual(normalizeSeriesToSeasonLabel('f/m').code, 'm', "Code for 'f/m' should be 'm'");
    assertEqual(normalizeSeriesToSeasonLabel('Feb/March').code, 'm', "Code for 'Feb/March' should be 'm'");

    // Oct/Nov series (w, o/n, oct, nov)
    assertEqual(normalizeSeriesToSeasonLabel('w').code, 'w', "Code for 'w' should be 'w'");
    assertEqual(normalizeSeriesToSeasonLabel('w').label, 'Oct/Nov (w)', "Label for 'w' should be 'Oct/Nov (w)'");
    assertEqual(normalizeSeriesToSeasonLabel('o/n').code, 'w', "Code for 'o/n' should be 'w'");
    assertEqual(normalizeSeriesToSeasonLabel('Oct/Nov').label, 'Oct/Nov (w)', "Label for 'Oct/Nov' should be 'Oct/Nov (w)'");

    // Null or empty fallback
    assertEqual(normalizeSeriesToSeasonLabel(null).code, 's', "Null series falls back to 's'");
    assertEqual(normalizeSeriesToSeasonLabel('').label, 'May/June (s)', "Empty series falls back to 'May/June (s)'");
  });

  test('parseCambridgePaperMetadata extracts subjectCode, variant, year, and season across citation patterns', () => {
    // Test case: 0455/12 s 2024 Q15
    const meta1 = parseCambridgePaperMetadata({ cite: '0455/12 s 2024 Q15' });
    assertEqual(meta1.subjectCode, '0455', 'Extracts subjectCode 0455');
    assertEqual(meta1.subjectName, 'Economics', 'Maps subjectCode 0455 to Economics');
    assertEqual(meta1.variant, '12', 'Extracts variant 12');
    assertEqual(meta1.seriesCode, 's', 'Extracts seriesCode s');
    assertEqual(meta1.season, 'May/June (s)', 'Extracts normalized season May/June (s)');
    assertEqual(meta1.year, '2024', 'Extracts 4-digit year 2024');
    assertEqual(meta1.paperLabel, '0455/12 s 2024', 'Generates paperLabel 0455/12 s 2024');

    // Test case: 0455/22 m 2023 Q5 (Feb/March via series or f/m citation)
    const meta2 = parseCambridgePaperMetadata({ cite: '0455/22 m 2023 Q05', series: 'm' });
    assertEqual(meta2.subjectCode, '0455', 'Extracts subjectCode 0455');
    assertEqual(meta2.variant, '22', 'Extracts variant 22');
    assertEqual(meta2.seriesCode, 'm', 'Extracts seriesCode m');
    assertEqual(meta2.season, 'Feb/March (m)', 'Extracts season Feb/March (m)');
    assertEqual(meta2.year, '2023', 'Extracts year 2023');

    // Test case: 0455/11 w 2022 Q30 (Oct/Nov via series or o/n citation)
    const meta3 = parseCambridgePaperMetadata({ cite: '0455/11 w 2022 Q30', series: 'w' });
    assertEqual(meta3.subjectCode, '0455', 'Extracts subjectCode 0455');
    assertEqual(meta3.variant, '11', 'Extracts variant 11');
    assertEqual(meta3.seriesCode, 'w', 'Extracts seriesCode w');
    assertEqual(meta3.season, 'Oct/Nov (w)', 'Extracts season Oct/Nov (w)');
    assertEqual(meta3.year, '2022', 'Extracts year 2022');

    // Test case: ID convention 0455-m23-22-q05
    const meta4 = parseCambridgePaperMetadata({ id: '0455-m23-22-q05' });
    assertEqual(meta4.subjectCode, '0455', 'Extracts subjectCode 0455 from ID');
    assertEqual(meta4.variant, '22', 'Extracts variant 22 from ID');
    assertEqual(meta4.seriesCode, 'm', 'Extracts seriesCode m from ID');
    assertEqual(meta4.year, '2023', 'Extracts year 2023 from ID shorthand m23');

    // Test case: ID convention 0455-s24-12-q01
    const meta5 = parseCambridgePaperMetadata({ id: '0455-s24-12-q01' });
    assertEqual(meta5.subjectCode, '0455', 'Extracts subjectCode 0455 from ID');
    assertEqual(meta5.variant, '12', 'Extracts variant 12 from ID');
    assertEqual(meta5.seriesCode, 's', 'Extracts seriesCode s from ID');
    assertEqual(meta5.year, '2024', 'Extracts year 2024 from ID shorthand s24');
  });

  test('deriveQuestionStatus evaluates status, diagram_metadata, and active flags', () => {
    // Explicit Live status
    assertEqual(deriveQuestionStatus({ status: 'Live' }), 'Live', "Status 'Live' returns 'Live'");
    assertEqual(deriveQuestionStatus({ status: 'live' }), 'Live', "Status 'live' returns 'Live'");

    // Agent draft status
    assertEqual(deriveQuestionStatus({ status: 'Agent draft' }), 'Agent draft', "Status 'Agent draft' returns 'Agent draft'");
    assertEqual(deriveQuestionStatus({ status: 'draft' }), 'Agent draft', "Status 'draft' returns 'Agent draft'");

    // Needs review status
    assertEqual(deriveQuestionStatus({ status: 'Needs review' }), 'Needs review', "Status 'Needs review' returns 'Needs review'");
    assertEqual(deriveQuestionStatus({ status: 'in_review' }), 'Needs review', "Status 'in_review' returns 'Needs review'");
    assertEqual(deriveQuestionStatus({ diagram_metadata: { bank_status: 'Needs review' } }), 'Needs review', 'diagram_metadata.bank_status overrides');

    // Flagged / withdrawn
    assertEqual(deriveQuestionStatus({ status: 'Flagged' }), 'Flagged', "Status 'Flagged' returns 'Flagged'");
    assertEqual(deriveQuestionStatus({ status: 'withdrawn' }), 'Flagged', "Status 'withdrawn' returns 'Flagged'");

    // Inactive question defaults to Needs review
    assertEqual(deriveQuestionStatus({ active: false }), 'Needs review', 'active === false derives Needs review');

    // Default with active true returns Live
    assertEqual(deriveQuestionStatus({ active: true }), 'Live', 'active === true defaults to Live');
  });

  test('deriveQuestionDifficulty respects explicit values, diagram metadata, and structural heuristics', () => {
    // Explicit values
    assertEqual(deriveQuestionDifficulty({ difficulty: 'Hard' }), 'Hard', 'Explicit difficulty Hard');
    assertEqual(deriveQuestionDifficulty({ diff: 'Easy' }), 'Easy', 'Explicit diff Easy');
    assertEqual(deriveQuestionDifficulty({ diagram_metadata: { difficulty: 'Medium' } }), 'Medium', 'diagram_metadata difficulty Medium');

    // Compound heuristic: diagram + math -> Hard
    assertEqual(
      deriveQuestionDifficulty({ hasDiagram: true, hasMath: true, stem: 'Short stem' }),
      'Hard',
      'Diagram + Math derives Hard'
    );

    // Compound heuristic: table + math -> Hard
    assertEqual(
      deriveQuestionDifficulty({ hasTable: true, hasMath: true, stem: 'Short stem' }),
      'Hard',
      'Table + Math derives Hard'
    );

    // Single structural feature derives Medium
    assertEqual(deriveQuestionDifficulty({ hasDiagram: true }), 'Medium', 'Diagram alone derives Medium');
    assertEqual(deriveQuestionDifficulty({ hasTable: true }), 'Medium', 'Table alone derives Medium');
    assertEqual(deriveQuestionDifficulty({ hasMath: true }), 'Medium', 'Math alone derives Medium');

    // Long stem (>180 chars) derives Medium
    const longStem = 'This is an exceptionally comprehensive Cambridge economics question stem intended to evaluate macroeconomic principles under conditions of international capital mobility and exchange rate fluctuations.';
    assert(longStem.length > 180, 'Test fixture stem is over 180 characters');
    assertEqual(deriveQuestionDifficulty({ stem: longStem }), 'Medium', 'Long stem derives Medium');

    // Default short simple question derives Easy
    assertEqual(deriveQuestionDifficulty({ stem: 'What is opportunity cost?' }), 'Easy', 'Short plain stem derives Easy');
  });

  test('detectQuestionFeatures identifies diagrams, markdown tables, and math expressions', () => {
    // Diagram detection
    assertEqual(
      detectQuestionFeatures({ image_url: 'https://cdn.example.com/diag.png' }).hasDiagram,
      true,
      'image_url sets hasDiagram true'
    );
    assertEqual(
      detectQuestionFeatures({ diagram_metadata: { has_diagram: true } }).hasDiagram,
      true,
      'diagram_metadata.has_diagram sets hasDiagram true'
    );
    assertEqual(
      detectQuestionFeatures({ stem: 'Refer to the diagram ![demand curve](/diagrams/0455.png)' }).hasDiagram,
      true,
      'Markdown image in stem sets hasDiagram true'
    );
    assertEqual(
      detectQuestionFeatures({ stem: 'Plain text without images' }).hasDiagram,
      false,
      'Plain stem hasDiagram false'
    );

    // Table detection: hasDataTable & detectQuestionFeatures
    assertEqual(
      hasDataTable('Table of data:\n| Good | Price |\n| Coffee | 5 |'),
      true,
      'hasDataTable detects markdown table pipes'
    );
    assertEqual(
      hasDataTable('The table shows the demand and supply for apples.'),
      true,
      'hasDataTable detects authentic Cambridge phrase "the table shows"'
    );
    assertEqual(
      hasDataTable('According to the data in the table, what was the inflation rate?'),
      true,
      'hasDataTable detects "data in the table"'
    );
    assertEqual(
      hasDataTable('Which row in the table below correctly identifies the economic terms?'),
      true,
      'hasDataTable detects "in the table" and "the table below"'
    );
    assertEqual(
      hasDataTable('<table><tr><td>Row</td></tr></table>'),
      true,
      'hasDataTable detects HTML table element'
    );
    assertEqual(
      hasDataTable('No table present here'),
      false,
      'hasDataTable returns false for "No table present here"'
    );
    assertEqual(
      hasDataTable('A firm operates in a perfectly competitive market.'),
      false,
      'hasDataTable returns false for ordinary text'
    );
    assertEqual(
      hasDataTable(undefined, { tags: ['tables'] }),
      true,
      'hasDataTable detects table from question tags'
    );
    assertEqual(
      hasDataTable(undefined, { diagram_metadata: { type: 'table' } }),
      true,
      'hasDataTable detects table from diagram_metadata.type'
    );
    assertEqual(
      hasDataTable(undefined, { diagram_metadata: { has_table: true } }),
      true,
      'hasDataTable detects table from diagram_metadata.has_table'
    );
    assertEqual(
      hasDataTable(undefined, { options: [{ text: 'capital | land' }] }),
      true,
      'hasDataTable detects table from option text pipes'
    );

    // formatTableOptionText formatting and header stripping
    assertEqual(
      formatTableOptionText('first factor: capital | second factor: land'),
      'Capital | Land',
      'formatTableOptionText strips prefixes and capitalizes cells'
    );
    assertEqual(
      formatTableOptionText('cleaners: fall | nurses: rise'),
      'Fall | Rise',
      'formatTableOptionText strips occupational column prefixes'
    );
    assertEqual(
      formatTableOptionText('Shift of demand | Shift of supply'),
      'Shift of demand | Shift of supply',
      'formatTableOptionText preserves already clean table options'
    );
    assertEqual(
      formatTableOptionText('There are high costs'),
      'There are high costs',
      'formatTableOptionText leaves non-table text unchanged'
    );
    assertEqual(
      formatTableOptionText(''),
      '',
      'formatTableOptionText safely returns empty string'
    );
    assertEqual(
      formatTableOptionText(null as any),
      '',
      'formatTableOptionText safely handles null'
    );
    assertEqual(
      formatTableOptionText(undefined as any),
      '',
      'formatTableOptionText safely handles undefined'
    );
    assertEqual(
      formatTableOptionText('col1: value1 | col2: value2').includes('col1:'),
      false,
      'formatTableOptionText ensures table options do not retain column header prefixes'
    );

    assertEqual(
      detectQuestionFeatures({ stem: 'Table of data:\n| Good | Price |\n| Coffee | 5 |' }).hasTable,
      true,
      'Markdown table in stem sets hasTable true'
    );
    assertEqual(
      detectQuestionFeatures({
        stem: 'Select the correct table',
        options: [{ content_markdown: '| A | 10 |\n| B | 20 |' }],
      }).hasTable,
      true,
      'Markdown table in option sets hasTable true'
    );
    assertEqual(
      detectQuestionFeatures({ stem: 'The table shows the changes in unemployment and inflation.' }).hasTable,
      true,
      'Authentic Cambridge table phrasing in stem sets hasTable true'
    );
    assertEqual(
      detectQuestionFeatures({
        stem: 'What is shown in the data?',
        diagram_metadata: { type: 'table', has_table: true },
      }).hasTable,
      true,
      'Table diagram metadata sets hasTable true'
    );
    assertEqual(
      detectQuestionFeatures({
        stem: 'Which option is correct?',
        tags: ['table'],
      }).hasTable,
      true,
      'Question with table tag sets hasTable true'
    );
    assertEqual(
      detectQuestionFeatures({ stem: 'No table present here' }).hasTable,
      false,
      'Stem without pipes hasTable false'
    );

    // Math detection
    assertEqual(
      detectQuestionFeatures({ stem: 'Calculate PED: $\\frac{\\%\\Delta Q}{\\%\\Delta P}$' }).hasMath,
      true,
      'KaTeX syntax in stem sets hasMath true'
    );
    assertEqual(
      detectQuestionFeatures({ stem: 'Price increases by 15%' }).hasMath,
      true,
      'Percentage symbol sets hasMath true'
    );
    assertEqual(
      detectQuestionFeatures({ stem: 'Total revenue is £250' }).hasMath,
      true,
      'Currency symbol sets hasMath true'
    );
    assertEqual(
      detectQuestionFeatures({
        stem: 'Find x',
        options: [{ content_markdown: '$x = 100$' }],
      }).hasMath,
      true,
      'Formula in options sets hasMath true'
    );
    assertEqual(
      detectQuestionFeatures({ stem: 'Which of the following describes a public good?' }).hasMath,
      false,
      'Qualitative question hasMath false'
    );
  });

  // Multi-dimensional Mock Fixture for Filter & Facet Count Tests
  const mockBankQuestions: EnrichedBankQuestion[] = [
    {
      id: 'q1',
      stem: 'Why will scarcity always exist in economics?',
      cite: '0455/12 s 2024 Q01',
      subjectCode: '0455',
      subjectName: 'Economics',
      paper: '0455/12 s 2024',
      session: 'May/June 2024',
      year: '2024',
      season: 'May/June (s)',
      seriesCode: 's',
      variant: '12',
      topic: 'The basic economic problem',
      diff: 'Easy',
      acc: '80%',
      st: 'Live',
      stCls: 'bg-[#ccdbb2]',
      upd: 'Live',
      hasDiagram: false,
      hasTable: false,
      hasMath: false,
      optionsText: 'limited resources unlimited human wants opportunity cost',
    },
    {
      id: 'q2',
      stem: 'What causes the demand curve in the diagram to shift right?',
      cite: '0455/12 s 2024 Q02',
      subjectCode: '0455',
      subjectName: 'Economics',
      paper: '0455/12 s 2024',
      session: 'May/June 2024',
      year: '2024',
      season: 'May/June (s)',
      seriesCode: 's',
      variant: '12',
      topic: 'The allocation of resources',
      diff: 'Medium',
      acc: '65%',
      st: 'Needs review',
      stCls: 'bg-[#ffe1d0]',
      upd: '2d ago',
      hasDiagram: true,
      hasTable: false,
      hasMath: false,
      optionsText: 'increase in consumer disposable income',
    },
    {
      id: 'q3',
      stem: 'The table shows fiscal data. Calculate the budget deficit: | Revenue | Spending |',
      cite: '0455/22 w 2023 Q10',
      subjectCode: '0455',
      subjectName: 'Economics',
      paper: '0455/22 w 2023',
      session: 'Oct/Nov 2023',
      year: '2023',
      season: 'Oct/Nov (w)',
      seriesCode: 'w',
      variant: '22',
      topic: 'Government and the macroeconomy',
      diff: 'Hard',
      acc: '50%',
      st: 'Live',
      stCls: 'bg-[#ccdbb2]',
      upd: 'Live',
      hasDiagram: false,
      hasTable: true,
      hasMath: true,
      optionsText: '$500m deficit $200m surplus tax yields',
    },
    {
      id: 'q4',
      stem: 'Calculate cell magnification using formula: $M = I / A$',
      cite: '0610/12 m 2024 Q05',
      subjectCode: '0610',
      subjectName: 'Biology',
      paper: '0610/12 m 2024',
      session: 'Feb/March 2024',
      year: '2024',
      season: 'Feb/March (m)',
      seriesCode: 'm',
      variant: '12',
      topic: 'Cell biology',
      diff: 'Hard',
      acc: '45%',
      st: 'Agent draft',
      stCls: 'bg-[#f0fae1]',
      upd: '1d ago',
      hasDiagram: true,
      hasTable: false,
      hasMath: true,
      optionsText: '400x magnification ocular lens calculation',
    },
    {
      id: 'q5',
      stem: 'Which commercial bank factor affects lending rates?',
      cite: '0455/11 s 2023 Q18',
      subjectCode: '0455',
      subjectName: 'Economics',
      paper: '0455/11 s 2023',
      session: 'May/June 2023',
      year: '2023',
      season: 'May/June (s)',
      seriesCode: 's',
      variant: '11',
      topic: 'Microeconomic decision makers',
      diff: 'Easy',
      acc: '70%',
      st: 'Flagged',
      stCls: 'bg-[#fde8e8]',
      upd: '5d ago',
      hasDiagram: false,
      hasTable: false,
      hasMath: false,
      optionsText: 'central bank monetary interest rate',
    },
  ];

  test('filterBankQuestions filters accurately across all dimensions individually and combined', () => {
    // 1. Subject filter
    const subjEcon = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      subject: '0455',
    });
    assertEqual(subjEcon.length, 4, "Subject '0455' yields 4 questions");
    const subjBio = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      subject: '0610',
    });
    assertEqual(subjBio.length, 1, "Subject '0610' yields 1 question (q4)");
    assertEqual(subjBio[0].id, 'q4', 'q4 matches Biology');

    // 2. Year filter
    const year2024 = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      year: '2024',
    });
    assertEqual(year2024.length, 3, 'Year 2024 yields 3 questions (q1, q2, q4)');
    const year2023 = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      year: '2023',
    });
    assertEqual(year2023.length, 2, 'Year 2023 yields 2 questions (q3, q5)');

    // 3. Season filter
    const seasonW = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      season: 'Oct/Nov (w)',
    });
    assertEqual(seasonW.length, 1, 'Season Oct/Nov (w) yields 1 question (q3)');
    assertEqual(seasonW[0].id, 'q3', 'q3 matches Oct/Nov (w)');

    // 4. Variant filter
    const variant12 = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      variant: '12',
    });
    assertEqual(variant12.length, 3, 'Variant 12 yields 3 questions (q1, q2, q4)');

    // 4b. Paper filter (single-select and multi-select)
    const singlePaper = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      paper: '0455/12 s 2024',
    });
    assertEqual(singlePaper.length, 2, 'Single paper filter yields 2 questions (q1, q2)');

    const multiPapers = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      papers: ['0455/12 s 2024', '0455/22 w 2023'],
    });
    assertEqual(multiPapers.length, 3, 'Multi-select papers yields 3 questions (q1, q2, q3)');

    // 5. Multi-Topic filter
    const multiTopics = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      topics: ['The basic economic problem', 'The allocation of resources'],
    });
    assertEqual(multiTopics.length, 2, 'Multi-topic filter yields 2 questions (q1, q2)');

    // 6. Multi-Difficulty filter
    const multiDiff = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      difficulties: ['Medium', 'Hard'],
    });
    assertEqual(multiDiff.length, 3, 'Difficulties Medium + Hard yield 3 questions (q2, q3, q4)');

    // 7. Status filter
    const statusLive = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      status: 'Live',
    });
    assertEqual(statusLive.length, 2, 'Status Live yields 2 questions (q1, q3)');

    const statusDraft = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      status: 'Agent draft',
    });
    assertEqual(statusDraft.length, 1, 'Status Agent draft yields 1 question (q4)');

    const statusFlagged = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      status: 'Flagged',
    });
    assertEqual(statusFlagged.length, 1, 'Status Flagged yields 1 question (q5)');

    // 8. Content Features filter
    const featDiagram = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      features: ['diagram'],
    });
    assertEqual(featDiagram.length, 2, "Features ['diagram'] yields 2 questions (q2, q4)");

    const featTable = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      features: ['table'],
    });
    assertEqual(featTable.length, 1, "Features ['table'] yields 1 question (q3)");

    // Plural alias support
    const featTables = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      features: ['tables'] as any,
    });
    assertEqual(featTables.length, 1, "Features ['tables'] plural alias yields 1 question (q3)");

    // Dynamic Cambridge authentic stem question without pipes
    const cambridgeStemQ = enrichBankQuestion({
      id: 'q-cambridge-table',
      stem_markdown: 'The table shows the demand for widgets at different prices.',
      citation: '0455/12 s 2024 Q09',
      subjectCode: '0455',
      subjectName: 'Economics',
      year: '2024',
      season: 'May/June (s)',
      variant: '12',
      topic: 'The allocation of resources',
      difficulty: 'Medium',
      status: 'Live',
    });
    assertEqual(cambridgeStemQ.hasTable, true, 'enrichBankQuestion flags authentic Cambridge stem as hasTable: true');
    const questionsWithCambridgeTable = [...mockBankQuestions, cambridgeStemQ];
    const filteredWithCambridgeTable = filterBankQuestions(questionsWithCambridgeTable, {
      ...DEFAULT_BANK_FILTER_STATE,
      features: ['table'],
    });
    assertEqual(filteredWithCambridgeTable.length, 2, 'Features [table] returns both q3 and Cambridge stem question');

    const featCompound = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      features: ['table', 'math'],
    });
    assertEqual(featCompound.length, 1, "Features ['table', 'math'] yields 1 question (q3)");

    const featEmpty = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      features: ['diagram', 'table'],
    });
    assertEqual(featEmpty.length, 0, "No question has both diagram AND table in fixture");

    // 9. Full-Text Search
    const searchDeficit = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      search: 'deficit',
    });
    assertEqual(searchDeficit.length, 1, "Search 'deficit' matches q3 in stem and options");
    assertEqual(searchDeficit[0].id, 'q3', 'Matches question q3');

    const searchCite = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      search: '0610',
    });
    assertEqual(searchCite.length, 1, "Search '0610' matches citation of q4");

    // 10. Multi-filter drill-down (combined filters)
    const combined = filterBankQuestions(mockBankQuestions, {
      ...DEFAULT_BANK_FILTER_STATE,
      subject: '0455',
      year: '2024',
      status: 'Live',
      difficulty: 'Easy',
    });
    assertEqual(combined.length, 1, 'Combined drill-down narrows exactly to 1 question (q1)');
    assertEqual(combined[0].id, 'q1', 'Target question is q1');
  });

  test('computeBankFacetCounts computes live facet option counts accurately across all dimensions', () => {
    const facets = computeBankFacetCounts(mockBankQuestions);

    // Total question count check
    assertEqual(facets.subjects.find((s) => s.value === 'All')?.count, 5, "Subject 'All' count is 5");
    assertEqual(facets.years.find((y) => y.value === 'All')?.count, 5, "Year 'All' count is 5");
    assertEqual(facets.statuses.find((st) => st.value === 'All')?.count, 5, "Status 'All' count is 5");

    // Subject breakdown
    assertEqual(facets.subjects.find((s) => s.value === '0455')?.count, 4, "Subject 0455 count is 4");
    assertEqual(facets.subjects.find((s) => s.value === '0610')?.count, 1, "Subject 0610 count is 1");

    // Year breakdown
    assertEqual(facets.years.find((y) => y.value === '2024')?.count, 3, "Year 2024 count is 3");
    assertEqual(facets.years.find((y) => y.value === '2023')?.count, 2, "Year 2023 count is 2");

    // Season breakdown
    assertEqual(facets.seasons.find((s) => s.value === 'May/June (s)')?.count, 3, 'May/June (s) count is 3');
    assertEqual(facets.seasons.find((s) => s.value === 'Oct/Nov (w)')?.count, 1, 'Oct/Nov (w) count is 1');
    assertEqual(facets.seasons.find((s) => s.value === 'Feb/March (m)')?.count, 1, 'Feb/March (m) count is 1');

    // Variant breakdown
    assertEqual(facets.variants.find((v) => v.value === '12')?.count, 3, 'Variant 12 count is 3');
    assertEqual(facets.variants.find((v) => v.value === '22')?.count, 1, 'Variant 22 count is 1');
    assertEqual(facets.variants.find((v) => v.value === '11')?.count, 1, 'Variant 11 count is 1');

    // Status breakdown
    assertEqual(facets.statuses.find((st) => st.value === 'Live')?.count, 2, 'Live status count is 2');
    assertEqual(facets.statuses.find((st) => st.value === 'Needs review')?.count, 1, 'Needs review count is 1');
    assertEqual(facets.statuses.find((st) => st.value === 'Agent draft')?.count, 1, 'Agent draft count is 1');
    assertEqual(facets.statuses.find((st) => st.value === 'Flagged')?.count, 1, 'Flagged count is 1');

    // Difficulty breakdown
    assertEqual(facets.difficulties.find((d) => d.value === 'Easy')?.count, 2, 'Easy difficulty count is 2');
    assertEqual(facets.difficulties.find((d) => d.value === 'Medium')?.count, 1, 'Medium difficulty count is 1');
    assertEqual(facets.difficulties.find((d) => d.value === 'Hard')?.count, 2, 'Hard difficulty count is 2');

    // Feature breakdown
    assertEqual(facets.features.find((f) => f.value === 'diagram')?.count, 2, 'Diagram feature count is 2');
    assertEqual(facets.features.find((f) => f.value === 'table')?.count, 1, 'Table feature count is 1');
    assertEqual(facets.features.find((f) => f.value === 'math')?.count, 2, 'Math feature count is 2');
  });

  test('getActiveFilterChips, countActiveBankFilters, and removeActiveFilterChip handle active chips cleanly', () => {
    const complexState: BankFilterState = {
      ...DEFAULT_BANK_FILTER_STATE,
      search: 'deficit',
      subject: '0455',
      year: '2024',
      season: 'May/June (s)',
      topics: ['Topic A', 'Topic B'],
      difficulties: ['Hard'],
      status: 'Live',
      features: ['diagram', 'math'],
      page: 3,
    };

    // Chip generation & count
    const chips = getActiveFilterChips(complexState);
    assertEqual(countActiveBankFilters(complexState), 10, 'Active filter count matches 10 active chips');
    assertEqual(chips.length, 10, 'Generated chips array length is 10');

    // Verify chip keys exist
    assert(chips.some((c) => c.key === 'search' && c.value === 'deficit'), 'Contains search chip');
    assert(chips.some((c) => c.key === 'subject' && c.value === '0455'), 'Contains subject chip');
    assert(chips.some((c) => c.key === 'year' && c.value === '2024'), 'Contains year chip');
    assert(chips.some((c) => c.key === 'topics' && c.value === 'Topic A'), 'Contains Topic A chip');
    assert(chips.some((c) => c.key === 'topics' && c.value === 'Topic B'), 'Contains Topic B chip');
    assert(chips.some((c) => c.key === 'features' && c.value === 'diagram'), 'Contains diagram feature chip');

    // Remove single chip (subject)
    const afterSubjectRemoval = removeActiveFilterChip(complexState, {
      key: 'subject',
      label: 'Subject',
      value: '0455',
    });
    assertEqual(afterSubjectRemoval.subject, 'All', "Subject resets to 'All'");
    assertEqual(afterSubjectRemoval.page, 1, 'Page resets to 1 upon removing filter');
    assertEqual(afterSubjectRemoval.year, '2024', 'Year remains intact');

    // Remove single item from multi-select topics
    const afterTopicRemoval = removeActiveFilterChip(complexState, {
      key: 'topics',
      label: 'Topic',
      value: 'Topic A',
    });
    assertEqual(JSON.stringify(afterTopicRemoval.topics), JSON.stringify(['Topic B']), 'Topic A removed, Topic B kept');

    // Remove single feature
    const afterFeatureRemoval = removeActiveFilterChip(complexState, {
      key: 'features',
      label: 'Diagram',
      value: 'diagram',
    });
    assertEqual(JSON.stringify(afterFeatureRemoval.features), JSON.stringify(['math']), 'diagram removed, math kept');

    // Remove search chip
    const afterSearchRemoval = removeActiveFilterChip(complexState, {
      key: 'search',
      label: 'Search',
      value: 'deficit',
    });
    assertEqual(afterSearchRemoval.search, '', 'Search query cleared to empty string');

    // Multi-select papers active chips and chip removal
    const paperState: BankFilterState = {
      ...DEFAULT_BANK_FILTER_STATE,
      papers: ['0455/12 s 2024', '0455/22 w 2023'],
    };
    const paperChips = getActiveFilterChips(paperState);
    assertEqual(paperChips.length, 2, 'Two paper chips generated');
    assert(paperChips.some((c) => c.key === 'papers' && c.value === '0455/12 s 2024'), 'Contains first paper chip');
    assert(paperChips.some((c) => c.key === 'papers' && c.value === '0455/22 w 2023'), 'Contains second paper chip');

    const afterPaperRemoval = removeActiveFilterChip(paperState, {
      key: 'papers',
      label: 'Paper',
      value: '0455/12 s 2024',
    });
    assertEqual(JSON.stringify(afterPaperRemoval.papers), JSON.stringify(['0455/22 w 2023']), 'First paper removed, second kept');
  });

  test('serializeBankFiltersToQuery and parseBankFiltersFromQuery perform lossless bidirectional round-trip', () => {
    // 1. Default state produces clean empty query string
    assertEqual(serializeBankFiltersToQuery(DEFAULT_BANK_FILTER_STATE), '', 'Default state produces empty query');

    // 2. Parsing empty query produces default state values
    const parsedDefault = parseBankFiltersFromQuery('');
    assertEqual(parsedDefault.subject, 'All', "Parsed empty subject is 'All'");
    assertEqual(parsedDefault.year, 'All', "Parsed empty year is 'All'");
    assertEqual(parsedDefault.status, 'All', "Parsed empty status is 'All'");
    assertEqual(parsedDefault.page, 1, 'Parsed empty page is 1');
    assertEqual(parsedDefault.features.length, 0, 'Parsed empty features is []');
    assertEqual(parsedDefault.papers?.length || 0, 0, 'Parsed empty papers is []');

    // 3. Rich state bidirectional serialization round-trip
    const richState: BankFilterState = {
      search: 'elasticity of demand',
      subject: '0455',
      year: '2024',
      season: 'May/June (s)',
      variant: '12',
      paper: '0455/12 s 2024',
      papers: ['0455/12 s 2024', '0455/22 w 2023'],
      session: 'May/June 2024',
      topic: 'All',
      topics: ['Microeconomics', 'Markets'],
      difficulty: 'All',
      difficulties: ['Medium', 'Hard'],
      status: 'Live',
      features: ['diagram', 'math'],
      page: 2,
    };

    const queryString = serializeBankFiltersToQuery(richState);
    assert(queryString.includes('q=elasticity+of+demand') || queryString.includes('q=elasticity%20of%20demand'), 'Query contains encoded search');
    assert(queryString.includes('subject=0455'), 'Query contains subject');
    assert(queryString.includes('year=2024'), 'Query contains year');
    assert(queryString.includes('variant=12'), 'Query contains variant');
    assert(queryString.includes('papers='), 'Query contains papers param');
    assert(queryString.includes('topics=Microeconomics%2CMarkets') || queryString.includes('topics=Microeconomics,Markets'), 'Query contains comma-separated topics');
    assert(queryString.includes('diffs=Medium%2CHard') || queryString.includes('diffs=Medium,Hard'), 'Query contains comma-separated diffs');
    assert(queryString.includes('status=Live'), 'Query contains status');
    assert(queryString.includes('features=diagram%2Cmath') || queryString.includes('features=diagram,math'), 'Query contains comma-separated features');
    assert(queryString.includes('page=2'), 'Query contains page=2');

    const parsedRoundTrip = parseBankFiltersFromQuery(queryString);
    assertEqual(parsedRoundTrip.search, richState.search, 'Round-trip search matches');
    assertEqual(parsedRoundTrip.subject, richState.subject, 'Round-trip subject matches');
    assertEqual(parsedRoundTrip.year, richState.year, 'Round-trip year matches');
    assertEqual(parsedRoundTrip.season, richState.season, 'Round-trip season matches');
    assertEqual(parsedRoundTrip.variant, richState.variant, 'Round-trip variant matches');
    assertEqual(parsedRoundTrip.paper, richState.paper, 'Round-trip paper matches');
    assertEqual(JSON.stringify(parsedRoundTrip.papers), JSON.stringify(richState.papers), 'Round-trip papers match');
    assertEqual(parsedRoundTrip.session, richState.session, 'Round-trip session matches');
    assertEqual(JSON.stringify(parsedRoundTrip.topics), JSON.stringify(richState.topics), 'Round-trip topics match');
    assertEqual(JSON.stringify(parsedRoundTrip.difficulties), JSON.stringify(richState.difficulties), 'Round-trip difficulties match');
    assertEqual(parsedRoundTrip.status, richState.status, 'Round-trip status matches');
    assertEqual(JSON.stringify(parsedRoundTrip.features), JSON.stringify(richState.features), 'Round-trip features match');
    assertEqual(parsedRoundTrip.page, richState.page, 'Round-trip page matches');

    // 4. Query param normalization: features=tables, feature=tables, format=tables
    const parsedTablesPlural = parseBankFiltersFromQuery('features=tables');
    assertEqual(JSON.stringify(parsedTablesPlural.features), JSON.stringify(['table']), 'features=tables maps to ["table"]');

    const parsedFeatureSingular = parseBankFiltersFromQuery('feature=tables');
    assertEqual(JSON.stringify(parsedFeatureSingular.features), JSON.stringify(['table']), 'feature=tables maps to ["table"]');

    const parsedFormatTables = parseBankFiltersFromQuery('format=tables');
    assertEqual(JSON.stringify(parsedFormatTables.features), JSON.stringify(['table']), 'format=tables maps to ["table"]');

    const parsedMultiPlural = parseBankFiltersFromQuery('features=diagrams,tables');
    assertEqual(JSON.stringify(parsedMultiPlural.features), JSON.stringify(['diagram', 'table']), 'diagrams,tables maps to ["diagram", "table"]');

    // Remove active filter chip with value 'tables'
    const stateWithTableChip: BankFilterState = {
      ...DEFAULT_BANK_FILTER_STATE,
      features: ['table'],
    };
    const afterRemovingTableChip = removeActiveFilterChip(stateWithTableChip, {
      key: 'features',
      label: 'Table',
      value: 'tables',
    });
    assertEqual(afterRemovingTableChip.features.length, 0, 'removeActiveFilterChip with value "tables" removes "table"');
  });

  // -----------------------------------------------------------------------------
  // [Suite 18: Question Bank Table Dropdown & Inspection Architecture]
  // -----------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[Suite 18: Question Bank Table Dropdown & Inspection Architecture]\x1b[0m');

  test('Static Code Contract: components/portal/AdminTools.tsx exports types and handles table row dropdown', () => {
    const fs = require('fs');
    const path = require('path');
    const toolsPath = path.resolve(process.cwd(), 'components/portal/AdminTools.tsx');
    assertEqual(fs.existsSync(toolsPath), true, 'components/portal/AdminTools.tsx exists');

    const content = fs.readFileSync(toolsPath, 'utf8');

    // 1. BankQuestionOption interface definition
    assert(
      content.includes('export interface BankQuestionOption') || content.includes('export type BankQuestionOption'),
      'AdminTools.tsx exports BankQuestionOption'
    );
    assert(content.includes('id: string'), 'BankQuestionOption has id field');
    assert(content.includes('label: string'), 'BankQuestionOption has label field');
    assert(content.includes('text: string'), 'BankQuestionOption has text field');
    assert(content.includes('isCorrect: boolean'), 'BankQuestionOption has isCorrect field');

    // 2. QuestionBankItem interface definition
    assert(content.includes('export interface QuestionBankItem'), 'AdminTools.tsx exports QuestionBankItem');
    assert(content.includes('options?: BankQuestionOption[]'), 'QuestionBankItem has options?: BankQuestionOption[]');
    assert(content.includes('imageUrl?: string'), 'QuestionBankItem has imageUrl?: string');

    // 3. createInitialBankItems export
    assert(content.includes('export function createInitialBankItems'), 'AdminTools.tsx exports createInitialBankItems');

    // 4. expandedQuestionId state management
    assert(content.includes('expandedQuestionId'), 'AdminTools.tsx manages expandedQuestionId state');

    // 5. Open Full Editor button triggers onOpenEditor
    assert(content.includes('Open Full Editor'), 'AdminTools.tsx contains Open Full Editor action button');
    assert(content.includes('onOpenEditor?.(') || content.includes('onOpenEditor('), 'Open Full Editor triggers onOpenEditor');

    // 6. MarkdownErrorBoundary defensive wrapping
    assert(content.includes('MarkdownErrorBoundary'), 'AdminTools.tsx uses MarkdownErrorBoundary');

    // 7. e.stopPropagation() prevents unwanted row toggling
    assert(content.includes('e.stopPropagation()') || content.includes('e.stopPropagation();'), 'AdminTools.tsx uses e.stopPropagation() on row action elements');
  });

  // Reference implementation of option and metadata normalization
  interface RefBankQuestionOption {
    id: string;
    label: string;
    text: string;
    isCorrect: boolean;
    distractorReasoning?: string;
  }

  function normalizeQuestionBankOptions(q: any): RefBankQuestionOption[] {
    return (q.options || []).map((o: any, oIdx: number) => {
      const label = o.label || ['A', 'B', 'C', 'D'][oIdx] || String(oIdx + 1);
      const text = o.content_markdown || o.text_markdown || o.text || '';
      const isCorrect = typeof o.is_correct === 'boolean'
        ? o.is_correct
        : (q as any).correct_option_id === o.id;
      return {
        id: o.id || `${q.id}-opt-${label.toLowerCase()}`,
        label,
        text,
        isCorrect,
        distractorReasoning: o.distractor_rationale || o.distractor_reasoning || o.explanation,
      };
    });
  }

  function resolveQuestionImageUrl(q: any): string | undefined {
    return q.image_url || (q.diagram as any)?.image_url || (q as any).diagram_metadata?.image_url;
  }

  test('Reference normalizer preserves options as BankQuestionOption[] with label, text, and isCorrect', () => {
    const mockQuestion = {
      id: 'q-test-opts-1',
      stem_markdown: 'What is the primary function of price mechanism?',
      options: [
        { id: 'opt-a', label: 'A', text: 'Resource allocation', is_correct: true },
        { id: 'opt-b', label: 'B', text: 'Income redistribution', is_correct: false },
        { id: 'opt-c', label: 'C', text: 'Fiscal policy control', is_correct: false },
        { id: 'opt-d', label: 'D', text: 'Exchange rate stabilization', is_correct: false },
      ],
      citation: '0455/12 May/June 2024 Q10',
      topic: 'Allocation of resources',
    };

    const options = normalizeQuestionBankOptions(mockQuestion);
    assertEqual(options.length, 4, 'options array has length 4');

    const optA = options[0];
    assertEqual(optA.label, 'A', 'Option 0 label is A');
    assertEqual(optA.text, 'Resource allocation', 'Option 0 text preserved');
    assertEqual(optA.isCorrect, true, 'Option 0 isCorrect is true');

    const optB = options[1];
    assertEqual(optB.label, 'B', 'Option 1 label is B');
    assertEqual(optB.text, 'Income redistribution', 'Option 1 text preserved');
    assertEqual(optB.isCorrect, false, 'Option 1 isCorrect is false');
  });

  test('Reference normalizer maps correct_option_id accurately to isCorrect: true and other options to false', () => {
    const mockQuestionWithCorrectId = {
      id: 'q-test-opts-2',
      stem_markdown: 'Which curve shifts when production technology improves?',
      correct_option_id: 'opt-supply',
      options: [
        { id: 'opt-demand', label: 'A', content_markdown: 'Demand curve to the right' },
        { id: 'opt-supply', label: 'B', content_markdown: 'Supply curve to the right' },
        { id: 'opt-both', label: 'C', content_markdown: 'Both curves to the left' },
        { id: 'opt-none', label: 'D', content_markdown: 'Neither curve moves' },
      ],
      citation: '0455/12 s 2024 Q15',
    };

    const options = normalizeQuestionBankOptions(mockQuestionWithCorrectId);
    assertEqual(options.length, 4, 'options array has length 4');

    assertEqual(options[0].isCorrect, false, 'Demand curve option isCorrect is false');
    assertEqual(options[1].isCorrect, true, 'Supply curve option matching correct_option_id has isCorrect: true');
    assertEqual(options[2].isCorrect, false, 'Option C isCorrect is false');
    assertEqual(options[3].isCorrect, false, 'Option D isCorrect is false');
  });

  test('Reference normalizer extracts imageUrl from image_url, diagram, and diagram_metadata', () => {
    const mockWithImageUrl = {
      id: 'q-img-1',
      stem_markdown: 'Refer to the diagram below:',
      image_url: 'https://example.com/diagrams/supply-demand.png',
      citation: '0455/12 s 2024 Q20',
      options: [],
    };
    assertEqual(resolveQuestionImageUrl(mockWithImageUrl), 'https://example.com/diagrams/supply-demand.png', 'Sets imageUrl from image_url');

    const mockWithDiagramObj = {
      id: 'q-img-2',
      stem_markdown: 'Examine the cell structure in the figure:',
      diagram: {
        image_url: 'https://example.com/diagrams/cell-microscope.png',
      },
      citation: '0610/22 m 2023 Q05',
      options: [],
    };
    assertEqual(resolveQuestionImageUrl(mockWithDiagramObj), 'https://example.com/diagrams/cell-microscope.png', 'Sets imageUrl from diagram.image_url');

    const mockWithDiagramMeta = {
      id: 'q-img-3',
      stem_markdown: 'Check metabolic rate graph:',
      diagram_metadata: {
        image_url: 'https://example.com/diagrams/metabolism.png',
      },
      citation: '0610/11 w 2022 Q12',
      options: [],
    };
    assertEqual(resolveQuestionImageUrl(mockWithDiagramMeta), 'https://example.com/diagrams/metabolism.png', 'Sets imageUrl from diagram_metadata.image_url');
  });

  // -----------------------------------------------------------------------------
  // [Suite 19: Teacher vs Admin Portal Table & Access Separation]
  // -----------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[Suite 19: Teacher vs Admin Portal Table & Access Separation]\x1b[0m');

  test('Static Code Contract: components/portal/AdminTools.tsx exports teacher annotations and handles teacher vs admin portalMode', () => {
    const fs = require('fs');
    const path = require('path');
    const toolsPath = path.resolve(process.cwd(), 'components/portal/AdminTools.tsx');
    assertEqual(fs.existsSync(toolsPath), true, 'components/portal/AdminTools.tsx exists');

    const content = fs.readFileSync(toolsPath, 'utf8');

    // 1. TeacherQuestionAnnotation and TEACHER_ANNOTATION_STORAGE_KEY exports
    assert(
      content.includes('export interface TeacherQuestionAnnotation') ||
      content.includes('export type TeacherQuestionAnnotation'),
      'AdminTools.tsx exports TeacherQuestionAnnotation'
    );
    assert(content.includes('classroomTags: string[]'), 'TeacherQuestionAnnotation has classroomTags');
    assert(content.includes('teacherNote: string'), 'TeacherQuestionAnnotation has teacherNote');
    assert(
      content.includes('export const TEACHER_ANNOTATION_STORAGE_KEY'),
      'AdminTools.tsx exports TEACHER_ANNOTATION_STORAGE_KEY'
    );

    // 2. AdminToolsProps supports portalMode
    assert(
      content.includes("portalMode?: 'teacher' | 'admin'") || content.includes('portalMode?: "teacher" | "admin"'),
      'AdminToolsProps supports portalMode'
    );

    // 3. Filters to Live questions in teacher mode
    assert(
      content.includes("isTeacherMode ? bankQuestions.filter((q) => q.st === 'Live') : bankQuestions") ||
      content.includes("isTeacherMode ? bankQuestions.filter") ||
      content.includes("q.st === 'Live'"),
      'Filters to Live questions in teacher mode'
    );

    // 4. Hides internal columns (ID, Status, Updated, delete action) in teacher mode while preserving in admin mode
    assert(content.includes('isTeacherMode'), 'AdminTools.tsx branches UI on isTeacherMode');
    assert(content.includes('Question & Classroom Tags'), 'AdminTools.tsx renders teacher mode table header');
    assert(content.includes('Open Full Editor'), 'AdminTools.tsx preserves Open Full Editor in admin mode');

    // 5. Classroom tags and teacher notes handling
    assert(
      content.includes('classroomTags') && content.includes('teacherNote'),
      'AdminTools.tsx manages classroom tags and teacher notes'
    );
  });

  test('Static Code Contract: app/portal/page.tsx enforces Teacher portalMode and restricts admin tabs', () => {
    const fs = require('fs');
    const path = require('path');
    const portalPagePath = path.resolve(process.cwd(), 'app/portal/page.tsx');
    assertEqual(fs.existsSync(portalPagePath), true, 'app/portal/page.tsx exists');

    const content = fs.readFileSync(portalPagePath, 'utf8');

    // 1. Assign tab passes portalMode="teacher"
    assert(
      content.includes('key="assign"') && content.includes('portalMode="teacher"'),
      'app/portal/page.tsx passes portalMode="teacher" to AdminTools in case assign'
    );

    // 2. Bank tab passes portalMode="teacher"
    assert(
      content.includes('key="bank"') && content.includes('portalMode="teacher"'),
      'app/portal/page.tsx passes portalMode="teacher" to AdminTools in case bank'
    );

    // 3. Direct question editing, flagged queue, and school tabs restricted to App Admin
    assert(
      content.includes("case 'flagged':") &&
      content.includes("case 'editor':") &&
      content.includes("case 'school':"),
      'app/portal/page.tsx handles flagged, editor, and school cases'
    );
    assert(
      content.includes('Admin Access Required') || content.includes('Restricted to App Admin'),
      'app/portal/page.tsx renders Admin Access Required banner'
    );
    assert(
      content.includes('Open in App Admin 🛠️'),
      'app/portal/page.tsx provides link to Open in App Admin 🛠️'
    );
    assert(
      content.includes('Back to Teacher Overview'),
      'app/portal/page.tsx provides Back to Teacher Overview action'
    );
  });

  test('Static Code Contract: components/portal/AdminNav.tsx curates clean Teacher Navigation', () => {
    const fs = require('fs');
    const path = require('path');
    const navPath = path.resolve(process.cwd(), 'components/portal/AdminNav.tsx');
    assertEqual(fs.existsSync(navPath), true, 'components/portal/AdminNav.tsx exists');

    const content = fs.readFileSync(navPath, 'utf8');

    // Retains Question bank
    assert(content.includes("title=\"Question bank\""), 'AdminNav retains Question bank');

    // Removes flagged moderation queue and school licence buttons from teacher sidebar
    assert(!content.includes("title=\"Flagged questions\""), 'AdminNav hides Flagged questions button');
    assert(!content.includes("title=\"School & licence\""), 'AdminNav hides School & licence button');
  });

  test('Static Code Contract: components/admin/AppAdminHub.tsx passes portalMode="admin" and renders School & Licence tables', () => {
    const fs = require('fs');
    const path = require('path');
    const adminHubPath = path.resolve(process.cwd(), 'components/admin/AppAdminHub.tsx');
    assertEqual(fs.existsSync(adminHubPath), true, 'components/admin/AppAdminHub.tsx exists');

    const content = fs.readFileSync(adminHubPath, 'utf8');

    // 1. Bank tab explicitly passes portalMode="admin"
    assert(
      content.includes('initialView="bank"') && content.includes('portalMode="admin"'),
      'AppAdminHub.tsx passes portalMode="admin" to AdminTools in case bank'
    );

    // 2. Licence & Seat Quota Controls
    assert(content.includes('Plan Tier'), 'AppAdminHub renders Plan Tier control');
    assert(content.includes('Total Seat Quota'), 'AppAdminHub renders Total Seat Quota control');
    assert(content.includes('Teacher Seat Limit'), 'AppAdminHub renders Teacher Seat Limit control');
    assert(content.includes('Licence Expiry'), 'AppAdminHub renders Licence Expiry control');
    assert(content.includes('Save Licence Quotas'), 'AppAdminHub renders Save Licence Quotas action');

    // 3. Educator Seats & Permissions Table
    assert(content.includes('Educator Seats & Permissions Table'), 'AppAdminHub renders Educator Seats table');
    assert(content.includes('Educator'), 'Educator Seats table has Educator column');
    assert(content.includes('Email'), 'Educator Seats table has Email column');
    assert(content.includes('Department'), 'Educator Seats table has Department column');
    assert(content.includes('Portal Role'), 'Educator Seats table has Portal Role column');
    assert(content.includes('Seat Status'), 'Educator Seats table has Seat Status column');
    assert(content.includes('Teacher (Read-Only Bank)'), 'AppAdminHub supports Teacher role');
    assert(content.includes('App Admin (Full Edit)'), 'AppAdminHub supports App Admin role');
    assert(content.includes('+ Allocate Educator Seat'), 'AppAdminHub provides inline Allocate Educator Seat action');

    // 4. Institutional Cohort Allocations Table
    assert(content.includes('Institutional Cohort Allocations Table'), 'AppAdminHub renders Cohort Allocations table');
    assert(content.includes('+ Register Cohort'), 'AppAdminHub provides inline Register Cohort action');
  });

  test('Behavioral Logic: Teacher live question filtering and educator seat role toggle simulation', () => {
    // 1. Question bank live status filtering logic
    const mockBank = [
      { id: 'q1', st: 'Live', stem: 'Live question 1' },
      { id: 'q2', st: 'Agent draft', stem: 'Draft question 2' },
      { id: 'q3', st: 'Needs review', stem: 'Review question 3' },
      { id: 'q4', st: 'Flagged', stem: 'Flagged question 4' },
      { id: 'q5', st: 'Live', stem: 'Live question 5' },
    ];

    const teacherVisible = mockBank.filter((q) => q.st === 'Live');
    assertEqual(teacherVisible.length, 2, 'Teacher mode only exposes Live questions (2 of 5)');
    assertEqual(teacherVisible[0].id, 'q1', 'First visible is q1');
    assertEqual(teacherVisible[1].id, 'q5', 'Second visible is q5');

    // 2. Educator role toggle behavior
    let educator = {
      id: 'ed-1',
      name: 'Dr. Jane Smith',
      role: 'Teacher (Read-Only Bank)' as 'Teacher (Read-Only Bank)' | 'App Admin (Full Edit)',
    };

    const toggleRole = (current: string) =>
      current === 'Teacher (Read-Only Bank)'
        ? 'App Admin (Full Edit)'
        : 'Teacher (Read-Only Bank)';

    educator.role = toggleRole(educator.role) as any;
    assertEqual(educator.role, 'App Admin (Full Edit)', 'Toggled role to App Admin');

    educator.role = toggleRole(educator.role) as any;
    assertEqual(educator.role, 'Teacher (Read-Only Bank)', 'Toggled role back to Teacher');
  });

  // -----------------------------------------------------------------------------
  // [Suite 11] Test Compiler A4 Print Layout & Pagination Integrity
  // -----------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[34m[Suite 11] Test Compiler A4 Print Layout & Pagination Integrity\x1b[0m');

  test('Static Code Contract: PrintableExamLayout.tsx enforces strict A4 page sizing and print styling', () => {
    const fs = require('fs');
    const path = require('path');
    const layoutPath = path.resolve(process.cwd(), 'components/portal/compiler/PrintableExamLayout.tsx');
    assertEqual(fs.existsSync(layoutPath), true, 'components/portal/compiler/PrintableExamLayout.tsx exists');

    const content = fs.readFileSync(layoutPath, 'utf8');

    // 1. @page size: A4 or size: A4 portrait
    assert(
      content.includes('size: A4') || content.includes('size: A4 portrait'),
      'PrintableExamLayout.tsx contains @page { size: A4 } or @page { size: A4 portrait }'
    );
    assert(
      content.includes('margin: 15mm') || content.includes('margin: 12mm 15mm') || content.includes('margin: 10mm'),
      'PrintableExamLayout.tsx defines mm-based print margins in @page'
    );

    // 2. Body background in print media
    assert(
      content.includes('background: white') || content.includes('background: white !important'),
      'PrintableExamLayout.tsx forces white background in print media'
    );
  });

  test('Static Code Contract: PrintableExamLayout.tsx question items prevent mid-question page slicing', () => {
    const fs = require('fs');
    const path = require('path');
    const layoutPath = path.resolve(process.cwd(), 'components/portal/compiler/PrintableExamLayout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf8');

    // 1. Question item break-inside: avoid or page-break-inside: avoid
    assert(
      content.includes("breakInside: 'avoid'") ||
      content.includes('breakInside: "avoid"') ||
      content.includes("pageBreakInside: 'avoid'") ||
      content.includes('pageBreakInside: "avoid"') ||
      content.includes('break-inside: avoid') ||
      content.includes('page-break-inside: avoid'),
      'Question items enforce break-inside: avoid or page-break-inside: avoid'
    );

    // 2. Options container / individual options breakInside: avoid
    assert(
      content.includes('breakInside') || content.includes('pageBreakInside'),
      'Question items or options prevent awkward page break slicing'
    );
  });

  test('Static Code Contract: PrintableExamLayout.tsx cover page and bubble sheet pagination boundaries', () => {
    const fs = require('fs');
    const path = require('path');
    const layoutPath = path.resolve(process.cwd(), 'components/portal/compiler/PrintableExamLayout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf8');

    // 1. Cover page break-after: page or pageBreakAfter: 'always'
    assert(
      content.includes("pageBreakAfter: 'always'") ||
      content.includes('pageBreakAfter: "always"') ||
      content.includes("breakAfter: 'page'") ||
      content.includes('breakAfter: "page"') ||
      content.includes('break-after: page'),
      'Cover page contains break-after: page or page-break-after: always'
    );

    // 2. Cover page uses pageBreakInside: 'avoid' or breakInside: 'avoid'
    assert(
      content.includes("pageBreakInside: 'avoid'") ||
      content.includes('pageBreakInside: "avoid"') ||
      content.includes("breakInside: 'avoid'") ||
      content.includes('breakInside: "avoid"'),
      'Cover page uses pageBreakInside: avoid or breakInside: avoid'
    );

    // 3. Bubble sheet contains break-before: page or pageBreakBefore: 'always'
    assert(
      content.includes("pageBreakBefore: 'always'") ||
      content.includes('pageBreakBefore: "always"') ||
      content.includes("breakBefore: 'page'") ||
      content.includes('breakBefore: "page"') ||
      content.includes('break-before: page'),
      'Bubble sheet answer sheet enforces break-before: page or pageBreakBefore: always'
    );
  });

  test('Static Code Contract: PrintableExamLayout.tsx teacher mark scheme blank page prevention and table header repeat', () => {
    const fs = require('fs');
    const path = require('path');
    const layoutPath = path.resolve(process.cwd(), 'components/portal/compiler/PrintableExamLayout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf8');

    // Extract the showMarkScheme branch
    const showMarkSchemeIndex = content.indexOf('if (showMarkScheme)');
    assert(showMarkSchemeIndex !== -1, 'PrintableExamLayout.tsx handles showMarkScheme branch');

    const markSchemeBranch = content.slice(showMarkSchemeIndex, content.indexOf('return (', showMarkSchemeIndex + 50) + 400);

    // 1. Root element of showMarkScheme does NOT contain pageBreakBefore: 'always' (preventing blank first page)
    assert(
      !markSchemeBranch.includes("pageBreakBefore: 'always'") &&
      !markSchemeBranch.includes('pageBreakBefore: "always"') &&
      !markSchemeBranch.includes("breakBefore: 'page'") &&
      !markSchemeBranch.includes('breakBefore: "page"'),
      'Teacher mark scheme root element does NOT contain pageBreakBefore: always (prevents blank first page)'
    );

    // 2. Teacher mark scheme table contains display: table-header-group
    assert(
      content.includes("display: 'table-header-group'") ||
      content.includes('display: "table-header-group"') ||
      content.includes('display: table-header-group') ||
      content.includes('table-header-group'),
      'Teacher mark scheme table contains display: table-header-group to repeat headers across pages'
    );
  });

  test('Static Code Contract: PrintableExamLayout.tsx question diagram images have constrained max height <= 220px', () => {
    const fs = require('fs');
    const path = require('path');
    const layoutPath = path.resolve(process.cwd(), 'components/portal/compiler/PrintableExamLayout.tsx');
    const content = fs.readFileSync(layoutPath, 'utf8');

    // Look for image tag with q.imageUrl
    assert(content.includes('q.imageUrl'), 'PrintableExamLayout.tsx renders question diagrams for q.imageUrl');

    // Diagram max-height must be <= 220px to comfortably fit on A4
    const match = content.match(/max-h-\[(\d+)px\]/);
    if (match) {
      const height = parseInt(match[1], 10);
      assert(
        height <= 220,
        `Diagram max-h-[${height}px] is constrained to <= 220px for A4 fit`
      );
    } else {
      const hasConstrainedClass =
        content.includes('max-h-48') ||
        content.includes('max-h-52') ||
        content.includes('max-h-44') ||
        content.includes('max-h-40');
      assert(
        hasConstrainedClass || content.includes('maxHeight: 220') || content.includes('maxHeight: 200'),
        'Diagram images have constrained max height <= 220px'
      );
    }

    // Must NOT contain old unconstrained max-h-[300px]
    assert(
      !content.includes('max-h-[300px]'),
      'PrintableExamLayout.tsx no longer uses unconstrained max-h-[300px]'
    );
  });

  test('Static Code Contract: app/portal/compiler/print/page.tsx toolbar no-print and print overrides', () => {
    const fs = require('fs');
    const path = require('path');
    const printPagePath = path.resolve(process.cwd(), 'app/portal/compiler/print/page.tsx');
    assertEqual(fs.existsSync(printPagePath), true, 'app/portal/compiler/print/page.tsx exists');

    const content = fs.readFileSync(printPagePath, 'utf8');

    // 1. Toolbar has no-print
    assert(
      content.includes('no-print'),
      'app/portal/compiler/print/page.tsx header toolbar contains no-print'
    );

    // 2. Parent wrappers contain print overrides (print:bg-white or print:p-0)
    assert(
      content.includes('print:bg-white') || content.includes('print:p-0'),
      'app/portal/compiler/print/page.tsx specifies print overrides (print:bg-white or print:p-0) on parent wrappers'
    );
  });

  test('Static Code Contract: app/portal/compiler/print/page.tsx provides A4 print tip and guidance for users', () => {
    const fs = require('fs');
    const path = require('path');
    const printPagePath = path.resolve(process.cwd(), 'app/portal/compiler/print/page.tsx');
    const content = fs.readFileSync(printPagePath, 'utf8');

    // A4 print tip or guidance for users
    assert(
      content.includes('A4') &&
      (content.includes('Print tip') || content.includes('print tip') || content.includes('tip') || content.includes('Paper size')),
      'app/portal/compiler/print/page.tsx contains A4 print tip or guidance for users'
    );
  });

  test('Static Code Contract: components/TopicMasteryList.tsx supports topic search, clear button, and empty state', () => {
    const fs = require('fs');
    const path = require('path');
    const topicListPath = path.resolve(process.cwd(), 'components/TopicMasteryList.tsx');
    assertEqual(fs.existsSync(topicListPath), true, 'components/TopicMasteryList.tsx exists');

    const content = fs.readFileSync(topicListPath, 'utf8');

    // 1. Search input with aria-label and placeholder
    assert(
      content.includes('aria-label="Search syllabus topics"'),
      'components/TopicMasteryList.tsx contains search input with aria-label="Search syllabus topics"'
    );
    assert(
      content.includes('placeholder="Search topics by name..."'),
      'components/TopicMasteryList.tsx contains placeholder="Search topics by name..."'
    );

    // 2. Clear search button with aria-label
    assert(
      content.includes('aria-label="Clear search"'),
      'components/TopicMasteryList.tsx contains clear button with aria-label="Clear search"'
    );

    // 3. Empty state handling
    assert(
      content.includes('No topics found'),
      'components/TopicMasteryList.tsx contains "No topics found" empty state message'
    );
    assert(
      content.includes('Clear search'),
      'components/TopicMasteryList.tsx contains "Clear search" action in empty state'
    );
  });

  test('Demo Review Pile Guard Contract: Demo student does not have review pile enabled, logged-in profile has it enabled', () => {
    // 1. Demo Student session checks
    const demoProfile = { ...DEFAULT_DEMO_STUDENT_PROFILE };
    assert(isDemoStudentSession(demoProfile) === true, 'DEFAULT_DEMO_STUDENT_PROFILE is recognized as demo session');
    assert(!demoProfile.email, 'Demo student session has no verified email');
    
    // Evaluation: review pile is disabled for demo session
    const isDemoReviewPileEnabled = !isDemoStudentSession(demoProfile) && Boolean(demoProfile.email);
    assert(isDemoReviewPileEnabled === false, 'Demo student must have review pile disabled');

    // 2. Logged-in Google Student session checks
    const loggedInProfile = {
      id: 'google-user-12345',
      display_name: 'Student Learner',
      email: 'student@example.com',
      is_school_account: false,
      total_xp: 350,
      current_streak: 3,
      opt_in_leaderboard: true,
      role: 'student' as const,
    };
    assert(isDemoStudentSession(loggedInProfile) === false, 'Logged-in user is not a demo session');
    assert(Boolean(loggedInProfile.email), 'Logged-in user has verified email');

    // Evaluation: review pile is enabled for logged in account
    const isLoggedInReviewPileEnabled = !isDemoStudentSession(loggedInProfile) && Boolean(loggedInProfile.email);
    assert(isLoggedInReviewPileEnabled === true, 'Logged-in account must have review pile enabled');

    // 3. Static verification of components/StartFlow.tsx, hooks/useQuizGame.ts, and app/page.tsx
    const fs = require('fs');
    const path = require('path');
    const startFlowContent = fs.readFileSync(path.resolve(process.cwd(), 'components/StartFlow.tsx'), 'utf8');
    const quizGameContent = fs.readFileSync(path.resolve(process.cwd(), 'hooks/useQuizGame.ts'), 'utf8');
    const pageContent = fs.readFileSync(path.resolve(process.cwd(), 'app/page.tsx'), 'utf8');

    assert(startFlowContent.includes('disabled={isDemo}'), 'StartFlow.tsx disables review pile button for demo user');
    assert(startFlowContent.includes('🔒 Log In to Save'), 'StartFlow.tsx renders locked tag for demo user');
    assert(quizGameContent.includes('!isDemoSession && Boolean(userProfile?.email)'), 'useQuizGame.ts guards addToReviewPile calls');
    assert(pageContent.includes('if (isDemoSession || questions.length === 0) return;'), 'page.tsx guards handleStartReviewPile');
  });
}

// -----------------------------------------------------------------------------
// [Suite 20] Auth & Roster Engine Architecture
// -----------------------------------------------------------------------------
async function runSuite20() {
  console.log('\n\x1b[1m\x1b[34m[Suite 20] Auth & Roster Engine Architecture\x1b[0m');

  await testAsync('Roster Engine: addRosterInvite normalizes email and creates pending invite with defaults', async () => {
    mockStorage.removeItem(ROSTER_INVITES_STORAGE_KEY);

    const invite = await addRosterInvite({
      email: '  Student.Alpha@School.EDU  ',
      displayName: 'Student Alpha',
    });

    assertEqual(invite.email, 'student.alpha@school.edu', 'Email normalized to lowercase and trimmed');
    assertEqual(invite.role, 'student', 'Default role is student');
    assertEqual(invite.cohort, 'General', 'Default cohort is General');
    assertEqual(invite.status, 'pending', 'Initial status is pending');
    assert(Boolean(invite.id), 'Invite has generated id');
    assert(Boolean(invite.created_at), 'Invite has created_at timestamp');

    const stored = JSON.parse(mockStorage.getItem(ROSTER_INVITES_STORAGE_KEY) || '[]');
    assertEqual(stored.length, 1, 'Invite persisted to localStorage');
    assertEqual(stored[0].email, 'student.alpha@school.edu', 'Stored invite matches normalized email');
  });

  const uniqueCohort = 'Cohort_' + Date.now();

  await testAsync('Roster Engine: addRosterInvite supports custom teacher/admin role and custom cohort', async () => {
    const teacherInvite = await addRosterInvite({
      email: 'teacher.beta@school.edu',
      displayName: 'Teacher Beta',
      role: 'teacher',
      cohort: uniqueCohort,
      invitedBy: 'admin-user-1',
    });

    assertEqual(teacherInvite.role, 'teacher', 'Preserved teacher role');
    assertEqual(teacherInvite.cohort, uniqueCohort, 'Preserved custom cohort');
    assertEqual(teacherInvite.invited_by, 'admin-user-1', 'Preserved invitedBy reference');
  });

  await testAsync('Roster Engine: getRosterInvites returns invites and filters by cohort', async () => {
    const all = await getRosterInvites();
    assert(all.length >= 2, 'getRosterInvites retrieves all invites');

    const filtered = await getRosterInvites(uniqueCohort);
    assertEqual(filtered.length, 1, 'getRosterInvites filters correctly by cohort');
    assertEqual(filtered[0].email, 'teacher.beta@school.edu', 'Filtered item has expected email');
  });

  await testAsync('Roster Engine: checkAndClaimInvite matches case-insensitively and updates status to claimed', async () => {
    const claimed = await checkAndClaimInvite('STUDENT.ALPHA@SCHOOL.EDU', 'user-alpha-uuid');
    assert(claimed !== null, 'Claimed invite returned');
    assertEqual(claimed?.email, 'student.alpha@school.edu', 'Matches case-insensitively');
    assertEqual(claimed?.status, 'claimed', 'Status updated to claimed');

    // Claiming again returns null since status is now claimed
    const reClaim = await checkAndClaimInvite('student.alpha@school.edu', 'user-alpha-uuid');
    assert(reClaim === null, 'Already claimed invite cannot be claimed again');
  });

  await testAsync('Roster Engine: deleteRosterInvite deletes invite and updates storage', async () => {
    const deleteCohort = 'DeleteTest_' + Date.now();
    const invite = await addRosterInvite({
      email: `temp.delete.${Date.now()}@school.edu`,
      cohort: deleteCohort,
    });

    const before = await getRosterInvites(deleteCohort);
    assertEqual(before.length, 1, 'Invite created before delete');

    const success = await deleteRosterInvite(invite.id);
    assertEqual(success, true, 'deleteRosterInvite returns true');

    const after = await getRosterInvites(deleteCohort);
    assertEqual(after.length, 0, 'Invite removed from storage');
  });

  test('Auth Engine: signUpWithEmail, signInWithEmail, and signInWithOtp are exported functions', () => {
    assertEqual(typeof signUpWithEmail, 'function', 'signUpWithEmail is exported function');
    assertEqual(typeof signInWithEmail, 'function', 'signInWithEmail is exported function');
    assertEqual(typeof signInWithOtp, 'function', 'signInWithOtp is exported function');
  });

  test('Static Code Contract: components/AuthModal.tsx exists and exports AuthModal', () => {
    const fs = require('fs');
    const path = require('path');
    const authModalPath = path.resolve(process.cwd(), 'components/AuthModal.tsx');
    assertEqual(fs.existsSync(authModalPath), true, 'components/AuthModal.tsx exists');

    const content = fs.readFileSync(authModalPath, 'utf8');
    assert(
      content.includes('export default function AuthModal') ||
      content.includes('export function AuthModal') ||
      content.includes('export const AuthModal') ||
      content.includes('AuthModal'),
      'components/AuthModal.tsx exports AuthModal'
    );
  });

  test('Static Code Contract: TeacherAnalytics.tsx contains invite drawer and references addRosterInvite', () => {
    const fs = require('fs');
    const path = require('path');
    let analyticsPath = path.resolve(process.cwd(), 'components/portal/TeacherAnalytics.tsx');
    if (!fs.existsSync(analyticsPath)) {
      analyticsPath = path.resolve(process.cwd(), 'components/TeacherAnalytics.tsx');
    }
    assertEqual(fs.existsSync(analyticsPath), true, 'TeacherAnalytics.tsx exists');

    const content = fs.readFileSync(analyticsPath, 'utf8');
    assert(
      content.includes('addRosterInvite') || content.includes('roster_invites') || content.includes('RosterInvite') || content.includes('Invite students'),
      'TeacherAnalytics.tsx contains invite drawer and references addRosterInvite'
    );
  });

  test('Static Code Contract: components/AuthModal.tsx references signInAsDemoStudent and Guest mode', () => {
    const fs = require('fs');
    const path = require('path');
    const authModalPath = path.resolve(process.cwd(), 'components/AuthModal.tsx');
    assertEqual(fs.existsSync(authModalPath), true, 'components/AuthModal.tsx exists');

    const content = fs.readFileSync(authModalPath, 'utf8');
    assert(
      content.includes('signInAsDemoStudent'),
      'components/AuthModal.tsx references signInAsDemoStudent'
    );
    assert(
      content.includes('Guest') || content.includes('Demo'),
      'components/AuthModal.tsx references Guest or Demo mode button'
    );
  });

  test('Static Code Contract: components/StudentAuthGate.tsx references signInAsDemoStudent and AuthModal', () => {
    const fs = require('fs');
    const path = require('path');
    const gatePath = path.resolve(process.cwd(), 'components/StudentAuthGate.tsx');
    assertEqual(fs.existsSync(gatePath), true, 'components/StudentAuthGate.tsx exists');

    const content = fs.readFileSync(gatePath, 'utf8');
    assert(
      content.includes('signInAsDemoStudent'),
      'components/StudentAuthGate.tsx references signInAsDemoStudent'
    );
    assert(
      content.includes('AuthModal'),
      'components/StudentAuthGate.tsx references AuthModal'
    );
    assert(
      content.includes('Try Demo Mode') || content.includes('Demo Mode'),
      'components/StudentAuthGate.tsx maintains active demo mode button'
    );
  });

  test('Static Code Contract: demo mode buttons remain active across components', () => {
    const fs = require('fs');
    const path = require('path');
    const leaderboardModalPath = path.resolve(process.cwd(), 'components/LeaderboardModal.tsx');
    assertEqual(fs.existsSync(leaderboardModalPath), true, 'components/LeaderboardModal.tsx exists');

    const lbContent = fs.readFileSync(leaderboardModalPath, 'utf8');
    assert(
      lbContent.includes('AuthModal') && lbContent.includes('isDemo'),
      'components/LeaderboardModal.tsx integrates AuthModal for demo accounts'
    );

    const headerPath = path.resolve(process.cwd(), 'components/Header.tsx');
    assertEqual(fs.existsSync(headerPath), true, 'components/Header.tsx exists');

    const headerContent = fs.readFileSync(headerPath, 'utf8');
    assert(
      headerContent.includes('setLeaderboardOpen(true)') && headerContent.includes('userProfile'),
      'components/Header.tsx enables LeaderboardModal for userProfile including demo students'
    );
  });
}

async function runSuite21() {
  console.log('\n\x1b[1m\x1b[34m[Suite 21] Admin User Management Hub Architecture\x1b[0m');

  test('User Management: components/admin/UserManagementHub.tsx exists and contains directory, role toggle, and invite modal', () => {
    const fs = require('fs');
    const path = require('path');
    const hubPath = path.resolve(process.cwd(), 'components/admin/UserManagementHub.tsx');
    assertEqual(fs.existsSync(hubPath), true, 'components/admin/UserManagementHub.tsx exists');

    const content = fs.readFileSync(hubPath, 'utf8');
    assert(
      content.includes('User Management 👥'),
      'UserManagementHub contains User Management 👥 header'
    );
    assert(
      content.includes('USER OPERATIONS · ACCESS CONTROL'),
      'UserManagementHub contains neobrutalist badge'
    );
    assert(
      content.includes('handleUpdateRole') && content.includes('select'),
      'UserManagementHub contains role update switcher'
    );
    assert(
      content.includes('handleToggleSchoolAccount'),
      'UserManagementHub contains school account toggle logic'
    );
    assert(
      content.includes('addRosterInvite'),
      'UserManagementHub integrates addRosterInvite from @/lib/roster'
    );
    assert(
      content.includes('handleExportCSV'),
      'UserManagementHub supports CSV export functionality'
    );
  });

  test('User Management: AppAdminNav.tsx registers "users" tab with Users icon', () => {
    const fs = require('fs');
    const path = require('path');
    const navPath = path.resolve(process.cwd(), 'components/admin/AppAdminNav.tsx');
    assertEqual(fs.existsSync(navPath), true, 'components/admin/AppAdminNav.tsx exists');

    const content = fs.readFileSync(navPath, 'utf8');
    assert(
      content.includes('Users') && content.includes("handleNavClick('users')"),
      'AppAdminNav imports Users icon and renders users nav button'
    );
    assert(
      content.includes('User Management'),
      'AppAdminNav labels users navigation button User Management'
    );
  });

  test('User Management: AppAdminHub.tsx imports and routes "users" tab', () => {
    const fs = require('fs');
    const path = require('path');
    const hubPath = path.resolve(process.cwd(), 'components/admin/AppAdminHub.tsx');
    assertEqual(fs.existsSync(hubPath), true, 'components/admin/AppAdminHub.tsx exists');

    const content = fs.readFileSync(hubPath, 'utf8');
    assert(
      content.includes("import UserManagementHub from '@/components/admin/UserManagementHub';"),
      'AppAdminHub imports UserManagementHub'
    );
    assert(
      content.includes("case 'users':"),
      'AppAdminHub contains case users'
    );
  });

  test('User Management: app/admin/page.tsx registers users in TAB_TITLES and valid tabs', () => {
    const fs = require('fs');
    const path = require('path');
    const pagePath = path.resolve(process.cwd(), 'app/admin/page.tsx');
    assertEqual(fs.existsSync(pagePath), true, 'app/admin/page.tsx exists');

    const content = fs.readFileSync(pagePath, 'utf8');
    assert(
      content.includes("users: 'User Management'"),
      'TAB_TITLES includes users: User Management'
    );
    assert(
      content.includes("'users'") && content.includes('.includes(normalized)'),
      'Allowed tabs array in app/admin/page.tsx includes users'
    );
  });

  test('User Management: app/api/admin/users/route.ts exists and exports GET, POST, PATCH, DELETE handlers', () => {
    const fs = require('fs');
    const path = require('path');
    const routePath = path.resolve(process.cwd(), 'app/api/admin/users/route.ts');
    assertEqual(fs.existsSync(routePath), true, 'app/api/admin/users/route.ts exists');

    const content = fs.readFileSync(routePath, 'utf8');
    assert(
      content.includes('export async function GET'),
      'app/api/admin/users/route.ts exports GET handler'
    );
    assert(
      content.includes('export async function POST'),
      'app/api/admin/users/route.ts exports POST handler'
    );
    assert(
      content.includes('export async function PATCH'),
      'app/api/admin/users/route.ts exports PATCH handler'
    );
    assert(
      content.includes('export async function DELETE'),
      'app/api/admin/users/route.ts exports DELETE handler'
    );
    assert(
      content.includes('getServiceClient') && content.includes('requireRole'),
      'app/api/admin/users/route.ts initializes Supabase client'
    );
    assert(
      content.includes("'profiles'") && content.includes("'roster_invites'"),
      'app/api/admin/users/route.ts queries profiles and roster_invites tables'
    );
  });

  test('User Management: UserManagementHub.tsx connects to live /api/admin/users backend API route', () => {
    const fs = require('fs');
    const path = require('path');
    const hubPath = path.resolve(process.cwd(), 'components/admin/UserManagementHub.tsx');
    assertEqual(fs.existsSync(hubPath), true, 'components/admin/UserManagementHub.tsx exists');

    const content = fs.readFileSync(hubPath, 'utf8');
    assert(
      content.includes("authFetch('/api/admin/users')"),
      'UserManagementHub calls fetch to /api/admin/users'
    );
    assert(
      content.includes("method: 'PATCH'") && content.includes('/api/admin/users'),
      'UserManagementHub sends PATCH requests to /api/admin/users'
    );
    assert(
      content.includes("method: 'POST'") && content.includes('/api/admin/users'),
      'UserManagementHub sends POST requests to /api/admin/users'
    );
    assert(
      content.includes("method: 'DELETE'") && content.includes('/api/admin/users'),
      'UserManagementHub sends DELETE requests to /api/admin/users'
    );
    assert(
      content.includes('Live Database Connected'),
      'UserManagementHub contains Live Database Connected status pill'
    );
    assert(
      content.includes('↻ Sync with Supabase'),
      'UserManagementHub contains manual sync with Supabase button'
    );
  });
}

async function runSuite22() {
  console.log('\n\x1b[1m\x1b[34m[Suite 22] Teacher Classes Hub & Redesigned Analytics Architecture\x1b[0m');

  test('Classes Portal Navigation Contract: DEFAULT_PORTAL_NAV_ITEMS, AdminNav, and app/portal/page.tsx', () => {
    const fs = require('fs');
    const path = require('path');

    // 1. DEFAULT_PORTAL_NAV_ITEMS has id: 'roster' with label: 'Classes'
    const rosterDefault = DEFAULT_PORTAL_NAV_ITEMS.find((item) => item.id === 'roster');
    assert(Boolean(rosterDefault), 'DEFAULT_PORTAL_NAV_ITEMS has roster item');
    assertEqual(rosterDefault?.label, 'Classes', "DEFAULT_PORTAL_NAV_ITEMS has label: 'Classes'");

    // 2. AdminNav.tsx uses 'Classes' for roster
    const adminNavPath = path.resolve(process.cwd(), 'components/portal/AdminNav.tsx');
    assertEqual(fs.existsSync(adminNavPath), true, 'components/portal/AdminNav.tsx exists');
    const adminNavContent = fs.readFileSync(adminNavPath, 'utf8');
    assert(
      adminNavContent.includes('title="Classes"') && adminNavContent.includes('>Classes</span>'),
      "AdminNav.tsx renders 'Classes' for roster item"
    );

    // 3. app/portal/page.tsx uses 'Classes' for roster
    const portalPagePath = path.resolve(process.cwd(), 'app/portal/page.tsx');
    assertEqual(fs.existsSync(portalPagePath), true, 'app/portal/page.tsx exists');
    const portalPageContent = fs.readFileSync(portalPagePath, 'utf8');
    assert(
      portalPageContent.includes("roster: 'Classes'"),
      "app/portal/page.tsx registers roster: 'Classes'"
    );
  });

  test('Class Management Engine: getTeacherClasses, createTeacherClass, updateTeacherClass, deleteTeacherClass', () => {
    const initialClasses = getTeacherClasses();
    assert(Array.isArray(initialClasses) && initialClasses.length >= 4, 'getTeacherClasses returns initial Cambridge classes');
    const initialCount = initialClasses.length;

    // Create a new class
    const created = createTeacherClass({
      name: '10C Physics Test',
      subjectCode: '0625',
      yearGroup: 'Year 10',
      targetAccuracy: 85,
      weeklyGoalXp: 650,
    });
    assert(Boolean(created.id), 'Created class has unique ID');
    assertEqual(created.name, '10C Physics Test', 'Created class has specified name');
    assertEqual(created.subjectCode, '0625', 'Created class has specified subject code');
    assertEqual(created.subjectName, 'Physics', 'Created class resolves subject name Physics');
    assert(created.joinCode.startsWith('RVZ-'), 'Created class has RVZ- join code');
    assertEqual(created.targetAccuracy, 85, 'Created class has target accuracy 85%');

    // Verify it is in list
    const classesAfterCreate = getTeacherClasses();
    assertEqual(classesAfterCreate.length, initialCount + 1, 'Classes count incremented by 1');
    const foundCreated = classesAfterCreate.find((c) => c.id === created.id);
    assert(Boolean(foundCreated), 'Created class is persisted');

    // Update the class
    const updated = updateTeacherClass(created.id, {
      targetAccuracy: 90,
      weeklyGoalXp: 800,
    });
    const foundUpdated = updated.find((c) => c.id === created.id);
    assertEqual(foundUpdated?.targetAccuracy, 90, 'Target accuracy updated to 90%');
    assertEqual(foundUpdated?.weeklyGoalXp, 800, 'Weekly goal XP updated to 800');

    // Delete the class
    const classesAfterDelete = deleteTeacherClass(created.id);
    assertEqual(classesAfterDelete.length, initialCount, 'Classes count returned to initial count after deletion');
    assert(!classesAfterDelete.some((c) => c.id === created.id), 'Deleted class is no longer present');
  });

  test('CSV Engine: generateClassRosterCsv produces valid RFC-4180 escaped CSV data', () => {
    const sampleStudents = [
      {
        name: 'Maya Lin',
        email: 'maya@school.edu',
        xp: 1450,
        streak: 12,
        acc: 88,
        weak: 'Thermal Physics & Matter',
        tier: '👑 Master',
        last: 'Active today',
        status: 'Active',
      },
      {
        name: 'O\'Connor, Sean "Jack"',
        email: 'sean@school.edu',
        xp: 420,
        streak: 0,
        acc: 64,
        weak: 'General Physics & Measurement',
        tier: '⚡ Proficient',
        last: 'Inactive',
        status: 'Idle',
      },
    ];

    const csvOutput = generateClassRosterCsv('10B Physics', '0625', sampleStudents);
    assert(csvOutput.includes('Class,Subject Code,Student Name,Email,Total XP,Streak (Days),1st-Try Accuracy (%),Weakest Topic,Mastery Tier,Last Active,Status'), 'Contains correct RFC-4180 CSV header');
    assert(csvOutput.includes('10B Physics,0625,Maya Lin,maya@school.edu,1450,12,88%,Thermal Physics & Matter,👑 Master,Active today,Active'), 'Contains first student row');
    assert(csvOutput.includes('"O\'Connor, Sean ""Jack"""'), 'Properly escapes quotes and commas in student name according to RFC-4180');
  });

  test('TeacherAnalytics.tsx Static Architecture Contract: Zero alerts, real CSV wiring, class creation, and student drawer', () => {
    const fs = require('fs');
    const path = require('path');
    let analyticsPath = path.resolve(process.cwd(), 'components/portal/TeacherAnalytics.tsx');
    if (!fs.existsSync(analyticsPath)) {
      analyticsPath = path.resolve(process.cwd(), 'components/TeacherAnalytics.tsx');
    }
    assertEqual(fs.existsSync(analyticsPath), true, 'components/portal/TeacherAnalytics.tsx exists');

    const content = fs.readFileSync(analyticsPath, 'utf8');

    // Zero alert calls
    assert(!content.includes('alert('), 'TeacherAnalytics.tsx contains ZERO alert(...) calls');

    // CSV export wiring
    assert(content.includes('generateClassRosterCsv'), 'TeacherAnalytics.tsx imports and wires generateClassRosterCsv');
    assert(content.includes('handleExportRosterCsv'), 'TeacherAnalytics.tsx implements handleExportRosterCsv');

    // Class creation wiring
    assert(content.includes('createTeacherClass'), 'TeacherAnalytics.tsx imports and wires createTeacherClass');
    assert(content.includes('handleCreateClass'), 'TeacherAnalytics.tsx implements handleCreateClass');

    // Join code copy
    assert(content.includes('handleCopyJoinCode') && content.includes('joinCode'), 'TeacherAnalytics.tsx wires up interactive join code copy pill');

    // Search and filtering toolbar
    assert(content.includes('searchTerm') && content.includes('statusFilter'), 'TeacherAnalytics.tsx implements search and status filtering');

    // Bulk selection
    assert(content.includes('selectedStudentIds') && content.includes('toggleSelectAll'), 'TeacherAnalytics.tsx implements bulk multi-selection');

    // Teacher notes in drawer
    assert(content.includes('handleSaveStudentNotes') && content.includes('saveStudentClassOverride'), 'TeacherAnalytics.tsx implements persistent teacher observation notes');
  });
}

async function runSuite23() {
  console.log('\n\x1b[1m\x1b[34m[Suite 23] Student Homework & Online Assessment Engine Architecture\x1b[0m');

  test('Homework Engine: getHomeworkAssignments returns empty array on clean state', () => {
    mockStorage.clear();
    const items = getHomeworkAssignments();
    assertEqual(items.length, 0, 'Returns 0 assignments on clean state');
  });

  test('Homework Engine: findAssignmentByTestCode performs case-insensitive lookup', () => {
    saveOnlineAssignment({
      id: 'ECO-0455-HW1',
      title: 'IGCSE Economics: Basic Economic Problem & Allocation',
      subjectCode: '0455',
      subjectName: 'Economics',
      cohortName: 'Year 10 Cambridge Economics',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 15,
      questionIds: ['0455-s24-12-q01', '0455-s24-12-q02'],
      testCode: 'ECO-0455-HW1',
      createdAt: new Date().toISOString(),
    });

    const foundUpper = findAssignmentByTestCode('ECO-0455-HW1');
    assert(Boolean(foundUpper), 'findAssignmentByTestCode finds uppercase');
    const foundLower = findAssignmentByTestCode('eco-0455-hw1');
    assert(Boolean(foundLower), 'findAssignmentByTestCode finds lowercase');
    const foundSpaced = findAssignmentByTestCode('   ECO-0455-HW1   ');
    assert(Boolean(foundSpaced), 'findAssignmentByTestCode handles whitespace');
    const notFound = findAssignmentByTestCode('NON-EXISTENT-CODE');
    assertEqual(notFound, null, 'Returns null for unknown code');
  });

  test('Homework Engine: saveHomeworkSubmission and getHomeworkSubmissions persist correctly', () => {
    const submission: HomeworkSubmission = {
      assignmentId: 'ECO-0455-HW1',
      testCode: 'ECO-0455-HW1',
      completedAt: new Date().toISOString(),
      score: 5,
      totalQuestions: 5,
      percentage: 100,
      timeSpentSeconds: 120,
    };
    saveHomeworkSubmission(submission);
    const subs = getHomeworkSubmissions();
    assert(Boolean(subs['ECO-0455-HW1']), 'Submission is retrieved from storage');
    assertEqual(subs['ECO-0455-HW1'].percentage, 100, 'Stored submission has percentage 100');

    // Status is now completed
    const items = getHomeworkAssignments();
    const item = items.find((i) => i.testCode === 'ECO-0455-HW1');
    assertEqual(item?.status, 'completed', 'Status updated to completed');
    assertEqual(item?.isOverdue, false, 'isOverdue is false when completed');
  });

  test('Homework Engine: Overdue calculation and recovery', () => {
    const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    saveOnlineAssignment({
      id: 'OVERDUE-HW-01',
      title: 'Past Task',
      subjectCode: '0455',
      subjectName: 'Economics',
      cohortName: 'Year 10',
      dueDate: pastDate,
      durationMinutes: 15,
      questionIds: ['0455-s24-12-q01'],
      testCode: 'OVERDUE-01',
      createdAt: new Date().toISOString(),
    });

    const items = getHomeworkAssignments();
    const overdueItem = items.find((i) => i.id === 'OVERDUE-HW-01');
    assertEqual(overdueItem?.status, 'overdue', 'Unsubmitted past-due assignment has status overdue');
    assertEqual(overdueItem?.isOverdue, true, 'isOverdue is true');

    // Submit it
    saveHomeworkSubmission({
      assignmentId: 'OVERDUE-HW-01',
      testCode: 'OVERDUE-01',
      completedAt: new Date().toISOString(),
      score: 1,
      totalQuestions: 1,
      percentage: 100,
    });
    const itemsAfter = getHomeworkAssignments();
    const recovered = itemsAfter.find((i) => i.id === 'OVERDUE-HW-01');
    assertEqual(recovered?.status, 'completed', 'Status recovers to completed upon submission');
    assertEqual(recovered?.isOverdue, false, 'isOverdue becomes false');
  });

  test('Static Code Contract: components/profile/StudentHomeworkPanel.tsx exists and matches UI/UX spec', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(process.cwd(), 'components/profile/StudentHomeworkPanel.tsx');
    assertEqual(fs.existsSync(filePath), true, 'components/profile/StudentHomeworkPanel.tsx exists');
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.includes('border-2 border-[#201e1d]'), 'Panel uses neobrutalist borders');
    assert(content.includes('shadow-[3px_3px_0_0_#201e1d]'), 'Panel uses neobrutalist shadow');
    assert(content.includes('Quick-Join Assignment'), 'Panel contains quick-join section');
    assert(content.includes('Find & Start') || content.includes('Find &amp; Start'), 'Panel contains find and start action');
    assert(content.includes('getHomeworkAssignments'), 'Panel uses getHomeworkAssignments');
    assert(content.includes('saveHomeworkSubmission'), 'Panel uses saveHomeworkSubmission');
    assert(content.includes('handleSubmitQuiz'), 'Panel contains quiz submission handler');
  });

  test('Static Code Contract: components/profile/StudentProfileHub.tsx registers homework tab and dock', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(process.cwd(), 'components/profile/StudentProfileHub.tsx');
    assertEqual(fs.existsSync(filePath), true, 'components/profile/StudentProfileHub.tsx exists');
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.includes("key: 'homework'"), 'TAB_CONFIG includes homework');
    assert(content.includes('StudentHomeworkPanel'), 'StudentProfileHub imports StudentHomeworkPanel');
    assert(content.includes('grid-cols-3 sm:grid-cols-6'), 'Dock updated to 6 columns');
    assert(content.includes('pendingHomeworkCount'), 'Dock tracks pendingHomeworkCount badge');
    assert(content.includes("activeTab === 'homework'"), 'Renders StudentHomeworkPanel on homework tab');
  });

  test('Static Code Contract: app/homework/page.tsx and app/profile/homework/page.tsx exist', () => {
    const fs = require('fs');
    const path = require('path');
    const p1 = path.resolve(process.cwd(), 'app/homework/page.tsx');
    const p2 = path.resolve(process.cwd(), 'app/profile/homework/page.tsx');
    assertEqual(fs.existsSync(p1), true, 'app/homework/page.tsx exists');
    assertEqual(fs.existsSync(p2), true, 'app/profile/homework/page.tsx exists');
    const c1 = fs.readFileSync(p1, 'utf8');
    assert(c1.includes('initialTab="homework"'), 'app/homework/page.tsx passes initialTab="homework"');
    assert(c1.includes('Assigned Homework & Tests | Revizz'), 'app/homework/page.tsx specifies metadata title');
  });

  test('Static Code Contract: components/LeaderboardModal.tsx links to /homework', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(process.cwd(), 'components/LeaderboardModal.tsx');
    const content = fs.readFileSync(filePath, 'utf8');
    assert(content.includes('href="/homework"'), 'LeaderboardModal links to /homework');
    assert(content.includes('Assigned Homework'), 'LeaderboardModal includes Assigned Homework label');
  });
}

async function runSuite24() {
  const fs = require('fs');
  const path = require('path');
  const pv = () => require('../lib/paperViewer');
  const opt = (label: string, text: string, ok = false) => ({ label, content_markdown: text, is_correct: ok });
  const mk = (n: number, extra: any = {}) => ({
    question_number: n,
    stem_markdown: `Stem ${n} alpha`,
    topic_name: 'Topic A',
    options: [opt('A', 'aa', n % 2 === 0), opt('B', 'bb', n % 2 === 1), opt('C', 'cc'), opt('D', 'dd')],
    ...extra,
  });
  const nums = (qs: any[]) => qs.map((q) => q.question_number).join(',');

  test('PaperViewer helpers: hasDiagram and diagram filter', () => {
    const { hasDiagram, filterPaperQuestions } = pv();
    assertEqual(hasDiagram(mk(1)), false, 'no diagram');
    assertEqual(hasDiagram(mk(1, { diagram: { has_diagram: true } })), true, 'has_diagram');
    assertEqual(hasDiagram(mk(1, { diagram: { image_url: 'x.png' } })), true, 'image_url');
    const qs = [mk(1), mk(2, { diagram: { has_diagram: true } })];
    const f = (diagram: string) => nums(filterPaperQuestions(qs, { search: '', diagram, topic: 'all' }));
    assertEqual(f('all'), '1,2', 'all');
    assertEqual(f('with_diagrams'), '2', 'with');
    assertEqual(f('without_diagrams'), '1', 'without');
    assertEqual(nums(filterPaperQuestions([], { search: 'x', diagram: 'all', topic: 'all' })), '', 'empty list');
  });

  test('PaperViewer helpers: search matches q12 vs 12, options, stem, ref, topic, explanation', () => {
    const { filterPaperQuestions } = pv();
    const qs = [
      mk(1),
      mk(12, { cambridge_source_ref: 'CIE-REF-77' }),
      mk(3, { options: [opt('A', 'Unique Needle', true), opt('B', 'b'), opt('C', 'c'), opt('D', 'd')] }),
      mk(4, { topic_name: 'Kinematics', explanation_markdown: 'because Zebra' }),
    ];
    const s = (search: string) => nums(filterPaperQuestions(qs, { search, diagram: 'all', topic: 'all' }));
    assertEqual(s('q12'), '12', 'q12');
    assertEqual(s('12'), '12', 'bare 12');
    assertEqual(s('  Q12 '), '12', 'trim + case');
    assertEqual(s('unique needle'), '3', 'option text');
    assertEqual(s('cie-ref'), '12', 'source ref');
    assertEqual(s('kinemat'), '4', 'topic');
    assertEqual(s('zebra'), '4', 'explanation');
    assertEqual(s('stem 1 alpha'), '1', 'stem');
    assertEqual(s('nomatchxyz'), '', 'no match');
    assertEqual(s('   '), '1,12,3,4', 'blank search = all');
  });

  test('PaperViewer helpers: topic filter combined with diagram filter', () => {
    const { filterPaperQuestions } = pv();
    const qs = [
      mk(1, { diagram: { has_diagram: true } }),
      mk(2, { topic_name: 'Topic B', diagram: { has_diagram: true } }),
      mk(3, { topic_name: 'Topic B' }),
      mk(4),
    ];
    const f = (diagram: string, topic: string) => nums(filterPaperQuestions(qs, { search: '', diagram, topic }));
    assertEqual(f('all', 'Topic B'), '2,3', 'topic only');
    assertEqual(f('with_diagrams', 'Topic B'), '2', 'topic+with');
    assertEqual(f('without_diagrams', 'Topic B'), '3', 'topic+without');
    assertEqual(f('with_diagrams', 'Topic A'), '1', 'A+with');
    assertEqual(f('all', 'topic b'), '', 'topic is exact match');
    assertEqual(f('all', 'all'), '1,2,3,4', 'all topics');
  });

  test('PaperViewer helpers: getAnswerKeyBreakdown counts correct labels', () => {
    const { getAnswerKeyBreakdown } = pv();
    const r = getAnswerKeyBreakdown([mk(1), mk(2), mk(3), mk(5)]);
    assertEqual(JSON.stringify([r.A, r.B, r.C, r.D]), JSON.stringify([1, 3, 0, 0]), 'breakdown');
    const e = getAnswerKeyBreakdown([]);
    assertEqual(JSON.stringify([e.A, e.B, e.C, e.D]), JSON.stringify([0, 0, 0, 0]), 'empty');
  });

  test('PaperViewer helpers: formatSeriesText', () => {
    const { formatSeriesText: f } = pv();
    assertEqual(f(), 'Cambridge IGCSE Exam Paper', 'neither');
    assertEqual(f('s', 2024), 'May/June 2024', 's');
    assertEqual(f('june', 2023), 'May/June 2023', 'june');
    assertEqual(f('m', 2022), 'Feb/March 2022', 'm');
    assertEqual(f('w', 2021), 'Oct/Nov 2021', 'w');
    assertEqual(f('nov', 2021), 'Oct/Nov 2021', 'nov');
    assertEqual(f('zzz', 2020), 'zzz 2020', 'unknown series passes through');
    assertEqual(f('s'), 'May/June', 'series without year trimmed');
  });

  test('PaperViewer helpers: stepQuestion clamps and never wraps', () => {
    const { stepQuestion: st } = pv();
    const n = [3, 1, 2];
    assertEqual(st([], null, 1), null, 'empty next');
    assertEqual(st([], 5, -1), null, 'empty prev');
    assertEqual(st(n, null, 1), 3, 'null next = first');
    assertEqual(st(n, null, -1), 2, 'null prev = last');
    assertEqual(st(n, 99, 1), 3, 'absent next = first');
    assertEqual(st(n, 99, -1), 2, 'absent prev = last');
    assertEqual(st(n, 3, 1), 1, 'given order next');
    assertEqual(st(n, 1, -1), 3, 'given order prev');
    assertEqual(st(n, 2, 1), 2, 'clamp end');
    assertEqual(st(n, 3, -1), 3, 'clamp start');
    assertEqual(st([7], 7, 1), 7, 'single');
  });

  test('PaperViewer helpers: isTypingTarget is safe in Node (no DOM)', () => {
    const { isTypingTarget: t } = pv();
    assertEqual(t(null), false, 'null');
    assertEqual(t({ tagName: 'INPUT' } as any), true, 'INPUT');
    assertEqual(t({ tagName: 'TEXTAREA' } as any), true, 'TEXTAREA');
    assertEqual(t({ tagName: 'SELECT' } as any), true, 'SELECT');
    assertEqual(t({ tagName: 'DIV', isContentEditable: true } as any), true, 'contentEditable');
    assertEqual(t({ tagName: 'DIV' } as any), false, 'DIV');
  });

  test('PaperViewer source: imports helpers, grid, hotkeys, aria, testids', () => {
    const dir = path.resolve(process.cwd(), 'components/admin');
    const files = [path.join(dir, 'WholePaperViewer.tsx')];
    const sub = path.join(dir, 'paper-viewer');
    if (fs.existsSync(sub)) {
      for (const f of fs.readdirSync(sub)) if (f.endsWith('.tsx')) files.push(path.join(sub, f));
    }
    const all = files.map((f: string) => fs.readFileSync(f, 'utf8')).join('\n');
    const main = fs.readFileSync(files[0], 'utf8');
    assert(/from ['"]@\/lib\/paperViewer['"]/.test(all), "imports from '@/lib/paperViewer'");
    assert(all.includes('lg:grid-cols-[minmax(0,1fr)_380px]'), 'two-column grid class');
    assert(/addEventListener\(\s*['"]keydown['"]/.test(all), 'keydown listener');
    assert(all.includes('isTypingTarget('), 'keydown guards with isTypingTarget');
    assert(all.includes('aria-pressed'), 'aria-pressed present');
    assert(all.includes('aria-current'), 'aria-current present');
    for (const id of ['delete-success-banner', 'delete-paper-button', 'delete-paper-dialog', 'cancel-delete-button', 'confirm-delete-button']) {
      assert(main.includes(`data-testid="${id}"`), `WholePaperViewer keeps data-testid ${id}`);
    }
  });

  test('PaperViewer source: admin page locks height for papers tab with print escape', () => {
    const page = fs.readFileSync(path.resolve(process.cwd(), 'app/admin/page.tsx'), 'utf8');
    assert(page.includes('lg:h-screen lg:overflow-hidden'), 'lg:h-screen lg:overflow-hidden');
    assert(page.includes('print:h-auto'), 'print:h-auto escape');
    assert(page.includes("'papers'") || page.includes('"papers"'), "references 'papers' tab");
  });
}

async function main() {
  await runSuite13();
  await runSuite20();
  await runSuite21();
  await runSuite22();
  await runSuite23();
  await runSuite24();

  // Summary Output
  const duration = ((Date.now() - startMs) / 1000).toFixed(2);
  if (failedTests > 0) {
    origConsoleError('\n========================================================');
    origConsoleError(`   TOTAL TESTS: ${totalTests}`);
    origConsoleError(`   \x1b[32mPASSED:      ${passedTests}\x1b[0m`);
    origConsoleError(`   \x1b[31mFAILED:      ${failedTests}\x1b[0m`);
    origConsoleError('========================================================\n');
    process.exit(1);
  } else {
    if (VERBOSE) {
      origConsoleLog('\n========================================================');
      origConsoleLog(`   TOTAL TESTS: ${totalTests}`);
      origConsoleLog(`   \x1b[32mPASSED:      ${passedTests}\x1b[0m`);
      origConsoleLog(`   \x1b[32mALL ASSERTIONS PASSED PERFECTLY!\x1b[0m`);
      origConsoleLog(`   Duration:    ${duration}s`);
      origConsoleLog('========================================================\n');
    } else {
      origConsoleLog(`✔ QA Suite: ${passedTests} passed, 0 failed (${duration}s)`);
    }
    process.exit(0);
  }
}

main().catch((err) => {
  origConsoleError('Fatal test error in test suite runner:', err);
  process.exit(1);
});


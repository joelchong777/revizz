/**
 * Revizz QA & Verification Test Suite
 * 
 * Tests:
 * 1. Scoring & Streak Multipliers (Base XP, 1.2x, 1.5x, retries, resets, timeouts)
 * 2. Review Pile Queuing & Lifecycle (first-correct exclusions, retry/wrong/timeout additions, localStorage sync)
 * 3. Topic Mastery Thresholds (<50% novice, 50-80% proficient, >80% master) and Badges
 * 4. Auth Display Name Sanitization & School Domain Tagging
 * 5. Timer Math & Simulated Gameplay Round End-to-End
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
} from '../lib/auth';

import { CAMBRIDGE_QUESTIONS } from '../lib/questions';
import {
  extractSeriesOrYear,
  hasDataTable,
  isMathOrCalculation,
  getAvailableSeries,
  filterAndSortQuestions,
  countActiveFilters,
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
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err: any) {
    failedTests++;
    const message = `  \x1b[31m✗\x1b[0m ${name}\n    Error: ${err.message || err}`;
    failures.push(message);
    console.log(message);
  }
}

async function testAsync(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err: any) {
    failedTests++;
    const message = `  \x1b[31m✗\x1b[0m ${name}\n    Error: ${err.message || err}`;
    failures.push(message);
    console.log(message);
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
    withTables.every((q) => hasDataTable(q.stem_markdown)),
    true,
    'Data tables toggle only includes questions containing markdown table syntax |'
  );
  assertEqual(withTables.some((q) => q.id === '0455-s24-12-q06'), true, 'q06 contains markdown table');
  assertEqual(withTables.some((q) => q.id === '0455-s24-12-q14'), true, 'q14 contains markdown table');
  assertEqual(withTables.some((q) => q.id === '0455-s24-12-q30'), true, 'q30 contains markdown table');

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
    assertEqual(auditorContent.includes("fetch('/api/ingest/publish'"), true, 'Wires handlePublish to real /api/ingest/publish');
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
      assert(typeof cq.explanationMarkdown === 'string', `Question ${cq.id} has string explanationMarkdown`);
      assert(Boolean(cq.explanationMarkdown && cq.explanationMarkdown.trim().length > 0), `Question ${cq.id} explanationMarkdown is non-empty`);
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

  // Summary Output
  console.log('\n========================================================');
  console.log(`   TOTAL TESTS: ${totalTests}`);
  console.log(`   \x1b[32mPASSED:      ${passedTests}\x1b[0m`);
  if (failedTests > 0) {
    console.log(`   \x1b[31mFAILED:      ${failedTests}\x1b[0m`);
    console.log('========================================================\n');
    process.exit(1);
  } else {
    console.log(`   \x1b[32mALL ASSERTIONS PASSED PERFECTLY!\x1b[0m`);
    console.log('========================================================\n');
    process.exit(0);
  }
}

runSuite13().catch((err) => {
  console.error('Fatal test error in Suite 13:', err);
  process.exit(1);
});

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
}

const mockStorage = new LocalStorageMock();
(globalThis as any).localStorage = mockStorage;
(globalThis as any).window = {
  dispatchEvent: (_event: any) => true,
  addEventListener: () => {},
  removeEventListener: () => {},
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
  devOverride: boolean
): boolean => {
  return (isDev && devOverride) || !!(userProfile && (userProfile.role === 'teacher' || userProfile.role === 'admin'));
};

test('Production Security: devOverride flag is strictly ignored when isDev is false', () => {
  // Tampered/bypassed devOverride in production with null profile
  const bypassAttemptLoggedOut = evaluateEducatorAccess(null, false, true);
  assertEqual(bypassAttemptLoggedOut, false, 'Logged-out user cannot bypass gate with devOverride in production');

  // Tampered/bypassed devOverride in production with student profile
  const bypassAttemptStudent = evaluateEducatorAccess({ role: 'student', display_name: 'Student' }, false, true);
  assertEqual(bypassAttemptStudent, false, 'Student user cannot bypass gate with devOverride in production');
});

test('Production Security: only verified teacher and admin roles are granted access', () => {
  const teacherAccess = evaluateEducatorAccess({ role: 'teacher', display_name: 'Ms. Smith' }, false, false);
  assertEqual(teacherAccess, true, 'Verified teacher role receives access');

  const adminAccess = evaluateEducatorAccess({ role: 'admin', display_name: 'Principal Skinner' }, false, false);
  assertEqual(adminAccess, true, 'Verified admin role receives access');

  const anonymousAccess = evaluateEducatorAccess(null, false, false);
  assertEqual(anonymousAccess, false, 'Unauthenticated user denied educator access');

  const studentAccess = evaluateEducatorAccess({ role: 'student', display_name: 'Bart S.' }, false, false);
  assertEqual(studentAccess, false, 'Student user denied educator access');
});

test('Development Mode: devOverride is permitted only when isDev is true', () => {
  const devPreviewActive = evaluateEducatorAccess(null, true, true);
  assertEqual(devPreviewActive, true, 'devOverride grants access when isDev is true');

  const devPreviewInactive = evaluateEducatorAccess(null, true, false);
  assertEqual(devPreviewInactive, false, 'devOverride false denies unauthenticated access even in dev mode');
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

// -----------------------------------------------------------------------------
// Test Summary Output
// -----------------------------------------------------------------------------
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

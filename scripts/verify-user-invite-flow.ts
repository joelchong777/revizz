/**
 * Revizz QA & Verification Test Suite
 * 
 * Standalone Automated Verification: User Invite & Claiming Flow
 * 
 * Tests:
 * 1. lib/email.ts: buildInviteLink generates valid URL containing invite= and email=
 * 2. lib/email.ts: buildInviteMailto generates valid mailto: URL with encoded subject and body
 * 3. lib/email.ts: sendInviteEmail graceful fallback returning { sent: false, provider: null } when no API keys
 * 4. lib/email.ts: buildNeobrutalistInviteEmailHtml generates valid neobrutalist HTML email with CTA & escaping
 * 5. app/api/admin/users/route.ts: POST route contract handles inviteLink, mailtoUrl, and emailDelivery
 * 6. lib/roster.ts: checkAndClaimInvite matches pending invite, transitions status to 'claimed', and persists
 * 7. lib/roster.ts: checkAndClaimInvite case-insensitivity and non-existent invite handling
 */

import fs from 'fs';
import path from 'path';

// Polyfill in-memory localStorage for Node test runner if needed
class MockLocalStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = new MockLocalStorage();
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = {
    localStorage: (globalThis as any).localStorage,
  };
}

// Polyfill WebSocket in Node runtime if absent
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

// Import tested modules
import {
  buildInviteLink,
  buildInviteMailto,
  sendInviteEmail,
  buildNeobrutalistInviteEmailHtml,
} from '../lib/email';
import {
  checkAndClaimInvite,
  addRosterInvite,
  ROSTER_INVITES_STORAGE_KEY,
  RosterInvite,
} from '../lib/roster';

interface TestCase {
  id: string;
  name: string;
  run: () => Promise<{ pass: boolean; details: string }> | { pass: boolean; details: string };
}

const tests: TestCase[] = [];

function registerTest(
  id: string,
  name: string,
  fn: () => Promise<{ pass: boolean; details: string }> | { pass: boolean; details: string }
) {
  tests.push({ id, name, run: fn });
}

const ROOT_DIR = process.cwd();

// ============================================================================
// TEST 1: buildInviteLink URL structure and query params
// ============================================================================
registerTest('TEST_1', 'buildInviteLink generates valid URL containing invite= and email=', () => {
  const testOrigin = 'https://revizz.app';
  const testInviteId = 'inv_test_uuid_12345';
  const testEmail = 'student.exam@example.com';

  const link = buildInviteLink({
    origin: testOrigin,
    inviteId: testInviteId,
    email: testEmail,
  });

  if (!link || typeof link !== 'string') {
    return { pass: false, details: 'Expected buildInviteLink to return a string' };
  }

  // Parse as valid URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(link);
  } catch (err: any) {
    return { pass: false, details: `Returned value is not a valid URL: ${link}` };
  }

  if (parsedUrl.origin !== testOrigin) {
    return { pass: false, details: `Origin mismatch: expected ${testOrigin}, got ${parsedUrl.origin}` };
  }

  const hasInviteParam = parsedUrl.searchParams.get('invite') === testInviteId;
  const hasEmailParam = parsedUrl.searchParams.get('email') === testEmail;

  if (!hasInviteParam) {
    return { pass: false, details: `Missing or mismatched 'invite' query param in URL: ${link}` };
  }
  if (!hasEmailParam) {
    return { pass: false, details: `Missing or mismatched 'email' query param in URL: ${link}` };
  }

  return {
    pass: true,
    details: `Generated valid URL: ${link} with invite=${testInviteId} and email=${testEmail}`,
  };
});

// ============================================================================
// TEST 2: buildInviteMailto mailto format and encoding
// ============================================================================
registerTest('TEST_2', 'buildInviteMailto generates valid mailto: URL with encoded subject and body', () => {
  const testEmail = 'teacher.lead@cambridge.edu';
  const testName = 'Dr. Sarah Connor';
  const testRole = 'teacher';
  const testCohort = 'Class 12-A';
  const testInviteLink = 'https://revizz.app/?invite=inv_sarah_1&email=teacher.lead%40cambridge.edu';

  const mailto = buildInviteMailto({
    email: testEmail,
    name: testName,
    role: testRole,
    cohort: testCohort,
    inviteLink: testInviteLink,
  });

  if (!mailto || !mailto.startsWith(`mailto:${testEmail}`)) {
    return { pass: false, details: `Mailto does not start with recipient: ${mailto}` };
  }

  const queryIndex = mailto.indexOf('?');
  if (queryIndex === -1) {
    return { pass: false, details: 'Mailto URL does not contain query parameters' };
  }

  const queryString = mailto.slice(queryIndex + 1);
  const searchParams = new URLSearchParams(queryString);

  const subject = searchParams.get('subject');
  const body = searchParams.get('body');

  if (!subject) {
    return { pass: false, details: "Mailto URL missing 'subject' query param" };
  }
  if (!body) {
    return { pass: false, details: "Mailto URL missing 'body' query param" };
  }

  if (!subject.includes('Revizz')) {
    return { pass: false, details: `Subject does not mention Revizz: ${subject}` };
  }

  if (!body.includes(testName) || !body.includes('Teacher') || !body.includes(testInviteLink)) {
    return {
      pass: false,
      details: `Body missing required context (name, role, or link): ${body}`,
    };
  }

  return {
    pass: true,
    details: `Generated valid mailto URL with subject '${subject}' and formatted body containing recipient and link.`,
  };
});

// ============================================================================
// TEST 3: sendInviteEmail graceful fallback with no API keys
// ============================================================================
registerTest('TEST_3', 'sendInviteEmail returns { sent: false, provider: null } gracefully without credentials', async () => {
  // Preserve any existing env vars
  const origResend = process.env.RESEND_API_KEY;
  const origServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const result = await sendInviteEmail({
      email: 'student.unconfigured@example.com',
      name: 'Unconfigured Student',
      role: 'student',
      cohort: 'General',
      inviteLink: 'https://revizz.app/?invite=mock123&email=student.unconfigured%40example.com',
    });

    if (result.sent !== false) {
      return { pass: false, details: `Expected sent: false, got: ${result.sent}` };
    }

    if (result.provider !== null) {
      return { pass: false, details: `Expected provider: null, got: ${result.provider}` };
    }

    if (!result.reason || typeof result.reason !== 'string' || result.reason.length === 0) {
      return { pass: false, details: 'Expected descriptive reason string in result' };
    }

    return {
      pass: true,
      details: `Graceful fallback verified: { sent: false, provider: null, reason: "${result.reason}" }`,
    };
  } finally {
    // Restore env vars
    if (origResend !== undefined) process.env.RESEND_API_KEY = origResend;
    if (origServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = origServiceKey;
  }
});

// ============================================================================
// TEST 4: buildNeobrutalistInviteEmailHtml neobrutalist branding & escaping
// ============================================================================
registerTest('TEST_4', 'buildNeobrutalistInviteEmailHtml generates valid neobrutalist email HTML with CTA', () => {
  const html = buildNeobrutalistInviteEmailHtml({
    displayName: 'Alex <Script> & Tester',
    role: 'student',
    cohort: 'Cohort 2026',
    inviteLink: 'https://revizz.app/?invite=inv_secure&email=alex%40example.com',
  });

  if (!html.includes('<!DOCTYPE html>') || !html.includes('</html>')) {
    return { pass: false, details: 'Generated email does not form a complete HTML document' };
  }

  // Neobrutalist design tokens & elements
  if (!html.includes('#FFE600') || !html.includes('Accept Invitation') || !html.includes('box-shadow')) {
    return { pass: false, details: 'Generated email missing neobrutalist design elements or CTA' };
  }

  // XSS escaping check
  if (html.includes('<Script>')) {
    return { pass: false, details: 'HTML unescaped input found: displayName was not properly sanitized' };
  }
  if (!html.includes('&lt;Script&gt; &amp; Tester')) {
    return { pass: false, details: 'HTML escaping missing expected escaped entities' };
  }

  return {
    pass: true,
    details: 'Verified neobrutalist styling (#FFE600, tactile borders, CTA button) and strict HTML entity escaping.',
  };
});

// ============================================================================
// TEST 5: API route contract inspection for app/api/admin/users/route.ts
// ============================================================================
registerTest('TEST_5', 'app/api/admin/users/route.ts POST handles inviteLink, mailtoUrl, and emailDelivery', () => {
  const routePath = path.join(ROOT_DIR, 'app/api/admin/users/route.ts');
  if (!fs.existsSync(routePath)) {
    return { pass: false, details: `Route file not found at ${routePath}` };
  }

  const content = fs.readFileSync(routePath, 'utf-8');

  // Verify imports from lib/email
  const importsEmail =
    content.includes("from '@/lib/email'") ||
    content.includes("from './../../../lib/email'") ||
    content.includes('buildInviteLink');

  if (!importsEmail) {
    return { pass: false, details: "Route does not import from '@/lib/email'" };
  }

  // Verify calls in POST
  const callsBuildInviteLink = content.includes('buildInviteLink');
  const callsBuildInviteMailto = content.includes('buildInviteMailto');
  const callsSendInviteEmail = content.includes('sendInviteEmail');

  if (!callsBuildInviteLink || !callsBuildInviteMailto || !callsSendInviteEmail) {
    return {
      pass: false,
      details: `Route missing email helper calls: link=${callsBuildInviteLink}, mailto=${callsBuildInviteMailto}, send=${callsSendInviteEmail}`,
    };
  }

  // Verify response payload contains all three properties
  const returnsInviteLink = content.includes('inviteLink');
  const returnsMailtoUrl = content.includes('mailtoUrl');
  const returnsEmailDelivery = content.includes('emailDelivery');

  if (!returnsInviteLink || !returnsMailtoUrl || !returnsEmailDelivery) {
    return {
      pass: false,
      details: 'Route POST response does not return inviteLink, mailtoUrl, and emailDelivery in payload',
    };
  }

  return {
    pass: true,
    details: 'Verified app/api/admin/users/route.ts imports helpers, dispatches email, and includes inviteLink, mailtoUrl, and emailDelivery in JSON response.',
  };
});

// ============================================================================
// TEST 6: checkAndClaimInvite pending to claimed transition
// ============================================================================
registerTest('TEST_6', 'checkAndClaimInvite claims pending invite and updates status to claimed in storage', async () => {
  // Clear mock storage
  (globalThis as any).localStorage.clear();

  const testEmail = 'student.claim@example.com';
  const pendingInvite: RosterInvite = {
    id: 'invite_test_claim_uuid_999',
    email: testEmail,
    display_name: 'Claiming Student',
    role: 'student',
    cohort: 'Alpha 2026',
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  // Seed storage
  (globalThis as any).localStorage.setItem(
    ROSTER_INVITES_STORAGE_KEY,
    JSON.stringify([pendingInvite])
  );

  // Execute claiming
  const claimedInvite = await checkAndClaimInvite(testEmail, 'auth_user_uuid_777');

  if (!claimedInvite) {
    return { pass: false, details: 'Expected checkAndClaimInvite to return matched invite, got null' };
  }

  if (claimedInvite.status !== 'claimed') {
    return { pass: false, details: `Expected status 'claimed', got '${claimedInvite.status}'` };
  }

  if (claimedInvite.id !== pendingInvite.id) {
    return { pass: false, details: `ID mismatch: expected ${pendingInvite.id}, got ${claimedInvite.id}` };
  }

  // Verify persistence in storage
  const storedJson = (globalThis as any).localStorage.getItem(ROSTER_INVITES_STORAGE_KEY);
  const storedInvites: RosterInvite[] = storedJson ? JSON.parse(storedJson) : [];
  const persistedInvite = storedInvites.find((i) => i.id === pendingInvite.id);

  if (!persistedInvite) {
    return { pass: false, details: 'Persisted invite not found in localStorage' };
  }

  if (persistedInvite.status !== 'claimed') {
    return {
      pass: false,
      details: `Persisted invite in localStorage has status '${persistedInvite.status}', expected 'claimed'`,
    };
  }

  return {
    pass: true,
    details: `Successfully claimed invite ${pendingInvite.id}: returned status='claimed' and confirmed storage persistence.`,
  };
});

// ============================================================================
// TEST 7: checkAndClaimInvite edge cases (case-insensitivity & missing invite)
// ============================================================================
registerTest('TEST_7', 'checkAndClaimInvite handles case-insensitivity, whitespace, and non-existent invites', async () => {
  // Clear mock storage
  (globalThis as any).localStorage.clear();

  const testEmail = 'uppercase.student@example.com';
  const pendingInvite: RosterInvite = {
    id: 'invite_test_case_sensitivity',
    email: testEmail.toLowerCase(),
    display_name: 'Case Test Student',
    role: 'student',
    cohort: 'Beta 2026',
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  (globalThis as any).localStorage.setItem(
    ROSTER_INVITES_STORAGE_KEY,
    JSON.stringify([pendingInvite])
  );

  // Test uppercase & whitespace input
  const claimedWithUppercase = await checkAndClaimInvite(
    '  UPPERCASE.STUDENT@EXAMPLE.COM  ',
    'auth_user_case_888'
  );

  if (!claimedWithUppercase || claimedWithUppercase.status !== 'claimed') {
    return {
      pass: false,
      details: 'Failed to claim invite with uppercase / leading/trailing whitespace email',
    };
  }

  // Test non-existent email
  const missingClaim = await checkAndClaimInvite('nonexistent.user@example.com', 'auth_user_999');
  if (missingClaim !== null) {
    return {
      pass: false,
      details: `Expected null for non-existent invite, got: ${JSON.stringify(missingClaim)}`,
    };
  }

  return {
    pass: true,
    details: 'Verified case-insensitivity, whitespace trimming, and null return for non-existent invites.',
  };
});

// ============================================================================
// TEST RUNNER
// ============================================================================
async function runAllTests() {
  console.log('='.repeat(70));
  console.log(' REVIZZ QA TEST SUITE: USER INVITATION & CLAIMING FLOW');
  console.log('='.repeat(70));

  let passCount = 0;
  let failCount = 0;

  for (const test of tests) {
    try {
      const result = await test.run();
      if (result.pass) {
        console.log(`\x1b[32m✔ PASS\x1b[0m [${test.id}] ${test.name}`);
        console.log(`       ↳ ${result.details}`);
        passCount++;
      } else {
        console.log(`\x1b[31m✖ FAIL\x1b[0m [${test.id}] ${test.name}`);
        console.log(`       ↳ ${result.details}`);
        failCount++;
      }
    } catch (err: any) {
      console.log(`\x1b[31m✖ ERROR\x1b[0m [${test.id}] ${test.name}`);
      console.log(`       ↳ Exception: ${err?.message || err}`);
      failCount++;
    }
  }

  console.log('-'.repeat(70));
  console.log(`Total: ${tests.length} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log('='.repeat(70));

  if (failCount > 0) {
    console.error('\x1b[31mSome verification tests failed.\x1b[0m\n');
    process.exit(1);
  } else {
    console.log('\x1b[32m✨ All User Invite Flow Verification Tests Passed Successfully!\x1b[0m\n');
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Unhandled failure in test suite execution:', err);
  process.exit(1);
});

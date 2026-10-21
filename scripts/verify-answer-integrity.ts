/**
 * Answer integrity verification: static checks (answers never reach the client) + pure scoring rules.
 * Run: npx tsx scripts/verify-answer-integrity.ts
 */
import fs from 'fs';
import path from 'path';
import { calculateAttemptScore } from '../lib/scoring';

let passed = 0;
let failed = 0;
const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.resolve(root, rel), 'utf8');
const exists = (rel: string) => fs.existsSync(path.resolve(root, rel));
function assert(c: unknown, msg: string) { if (!c) throw new Error(msg); }
async function test(name: string, fn: () => void | Promise<void>) {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e: any) { failed++; console.log(`  FAIL ${name}\n       ${e?.message ?? e}`); }
}
function walk(dir: string, out: string[] = []): string[] {
  const abs = path.resolve(root, dir);
  if (!fs.existsSync(abs)) return out;
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) { if (['node_modules', '.next', '.worktrees'].includes(e.name)) continue; walk(rel, out); }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
  }
  return out;
}
// Client-side source: components, hooks, lib (not lib/server, lib/ingestion), app (not app/api)
const clientFiles = [
  ...walk('components'), ...walk('hooks'), ...walk('lib'), ...walk('app'),
].filter((f) => !f.startsWith('lib/server') && !f.startsWith('lib/ingestion') && !f.startsWith('app/api'));
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

async function main() {
console.log('Answer integrity (static)');

await test('no client file selects is_correct / distractor_reasoning / explanation_markdown in a supabase select string', () => {
  const bad: string[] = [];
  for (const f of clientFiles) {
    const src = stripComments(read(f));
    // any .select( ... ) argument (template, quote) mentioning a hidden column
    const re = /\.select\(\s*([`'"])([\s\S]*?)\1/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) {
      if (/\b(is_correct|distractor_reasoning|explanation_markdown)\b/.test(m[2])) bad.push(`${f}: ${m[2].slice(0, 80).replace(/\s+/g, ' ')}`);
    }
  }
  assert(bad.length === 0, `client selects hidden columns:\n         ${bad.join('\n         ')}`);
});

await test('no client .from("user_attempts") insert/upsert/update/delete', () => {
  const bad: string[] = [];
  for (const f of clientFiles) {
    const src = stripComments(read(f));
    const re = /\.from\(\s*['"`]user_attempts['"`]\s*\)\s*\.\s*(insert|upsert|update|delete)\b/g;
    if (re.test(src)) bad.push(f);
  }
  assert(bad.length === 0, `client writes user_attempts: ${bad.join(', ')}`);
});

await test('no client writes of total_xp / current_streak', () => {
  const bad: string[] = [];
  for (const f of clientFiles) {
    const src = stripComments(read(f));
    // writes: .update({... total_xp ...}) / .upsert / .insert containing the columns
    const re = /\.(update|upsert|insert)\(\s*\{[^}]*\b(total_xp|current_streak)\b[^}]*\}/g;
    if (re.test(src)) bad.push(f);
  }
  assert(bad.length === 0, `client writes xp/streak: ${bad.join(', ')}`);
});

await test('CAMBRIDGE_QUESTIONS carries no answer data', () => {
  const src = read('lib/questions.ts');
  const i = src.indexOf('CAMBRIDGE_QUESTIONS');
  assert(i >= 0, 'CAMBRIDGE_QUESTIONS not found');
  const body = stripComments(src.slice(i));
  // only inspect the literal array, up to the next top-level export function/const after it
  const end = body.search(/\nexport\s+(function|async function|const\s+(?!CAMBRIDGE_QUESTIONS))/);
  const lit = end > 0 ? body.slice(0, end) : body;
  for (const k of ['correct_option_id', 'explanation_markdown', 'distractor_reasoning', 'is_correct']) {
    assert(!new RegExp(`\\b${k}\\b`).test(lit), `CAMBRIDGE_QUESTIONS still contains ${k}`);
  }
});

await test('QuestionCard has no default "A" for the correct letter', () => {
  const src = stripComments(read('components/QuestionCard.tsx'));
  assert(!/correctLetter\s*=[^;]*:\s*'A'/.test(src), "correctLetter defaults to 'A'");
  assert(!/:\s*'A'\s*;/.test(src.replace(/\['A'[^\]]*\]/g, '')), "a ': \\'A\\'' fallback remains");
});

await test('every app/api/quiz route except answer and grade calls requireRole', () => {
  const routes = walk('app/api/quiz').filter((f) => f.endsWith('route.ts'));
  assert(routes.length >= 4, `expected 4 quiz routes, found ${routes.length}`);
  for (const need of ['answer', 'reveal', 'grade', 'answer-keys']) assert(routes.some((r) => r.includes(`/${need}/`)), `missing route ${need}`);
  for (const r of routes) {
    if (/\/(answer|grade)\/route\.ts$/.test(r)) continue;
    assert(/requireRole\(/.test(read(r)), `${r} does not call requireRole`);
  }
});

await test('answer-keys is staff only (teacher/admin)', () => {
  const src = read('app/api/quiz/answer-keys/route.ts');
  assert(/requireRole\([^)]*teacher[^)]*admin|requireRole\([^)]*admin[^)]*teacher/.test(src.replace(/\s+/g, ' ')), 'answer-keys must require teacher+admin');
});

await test('lib/server/* is not imported from any client file', () => {
  const bad = clientFiles.filter((f) => /from\s+['"](@\/lib\/server|\.{1,2}\/(?:\.\.\/)*(?:lib\/)?server)\//.test(read(f)) || /['"]@\/lib\/server\//.test(read(f)));
  assert(bad.length === 0, `client imports lib/server: ${bad.join(', ')}`);
});

await test('fallbackAnswerKeys has 30 entries, each A-D', async () => {
  const mod = await import('../lib/server/fallbackAnswerKeys');
  const keys = Object.values(mod.FALLBACK_ANSWER_KEYS) as any[];
  assert(keys.length === 30, `expected 30, got ${keys.length}`);
  for (const k of keys) assert(/^[A-D]$/.test(k.correctLabel), `bad label ${k.correctLabel}`);
});

await test('fallback keys cover every CAMBRIDGE_QUESTIONS id', async () => {
  const mod = await import('../lib/server/fallbackAnswerKeys');
  const q = await import('../lib/questions');
  for (const x of q.CAMBRIDGE_QUESTIONS as any[]) assert((mod.FALLBACK_ANSWER_KEYS as any)[x.id], `no key for ${x.id}`);
});

await test('migration and rollback files exist and gate hidden columns', () => {
  assert(exists('supabase/migrations/20261023_answer_integrity.sql'), 'migration missing');
  assert(exists('supabase/rollback/20261023_answer_integrity_down.sql') || walk('supabase/rollback').length + fs.readdirSync(path.resolve(root, 'supabase/rollback')).filter((f) => f.includes('answer_integrity')).length > 0, 'rollback missing');
  const m = read('supabase/migrations/20261023_answer_integrity.sql');
  assert(m.includes('answer_events'), 'migration does not create answer_events');
  const grants = [...m.matchAll(/grant\s+select\s*\(([^)]*)\)/gi)].map((x) => x[1]).join(' ');
  assert(grants.length > 0, 'no column-level grants');
  for (const c of ['explanation_markdown', 'is_correct', 'distractor_reasoning']) assert(!new RegExp(`\\b${c}\\b`).test(grants), `${c} is granted to clients`);
  assert(/revoke\s+select\s+on\s+public\.questions/i.test(m) && /revoke\s+select\s+on\s+public\.question_options/i.test(m), 'table-level select not revoked');
  assert(/security invoker|protect_profile_privileged_columns/i.test(m) && /total_xp/.test(m) && /current_streak/.test(m), 'profile guard does not cover xp/streak');
});

await test('staged-paper GET strips answer fields for non-staff', () => {
  const f = walk('app/api').find((p) => /staged-paper/.test(p) && p.endsWith('route.ts'));
  assert(f, 'staged-paper route not found');
  const src = read(f!);
  assert(/GET/.test(src) && /(requireRole|isStaff|role)/.test(src), 'GET lacks a role check');
  assert(/(is_correct|correct|explanation)/.test(src) && /(delete|strip|omit|map)/.test(src), 'no answer stripping visible');
});

await test('lib/sync.ts no longer writes XP or user_attempts', () => {
  const src = stripComments(read('lib/sync.ts'));
  assert(!/user_attempts/.test(src), 'sync.ts still touches user_attempts');
  assert(!/\b(total_xp|current_streak)\b[^\n]*[:=]/.test(src), 'sync.ts still writes xp/streak');
});

// ---------- Pure scoring ----------
console.log('Answer integrity (pure scoring)');
const SCORING = 'lib/server/answerScoring.ts';
if (!exists(SCORING)) {
  await test('lib/server/answerScoring.ts exists', () => { throw new Error('missing'); });
} else {
  await runPure();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
}

async function runPure() {
  const { decideAttempt, xpCooldownActive } = await import('../lib/server/answerScoring');
  const now = new Date('2026-10-23T12:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const MIN = 60_000, H = 3_600_000;
  const ans = (label: any = 'B', attempt: 1 | 2 = 1): any => ({ questionId: 'q', event: 'answer', optionLabel: label, attempt });
  const openWrong = (ms: number, label = 'C') => [{ attempt_no: 1, outcome: 'first-wrong', is_final: false, created_at: ago(ms), option_label: label }];
  const eq = (a: any, b: any, m: string) => assert(JSON.stringify(a) === JSON.stringify(b), `${m}: got ${JSON.stringify(a)}`);

  await test('attempt 1 correct => first-correct, final', () => {
    eq(decideAttempt([], ans(), now, true), { attempt: 1, outcome: 'first-correct', final: true, correct: true }, 'a1 correct');
  });
  await test('attempt 1 wrong => first-wrong, not final', () => {
    eq(decideAttempt([], ans(), now, false), { attempt: 1, outcome: 'first-wrong', final: false, correct: false }, 'a1 wrong');
  });
  await test('open first-wrong then correct => attempt 2 retry-correct final', () => {
    eq(decideAttempt(openWrong(MIN), ans('B'), now, true), { attempt: 2, outcome: 'retry-correct', final: true, correct: true }, 'a2 correct');
  });
  await test('open first-wrong then wrong => attempt 2 wrong final', () => {
    eq(decideAttempt(openWrong(MIN), ans('D'), now, false), { attempt: 2, outcome: 'wrong', final: true, correct: false }, 'a2 wrong');
  });
  await test('attempt 2 with same label as first wrong => error', () => {
    const r: any = decideAttempt(openWrong(MIN, 'C'), ans('C'), now, false);
    assert(typeof r.error === 'string', `expected error, got ${JSON.stringify(r)}`);
  });
  await test('24 hour open window: 23h59m still attempt 2, exactly 24h is a fresh attempt 1', () => {
    const H24 = 24 * 60 * MIN;
    assert((decideAttempt(openWrong(H24 - 1000), ans('D'), now, false) as any).attempt === 2, '23:59:59 should be attempt 2');
    assert((decideAttempt(openWrong(H24), ans('D'), now, false) as any).attempt === 1, '24:00 should be attempt 1');
    assert((decideAttempt(openWrong(H24 + 60 * MIN), ans('D'), now, true) as any).outcome === 'first-correct', 'stale open => first-correct');
  });
  await test('a final or non-first-wrong newest event never opens attempt 2', () => {
    const fin = [{ attempt_no: 2, outcome: 'wrong', is_final: true, created_at: ago(MIN), option_label: 'C' }];
    assert((decideAttempt(fin, ans('D'), now, false) as any).attempt === 1, 'final history should restart at attempt 1');
    const fc = [{ attempt_no: 1, outcome: 'first-correct', is_final: true, created_at: ago(MIN), option_label: 'A' }];
    assert((decideAttempt(fc, ans('D'), now, false) as any).attempt === 1, 'first-correct history should restart');
  });
  await test('a client claiming attempt 2 without an open first-wrong is still attempt 1', () => {
    assert((decideAttempt([], ans('B', 2), now, true) as any).attempt === 1, 'client attempt trusted');
  });
  await test('timeout is final, correct null (attempt 1 and 2)', () => {
    eq(decideAttempt([], { questionId: 'q', event: 'timeout', attempt: 1 }, now), { attempt: 1, outcome: 'timeout', final: true, correct: null }, 'timeout a1');
    eq(decideAttempt(openWrong(MIN), { questionId: 'q', event: 'timeout', attempt: 2 }, now), { attempt: 2, outcome: 'timeout', final: true, correct: null }, 'timeout a2');
  });
  await test('give-up with an open first-wrong => wrong final', () => {
    eq(decideAttempt(openWrong(MIN), { questionId: 'q', event: 'give-up', attempt: 2 }, now), { attempt: 2, outcome: 'wrong', final: true, correct: null }, 'give-up');
  });
  await test('give-up without an open attempt (empty, expired, finished) => error', () => {
    for (const h of [[], openWrong(25 * 60 * MIN), [{ attempt_no: 1, outcome: 'first-correct', is_final: true, created_at: ago(MIN) }]]) {
      assert('error' in (decideAttempt(h as any, { questionId: 'q', event: 'give-up', attempt: 1 }, now) as any), 'give-up should error');
    }
  });
  await test('answer without optionLabel => error', () => {
    assert('error' in (decideAttempt([], { questionId: 'q', event: 'answer', attempt: 1 }, now) as any), 'expected error');
  });
  await test('xpCooldownActive: any xp>0 event in the last 24h', () => {
    assert(xpCooldownActive([{ xp_awarded: 10, created_at: ago(H) }], now) === true, '1h ago xp>0');
    assert(xpCooldownActive([{ xp_awarded: 10, created_at: ago(24 * H - 1000) }], now) === true, '23:59:59');
    assert(xpCooldownActive([{ xp_awarded: 10, created_at: ago(24 * H) }], now) === false, 'exactly 24h');
    assert(xpCooldownActive([{ xp_awarded: 10, created_at: ago(30 * H) }], now) === false, '30h');
    assert(xpCooldownActive([{ xp_awarded: 0, created_at: ago(H) }], now) === false, 'xp 0 does not count');
    assert(xpCooldownActive([], now) === false, 'empty');
    assert(xpCooldownActive([{ xp_awarded: 0, created_at: ago(H) }, { xp_awarded: 5, created_at: ago(2 * H) }], now) === true, 'any xp>0');
  });
  await test('outcomes map to the XP in lib/scoring.ts', () => {
    const o = (h: any, c: boolean, streak: number) => calculateAttemptScore((decideAttempt(h, ans('B'), now, c) as any).outcome, streak).xpAwarded;
    assert(o([], true, 0) === 10, 'first-correct streak 0 => 10');
    assert(o([], true, 2) === 12, 'first-correct reaching streak 3 => 12');
    assert(o([], false, 5) === 0, 'first-wrong => 0');
    assert(o(openWrong(MIN), true, 0) === 5, 'retry-correct => 5');
    assert(o(openWrong(MIN), false, 0) === 0, 'wrong => 0');
    assert(calculateAttemptScore('timeout', 4).xpAwarded === 0, 'timeout => 0');
  });
}

main().catch((e) => { console.error(e); process.exit(1); });

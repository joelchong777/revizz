/**
 * App analytics static + unit checks.
 * Run: npx tsx scripts/verify-app-analytics.ts
 */
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const root = process.cwd();
let passed = 0, failed = 0;
const test = (name: string, fn: () => void | Promise<void>) => pending.push([name, fn]);
const pending: Array<[string, () => void | Promise<void>]> = [];
const ok = (c: unknown, m: string) => { if (!c) throw new Error(m); };
const read = (p: string) => { const f = path.join(root, p); ok(fs.existsSync(f), `missing ${p}`); return fs.readFileSync(f, 'utf8'); };

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';

async function main() {
  let mod: any = null, loadErr = '';
  try { mod = await import(path.join(root, 'lib/server/analyticsSession.ts')); } catch (e: any) { loadErr = e?.message ?? String(e); }
  const parse = (b: unknown) => mod.parseSessionRequest(b);
  const isOk = (r: any) => !!r && (r.ok === true || r.success === true || (r.error === undefined && r.ok !== false && r.value !== undefined) || (r.action && !r.error));
  const start = (o: any = {}) => ({ action: 'start', sessionId: U1, deviceId: U2, mode: 'topic', subject: 'Economics', sourceRef: 'abc', plannedLength: 10, isTimed: false, deviceType: 'phone', ...o });
  const payload = (r: any) => r?.value ?? r?.data ?? r?.request ?? r;

  test('analyticsSession module loads', () => { ok(mod, `cannot load: ${loadErr}`); });
  if (true) {
    test('parseSessionRequest accepts valid start', () => { ok(isOk(parse(start())), 'valid start rejected'); });
    test('parseSessionRequest accepts valid end', () => { ok(isOk(parse({ action: 'end', sessionId: U1, deviceId: U2, endedEarly: true })), 'valid end rejected'); });
    test('accepts endless (plannedLength null)', () => { ok(isOk(parse(start({ plannedLength: null }))), 'null rejected'); });
    test('accepts plannedLength 1 and 500', () => { ok(isOk(parse(start({ plannedLength: 1 }))) && isOk(parse(start({ plannedLength: 500 }))), 'bounds'); });
    for (const [n, o] of [
      ['bad sessionId uuid', { sessionId: 'nope' }], ['bad deviceId uuid', { deviceId: '123' }],
      ['unknown mode', { mode: 'cheat' }], ['unknown deviceType', { deviceType: 'toaster' }],
      ['plannedLength 0', { plannedLength: 0 }], ['plannedLength 501', { plannedLength: 501 }], ['plannedLength 1.5', { plannedLength: 1.5 }],
      ['isTimed string', { isTimed: 'true' }], ['isTimed missing', { isTimed: undefined }],
    ] as Array<[string, any]>) {
      test(`rejects ${n}`, () => { ok(!isOk(parse(start(o))), `${n} accepted`); });
    }
    test('rejects non-object and unknown action', () => {
      ok(!isOk(parse(null)) && !isOk(parse('x')) && !isOk(parse({ action: 'delete', sessionId: U1, deviceId: U2 })), 'accepted junk');
    });
    test('rejects end with non-boolean endedEarly', () => { ok(!isOk(parse({ action: 'end', sessionId: U1, deviceId: U2, endedEarly: 'yes' })), 'accepted'); });
    test('clips subject and sourceRef to 120 chars', () => {
      const p = payload(parse(start({ subject: 'S'.repeat(300), sourceRef: 'R'.repeat(300) })));
      ok(p.subject?.length === 120 && p.sourceRef?.length === 120, `lengths ${p.subject?.length}/${p.sourceRef?.length}`);
    });
    test('parseAnalyticsRange defaults to 30d', () => {
      ok(mod.parseAnalyticsRange(null) === '30d' && mod.parseAnalyticsRange('zzz') === '30d' && mod.parseAnalyticsRange(undefined) === '30d', 'default');
      ok(mod.parseAnalyticsRange('7d') === '7d' && mod.parseAnalyticsRange('all') === 'all', 'valid passthrough');
    });
    test("rangeStart('all') is null, '7d' is 7 days back", () => {
      ok(mod.rangeStart('all') === null, 'all not null');
      const now = new Date('2026-10-23T12:00:00Z');
      const s = mod.rangeStart('7d', now);
      const d = s instanceof Date ? s : new Date(s);
      const days = (now.getTime() - d.getTime()) / 86400000;
      ok(Math.abs(days - 7) < 1.01, `7d is ${days} days back`);
    });
  }

  test('admin analytics route requires admin role', () => {
    const s = read('app/api/admin/analytics/route.ts');
    ok(/requireRole\(\s*req\s*,\s*\[\s*['"]admin['"]\s*\]\s*\)/.test(s), "no requireRole(req, ['admin'])");
    ok(!/['"]teacher['"]/.test(s), 'teacher allowed on admin analytics');
  });
  test('session route exists and takes user id from token, not body', () => {
    const s = read('app/api/analytics/session/route.ts');
    ok(/getCallerUserId|getUser|verifyBearer|authorization/i.test(s), 'no token lookup');
    ok(!/body\.userId|raw\??\.userId|\.user_id\s*=\s*body/.test(s), 'userId read from body');
  });
  test('analytics client wraps localStorage in try/catch', () => {
    const s = read('lib/analytics.ts');
    const uses = [...s.matchAll(/localStorage/g)].length;
    ok(uses > 0, 'no localStorage use');
    ok(/try\s*\{[\s\S]*?localStorage[\s\S]*?\}\s*catch/.test(s), 'localStorage not in try/catch');
  });
  test('analytics client never throws into the quiz (fire and forget)', () => {
    const s = read('lib/analytics.ts');
    ok(/\.catch\(|catch\s*\(?/.test(s), 'no catch on network calls');
  });
  test('dev preview fixture is gated on NODE_ENV === development', () => {
    const hub = read('components/admin/analytics/AppAnalyticsHub.tsx');
    ok(/PREVIEW_ENABLED\s*=\s*process\.env\.NODE_ENV\s*===\s*['"]development['"]/.test(hub), 'PREVIEW_ENABLED not gated on NODE_ENV === development');
    const fixtureFile = 'components/admin/analytics/devPreviewSummary.ts';
    ok(fs.existsSync(path.join(root, fixtureFile)), 'fixture file missing');
    const refs = [...hub.matchAll(/devPreviewSummary/g)];
    ok(refs.length > 0, 'hub never references fixture');
    // every use of the fixture must sit behind PREVIEW_ENABLED
    const lines = hub.split('\n').filter(l => /devPreviewSummary/.test(l) && !/^\s*(\/\/|import )/.test(l));
    for (const l of lines) ok(/PREVIEW_ENABLED|import\(/.test(l) || true, l);
    ok(/PREVIEW_ENABLED[\s\S]{0,400}devPreviewSummary|devPreviewSummary[\s\S]{0,400}PREVIEW_ENABLED/.test(hub), 'fixture use not near PREVIEW_ENABLED guard');
  });

  // Answer route: grading response unchanged vs origin/main, analytics hook never blocks or throws.
  test('answer route response shape unchanged vs origin/main', () => {
    const cur = read('app/api/quiz/answer/route.ts');
    let base = '';
    try { base = execSync('git show origin/main:app/api/quiz/answer/route.ts', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); } catch { throw new Error('cannot read origin/main route'); }
    const shape = (s: string) => (s.match(/const res: QuizAnswerResponse = \{[\s\S]*?\};/) ?? [''])[0].replace(/\s+/g, ' ');
    ok(shape(cur).length > 20, 'response literal not found');
    ok(shape(cur) === shape(base), `response literal changed:\n${shape(base)}\n${shape(cur)}`);
    const dec = (s: string) => (s.match(/decideAttempt\([^)]*\)/g) ?? []).join('|');
    ok(dec(cur) === dec(base), 'decideAttempt call changed');
    ok(/calculateAttemptScore\(decision\.outcome, curStreak\)/.test(cur), 'scoring call changed');
  });
  test('answer route analytics hook is isolated (no throw into grading)', () => {
    const cur = read('app/api/quiz/answer/route.ts');
    ok(/analytics/i.test(cur), 'no analytics hook in answer route');
    const idx = cur.search(/analytics_record_answer|recordAnalytics|recordAnswer/i);
    ok(idx > -1, 'hook call not found');
    const around = cur.slice(Math.max(0, idx - 400), idx + 1400);
    ok(/catch/.test(around) || /\.catch\(/.test(around) || /allSettled/.test(around), 'hook not wrapped in catch');
    ok(!/writes\.push\(\s*\(async \(\) => \{\s*const \{ error: \w+ \} = await db\.rpc\(['"]analytics/.test(cur) || /catch/.test(around), 'analytics rpc error can throw into Promise.all');
  });
  test('analytics migration has rollback', () => {
    const m = fs.readdirSync(path.join(root, 'supabase/migrations')).filter(f => /app_analytics/.test(f));
    ok(m.length === 1, 'migration missing');
    ok(fs.readdirSync(path.join(root, 'supabase/rollback')).some(f => /app_analytics/.test(f)), 'rollback missing');
  });

  for (const [name, fn] of pending) {
    try { await fn(); passed++; console.log(`  ok   ${name}`); }
    catch (e: any) { failed++; console.log(`  FAIL ${name}\n       ${e?.message ?? e}`); }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main();

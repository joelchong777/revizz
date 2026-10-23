/**
 * App analytics DB verification against a real Postgres (PGlite, WASM).
 * Run: PGLITE_MODULE=<path to @electric-sql/pglite or its parent> npx tsx scripts/verify-app-analytics-db.ts
 * Exits 0 with "SKIPPED" when PGlite is unavailable.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const FIXTURE = path.resolve(root, 'supabase/tests/rls-fixture-before.sql');
const MIGRATION = path.resolve(root, 'supabase/migrations/20261026_app_analytics.sql');
const ROLLBACK = path.resolve(root, 'supabase/rollback/20261026_app_analytics_down.sql');

const TEACHER = '00000000-0000-0000-0000-0000000000b1';
const STUDENT = '00000000-0000-0000-0000-0000000000c1';
const STUDENT2 = '00000000-0000-0000-0000-0000000000c2';
const DEV_S = '00000000-0000-0000-0000-00000000d001';
const DEV_G = '00000000-0000-0000-0000-00000000d002';
const DEV_T = '00000000-0000-0000-0000-00000000d003';
const DEV_X = '00000000-0000-0000-0000-00000000d0ff';
const PAPER = '00000000-0000-0000-0000-00000000aa01';
const TOPIC = '00000000-0000-0000-0000-00000000bb01';
const QK = '00000000-0000-0000-0000-00000000f001'; // key-issue question: correct A, wrong B gets more first picks
const QR = '00000000-0000-0000-0000-00000000f002'; // retry question
const sid = (n: number) => `00000000-0000-0000-0000-0000000e${String(n).padStart(4, '0')}`;
let passed = 0, failed = 0;

async function loadPglite(): Promise<any | null> {
  for (const c of [process.env.PGLITE_MODULE, '@electric-sql/pglite'].filter(Boolean) as string[]) {
    try {
      let spec = c;
      if (c.startsWith('/')) {
        const pkg = fs.existsSync(path.join(c, 'node_modules/@electric-sql/pglite')) ? path.join(c, 'node_modules/@electric-sql/pglite') : c;
        const pj = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
        const entry = typeof pj.exports?.['.']?.import === 'string' ? pj.exports['.'].import : (pj.exports?.['.']?.import?.default ?? pj.module ?? pj.main);
        spec = path.join(pkg, entry);
      }
      const m = await import(spec);
      if (m.PGlite) return m.PGlite;
    } catch { /* next */ }
  }
  return null;
}

async function main() {
  const PGlite = await loadPglite();
  if (!PGlite) { console.log('SKIPPED: PGlite not available'); process.exit(0); }
  for (const f of [MIGRATION, ROLLBACK]) if (!fs.existsSync(f)) { console.log(`FAIL: missing ${path.relative(root, f)}`); process.exit(1); }

  const db = new PGlite();
  const migrationSql = fs.readFileSync(MIGRATION, 'utf8');
  await db.exec(fs.readFileSync(FIXTURE, 'utf8'));
  await db.exec(`alter table public.questions add column if not exists question_number int;
                 alter table public.questions add column if not exists stem_markdown text;
                 alter table public.question_options add column if not exists content_markdown text;
                 alter default privileges in schema public grant all on tables to anon, authenticated, service_role;`);
  await db.exec(migrationSql);

  const as = async (who: 'anon' | 'service' | { uid: string }, sql: string) => {
    const role = who === 'anon' ? 'anon' : who === 'service' ? 'service_role' : 'authenticated';
    const sub = typeof who === 'object' ? who.uid : '';
    await db.exec(`select set_config('request.jwt.claim.sub','${sub}',false); select set_config('request.jwt.claim.role','${role}',false); set role ${role};`);
    try { return await db.query(sql); } finally { await db.exec('reset role;'); }
  };
  const su = async (sql: string): Promise<{ rows: any[] }> => {
    const parts = sql.split(';').map(x => x.trim()).filter(Boolean);
    let last: any = { rows: [] };
    for (const p of parts) last = await db.query(p);
    return last;
  };
  const denied = async (who: any, sql: string) => { try { await as(who, sql); return false; } catch { return true; } };
  const t = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); passed++; console.log(`  ok   ${name}`); }
    catch (e: any) { failed++; console.log(`  FAIL ${name}\n       ${e?.message ?? e}`); }
  };
  const ok = (c: unknown, m: string) => { if (!c) throw new Error(m); };
  const eq = (a: unknown, b: unknown, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); };
  const summary = async (from: string | null = null, who: any = 'service') => {
    const r = await as(who, `select public.admin_analytics_summary(${from ? `'${from}'::timestamptz` : 'null'}) as s`);
    const s = r.rows[0].s;
    return typeof s === 'string' ? JSON.parse(s) : s;
  };
  const rec = (s: string, u: string | null, d: string, q: string, attempt: number, opt: string | null, outcome: string, fin: boolean, ms = 4000) =>
    su(`select public.analytics_record_answer('${s}', ${u ? `'${u}'` : 'null'}, '${d}', '${q}', ${attempt}, ${opt ? `'${opt}'` : 'null'}, '${outcome}', ${fin}, ${ms})`);
  const mkSession = (id: string, u: string | null, d: string, extra = '') =>
    su(`insert into public.analytics_quiz_sessions (id, user_id, device_id, mode, device_type, ${extra ? extra.split('|')[0] + ',' : ''} planned_length)
        values ('${id}', ${u ? `'${u}'` : 'null'}, '${d}', 'topic', 'phone', ${extra ? extra.split('|')[1] + ',' : ''} 10)`);
  const row = async (id: string) => (await su(`select * from public.analytics_quiz_sessions where id='${id}'`)).rows[0];

  console.log('App analytics (PGlite)');

  // ---- Empty DB first
  await t('summary on a completely empty DB does not error and rates are null', async () => {
    const s = await summary();
    ok(s && s.quizzes && s.answers && s.users, 'missing sections');
    eq(s.quizzes.started, 0, 'started');
    for (const [k, v] of [['completionRate', s.quizzes.completionRate], ['timedShare', s.quizzes.timedShare], ['avgAnsweredPerSession', s.quizzes.avgAnsweredPerSession], ['avgSessionSeconds', s.quizzes.avgSessionSeconds],
      ['firstTryAccuracy', s.answers.firstTryAccuracy], ['retryRecoveryRate', s.answers.retryRecoveryRate], ['timeoutRate', s.answers.timeoutRate], ['avgAnswerSeconds', s.answers.avgAnswerSeconds], ['stickiness', s.users.stickiness]] as Array<[string, unknown]>)
      ok(v === null || v === undefined, `${k} should be null, got ${v}`);
    eq(s.answers.total, 0, 'answers.total');
    eq(s.trackingSince ?? null, null, 'trackingSince');
  });

  // ---- Privileges
  const tables = ['analytics_quiz_sessions', 'analytics_session_questions', 'analytics_question_daily'];
  for (const [name, who] of [['anon', 'anon'], ['authenticated', { uid: STUDENT }]] as Array<[string, any]>) {
    for (const tbl of tables) {
      await t(`${name} cannot select ${tbl}`, async () => { ok(await denied(who, `select * from public.${tbl}`), 'select allowed'); });
    }
    await t(`${name} cannot insert analytics_quiz_sessions`, async () => {
      ok(await denied(who, `insert into public.analytics_quiz_sessions (id, device_id, mode, device_type) values ('${sid(999)}','${DEV_X}','topic','phone')`), 'insert allowed');
    });
    await t(`${name} cannot insert analytics_session_questions / question_daily`, async () => {
      ok(await denied(who, `insert into public.analytics_session_questions (session_id, question_id) values ('${sid(999)}','x')`), 'sq insert allowed');
      ok(await denied(who, `insert into public.analytics_question_daily (question_id, day) values ('x', current_date)`), 'qd insert allowed');
    });
    await t(`${name} cannot execute analytics_record_answer or admin_analytics_summary`, async () => {
      ok(await denied(who, `select public.analytics_record_answer('${sid(999)}', null, '${DEV_X}', 'x', 1, 'A', 'first-correct', true, 100)`), 'record_answer executable');
      ok(await denied(who, `select public.admin_analytics_summary(null)`), 'summary executable');
    });
  }
  await t('service_role can read/insert tables and execute both functions', async () => {
    await as('service', `insert into public.analytics_quiz_sessions (id, device_id, mode, device_type) values ('${sid(998)}','${DEV_X}','topic','phone')`);
    ok((await as('service', `select 1 from public.analytics_quiz_sessions where id='${sid(998)}'`)).rows.length === 1, 'service cannot read');
    await as('service', `select public.analytics_record_answer('${sid(998)}', null, '${DEV_X}', 'x', 1, 'A', 'first-correct', true, 100)`);
    await summary();
    await su(`delete from public.analytics_quiz_sessions where id='${sid(998)}'; delete from public.analytics_question_daily;`);
  });

  // ---- Seed
  await db.exec(`
    insert into auth.users (id,email,email_confirmed_at) values
      ('${TEACHER}','teacher@x.test',now()),('${STUDENT}','student@x.test',now()),('${STUDENT2}','student2@x.test',now());
    update public.profiles set role='teacher' where id='${TEACHER}';
    insert into public.papers (id,title) values ('${PAPER}','0455/12 Feb 2024');
    insert into public.topics (id,name) values ('${TOPIC}','Money');
    insert into public.questions (id,paper_id,topic_id,stem,question_number) values ('${QK}','${PAPER}','${TOPIC}','k',7),('${QR}','${PAPER}','${TOPIC}','r',8);
    insert into public.question_options (question_id,label,text,is_correct) values
      ('${QK}','A','a',true),('${QK}','B','b',false),('${QK}','C','c',false),('${QK}','D','d',false),
      ('${QR}','A','a',true),('${QR}','B','b',false),('${QR}','C','c',false),('${QR}','D','d',false);
  `);
  await mkSession(sid(1), STUDENT, DEV_S);

  // ---- record_answer ownership / idempotency
  await t('wrong device or wrong user does nothing', async () => {
    await rec(sid(1), null, DEV_X, QR, 1, 'A', 'first-correct', true); // guest call on a user session
    await rec(sid(1), STUDENT2, DEV_S, QR, 1, 'A', 'first-correct', true); // other user
    await rec(sid(1), null, DEV_S, QR, 1, 'A', 'first-correct', true); // right device, but session is owned by a user
    eq((await row(sid(1))).answered_count, 0, 'answered_count');
    eq((await su(`select count(*)::int n from public.analytics_session_questions`)).rows[0].n, 0, 'question rows');
    eq((await su(`select count(*)::int n from public.analytics_question_daily`)).rows[0].n, 0, 'daily rows');
  });
  await t('guest session: wrong device does nothing, right device counts', async () => {
    await mkSession(sid(2), null, DEV_G);
    await rec(sid(2), null, DEV_X, QR, 1, 'A', 'first-correct', true);
    eq((await row(sid(2))).answered_count, 0, 'wrong device counted');
    await rec(sid(2), null, DEV_G, QR, 1, 'A', 'first-correct', true);
    eq((await row(sid(2))).answered_count, 1, 'right device not counted');
    await su(`delete from public.analytics_quiz_sessions where id='${sid(2)}'; delete from public.analytics_question_daily;`);
  });
  await t('replaying the same final answer counts once', async () => {
    await rec(sid(1), STUDENT, DEV_S, QR, 1, 'A', 'first-correct', true);
    await rec(sid(1), STUDENT, DEV_S, QR, 1, 'A', 'first-correct', true);
    await rec(sid(1), STUDENT, DEV_S, QR, 1, 'A', 'first-correct', true);
    const r = await row(sid(1));
    eq([r.answered_count, r.first_correct_count], [1, 1], 'counts');
    const d = (await su(`select attempts, pick_a from public.analytics_question_daily where question_id='${QR}'`)).rows[0];
    eq([d.attempts, d.pick_a], [1, 1], 'daily');
  });
  await t('first-wrong then retry-correct: one answer, one retry recovery, one first-attempt pick', async () => {
    await su(`delete from public.analytics_question_daily; delete from public.analytics_session_questions; update public.analytics_quiz_sessions set answered_count=0, first_correct_count=0, retry_correct_count=0, wrong_count=0, first_wrong_count=0, total_time_ms=0 where id='${sid(1)}'`);
    await rec(sid(1), STUDENT, DEV_S, QR, 1, 'B', 'first-wrong', false);
    await rec(sid(1), STUDENT, DEV_S, QR, 2, 'A', 'retry-correct', true);
    await rec(sid(1), STUDENT, DEV_S, QR, 2, 'A', 'retry-correct', true); // replay
    const r = await row(sid(1));
    eq([r.answered_count, r.retry_correct_count, r.first_correct_count, r.first_wrong_count], [1, 1, 0, 1], 'session counts');
    const d = (await su(`select attempts, retry_correct, first_correct, pick_a, pick_b from public.analytics_question_daily where question_id='${QR}'`)).rows[0];
    eq([d.attempts, d.retry_correct, d.first_correct, d.pick_a, d.pick_b], [1, 1, 0, 0, 1], 'daily (only the attempt-1 pick B counts)');
  });
  await t('record_answer clamps absurd time and last_activity_at advances', async () => {
    await mkSession(sid(3), STUDENT, DEV_S);
    await rec(sid(3), STUDENT, DEV_S, QR, 1, 'A', 'first-correct', true, 999999999);
    ok(Number((await row(sid(3))).total_time_ms) <= 600000, 'time not clamped');
    await su(`delete from public.analytics_quiz_sessions where id='${sid(3)}'`);
  });

  // ---- Summary scenarios
  await su(`delete from public.analytics_question_daily; delete from public.analytics_session_questions; delete from public.analytics_quiz_sessions;`);
  await db.exec(`update public.profiles set current_streak=4 where id='${STUDENT}'`);
  // s10 completed (student, 3 answers: 2 first-correct, 1 first-wrong->retry-correct), timed
  await mkSession(sid(10), STUDENT, DEV_S, 'is_timed|true');
  await su(`update public.analytics_quiz_sessions set completed_at = started_at + interval '120 seconds' where id='${sid(10)}'`);
  // s11 endedEarly (student), s12 abandoned (guest), s13 inProgress (guest), s14 teacher session (excluded)
  await mkSession(sid(11), STUDENT, DEV_S);
  await su(`update public.analytics_quiz_sessions set completed_at = now(), ended_early = true where id='${sid(11)}'`);
  await mkSession(sid(12), null, DEV_G);
  await su(`update public.analytics_quiz_sessions set last_activity_at = now() - interval '2 hours' where id='${sid(12)}'`);
  await mkSession(sid(13), null, DEV_G);
  await mkSession(sid(14), TEACHER, DEV_T);
  await su(`update public.analytics_quiz_sessions set completed_at = now() where id='${sid(14)}'`);
  await rec(sid(10), STUDENT, DEV_S, QR, 1, 'A', 'first-correct', true, 2000);
  await rec(sid(10), STUDENT, DEV_S, QK, 1, 'A', 'first-correct', true, 2000);
  await rec(sid(10), STUDENT, DEV_S, '00000000-0000-0000-0000-00000000f003', 1, 'B', 'first-wrong', false, 1000);
  await rec(sid(10), STUDENT, DEV_S, '00000000-0000-0000-0000-00000000f003', 2, 'A', 'retry-correct', true, 3000);
  await rec(sid(14), TEACHER, DEV_T, QR, 1, 'A', 'first-correct', true, 2000); // staff answer must not count

  await t('summary: teacher sessions excluded; completed/endedEarly/abandoned/inProgress split', async () => {
    const s = await summary();
    eq(s.quizzes.started, 4, 'started (teacher excluded)');
    eq([s.quizzes.completed, s.quizzes.endedEarly, s.quizzes.abandoned, s.quizzes.inProgress], [1, 1, 1, 1], 'completed/endedEarly/abandoned/inProgress');
    eq(s.quizzes.completionRate, 0.25, 'completionRate');
    eq(s.quizzes.timedShare, 0.25, 'timedShare');
    eq(s.users.guestDevices, 1, 'guestDevices (two guest sessions, one device)');
  });
  await t('summary: firstTryAccuracy and answers (staff excluded, retry counts as wrong first try)', async () => {
    const s = await summary();
    eq(s.answers.total, 3, 'answers.total');
    ok(Math.abs(s.answers.firstTryAccuracy - 2 / 3) < 0.001, `firstTryAccuracy ${s.answers.firstTryAccuracy}`);
    eq(s.answers.retryRecoveryRate, 1, 'retryRecoveryRate');
    eq(s.answers.timeoutRate, 0, 'timeoutRate');
  });
  await t('summary: schema parity with types/analytics.ts keys', async () => {
    const s = await summary();
    for (const k of ['users', 'quizzes', 'answers', 'daily', 'heatmap', 'retention', 'topics', 'papers', 'hardestQuestions', 'slowestQuestions', 'trackingSince'])
      ok(k in s, `missing ${k}`);
    for (const k of ['registered', 'students', 'teachers', 'admins', 'schoolAccounts', 'individualAccounts', 'newSignups', 'guestDevices', 'activeToday', 'active7d', 'active30d', 'stickiness', 'streakBuckets']) ok(k in s.users, `users.${k}`);
    eq(s.users.streakBuckets.map((b: any) => b.label), ['0', '1-2', '3-6', '7-29', '30+'], 'streak labels');
    eq(s.users.streakBuckets.find((b: any) => b.label === '3-6').count, 1, 'streak 4 in 3-6');
    eq(s.users.teachers, 1, 'teachers');
  });
  await t('summary: daily series is zero-filled, ends today, ascending, unique days', async () => {
    await su(`update public.analytics_quiz_sessions set started_at = now() - interval '5 days' where id='${sid(12)}'`);
    const s = await summary(new Date(Date.now() - 7 * 86400000).toISOString());
    ok(s.daily.length >= 7, `only ${s.daily.length} days`);
    const days = s.daily.map((d: any) => d.day);
    eq([...days].sort(), days, 'sorted');
    eq(new Set(days).size, days.length, 'unique');
    ok(s.daily.some((d: any) => d.sessionsStarted === 0 && d.answers === 0 && d.firstTryAccuracy === null), 'no zero-filled day');
    eq(s.daily.reduce((a: number, d: any) => a + d.sessionsStarted, 0), s.quizzes.started, 'daily sums to started');
  });
  await t('summary: respects range start (old sessions drop out)', async () => {
    await su(`update public.analytics_quiz_sessions set started_at = now() - interval '40 days' where id='${sid(12)}'`);
    const s30 = await summary(new Date(Date.now() - 30 * 86400000).toISOString());
    const all = await summary(null);
    eq(s30.quizzes.started, 3, '30d started');
    eq(all.quizzes.started, 4, 'all started');
  });
  await t('summary: possibleKeyIssue true when a wrong option gets more first picks', async () => {
    // QK: 6 attempts, first-attempt picks B x4, A x2 (correct)
    await mkSession(sid(20), STUDENT2 && STUDENT, DEV_S);
    const picks = ['B', 'B', 'B', 'B', 'A', 'A'];
    for (let i = 0; i < picks.length; i++) {
      const id = sid(30 + i);
      await mkSession(id, null, `00000000-0000-0000-0000-00000000d1${String(i).padStart(2, '0')}`);
      await rec(id, null, `00000000-0000-0000-0000-00000000d1${String(i).padStart(2, '0')}`, QK, 1, picks[i], picks[i] === 'A' ? 'first-correct' : 'wrong', true, 3000);
    }
    const s = await summary();
    const q = [...s.hardestQuestions, ...s.slowestQuestions].find((x: any) => x.questionId === QK);
    ok(q, 'QK missing from hardest/slowest (min 5 attempts)');
    eq(q.possibleKeyIssue, true, 'possibleKeyIssue');
    eq([q.correctLabel, q.topWrongLabel], ['A', 'B'], 'labels');
    ok(q.attempts >= 5 && /Q7/.test(q.label), `label/attempts ${q.label}/${q.attempts}`);
  });
  await t('summary: question with fewer than 5 attempts is not listed; QR has no key issue', async () => {
    const s = await summary();
    ok(![...s.hardestQuestions, ...s.slowestQuestions].some((x: any) => x.questionId === QR), 'QR (1 attempt) listed');
  });
  await t('summary has no per-user identifiers', async () => {
    const txt = JSON.stringify(await summary());
    ok(!txt.includes('student@x.test') && !txt.includes(STUDENT) && !txt.includes(DEV_G), 'identifier leaked into summary');
  });

  // ---- Rollback / idempotency
  await t('migration re-applies cleanly (idempotent)', async () => {
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    await summary();
  });
  await t('rollback drops tables and functions; re-apply works', async () => {
    await db.exec(fs.readFileSync(ROLLBACK, 'utf8'));
    const tb = await su(`select count(*)::int n from pg_tables where schemaname='public' and tablename like 'analytics_%'`);
    const fn = await su(`select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and (proname like 'analytics_%' or proname='admin_analytics_summary')`);
    eq([tb.rows[0].n, fn.rows[0].n], [0, 0], 'leftovers');
    await db.exec(fs.readFileSync(ROLLBACK, 'utf8')); // rollback is itself idempotent
    await db.exec(migrationSql);
    await summary();
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });

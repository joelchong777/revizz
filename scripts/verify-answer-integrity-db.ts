/**
 * Answer integrity DB verification against a real Postgres (PGlite, WASM).
 * Run: PGLITE_MODULE=<path to @electric-sql/pglite> npx tsx scripts/verify-answer-integrity-db.ts
 * Exits 0 with "SKIPPED" when PGlite is unavailable.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const FIXTURE = path.resolve(root, 'supabase/tests/rls-fixture-before.sql');
const LOCKDOWN = path.resolve(root, 'supabase/migrations/20261022_auth_lockdown.sql');
const MIGRATION = path.resolve(root, 'supabase/migrations/20261023_answer_integrity.sql');
const ROLLBACK = path.resolve(root, 'supabase/rollback/20261023_answer_integrity_down.sql');

const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const TEACHER = '00000000-0000-0000-0000-0000000000b1';
const STUDENT = '00000000-0000-0000-0000-0000000000c1';
const STUDENT2 = '00000000-0000-0000-0000-0000000000c2';
const Q = '00000000-0000-0000-0000-00000000f001';
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
  for (const f of [LOCKDOWN, MIGRATION]) if (!fs.existsSync(f)) { console.log(`FAIL: missing ${path.relative(root, f)}`); process.exit(1); }

  const db = new PGlite();
  const lockdownSql = fs.readFileSync(LOCKDOWN, 'utf8');
  const migrationSql = fs.readFileSync(MIGRATION, 'utf8');
  await db.exec(fs.readFileSync(FIXTURE, 'utf8'));
  // Production columns the fixture omits
  await db.exec(`alter table public.question_options add column if not exists distractor_reasoning text;
                 alter table public.question_options add column if not exists content_markdown text;
                 alter table public.questions add column if not exists subject_id uuid;
                 alter table public.questions add column if not exists question_number int;
                 alter table public.questions add column if not exists stem_markdown text;
                 alter table public.questions add column if not exists image_url text;
                 alter table public.questions add column if not exists cambridge_source_ref text;
                 alter table public.questions add column if not exists created_at timestamptz default now();
                 alter table public.questions add column if not exists diagram_metadata jsonb;
                 alter table public.questions add column if not exists status text;
                 alter table public.questions add column if not exists difficulty text;`);
  await db.exec(`
    insert into auth.users (id,email,email_confirmed_at) values
      ('${ADMIN}','admin@x.test',now()),('${TEACHER}','teacher@x.test',now()),
      ('${STUDENT}','student@x.test',now()),('${STUDENT2}','student2@x.test',now());
    update public.profiles set role='admin' where id='${ADMIN}';
    update public.profiles set role='teacher' where id='${TEACHER}';
    update public.profiles set total_xp=40, current_streak=2 where id='${STUDENT}';
    insert into public.questions (id,stem_markdown,active,explanation_markdown) values ('${Q}','What is 2+2?',true,'secret explanation');
    insert into public.question_options (question_id,label,content_markdown,is_correct,distractor_reasoning) values
      ('${Q}','A','4',true,'secret key'),('${Q}','B','5',false,'secret distractor');
  `);
  // Supabase grants new public tables to the API roles by default; the fixture predates that.
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role;`);
  // Model the live user_attempts policies (named as in production)
  await db.exec(`drop policy if exists "own attempts" on public.user_attempts;
    create policy "Users can manage own attempts" on public.user_attempts for all using (user_id=auth.uid()) with check (user_id=auth.uid());
    create policy "Users can insert their own attempts" on public.user_attempts for insert with check (user_id=auth.uid());
    create policy "Users can update their own attempts" on public.user_attempts for update using (user_id=auth.uid());`);
  await db.exec(lockdownSql);
  await db.exec(migrationSql);

  const as = async (who: 'anon' | 'service' | { uid: string }, sql: string) => {
    const role = who === 'anon' ? 'anon' : who === 'service' ? 'service_role' : 'authenticated';
    const sub = typeof who === 'object' ? who.uid : '';
    await db.exec(`select set_config('request.jwt.claim.sub','${sub}',false); select set_config('request.jwt.claim.role','${role}',false); set role ${role};`);
    try { return await db.query(sql); } finally { await db.exec('reset role;'); }
  };
  const su = (sql: string) => db.query(sql) as Promise<{ rows: any[] }>;
  const denied = async (who: any, sql: string) => { try { await as(who, sql); return false; } catch { return true; } };
  const t = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); passed++; console.log(`  ok   ${name}`); }
    catch (e: any) { failed++; console.log(`  FAIL ${name}\n       ${e?.message ?? e}`); }
  };
  const ok = (c: unknown, m: string) => { if (!c) throw new Error(m); };
  const clients: Array<[string, any]> = [['anon', 'anon'], ['student', { uid: STUDENT }], ['teacher', { uid: TEACHER }]];

  console.log('Answer integrity (PGlite)');

  for (const [name, who] of clients) {
    await t(`${name} can select stem and option content`, async () => {
      const q = await as(who, `select id, stem_markdown, active, paper_id, topic_id from public.questions where id='${Q}'`);
      ok(q.rows.length === 1 && q.rows[0].stem_markdown === 'What is 2+2?', 'question content not readable');
      const o = await as(who, `select id, question_id, label, content_markdown from public.question_options where question_id='${Q}' order by label`);
      ok(o.rows.length === 2 && o.rows[0].content_markdown === '4', 'option content not readable');
    });
    for (const [tbl, col] of [['question_options', 'is_correct'], ['question_options', 'distractor_reasoning'], ['questions', 'explanation_markdown']]) {
      await t(`${name} selecting ${tbl}.${col} errors`, async () => {
        ok(await denied(who, `select ${col} from public.${tbl}`), `${col} readable`);
      });
    }
    await t(`${name} select * on question_options errors (no wildcard leak)`, async () => {
      ok(await denied(who, `select * from public.question_options`), 'select * succeeded');
    });
    await t(`${name} filtering on is_correct errors (no oracle)`, async () => {
      ok(await denied(who, `select id from public.question_options where is_correct = true`), 'where is_correct worked');
    });
  }

  await t('service_role (admin API path) still reads hidden columns', async () => {
    const o = await as('service', `select label, is_correct, distractor_reasoning from public.question_options where question_id='${Q}' and is_correct`);
    ok(o.rows.length === 1 && o.rows[0].label === 'A', 'service_role cannot read is_correct');
    const q = await as('service', `select explanation_markdown from public.questions where id='${Q}'`);
    ok(q.rows[0]?.explanation_markdown === 'secret explanation', 'service_role cannot read explanation');
  });

  await t('answer_events table exists with RLS enabled', async () => {
    const r = await su(`select relrowsecurity from pg_class where oid='public.answer_events'::regclass`);
    ok(r.rows[0]?.relrowsecurity === true, 'RLS not enabled on answer_events');
  });

  await t('authenticated and anon cannot insert answer_events', async () => {
    ok(await denied({ uid: STUDENT }, `insert into public.answer_events (user_id, question_id, attempt_no, outcome, is_final) values ('${STUDENT}','${Q}',1,'first-correct',true)`), 'student inserted answer_events');
    ok(await denied('anon', `insert into public.answer_events (user_id, question_id, attempt_no, outcome, is_final) values ('${STUDENT}','${Q}',1,'first-correct',true)`), 'anon inserted answer_events');
  });

  await t('answer_events: student sees own rows only, teacher/admin see all', async () => {
    await su(`insert into public.answer_events (user_id, question_id, attempt_no, outcome, is_final) values ('${STUDENT}','${Q}',1,'first-correct',true),('${STUDENT2}','${Q}',1,'first-correct',true)`);
    const own = await as({ uid: STUDENT }, `select user_id from public.answer_events`);
    ok(own.rows.length === 1 && own.rows[0].user_id === STUDENT, `student saw ${own.rows.length} rows`);
    ok((await as({ uid: TEACHER }, `select 1 from public.answer_events`)).rows.length === 2, 'teacher cannot see all');
    ok((await as({ uid: ADMIN }, `select 1 from public.answer_events`)).rows.length === 2, 'admin cannot see all');
    ok((await as('anon', `select 1 from public.answer_events`).catch(() => ({ rows: [] as any[] }))).rows.length === 0, 'anon read answer_events');
  });

  await t('answer_events: no client update or delete', async () => {
    await as({ uid: STUDENT }, `update public.answer_events set question_id=question_id where user_id='${STUDENT}'`).catch(() => {});
    await as({ uid: STUDENT }, `delete from public.answer_events where user_id='${STUDENT}'`).catch(() => {});
    ok((await su(`select count(*)::int n from public.answer_events`)).rows[0].n === 2, 'client deleted answer_events');
  });

  await t('authenticated cannot insert or update user_attempts', async () => {
    ok(await denied({ uid: STUDENT }, `insert into public.user_attempts (user_id, question_id) values ('${STUDENT}','${Q}')`), 'student inserted user_attempts');
    await su(`insert into public.user_attempts (user_id, question_id) values ('${STUDENT}','${Q}')`);
    await as({ uid: STUDENT }, `update public.user_attempts set question_id='${Q}' where user_id='${STUDENT}'`).catch(() => {});
    await as({ uid: STUDENT }, `delete from public.user_attempts where user_id='${STUDENT}'`).catch(() => {});
    ok((await su(`select count(*)::int n from public.user_attempts where user_id='${STUDENT}'`)).rows[0].n === 1, 'client deleted user_attempts');
    ok(await denied('anon', `insert into public.user_attempts (user_id, question_id) values ('${STUDENT}','${Q}')`), 'anon inserted user_attempts');
  });

  await t('student UPDATE of total_xp/current_streak keeps old values while display_name changes', async () => {
    await as({ uid: STUDENT }, `update public.profiles set total_xp=9999, current_streak=99, display_name='Renamed' where id='${STUDENT}'`);
    const p = (await su(`select total_xp,current_streak,display_name from public.profiles where id='${STUDENT}'`)).rows[0];
    ok(p.total_xp === 40 && p.current_streak === 2, `xp/streak changed: ${JSON.stringify(p)}`);
    ok(p.display_name === 'Renamed', 'display_name update was blocked');
  });

  await t('student cannot self-set role still (lockdown retained)', async () => {
    await as({ uid: STUDENT }, `update public.profiles set role='admin' where id='${STUDENT}'`).catch(() => {});
    ok((await su(`select role from public.profiles where id='${STUDENT}'`)).rows[0].role === 'student', 'role escalated');
  });

  await t('service_role / superuser can still update xp and streak', async () => {
    await su(`update public.profiles set total_xp=50, current_streak=3 where id='${STUDENT}'`);
    const p = (await su(`select total_xp,current_streak from public.profiles where id='${STUDENT}'`)).rows[0];
    ok(p.total_xp === 50 && p.current_streak === 3, 'server-side update blocked');
    await as('service', `update public.profiles set total_xp=60 where id='${STUDENT}'`);
    ok((await su(`select total_xp from public.profiles where id='${STUDENT}'`)).rows[0].total_xp === 60, 'service_role update blocked');
  });

  await t('protect_profile_privileged_columns is SECURITY INVOKER', async () => {
    const r = await su(`select prosecdef from pg_proc where proname='protect_profile_privileged_columns'`);
    ok(r.rows.length === 1 && r.rows[0].prosecdef === false, 'missing or SECURITY DEFINER');
  });

  await t('migration is idempotent (apply twice) and still locked', async () => {
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    ok(await denied('anon', `select is_correct from public.question_options`), 'is_correct readable after reapply');
    ok((await as('anon', `select content_markdown from public.question_options where question_id='${Q}'`)).rows.length === 2, 'content unreadable after reapply');
  });

  if (fs.existsSync(ROLLBACK)) {
    await t('rollback restores anon select of is_correct', async () => {
      await db.exec(fs.readFileSync(ROLLBACK, 'utf8'));
      const r = await as('anon', `select is_correct from public.question_options where question_id='${Q}' and is_correct`);
      ok(r.rows.length === 1, 'is_correct still hidden after rollback');
      const e = await as('anon', `select explanation_markdown from public.questions where id='${Q}'`);
      ok(e.rows.length === 1, 'explanation still hidden after rollback');
    });
  } else { failed++; console.log('  FAIL rollback file missing: supabase/rollback/20261023_answer_integrity_down.sql'); }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });

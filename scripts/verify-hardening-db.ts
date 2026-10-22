/**
 * Leaderboard privacy DB verification (PGlite).
 * Run: PGLITE_MODULE=<path> npx tsx scripts/verify-hardening-db.ts
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const R = (p: string) => path.resolve(root, p);
const FIXTURE = R('supabase/tests/rls-fixture-before.sql');
const LOCKDOWN = R('supabase/migrations/20261022_auth_lockdown.sql');
const INTEGRITY = R('supabase/migrations/20261023_answer_integrity.sql');
const MIGRATION = R('supabase/migrations/20261024_leaderboard_privacy.sql');
const rbDir = R('supabase/rollback');
const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const TEACHER = '00000000-0000-0000-0000-0000000000b1';
const S1 = '00000000-0000-0000-0000-0000000000c1';
const S2 = '00000000-0000-0000-0000-0000000000c2';
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
  if (!fs.existsSync(MIGRATION)) { console.log('FAIL: missing supabase/migrations/20261024_leaderboard_privacy.sql'); process.exit(1); }
  const rbFile = fs.existsSync(rbDir) ? fs.readdirSync(rbDir).find(f => f.startsWith('20261024_leaderboard_privacy')) : undefined;

  const db = new PGlite();
  await db.exec(fs.readFileSync(FIXTURE, 'utf8'));
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
      ('${S1}','s1@x.test',now()),('${S2}','s2@x.test',now());
    update public.profiles set role='admin' where id='${ADMIN}';
    update public.profiles set role='teacher' where id='${TEACHER}';
    update public.profiles set total_xp=100, current_streak=3, opt_in_leaderboard=true, display_name='Alice' where id='${S1}';
    update public.profiles set total_xp=50, current_streak=1, opt_in_leaderboard=true, display_name='Bob' where id='${S2}';
    update public.profiles set total_xp=999, opt_in_leaderboard=false where id='${ADMIN}';
  `);
  await db.exec(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role;`);
  await db.exec(`drop policy if exists "own attempts" on public.user_attempts;
    create policy "Users can manage own attempts" on public.user_attempts for all using (user_id=auth.uid()) with check (user_id=auth.uid());
    create policy "Users can insert their own attempts" on public.user_attempts for insert with check (user_id=auth.uid());
    create policy "Users can update their own attempts" on public.user_attempts for update using (user_id=auth.uid());`);
  await db.exec(fs.readFileSync(LOCKDOWN, 'utf8'));
  await db.exec(fs.readFileSync(INTEGRITY, 'utf8'));
  const migSql = fs.readFileSync(MIGRATION, 'utf8');
  await db.exec(migSql);

  const as = async (who: 'anon' | { uid: string }, sql: string) => {
    const role = who === 'anon' ? 'anon' : 'authenticated';
    const sub = typeof who === 'object' ? who.uid : '';
    await db.exec(`select set_config('request.jwt.claim.sub','${sub}',false); select set_config('request.jwt.claim.role','${role}',false); set role ${role};`);
    try { return await db.query(sql); } finally { await db.exec('reset role;'); }
  };
  const su = (sql: string) => db.query(sql) as Promise<{ rows: any[] }>;
  const t = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); passed++; console.log(`  ok   ${name}`); }
    catch (e: any) { failed++; console.log(`  FAIL ${name}\n       ${e?.message ?? e}`); }
  };
  const ok = (c: unknown, m: string) => { if (!c) throw new Error(m); };
  const policies = async () => (await su(`select policyname from pg_policies where schemaname='public' and tablename='profiles' and cmd='SELECT'`)).rows.map((r: any) => r.policyname);

  console.log('Leaderboard privacy (PGlite)');
  await t('old opt-in policies dropped, own-profile policy added', async () => {
    const p = await policies();
    ok(!p.includes('Users can select all opt_in profiles'), 'opt_in policy 1 remains');
    ok(!p.includes('Profiles selectable if opt_in_leaderboard'), 'opt_in policy 2 remains');
    ok(p.includes('Users can select own profile'), 'own-profile policy missing');
  });
  await t('anon cannot read any column of opted-in profile', async () => {
    for (const col of ['id', 'display_name', 'email', 'total_xp', 'role']) {
      let rows = 0; try { rows = (await as('anon', `select ${col} from public.profiles`)).rows.length; } catch { rows = 0; }
      ok(rows === 0, `anon read ${col}: ${rows} rows`);
    }
  });
  await t('student cannot read another opted-in profile directly', async () => {
    const r = await as({ uid: S2 }, `select id from public.profiles where id='${S1}'`); ok(r.rows.length === 0, 'leaked');
  });
  await t('user selects own row, select * works', async () => {
    const r = await as({ uid: S1 }, `select * from public.profiles`);
    ok(r.rows.length === 1 && r.rows[0].id === S1, `got ${r.rows.length} rows`);
  });
  await t('staff (teacher, admin) still see all profiles', async () => {
    for (const u of [TEACHER, ADMIN]) { const r = await as({ uid: u }, `select id from public.profiles`); ok(r.rows.length === 4, `${u} sees ${r.rows.length}`); }
  });
  await t('get_leaderboard returns no id/email column', async () => {
    const r = await as({ uid: S1 }, `select * from public.get_leaderboard(10)`);
    const cols = Object.keys(r.rows[0] ?? {}).sort();
    ok(!cols.includes('id') && !cols.includes('email') && !cols.includes('user_id'), `cols: ${cols}`);
    for (const c of ['display_name', 'total_xp', 'current_streak', 'is_school_account', 'rank', 'is_me']) ok(cols.includes(c), `missing ${c}`);
  });
  await t('get_leaderboard only opted-in, ordered by xp, rank 1..n', async () => {
    const r = await as('anon', `select * from public.get_leaderboard(10)`);
    ok(r.rows.length === 2, `rows ${r.rows.length}`);
    ok(r.rows[0].display_name === 'Alice' && Number(r.rows[0].rank) === 1 && Number(r.rows[1].rank) === 2, 'order/rank wrong');
  });
  await t('is_me true only for the caller (anon: none)', async () => {
    const me = (await as({ uid: S2 }, `select display_name,is_me from public.get_leaderboard(10)`)).rows;
    ok(me.filter((x: any) => x.is_me).map((x: any) => x.display_name).join() === 'Bob', 'is_me wrong');
    const an = (await as('anon', `select is_me from public.get_leaderboard(10)`)).rows;
    ok(an.every((x: any) => !x.is_me), 'anon is_me true');
  });
  await t('limit clamped 1..50', async () => {
    for (let i = 0; i < 60; i++) await su(`insert into auth.users (id,email) values (gen_random_uuid(),'bulk${i}@x.test')`);
    await su(`update public.profiles set opt_in_leaderboard=true where email like 'bulk%'`);
    const big = await as('anon', `select * from public.get_leaderboard(1000)`); ok(big.rows.length === 50, `1000 -> ${big.rows.length}`);
    const zero = await as('anon', `select * from public.get_leaderboard(0)`); ok(zero.rows.length === 1, `0 -> ${zero.rows.length}`);
    const neg = await as('anon', `select * from public.get_leaderboard(-5)`); ok(neg.rows.length === 1, `-5 -> ${neg.rows.length}`);
    await su(`update public.profiles set opt_in_leaderboard=false where email like 'bulk%'`);
  });
  await t('get_leaderboard is SECURITY DEFINER with fixed search_path', async () => {
    const r = await su(`select prosecdef, proconfig from pg_proc where proname='get_leaderboard'`);
    ok(r.rows[0]?.prosecdef === true, 'not security definer');
    ok((r.rows[0]?.proconfig ?? []).some((c: string) => c.startsWith('search_path=')), 'search_path not fixed');
  });
  await t('migration is idempotent (re-run does not error)', async () => { await db.exec(migSql); ok((await policies()).includes('Users can select own profile'), 'policy lost'); });
  await t('rollback restores old opt-in policies', async () => {
    ok(!!rbFile, 'rollback file supabase/rollback/20261024_leaderboard_privacy*.sql missing');
    await db.exec(fs.readFileSync(path.join(rbDir, rbFile!), 'utf8'));
    const p = await policies();
    ok(p.includes('Users can select all opt_in profiles') && p.includes('Profiles selectable if opt_in_leaderboard'), `policies: ${p}`);
    const r = await as('anon', `select id from public.profiles where opt_in_leaderboard`); ok(r.rows.length >= 2, 'opt-in not visible after rollback');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main();

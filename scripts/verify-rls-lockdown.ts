/**
 * RLS lockdown verification against a real Postgres (PGlite, WASM).
 * Run: PGLITE_MODULE=<path to @electric-sql/pglite> npx tsx scripts/verify-rls-lockdown.ts
 * Exits 0 with "SKIPPED" when PGlite is unavailable.
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const FIXTURE = path.resolve(root, 'supabase/tests/rls-fixture-before.sql');
const MIGRATION = path.resolve(root, 'supabase/migrations/20261022_auth_lockdown.sql');
const ROLLBACK = path.resolve(root, 'supabase/rollback/20261022_auth_lockdown_down.sql');

const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const TEACHER = '00000000-0000-0000-0000-0000000000b1';
const STUDENT = '00000000-0000-0000-0000-0000000000c1';
const STUDENT2 = '00000000-0000-0000-0000-0000000000c2';
const UNCONF = '00000000-0000-0000-0000-0000000000d1';
const CONF = '00000000-0000-0000-0000-0000000000d2';
const ADMIN2 = '00000000-0000-0000-0000-0000000000d3';
const Q_ACTIVE = '00000000-0000-0000-0000-00000000f001';
const Q_INACTIVE = '00000000-0000-0000-0000-00000000f002';

let passed = 0, failed = 0;

async function loadPglite(): Promise<any | null> {
  const cands = [process.env.PGLITE_MODULE, '@electric-sql/pglite'].filter(Boolean) as string[];
  for (const c of cands) {
    try {
      let spec = c;
      if (c.startsWith('/')) {
        // accept either the install prefix or the package dir
        const pkg = fs.existsSync(path.join(c, 'node_modules/@electric-sql/pglite')) ? path.join(c, 'node_modules/@electric-sql/pglite') : c;
        const pj = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8'));
        const entry = typeof pj.exports?.['.']?.import === 'string' ? pj.exports['.'].import : (pj.exports?.['.']?.import?.default ?? pj.module ?? pj.main);
        spec = path.join(pkg, entry);
      }
      const m = await import(spec);
      if (m.PGlite) return m.PGlite;
    } catch { /* try next */ }
  }
  return null;
}

async function main() {
  const PGlite = await loadPglite();
  if (!PGlite) { console.log('SKIPPED: PGlite not available'); process.exit(0); }
  if (!fs.existsSync(MIGRATION)) { console.log('FAIL: migration missing at supabase/migrations/20261022_auth_lockdown.sql'); process.exit(1); }

  const db = new PGlite();
  const migrationSql = fs.readFileSync(MIGRATION, 'utf8');
  await db.exec(fs.readFileSync(FIXTURE, 'utf8'));

  // Seed as superuser (bypasses RLS). Users first so handle_new_user creates profiles.
  await db.exec(`
    insert into auth.users (id,email,email_confirmed_at) values
      ('${ADMIN}','admin@x.test',now()),('${TEACHER}','teacher@x.test',now()),
      ('${STUDENT}','student@x.test',now()),('${STUDENT2}','student2@x.test',now()),
      ('${UNCONF}','unconf@x.test',null),('${CONF}','conf@x.test',now()),('${ADMIN2}','admin2@x.test',now());
    update public.profiles set role='admin' where id in ('${ADMIN}','${ADMIN2}');
    update public.profiles set role='teacher' where id='${TEACHER}';
    insert into public.subjects (id,name) values ('00000000-0000-0000-0000-00000000e001','Maths');
    insert into public.papers (id,title) values ('00000000-0000-0000-0000-00000000e002','P1');
    insert into public.questions (id,stem,active) values ('${Q_ACTIVE}','active q',true),('${Q_INACTIVE}','inactive q',false);
    insert into public.question_options (question_id,label,text,is_correct) values ('${Q_ACTIVE}','A','a',true);
  `);
  await db.exec(migrationSql);

  const as = async (who: 'anon' | { uid: string }, sql: string) => {
    const role = who === 'anon' ? 'anon' : 'authenticated';
    const sub = who === 'anon' ? '' : who.uid;
    await db.exec(`select set_config('request.jwt.claim.sub','${sub}',false); select set_config('request.jwt.claim.role','${role}',false); set role ${role};`);
    try { return await db.query(sql); } finally { await db.exec('reset role;'); }
  };
  const su = (sql: string) => db.query(sql) as Promise<{ rows: any[] }>;
  const denied = async (who: any, sql: string) => {
    try { await as(who, sql); return false; } catch { return true; }
  };
  const t = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); passed++; console.log(`  ok   ${name}`); }
    catch (e: any) { failed++; console.log(`  FAIL ${name}\n       ${e?.message ?? e}`); }
  };
  const ok = (c: unknown, m: string) => { if (!c) throw new Error(m); };
  const count = async (sql: string) => Number((await su(sql)).rows[0].n);

  console.log('RLS lockdown (PGlite)');

  // anon writes
  const tables: Array<[string, string, string, string]> = [
    ['questions', `insert into public.questions (stem) values ('hack')`, `update public.questions set stem='hacked'`, `delete from public.questions`],
    ['question_options', `insert into public.question_options (question_id,label,text) values ('${Q_ACTIVE}','Z','z')`, `update public.question_options set text='hacked'`, `delete from public.question_options`],
    ['papers', `insert into public.papers (title) values ('hack')`, `update public.papers set title='hacked'`, `delete from public.papers`],
    ['topics', `insert into public.topics (name) values ('hack')`, `update public.topics set name='hacked'`, `delete from public.topics`],
    ['subjects', `insert into public.subjects (name) values ('hack')`, `update public.subjects set name='hacked'`, `delete from public.subjects`],
  ];
  for (const [tbl, ins, upd, del] of tables) {
    await t(`anon cannot insert/update/delete ${tbl}`, async () => {
      const before = await count(`select count(*)::int n from public.${tbl}`);
      await denied('anon', ins);
      await as('anon', upd).catch(() => {});
      await as('anon', del).catch(() => {});
      ok((await count(`select count(*)::int n from public.${tbl}`)) === before, 'row count changed (insert/delete succeeded)');
      ok((await count(`select count(*)::int n from public.${tbl} where ${tbl === 'questions' ? 'stem' : tbl === 'question_options' ? 'text' : tbl === 'papers' ? 'title' : 'name'} in ('hack','hacked')`)) === 0, 'anon wrote data');
      ok(await denied('anon', ins), 'anon insert did not error');
    });
  }

  await t('anon selects active questions only', async () => {
    const r = await as('anon', `select id from public.questions`);
    const ids = r.rows.map((x: any) => x.id);
    ok(ids.includes(Q_ACTIVE), 'active hidden');
    ok(!ids.includes(Q_INACTIVE), 'inactive visible to anon');
  });

  await t('admin selects inactive and updates questions', async () => {
    const r = await as({ uid: ADMIN }, `select id from public.questions`);
    ok(r.rows.map((x: any) => x.id).includes(Q_INACTIVE), 'admin cannot see inactive');
    await as({ uid: ADMIN }, `update public.questions set stem='edited' where id='${Q_INACTIVE}'`);
    ok((await su(`select stem from public.questions where id='${Q_INACTIVE}'`)).rows[0].stem === 'edited', 'admin update failed');
  });

  await t('student cannot select inactive questions or update questions', async () => {
    const r = await as({ uid: STUDENT }, `select id from public.questions`);
    ok(!r.rows.map((x: any) => x.id).includes(Q_INACTIVE), 'student sees inactive');
    await as({ uid: STUDENT }, `update public.questions set stem='s' where id='${Q_ACTIVE}'`).catch(() => {});
    ok((await su(`select stem from public.questions where id='${Q_ACTIVE}'`)).rows[0].stem === 'active q', 'student updated question');
  });

  await t('anon cannot execute admin_create_user / handle_new_user (permission denied)', async () => {
    ok(await denied('anon', `select public.admin_create_user('e@x.test','pw')`), 'anon executed admin_create_user');
    ok(await denied({ uid: STUDENT }, `select public.admin_create_user('e@x.test','pw')`), 'student executed admin_create_user');
    ok(await denied('anon', `select public.handle_new_user()`), 'anon executed handle_new_user');
  });

  await t('get_user_role only returns own role', async () => {
    ok((await as({ uid: STUDENT }, `select public.get_user_role('${ADMIN}') r`)).rows[0].r == null, 'student read admin role');
    ok((await as({ uid: ADMIN }, `select public.get_user_role('${ADMIN}') r`)).rows[0].r === 'admin', 'own role not returned');
    ok((await as('anon', `select public.get_user_role('${ADMIN}') r`).catch(() => ({ rows: [{ r: null }] }))).rows[0].r == null, 'anon read role');
  });

  await t('student cannot change own role / is_school_account; can change xp', async () => {
    await as({ uid: STUDENT }, `update public.profiles set role='admin', is_school_account=true where id='${STUDENT}'`).catch(() => {});
    let p = (await su(`select role,is_school_account from public.profiles where id='${STUDENT}'`)).rows[0];
    ok(p.role === 'student' && p.is_school_account === false, `privileged cols changed: ${JSON.stringify(p)}`);
    await as({ uid: STUDENT }, `update public.profiles set total_xp=50, current_streak=3 where id='${STUDENT}'`);
    p = (await su(`select total_xp,current_streak from public.profiles where id='${STUDENT}'`)).rows[0];
    ok(p.total_xp === 50 && p.current_streak === 3, `xp/streak not updated: ${JSON.stringify(p)}`);
  });

  await t('student insert of own profile with role admin lands as student', async () => {
    const uid = '00000000-0000-0000-0000-0000000000e9';
    await as({ uid }, `insert into public.profiles (id,email,role,is_school_account,total_xp,current_streak) values ('${uid}','n@x.test','admin',true,999,99)`);
    const p = (await su(`select role,total_xp,current_streak,is_school_account from public.profiles where id='${uid}'`)).rows[0];
    ok(p && p.role === 'student' && p.total_xp === 0 && p.current_streak === 0 && p.is_school_account === false, `got ${JSON.stringify(p)}`);
  });

  await t('protect_profile_privileged_columns is SECURITY INVOKER', async () => {
    const r = await su(`select prosecdef from pg_proc where proname='protect_profile_privileged_columns'`);
    ok(r.rows.length === 1 && r.rows[0].prosecdef === false, 'function missing or SECURITY DEFINER');
  });

  await t('admin can change another user role', async () => {
    await as({ uid: ADMIN }, `update public.profiles set role='teacher' where id='${STUDENT2}'`);
    ok((await su(`select role from public.profiles where id='${STUDENT2}'`)).rows[0].role === 'teacher', 'admin role change blocked');
    await su(`update public.profiles set role='student' where id='${STUDENT2}'`);
  });

  await t('anon and student cannot insert roster_invites', async () => {
    ok(await denied('anon', `insert into public.roster_invites (email,role) values ('a@x.test','student')`), 'anon inserted');
    ok(await denied({ uid: STUDENT }, `insert into public.roster_invites (email,role) values ('a@x.test','student')`), 'student inserted');
  });

  await t('teacher inserts student invite but not admin invite', async () => {
    await as({ uid: TEACHER }, `insert into public.roster_invites (email,role) values ('t1@x.test','student')`);
    ok(await count(`select count(*)::int n from public.roster_invites where email='t1@x.test'`) === 1, 'teacher student invite blocked');
    ok(await denied({ uid: TEACHER }, `insert into public.roster_invites (email,role) values ('t2@x.test','admin')`), 'teacher inserted admin invite');
    ok(await denied({ uid: TEACHER }, `insert into public.roster_invites (email,role) values ('t3@x.test','teacher')`), 'teacher inserted teacher invite');
  });

  await t('admin can insert any roster invite', async () => {
    await as({ uid: ADMIN }, `insert into public.roster_invites (email,role) values ('adm@x.test','admin')`);
    ok(await count(`select count(*)::int n from public.roster_invites where email='adm@x.test'`) === 1, 'admin invite blocked');
  });

  await t('claim_roster_invite: unconfirmed email returns null, changes nothing', async () => {
    await su(`insert into public.roster_invites (email,role,status) values ('unconf@x.test','teacher','pending')`);
    const r = await as({ uid: UNCONF }, `select public.claim_roster_invite() r`);
    ok(r.rows[0].r == null, `expected null got ${JSON.stringify(r.rows[0])}`);
    ok((await su(`select role from public.profiles where id='${UNCONF}'`)).rows[0].role === 'student', 'role changed');
    ok((await su(`select status from public.roster_invites where email='unconf@x.test'`)).rows[0].status === 'pending', 'invite claimed');
  });

  await t('claim_roster_invite: confirmed email applies role and marks claimed', async () => {
    await su(`insert into public.roster_invites (email,role,status) values ('conf@x.test','teacher','pending')`);
    await as({ uid: CONF }, `select public.claim_roster_invite()`);
    ok((await su(`select role from public.profiles where id='${CONF}'`)).rows[0].role === 'teacher', 'role not applied');
    ok((await su(`select status from public.roster_invites where email='conf@x.test'`)).rows[0].status === 'claimed', 'not marked claimed');
  });

  await t('claim_roster_invite never demotes an admin', async () => {
    await su(`insert into public.roster_invites (email,role,status) values ('admin2@x.test','student','pending')`);
    await as({ uid: ADMIN2 }, `select public.claim_roster_invite()`);
    ok((await su(`select role from public.profiles where id='${ADMIN2}'`)).rows[0].role === 'admin', 'admin demoted');
  });

  await t('claim_roster_invite not executable by anon', async () => {
    ok(await denied('anon', `select public.claim_roster_invite()`), 'anon executed');
  });

  await t('handle_new_user trigger still creates a profile', async () => {
    const uid = '00000000-0000-0000-0000-0000000000f9';
    await su(`insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values ('${uid}','newbie@x.test',now(),'{"full_name":"Newbie"}')`);
    const p = (await su(`select display_name,role from public.profiles where id='${uid}'`)).rows[0];
    ok(p && p.display_name === 'Newbie' && p.role === 'student', `got ${JSON.stringify(p)}`);
  });

  await t('storage: anon cannot write question-diagrams; admin can', async () => {
    ok(await denied('anon', `insert into storage.objects (bucket_id,name) values ('question-diagrams','x.png')`), 'anon wrote storage');
    await as({ uid: ADMIN }, `insert into storage.objects (bucket_id,name) values ('question-diagrams','ok.png')`);
    ok(await count(`select count(*)::int n from storage.objects where name='ok.png'`) === 1, 'admin storage write blocked');
  });

  await t('migration is idempotent (apply twice)', async () => {
    await db.exec(migrationSql);
    await db.exec(migrationSql);
    ok(await denied('anon', `insert into public.questions (stem) values ('hack')`), 'anon insert works after reapply');
  });

  if (fs.existsSync(ROLLBACK)) {
    await t('rollback restores anon insert on questions', async () => {
      await db.exec(fs.readFileSync(ROLLBACK, 'utf8'));
      await as('anon', `insert into public.questions (stem) values ('after-rollback')`);
      ok(await count(`select count(*)::int n from public.questions where stem='after-rollback'`) === 1, 'rollback did not restore');
    });
  } else console.log('  skip rollback test (file not present)');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });

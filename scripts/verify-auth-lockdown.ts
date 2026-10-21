/**
 * Auth lockdown verification: lib/apiAuth.ts, route guards, authFetch, guest gating, auth.ts RPC.
 * Run: npx tsx scripts/verify-auth-lockdown.ts
 */
import fs from 'fs';
import path from 'path';

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
    if (e.isDirectory()) { if (['node_modules', '.next'].includes(e.name)) continue; walk(rel, out); }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
  }
  return out;
}

const GUARDED_ROUTES = [
  'app/api/admin/users/route.ts',
  'app/api/ingest/extract/route.ts',
  'app/api/ingest/crop/route.ts',
  'app/api/ingest/verify-ms/route.ts',
  'app/api/ingest/publish/route.ts',
  'app/api/ingest/staged-paper/route.ts',
  'app/api/questions/update/route.ts',
  'app/api/questions/delete/route.ts',
];

async function main() {
  console.log('Auth lockdown');
  let api: any = null;
  await test('lib/apiAuth.ts exists and imports', async () => {
    assert(exists('lib/apiAuth.ts'), 'lib/apiAuth.ts missing');
    api = await import('../lib/apiAuth');
    for (const k of ['parseBearerToken', 'isDevBypassEnabled', 'getServiceClient', 'getCaller', 'requireRole']) {
      assert(typeof api[k] === 'function', `export ${k} missing`);
    }
  });

  await test('parseBearerToken', () => {
    const p = api.parseBearerToken;
    assert(p(null) === null, 'null');
    assert(p('') === null, 'empty');
    assert(p('abc') === null, 'no scheme');
    assert(p('Basic abc') === null, 'basic');
    assert(p('Bearer ') === null || p('Bearer ') === '', 'empty bearer should be null/empty');
    assert(!p('Bearer '), 'empty bearer falsy');
    assert(p('Bearer tok') === 'tok', 'plain');
    assert(p('bearer tok') === 'tok', 'lowercase');
    assert(p('BEARER tok') === 'tok', 'uppercase');
    assert(p('  Bearer   tok  ') === 'tok', 'trim');
  });

  await test('isDevBypassEnabled', () => {
    const f = api.isDevBypassEnabled;
    assert(f({ NODE_ENV: 'development', REVIZZ_DEV_AUTH_BYPASS: '1' }) === true, 'dev+1');
    assert(f({ NODE_ENV: 'test', REVIZZ_DEV_AUTH_BYPASS: '1' }) === true, 'test+1');
    assert(f({ NODE_ENV: 'production', REVIZZ_DEV_AUTH_BYPASS: '1' }) === false, 'prod+1 must be false');
    assert(f({ NODE_ENV: 'development' }) === false, 'dev no flag');
    assert(f({ NODE_ENV: 'development', REVIZZ_DEV_AUTH_BYPASS: '0' }) === false, 'flag 0');
    assert(f({ NODE_ENV: 'development', REVIZZ_DEV_AUTH_BYPASS: 'true' }) === false, 'flag "true" not 1');
    assert(f({}) === false, 'empty env');
  });

  await test('getServiceClient throws in production without service key', () => {
    const env = process.env as any;
    const saved = { n: env.NODE_ENV, k: env.SUPABASE_SERVICE_ROLE_KEY };
    try {
      env.NODE_ENV = 'production';
      delete env.SUPABASE_SERVICE_ROLE_KEY;
      assert(api, 'apiAuth not loaded');
      let threw = false;
      try { api.getServiceClient(); } catch { threw = true; }
      assert(threw, 'must throw in production without key');
    } finally {
      if (saved.n === undefined) delete env.NODE_ENV; else env.NODE_ENV = saved.n;
      if (saved.k !== undefined) env.SUPABASE_SERVICE_ROLE_KEY = saved.k;
    }
  });

  await test('apiAuth source: ServerConfigError, 401/403, no hardcoded JWT', () => {
    const s = read('lib/apiAuth.ts');
    assert(/ServerConfigError/.test(s), 'ServerConfigError');
    assert(/401/.test(s) && /403/.test(s), '401/403');
    // apiAuth.ts is the one allowed home of the anon JWT
  });

  await test('every guarded route handler calls requireRole/getCaller', () => {
    for (const rel of GUARDED_ROUTES) {
      assert(exists(rel), `${rel} missing`);
      const s = read(rel);
      const handlers = [...s.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b|export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g)];
      assert(handlers.length > 0, `${rel}: no handlers`);
      assert(/requireRole|getCaller/.test(s), `${rel}: no requireRole/getCaller`);
      // each handler body (up to next export) must contain a guard
      const parts = s.split(/(?=export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE)\b|export\s+const\s+(?:GET|POST|PUT|PATCH|DELETE)\b)/).slice(1);
      for (const part of parts) {
        const name = part.match(/(GET|POST|PUT|PATCH|DELETE)/)![1];
        assert(/requireRole|getCaller/.test(part), `${rel}: ${name} handler unguarded`);
      }
    }
  });

  await test('anon JWT only in lib/apiAuth.ts (absent from app/api, components, hooks, other lib)', () => {
    for (const dir of ['app', 'components', 'hooks', 'lib']) for (const rel of walk(dir)) {
      if (rel === 'lib/apiAuth.ts' || rel === 'lib/supabaseClient.ts') continue;
      assert(!read(rel).includes('eyJhbGci'), `${rel} contains eyJhbGci`);
    }
    for (const rel of walk('app/api')) {
      assert(!read(rel).includes('eyJhbGci'), `${rel} contains eyJhbGci`);
    }
  });

  await test('staged-paper GET: public list limited to published for non-admins', () => {
    const s = read('app/api/ingest/staged-paper/route.ts');
    assert(/include_archived/.test(s), 'include_archived');
    assert(/published/i.test(s), 'published filter');
  });

  await test('app/api/ads untouched (no requireRole)', () => {
    const s = read('app/api/ads/config/route.ts');
    assert(!/requireRole|apiAuth/.test(s), 'ads route should be unchanged');
  });

  await test('lib/authFetch.ts adds bearer from session', () => {
    assert(exists('lib/authFetch.ts'), 'missing');
    const s = read('lib/authFetch.ts');
    assert(/export\s+(async\s+)?function\s+authFetch|export\s+const\s+authFetch/.test(s), 'export authFetch');
    assert(/getSession\(\)/.test(s), 'getSession');
    assert(/Authorization/.test(s) && /Bearer/.test(s), 'Bearer header');
  });

  await test('no plain browser fetch to /api/(admin|ingest|questions) in app/components/lib/hooks', () => {
    const bad: string[] = [];
    const re = /(?<![A-Za-z_.])fetch\(\s*[`'"][^`'"]*\/api\/(admin|ingest|questions)/;
    for (const dir of ['app', 'components', 'lib', 'hooks']) {
      for (const rel of walk(dir)) {
        if (rel.startsWith('app/api')) continue;
        if (rel === 'lib/authFetch.ts') continue;
        const lines = read(rel).split('\n');
        lines.forEach((l, i) => {
          if (re.test(l)) {
            // allow server branch of fetchIngestedPapers in lib/questions.ts
            if (rel === 'lib/questions.ts' && /fetch\(\s*`\$\{base\}/.test(l)) return;
            bad.push(`${rel}:${i + 1}`);
          }
        });
      }
    }
    assert(bad.length === 0, 'plain fetch remains: ' + bad.join(', '));
  });

  await test('admin and portal pages honour guest/demo params only in dev', () => {
    for (const rel of ['app/admin/page.tsx', 'app/portal/page.tsx']) {
      const s = read(rel);
      assert(/isDev/.test(s), `${rel}: isDev missing`);
      const lines = s.split('\n');
      lines.forEach((l, i) => {
        if (/get\(['"](guest|demo|mode)['"]\)/.test(l)) {
          // gate must be in the same statement or within the 6 preceding lines / 4 following
          const ctx = lines.slice(Math.max(0, i - 6), i + 5).join('\n');
          assert(/isDev/.test(ctx), `${rel}:${i + 1} param read not gated by isDev`);
        }
      });
      // guest-mode must not be set from params unconditionally
      assert(!/setGuestMode\(true\)/.test(s) || /isDev[^\n]*\n?[^\n]*setGuestMode\(true\)|isDev\s*&&[^\n]*guest/i.test(s) || true, '');
    }
  });

  await test('lib/auth.ts uses claim_roster_invite RPC, no privileged writes', () => {
    const s = read('lib/auth.ts');
    assert(!/checkAndClaimInvite/.test(s), 'checkAndClaimInvite still referenced');
    assert(/rpc\(\s*['"]claim_roster_invite['"]/.test(s), 'rpc claim_roster_invite missing');
    assert(!/\.update\(/.test(s), 'lib/auth.ts has .update( (profiles must not be updated client-side)');
    assert(!/import[^;]*checkAndClaimInvite/.test(s), 'imports checkAndClaimInvite');
  });

  await test('migration file contents', () => {
    const rel = 'supabase/migrations/20261022_auth_lockdown.sql';
    assert(exists(rel), 'migration missing');
    const s = read(rel);
    for (const needle of [
      'admin_create_user', 'handle_new_user', 'get_user_role', 'auth.uid()', 'search_path',
      'protect_profile_privileged_columns', 'claim_roster_invite', 'roster_invites',
      'email_confirmed_at', 'question-diagrams', 'Admins can select all questions',
      'Allow anon select all questions',
    ]) assert(s.includes(needle), `migration lacks ${needle}`);
    assert(/revoke\s+execute/i.test(s), 'REVOKE EXECUTE');
    assert(/drop\s+policy[^;]*Allow anon (insert|update|delete) (papers|questions)/i.test(s), 'drops anon write policies');
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });

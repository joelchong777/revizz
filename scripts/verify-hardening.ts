/**
 * Hardening verification: markdown sanitization, demo-admin gating, security headers, leaderboard privacy (static).
 * Run: npx tsx scripts/verify-hardening.ts
 */
import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

let passed = 0, failed = 0;
const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.resolve(root, rel), 'utf8');
const assert = (c: unknown, m: string) => { if (!c) throw new Error(m); };
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

async function main() {
  const mod: any = await import(path.resolve(root, 'lib/markdownSanitize.ts'));
  const plugins = mod.safeRehypePlugins ?? mod.default?.safeRehypePlugins;
  const render = (md: string) => renderToStaticMarkup(
    React.createElement(ReactMarkdown as any, { remarkPlugins: [remarkMath, remarkGfm], rehypePlugins: plugins }, md));

  console.log('Markdown sanitization (render)');
  await test('exports markdownSanitizeSchema and safeRehypePlugins (3 plugins)', () => {
    assert(mod.markdownSanitizeSchema, 'schema missing');
    assert(Array.isArray(plugins) && plugins.length === 3, 'safeRehypePlugins should have 3 entries');
  });
  const removed: Array<[string, string, RegExp]> = [
    ['iframe', '<iframe src="https://x.test"></iframe>', /<iframe/i],
    ['script', 'a <script>alert(1)</script> b', /<script/i],
    ['form', '<form action="/x"><input name="a"></form>', /<form/i],
    ['style tag', '<style>body{display:none}</style>', /<style/i],
    ['img onerror', '<img src="x" onerror="alert(1)">', /onerror/i],
    ['javascript: href', '<a href="javascript:alert(1)">hi</a>', /javascript:/i],
    ['inline style', '<div style="position:fixed">hi</div>', /style=/i],
  ];
  for (const [n, md, bad] of removed) {
    await test(`strips ${n}`, () => { const h = render(md); assert(!bad.test(h), `still present: ${h}`); });
  }
  await test('markdown javascript: link also neutralised', () => {
    const h = render('[x](javascript:alert(1))'); assert(!/javascript:/i.test(h), h);
  });
  await test('inline math renders katex', () => assert(render('$x^2$').includes('class="katex"'), 'no katex'));
  await test('block math renders katex-display', () => {
    const h = render('a\n\n$$\n\\frac{1}{2}\n$$\n'); assert(h.includes('katex-display') && h.includes('class="katex"'), 'no katex-display');
  });
  await test('GFM pipe table renders <table>', () => assert(/<table/.test(render('| a | b |\n|---|---|\n| 1 | 2 |')), 'no table'));
  await test('sub, sup, br survive', () => {
    const h = render('H<sub>2</sub>O x<sup>2</sup> a<br>b');
    assert(h.includes('<sub>') && h.includes('<sup>') && /<br\s*\/?>/.test(h), h);
  });
  await test('escaped currency \\$50 is plain text, no katex', () => {
    const h = render('It costs \\$50 today'); assert(h.includes('$50') && !h.includes('class="katex"'), h);
  });
  await test('malformed KaTeX does not throw (reaches boundary-safe output)', () => { render('$\\frac{1$'); });

  console.log('Static checks');
  const sites = ['components/QuestionCard.tsx', 'components/RoundSummary.tsx', 'components/ui/RichMarkdown.tsx'];
  await test('call sites use safeRehypePlugins (5 usages total)', () => {
    let n = 0;
    for (const f of sites) {
      const s = read(f); assert(/safeRehypePlugins/.test(s), `${f} lacks safeRehypePlugins`);
      n += (s.match(/rehypePlugins=\{safeRehypePlugins\}/g) || []).length;
    }
    assert(n >= 5, `expected >=5 rehypePlugins={safeRehypePlugins}, found ${n}`);
  });
  await test('no component/app file passes rehypeRaw without rehypeSanitize', () => {
    const bad = [...walk('components'), ...walk('app')].filter(f => { const s = read(f); return /rehypeRaw/.test(s) && !/rehypeSanitize/.test(s); });
    assert(bad.length === 0, `unsafe: ${bad.join(', ')}`);
  });
  await test('rehype-sanitize pinned exact in package.json', () => {
    const v = JSON.parse(read('package.json')).dependencies?.['rehype-sanitize'];
    assert(v && /^\d+\.\d+\.\d+$/.test(v), `not pinned exact: ${v}`);
  });
  await test('demo admin entry strings sit inside NODE_ENV !== production guard', () => {
    const files = ['app/admin/page.tsx', 'components/ProfileSwitcherModal.tsx'].filter(f => fs.existsSync(path.resolve(root, f)));
    for (const f of files) {
      const lines = read(f).split('\n');
      lines.forEach((l, i) => {
        if (/(Enter as|Preview as) Demo App Admin/.test(l)) {
          const ctx = lines.slice(Math.max(0, i - 30), i + 1).join('\n');
          assert(/NODE_ENV\s*!==\s*['"]production['"]/.test(ctx) || /isDev\w*|showDemo\w*/.test(ctx), `${f}:${i + 1} not guarded`);
        }
      });
    }
  });
  await test('next.config.ts sets 6 security headers, CSP without script-src', () => {
    const s = read('next.config.ts');
    for (const h of ['X-Content-Type-Options', 'nosniff', 'Referrer-Policy', 'Permissions-Policy', 'Strict-Transport-Security', 'X-Frame-Options', 'Content-Security-Policy', 'frame-ancestors', 'base-uri', 'object-src', 'form-action'])
      assert(s.includes(h), `missing ${h}`);
    assert(!/script-src/.test(s) && !/default-src/.test(s), 'CSP must not restrict script-src/default-src');
  });
  await test('lib/leaderboard.ts does not select email; LeaderboardEntry has no id', () => {
    const s = read('lib/leaderboard.ts');
    assert(!/select\([^)]*email/.test(s), 'selects email');
    const iface = s.match(/interface LeaderboardEntry\s*\{[^}]*\}/)?.[0] ?? '';
    assert(iface && !/\bid\s*[:?]/.test(iface), 'LeaderboardEntry has id');
    assert(/rpc\(\s*['"]get_leaderboard['"]/.test(s), 'does not use get_leaderboard rpc');
  });
  await test('leaderboard consumers do not rely on entry.id', () => {
    const bad = [...walk('components'), ...walk('app')].filter(f => /LeaderboardEntry/.test(read(f)) && /\.id\b/.test(read(f)) && /entry\.id|user\.id/.test(read(f)));
    assert(bad.length === 0, `check: ${bad.join(', ')}`);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
main();

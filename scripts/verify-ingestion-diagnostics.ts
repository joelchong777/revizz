import fs from 'fs';
import path from 'path';

/**
 * Static contract checks: Ingestion Diagnostics moved into the Ingestion Studio as a third tab.
 * Run with: npx tsx scripts/verify-ingestion-diagnostics.ts
 */

interface CheckResult {
  title: string;
  passed: boolean;
  details?: string;
}

const results: CheckResult[] = [];

function check(title: string, fn: () => boolean, details?: string) {
  try {
    results.push({ title, passed: fn(), details });
  } catch (err: any) {
    results.push({ title, passed: false, details: err?.message });
  }
}

const rootDir = process.cwd();
const read = (rel: string): string | null => {
  const p = path.join(rootDir, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

console.log('Starting Ingestion Diagnostics tab verification...\n');

// 1. Lab component
const labRel = 'components/admin/IngestionDiagnosticsLab.tsx';
const lab = read(labRel);
check('IngestionDiagnosticsLab.tsx exists', () => lab !== null);
if (lab !== null) {
  check('Lab has a default export', () => /export\s+default\b/.test(lab));
  check('Lab accepts headerStart?: ReactNode prop', () => /headerStart\?\s*:\s*(React\.)?ReactNode/.test(lab));
  check('Lab calls useQuestions itself', () => /useQuestions\s*\(/.test(lab));
  check('Lab has h2 "Ingestion diagnostics"', () => lab.includes('<h2') && /Ingestion diagnostics/.test(lab));
  check('Lab: if it imports a Markdown/KaTeX renderer it also uses MarkdownErrorBoundary', () => {
    const importsRenderer = /^import[^\n]*(react-markdown|ReactMarkdown|from ['"]katex|react-katex|MathText|MarkdownRenderer)/m.test(lab);
    return !importsRenderer || lab.includes('MarkdownErrorBoundary');
  });
}

// 2. IngestionHub
const studio = read('components/portal/IngestionHub.tsx');
check('IngestionHub.tsx exists', () => studio !== null);
if (studio !== null) {
  check("StudioSetupView includes 'diagnostics'", () => {
    const m = studio.match(/type\s+StudioSetupView\s*=([^;]+);/);
    return !!m && m[1].includes('diagnostics');
  });
  check('Tab id "diagnostics" with label "Diagnostics" in the tab list', () =>
    /id:\s*["']diagnostics["']/.test(studio) && /label:\s*["']Diagnostics["']/.test(studio));
  check('Tabs still include new and history, under role="tablist" with testid pattern', () =>
    /id:\s*["']new["']/.test(studio) &&
    /id:\s*["']history["']/.test(studio) &&
    studio.includes('role="tablist"') &&
    studio.includes('data-testid={`studio-tab-${t.id}`}'));
  check('Lab loaded via next/dynamic ssr:false, not statically imported', () =>
    studio.includes('next/dynamic') &&
    /ssr:\s*false/.test(studio) &&
    studio.includes('IngestionDiagnosticsLab') &&
    !/^import\s+IngestionDiagnosticsLab/m.test(studio) &&
    studio.includes('<IngestionDiagnosticsLab'));
  check("initialView 'diagnostics' opens the setup view", () =>
    /initialView[^\n]*diagnostics|diagnostics[^\n]*initialView/.test(studio));
}

// 3. AppAdminHub
const hub = read('components/admin/AppAdminHub.tsx');
check('AppAdminHub.tsx exists', () => hub !== null);
if (hub !== null) {
  check("AppAdminHub has no case 'diagnostics'", () => !/case\s+['"]diagnostics['"]/.test(hub));
  check('AppAdminHub no longer imports IngestionDiagnostics', () => !/IngestionDiagnostics\b/.test(hub.replace(/IngestionDiagnosticsLab/g, '')));
  check("AppAdminHub derives initialView from subTab 'history' | 'diagnostics'", () =>
    hub.includes('initialView') && hub.includes("'history'") && hub.includes("'diagnostics'"));
}

// 4. AppAdminNav
const nav = read('components/admin/AppAdminNav.tsx');
check('AppAdminNav.tsx exists', () => nav !== null);
if (nav !== null) {
  check('AppAdminNav has no "Ingestion Diagnostics" item', () => !nav.includes('Ingestion Diagnostics'));
  check("AppAdminNav has no handleNavClick('diagnostics')", () => !/handleNavClick\(\s*['"]diagnostics['"]/.test(nav));
}

// 5. app/admin/page.tsx
const page = read('app/admin/page.tsx');
check('app/admin/page.tsx exists', () => page !== null);
if (page !== null) {
  check("TAB_TITLES has no diagnostics key", () => {
    const m = page.match(/TAB_TITLES[^=]*=\s*\{([\s\S]*?)\};?/);
    return !!m && !/\bdiagnostics\b/.test(m[1]);
  });
  check("allowed-tab list does not include 'diagnostics' as a tab", () => {
    const m = page.match(/(allowed|valid|ALLOWED|VALID)\w*[^=]*=\s*(\[[\s\S]*?\]|new Set\([\s\S]*?\))/);
    return !m || !/diagnostics/.test(m[2]);
  });
  check("tab=diagnostics maps to ingestion + sub diagnostics", () =>
    /['"]diagnostics['"]/.test(page) && page.includes("'ingestion'") && /diagnostics/.test(page));
  check("handleSelectTab maps 'diagnostics' to ingestion/diagnostics", () => {
    const i = page.indexOf('handleSelectTab');
    return i !== -1 && /diagnostics/.test(page.slice(i, i + 1500));
  });
}

// Summary
let allPassed = true;
console.log('----------------------------------------------------');
for (const r of results) {
  if (r.passed) {
    console.log(`  PASS  ${r.title}`);
  } else {
    allPassed = false;
    console.log(`  FAIL  ${r.title}`);
    if (r.details) console.log(`      Error/Detail: ${r.details}`);
  }
}
console.log('----------------------------------------------------');

if (allPassed) {
  console.log('\nALL CHECKS PASSED: Ingestion Diagnostics tab contract holds.\n');
  process.exit(0);
} else {
  console.error('\nSOME CHECKS FAILED: review failed assertions above.\n');
  process.exit(1);
}

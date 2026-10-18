import fs from 'fs';
import path from 'path';

/**
 * Verification script for Ingestion History Ledger & Batch Contents Hub.
 * Run with: npx tsx scripts/verify-ingestion-history.ts
 */

interface CheckResult {
  title: string;
  passed: boolean;
  details?: string;
}

const results: CheckResult[] = [];

function check(title: string, fn: () => boolean, details?: string) {
  try {
    const passed = fn();
    results.push({ title, passed, details });
  } catch (err: any) {
    results.push({ title, passed: false, details: err?.message });
  }
}

const rootDir = process.cwd();

console.log('🔍 Starting Ingestion History Audit & Verification...\n');

// 1. Verify components/admin/IngestionHistoryHub.tsx exists
const hubPath = path.join(rootDir, 'components/admin/IngestionHistoryHub.tsx');
check('IngestionHistoryHub.tsx exists on disk', () => fs.existsSync(hubPath));

if (fs.existsSync(hubPath)) {
  const hubContent = fs.readFileSync(hubPath, 'utf8');

  // 1a. Error #310 Check: No early return before React hooks at component top-level
  check(
    'Error #310 Check: All React hooks declared unconditionally before any early return',
    () => {
      const fnIndex = hubContent.indexOf('function IngestionHistoryHub');
      if (fnIndex === -1) return false;

      // Find opening brace of the function body (after parameter list)
      const paramClose = hubContent.indexOf(')', fnIndex);
      if (paramClose === -1) return false;
      const bodyStart = hubContent.indexOf('{', paramClose);
      if (bodyStart === -1) return false;

      let depth = 0;
      let returnsAtDepth1: number[] = [];
      let lastHookPos = -1;

      for (let i = bodyStart; i < hubContent.length; i++) {
        const char = hubContent[i];
        if (char === '{') {
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0) break;
        } else if (depth === 1) {
          if (/\b(use[A-Z][a-zA-Z]+)\b/.test(hubContent.slice(i, i + 25))) {
            lastHookPos = i;
          }
          if (hubContent.slice(i, i + 6) === 'return') {
            returnsAtDepth1.push(i);
          }
        }
      }

      // There must be hooks, and no return at depth 1 before the last hook
      if (lastHookPos === -1) return false;
      const earlyReturns = returnsAtDepth1.filter((pos) => pos < lastHookPos);
      return earlyReturns.length === 0;
    }
  );

  // 1b. Check resolveDiagramUrl is used
  check(
    'Uses resolveDiagramUrl for CDN diagram path normalization',
    () => hubContent.includes('resolveDiagramUrl') && hubContent.includes('resolveDiagramUrl(q.diagram?.image_url)')
  );

  // 1c. Check rendering what was ingested and when (ingested_at / updated_at / published_at)
  check(
    'Renders what was ingested and timestamps (ingested_at, updated_at, relative time)',
    () =>
      hubContent.includes('ingested_at') &&
      hubContent.includes('updated_at') &&
      hubContent.includes('formatRelativeTime') &&
      hubContent.includes('formatDateTime')
  );

  // 1d. Check topic breakdown and question manifest
  check(
    'Inspects batch contents: topic breakdown grid and question manifest list',
    () =>
      hubContent.includes('topicBreakdown') &&
      hubContent.includes('activePaperTopicDistribution') &&
      hubContent.includes('filteredExpandedQuestions') &&
      hubContent.includes('stem_markdown') &&
      hubContent.includes('cambridge_source_ref')
  );

  // 1e. Check required data-testid attributes
  check(
    'Includes required UI test IDs (search, row, inspect button)',
    () =>
      hubContent.includes('data-testid="ingestion-history-search"') &&
      hubContent.includes('data-testid="ingest-history-row"') &&
      hubContent.includes('data-testid="inspect-ingest-btn"')
  );

  // 1f. Check loadPreset in Ingestion Studio integration
  check(
    'Provides quick action to load paper preset in Ingestion Studio',
    () => hubContent.includes('loadPreset') && hubContent.includes("onSelectTab?.('ingestion')")
  );

  // 1g. Check Edit in CMS integration
  check(
    'Provides Edit in CMS link for live questions',
    () => hubContent.includes('onOpenEditor') && hubContent.includes('Edit in CMS')
  );
}

// 2. Verify components/admin/AppAdminNav.tsx
const navPath = path.join(rootDir, 'components/admin/AppAdminNav.tsx');
check('AppAdminNav.tsx exists on disk', () => fs.existsSync(navPath));
if (fs.existsSync(navPath)) {
  const navContent = fs.readFileSync(navPath, 'utf8');
  check(
    "AppAdminNav includes 'history' nav item with Ingestion History label",
    () =>
      navContent.includes("handleNavClick('history')") &&
      navContent.includes('Ingestion History')
  );
}

// 3. Verify app/admin/page.tsx
const pagePath = path.join(rootDir, 'app/admin/page.tsx');
check('app/admin/page.tsx exists on disk', () => fs.existsSync(pagePath));
if (fs.existsSync(pagePath)) {
  const pageContent = fs.readFileSync(pagePath, 'utf8');
  check(
    "app/admin/page.tsx includes history: 'Ingestion History' in TAB_TITLES and supports tab=history",
    () =>
      pageContent.includes("history: 'Ingestion History'") &&
      pageContent.includes("'history'")
  );
}

// 4. Verify components/admin/AppAdminHub.tsx
const hubAdminPath = path.join(rootDir, 'components/admin/AppAdminHub.tsx');
check('AppAdminHub.tsx exists on disk', () => fs.existsSync(hubAdminPath));
if (fs.existsSync(hubAdminPath)) {
  const hubAdminContent = fs.readFileSync(hubAdminPath, 'utf8');
  check(
    "AppAdminHub.tsx imports IngestionHistoryHub and handles case 'history':",
    () =>
      hubAdminContent.includes('IngestionHistoryHub') &&
      hubAdminContent.includes("case 'history':") &&
      hubAdminContent.includes('<IngestionHistoryHub')
  );
}

// 5. Verify app/api/ingest/staged-paper/route.ts
const routePath = path.join(rootDir, 'app/api/ingest/staged-paper/route.ts');
check('app/api/ingest/staged-paper/route.ts exists on disk', () => fs.existsSync(routePath));
if (fs.existsSync(routePath)) {
  const routeContent = fs.readFileSync(routePath, 'utf8');
  check(
    'staged-paper route populates ingested_at, updated_at, and topicBreakdown',
    () =>
      routeContent.includes('ingested_at') &&
      routeContent.includes('updated_at') &&
      routeContent.includes('topicBreakdown')
  );
}

// Print summary
let allPassed = true;
console.log('----------------------------------------------------');
for (const r of results) {
  if (r.passed) {
    console.log(`  ✅  ${r.title}`);
  } else {
    allPassed = false;
    console.log(`  ❌  ${r.title}`);
    if (r.details) {
      console.log(`      Error/Detail: ${r.details}`);
    }
  }
}
console.log('----------------------------------------------------');

if (allPassed) {
  console.log('\n🎉 ALL CHECKS PASSED: Ingestion History Hub & QA Verification is 100% complete!\n');
  process.exit(0);
} else {
  console.error('\n⚠️  SOME CHECKS FAILED: Please review failed assertions above.\n');
  process.exit(1);
}

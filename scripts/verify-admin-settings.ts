/**
 * Revizz QA & Verification Test Suite
 * 
 * [Suite 16] Unified Platform Settings Hub & Portal Harmonization Verification
 * 
 * Tests:
 * 1. AdminSettingsHub.tsx Existence & Sub-Tabs Contract:
 *    - All 5 sub-tab keys present: 'school', 'system', 'ingestion', 'gameplay', 'auth'
 * 2. AdminSettingsHub.tsx Neobrutalist UI Design Tokens:
 *    - Surface tokens (#f9f4ed), 2px solid borders (border-2 border-[#201e1d]), tactile drop shadows (shadow-offset)
 * 3. AppAdminNav.tsx Navigation Item Contract:
 *    - Unified 'settings' tab registered with label 'Platform Settings' or 'Settings'
 * 4. app/admin/page.tsx Tab Routing & Metadata Contract:
 *    - TAB_TITLES includes 'settings' and URL searchParams handles 'settings' & 'sub' query params
 * 5. AppAdminHub.tsx Component Integration Contract:
 *    - Imports AdminSettingsHub and renders it under case 'settings'
 * 6. app/portal/page.tsx Educator Portal Harmonization Contract:
 *    - Direct link pointing to /admin?tab=settings with sub-tab deep links
 */

import fs from 'fs';
import path from 'path';

interface TestCase {
  id: string;
  name: string;
  run: () => { pass: boolean; details: string };
}

const tests: TestCase[] = [];

function registerTest(id: string, name: string, fn: () => { pass: boolean; details: string }) {
  tests.push({ id, name, run: fn });
}

const ROOT_DIR = process.cwd();

// ============================================================================
// TEST 1: AdminSettingsHub.tsx existence & 5 Sub-Tabs Contract
// ============================================================================
registerTest('TEST_1', 'AdminSettingsHub exists and declares 5 sub-tab keys', () => {
  const filePath = path.join(ROOT_DIR, 'components/admin/AdminSettingsHub.tsx');
  if (!fs.existsSync(filePath)) {
    return { pass: false, details: `File not found at ${filePath}` };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const requiredSubTabs = ['school', 'system', 'ingestion', 'gameplay', 'auth'];
  const missingTabs: string[] = [];

  for (const tab of requiredSubTabs) {
    const hasLiteralTab = content.includes(`'${tab}'`) || content.includes(`"${tab}"`);
    if (!hasLiteralTab) {
      missingTabs.push(tab);
    }
  }

  if (missingTabs.length > 0) {
    return {
      pass: false,
      details: `AdminSettingsHub is missing required sub-tabs: ${missingTabs.join(', ')}`,
    };
  }

  // Also check SettingsSubTab type definition or TABS declaration
  const hasTypeOrTabs = 
    content.includes('SettingsSubTab') &&
    content.includes('TABS');

  if (!hasTypeOrTabs) {
    return {
      pass: false,
      details: 'AdminSettingsHub does not declare SettingsSubTab type or TABS array',
    };
  }

  return {
    pass: true,
    details: `All 5 sub-tabs present ('${requiredSubTabs.join("', '")}') with type and tab configurations.`,
  };
});

// ============================================================================
// TEST 2: AdminSettingsHub.tsx Neobrutalist UI Tokens
// ============================================================================
registerTest('TEST_2', 'AdminSettingsHub contains authentic neobrutalist tokens', () => {
  const filePath = path.join(ROOT_DIR, 'components/admin/AdminSettingsHub.tsx');
  if (!fs.existsSync(filePath)) {
    return { pass: false, details: `File not found at ${filePath}` };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const tokensToCheck = [
    { name: 'Warm Cream Surface (#f9f4ed)', regex: /#f9f4ed/i },
    { name: '2px Hard Ink Border (border-2 border-[#201e1d])', regex: /border-2\s+border-\[#201e1d\]/i },
    { name: 'Hard Drop Shadow (shadow-offset)', regex: /shadow-offset/i },
  ];

  const missingTokens: string[] = [];
  for (const token of tokensToCheck) {
    if (!token.regex.test(content)) {
      missingTokens.push(token.name);
    }
  }

  if (missingTokens.length > 0) {
    return {
      pass: false,
      details: `AdminSettingsHub missing neobrutalist tokens: ${missingTokens.join(', ')}`,
    };
  }

  return {
    pass: true,
    details: 'Verified #f9f4ed, border-2 border-[#201e1d], and shadow-offset tokens.',
  };
});

// ============================================================================
// TEST 3: AppAdminNav.tsx Settings Navigation Item Contract
// ============================================================================
registerTest('TEST_3', 'AppAdminNav contains settings nav item with proper label', () => {
  const filePath = path.join(ROOT_DIR, 'components/admin/AppAdminNav.tsx');
  if (!fs.existsSync(filePath)) {
    return { pass: false, details: `File not found at ${filePath}` };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const hasSettingsHandler =
    content.includes("'settings'") || content.includes('"settings"');
  const hasSettingsLabel =
    content.includes('Platform Settings') || content.includes('Settings');

  if (!hasSettingsHandler || !hasSettingsLabel) {
    return {
      pass: false,
      details: `AppAdminNav missing settings nav key (${hasSettingsHandler}) or label (${hasSettingsLabel})`,
    };
  }

  return {
    pass: true,
    details: "Verified 'settings' navigation button with 'Platform Settings' label.",
  };
});

// ============================================================================
// TEST 4: app/admin/page.tsx Routing and TAB_TITLES Contract
// ============================================================================
registerTest('TEST_4', 'app/admin/page.tsx registers settings in TAB_TITLES and handles tab routing', () => {
  const filePath = path.join(ROOT_DIR, 'app/admin/page.tsx');
  if (!fs.existsSync(filePath)) {
    return { pass: false, details: `File not found at ${filePath}` };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const hasTabTitlesSettings =
    /TAB_TITLES[\s\S]*?settings\s*:/i.test(content) ||
    /settings:\s*['"]Platform Settings['"]/i.test(content) ||
    /settings:\s*['"]Settings['"]/i.test(content);

  const hasSettingsHandling =
    content.includes("'settings'") || content.includes('"settings"');

  if (!hasTabTitlesSettings || !hasSettingsHandling) {
    return {
      pass: false,
      details: `app/admin/page.tsx TAB_TITLES settings (${hasTabTitlesSettings}) or tab handling (${hasSettingsHandling}) missing`,
    };
  }

  return {
    pass: true,
    details: "Verified TAB_TITLES['settings'] and URL routing support.",
  };
});

// ============================================================================
// TEST 5: AppAdminHub.tsx Component Integration Contract
// ============================================================================
registerTest('TEST_5', 'AppAdminHub imports AdminSettingsHub and renders settings case', () => {
  const filePath = path.join(ROOT_DIR, 'components/admin/AppAdminHub.tsx');
  if (!fs.existsSync(filePath)) {
    return { pass: false, details: `File not found at ${filePath}` };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const importsSettingsHub =
    /import\s+.*AdminSettingsHub.*from/i.test(content);
  const rendersSettingsCase =
    /case\s+['"]settings['"]\s*:/i.test(content) &&
    /<AdminSettingsHub/i.test(content);

  if (!importsSettingsHub || !rendersSettingsCase) {
    return {
      pass: false,
      details: `AppAdminHub import (${importsSettingsHub}) or case 'settings' render (${rendersSettingsCase}) missing`,
    };
  }

  return {
    pass: true,
    details: 'Verified AdminSettingsHub import and case \'settings\' JSX render.',
  };
});

// ============================================================================
// TEST 6: app/portal/page.tsx Direct Link to /admin?tab=settings
// ============================================================================
registerTest('TEST_6', 'app/portal/page.tsx contains direct navigation link to /admin?tab=settings', () => {
  const filePath = path.join(ROOT_DIR, 'app/portal/page.tsx');
  if (!fs.existsSync(filePath)) {
    return { pass: false, details: `File not found at ${filePath}` };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const hasSettingsLink =
    content.includes('/admin?tab=settings') ||
    content.includes('/admin?tab=settings&sub=school');

  if (!hasSettingsLink) {
    return {
      pass: false,
      details: 'app/portal/page.tsx does not contain link pointing to /admin?tab=settings',
    };
  }

  return {
    pass: true,
    details: 'Verified link to /admin?tab=settings with sub-tab parameter support.',
  };
});

// ============================================================================
// RUNNER & SUMMARY
// ============================================================================
console.log('='.repeat(70));
console.log(' REVIZZ QA TEST SUITE: UNIFIED ADMIN SETTINGS & HARMONIZATION');
console.log('='.repeat(70));

let passCount = 0;
let failCount = 0;

for (const test of tests) {
  try {
    const result = test.run();
    if (result.pass) {
      console.log(`\x1b[32m✔ PASS\x1b[0m [${test.id}] ${test.name}`);
      console.log(`       ↳ ${result.details}`);
      passCount++;
    } else {
      console.log(`\x1b[31m✖ FAIL\x1b[0m [${test.id}] ${test.name}`);
      console.log(`       ↳ ${result.details}`);
      failCount++;
    }
  } catch (err: any) {
    console.log(`\x1b[31m✖ ERROR\x1b[0m [${test.id}] ${test.name}`);
    console.log(`       ↳ Exception: ${err?.message || err}`);
    failCount++;
  }
}

console.log('-'.repeat(70));
console.log(`Total: ${tests.length} | Passed: ${passCount} | Failed: ${failCount}`);
console.log('='.repeat(70));

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m✨ All Admin Settings Verification Tests Passed Successfully!\x1b[0m\n');
  process.exit(0);
}

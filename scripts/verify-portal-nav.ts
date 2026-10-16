/**
 * Revizz QA & Verification Test Suite
 * 
 * [Suite 15] Teacher Portal Navigation Configuration & Menu Management
 * 
 * Tests:
 * 1. Default Portal Nav Configuration Retrieval (standard items present, order, and enabled state)
 * 2. Toggle Portal Menu Item Disabling (enabled = false, filtered out of getActivePortalMenuItems)
 * 3. Toggle Portal Menu Item Re-enabling (enabled = true, restored to getActivePortalMenuItems)
 * 4. Add Custom Menu Item (custom label, URL, section, icon, unique ID enforcement)
 * 5. Remove Custom Menu Item (clean deletion, protection of standard core items)
 * 6. Reset to Defaults (restores initial 9 standard items, initial order, and purges custom links)
 * 7. LocalStorage Persistence & Reactive Event Notification (PORTAL_NAV_STORAGE_KEY & CustomEvent)
 * 8. Static Contracts Audit on AppAdminNav.tsx, app/admin/page.tsx, and AppAdminHub.tsx
 */

import fs from 'fs';
import path from 'path';

// Setup Mock LocalStorage and Window for Node.js test environment
class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

const mockStorage = new LocalStorageMock();
(globalThis as any).localStorage = mockStorage;

// Event tracking
interface DispatchedEvent {
  type: string;
  detail?: any;
}
const eventLog: DispatchedEvent[] = [];

(globalThis as any).window = {
  dispatchEvent: (event: any) => {
    eventLog.push({ type: event.type, detail: event.detail });
    return true;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  localStorage: mockStorage,
};

// Now import the module under test
import {
  PORTAL_NAV_STORAGE_KEY,
  PORTAL_NAV_CHANGE_EVENT,
  DEFAULT_PORTAL_NAV_ITEMS,
  getDefaultPortalNavItems,
  getPortalNavItems,
  getActivePortalMenuItems,
  savePortalNavItems,
  togglePortalMenuItem,
  setPortalMenuItemEnabled,
  addPortalMenuItem,
  removePortalMenuItem,
  resetPortalNavToDefaults,
  PortalNavItem,
} from '../lib/portal/menuConfig';

// Lightweight Test Runner
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err: any) {
    failedTests++;
    const message = `  \x1b[31m✗\x1b[0m ${name}\n    Error: ${err.message || err}`;
    failures.push(message);
    console.log(message);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message} -> Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('\n========================================================');
console.log('   [Suite 15] TEACHER PORTAL NAVIGATION & MENU MANAGEMENT');
console.log('========================================================\n');

// Reset storage before tests begin
mockStorage.clear();
eventLog.length = 0;

// -----------------------------------------------------------------------------
// Test Group 1: Default Configuration Retrieval
// -----------------------------------------------------------------------------
test('Default Configuration: All 9 standard items present, enabled, and ordered', () => {
  const defaults = getDefaultPortalNavItems();
  assertEqual(defaults.length, 9, 'Default portal nav items must contain exactly 9 standard modules');

  const expectedIds = [
    'overview',
    'roster',
    'assign',
    'compiler',
    'mastery',
    'xp',
    'bank',
    'flagged',
    'school',
  ];

  const actualIds = defaults.map((item) => item.id);
  assertEqual(JSON.stringify(actualIds), JSON.stringify(expectedIds), 'Default items have expected IDs in correct order');

  // Verify all default items are enabled
  const allEnabled = defaults.every((item) => item.enabled === true);
  assertEqual(allEnabled, true, 'All default portal nav items are enabled by default');

  // Verify sections
  const teachingSection = defaults.filter((item) => item.section === 'teaching');
  assertEqual(teachingSection.length, 4, 'Teaching section has overview, roster, assign, compiler');

  const analyticsSection = defaults.filter((item) => item.section === 'analytics');
  assertEqual(analyticsSection.length, 2, 'Analytics section has mastery, xp');

  const verificationSection = defaults.filter((item) => item.section === 'verification');
  assertEqual(verificationSection.length, 2, 'Verification section has bank, flagged');

  const schoolSection = defaults.filter((item) => item.section === 'school');
  assertEqual(schoolSection.length, 1, 'School section has school & licence');
});

test('Initial State: getPortalNavItems returns defaults when localStorage is empty', () => {
  mockStorage.clear();
  const items = getPortalNavItems();
  assertEqual(items.length, 9, 'Returns 9 default items when storage is empty');
  const activeItems = getActivePortalMenuItems();
  assertEqual(activeItems.length, 9, 'All 9 items are active initially');
});

// -----------------------------------------------------------------------------
// Test Group 2: Disabling Menu Items
// -----------------------------------------------------------------------------
test('Disabling Item: togglePortalMenuItem sets enabled = false and filters from active list', () => {
  mockStorage.clear();
  eventLog.length = 0;

  // Toggle compiler off
  const updated = togglePortalMenuItem('compiler');
  const compilerItem = updated.find((i) => i.id === 'compiler');
  assert(Boolean(compilerItem), 'Compiler item exists');
  assertEqual(compilerItem?.enabled, false, 'Compiler item enabled is false after toggle');

  // Verify active items does NOT include compiler
  const activeItems = getActivePortalMenuItems();
  assertEqual(activeItems.length, 8, 'Active items count reduced to 8');
  const activeCompiler = activeItems.find((i) => i.id === 'compiler');
  assertEqual(activeCompiler, undefined, 'Compiler item is excluded from active items');

  // Verify other items remain enabled
  const overviewItem = activeItems.find((i) => i.id === 'overview');
  assertEqual(overviewItem?.enabled, true, 'Overview item remains active');
});

test('Explicit setPortalMenuItemEnabled disables item accurately', () => {
  const updated = setPortalMenuItemEnabled('mastery', false);
  const masteryItem = updated.find((i) => i.id === 'mastery');
  assertEqual(masteryItem?.enabled, false, 'Mastery item explicitly disabled');

  const active = getActivePortalMenuItems();
  assertEqual(active.some((i) => i.id === 'mastery'), false, 'Mastery not in active list');
});

// -----------------------------------------------------------------------------
// Test Group 3: Re-enabling Menu Items
// -----------------------------------------------------------------------------
test('Re-enabling Item: togglePortalMenuItem restores enabled = true and returns to active list', () => {
  // Compiler was disabled in previous test, toggle it back on
  const updated = togglePortalMenuItem('compiler');
  const compilerItem = updated.find((i) => i.id === 'compiler');
  assertEqual(compilerItem?.enabled, true, 'Compiler item enabled is true after second toggle');

  const activeItems = getActivePortalMenuItems();
  const activeCompiler = activeItems.find((i) => i.id === 'compiler');
  assert(Boolean(activeCompiler), 'Compiler item is restored to active items list');
  assertEqual(activeCompiler?.label, 'Test compiler', 'Compiler label is preserved');
});

// -----------------------------------------------------------------------------
// Test Group 4: Custom Menu Items (Adding & Validation)
// -----------------------------------------------------------------------------
test('Add Custom Menu Item: Successfully adds custom link with unique ID, section, and icon', () => {
  const customLink: Omit<PortalNavItem, 'order'> = {
    id: 'dept-syllabus',
    label: 'Department Syllabus',
    section: 'custom',
    iconName: 'ExternalLink',
    href: 'https://school.edu/syllabus',
    enabled: true,
  };

  const updated = addPortalMenuItem(customLink);
  const found = updated.find((i) => i.id === 'dept-syllabus');
  assert(Boolean(found), 'Custom syllabus item exists in updated configuration');
  assertEqual(found?.label, 'Department Syllabus', 'Label matches');
  assertEqual(found?.href, 'https://school.edu/syllabus', 'Href matches');
  assertEqual(found?.isCustom, true, 'isCustom flag is set to true');
  assertEqual(found?.iconName, 'ExternalLink', 'Icon name is preserved');
  assertEqual(found?.section, 'custom', 'Section is custom');

  // Active items includes the custom link
  const active = getActivePortalMenuItems();
  assert(active.some((i) => i.id === 'dept-syllabus'), 'Custom item appears in getActivePortalMenuItems');
});

test('Add Custom Menu Item: Rejects duplicate ID with descriptive error', () => {
  let thrown = false;
  try {
    addPortalMenuItem({
      id: 'dept-syllabus', // Duplicate ID
      label: 'Duplicate Link',
      section: 'custom',
      iconName: 'Link',
      enabled: true,
    });
  } catch (err: any) {
    thrown = true;
    assert(err.message.includes('already exists'), 'Error message mentions item already exists');
  }
  assertEqual(thrown, true, 'Adding duplicate menu ID throws an exception');
});

// -----------------------------------------------------------------------------
// Test Group 5: Removing Menu Items & Safety Guards
// -----------------------------------------------------------------------------
test('Remove Custom Menu Item: Cleanly deletes custom item from configuration', () => {
  const updated = removePortalMenuItem('dept-syllabus');
  const found = updated.find((i) => i.id === 'dept-syllabus');
  assertEqual(found, undefined, 'Custom item is deleted from configuration');

  const active = getActivePortalMenuItems();
  assertEqual(active.some((i) => i.id === 'dept-syllabus'), false, 'Custom item absent from active list');
});

test('Remove Safety Guard: Refuses to delete standard core items', () => {
  let thrown = false;
  try {
    removePortalMenuItem('overview');
  } catch (err: any) {
    thrown = true;
    assert(err.message.includes('Cannot delete standard core item'), 'Error protects standard items from deletion');
  }
  assertEqual(thrown, true, 'Attempting to delete standard core item throws an exception');

  // Verify overview is still present in configuration
  const items = getPortalNavItems();
  assert(items.some((i) => i.id === 'overview'), 'Overview standard item remains in configuration');
});

// -----------------------------------------------------------------------------
// Test Group 6: Resetting to Defaults
// -----------------------------------------------------------------------------
test('Reset to Defaults: Restores initial standard items, orders, and purges custom additions', () => {
  // Setup modified state: disable overview, add custom link
  togglePortalMenuItem('overview');
  addPortalMenuItem({
    id: 'temp-calendar',
    label: 'Term Calendar',
    section: 'custom',
    iconName: 'Calendar',
    href: 'https://school.edu/calendar',
    enabled: true,
  });

  const modified = getPortalNavItems();
  assertEqual(modified.find((i) => i.id === 'overview')?.enabled, false, 'Overview is disabled prior to reset');
  assert(Boolean(modified.find((i) => i.id === 'temp-calendar')), 'Custom calendar exists prior to reset');

  // Reset to defaults
  const resetItems = resetPortalNavToDefaults();
  assertEqual(resetItems.length, 9, 'Reset returns exact 9 default items');
  assertEqual(resetItems.find((i) => i.id === 'overview')?.enabled, true, 'Overview is re-enabled');
  assertEqual(resetItems.find((i) => i.id === 'temp-calendar'), undefined, 'Custom calendar is purged');

  // Storage reflects defaults
  const active = getActivePortalMenuItems();
  assertEqual(active.length, 9, 'All 9 items active after reset');
});

// -----------------------------------------------------------------------------
// Test Group 7: Storage Persistence & Event Broadcasting
// -----------------------------------------------------------------------------
test('Storage Persistence: Serializes state to localStorage and parses safely', () => {
  mockStorage.clear();
  togglePortalMenuItem('roster');

  const rawStorage = mockStorage.getItem(PORTAL_NAV_STORAGE_KEY);
  assert(Boolean(rawStorage), 'Storage key contains serialized data');

  const parsed = JSON.parse(rawStorage!);
  assert(Array.isArray(parsed), 'Serialized value is a valid JSON array');
  const roster = parsed.find((i: any) => i.id === 'roster');
  assertEqual(roster.enabled, false, 'Stored roster item has enabled = false');
});

test('Event Notification: Dispatches PORTAL_NAV_CHANGE_EVENT on state modifications', () => {
  eventLog.length = 0;

  togglePortalMenuItem('assign');
  assertEqual(eventLog.length > 0, true, 'togglePortalMenuItem dispatches change event');
  assertEqual(eventLog[eventLog.length - 1].type, PORTAL_NAV_CHANGE_EVENT, 'Event type matches PORTAL_NAV_CHANGE_EVENT');

  addPortalMenuItem({
    id: 'notif-test',
    label: 'Notification Test',
    section: 'custom',
    iconName: 'Bell',
    enabled: true,
  });
  assertEqual(eventLog[eventLog.length - 1].type, PORTAL_NAV_CHANGE_EVENT, 'addPortalMenuItem dispatches change event');

  removePortalMenuItem('notif-test');
  assertEqual(eventLog[eventLog.length - 1].type, PORTAL_NAV_CHANGE_EVENT, 'removePortalMenuItem dispatches change event');

  resetPortalNavToDefaults();
  assertEqual(eventLog[eventLog.length - 1].type, PORTAL_NAV_CHANGE_EVENT, 'resetPortalNavToDefaults dispatches change event');
});

test('Storage Resilience: Falls back safely to defaults if localStorage has corrupted data', () => {
  mockStorage.setItem(PORTAL_NAV_STORAGE_KEY, 'invalid-json{{{');
  const fallbackItems = getPortalNavItems();
  assertEqual(fallbackItems.length, 9, 'Corrupted storage gracefully falls back to default 9 items');
  assertEqual(fallbackItems[0].id, 'overview', 'First item is overview');
});

// -----------------------------------------------------------------------------
// Test Group 8: Static Contract Audit on Admin Nav, Hub, and Route Integration
// -----------------------------------------------------------------------------
test('Static Audit: AppAdminNav.tsx component contract and navigation item', () => {
  const navPath = path.resolve(process.cwd(), 'components/admin/AppAdminNav.tsx');
  assertEqual(fs.existsSync(navPath), true, 'components/admin/AppAdminNav.tsx exists');

  const navContent = fs.readFileSync(navPath, 'utf8');
  // Check for portal-menu item or integration hook
  assert(
    navContent.includes('portal-menu') || navContent.includes('Portal Menu') || navContent.includes('Menu Manager') || navContent.includes('Portal Navigation'),
    'AppAdminNav.tsx contains portal menu navigation entry'
  );
});

test('Static Audit: app/admin/page.tsx TAB_TITLES includes portal-menu', () => {
  const adminPagePath = path.resolve(process.cwd(), 'app/admin/page.tsx');
  assertEqual(fs.existsSync(adminPagePath), true, 'app/admin/page.tsx exists');

  const pageContent = fs.readFileSync(adminPagePath, 'utf8');
  assert(
    pageContent.includes("'portal-menu'") || pageContent.includes('"portal-menu"'),
    "app/admin/page.tsx registers 'portal-menu' tab"
  );
});

test('Static Audit: AppAdminHub.tsx integrates portal-menu view', () => {
  const hubPath = path.resolve(process.cwd(), 'components/admin/AppAdminHub.tsx');
  assertEqual(fs.existsSync(hubPath), true, 'components/admin/AppAdminHub.tsx exists');

  const hubContent = fs.readFileSync(hubPath, 'utf8');
  assert(
    hubContent.includes('portal-menu'),
    "components/admin/AppAdminHub.tsx routes 'portal-menu' tab"
  );
});

test('Static Audit: PortalMenuManager UI component exists or is referenced', () => {
  const componentPath1 = path.resolve(process.cwd(), 'components/admin/PortalMenuManager.tsx');
  const componentPath2 = path.resolve(process.cwd(), 'components/portal/PortalMenuManager.tsx');
  const componentExists = fs.existsSync(componentPath1) || fs.existsSync(componentPath2);

  // Check if either component file exists or if AppAdminHub imports PortalMenuManager
  const hubPath = path.resolve(process.cwd(), 'components/admin/AppAdminHub.tsx');
  const hubContent = fs.existsSync(hubPath) ? fs.readFileSync(hubPath, 'utf8') : '';
  const isReferencedInHub = hubContent.includes('PortalMenuManager') || hubContent.includes('portal-menu');

  assert(
    componentExists || isReferencedInHub,
    'PortalMenuManager component or hub integration is present'
  );
});

// -----------------------------------------------------------------------------
// Test Summary & Exit
// -----------------------------------------------------------------------------
console.log('\n========================================================');
console.log(`   TOTAL TESTS: ${totalTests}`);
console.log(`   \x1b[32mPASSED:      ${passedTests}\x1b[0m`);
if (failedTests > 0) {
  console.log(`   \x1b[31mFAILED:      ${failedTests}\x1b[0m`);
  console.log('========================================================\n');
  process.exit(1);
} else {
  console.log(`   \x1b[32mALL [Suite 15] ASSERTIONS PASSED PERFECTLY!\x1b[0m`);
  console.log('========================================================\n');
  process.exit(0);
}

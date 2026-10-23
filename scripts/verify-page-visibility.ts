/**
 * Page visibility: pure-logic checks (registry, menuConfig alignment, helpers).
 * Run: npx tsx scripts/verify-page-visibility.ts
 */
import { PAGE_REGISTRY, isPageHidden, filterHidden, isKnownPageId, PAGE_VISIBILITY_ENDPOINT } from '../lib/pageVisibility';
import { DEFAULT_PORTAL_NAV_ITEMS } from '../lib/portal/menuConfig';

let failed = 0;
function check(name: string, ok: boolean) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
}

const ids = PAGE_REGISTRY.map((p) => p.id as string);
check('registry ids are unique', new Set(ids).size === ids.length);

const teacherIds = PAGE_REGISTRY.filter((p) => p.audience === 'teacher').map((p) => p.id as string).sort();
const menuIds = DEFAULT_PORTAL_NAV_ITEMS.map((i) => i.id).sort();
check('teacher ids match menuConfig defaults', JSON.stringify(teacherIds) === JSON.stringify(menuIds));

const studentIds = PAGE_REGISTRY.filter((p) => p.audience === 'student').map((p) => p.id as string).sort();
check(
  'student ids are the agreed eight',
  JSON.stringify(studentIds) ===
    JSON.stringify(['achievements', 'homework', 'leaderboard', 'profile', 'quiz', 'review', 'stats', 'student-settings'])
);

check('isPageHidden true for hidden id', isPageHidden(['stats'], 'stats'));
check('isPageHidden false for other id', !isPageHidden(['stats'], 'quiz'));
check('isPageHidden false for empty list', !isPageHidden([], 'stats'));
check('filterHidden removes hidden items', filterHidden([{ id: 'a' }, { id: 'b' }], ['a']).map((x) => x.id).join() === 'b');
check('isKnownPageId accepts registry id', isKnownPageId('bank'));
check('isKnownPageId rejects unknown and non-string', !isKnownPageId('nope') && !isKnownPageId(5) && !isKnownPageId(undefined));
check('endpoint constant', PAGE_VISIBILITY_ENDPOINT === '/api/page-visibility');

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll page visibility checks passed');

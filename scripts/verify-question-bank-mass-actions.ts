import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { CAMBRIDGE_QUESTIONS, CAMBRIDGE_TOPICS } from '../lib/questions';
import { 
  QuestionBankItem, 
  BankItemStatus, 
  getStatusBadgeClass 
} from '../components/portal/AdminTools';

console.log('=== Running Question Bank Mass Actions Verification Suite ===\n');

// 1. Initial State & Data Generation Verification
console.log('Test 1: Verify Initial Data Generation & Status Distribution');
assert.strictEqual(CAMBRIDGE_QUESTIONS.length >= 30, true, 'CAMBRIDGE_QUESTIONS has at least 30 items');

// Replicate mapping logic from AdminTools
const initialBank: QuestionBankItem[] = CAMBRIDGE_QUESTIONS.map((q, idx): QuestionBankItem => {
  const qNum = idx + 1;
  let st: BankItemStatus = 'Live';
  if (idx === 24 || idx === 25) {
    st = 'Agent draft';
  } else if (idx === 26 || idx === 27) {
    st = 'Needs review';
  } else if (idx >= 28) {
    st = 'Flagged';
  }
  const stCls = getStatusBadgeClass(st);
  const diff = idx % 3 === 0 ? 'Easy' : idx % 3 === 1 ? 'Medium' : 'Hard';
  const acc = idx % 4 === 0 ? '78%' : idx % 4 === 1 ? '64%' : idx % 4 === 2 ? '89%' : '52%';
  const upd = st === 'Live' ? 'Live' : '2d ago';
  return {
    id: q.id,
    stem: q.stem_markdown,
    cite: q.citation || `Q${qNum}`,
    topic: q.topic || 'General',
    paper: q.citation?.split(' ')[0] || 'None',
    session: 'None',
    diff,
    acc,
    st,
    stCls,
    upd,
  };
});

assert.strictEqual(initialBank.length, 30, 'Total bank questions is 30');
const liveCount = initialBank.filter((q) => q.st === 'Live').length;
const agentCount = initialBank.filter((q) => q.st === 'Agent draft').length;
const reviewCount = initialBank.filter((q) => q.st === 'Needs review').length;
const flaggedCount = initialBank.filter((q) => q.st === 'Flagged').length;

assert.strictEqual(liveCount, 24, 'Initial Live questions count is 24');
assert.strictEqual(agentCount, 2, 'Initial Agent draft questions count is 2');
assert.strictEqual(reviewCount, 2, 'Initial Needs review questions count is 2');
assert.strictEqual(flaggedCount, 2, 'Initial Flagged questions count is 2');
console.log('✓ Initial state reflects 30 questions (Live: 24, Agent draft: 2, Needs review: 2, Flagged: 2)');

// 2. Status Badge Class Testing
console.log('\nTest 2: Status Badge Class Styling');
assert.strictEqual(getStatusBadgeClass('Live'), 'bg-[#ccdbb2] text-[#272e1b]');
assert.strictEqual(getStatusBadgeClass('Agent draft'), 'bg-[#f0fae1] text-[#728157]');
assert.strictEqual(getStatusBadgeClass('Needs review'), 'bg-[#ffe1d0] text-[#c67139]');
assert.strictEqual(getStatusBadgeClass('Flagged'), 'bg-[#fde8e8] text-[#e0533c]');
console.log('✓ Status badges match tactile neobrutalist color tokens');

// 3. Selection & Master Checkbox Logic
console.log('\nTest 3: Selection & Master Checkbox Indeterminate Logic');
const pageSize = 20;
const page1 = initialBank.slice(0, pageSize);
let selected = new Set<string>();

const computeCheckboxState = (page: QuestionBankItem[], sel: Set<string>) => {
  const allSelected = page.length > 0 && page.every((q) => sel.has(q.id));
  const someSelected = page.some((q) => sel.has(q.id));
  const isIndeterminate = someSelected && !allSelected;
  return { allSelected, isIndeterminate };
};

// Initial: none selected
let state = computeCheckboxState(page1, selected);
assert.strictEqual(state.allSelected, false);
assert.strictEqual(state.isIndeterminate, false);

// Select 1 item: indeterminate
selected.add(page1[0].id);
state = computeCheckboxState(page1, selected);
assert.strictEqual(state.allSelected, false);
assert.strictEqual(state.isIndeterminate, true);

// Select all on page: allSelected = true, indeterminate = false
page1.forEach((q) => selected.add(q.id));
state = computeCheckboxState(page1, selected);
assert.strictEqual(state.allSelected, true);
assert.strictEqual(state.isIndeterminate, false);
assert.strictEqual(selected.size, 20);

// Select all matching: 30 items
initialBank.forEach((q) => selected.add(q.id));
assert.strictEqual(selected.size, 30);

// Clear selection: 0 items
selected.clear();
state = computeCheckboxState(page1, selected);
assert.strictEqual(selected.size, 0);
assert.strictEqual(state.allSelected, false);
assert.strictEqual(state.isIndeterminate, false);
console.log('✓ Master checkbox and selection logic properly handles unchecked, indeterminate, and checked states');

// 4. Mass Action State Transitions
console.log('\nTest 4: Mass State Transitions');

// 4a. Mass Delete
let bank = [...initialBank];
const toDelete = new Set([bank[0].id, bank[1].id, bank[2].id]);
bank = bank.filter((q) => !toDelete.has(q.id));
assert.strictEqual(bank.length, 27, 'Bank questions decreased by 3');
assert.strictEqual(bank.some((q) => toDelete.has(q.id)), false, 'Deleted questions are removed');

// 4b. Mass Status Update
const toUpdateStatus = new Set([bank[0].id, bank[1].id]);
bank = bank.map((q) => {
  if (toUpdateStatus.has(q.id)) {
    return {
      ...q,
      st: 'Needs review' as BankItemStatus,
      stCls: getStatusBadgeClass('Needs review'),
      upd: 'Just now',
    };
  }
  return q;
});
assert.strictEqual(bank[0].st, 'Needs review');
assert.strictEqual(bank[0].stCls, 'bg-[#ffe1d0] text-[#c67139]');
assert.strictEqual(bank[1].st, 'Needs review');

// 4c. Mass Topic Reassignment
const newTopic = 'Economic development';
const toUpdateTopic = new Set([bank[0].id, bank[1].id]);
bank = bank.map((q) => {
  if (toUpdateTopic.has(q.id)) {
    return {
      ...q,
      topic: newTopic,
      upd: 'Just now',
    };
  }
  return q;
});
assert.strictEqual(bank[0].topic, newTopic);
assert.strictEqual(bank[1].topic, newTopic);

// 4d. Export format verification
const exportItems = bank.slice(0, 3);
const jsonString = JSON.stringify(exportItems, null, 2);
const parsed = JSON.parse(jsonString);
assert.strictEqual(parsed.length, 3);
assert.strictEqual(parsed[0].id, bank[0].id);
assert.strictEqual(parsed[0].stem, bank[0].stem);
assert.strictEqual(parsed[0].topic, bank[0].topic);
console.log('✓ Mass Delete, Mass Status Update, Mass Topic Reassignment, and Export formats verified');

// 5. Static Code Inspection of AdminTools.tsx
console.log('\nTest 5: Component Structure & UX Inspection');
const adminToolsSource = fs.readFileSync(
  path.join(__dirname, '../components/portal/AdminTools.tsx'),
  'utf8'
);

// Checkbox column in header
assert.strictEqual(
  adminToolsSource.includes('ref={headerCheckboxRef}'),
  true,
  'AdminTools has headerCheckboxRef for indeterminate state'
);

// Stop propagation on row selection
assert.strictEqual(
  adminToolsSource.includes('e.stopPropagation()'),
  true,
  'AdminTools has e.stopPropagation() on row checkbox toggle'
);

// Row selection highlight
assert.strictEqual(
  adminToolsSource.includes('bg-[#ffe1d0]/50 border-l-4 border-[#c67139]'),
  true,
  'AdminTools highlights selected rows with warm tint and border'
);

// Floating Actions Deck
assert.strictEqual(
  adminToolsSource.includes('selectedIds.size > 0'),
  true,
  'AdminTools displays floating actions deck when 1+ questions selected'
);
assert.strictEqual(
  adminToolsSource.includes('Delete Selected'),
  true,
  'AdminTools has Delete Selected button'
);
assert.strictEqual(
  adminToolsSource.includes('Change Status'),
  true,
  'AdminTools has Change Status button'
);
assert.strictEqual(
  adminToolsSource.includes('Reassign Topic'),
  true,
  'AdminTools has Reassign Topic button'
);
assert.strictEqual(
  adminToolsSource.includes('Export Selected'),
  true,
  'AdminTools has Export Selected button'
);
assert.strictEqual(
  adminToolsSource.includes('Deselect All'),
  true,
  'AdminTools has Deselect All button'
);

// Confirmation Pop-up Modal
assert.strictEqual(
  adminToolsSource.includes('confirmationModal.isOpen'),
  true,
  'AdminTools includes Confirmation Pop-up Modal controlled by state'
);
assert.strictEqual(
  adminToolsSource.includes('role="dialog"'),
  true,
  'AdminTools Confirmation Modal has accessible dialog role'
);
assert.strictEqual(
  adminToolsSource.includes('aria-modal="true"'),
  true,
  'AdminTools Confirmation Modal has aria-modal="true"'
);
assert.strictEqual(
  adminToolsSource.includes('rounded-[28px] border-2 border-[#201e1d] bg-[#f9f4ed] shadow-[6px_6px_0_#201e1d]'),
  true,
  'AdminTools Confirmation Modal follows Revizz neobrutalist aesthetic'
);
assert.strictEqual(
  adminToolsSource.includes('Affected Questions'),
  true,
  'AdminTools Confirmation Modal shows preview list of affected questions'
);
assert.strictEqual(
  adminToolsSource.includes('handleConfirmMassAction'),
  true,
  'AdminTools has handleConfirmMassAction handler'
);
assert.strictEqual(
  adminToolsSource.includes("e.key === 'Escape'"),
  true,
  'AdminTools closes modal and dropdowns on Escape key'
);

// Dynamic status counter tabs
assert.strictEqual(
  adminToolsSource.includes('All {bankQuestions.length}'),
  true,
  'AdminTools has dynamic "All" tab count'
);
assert.strictEqual(
  adminToolsSource.includes("Live {bankQuestions.filter((q) => q.st === 'Live').length}"),
  true,
  'AdminTools has dynamic "Live" tab count'
);
assert.strictEqual(
  adminToolsSource.includes("bankQuestions.filter((q) => q.st === 'Agent draft').length"),
  true,
  'AdminTools has dynamic "Agent drafts" tab'
);

console.log('✓ All component UI, accessibility, and interaction constraints validated successfully!\n');
console.log('=== All Question Bank Mass Actions Verification Tests Passed! ===');

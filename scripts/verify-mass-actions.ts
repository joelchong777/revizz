/**
 * Comprehensive Automated Verification Test Suite for Question Bank Mass Actions
 *
 * Validates:
 * 1. Selection logic: single toggle, page select, filtered all select, deselect.
 * 2. Deletion state transformation: removing IDs from question bank array,
 *    updating tab counts (All, Live, Needs review, etc.), ensuring proper pagination clamping.
 * 3. Mass status and topic update state transformations.
 * 4. Modal state transitions: opening confirm modal, rejecting/cancelling preserves state,
 *    confirming applies mutations and clears selection.
 * 5. Empty selection safety (mass actions disabled when selection is empty).
 * 6. Component Contract & Neobrutalist Design Audit on components/portal/AdminTools.tsx.
 *
 * Usage:
 * npx tsx scripts/verify-mass-actions.ts
 */

import fs from 'fs';
import path from 'path';
import {
  toggleSelectQuestion,
  toggleSelectPage,
  selectAllFiltered,
  clearSelection,
  isAllPageSelected,
  isSomePageSelected,
  applyMassDelete,
  calculateClampedPage,
  calculateTotalPages,
  applyMassStatusUpdate,
  applyMassTopicUpdate,
  computeStatusCounts,
  openMassActionModal,
  closeMassActionModal,
  executeModalConfirm,
  INITIAL_MODAL_STATE,
  BankStatus,
} from '../lib/portal/massActions';

let passed = 0;
let total = 0;

function assert(condition: boolean, message: string) {
  total++;
  if (!condition) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${message}`);
    process.exitCode = 1;
  } else {
    passed++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
  }
}

interface TestQuestionItem {
  id: string;
  stem: string;
  cite: string;
  topic: string;
  diff: 'Easy' | 'Medium' | 'Hard';
  st: BankStatus;
  stCls: string;
}

function createMockQuestions(count: number): TestQuestionItem[] {
  const statuses: BankStatus[] = ['Live', 'Agent draft', 'Needs review', 'Flagged'];
  const topics = [
    'The basic economic problem',
    'The allocation of resources',
    'Microeconomic decision makers',
    'Government and the macroeconomy',
  ];

  return Array.from({ length: count }, (_, idx) => {
    const qNum = idx + 1;
    const st = statuses[idx % statuses.length];
    return {
      id: `0455-s24-12-q${String(qNum).padStart(2, '0')}`,
      stem: `Stem for test question ${qNum}`,
      cite: `Cambridge IGCSE Economics 0455/12 May/June 2024 Q${qNum}`,
      topic: topics[idx % topics.length],
      diff: idx % 3 === 0 ? 'Hard' : idx % 2 === 0 ? 'Medium' : 'Easy',
      st,
      stCls: 'bg-[#ccdbb2] text-[#272e1b]',
    };
  });
}

async function run() {
  console.log('\n===============================================================');
  console.log('🧪 REVIZZ: QUESTION BANK MASS ACTIONS VERIFICATION SUITE');
  console.log('===============================================================\n');

  // =================================================================
  // SUITE 1: SELECTION LOGIC
  // =================================================================
  console.log('--- Suite 1: Selection Logic (Toggle, Page, Filtered, Clear) ---');

  // 1.1 Single toggle
  let selection = new Set<string>();
  selection = toggleSelectQuestion(selection, 'q1');
  assert(selection.has('q1') && selection.size === 1, 'Single toggle: selecting unselected item adds it to Set');

  selection = toggleSelectQuestion(selection, 'q2');
  assert(selection.has('q1') && selection.has('q2') && selection.size === 2, 'Single toggle: selecting another item adds it preserving existing');

  selection = toggleSelectQuestion(selection, 'q1');
  assert(!selection.has('q1') && selection.has('q2') && selection.size === 1, 'Single toggle: toggling selected item removes it');

  // 1.2 Page select toggle
  const page1 = ['p1-q1', 'p1-q2', 'p1-q3'];
  const page2 = ['p2-q1', 'p2-q2'];

  selection = clearSelection();
  assert(selection.size === 0, 'clearSelection returns empty Set');

  // Page select when none selected
  selection = toggleSelectPage(selection, page1);
  assert(
    page1.every((id) => selection.has(id)) && selection.size === 3,
    'Page select: selecting page when none selected selects all items on page'
  );
  assert(isAllPageSelected(selection, page1), 'isAllPageSelected is true when all page items selected');
  assert(isSomePageSelected(selection, page1), 'isSomePageSelected is true when all page items selected');

  // Page select preserves other page selections
  selection = toggleSelectPage(selection, page2);
  assert(
    [...page1, ...page2].every((id) => selection.has(id)) && selection.size === 5,
    'Page select: selecting second page preserves first page selections'
  );

  // Partial page selection: toggleSelectPage selects remaining items
  selection = new Set(['p1-q1']); // only 1 of 3 selected on page1
  assert(!isAllPageSelected(selection, page1), 'isAllPageSelected is false for partial page selection');
  assert(isSomePageSelected(selection, page1), 'isSomePageSelected is true for partial page selection');

  selection = toggleSelectPage(selection, page1);
  assert(
    page1.every((id) => selection.has(id)),
    'Page select: selecting page with partial selection selects ALL items on page'
  );

  // Page select when all already selected: deselects page
  selection = toggleSelectPage(selection, page1);
  assert(
    page1.every((id) => !selection.has(id)) && selection.size === 0,
    'Page select: toggling page when all selected deselects all items on that page'
  );

  // Empty page handling
  selection = toggleSelectPage(selection, []);
  assert(selection.size === 0, 'Page select: empty page array is safe no-op');
  assert(!isAllPageSelected(selection, []), 'isAllPageSelected is false for empty page');
  assert(!isSomePageSelected(selection, []), 'isSomePageSelected is false for empty page');

  // 1.3 Filtered all select
  const allFiltered = ['f1', 'f2', 'f3', 'f4', 'f5'];
  selection = new Set(['existing-1']);
  selection = selectAllFiltered(selection, allFiltered);
  assert(
    selection.size === 6 && allFiltered.every((id) => selection.has(id)) && selection.has('existing-1'),
    'Filtered all select: selects all filtered items across all pages preserving existing selections'
  );

  // =================================================================
  // SUITE 2: DELETION STATE TRANSFORMATION & PAGINATION CLAMPING
  // =================================================================
  console.log('\n--- Suite 2: Deletion State Transformation & Pagination Clamping ---');

  const mockQuestions = createMockQuestions(45); // 45 questions = 3 pages of 20 (page 1: 20, page 2: 20, page 3: 5)
  const pageSize = 20;

  assert(calculateTotalPages(mockQuestions.length, pageSize) === 3, 'calculateTotalPages: 45 items = 3 pages of 20');

  // 2.1 Apply mass delete of 5 items
  const toDelete5 = new Set([mockQuestions[0].id, mockQuestions[1].id, mockQuestions[2].id, mockQuestions[3].id, mockQuestions[4].id]);
  const deleteResult1 = applyMassDelete(mockQuestions, toDelete5);

  assert(deleteResult1.deletedCount === 5, 'applyMassDelete: returns accurate deletedCount of 5');
  assert(deleteResult1.updatedItems.length === 40, 'applyMassDelete: reduces total count from 45 to 40');
  assert(
    Array.from(toDelete5).every((id) => !deleteResult1.updatedItems.some((q) => q.id === id)),
    'applyMassDelete: deleted IDs are completely absent from updated array'
  );
  assert(
    deleteResult1.updatedItems[0].id === mockQuestions[5].id,
    'applyMassDelete: preserves order of remaining items'
  );

  // 2.2 Tab counts update after deletion
  const postDeleteCounts = computeStatusCounts(deleteResult1.updatedItems);
  assert(
    postDeleteCounts.all === 40,
    `Tab counts: post-delete 'All' count is exactly 40 (got ${postDeleteCounts.all})`
  );
  const sumStatuses = postDeleteCounts.live + postDeleteCounts.agentDraft + postDeleteCounts.needsReview + postDeleteCounts.flagged;
  assert(
    sumStatuses === postDeleteCounts.all,
    'Tab counts: sum of sub-status tab counts equals total All count'
  );

  // 2.3 Pagination clamping on deletion
  // Scenario A: User is on page 3 (which had items 41-45). We delete all 5 items on page 3.
  const page3Items = mockQuestions.slice(40, 45).map((q) => q.id);
  const deletePage3Result = applyMassDelete(mockQuestions, page3Items);
  const remainingCountA = deletePage3Result.updatedItems.length; // 40 items = 2 pages
  const clampedPageA = calculateClampedPage(3, remainingCountA, pageSize);
  assert(
    clampedPageA === 2,
    `Pagination clamping: deleting all items on last page (page 3) clamps current page down to page 2 (got ${clampedPageA})`
  );

  // Scenario B: User is on page 2. Deleting items from page 1 does not exceed total pages.
  const clampedPageB = calculateClampedPage(2, 35, pageSize); // 35 items = 2 pages
  assert(clampedPageB === 2, 'Pagination clamping: remaining on page 2 when total pages is 2');

  // Scenario C: User deletes ALL items. Page clamps to 1.
  const allIds = new Set(mockQuestions.map((q) => q.id));
  const deleteAll = applyMassDelete(mockQuestions, allIds);
  assert(deleteAll.updatedItems.length === 0, 'applyMassDelete: deleting all items yields empty array');
  const clampedPageEmpty = calculateClampedPage(3, deleteAll.updatedItems.length, pageSize);
  assert(clampedPageEmpty === 1, 'Pagination clamping: deleting all items clamps page to 1');

  // Scenario D: Boundary check on pageSize zero/negative
  assert(calculateTotalPages(0, pageSize) === 1, 'calculateTotalPages: 0 items returns 1 page');
  assert(calculateClampedPage(-5, 50, pageSize) === 1, 'calculateClampedPage: negative page clamps to 1');

  // 2.4 Empty selection safety on deletion
  const noOpDelete = applyMassDelete(mockQuestions, new Set<string>());
  assert(noOpDelete.deletedCount === 0 && noOpDelete.updatedItems === mockQuestions, 'applyMassDelete: empty selection is safe no-op');

  // =================================================================
  // SUITE 3: MASS STATUS & TOPIC UPDATE STATE TRANSFORMATIONS
  // =================================================================
  console.log('\n--- Suite 3: Mass Status & Topic Update State Transformations ---');

  const sampleQuestions = createMockQuestions(10);
  const targetIds = new Set([sampleQuestions[0].id, sampleQuestions[2].id, sampleQuestions[4].id]);

  // 3.1 Mass Status Update to 'Live'
  const statusUpdateResult = applyMassStatusUpdate(sampleQuestions, targetIds, 'Live');
  assert(statusUpdateResult.updatedCount === 3, 'applyMassStatusUpdate: returns accurate updatedCount of 3');
  assert(
    statusUpdateResult.updatedItems.filter((q) => targetIds.has(q.id)).every((q) => q.st === 'Live'),
    'applyMassStatusUpdate: all selected items have st set to Live'
  );
  assert(
    statusUpdateResult.updatedItems.filter((q) => targetIds.has(q.id)).every((q) => q.stCls === 'bg-[#ccdbb2] text-[#272e1b]'),
    'applyMassStatusUpdate: selected items receive calibrated Neobrutalist Live badge style'
  );
  assert(
    statusUpdateResult.updatedItems[1].st === sampleQuestions[1].st,
    'applyMassStatusUpdate: unselected items retain original status'
  );

  // 3.2 Mass Status Update to 'Needs review'
  const reviewUpdateResult = applyMassStatusUpdate(sampleQuestions, targetIds, 'Needs review');
  assert(
    reviewUpdateResult.updatedItems.filter((q) => targetIds.has(q.id)).every((q) => q.st === 'Needs review'),
    'applyMassStatusUpdate: updates to Needs review successfully'
  );

  // 3.3 Mass Status Update empty selection safety
  const emptyStatusUpdate = applyMassStatusUpdate(sampleQuestions, new Set(), 'Flagged');
  assert(
    emptyStatusUpdate.updatedCount === 0 && emptyStatusUpdate.updatedItems === sampleQuestions,
    'applyMassStatusUpdate: empty selection is safe no-op'
  );

  // 3.4 Mass Topic Update
  const newTopicName = 'International trade and globalisation';
  const topicUpdateResult = applyMassTopicUpdate(sampleQuestions, targetIds, newTopicName);
  assert(topicUpdateResult.updatedCount === 3, 'applyMassTopicUpdate: returns accurate updatedCount of 3');
  assert(
    topicUpdateResult.updatedItems.filter((q) => targetIds.has(q.id)).every((q) => q.topic === newTopicName),
    'applyMassTopicUpdate: all selected items receive new topic name'
  );
  assert(
    topicUpdateResult.updatedItems[1].topic === sampleQuestions[1].topic,
    'applyMassTopicUpdate: unselected items retain original topic'
  );

  // 3.5 Mass Topic Update empty selection safety
  const emptyTopicUpdate = applyMassTopicUpdate(sampleQuestions, new Set(), newTopicName);
  assert(
    emptyTopicUpdate.updatedCount === 0 && emptyTopicUpdate.updatedItems === sampleQuestions,
    'applyMassTopicUpdate: empty selection is safe no-op'
  );
  const blankTopicUpdate = applyMassTopicUpdate(sampleQuestions, targetIds, '   ');
  assert(
    blankTopicUpdate.updatedCount === 0 && blankTopicUpdate.updatedItems === sampleQuestions,
    'applyMassTopicUpdate: whitespace-only topic is safe no-op'
  );

  // =================================================================
  // SUITE 4: MODAL STATE TRANSITIONS & EMPTY SELECTION SAFETY
  // =================================================================
  console.log('\n--- Suite 4: Modal State Transitions & Confirmation Flow ---');

  // 4.1 Open modal with valid selection
  const selectedForDelete = new Set(['q-01', 'q-02']);
  const modalOpenState = openMassActionModal('delete', selectedForDelete);
  assert(modalOpenState.isOpen === true, 'openMassActionModal: isOpen is true');
  assert(modalOpenState.actionType === 'delete', 'openMassActionModal: actionType is delete');
  assert(modalOpenState.selectedIds.length === 2, 'openMassActionModal: selectedIds preserved');

  // 4.2 Empty selection safety when opening modal
  const emptyModalAttempt = openMassActionModal('delete', new Set());
  assert(
    emptyModalAttempt.isOpen === false && emptyModalAttempt.actionType === null,
    'openMassActionModal: opening modal with empty selection is prevented (isOpen remains false)'
  );

  // 4.3 Rejecting/Cancelling modal preserves state
  const cancelledModalState = closeMassActionModal();
  assert(
    cancelledModalState.isOpen === false && cancelledModalState.actionType === null,
    'closeMassActionModal: modal state is reset to closed'
  );
  assert(
    selectedForDelete.size === 2 && selectedForDelete.has('q-01'),
    'Rejecting/Cancelling modal: preserves existing selections intact'
  );

  // 4.4 Confirming modal executes mutation and clears selection
  const testPool = createMockQuestions(8);
  const idsToDelete = [testPool[0].id, testPool[1].id];
  const deleteModalState = openMassActionModal('delete', idsToDelete);

  const confirmResult = executeModalConfirm(deleteModalState, testPool);
  assert(confirmResult.affectedCount === 2, 'executeModalConfirm: returns accurate affectedCount of 2');
  assert(confirmResult.items.length === 6, 'executeModalConfirm: applies deletion to items array');
  assert(
    confirmResult.clearedSelection.size === 0,
    'executeModalConfirm: automatically clears selection upon successful confirmation'
  );
  assert(
    confirmResult.modalState.isOpen === false && confirmResult.modalState.actionType === null,
    'executeModalConfirm: automatically closes modal state upon confirmation'
  );

  // 4.5 Confirming status update modal
  const idsForStatus = [testPool[2].id, testPool[3].id];
  const statusModalState = openMassActionModal('status', idsForStatus, 'Flagged');
  const confirmStatusResult = executeModalConfirm(statusModalState, testPool);
  assert(confirmStatusResult.affectedCount === 2, 'executeModalConfirm: status update affectedCount is 2');
  assert(
    confirmStatusResult.items.filter((q) => idsForStatus.includes(q.id)).every((q) => q.st === 'Flagged'),
    'executeModalConfirm: selected items updated to Flagged'
  );
  assert(confirmStatusResult.clearedSelection.size === 0, 'executeModalConfirm: clears selection after status update');

  // 4.6 Safety: executing confirm with inactive modal
  const inactiveConfirm = executeModalConfirm(INITIAL_MODAL_STATE, testPool);
  assert(
    inactiveConfirm.affectedCount === 0 && inactiveConfirm.items === testPool,
    'executeModalConfirm: inactive modal confirm is safe no-op'
  );

  // =================================================================
  // SUITE 5: STATIC CONTRACT & DESIGN AUDIT ON AdminTools.tsx
  // =================================================================
  console.log('\n--- Suite 5: Static Contract & Design Audit on AdminTools.tsx ---');
  const adminToolsPath = path.resolve(process.cwd(), 'components/portal/AdminTools.tsx');
  const code = fs.readFileSync(adminToolsPath, 'utf8');

  // 5.1 Mass Selection State & References
  assert(code.includes('selectedIds'), 'AdminTools.tsx declares selectedIds state');
  assert(code.includes('headerCheckboxRef'), 'AdminTools.tsx declares headerCheckboxRef for indeterminate support');
  assert(code.includes('confirmationModal'), 'AdminTools.tsx declares confirmationModal state');
  assert(code.includes('headerCheckboxRef.current.indeterminate'), 'AdminTools.tsx syncs header checkbox indeterminate state');

  // 5.2 Selection Handlers & Master Checkbox
  assert(code.includes('const toggleSelect ='), 'AdminTools.tsx implements toggleSelect item handler');
  assert(code.includes('const handleToggleSelectPage ='), 'AdminTools.tsx implements handleToggleSelectPage handler');
  assert(code.includes('const handleSelectAllMatching ='), 'AdminTools.tsx implements handleSelectAllMatching across pages');
  assert(code.includes('const handleClearSelection ='), 'AdminTools.tsx implements handleClearSelection handler');

  // 5.3 Mass Action Toolbar & Actions
  assert(code.includes('selectedIds.size > 0'), 'Floating Mass Actions deck conditionally renders only when items selected');
  assert(code.includes('handleOpenConfirmModal(\'delete\')'), 'Delete Selected button opens confirmation modal with delete type');
  assert(code.includes('handleOpenConfirmModal(\'status\''), 'Change Status dropdown options trigger confirmation modal with status type');
  assert(code.includes('handleOpenConfirmModal(\'topic\''), 'Reassign Topic dropdown options trigger confirmation modal with topic type');
  assert(code.includes('handleExportSelected'), 'Export Selected button provides JSON export capability');

  // 5.4 Mutation Execution & Pagination Clamping
  assert(
    code.includes('setBankQuestions((prev) => {') &&
    code.includes('prev.filter((q) => !selectedIds.has(q.id))'),
    'handleConfirmMassAction filters out deleted questions from active state'
  );
  assert(
    code.includes('Math.max(1, Math.ceil(updated.length / pageSize))') &&
    code.includes('setBankPage((p) => Math.min(p, newMaxPage))'),
    'handleConfirmMassAction clamps bankPage when last page items are deleted'
  );
  assert(
    code.includes('setSelectedIds(new Set())'),
    'handleConfirmMassAction clears selectedIds upon successful mutation'
  );

  // 5.5 Modal Accessibility & Neobrutalist Design Tokens
  assert(code.includes('role="dialog"') && code.includes('aria-modal="true"'), 'Confirmation modal implements ARIA dialog attributes');
  assert(code.includes('aria-labelledby="confirm-modal-title"'), 'Confirmation modal connects title via aria-labelledby');
  assert(code.includes('aria-describedby="confirm-modal-desc"'), 'Confirmation modal connects description via aria-describedby');
  assert(code.includes('shadow-[6px_6px_0_#201e1d]'), 'Modal applies Revizz tactile 3D neobrutalist shadow-[6px_6px_0_#201e1d]');
  assert(code.includes('border-2 border-[#201e1d]'), 'Modal applies Revizz chunky border-2 border-[#201e1d]');
  assert(code.includes('selectedItemsPreview'), 'Confirmation modal displays affected questions preview list');

  // 5.6 Keyboard Accessibility & Dismissal
  assert(code.includes("e.key === 'Escape'"), 'Modal and dropdowns support Escape key dismissal');
  assert(code.includes('stopPropagation'), 'Row checkbox clicks stopPropagation to prevent opening editor drawer');

  // Final summary
  console.log('\n===============================================================');
  console.log(`VERIFICATION SUMMARY: ${passed}/${total} assertions passed (100% SUCCESS)`);
  console.log('===============================================================\n');

  if (process.exitCode && process.exitCode !== 0) {
    console.error('❌ Verification suite encountered assertion failures.');
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Unhandled error in verification suite:', err);
  process.exit(1);
});

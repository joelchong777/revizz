/**
 * Pure state transformations and helpers for Question Bank mass actions.
 * Used by AdminTools.tsx and automated verification test suites.
 */

export type BankStatus = 'Live' | 'Agent draft' | 'Needs review' | 'Flagged';

export interface BaseQuestionBankItem {
  id: string;
  stem?: string;
  cite?: string;
  topic: string;
  diff?: 'Easy' | 'Medium' | 'Hard';
  st: BankStatus | string;
  stCls?: string;
  upd?: string;
  [key: string]: unknown;
}

export type MassActionType = 'delete' | 'status' | 'topic';

export interface MassActionModalState {
  isOpen: boolean;
  actionType: MassActionType | null;
  targetValue?: string;
  selectedIds: string[];
}

export const INITIAL_MODAL_STATE: MassActionModalState = {
  isOpen: false,
  actionType: null,
  targetValue: undefined,
  selectedIds: [],
};

// ==========================================
// 1. SELECTION LOGIC HELPERS
// ==========================================

function toSet(selected: Set<string> | string[]): Set<string> {
  return selected instanceof Set ? new Set(selected) : new Set(selected);
}

/**
 * Toggles a single question's selection in the Set.
 */
export function toggleSelectQuestion(
  currentSelected: Set<string> | string[],
  id: string
): Set<string> {
  const next = toSet(currentSelected);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/**
 * Toggles selection for all questions visible on the current page.
 * If all page items are already selected, deselects them.
 * Otherwise, selects all of them (preserving any selections from other pages).
 */
export function toggleSelectPage(
  currentSelected: Set<string> | string[],
  pageItemIds: string[]
): Set<string> {
  const next = toSet(currentSelected);
  if (pageItemIds.length === 0) return next;

  const allSelected = pageItemIds.every((id) => next.has(id));

  if (allSelected) {
    pageItemIds.forEach((id) => next.delete(id));
  } else {
    pageItemIds.forEach((id) => next.add(id));
  }
  return next;
}

/**
 * Selects all questions matching the active filter criteria across all pages.
 */
export function selectAllFiltered(
  currentSelected: Set<string> | string[],
  filteredItemIds: string[]
): Set<string> {
  const next = toSet(currentSelected);
  filteredItemIds.forEach((id) => next.add(id));
  return next;
}

/**
 * Clears all selections.
 */
export function clearSelection(): Set<string> {
  return new Set<string>();
}

/**
 * Checks if every item on the current page is selected.
 */
export function isAllPageSelected(
  selected: Set<string> | string[],
  pageItemIds: string[]
): boolean {
  if (pageItemIds.length === 0) return false;
  const set = toSet(selected);
  return pageItemIds.every((id) => set.has(id));
}

/**
 * Checks if some (but not necessarily all) items on the current page are selected.
 */
export function isSomePageSelected(
  selected: Set<string> | string[],
  pageItemIds: string[]
): boolean {
  if (pageItemIds.length === 0) return false;
  const set = toSet(selected);
  return pageItemIds.some((id) => set.has(id));
}

// ==========================================
// 2. DELETION & PAGINATION STATE HELPERS
// ==========================================

/**
 * Removes selected IDs from the question bank array.
 * Returns the updated array, deleted count, and deleted IDs.
 */
export function applyMassDelete<T extends { id: string }>(
  items: T[],
  selectedIds: Set<string> | string[]
): { updatedItems: T[]; deletedCount: number; deletedIds: string[] } {
  const set = toSet(selectedIds);
  if (set.size === 0) {
    return { updatedItems: items, deletedCount: 0, deletedIds: [] };
  }

  const deletedIds: string[] = [];
  const updatedItems = items.filter((item) => {
    if (set.has(item.id)) {
      deletedIds.push(item.id);
      return false;
    }
    return true;
  });

  return {
    updatedItems,
    deletedCount: deletedIds.length,
    deletedIds,
  };
}

/**
 * Calculates total pages given total item count and page size (min 1).
 */
export function calculateTotalPages(totalItems: number, pageSize: number): number {
  if (pageSize <= 0) return 1;
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

/**
 * Clamps the current page number to stay within valid page bounds [1, totalPages].
 * Critical when mass-deleting items from the last page.
 */
export function calculateClampedPage(
  currentPage: number,
  totalItems: number,
  pageSize: number
): number {
  const maxPages = calculateTotalPages(totalItems, pageSize);
  if (currentPage > maxPages) {
    return maxPages;
  }
  if (currentPage < 1) {
    return 1;
  }
  return currentPage;
}

// ==========================================
// 3. MASS STATUS & TOPIC UPDATES
// ==========================================

export const STATUS_STYLE_MAP: Record<BankStatus, string> = {
  Live: 'bg-[#ccdbb2] text-[#272e1b]',
  'Agent draft': 'bg-[#e0e7ff] text-[#3730a3]',
  'Needs review': 'bg-[#fef3c7] text-[#92400e]',
  Flagged: 'bg-[#fee2e2] text-[#991b1b]',
};

/**
 * Updates status and status badge class for selected items.
 */
export function applyMassStatusUpdate<T extends { id: string; st: string; stCls?: string }>(
  items: T[],
  selectedIds: Set<string> | string[],
  newStatus: BankStatus | string,
  newStCls?: string
): { updatedItems: T[]; updatedCount: number } {
  const set = toSet(selectedIds);
  if (set.size === 0) {
    return { updatedItems: items, updatedCount: 0 };
  }

  const badgeClass =
    newStCls ||
    (newStatus in STATUS_STYLE_MAP
      ? STATUS_STYLE_MAP[newStatus as BankStatus]
      : 'bg-[#ccdbb2] text-[#272e1b]');

  let updatedCount = 0;
  const updatedItems = items.map((item) => {
    if (set.has(item.id)) {
      updatedCount++;
      return {
        ...item,
        st: newStatus,
        stCls: badgeClass,
      };
    }
    return item;
  });

  return { updatedItems, updatedCount };
}

/**
 * Updates topic for selected items.
 */
export function applyMassTopicUpdate<T extends { id: string; topic: string }>(
  items: T[],
  selectedIds: Set<string> | string[],
  newTopic: string
): { updatedItems: T[]; updatedCount: number } {
  const set = toSet(selectedIds);
  if (set.size === 0 || !newTopic.trim()) {
    return { updatedItems: items, updatedCount: 0 };
  }

  let updatedCount = 0;
  const updatedItems = items.map((item) => {
    if (set.has(item.id)) {
      updatedCount++;
      return {
        ...item,
        topic: newTopic,
      };
    }
    return item;
  });

  return { updatedItems, updatedCount };
}

// ==========================================
// 4. TAB COUNTS CALCULATION
// ==========================================

export interface StatusCounts {
  all: number;
  live: number;
  agentDraft: number;
  needsReview: number;
  flagged: number;
}

/**
 * Computes counts for Question Bank filter tabs.
 */
export function computeStatusCounts<T extends { st: string }>(items: T[]): StatusCounts {
  let live = 0;
  let agentDraft = 0;
  let needsReview = 0;
  let flagged = 0;

  for (const item of items) {
    if (item.st === 'Live') live++;
    else if (item.st === 'Agent draft') agentDraft++;
    else if (item.st === 'Needs review') needsReview++;
    else if (item.st === 'Flagged') flagged++;
  }

  return {
    all: items.length,
    live,
    agentDraft,
    needsReview,
    flagged,
  };
}

// ==========================================
// 5. MODAL STATE TRANSITIONS
// ==========================================

/**
 * Creates modal state to open the confirmation modal.
 * Returns initial modal state if selectedIds is empty (empty selection safety).
 */
export function openMassActionModal(
  actionType: MassActionType,
  selectedIds: Set<string> | string[],
  targetValue?: string
): MassActionModalState {
  const ids = Array.from(toSet(selectedIds));
  if (ids.length === 0) {
    return INITIAL_MODAL_STATE;
  }
  return {
    isOpen: true,
    actionType,
    targetValue,
    selectedIds: ids,
  };
}

/**
 * Closes the confirmation modal while preserving current selections.
 */
export function closeMassActionModal(): MassActionModalState {
  return INITIAL_MODAL_STATE;
}

/**
 * Confirms and executes the requested mass action modal operation.
 * Applies mutations, resets modal state, and returns cleared selection Set.
 */
export function executeModalConfirm<T extends { id: string; st: string; topic: string; stCls?: string }>(
  modalState: MassActionModalState,
  items: T[]
): {
  items: T[];
  clearedSelection: Set<string>;
  modalState: MassActionModalState;
  affectedCount: number;
} {
  if (!modalState.isOpen || !modalState.actionType || modalState.selectedIds.length === 0) {
    return {
      items,
      clearedSelection: toSet(modalState.selectedIds),
      modalState,
      affectedCount: 0,
    };
  }

  let resultItems = items;
  let affectedCount = 0;

  switch (modalState.actionType) {
    case 'delete': {
      const res = applyMassDelete(items, modalState.selectedIds);
      resultItems = res.updatedItems;
      affectedCount = res.deletedCount;
      break;
    }
    case 'status': {
      if (modalState.targetValue) {
        const res = applyMassStatusUpdate(items, modalState.selectedIds, modalState.targetValue);
        resultItems = res.updatedItems;
        affectedCount = res.updatedCount;
      }
      break;
    }
    case 'topic': {
      if (modalState.targetValue) {
        const res = applyMassTopicUpdate(items, modalState.selectedIds, modalState.targetValue);
        resultItems = res.updatedItems;
        affectedCount = res.updatedCount;
      }
      break;
    }
  }

  return {
    items: resultItems,
    clearedSelection: clearSelection(),
    modalState: INITIAL_MODAL_STATE,
    affectedCount,
  };
}

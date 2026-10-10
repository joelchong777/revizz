'use client';

import { useSyncExternalStore } from 'react';
import {
  StagingPaper,
  StagingQuestion,
  StagingOption,
  validateStagingPaper,
} from '@/types/ingestion';

export type PublishStatus = 'idle' | 'validating' | 'publishing' | 'success' | 'error';
export type StatusFilter = 'all' | 'valid' | 'review' | 'diagrams';

export interface IngestionState {
  paper: StagingPaper | null;
  selectedIdx: number;
  showLivePreview: boolean;
  isSettingsModalOpen: boolean;
  isPayloadModalOpen: boolean;
  isAuditDrawerOpen: boolean;
  publishStatus: PublishStatus;
  publishMessage: string;
  searchQuery: string;
  statusFilter: StatusFilter;
}

export interface IngestionActions {
  loadPreset: (id?: string) => Promise<void>;
  loadJson: (jsonContent: any) => { success: boolean; errors?: string[] };
  updatePaperMetadata: (updates: Partial<StagingPaper>) => void;
  setSelectedIdx: (idx: number) => void;
  addQuestion: () => void;
  deleteQuestion: (idx: number) => void;
  duplicateQuestion: (idx: number) => void;
  moveQuestion: (fromIdx: number, toIdx: number) => void;
  updateQuestion: (idx: number, updated: StagingQuestion) => void;
  setCorrectOption: (label: 'A' | 'B' | 'C' | 'D') => void;
  toggleStatus: (idx: number) => void;
  publishToSupabase: () => Promise<{ success: boolean; data?: any; error?: string }>;
  saveDraftToLocalStorage: (storageKey?: string) => boolean;
  loadDraftFromLocalStorage: (storageKey?: string) => boolean;
  clearDraft: (storageKey?: string) => void;
  hasDraft: (storageKey?: string) => boolean;
  setPaper: (paper: StagingPaper | null) => void;
  setShowLivePreview: (show: boolean | ((prev: boolean) => boolean)) => void;
  setIsSettingsModalOpen: (open: boolean) => void;
  setIsPayloadModalOpen: (open: boolean) => void;
  setIsAuditDrawerOpen: (open: boolean) => void;
  setPublishStatus: (status: PublishStatus) => void;
  setPublishMessage: (message: string) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  resetStore: () => void;
}

export interface IngestionStore extends IngestionState, IngestionActions {
  selectedQuestion: StagingQuestion | null;
}

const LOCAL_STORAGE_KEY = 'revizz_ingestion_draft';

const initialRawState: IngestionState = {
  paper: null,
  selectedIdx: 0,
  showLivePreview: true,
  isSettingsModalOpen: false,
  isPayloadModalOpen: false,
  isAuditDrawerOpen: false,
  publishStatus: 'idle',
  publishMessage: '',
  searchQuery: '',
  statusFilter: 'all',
};

// Internal mutable state holder
let state: IngestionState = { ...initialRawState };
const listeners = new Set<() => void>();

function getState(): IngestionState {
  return state;
}

function setState(updates: Partial<IngestionState> | ((prev: IngestionState) => Partial<IngestionState>)) {
  const nextPartial = typeof updates === 'function' ? updates(state) : updates;
  state = {
    ...state,
    ...nextPartial,
  };
  rebuildSnapshot();
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions: IngestionActions = {
  async loadPreset(id?: string): Promise<void> {
    const targetId = id || '0455_s24_12';
    setState({
      publishStatus: 'validating',
      publishMessage: `Loading preset paper "${targetId}"...`,
    });

    try {
      const res = await fetch(`/api/ingest/staged-paper?id=${encodeURIComponent(targetId)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch preset: HTTP ${res.status}`);
      }

      const data = await res.json();
      const paperData: StagingPaper = data?.paper || data;

      // Validate paper against staging schema
      const validation = validateStagingPaper(paperData, { allowPartialBatch: true });
      if (!validation.success) {
        console.warn('Preset loaded with validation warnings:', validation.errors);
      }

      setState({
        paper: paperData,
        selectedIdx: 0,
        publishStatus: 'idle',
        publishMessage: `Preset "${targetId}" loaded successfully.`,
      });
    } catch (err: any) {
      console.error('Failed to load preset:', err);
      setState({
        publishStatus: 'error',
        publishMessage: err.message || 'Error loading preset',
      });
    }
  },

  loadJson(jsonContent: any): { success: boolean; errors?: string[] } {
    try {
      let parsed = jsonContent;
      if (typeof jsonContent === 'string') {
        parsed = JSON.parse(jsonContent);
      }

      if (!parsed || typeof parsed !== 'object') {
        return { success: false, errors: ['Invalid JSON payload: expected an object.'] };
      }

      const candidatePaper = parsed.paper || parsed;
      const validation = validateStagingPaper(candidatePaper, { allowPartialBatch: true });

      if (!validation.success) {
        return {
          success: false,
          errors: validation.errors || ['Schema validation failed for provided JSON.'],
        };
      }

      setState({
        paper: validation.data || candidatePaper,
        selectedIdx: 0,
        publishStatus: 'idle',
        publishMessage: 'JSON paper loaded and validated successfully.',
      });

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        errors: [err?.message || 'Failed to parse JSON content.'],
      };
    }
  },

  updatePaperMetadata(updates: Partial<StagingPaper>): void {
    const currentPaper = getState().paper;
    if (!currentPaper) return;

    const mergedPaper: StagingPaper = {
      ...currentPaper,
      ...updates,
      subject: updates.subject
        ? { ...currentPaper.subject, ...updates.subject }
        : currentPaper.subject,
      paper: updates.paper
        ? { ...currentPaper.paper, ...updates.paper }
        : currentPaper.paper,
      syllabus_topics: updates.syllabus_topics
        ? updates.syllabus_topics
        : currentPaper.syllabus_topics,
      questions: updates.questions
        ? updates.questions
        : currentPaper.questions,
    };

    setState({ paper: mergedPaper });
  },

  setSelectedIdx(idx: number): void {
    const currentPaper = getState().paper;
    const count = currentPaper?.questions?.length || 0;
    const safeIdx = count > 0 ? Math.max(0, Math.min(idx, count - 1)) : 0;
    setState({ selectedIdx: safeIdx });
  },

  addQuestion(): void {
    const currentPaper = getState().paper;
    const currentQuestions = currentPaper?.questions ? [...currentPaper.questions] : [];
    const nextQNum = currentQuestions.length + 1;
    const series = currentPaper?.paper?.series || 's';
    const year = currentPaper?.paper?.year || 2024;
    const paperCode = currentPaper?.paper?.paper_code || '12';
    const subjectCode = currentPaper?.subject?.code || '0455';
    const defaultTopic = currentPaper?.syllabus_topics?.[0]?.name || 'General';

    const newQuestion: StagingQuestion = {
      question_number: nextQNum,
      cambridge_source_ref: `Cambridge ${subjectCode}/${paperCode} ${series}${year} Q${nextQNum}`,
      topic_name: defaultTopic,
      stem_markdown: '',
      diagram: {
        has_diagram: false,
      },
      options: [
        { label: 'A', content_markdown: '', is_correct: true },
        { label: 'B', content_markdown: '', is_correct: false },
        { label: 'C', content_markdown: '', is_correct: false },
        { label: 'D', content_markdown: '', is_correct: false },
      ],
      explanation_markdown: '',
      status: 'active',
    };

    const newQuestions = [...currentQuestions, newQuestion];
    const newPaper: StagingPaper = currentPaper
      ? { ...currentPaper, questions: newQuestions }
      : {
          subject: { code: subjectCode, name: 'Economics', icon: '📈' },
          paper: { series, paper_code: paperCode, year },
          syllabus_topics: [{ name: defaultTopic, order_index: 1 }],
          questions: newQuestions,
        };

    setState({
      paper: newPaper,
      selectedIdx: newQuestions.length - 1,
    });
  },

  deleteQuestion(idx: number): void {
    const currentPaper = getState().paper;
    if (!currentPaper || !currentPaper.questions || currentPaper.questions.length === 0) return;
    if (idx < 0 || idx >= currentPaper.questions.length) return;

    const updatedQuestions = currentPaper.questions
      .filter((_, i) => i !== idx)
      .map((q, i) => ({
        ...q,
        question_number: i + 1,
      }));

    const currentIdx = getState().selectedIdx;
    let nextIdx = currentIdx;
    if (idx < currentIdx) {
      nextIdx = Math.max(0, currentIdx - 1);
    } else if (idx === currentIdx) {
      nextIdx = Math.min(currentIdx, Math.max(0, updatedQuestions.length - 1));
    } else {
      nextIdx = Math.min(currentIdx, Math.max(0, updatedQuestions.length - 1));
    }

    setState({
      paper: { ...currentPaper, questions: updatedQuestions },
      selectedIdx: nextIdx,
    });
  },

  duplicateQuestion(idx: number): void {
    const currentPaper = getState().paper;
    if (!currentPaper || !currentPaper.questions || currentPaper.questions.length === 0) return;
    if (idx < 0 || idx >= currentPaper.questions.length) return;

    const target = currentPaper.questions[idx];
    const cloned: StagingQuestion = {
      ...target,
      cambridge_source_ref: `${target.cambridge_source_ref || 'Question'} (Copy)`,
      options: target.options.map((opt) => ({ ...opt })),
      diagram: target.diagram ? JSON.parse(JSON.stringify(target.diagram)) : undefined,
    };

    const newQuestions = [
      ...currentPaper.questions.slice(0, idx + 1),
      cloned,
      ...currentPaper.questions.slice(idx + 1),
    ].map((q, i) => ({
      ...q,
      question_number: i + 1,
    }));

    setState({
      paper: { ...currentPaper, questions: newQuestions },
      selectedIdx: idx + 1,
    });
  },

  moveQuestion(fromIdx: number, toIdx: number): void {
    const currentPaper = getState().paper;
    if (!currentPaper || !currentPaper.questions) return;
    const count = currentPaper.questions.length;
    if (fromIdx < 0 || fromIdx >= count || toIdx < 0 || toIdx >= count || fromIdx === toIdx) return;

    const newQuestions = [...currentPaper.questions];
    const [moved] = newQuestions.splice(fromIdx, 1);
    newQuestions.splice(toIdx, 0, moved);

    const renumbered = newQuestions.map((q, i) => ({
      ...q,
      question_number: i + 1,
    }));

    setState({
      paper: { ...currentPaper, questions: renumbered },
      selectedIdx: toIdx,
    });
  },

  updateQuestion(idx: number, updated: StagingQuestion): void {
    const currentPaper = getState().paper;
    if (!currentPaper || !currentPaper.questions || !currentPaper.questions[idx]) return;

    const newQuestions = [...currentPaper.questions];
    newQuestions[idx] = updated;

    setState({
      paper: { ...currentPaper, questions: newQuestions },
    });
  },

  setCorrectOption(label: 'A' | 'B' | 'C' | 'D'): void {
    const currentPaper = getState().paper;
    const idx = getState().selectedIdx;
    if (!currentPaper || !currentPaper.questions || !currentPaper.questions[idx]) return;

    const currentQ = currentPaper.questions[idx];
    const updatedOptions = currentQ.options.map((opt) => ({
      ...opt,
      is_correct: opt.label === label,
    }));

    const updatedQ: StagingQuestion = {
      ...currentQ,
      options: updatedOptions,
    };

    const newQuestions = [...currentPaper.questions];
    newQuestions[idx] = updatedQ;

    setState({
      paper: { ...currentPaper, questions: newQuestions },
    });
  },

  toggleStatus(idx: number): void {
    const currentPaper = getState().paper;
    if (!currentPaper || !currentPaper.questions || !currentPaper.questions[idx]) return;

    const currentQ = currentPaper.questions[idx];
    const nextStatus: 'active' | 'withdrawn' = currentQ.status === 'active' ? 'withdrawn' : 'active';
    const updatedQ: StagingQuestion = {
      ...currentQ,
      status: nextStatus,
    };

    const newQuestions = [...currentPaper.questions];
    newQuestions[idx] = updatedQ;

    setState({
      paper: { ...currentPaper, questions: newQuestions },
    });
  },

  async publishToSupabase(): Promise<{ success: boolean; data?: any; error?: string }> {
    const currentPaper = getState().paper;
    if (!currentPaper) {
      const err = 'No paper loaded to publish.';
      setState({
        publishStatus: 'error',
        publishMessage: err,
      });
      return { success: false, error: err };
    }

    // 1. Validation phase
    setState({
      publishStatus: 'validating',
      publishMessage: 'Validating staging paper schema and integrity...',
    });

    const validation = validateStagingPaper(currentPaper, { allowPartialBatch: true });
    if (!validation.success) {
      const errorDetails = validation.errors?.join('\n') || 'Validation failed';
      setState({
        publishStatus: 'error',
        publishMessage: `Cannot publish - validation failed:\n${errorDetails}`,
      });
      return { success: false, error: errorDetails };
    }

    // 2. Publish phase
    setState({
      publishStatus: 'publishing',
      publishMessage: 'Publishing relational paper & questions to Supabase...',
    });

    try {
      const res = await fetch('/api/ingest/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paper: currentPaper }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        throw new Error(result.error || `Publish failed with status code ${res.status}`);
      }

      setState({
        publishStatus: 'success',
        publishMessage: `Paper successfully published! Upserted ${result.questions_count ?? currentPaper.questions.length} questions.`,
      });

      return { success: true, data: result };
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown network error during publish.';
      setState({
        publishStatus: 'error',
        publishMessage: `Publish failed: ${errorMsg}`,
      });
      return { success: false, error: errorMsg };
    }
  },

  saveDraftToLocalStorage(storageKey: string = LOCAL_STORAGE_KEY): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const current = getState();
      if (!current.paper) return false;
      const payload = {
        paper: current.paper,
        selectedIdx: current.selectedIdx,
        statusFilter: current.statusFilter,
        timestamp: Date.now(),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error('Failed to save draft to localStorage:', err);
      return false;
    }
  },

  loadDraftFromLocalStorage(storageKey: string = LOCAL_STORAGE_KEY): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const candidatePaper = parsed?.paper || parsed;
      if (!candidatePaper) return false;

      const validation = validateStagingPaper(candidatePaper, { allowPartialBatch: true });
      if (!validation.success) {
        console.warn('Draft failed validation:', validation.errors);
        return false;
      }

      setState({
        paper: validation.data || candidatePaper,
        selectedIdx: typeof parsed?.selectedIdx === 'number' ? parsed.selectedIdx : 0,
        statusFilter: parsed?.statusFilter || 'all',
        publishStatus: 'idle',
        publishMessage: 'Draft restored from local storage.',
      });
      return true;
    } catch (err) {
      console.error('Failed to load draft from localStorage:', err);
      return false;
    }
  },

  clearDraft(storageKey: string = LOCAL_STORAGE_KEY): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(storageKey);
    } catch (err) {
      console.error('Failed to clear draft from localStorage:', err);
    }
  },

  hasDraft(storageKey: string = LOCAL_STORAGE_KEY): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return Boolean(window.localStorage.getItem(storageKey));
    } catch {
      return false;
    }
  },

  setPaper(paper: StagingPaper | null): void {
    setState({ paper });
  },

  setShowLivePreview(show: boolean | ((prev: boolean) => boolean)): void {
    setState((prev) => ({
      showLivePreview: typeof show === 'function' ? show(prev.showLivePreview) : show,
    }));
  },

  setIsSettingsModalOpen(open: boolean): void {
    setState({ isSettingsModalOpen: open });
  },

  setIsPayloadModalOpen(open: boolean): void {
    setState({ isPayloadModalOpen: open });
  },

  setIsAuditDrawerOpen(open: boolean): void {
    setState({ isAuditDrawerOpen: open });
  },

  setPublishStatus(publishStatus: PublishStatus): void {
    setState({ publishStatus });
  },

  setPublishMessage(publishMessage: string): void {
    setState({ publishMessage });
  },

  setSearchQuery(searchQuery: string): void {
    setState({ searchQuery });
  },

  setStatusFilter(statusFilter: StatusFilter): void {
    setState({ statusFilter });
  },

  resetStore(): void {
    setState({ ...initialRawState });
  },
};

function computeSelectedQuestion(s: IngestionState): StagingQuestion | null {
  if (!s.paper || !s.paper.questions) return null;
  return s.paper.questions[s.selectedIdx] ?? null;
}

let cachedSnapshot: IngestionStore = {
  ...state,
  ...actions,
  selectedQuestion: computeSelectedQuestion(state),
};

function rebuildSnapshot() {
  cachedSnapshot = {
    ...state,
    ...actions,
    selectedQuestion: computeSelectedQuestion(state),
  };
}

const serverSnapshot: IngestionStore = {
  ...initialRawState,
  ...actions,
  selectedQuestion: null,
};

function getSnapshot(): IngestionStore {
  return cachedSnapshot;
}

function getServerSnapshot(): IngestionStore {
  return serverSnapshot;
}

/**
 * Custom React store hook for the Ingestion Studio.
 * Backed by React state/subscribers via useSyncExternalStore and localStorage draft persistence.
 */
export function useIngestionStore(): IngestionStore;
export function useIngestionStore<T>(selector: (store: IngestionStore) => T): T;
export function useIngestionStore<T = IngestionStore>(
  selector?: (store: IngestionStore) => T
): T {
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return selector ? selector(store) : (store as unknown as T);
}

/**
 * Direct imperative store access outside of React components.
 */
export const ingestionStore = {
  getState,
  setState,
  subscribe,
  getSnapshot,
  ...actions,
};

'use client';

import { useSyncExternalStore } from 'react';
import {
  StagingPaper,
  StagingQuestion,
  StagingOption,
  PaperLifecycleState,
  validateStagingPaper,
} from '@/types/ingestion';

export type PublishStatus = 'idle' | 'validating' | 'publishing' | 'success' | 'error';
export type StatusFilter = 'all' | 'valid' | 'review' | 'diagrams';

export interface ExtractionProgress {
  stage: string;
  currentBatch: string;
  percent: number;
  batchCount: number;
}

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

  // Extraction streaming session state
  isExtracting: boolean;
  extractionProgress: ExtractionProgress;
  error: string | null;

  // PDF session state
  qpPdfFile: File | null;
  qpPdfUrl: string | null;
  msPdfFile: File | null;
  msPdfUrl: string | null;
  totalPdfPages: number;
  activePdfPage: number;

  // Dual-pane layout state
  showPdfViewer: boolean;

  // Paper lifecycle state
  lifecycleState: PaperLifecycleState;

  // Undo / Redo history indicators
  canUndo: boolean;
  canRedo: boolean;
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

  // Dual-pane & PDF session actions
  setShowPdfViewer: (show: boolean | ((prev: boolean) => boolean)) => void;
  setLifecycleState: (state: PaperLifecycleState) => void;
  setQpPdfFile: (file: File | null) => void;
  setMsPdfFile: (file: File | null) => void;
  setQpPdfUrl: (url: string | null) => void;
  setActivePdfPage: (page: number) => void;
  setTotalPdfPages: (total: number) => void;
  setError: (error: string | null) => void;

  // Live extraction SSE streaming
  startExtraction: (options?: {
    qpFile?: File;
    msFile?: File;
    batchSize?: number;
    startQuestion?: number;
    endQuestion?: number;
    model?: string;
  }) => Promise<void>;
  cancelExtraction: () => void;

  // History Undo / Redo
  undo: () => void;
  redo: () => void;
}

export interface IngestionStore extends IngestionState, IngestionActions {
  selectedQuestion: StagingQuestion | null;
}

const LOCAL_STORAGE_KEY = 'revizz_ingestion_draft';

const initialRawState: IngestionState = {
  paper: null,
  selectedIdx: 0,
  showLivePreview: false,
  isSettingsModalOpen: false,
  isPayloadModalOpen: false,
  isAuditDrawerOpen: false,
  publishStatus: 'idle',
  publishMessage: '',
  searchQuery: '',
  statusFilter: 'all',

  isExtracting: false,
  extractionProgress: {
    stage: 'idle',
    currentBatch: '',
    percent: 0,
    batchCount: 0,
  },
  error: null,

  qpPdfFile: null,
  qpPdfUrl: null,
  msPdfFile: null,
  msPdfUrl: null,
  totalPdfPages: 1,
  activePdfPage: 1,

  showPdfViewer: true,
  lifecycleState: 'draft',

  canUndo: false,
  canRedo: false,
};

// Internal mutable state holder
let state: IngestionState = { ...initialRawState };
const listeners = new Set<() => void>();

// Undo / Redo history stacks
let undoStack: StagingQuestion[][] = [];
let redoStack: StagingQuestion[][] = [];
const MAX_HISTORY_STEPS = 30;

function pushUndoHistory(questions: StagingQuestion[]) {
  try {
    undoStack.push(JSON.parse(JSON.stringify(questions)));
    if (undoStack.length > MAX_HISTORY_STEPS) {
      undoStack.shift();
    }
    redoStack = [];
  } catch (err) {
    console.error('Failed to clone questions for undo history', err);
  }
}

// Active abort controller for stream extraction
let activeAbortController: AbortController | null = null;

function inferPaperMetadata(filename: string) {
  const clean = filename.toLowerCase();
  let subjectCode = '0455';
  let subjectName = 'Economics';
  let icon = '📈';
  let series = 's';
  let year = 2024;
  let paperCode = '12';

  const subMatch = clean.match(/\b(0455|0625|0610|0620)\b/);
  if (subMatch) {
    subjectCode = subMatch[1];
    if (subjectCode === '0625') {
      subjectName = 'Physics';
      icon = '⚡';
    } else if (subjectCode === '0610') {
      subjectName = 'Biology';
      icon = '🧬';
    } else if (subjectCode === '0620') {
      subjectName = 'Chemistry';
      icon = '⚗️';
    }
  }

  const yrMatch = clean.match(/([smw])(\d{2})/);
  if (yrMatch) {
    series = yrMatch[1];
    year = 2000 + parseInt(yrMatch[2], 10);
  }

  const paperMatch = clean.match(/(?:qp|ms|paper)[_-]?(\d{1,2})/);
  if (paperMatch) {
    paperCode = paperMatch[1];
  }

  return {
    id: `${subjectCode}_${series}${String(year).slice(-2)}_${paperCode}`,
    subjectCode,
    subjectName,
    icon,
    series,
    year,
    paperCode,
  };
}

function getState(): IngestionState {
  return state;
}

function setState(updates: Partial<IngestionState> | ((prev: IngestionState) => Partial<IngestionState>)) {
  const nextPartial = typeof updates === 'function' ? updates(state) : updates;
  state = {
    ...state,
    ...nextPartial,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
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

      // Reset undo/redo history on fresh preset load
      undoStack = [];
      redoStack = [];

      setState({
        paper: paperData,
        selectedIdx: 0,
        publishStatus: 'idle',
        publishMessage: `Preset "${targetId}" loaded successfully.`,
        lifecycleState: 'review',
        activePdfPage: paperData.questions?.[0]?.page_number || 1,
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

      undoStack = [];
      redoStack = [];

      const loadedPaper = validation.data || candidatePaper;
      setState({
        paper: loadedPaper,
        selectedIdx: 0,
        publishStatus: 'idle',
        publishMessage: 'JSON paper loaded and validated successfully.',
        lifecycleState: 'review',
        activePdfPage: loadedPaper.questions?.[0]?.page_number || 1,
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
    const targetQ = currentPaper?.questions?.[safeIdx];
    const targetPage = targetQ?.page_number ?? targetQ?.diagram?.bounding_box?.page_number;

    setState({
      selectedIdx: safeIdx,
      ...(typeof targetPage === 'number' && targetPage > 0 ? { activePdfPage: targetPage } : {}),
    });
  },

  addQuestion(): void {
    const currentPaper = getState().paper;
    const currentQuestions = currentPaper?.questions ? [...currentPaper.questions] : [];
    pushUndoHistory(currentQuestions);

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

    pushUndoHistory(currentPaper.questions);

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

    pushUndoHistory(currentPaper.questions);

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

    pushUndoHistory(currentPaper.questions);

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

    pushUndoHistory(currentPaper.questions);

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

    pushUndoHistory(currentPaper.questions);

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

    pushUndoHistory(currentPaper.questions);

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
        lifecycleState: 'published',
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
        lifecycleState: current.lifecycleState,
        showPdfViewer: current.showPdfViewer,
        activePdfPage: current.activePdfPage,
        totalPdfPages: current.totalPdfPages,
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

      undoStack = [];
      redoStack = [];

      setState({
        paper: validation.data || candidatePaper,
        selectedIdx: typeof parsed?.selectedIdx === 'number' ? parsed.selectedIdx : 0,
        statusFilter: parsed?.statusFilter || 'all',
        lifecycleState: parsed?.lifecycleState || 'review',
        showPdfViewer: typeof parsed?.showPdfViewer === 'boolean' ? parsed.showPdfViewer : true,
        activePdfPage: typeof parsed?.activePdfPage === 'number' ? parsed.activePdfPage : 1,
        totalPdfPages: typeof parsed?.totalPdfPages === 'number' ? parsed.totalPdfPages : 1,
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
    undoStack = [];
    redoStack = [];
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    setState({ ...initialRawState });
  },

  setShowPdfViewer(show: boolean | ((prev: boolean) => boolean)): void {
    setState((prev) => ({
      showPdfViewer: typeof show === 'function' ? show(prev.showPdfViewer) : show,
    }));
  },

  setLifecycleState(lifecycleState: PaperLifecycleState): void {
    setState({ lifecycleState });
  },

  setQpPdfFile(file: File | null): void {
    const currentUrl = getState().qpPdfUrl;
    if (currentUrl && currentUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentUrl);
    }
    const newUrl = file ? URL.createObjectURL(file) : null;
    setState({
      qpPdfFile: file,
      qpPdfUrl: newUrl,
      showPdfViewer: file ? true : getState().showPdfViewer,
    });
  },

  setMsPdfFile(file: File | null): void {
    const currentUrl = getState().msPdfUrl;
    if (currentUrl && currentUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentUrl);
    }
    const newUrl = file ? URL.createObjectURL(file) : null;
    setState({
      msPdfFile: file,
      msPdfUrl: newUrl,
    });
  },

  setQpPdfUrl(url: string | null): void {
    setState({ qpPdfUrl: url });
  },

  setActivePdfPage(page: number): void {
    const total = getState().totalPdfPages;
    const safePage = total > 0 ? Math.max(1, Math.min(page, total)) : Math.max(1, page);
    setState({ activePdfPage: safePage });
  },

  setTotalPdfPages(total: number): void {
    setState({ totalPdfPages: Math.max(1, total) });
  },

  setError(error: string | null): void {
    setState({ error });
  },

  async startExtraction(options?: {
    qpFile?: File;
    msFile?: File;
    batchSize?: number;
    startQuestion?: number;
    endQuestion?: number;
    model?: string;
  }): Promise<void> {
    if (options?.qpFile) {
      actions.setQpPdfFile(options.qpFile);
    }
    if (options?.msFile) {
      actions.setMsPdfFile(options.msFile);
    }

    const currentQpFile = options?.qpFile || getState().qpPdfFile;
    const currentMsFile = options?.msFile || getState().msPdfFile;

    if (!currentQpFile || !currentMsFile) {
      setState({
        error: 'Both Question Paper (QP) and Mark Scheme (MS) PDF files are required for extraction.',
        isExtracting: false,
      });
      return;
    }

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();

    setState({
      isExtracting: true,
      error: null,
      lifecycleState: 'extracting',
      extractionProgress: {
        stage: 'start',
        currentBatch: 'Uploading PDFs and starting Gemini pipeline...',
        percent: 5,
        batchCount: 0,
      },
    });

    try {
      const formData = new FormData();
      formData.append('qp', currentQpFile);
      formData.append('ms', currentMsFile);
      formData.append('stream', 'true');
      if (options?.batchSize) formData.append('batch_size', String(options.batchSize));
      if (options?.startQuestion) formData.append('start_question', String(options.startQuestion));
      if (options?.endQuestion) formData.append('end_question', String(options.endQuestion));
      if (options?.model) formData.append('model', options.model);

      const res = await fetch('/api/ingest/extract', {
        method: 'POST',
        body: formData,
        signal: activeAbortController.signal,
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson.error || `Extraction server error: HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported on this browser or environment.');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const chunk of lines) {
          const trimmed = chunk.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const payload = JSON.parse(jsonStr);

            if (payload.stage === 'error') {
              throw new Error(payload.error || 'Extraction engine reported an error.');
            }

            const stage = payload.stage || 'extracting';
            const currentBatch = payload.currentBatch || payload.message || 'Extracting questions...';
            const percent = typeof payload.percent === 'number' ? payload.percent : 50;
            const batchCount = typeof payload.batchCount === 'number' ? payload.batchCount : (payload.questions?.length || 0);

            // Merge questions incrementally if delivered
            if (Array.isArray(payload.questions) && payload.questions.length > 0) {
              const currentPaper = getState().paper;
              const existingQuestions = currentPaper?.questions ? [...currentPaper.questions] : [];

              const questionMap = new Map<number, StagingQuestion>();
              for (const q of existingQuestions) {
                questionMap.set(q.question_number, q);
              }
              for (const newQ of payload.questions) {
                questionMap.set(newQ.question_number, newQ);
              }

              const mergedQuestions = Array.from(questionMap.values()).sort(
                (a, b) => a.question_number - b.question_number
              );

              const inferredMeta = inferPaperMetadata(currentQpFile.name || '');

              const updatedPaper: StagingPaper = currentPaper
                ? { ...currentPaper, questions: mergedQuestions }
                : {
                    id: inferredMeta.id,
                    lifecycle_state: 'extracting',
                    state: 'extracting',
                    source_qp_filename: currentQpFile.name,
                    source_ms_filename: currentMsFile.name,
                    subject: { code: inferredMeta.subjectCode, name: inferredMeta.subjectName, icon: inferredMeta.icon },
                    paper: { series: inferredMeta.series, paper_code: inferredMeta.paperCode, year: inferredMeta.year },
                    syllabus_topics: [{ name: 'General', order_index: 1 }],
                    questions: mergedQuestions,
                  };

              setState({
                paper: updatedPaper,
                extractionProgress: {
                  stage,
                  currentBatch,
                  percent,
                  batchCount,
                },
              });
            } else {
              setState({
                extractionProgress: {
                  stage,
                  currentBatch,
                  percent,
                  batchCount,
                },
              });
            }

            if (payload.stage === 'complete') {
              setState({
                isExtracting: false,
                lifecycleState: 'review',
                extractionProgress: {
                  stage: 'complete',
                  currentBatch: 'Extraction completed successfully!',
                  percent: 100,
                  batchCount: payload.total_questions || payload.questions?.length || 0,
                },
              });
              actions.saveDraftToLocalStorage();
            }
          } catch (parseErr: any) {
            if (parseErr.message && !parseErr.message.includes('JSON')) {
              throw parseErr;
            }
          }
        }
      }

      // Final completion fallthrough
      if (getState().isExtracting) {
        setState({
          isExtracting: false,
          lifecycleState: 'review',
          extractionProgress: {
            stage: 'complete',
            currentBatch: 'Extraction completed.',
            percent: 100,
            batchCount: getState().paper?.questions?.length || 0,
          },
        });
        actions.saveDraftToLocalStorage();
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setState({
          isExtracting: false,
          lifecycleState: getState().paper?.questions?.length ? 'review' : 'draft',
          publishMessage: 'Extraction cancelled by user.',
        });
      } else {
        setState({
          isExtracting: false,
          error: err.message || 'Extraction failed.',
          lifecycleState: getState().paper?.questions?.length ? 'review' : 'draft',
        });
      }
    }
  },

  cancelExtraction(): void {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    setState({
      isExtracting: false,
      lifecycleState: getState().paper?.questions?.length ? 'review' : 'draft',
      publishMessage: 'Extraction cancelled.',
    });
  },

  undo(): void {
    if (undoStack.length === 0) return;
    const currentPaper = getState().paper;
    if (!currentPaper || !currentPaper.questions) return;

    const previous = undoStack.pop()!;
    redoStack.push(JSON.parse(JSON.stringify(currentPaper.questions)));

    setState({
      paper: { ...currentPaper, questions: previous },
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
    });
  },

  redo(): void {
    if (redoStack.length === 0) return;
    const currentPaper = getState().paper;
    if (!currentPaper || !currentPaper.questions) return;

    const next = redoStack.pop()!;
    undoStack.push(JSON.parse(JSON.stringify(currentPaper.questions)));

    setState({
      paper: { ...currentPaper, questions: next },
      canUndo: undoStack.length > 0,
      canRedo: redoStack.length > 0,
    });
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

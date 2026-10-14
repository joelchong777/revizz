'use client';

import { useSyncExternalStore } from 'react';
import {
  StagingPaper,
  StagingQuestion,
  StagingOption,
  PaperLifecycleState,
  validateStagingPaper,
} from '../../types/ingestion';
import { extractQuestionsChunked } from './geminiExtractor';

export type PublishStatus = 'idle' | 'validating' | 'publishing' | 'success' | 'error';
export type StatusFilter = 'all' | 'valid' | 'review' | 'diagrams';
export type PipelineStep = 'preview' | 'upserting' | 'success' | 'error';

export interface PublishReceipt {
  success: boolean;
  paper_id: string;
  subjects_count: number;
  topics_count: number;
  questions_count: number;
  options_count: number;
  error?: string;
  timestamp?: string;
}

export interface PipelineFileSummary {
  name: string;
  size: number;
  questionCount?: number;
  validCount?: number;
  topicCount?: number;
  optionCount?: number;
  diagramCount?: number;
}

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

  // Ingestion Pipeline Modal state & Supabase receipts
  lastPublishReceipt: PublishReceipt | null;
  isPipelineModalOpen: boolean;
  pipelineStep: PipelineStep;
  pipelineFileSummary: PipelineFileSummary | null;

  // Undo / Redo history indicators
  canUndo: boolean;
  canRedo: boolean;
}

export interface IngestionActions {
  loadPreset: (id?: string) => Promise<void>;
  loadJson: (
    jsonContent: any,
    fileMeta?: { name?: string; size?: number }
  ) => { success: boolean; errors?: string[] };
  updatePaperMetadata: (updates: Partial<StagingPaper>) => void;
  setSelectedIdx: (idx: number) => void;
  addQuestion: () => void;
  deleteQuestion: (idx: number) => void;
  duplicateQuestion: (idx: number) => void;
  moveQuestion: (fromIdx: number, toIdx: number) => void;
  updateQuestion: (idx: number, updated: StagingQuestion) => void;
  setCorrectOption: (label: 'A' | 'B' | 'C' | 'D') => void;
  toggleStatus: (idx: number) => void;
  publishToSupabase: () => Promise<{ success: boolean; data?: PublishReceipt; receipt?: PublishReceipt; error?: string }>;
  archiveStagedPaper: (paperId: string) => Promise<{ success: boolean; error?: string }>;
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

  // Pipeline modal & receipt actions
  setIsPipelineModalOpen: (open: boolean) => void;
  setPipelineStep: (step: PipelineStep) => void;
  setPipelineFileSummary: (summary: PipelineFileSummary | null) => void;
  setLastPublishReceipt: (receipt: PublishReceipt | null) => void;

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
    apiKey?: string;
  }) => Promise<void>;
  resumeExtraction: (options?: {
    batchSize?: number;
    model?: string;
    apiKey?: string;
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

  lastPublishReceipt: null,
  isPipelineModalOpen: false,
  pipelineStep: 'preview',
  pipelineFileSummary: null,

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

export function inferPaperMetadata(filename: string) {
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

/**
 * Robust normalizer for Cambridge MCQ staging paper payloads.
 * Handles:
 * - Direct StagingPaper (Array.isArray(parsed.questions))
 * - Wrapped paper object (parsed.paper && Array.isArray(parsed.paper.questions))
 * - Plain array of questions (Array.isArray(parsed))
 * - Partial object (parsed.questions without full root metadata)
 * - Coercion of year, paper_code, topic synthesis, and icon fallback
 */
export function normalizeStagingPayload(payload: any): StagingPaper | null {
  if (!payload) return null;

  let parsed = payload;
  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload);
    } catch {
      return null;
    }
  }

  if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
    return null;
  }

  let questions: any[] = [];
  let container: Record<string, any> = {};

  if (Array.isArray(parsed)) {
    questions = parsed;
    container = {};
  } else if (parsed.paper && typeof parsed.paper === 'object' && Array.isArray(parsed.paper.questions)) {
    // Wrapped format: { paper: StagingPaper, ... }
    questions = parsed.paper.questions;
    container = { ...parsed.paper };
  } else if (parsed.data && typeof parsed.data === 'object' && Array.isArray(parsed.data.questions)) {
    // API envelope format: { success: true, data: StagingPaper }
    questions = parsed.data.questions;
    container = { ...parsed.data };
  } else if (Array.isArray(parsed.questions)) {
    // Direct StagingPaper or object with questions: [...]
    questions = parsed.questions;
    container = { ...parsed };
  } else {
    return null;
  }

  // 1. Infer metadata if Cambridge citation/ref is found
  let inferred = {
    subjectCode: '0455',
    subjectName: 'Economics',
    icon: '📈',
    series: 's',
    year: 2024,
    paperCode: '12',
  };

  const refCandidate =
    (typeof container.id === 'string' && container.id) ||
    (typeof container.source_qp_filename === 'string' && container.source_qp_filename) ||
    (questions.find((q: any) => q && typeof q.cambridge_source_ref === 'string' && q.cambridge_source_ref)?.cambridge_source_ref) ||
    '';

  if (refCandidate) {
    const parsedInfer = inferPaperMetadata(refCandidate);
    inferred = { ...inferred, ...parsedInfer };
  }

  // 2. Subject normalization
  let subjectCode = inferred.subjectCode;
  let subjectName = inferred.subjectName;
  let subjectIcon = inferred.icon;

  if (container.subject && typeof container.subject === 'object') {
    if (typeof container.subject.code === 'string' && container.subject.code.trim()) {
      subjectCode = container.subject.code.trim();
    }
    if (typeof container.subject.name === 'string' && container.subject.name.trim()) {
      subjectName = container.subject.name.trim();
    }
    if (typeof container.subject.icon === 'string' && container.subject.icon.trim()) {
      subjectIcon = container.subject.icon.trim();
    }
  }

  // 3. Paper metadata normalization
  const rawPaperMeta =
    container.paper && typeof container.paper === 'object' && !Array.isArray(container.paper.questions)
      ? container.paper
      : {};

  let finalYear = Number(rawPaperMeta.year);
  if (isNaN(finalYear) || finalYear <= 0) {
    if (container.detected_year) finalYear = Number(container.detected_year);
  }
  if (isNaN(finalYear) || finalYear <= 0) {
    finalYear = inferred.year || 2024;
  }

  const finalSeries = String(
    rawPaperMeta.series || container.detected_series || inferred.series || 's'
  ).trim().toLowerCase();

  const finalPaperCode = String(
    rawPaperMeta.paper_code !== undefined
      ? rawPaperMeta.paper_code
      : (container.detected_paper_code !== undefined ? container.detected_paper_code : inferred.paperCode)
  ).trim();

  // 4. Syllabus topics normalization
  let finalTopics: { name: string; order_index: number }[] = [];
  if (Array.isArray(container.syllabus_topics) && container.syllabus_topics.length > 0) {
    finalTopics = container.syllabus_topics
      .map((t: any, idx: number) => {
        const name = typeof t === 'string' ? t.trim() : (typeof t?.name === 'string' ? t.name.trim() : '');
        const order_index = typeof t?.order_index === 'number' ? t.order_index : (parseInt(t?.order_index, 10) || (idx + 1));
        return { name, order_index };
      })
      .filter((t: any) => Boolean(t.name));
  }

  if (finalTopics.length === 0) {
    const topicSet = new Set<string>();
    for (const q of questions) {
      if (q && typeof q.topic_name === 'string' && q.topic_name.trim()) {
        topicSet.add(q.topic_name.trim());
      } else if (q && typeof q.topic === 'string' && q.topic.trim()) {
        topicSet.add(q.topic.trim());
      }
    }
    if (topicSet.size > 0) {
      finalTopics = Array.from(topicSet).map((name, idx) => ({ name, order_index: idx + 1 }));
    } else {
      finalTopics = [{ name: 'General', order_index: 1 }];
    }
  }

  // 5. Questions normalization
  const sanitizedQuestions: StagingQuestion[] = questions.map((q: any, idx: number) => {
    const qNum =
      typeof q?.question_number === 'number'
        ? q.question_number
        : (parseInt(q?.question_number, 10) || idx + 1);

    const topicName =
      (typeof q?.topic_name === 'string' && q.topic_name.trim())
        ? q.topic_name.trim()
        : ((typeof q?.topic === 'string' && q.topic.trim()) ? q.topic.trim() : 'General');

    const stemMarkdown =
      typeof q?.stem_markdown === 'string'
        ? q.stem_markdown
        : (typeof q?.stem === 'string' ? q.stem : (typeof q?.question === 'string' ? q.question : ''));

    const explanationMarkdown =
      typeof q?.explanation_markdown === 'string'
        ? q.explanation_markdown
        : (typeof q?.explanation === 'string' ? q.explanation : '');

    let options: StagingOption[] = [];
    if (Array.isArray(q?.options)) {
      options = q.options.map((o: any, oIdx: number) => {
        const defaultLabel = (['A', 'B', 'C', 'D'][oIdx] || 'A') as 'A' | 'B' | 'C' | 'D';
        const rawLabel = typeof o?.label === 'string' ? o.label.trim().toUpperCase() : defaultLabel;
        const validLabel = (['A', 'B', 'C', 'D'].includes(rawLabel) ? rawLabel : defaultLabel) as 'A' | 'B' | 'C' | 'D';
        const content =
          typeof o?.content_markdown === 'string'
            ? o.content_markdown
            : (typeof o?.content === 'string' ? o.content : (typeof o?.text === 'string' ? o.text : ''));
        const isCorrect = Boolean(o?.is_correct ?? o?.correct);
        return {
          label: validLabel,
          content_markdown: content,
          is_correct: isCorrect,
        };
      });
    }

    return {
      question_number: qNum,
      cambridge_source_ref:
        typeof q?.cambridge_source_ref === 'string'
          ? q.cambridge_source_ref
          : (typeof q?.source_ref === 'string' ? q.source_ref : ''),
      topic_name: topicName,
      stem_markdown: stemMarkdown,
      explanation_markdown: explanationMarkdown,
      options,
      status: q?.status === 'withdrawn' ? 'withdrawn' : 'active',
      page_number:
        typeof q?.page_number === 'number'
          ? q.page_number
          : (parseInt(q?.page_number, 10) || undefined),
      diagram: q?.diagram,
      diagrams: q?.diagrams,
      distractor_analysis: q?.distractor_analysis,
      validation_status: q?.validation_status,
    };
  });

  const candidateId =
    container.id ||
    `${subjectCode}_${finalSeries}${String(finalYear).slice(-2)}_${finalPaperCode}`;

  return {
    id: candidateId,
    lifecycle_state: container.lifecycle_state || container.state || 'review',
    state: container.state || container.lifecycle_state || 'review',
    source_qp_filename: container.source_qp_filename,
    source_ms_filename: container.source_ms_filename,
    total_pages: container.total_pages,
    detected_year: finalYear,
    detected_series: finalSeries,
    detected_paper_code: finalPaperCode,
    subject: {
      code: subjectCode,
      name: subjectName,
      icon: subjectIcon,
    },
    paper: {
      series: finalSeries,
      paper_code: finalPaperCode,
      year: finalYear,
    },
    syllabus_topics: finalTopics,
    questions: sanitizedQuestions,
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
      const paperData = normalizeStagingPayload(data);
      if (!paperData) {
        throw new Error(`Failed to parse preset "${targetId}" into a valid staging paper.`);
      }

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

  loadJson(
    jsonContent: any,
    fileMeta?: { name?: string; size?: number }
  ): { success: boolean; errors?: string[] } {
    try {
      let parsed = jsonContent;
      if (typeof jsonContent === 'string') {
        parsed = JSON.parse(jsonContent);
      }

      if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
        const errorMsg = 'Invalid JSON payload: expected an object or array.';
        setState({
          publishStatus: 'error',
          publishMessage: errorMsg,
          pipelineStep: 'error',
        });
        return { success: false, errors: [errorMsg] };
      }

      const candidatePaper = normalizeStagingPayload(parsed);
      if (!candidatePaper) {
        const errorMsg = 'Failed to interpret JSON as a Cambridge staging paper: missing questions or unrecognized structure.';
        setState({
          publishStatus: 'error',
          publishMessage: errorMsg,
          pipelineStep: 'error',
        });
        return { success: false, errors: [errorMsg] };
      }

      const validation = validateStagingPaper(candidatePaper, { allowPartialBatch: true });

      if (!validation.success) {
        const errors = validation.errors || ['Schema validation failed for provided JSON.'];
        setState({
          publishStatus: 'error',
          publishMessage: `JSON schema validation failed: ${errors[0] || 'Unknown error'}`,
          pipelineStep: 'error',
        });
        return {
          success: false,
          errors,
        };
      }

      undoStack = [];
      redoStack = [];

      const loadedPaper = validation.data || candidatePaper;

      const validQuestions = (loadedPaper.questions || []).filter((q) => {
        if (q.status === 'withdrawn') return false;
        if (!q.stem_markdown || !q.stem_markdown.trim()) return false;
        if (!Array.isArray(q.options) || q.options.length !== 4) return false;
        const correct = q.options.filter((o) => o.is_correct).length;
        return correct === 1;
      });

      const totalOptions = (loadedPaper.questions || []).reduce(
        (sum, q) => sum + (q.options?.length || 0),
        0
      );

      const diagramsCount = (loadedPaper.questions || []).filter(
        (q) => Boolean(q.diagram?.has_diagram || (q as any).has_diagram)
      ).length;

      const summary: PipelineFileSummary = {
        name: fileMeta?.name || 'Uploaded JSON Paper',
        size:
          fileMeta?.size ||
          (typeof jsonContent === 'string'
            ? jsonContent.length
            : JSON.stringify(jsonContent).length),
        questionCount: loadedPaper.questions?.length || 0,
        validCount: validQuestions.length,
        optionCount: totalOptions,
        topicCount: loadedPaper.syllabus_topics?.length || 0,
        diagramCount: diagramsCount,
      };

      setState({
        paper: loadedPaper,
        selectedIdx: 0,
        publishStatus: 'idle',
        publishMessage: `JSON paper loaded successfully (${loadedPaper.questions?.length || 0} questions).`,
        lifecycleState: 'review',
        activePdfPage: loadedPaper.questions?.[0]?.page_number || 1,
        pipelineFileSummary: summary,
        isPipelineModalOpen: true,
        pipelineStep: 'preview',
      });

      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to parse JSON content.';
      setState({
        publishStatus: 'error',
        publishMessage: `Failed to parse JSON: ${errorMsg}`,
        pipelineStep: 'error',
      });
      return {
        success: false,
        errors: [errorMsg],
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

  async publishToSupabase(): Promise<{ success: boolean; data?: any; receipt?: any; error?: string }> {
    const currentPaper = getState().paper;
    if (!currentPaper) {
      const err = 'No paper loaded to publish.';
      setState({
        publishStatus: 'error',
        publishMessage: err,
        pipelineStep: 'error',
      });
      return { success: false, error: err };
    }

    // 1. Validation phase
    setState({
      publishStatus: 'validating',
      publishMessage: 'Validating staging paper schema and integrity...',
      pipelineStep: 'upserting',
    });

    const validation = validateStagingPaper(currentPaper, { allowPartialBatch: true });
    if (!validation.success) {
      const errorDetails = validation.errors?.join('\n') || 'Validation failed';
      setState({
        publishStatus: 'error',
        publishMessage: `Cannot publish - validation failed:\n${errorDetails}`,
        pipelineStep: 'error',
      });
      return { success: false, error: errorDetails };
    }

    // 2. Publish phase
    setState({
      publishStatus: 'publishing',
      publishMessage: 'Publishing relational paper & questions to Supabase...',
      pipelineStep: 'upserting',
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

      const receipt: PublishReceipt = {
        success: true,
        paper_id: result.paper_id || currentPaper.id,
        subjects_count: result.subjects_count ?? 1,
        topics_count: result.topics_count ?? (currentPaper.syllabus_topics?.length || 1),
        questions_count: result.questions_count ?? currentPaper.questions.length,
        options_count: result.options_count ?? (currentPaper.questions.length * 4),
        timestamp: new Date().toISOString(),
      };

      setState({
        publishStatus: 'success',
        publishMessage: `Paper successfully published! Upserted ${receipt.questions_count} questions.`,
        lifecycleState: 'published',
        lastPublishReceipt: receipt,
        pipelineStep: 'success',
      });

      return { success: true, data: receipt, receipt };
    } catch (err: any) {
      const errorMsg = err.message || 'Unknown network error during publish.';
      setState({
        publishStatus: 'error',
        publishMessage: `Publish failed: ${errorMsg}`,
        pipelineStep: 'error',
      });
      return { success: false, error: errorMsg };
    }
  },

  async archiveStagedPaper(paperId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/ingest/staged-paper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'archive', id: paperId }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.success) {
        return {
          success: false,
          error: result.error || `Archive failed with status ${res.status}`,
        };
      }

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Network error while archiving staged paper.',
      };
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
      const candidatePaper = normalizeStagingPayload(parsed);
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

  setIsPipelineModalOpen(open: boolean): void {
    setState({ isPipelineModalOpen: open });
  },

  setPipelineStep(step: PipelineStep): void {
    setState({ pipelineStep: step });
  },

  setPipelineFileSummary(summary: PipelineFileSummary | null): void {
    setState({ pipelineFileSummary: summary });
  },

  setLastPublishReceipt(receipt: PublishReceipt | null): void {
    setState({ lastPublishReceipt: receipt });
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
    apiKey?: string;
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

    const totalBytes = currentQpFile.size + currentMsFile.size;
    const isOverServerlessLimit = totalBytes > 4.5 * 1024 * 1024;
    const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);
    const clientApiKey = (options?.apiKey || '').trim();
    const batchSize = options?.batchSize || 5;
    const startQuestion = options?.startQuestion || 1;
    const endQuestion = options?.endQuestion || 40;
    const model = options?.model || 'gemini-3.8-flash';

    // Guard: Scanned PDFs exceeding Vercel 4.5 MB request limit require direct client extraction
    if (isOverServerlessLimit && !clientApiKey) {
      setState({
        isExtracting: false,
        error: `Combined PDF size (${totalMb} MB) exceeds Vercel's 4.5 MB serverless limit. Please provide a Gemini API Key in the setup wizard for direct client extraction (up to 20 MB supported), or compress your PDFs.`,
        lifecycleState: 'draft',
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
        currentBatch: clientApiKey
          ? 'Starting direct Gemini extraction in browser...'
          : 'Uploading PDFs and starting Gemini pipeline...',
        percent: 5,
        batchCount: 0,
      },
    });

    const mergeQuestionsIntoStore = (
      batchQuestions: StagingQuestion[],
      stage: string,
      currentBatch: string,
      percent: number,
      batchCount: number
    ) => {
      const currentPaper = getState().paper;
      const existingQuestions = currentPaper?.questions ? [...currentPaper.questions] : [];

      const questionMap = new Map<number, StagingQuestion>();
      for (const q of existingQuestions) {
        questionMap.set(q.question_number, q);
      }
      for (const newQ of batchQuestions) {
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
    };

    try {
      // 1. Direct Client-Side Extraction Fallback (when client API key is provided)
      // Bypasses Vercel 4.5 MB payload limits and 15s/60s serverless timeout completely!
      if (clientApiKey) {
        const qpArrayBuffer = await currentQpFile.arrayBuffer();
        const msArrayBuffer = await currentMsFile.arrayBuffer();

        const questions = await extractQuestionsChunked(
          qpArrayBuffer,
          msArrayBuffer,
          clientApiKey,
          {
            batchSize,
            startQuestion,
            endQuestion,
            model,
            onProgress: (progress) => {
              if (progress.stage === 'retrying') {
                setState({
                  extractionProgress: {
                    stage: 'retrying',
                    currentBatch: progress.currentBatch,
                    percent: progress.percent,
                    batchCount: progress.batchCount,
                  },
                });
                return;
              }

              if (progress.stage === 'partial_complete') {
                const existingCount = getState().paper?.questions?.length || 0;
                const pausedMessage = `Google Gemini API is currently experiencing a capacity spike (HTTP 503). Saved ${existingCount} extracted questions. You can review them now or click 'Resume Extraction' for remaining questions.`;
                setState({
                  isExtracting: false,
                  lifecycleState: 'review',
                  error: pausedMessage,
                  publishMessage: pausedMessage,
                  extractionProgress: {
                    stage: 'paused_503',
                    currentBatch: pausedMessage,
                    percent: progress.percent,
                    batchCount: existingCount,
                  },
                });
                actions.saveDraftToLocalStorage();
                return;
              }

              if (Array.isArray(progress.questions) && progress.questions.length > 0) {
                mergeQuestionsIntoStore(
                  progress.questions,
                  progress.stage || 'extracting',
                  progress.currentBatch,
                  progress.percent,
                  progress.batchCount
                );
              } else {
                setState({
                  extractionProgress: {
                    stage: progress.stage || 'extracting',
                    currentBatch: progress.currentBatch,
                    percent: progress.percent,
                    batchCount: progress.batchCount,
                  },
                });
              }
            },
          }
        );

        const currentTotal = getState().paper?.questions?.length || questions.length;
        const isPartial = currentTotal < (endQuestion - startQuestion + 1);

        if (isPartial) {
          const pausedMessage = `Google Gemini API is currently experiencing a capacity spike (HTTP 503). Saved ${currentTotal} extracted questions. You can review them now or click 'Resume Extraction' for remaining questions.`;
          setState({
            isExtracting: false,
            lifecycleState: 'review',
            error: pausedMessage,
            publishMessage: pausedMessage,
            extractionProgress: {
              stage: 'paused_503',
              currentBatch: pausedMessage,
              percent: Math.min(100, Math.round((currentTotal / 40) * 100)),
              batchCount: currentTotal,
            },
          });
        } else {
          setState({
            isExtracting: false,
            lifecycleState: 'review',
            error: null,
            extractionProgress: {
              stage: 'complete',
              currentBatch: 'Extraction completed successfully!',
              percent: 100,
              batchCount: currentTotal,
            },
          });
        }
        actions.saveDraftToLocalStorage();
        return;
      }

      // 2. Serverless SSE Stream Execution
      const formData = new FormData();
      formData.append('qp', currentQpFile);
      formData.append('ms', currentMsFile);
      formData.append('stream', 'true');
      formData.append('batch_size', String(batchSize));
      formData.append('start_question', String(startQuestion));
      formData.append('end_question', String(endQuestion));
      formData.append('model', model);

      const res = await fetch('/api/ingest/extract', {
        method: 'POST',
        body: formData,
        signal: activeAbortController.signal,
      });

      if (!res.ok) {
        if (res.status === 413) {
          throw new Error(
            `Combined PDF size (${totalMb} MB) exceeds Vercel's 4.5 MB serverless limit (HTTP 413). Provide a Gemini API Key in the setup wizard for direct client extraction.`
          );
        }
        if (res.status === 504) {
          throw new Error(
            'Extraction server timed out (HTTP 504). Please try a smaller batch size (e.g. 5 questions) or provide a Gemini API Key in the setup wizard.'
          );
        }
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
          // Skip empty lines and keepalive comments (: keepalive)
          if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) continue;
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

            if (stage === 'retrying') {
              setState({
                extractionProgress: {
                  stage: 'retrying',
                  currentBatch,
                  percent,
                  batchCount,
                },
              });
              continue;
            }

            if (stage === 'partial_complete' || payload.stage === 'partial_complete') {
              const existingCount = getState().paper?.questions?.length || 0;
              const pausedMessage = `Google Gemini API is currently experiencing a capacity spike (HTTP 503). Saved ${existingCount} extracted questions. You can review them now or click 'Resume Extraction' for remaining questions.`;
              setState({
                isExtracting: false,
                lifecycleState: 'review',
                error: pausedMessage,
                publishMessage: pausedMessage,
                extractionProgress: {
                  stage: 'paused_503',
                  currentBatch: pausedMessage,
                  percent: typeof payload.percent === 'number' ? payload.percent : Math.round((existingCount / 40) * 100),
                  batchCount: existingCount,
                },
              });
              actions.saveDraftToLocalStorage();
              return;
            }

            // Merge questions incrementally if delivered
            if (Array.isArray(payload.questions) && payload.questions.length > 0) {
              mergeQuestionsIntoStore(payload.questions, stage, currentBatch, percent, batchCount);
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
                error: null,
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
        const existingCount = getState().paper?.questions?.length || 0;
        const is503 = /503|high demand|spikes in demand|capacity/i.test(err?.message || '');

        if (is503 && existingCount > 0) {
          const pausedMessage = `Google Gemini API is currently experiencing a capacity spike (HTTP 503). Saved ${existingCount} extracted questions. You can review them now or click 'Resume Extraction' for remaining questions.`;
          setState({
            isExtracting: false,
            error: pausedMessage,
            publishMessage: pausedMessage,
            lifecycleState: 'review',
            extractionProgress: {
              stage: 'paused_503',
              currentBatch: pausedMessage,
              percent: Math.min(100, Math.round((existingCount / 40) * 100)),
              batchCount: existingCount,
            },
          });
          actions.saveDraftToLocalStorage();
          return;
        }

        let friendlyError = err.message || 'Extraction failed.';
        const isNetworkErr =
          err.name === 'TypeError' ||
          /fetch|network|connection|load failed|aborted/i.test(friendlyError);

        if (isNetworkErr) {
          if (isOverServerlessLimit) {
            friendlyError = `Network error: PDF files (${totalMb} MB) exceed Vercel's 4.5 MB serverless limit. Please provide a Gemini API Key in the setup wizard for direct client extraction (up to 20 MB supported), or compress your PDFs.`;
          } else {
            friendlyError = `Network error: The extraction connection timed out or was terminated by the server proxy. Try setting the batch size to 5, or provide a Gemini API Key in the setup wizard for direct client extraction.`;
          }
        }

        setState({
          isExtracting: false,
          error: friendlyError,
          lifecycleState: getState().paper?.questions?.length ? 'review' : 'draft',
        });
        actions.saveDraftToLocalStorage();
      }
    }
  },

  async resumeExtraction(options?: {
    batchSize?: number;
    model?: string;
    apiKey?: string;
  }): Promise<void> {
    const existingQuestions = getState().paper?.questions || [];
    const maxExtractedQ = existingQuestions.length > 0
      ? Math.max(...existingQuestions.map((q) => q.question_number || 0))
      : 0;
    const startQuestion = maxExtractedQ + 1;
    const endQuestion = 40;

    if (startQuestion > endQuestion) {
      setState({
        publishMessage: 'All questions (1-40) have already been extracted.',
      });
      return;
    }

    await actions.startExtraction({
      startQuestion,
      endQuestion,
      batchSize: options?.batchSize,
      model: options?.model,
      apiKey: options?.apiKey,
    });
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
  normalizeStagingPayload,
  inferPaperMetadata,
  ...actions,
};

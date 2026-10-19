import { TestPaperConfig, CompiledExamQuestion, OnlineQuizAssignment, TopicDistributionItem } from '../types/testCompiler';
import { Question, CAMBRIDGE_QUESTIONS } from './questions';
import { resolveDiagramUrl } from './resolveDiagramUrl';

export const DRAFT_KEY_PREFIX = 'revizz_test_draft_';
export const PRINT_SNAPSHOT_PREFIX = 'revizz_print_snapshot_';
export const DRAFT_CHANGE_EVENT = 'revizz_test_drafts_changed';
const ONLINE_ASSIGNMENT_PREFIX = 'revizz_online_assignment_';

export const SUBJECT_CATALOG: { code: string; name: string }[] = [
  { code: '0455', name: 'Economics' },
  { code: '0610', name: 'Biology' },
  { code: '0620', name: 'Chemistry' },
  { code: '0625', name: 'Physics' },
];

export interface GeneratedTestPaper {
  config: TestPaperConfig;
  questions: CompiledExamQuestion[];
  totalQuestions: number;
}

export function resolveQuestionExplanation(q: Question): string | null {
  if (q.explanation_markdown && q.explanation_markdown.trim().length > 0) {
    return q.explanation_markdown.trim();
  }
  const labels: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
  const optIndex = (q.options || []).findIndex((o) => o.id === q.correct_option_id);
  if (optIndex !== -1) {
    const correctOpt = q.options[optIndex];
    const label = labels[optIndex] || 'A';
    return `Key ${label}: ${correctOpt.text_markdown}${q.topic ? ` (${q.topic})` : ''}`;
  }
  return null;
}

export function notifyDraftsChanged(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      if (typeof Event === 'function') {
        window.dispatchEvent(new Event(DRAFT_CHANGE_EVENT));
      } else {
        const evt = (window as any).document?.createEvent?.('Event');
        if (evt) {
          evt.initEvent(DRAFT_CHANGE_EVENT, false, false);
          window.dispatchEvent(evt);
        }
      }
    } catch {
      // safe fallback in environments without full DOM Events
    }
  }
}

export function formatDefaultDraftTitle(config: Partial<TestPaperConfig>): string {
  if (config.title && config.title.trim().length > 0) {
    return config.title.trim();
  }
  const subjectCode = config.subjectCode || '0455';
  const defaultSubject = SUBJECT_CATALOG.find((s) => s.code === subjectCode);
  const subjectName = config.subjectName || defaultSubject?.name || 'Economics';
  const qCount = Array.isArray(config.questionIds)
    ? config.questionIds.length
    : (config.totalMarks ?? 0);
  return `${subjectCode} ${subjectName} Draft (${qCount} Qs)`;
}

export function saveTestDraft(config: TestPaperConfig): TestPaperConfig {
  let existingCreatedAt: string | undefined;
  if (typeof window !== 'undefined' && config.id) {
    try {
      const raw = localStorage.getItem(`${DRAFT_KEY_PREFIX}${config.id}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.createdAt === 'string') {
          existingCreatedAt = parsed.createdAt;
        }
      }
    } catch {
      // ignore
    }
  }

  const now = new Date().toISOString();
  let topicSummary = config.topicSummary;
  if (!topicSummary || topicSummary.length === 0) {
    if (config.questionIds && config.questionIds.length > 0) {
      topicSummary = computeTopicDistribution(config.questionIds)
        .slice(0, 4)
        .map((d) => `${d.topic} (${d.count})`);
    }
  }

  const normalized: TestPaperConfig = {
    ...config,
    title: formatDefaultDraftTitle(config),
    totalMarks: Array.isArray(config.questionIds) ? config.questionIds.length : (config.totalMarks || 0),
    createdAt: existingCreatedAt || config.createdAt || now,
    updatedAt: now,
    topicSummary,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${DRAFT_KEY_PREFIX}${normalized.id}`, JSON.stringify(normalized));
    } catch (e) {
      console.warn('Failed to save test draft to localStorage', e);
    }
    notifyDraftsChanged();
  }

  return normalized;
}

export function savePrintSnapshot(config: TestPaperConfig): TestPaperConfig {
  const now = new Date().toISOString();
  let topicSummary = config.topicSummary;
  if (!topicSummary || topicSummary.length === 0) {
    if (config.questionIds && config.questionIds.length > 0) {
      topicSummary = computeTopicDistribution(config.questionIds)
        .slice(0, 4)
        .map((d) => `${d.topic} (${d.count})`);
    }
  }

  const normalized: TestPaperConfig = {
    ...config,
    title: formatDefaultDraftTitle(config),
    totalMarks: Array.isArray(config.questionIds) ? config.questionIds.length : (config.totalMarks || 0),
    createdAt: config.createdAt || now,
    updatedAt: now,
    topicSummary,
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${PRINT_SNAPSHOT_PREFIX}${normalized.id}`, JSON.stringify(normalized));
    } catch (e) {
      console.warn('Failed to save print snapshot to localStorage', e);
    }
  }

  return normalized;
}

export function loadTestDraft(id: string): TestPaperConfig | null {
  if (typeof window === 'undefined' || !id) return null;
  const data =
    localStorage.getItem(`${DRAFT_KEY_PREFIX}${id}`) ||
    localStorage.getItem(`${PRINT_SNAPSHOT_PREFIX}${id}`);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as TestPaperConfig;
    if (parsed && typeof parsed === 'object') {
      parsed.title = formatDefaultDraftTitle(parsed);
      return parsed;
    }
    return null;
  } catch (e) {
    return null;
  }
}

export function listTestDrafts(): TestPaperConfig[] {
  if (typeof window === 'undefined') return [];
  const drafts: TestPaperConfig[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(DRAFT_KEY_PREFIX)) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          const parsed = JSON.parse(data) as TestPaperConfig;
          if (parsed && typeof parsed === 'object' && parsed.id) {
            parsed.title = formatDefaultDraftTitle(parsed);
            parsed.updatedAt = parsed.updatedAt || parsed.createdAt;
            drafts.push(parsed);
          }
        } catch (e) {}
      }
    }
  }
  return drafts.sort((a, b) => {
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

export function deleteTestDraft(id: string): boolean {
  if (typeof window === 'undefined' || !id) return false;
  const key = `${DRAFT_KEY_PREFIX}${id}`;
  if (localStorage.getItem(key) !== null) {
    localStorage.removeItem(key);
    notifyDraftsChanged();
    return true;
  }
  return false;
}

export function duplicateTestDraft(id: string, customTitle?: string): TestPaperConfig | null {
  const existing = loadTestDraft(id);
  if (!existing) return null;
  const newId = Math.random().toString(36).substring(2, 9);
  const now = new Date().toISOString();
  const copy: TestPaperConfig = {
    ...existing,
    id: newId,
    title: customTitle?.trim() || `${existing.title} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
  return saveTestDraft(copy);
}

export function renameTestDraft(id: string, newTitle: string, newNotes?: string): TestPaperConfig | null {
  if (typeof window === 'undefined' || !id) return null;
  const data = localStorage.getItem(`${DRAFT_KEY_PREFIX}${id}`);
  if (!data) return null;
  try {
    const existing = JSON.parse(data) as TestPaperConfig;
    const updated: TestPaperConfig = {
      ...existing,
      title: newTitle.trim() || formatDefaultDraftTitle({ ...existing, title: '' }),
      notes: newNotes !== undefined ? newNotes.trim() : existing.notes,
    };
    return saveTestDraft(updated);
  } catch {
    return null;
  }
}

export function exportTestDraftJson(config: TestPaperConfig): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      draft: config,
    },
    null,
    2
  );
}

export function importTestDraftJson(rawJson: string): TestPaperConfig {
  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err: any) {
    throw new Error(`Invalid JSON syntax: ${err?.message || 'parse error'}`);
  }

  const candidate = parsed && typeof parsed === 'object' && parsed.draft ? parsed.draft : parsed;

  if (!candidate || typeof candidate !== 'object' || !Array.isArray(candidate.questionIds)) {
    throw new Error('Invalid draft JSON: missing questionIds array');
  }

  const now = new Date().toISOString();
  const id =
    typeof candidate.id === 'string' && candidate.id.trim().length > 0
      ? candidate.id.trim()
      : Math.random().toString(36).substring(2, 9);

  const subjectCode =
    typeof candidate.subjectCode === 'string' && candidate.subjectCode.trim().length > 0
      ? candidate.subjectCode.trim()
      : '0455';

  const defaultSubject = SUBJECT_CATALOG.find((s) => s.code === subjectCode);
  const subjectName =
    typeof candidate.subjectName === 'string' && candidate.subjectName.trim().length > 0
      ? candidate.subjectName.trim()
      : defaultSubject?.name || 'Economics';

  const importedConfig: TestPaperConfig = {
    id,
    title: formatDefaultDraftTitle({
      title: candidate.title,
      subjectCode,
      subjectName,
      questionIds: candidate.questionIds,
    }),
    subjectCode,
    subjectName,
    schoolName: typeof candidate.schoolName === 'string' ? candidate.schoolName : '',
    durationMinutes:
      typeof candidate.durationMinutes === 'number' && candidate.durationMinutes > 0
        ? candidate.durationMinutes
        : 45,
    totalMarks: Array.isArray(candidate.questionIds) ? candidate.questionIds.length : (candidate.totalMarks || 0),
    testCode: typeof candidate.testCode === 'string' ? candidate.testCode : '',
    dateString: typeof candidate.dateString === 'string' ? candidate.dateString : '',
    includeCoverPage: candidate.includeCoverPage ?? true,
    includeCandidateHeader: candidate.includeCandidateHeader ?? true,
    includeBubbleSheet: candidate.includeBubbleSheet ?? false,
    includeMarkScheme: candidate.includeMarkScheme ?? false,
    includeExplanations: candidate.includeExplanations ?? false,
    instructionsText: typeof candidate.instructionsText === 'string' ? candidate.instructionsText : undefined,
    notes: typeof candidate.notes === 'string' ? candidate.notes : undefined,
    topicSummary: Array.isArray(candidate.topicSummary) ? candidate.topicSummary : undefined,
    questionIds: candidate.questionIds,
    compiledQuestions: Array.isArray(candidate.compiledQuestions) ? candidate.compiledQuestions : undefined,
    createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt ? candidate.createdAt : now,
    updatedAt: now,
  };

  return saveTestDraft(importedConfig);
}

export function buildCompiledQuestions(
  questionIds: string[],
  questionPool: Question[] = CAMBRIDGE_QUESTIONS
): CompiledExamQuestion[] {
  if (!questionIds || questionIds.length === 0) {
    return [];
  }

  const primaryPool = questionPool && questionPool.length > 0 ? questionPool : [];
  const compiled: CompiledExamQuestion[] = [];
  let questionNumber = 1;

  for (const id of questionIds) {
    const q = primaryPool.find((item) => item.id === id) || CAMBRIDGE_QUESTIONS.find((item) => item.id === id);
    if (q) {
      const labels: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
      const compiledOptions = (q.options || []).map((opt, idx) => ({
        label: labels[idx] || 'A',
        textMarkdown: opt.text_markdown,
        isCorrect: opt.id === q.correct_option_id,
      }));

      const rawImageUrl = q.image_url || q.diagram?.image_url;
      const resolvedImageUrl = rawImageUrl ? (resolveDiagramUrl(rawImageUrl) || rawImageUrl) : null;

      compiled.push({
        questionNumber: questionNumber++,
        id: q.id,
        stemMarkdown: q.stem_markdown || '',
        imageUrl: resolvedImageUrl,
        options: compiledOptions,
        citation: q.citation,
        topic: q.topic,
        explanationMarkdown: resolveQuestionExplanation(q),
      });
    }
  }

  return compiled;
}


export function autoSelectQuestions(
  options: {
    count: number;
    topicIds?: string[];
    difficulty?: string;
    questionPool?: Question[];
  },
  pool?: Question[]
): string[] {
  const sourcePool =
    (pool && pool.length > 0)
      ? pool
      : (options.questionPool && options.questionPool.length > 0)
      ? options.questionPool
      : CAMBRIDGE_QUESTIONS;

  if (!sourcePool || sourcePool.length === 0) {
    return [];
  }

  let filtered = [...sourcePool];
  
  if (options.topicIds && options.topicIds.length > 0) {
    filtered = filtered.filter((q) => options.topicIds?.includes(q.topic_id || ''));
  }

  if (filtered.length === 0) {
    return [];
  }
  
  // shuffle
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }

  return filtered.slice(0, options.count).map((q) => q.id);
}

export function generateTestPaper(
  config: TestPaperConfig,
  questionPool?: Question[]
): GeneratedTestPaper {
  if (!config.questionIds || config.questionIds.length === 0) {
    return {
      config: {
        ...config,
        totalMarks: 0,
      },
      questions: [],
      totalQuestions: 0,
    };
  }

  const compiledQuestions = config.compiledQuestions && config.compiledQuestions.length > 0
    ? config.compiledQuestions
    : buildCompiledQuestions(config.questionIds, questionPool);

  return {
    config: {
      ...config,
      totalMarks: compiledQuestions.length,
      compiledQuestions,
    },
    questions: compiledQuestions,
    totalQuestions: compiledQuestions.length,
  };
}

export function shuffleQuestionIds(questionIds: string[]): string[] {
  const shuffled = [...questionIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function computeTopicDistribution(
  questionIds: string[],
  questionPool: Question[] = CAMBRIDGE_QUESTIONS
): TopicDistributionItem[] {
  if (!questionIds || questionIds.length === 0) {
    return [];
  }

  const pool = questionPool && questionPool.length > 0 ? questionPool : CAMBRIDGE_QUESTIONS;
  const topicCounts = new Map<string, number>();

  for (const id of questionIds) {
    const q = pool.find((item) => item.id === id) || CAMBRIDGE_QUESTIONS.find((item) => item.id === id);
    const topic = (q && q.topic) ? q.topic : 'General';
    topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
  }

  const total = questionIds.length;
  const distribution: TopicDistributionItem[] = [];

  for (const [topic, count] of topicCounts.entries()) {
    distribution.push({
      topic,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    });
  }

  return distribution.sort((a, b) => b.count - a.count);
}

export function saveOnlineAssignment(assignment: OnlineQuizAssignment): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${ONLINE_ASSIGNMENT_PREFIX}${assignment.id}`, JSON.stringify(assignment));
}

export function listOnlineAssignments(): OnlineQuizAssignment[] {
  if (typeof window === 'undefined') return [];
  const assignments: OnlineQuizAssignment[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(ONLINE_ASSIGNMENT_PREFIX)) {
      const data = localStorage.getItem(key);
      if (data) {
        try {
          assignments.push(JSON.parse(data) as OnlineQuizAssignment);
        } catch (e) {}
      }
    }
  }
  return assignments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}



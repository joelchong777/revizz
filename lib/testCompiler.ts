import { TestPaperConfig, CompiledExamQuestion, OnlineQuizAssignment, TopicDistributionItem } from '../types/testCompiler';
import { Question, CAMBRIDGE_QUESTIONS } from './questions';
import { resolveDiagramUrl } from './resolveDiagramUrl';

const DRAFT_KEY_PREFIX = 'revizz_test_draft_';
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

export function saveTestDraft(config: TestPaperConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`${DRAFT_KEY_PREFIX}${config.id}`, JSON.stringify(config));
}

export function loadTestDraft(id: string): TestPaperConfig | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(`${DRAFT_KEY_PREFIX}${id}`);
  if (!data) return null;
  try {
    return JSON.parse(data) as TestPaperConfig;
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
          drafts.push(JSON.parse(data) as TestPaperConfig);
        } catch (e) {}
      }
    }
  }
  return drafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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



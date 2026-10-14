import { TestPaperConfig, CompiledExamQuestion } from '@/types/testCompiler';
import { Question } from '@/lib/questions';

const DRAFT_KEY_PREFIX = 'revizz_test_draft_';

export interface GeneratedTestPaper {
  config: TestPaperConfig;
  questions: CompiledExamQuestion[];
  totalQuestions: number;
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
  questionPool: Question[] = []
): CompiledExamQuestion[] {
  if (!questionPool || questionPool.length === 0 || !questionIds || questionIds.length === 0) {
    return [];
  }

  const compiled: CompiledExamQuestion[] = [];
  let questionNumber = 1;

  for (const id of questionIds) {
    const q = questionPool.find((item) => item.id === id);
    if (q) {
      const labels: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
      const compiledOptions = (q.options || []).map((opt, idx) => ({
        label: labels[idx] || 'A',
        textMarkdown: opt.text_markdown,
        isCorrect: opt.id === q.correct_option_id,
      }));

      compiled.push({
        questionNumber: questionNumber++,
        id: q.id,
        stemMarkdown: q.stem_markdown || '',
        imageUrl: q.image_url,
        options: compiledOptions,
        citation: q.citation,
        topic: q.topic,
        explanationMarkdown: q.explanation_markdown || null,
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
  questionPoolParam: Question[] = []
): string[] {
  const sourcePool = options.questionPool ?? questionPoolParam ?? [];
  if (!sourcePool || sourcePool.length === 0) {
    return [];
  }

  let pool = [...sourcePool];
  
  if (options.topicIds && options.topicIds.length > 0) {
    pool = pool.filter((q) => options.topicIds?.includes(q.topic_id || ''));
  }

  if (pool.length === 0) {
    return [];
  }
  
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, options.count).map((q) => q.id);
}

export function generateTestPaper(
  config: TestPaperConfig,
  questionPool: Question[] = []
): GeneratedTestPaper {
  if (!questionPool || questionPool.length === 0 || !config.questionIds || config.questionIds.length === 0) {
    return {
      config: {
        ...config,
        totalMarks: 0,
      },
      questions: [],
      totalQuestions: 0,
    };
  }

  const compiledQuestions = buildCompiledQuestions(config.questionIds, questionPool);
  return {
    config: {
      ...config,
      totalMarks: compiledQuestions.length,
    },
    questions: compiledQuestions,
    totalQuestions: compiledQuestions.length,
  };
}


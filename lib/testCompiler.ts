import { TestPaperConfig, CompiledExamQuestion } from '@/types/testCompiler';
import { CAMBRIDGE_QUESTIONS, Question } from '@/lib/questions';

const DRAFT_KEY_PREFIX = 'revizz_test_draft_';

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

export function buildCompiledQuestions(questionIds: string[]): CompiledExamQuestion[] {
  const compiled: CompiledExamQuestion[] = [];
  let questionNumber = 1;

  for (const id of questionIds) {
    const q = CAMBRIDGE_QUESTIONS.find((item) => item.id === id);
    if (q) {
      const labels: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
      const compiledOptions = q.options.map((opt, idx) => ({
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
        explanationMarkdown: null, // As `explanation_markdown` wasn't in Question type, leaving null for now.
      });
    }
  }

  return compiled;
}

export function autoSelectQuestions(options: { count: number; topicIds?: string[]; difficulty?: string }): string[] {
  let pool = [...CAMBRIDGE_QUESTIONS];
  
  if (options.topicIds && options.topicIds.length > 0) {
    pool = pool.filter((q) => options.topicIds?.includes(q.topic_id || ''));
  }
  
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, options.count).map((q) => q.id);
}

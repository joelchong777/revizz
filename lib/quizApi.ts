import { authFetch } from './authFetch';
import type { Question } from '../hooks/useQuizGame';
import type {
  AnswerReveal,
  OptionLabel,
  QuizAnswerRequest,
  QuizAnswerResponse,
  QuizGradeRequest,
  QuizGradeResponse,
  QuizRevealResponse,
  AnswerKeysResponse,
} from '../types/quiz';

const LETTERS: OptionLabel[] = ['A', 'B', 'C', 'D'];

export class QuizApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await authFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new QuizApiError(`Request to ${url} failed (${res.status})`, res.status);
  }
  return (await res.json()) as T;
}

export function submitAnswer(req: QuizAnswerRequest): Promise<QuizAnswerResponse> {
  return postJson<QuizAnswerResponse>('/api/quiz/answer', req);
}

export async function revealAnswers(questionIds: string[]): Promise<AnswerReveal[]> {
  if (questionIds.length === 0) return [];
  const data = await postJson<QuizRevealResponse>('/api/quiz/reveal', { questionIds });
  return data.reveals ?? [];
}

export function gradeHomework(answers: QuizGradeRequest['answers']): Promise<QuizGradeResponse> {
  return postJson<QuizGradeResponse>('/api/quiz/grade', { answers });
}

export async function fetchAnswerKeys(questionIds: string[]): Promise<AnswerReveal[]> {
  if (questionIds.length === 0) return [];
  const data = await postJson<AnswerKeysResponse>('/api/quiz/answer-keys', { questionIds });
  return data.keys ?? [];
}

function sortedOptions(q: Question) {
  return q.options
    .map((o, i) => ({ o, i }))
    .sort((a, b) => String(a.o.label || '').localeCompare(String(b.o.label || '')) || a.i - b.i)
    .map((x) => x.o);
}

/** Option label (A-D) for an option id: its own label, else its position among the sorted options. */
export function labelOf(q: Question, optionId: string): OptionLabel {
  const sorted = sortedOptions(q);
  const idx = sorted.findIndex((o) => o.id === optionId);
  const own = idx >= 0 ? String(sorted[idx].label || '').toUpperCase() : '';
  if ((LETTERS as string[]).includes(own)) return own as OptionLabel;
  return LETTERS[Math.max(0, Math.min(idx, 3))];
}

/** Returns a copy of the question with the revealed answer, explanation and distractor notes filled in. */
export function applyReveal(q: Question, r: AnswerReveal): Question {
  const sorted = sortedOptions(q);
  let correctId: string | undefined =
    r.correctOptionId && q.options.some((o) => o.id === r.correctOptionId) ? r.correctOptionId : undefined;
  if (!correctId) {
    correctId = sorted.find((o, i) => (String(o.label || '').toUpperCase() || LETTERS[i]) === r.correctLabel)?.id;
  }
  const options = q.options.map((o) => {
    const reasoning = r.distractorByLabel?.[labelOf(q, o.id)];
    return reasoning ? { ...o, distractor_reasoning: reasoning } : o;
  });
  return {
    ...q,
    options,
    correct_option_id: correctId ?? q.correct_option_id,
    explanation_markdown: r.explanationMarkdown ?? q.explanation_markdown,
  };
}

/** For staff screens: fetch answer keys and merge them in. Returns the input unchanged if not permitted or on error. */
export async function attachAnswerKeys(questions: Question[]): Promise<Question[]> {
  if (questions.length === 0) return questions;
  try {
    const ids = questions.map((q) => q.id);
    const keys: AnswerReveal[] = [];
    for (let i = 0; i < ids.length; i += 500) {
      keys.push(...(await fetchAnswerKeys(ids.slice(i, i + 500))));
    }
    const byId = new Map(keys.map((k) => [k.questionId, k]));
    return questions.map((q) => {
      const k = byId.get(q.id);
      return k ? applyReveal(q, k) : q;
    });
  } catch {
    return questions;
  }
}

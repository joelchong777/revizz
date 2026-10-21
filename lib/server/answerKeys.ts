// server-only: import this module only from app/api or lib/server (the `server-only` package is not installed).
import { getServiceClient } from '@/lib/apiAuth';
import type { AnswerReveal, OptionLabel } from '@/types/quiz';
import { FALLBACK_ANSWER_KEYS } from './fallbackAnswerKeys';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LABELS: OptionLabel[] = ['A', 'B', 'C', 'D'];

export const isUuid = (id: string): boolean => UUID_RE.test(id);

export function normalizeLabel(raw: unknown): OptionLabel | null {
  const s = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return (LABELS as string[]).includes(s) ? (s as OptionLabel) : null;
}

/** True when the submitted label is the key's correct label. */
export function labelForOption(key: AnswerReveal, optionLabel: string | null | undefined): boolean {
  const l = normalizeLabel(optionLabel);
  return l !== null && l === key.correctLabel;
}

/**
 * Returns answer keys for the ids it can resolve. Unknown ids, and questions with
 * 0 or more than 1 correct option, are omitted (callers answer 404 for them).
 */
export async function getAnswerKeys(ids: string[]): Promise<Map<string, AnswerReveal>> {
  const out = new Map<string, AnswerReveal>();
  const uuidIds: string[] = [];
  for (const id of Array.from(new Set(ids))) {
    if (isUuid(id)) {
      uuidIds.push(id);
    } else {
      const fb = FALLBACK_ANSWER_KEYS[id];
      if (fb) {
        out.set(id, {
          questionId: id,
          correctLabel: fb.correctLabel,
          correctOptionId: fb.correctOptionId,
          explanationMarkdown: fb.explanationMarkdown,
          distractorByLabel: { ...fb.distractorByLabel },
        });
      }
    }
  }
  if (uuidIds.length === 0) return out;

  const db = getServiceClient();
  const chunk = 100;
  for (let i = 0; i < uuidIds.length; i += chunk) {
    const part = uuidIds.slice(i, i + chunk);
    const [qRes, oRes] = await Promise.all([
      db.from('questions').select('id, explanation_markdown').in('id', part),
      db
        .from('question_options')
        .select('id, question_id, label, is_correct, distractor_reasoning')
        .in('question_id', part),
    ]);
    if (qRes.error) throw new Error(qRes.error.message);
    if (oRes.error) throw new Error(oRes.error.message);

    const explanations = new Map<string, string | null>();
    for (const q of qRes.data ?? []) explanations.set(q.id, q.explanation_markdown ?? null);

    const byQ = new Map<string, any[]>();
    for (const o of oRes.data ?? []) {
      const arr = byQ.get(o.question_id) ?? [];
      arr.push(o);
      byQ.set(o.question_id, arr);
    }
    for (const qid of part) {
      if (!explanations.has(qid)) continue;
      const opts = byQ.get(qid) ?? [];
      const correct = opts.filter((o) => o.is_correct === true);
      if (correct.length !== 1) continue;
      const correctLabel = normalizeLabel(correct[0].label);
      if (!correctLabel) continue;
      const distractorByLabel: Partial<Record<OptionLabel, string>> = {};
      for (const o of opts) {
        const l = normalizeLabel(o.label);
        if (l && o.distractor_reasoning) distractorByLabel[l] = o.distractor_reasoning;
      }
      out.set(qid, {
        questionId: qid,
        correctLabel,
        correctOptionId: correct[0].id ?? null,
        explanationMarkdown: explanations.get(qid) ?? null,
        distractorByLabel,
      });
    }
  }
  return out;
}

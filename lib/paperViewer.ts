import type { StagingQuestion } from '@/types/ingestion';

export type DiagramFilter = 'all' | 'with_diagrams' | 'without_diagrams';

export function hasDiagram(q: StagingQuestion): boolean {
  return Boolean(q.diagram?.has_diagram || q.diagram?.image_url);
}

export function filterPaperQuestions(
  qs: StagingQuestion[],
  opts: { search: string; diagram: DiagramFilter; topic: string }
): StagingQuestion[] {
  const { search, diagram, topic } = opts;
  return qs.filter((q) => {
    const hasDiag = hasDiagram(q);
    if (diagram === 'with_diagrams' && !hasDiag) return false;
    if (diagram === 'without_diagrams' && hasDiag) return false;

    if (topic !== 'all' && q.topic_name !== topic) return false;

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      const numMatch = `q${q.question_number}`.includes(query) || `${q.question_number}` === query;
      const stemMatch = (q.stem_markdown || '').toLowerCase().includes(query);
      const refMatch = (q.cambridge_source_ref || '').toLowerCase().includes(query);
      const topicMatch = (q.topic_name || '').toLowerCase().includes(query);
      const optionMatch = (q.options || []).some((opt) =>
        (opt.content_markdown || '').toLowerCase().includes(query)
      );
      const expMatch = (q.explanation_markdown || '').toLowerCase().includes(query);

      if (!numMatch && !stemMatch && !refMatch && !topicMatch && !optionMatch && !expMatch) {
        return false;
      }
    }

    return true;
  });
}

export function getAnswerKeyBreakdown(qs: StagingQuestion[]): { A: number; B: number; C: number; D: number } {
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  qs.forEach((q) => {
    const correct = q.options?.find((o) => o.is_correct);
    if (correct?.label && counts[correct.label] !== undefined) {
      counts[correct.label]++;
    }
  });
  return counts;
}

export function formatSeriesText(series?: string, year?: number): string {
  if (!series && !year) return 'Cambridge IGCSE Exam Paper';
  const s = (series || '').toLowerCase();
  let seriesLabel = series || '';
  if (s === 's' || s.includes('may') || s.includes('june')) seriesLabel = 'May/June';
  else if (s === 'm' || s.includes('feb') || s.includes('march')) seriesLabel = 'Feb/March';
  else if (s === 'w' || s.includes('oct') || s.includes('nov')) seriesLabel = 'Oct/Nov';
  return `${seriesLabel} ${year || ''}`.trim();
}

/** Next/previous question number in the given order; clamps at the ends. */
export function stepQuestion(numbers: number[], current: number | null, dir: 1 | -1): number | null {
  if (numbers.length === 0) return null;
  const idx = current === null ? -1 : numbers.indexOf(current);
  if (idx === -1) return dir === 1 ? numbers[0] : numbers[numbers.length - 1];
  const next = Math.min(numbers.length - 1, Math.max(0, idx + dir));
  return numbers[next];
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

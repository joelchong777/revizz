import { NextRequest, NextResponse } from 'next/server';
import { serverErrorResponse } from '@/lib/apiAuth';
import { getAnswerKeys, labelForOption, normalizeLabel } from '@/lib/server/answerKeys';
import type { QuizGradeResponse } from '@/types/quiz';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const answers: unknown = body?.answers;
    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ success: false, error: 'answers required' }, { status: 400 });
    }
    if (answers.length > 60) {
      return NextResponse.json({ success: false, error: 'At most 60 answers' }, { status: 400 });
    }
    const clean: { questionId: string; optionLabel: string | null }[] = [];
    for (const a of answers as any[]) {
      if (typeof a?.questionId !== 'string') {
        return NextResponse.json({ success: false, error: 'Invalid answer' }, { status: 400 });
      }
      clean.push({ questionId: a.questionId, optionLabel: normalizeLabel(a.optionLabel) });
    }
    const keys = await getAnswerKeys(clean.map((a) => a.questionId));
    const results: QuizGradeResponse['results'] = [];
    let score = 0;
    const seen = new Set<string>();
    for (const a of clean) {
      const key = keys.get(a.questionId);
      if (!key || seen.has(a.questionId)) continue;
      seen.add(a.questionId);
      const correct = labelForOption(key, a.optionLabel);
      if (correct) score++;
      results.push({ questionId: a.questionId, correct, reveal: key });
    }
    return NextResponse.json({ success: true, score, total: results.length, results } as QuizGradeResponse);
  } catch (err) {
    return serverErrorResponse(err);
  }
}

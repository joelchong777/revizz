import type { OptionLabel } from '@/types/quiz';
import type { StagingPaper, StagingQuestion } from '@/types/ingestion';

export type MarkSchemeMap = Record<number, OptionLabel>;

export type MismatchType =
  | 'missing_staged_question'
  | 'missing_ms_answer'
  | 'no_correct_option'
  | 'multiple_correct_options'
  | 'key_mismatch'
  | 'distractor_analysis_mismatch'
  | 'explanation_mismatch';

export interface QuestionMismatch {
  questionNumber: number;
  stagedKey: OptionLabel | null;
  expectedKey: OptionLabel;
  mismatchTypes: MismatchType[];
  stemSnippet: string;
  description: string;
  details?: {
    stagedCorrectCount?: number;
    distractorIssue?: string;
    explanationIssue?: string;
  };
}

export type VerificationStatus = 'perfect_match' | 'mismatches_found' | 'incomplete';

export interface MarkSchemeVerificationReport {
  paperId: string;
  totalQuestions: number;
  matchedCount: number;
  mismatchCount: number;
  missingInMsCount: number;
  missingInPaperCount: number;
  status: VerificationStatus;
  mismatches: QuestionMismatch[];
  sourceMsPath?: string;
  summary: string;
  verifiedAt: string;
}

/**
 * Checks a single staged question against expected Mark Scheme answer key.
 */
export function checkQuestionAgainstMarkScheme(
  question: StagingQuestion,
  expectedKey: OptionLabel | undefined
): { isMatch: boolean; mismatch?: QuestionMismatch } {
  const qNum = question.question_number;
  const correctOptions = question.options.filter((o) => o.is_correct);
  const stagedKey: OptionLabel | null = correctOptions.length === 1 ? correctOptions[0].label : null;

  if (!expectedKey) {
    return {
      isMatch: false,
      mismatch: {
        questionNumber: qNum,
        stagedKey,
        expectedKey: 'A', // placeholder
        mismatchTypes: ['missing_ms_answer'],
        stemSnippet: truncateStem(question.stem_markdown),
        description: `Question ${qNum} has no corresponding answer in mark scheme.`,
      },
    };
  }

  const mismatchTypes: MismatchType[] = [];
  let distractorIssue: string | undefined;
  let explanationIssue: string | undefined;

  // 1. Single-choice integrity
  if (correctOptions.length === 0) {
    mismatchTypes.push('no_correct_option');
  } else if (correctOptions.length > 1) {
    mismatchTypes.push('multiple_correct_options');
  }

  // 2. Answer key comparison
  if (stagedKey !== expectedKey) {
    mismatchTypes.push('key_mismatch');
  }

  // 3. Distractor analysis audit
  // Check distractor_analysis object if present
  if (question.distractor_analysis && typeof question.distractor_analysis === 'object') {
    const expAnalysis = question.distractor_analysis[expectedKey] || '';
    if (expAnalysis && !/\b(correct|accurate|satisfies|fulfills)\b/i.test(expAnalysis)) {
      distractorIssue = `Distractor analysis for expected key (${expectedKey}) does not identify it as correct.`;
      if (!mismatchTypes.includes('distractor_analysis_mismatch')) {
        mismatchTypes.push('distractor_analysis_mismatch');
      }
    }
  }

  // Check explanation_markdown distractor bullets and optimal choice lines
  const expl = question.explanation_markdown || '';
  if (expl) {
    // Check distractor bullet tagging: e.g. - **A (...)**: Incorrect. vs - **D (...)**: Correct.
    const expectedBulletRegex = new RegExp(`^\\s*[-*]\\s+\\*\\*${expectedKey}\\b[^:]*\\*\\*:\\s*([^\n\r]+)`, 'im');
    const expectedMatch = expl.match(expectedBulletRegex);
    if (expectedMatch) {
      const lineText = expectedMatch[1];
      if (/^\s*(?:incorrect|distractor|misconception|wrong)/i.test(lineText)) {
        distractorIssue = `Distractor bullet for expected key (${expectedKey}) is labeled as Incorrect.`;
        if (!mismatchTypes.includes('distractor_analysis_mismatch')) {
          mismatchTypes.push('distractor_analysis_mismatch');
        }
      }
    }

    // Check if an incorrect letter is tagged [Correct] or : Correct.
    const wrongKeys = (['A', 'B', 'C', 'D'] as OptionLabel[]).filter((k) => k !== expectedKey);
    for (const wk of wrongKeys) {
      const wrongBulletRegex = new RegExp(`^\\s*[-*]\\s+\\*\\*${wk}\\b[^:]*\\*\\*:\\s*([^\n\r]+)`, 'im');
      const wrongMatch = expl.match(wrongBulletRegex);
      if (wrongMatch) {
        const lineText = wrongMatch[1];
        if (/^\s*(?:correct|accurately identifies)/i.test(lineText) || /\[correct\]/i.test(wrongMatch[0])) {
          distractorIssue = `Distractor bullet for incorrect option (${wk}) is mistakenly tagged as Correct.`;
          if (!mismatchTypes.includes('distractor_analysis_mismatch')) {
            mismatchTypes.push('distractor_analysis_mismatch');
          }
          break;
        }
      }
    }

    // Check optimal choice step: e.g. "Select Optimal Choice: Option **D**"
    const optimalChoiceMatch = expl.match(/Select Optimal Choice\s*[*:]*\s*(?:Option\s*)?\*\*?([A-D])\*\*?/i);
    if (optimalChoiceMatch) {
      const statedLetter = optimalChoiceMatch[1].toUpperCase();
      if (statedLetter !== expectedKey) {
        explanationIssue = `Explanation states Option **${statedLetter}** is optimal, but Mark Scheme is **${expectedKey}**.`;
        if (!mismatchTypes.includes('explanation_mismatch')) {
          mismatchTypes.push('explanation_mismatch');
        }
      }
    }
  }

  if (mismatchTypes.length === 0) {
    return { isMatch: true };
  }

  const descParts: string[] = [];
  if (mismatchTypes.includes('key_mismatch')) {
    descParts.push(`Key mismatch: staged [${stagedKey || 'None'}] vs mark scheme [${expectedKey}].`);
  }
  if (mismatchTypes.includes('no_correct_option')) {
    descParts.push('No correct option marked in staged question.');
  }
  if (mismatchTypes.includes('multiple_correct_options')) {
    descParts.push(`Multiple options marked correct (${correctOptions.map((o) => o.label).join(', ')}).`);
  }
  if (distractorIssue) descParts.push(distractorIssue);
  if (explanationIssue) descParts.push(explanationIssue);

  return {
    isMatch: false,
    mismatch: {
      questionNumber: qNum,
      stagedKey,
      expectedKey,
      mismatchTypes,
      stemSnippet: truncateStem(question.stem_markdown),
      description: descParts.join(' '),
      details: {
        stagedCorrectCount: correctOptions.length,
        distractorIssue,
        explanationIssue,
      },
    },
  };
}

/**
 * Verifies an entire StagingPaper against a MarkSchemeMap.
 *
 * @param paper Staging paper document
 * @param msMap Question-to-key mapping from Mark Scheme
 * @param sourceMsPath Optional path to source Mark Scheme PDF for reporting
 * @returns Comprehensive MarkSchemeVerificationReport
 */
export function verifyPaperAgainstMarkScheme(
  paper: StagingPaper,
  msMap: MarkSchemeMap,
  sourceMsPath?: string
): MarkSchemeVerificationReport {
  const mismatches: QuestionMismatch[] = [];
  let matchedCount = 0;
  let missingInMsCount = 0;

  const paperQuestions = paper.questions || [];
  const stagedQNums = new Set(paperQuestions.map((q) => q.question_number));

  for (const q of paperQuestions) {
    const expected = msMap[q.question_number];
    if (!expected) {
      missingInMsCount++;
    }

    const { isMatch, mismatch } = checkQuestionAgainstMarkScheme(q, expected);
    if (isMatch) {
      matchedCount++;
    } else if (mismatch) {
      mismatches.push(mismatch);
    }
  }

  // Count questions in MS that are missing in the paper
  let missingInPaperCount = 0;
  for (const qNumStr of Object.keys(msMap)) {
    const qNum = parseInt(qNumStr, 10);
    if (!stagedQNums.has(qNum)) {
      missingInPaperCount++;
      mismatches.push({
        questionNumber: qNum,
        stagedKey: null,
        expectedKey: msMap[qNum],
        mismatchTypes: ['missing_staged_question'],
        stemSnippet: '',
        description: `Mark scheme defines answer for Question ${qNum}, but question is absent from staged paper.`,
      });
    }
  }

  let status: VerificationStatus;
  if (mismatches.length === 0 && paperQuestions.length > 0 && missingInMsCount === 0) {
    status = 'perfect_match';
  } else if (mismatches.length > 0) {
    status = 'mismatches_found';
  } else {
    status = 'incomplete';
  }

  const paperId =
    paper.id ||
    `${paper.subject?.code || '0455'}_${paper.paper?.series || 's'}${String(paper.paper?.year || 2024).slice(-2)}_${paper.paper?.paper_code || '11'}`;

  const summary =
    status === 'perfect_match'
      ? `100% Match: All ${matchedCount} questions perfectly verified against Cambridge Mark Scheme.`
      : `${mismatches.length} mismatch(es) detected across ${paperQuestions.length} questions (${matchedCount} matched).`;

  return {
    paperId,
    totalQuestions: paperQuestions.length,
    matchedCount,
    mismatchCount: mismatches.length,
    missingInMsCount,
    missingInPaperCount,
    status,
    mismatches,
    sourceMsPath,
    summary,
    verifiedAt: new Date().toISOString(),
  };
}

function truncateStem(stem: string, maxLen = 120): string {
  if (!stem) return '';
  const clean = stem.replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen)}...` : clean;
}

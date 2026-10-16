import type { OptionLabel } from '@/types/quiz';
import type { StagingPaper, StagingQuestion, StagingOption } from '@/types/ingestion';
import type { MarkSchemeMap } from './markSchemeChecker';

export interface RemediationChange {
  questionNumber: number;
  previousKey: OptionLabel | null;
  newKey: OptionLabel;
  changes: string[];
}

export interface RemediationResult {
  success: boolean;
  fixedPaper: StagingPaper;
  fixedCount: number;
  remediatedQuestions: RemediationChange[];
}

/**
 * Auto-remediates a StagingPaper against a verified Cambridge MarkSchemeMap:
 * 1. Flips is_correct = true for the expected option, false for all other options.
 * 2. Re-tags distractor_analysis object keys with pedagogically sound labels.
 * 3. Rewrites explanation_markdown distractor bullets and optimal choice conclusion lines.
 * 4. Strictly preserves KaTeX math formulas ($...$, $$...$$) and currency amounts (\$12,000).
 */
export function remediatePaperWithMarkScheme(
  paper: StagingPaper,
  msMap: MarkSchemeMap
): RemediationResult {
  // Deep clone paper to maintain strict immutability
  const clonedPaper: StagingPaper = JSON.parse(JSON.stringify(paper));
  const remediatedQuestions: RemediationChange[] = [];

  const questions = clonedPaper.questions || [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const expectedKey = msMap[q.question_number];

    if (!expectedKey) {
      continue;
    }

    const previousCorrect = q.options.filter((o) => o.is_correct);
    const previousKey: OptionLabel | null =
      previousCorrect.length === 1 ? previousCorrect[0].label : null;

    const changes: string[] = [];

    // 1. Check and fix options is_correct flag
    const needsKeyFix =
      previousKey !== expectedKey ||
      previousCorrect.length !== 1 ||
      q.options.some((o) => (o.label === expectedKey && !o.is_correct) || (o.label !== expectedKey && o.is_correct));

    if (needsKeyFix) {
      q.options = q.options.map((opt) => {
        const shouldBeCorrect = opt.label === expectedKey;
        return {
          ...opt,
          is_correct: shouldBeCorrect,
        };
      });
      changes.push(`Updated correct option from [${previousKey || 'None'}] to [${expectedKey}].`);
    }

    // 2. Fix distractor_analysis object if present
    if (q.distractor_analysis && typeof q.distractor_analysis === 'object') {
      let modifiedDistractorObj = false;

      // Update expectedKey entry
      const curExpectedAnalysis = q.distractor_analysis[expectedKey] || '';
      if (!/\b(correct|accurately identifies|satisfies|fulfills)\b/i.test(curExpectedAnalysis)) {
        if (/does not address the required outcome/i.test(curExpectedAnalysis)) {
          q.distractor_analysis[expectedKey] = 'Correct. Accurately satisfies the analytical condition required by the question.';
        } else {
          q.distractor_analysis[expectedKey] = `Correct. ${curExpectedAnalysis.replace(/^incorrect\.?\s*/i, '')}`;
        }
        modifiedDistractorObj = true;
      }

      // Update other entries
      for (const optLabel of ['A', 'B', 'C', 'D'] as OptionLabel[]) {
        if (optLabel !== expectedKey && q.distractor_analysis[optLabel]) {
          const entry = q.distractor_analysis[optLabel];
          if (/^correct\.?\s*/i.test(entry) || /\[correct\]/i.test(entry)) {
            let sanitized = entry.replace(/\s*\[correct\]/gi, '').replace(/^correct\.?\s*/i, '');
            if (/accurately (?:identifies|satisfies)/i.test(sanitized)) {
              sanitized = 'Does not satisfy the condition required by the question.';
            }
            q.distractor_analysis[optLabel] = `Incorrect. ${sanitized}`;
            modifiedDistractorObj = true;
          }
        }
      }

      if (modifiedDistractorObj) {
        changes.push('Re-aligned distractor_analysis record.');
      }
    }

    // 3. Fix explanation_markdown (distractor bullets + optimal choice line)
    if (q.explanation_markdown && typeof q.explanation_markdown === 'string') {
      const originalExpl = q.explanation_markdown;
      const targetOptContent = q.options.find((o) => o.label === expectedKey)?.content_markdown || '';

      const updatedExpl = remediateExplanationMarkdown(
        originalExpl,
        previousKey,
        expectedKey,
        targetOptContent
      );

      if (updatedExpl !== originalExpl) {
        q.explanation_markdown = updatedExpl;
        changes.push('Re-aligned distractor analysis & optimal choice in explanation.');
      }
    }

    if (changes.length > 0) {
      remediatedQuestions.push({
        questionNumber: q.question_number,
        previousKey,
        newKey: expectedKey,
        changes,
      });
    }
  }

  return {
    success: true,
    fixedPaper: clonedPaper,
    fixedCount: remediatedQuestions.length,
    remediatedQuestions,
  };
}

/**
 * Remediates explanation markdown without disturbing KaTeX equations or currency symbols.
 */
function remediateExplanationMarkdown(
  explanation: string,
  oldKey: OptionLabel | null,
  newKey: OptionLabel,
  newOptContent: string
): string {
  const lines = explanation.split(/\r?\n/);
  const cleanNewOptText = newOptContent.replace(/\s+/g, ' ').trim();

  const newLines = lines.map((line) => {
    // 1. Optimal Choice / Conclusion Step
    if (/Select Optimal Choice/i.test(line)) {
      return line.replace(
        /(Select Optimal Choice\s*[*:]*\s*Option\s*)\*\*?[A-D]\*\*?(?:\s*\([^)]*\))?/i,
        `$1**${newKey}**${cleanNewOptText ? ` (${cleanNewOptText})` : ''}`
      );
    }

    // 2. Direct conclusion statement: "Therefore, option **D** is correct" or "Option **D** directly fulfills"
    if (/Therefore, (?:option\s+)?\*\*?[A-D]\*\*?/i.test(line)) {
      return line.replace(
        /Therefore, (?:option\s+)?\*\*?[A-D]\*\*?/i,
        `Therefore, option **${newKey}**`
      );
    }
    if (/Option \*\*?[A-D]\*\*? (?:is (?:the )?correct|directly fulfills)/i.test(line)) {
      return line.replace(
        /Option \*\*?[A-D]\*\*? ((?:is (?:the )?correct|directly fulfills))/i,
        `Option **${newKey}** $1`
      );
    }

    // 3. Distractor bullets: e.g. "- **A (...)**: Incorrect..." or "- **D (...) [Correct]**: ..."
    const bulletMatch = line.match(/^(\s*[-*]\s+\*\*([A-D])\b[^:]*\*?\*?:\s*)(.*)$/);
    if (bulletMatch) {
      const [_, prefix, letter, rest] = bulletMatch;
      const optLetter = letter.toUpperCase() as OptionLabel;

      if (optLetter === newKey) {
        // Must be marked Correct
        let updatedRest = rest;
        if (/^incorrect\.?\s*/i.test(updatedRest)) {
          if (/does not address the required outcome/i.test(updatedRest)) {
            updatedRest = 'Correct. Accurately satisfies the analytical condition required by the question.';
          } else {
            updatedRest = updatedRest.replace(/^incorrect\.?\s*/i, 'Correct. ');
          }
        } else if (!/correct/i.test(updatedRest)) {
          updatedRest = `Correct. ${updatedRest}`;
        }

        let updatedPrefix = prefix;
        // If explanation uses [Correct] tagging style in bullet header
        if (!/\[correct\]/i.test(updatedPrefix) && /\[correct\]/i.test(explanation)) {
          updatedPrefix = updatedPrefix.replace(/(\*\*:\s*)$/, ' [Correct]$1');
        }

        return `${updatedPrefix}${updatedRest}`;
      } else {
        // Any other letter must NOT be marked Correct
        let updatedRest = rest;
        if (/^correct\.?\s*/i.test(updatedRest)) {
          if (/accurately (?:identifies|satisfies)/i.test(updatedRest)) {
            updatedRest = 'Incorrect. Does not satisfy the condition required by the question.';
          } else {
            updatedRest = updatedRest.replace(/^correct\.?\s*/i, 'Incorrect. ');
          }
        }
        const updatedPrefix = prefix.replace(/\s*\[correct\]/gi, '');
        return `${updatedPrefix}${updatedRest}`;
      }
    }

    return line;
  });

  return newLines.join('\n');
}

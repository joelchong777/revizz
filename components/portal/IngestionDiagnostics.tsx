"use client";

import React, { useState, useMemo } from 'react';
import type { StagingQuestion } from '@/types/ingestion';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';
import { cn } from '@/lib/utils';
import { renderToString } from 'katex';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wrench,
  Check,
  Copy,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  ListOrdered,
  CheckCheck,
  FileText,
  Tag,
  Image as ImageIcon,
  BookOpen,
  Sigma,
} from 'lucide-react';

export type DiagnosticStatus = 'pass' | 'fail' | 'warning' | 'info';

export interface DiagnosticCheckItem {
  id: string;
  checkNumber: number;
  title: string;
  status: DiagnosticStatus;
  summary: string;
  details?: string[];
  severity: 'error' | 'warning' | 'info';
  icon: React.ComponentType<{ className?: string }>;
}

export interface KaTeXIssue {
  field: string;
  type: 'unescaped_currency' | 'unclosed_delimiter' | 'unbalanced_braces' | 'katex_syntax_error';
  severity: 'error' | 'warning';
  message: string;
  snippet?: string;
  line?: number;
}

export interface IngestionDiagnosticsProps {
  question: StagingQuestion;
  onUpdateQuestion?: (updated: StagingQuestion) => void;
  onFixKaTeX?: (fixedQuestion: StagingQuestion) => void;
  className?: string;
}

/**
 * Lints KaTeX & LaTeX formulas within a single string content field.
 * Detects:
 * 1. Unclosed delimiters: $$, single $, \(, \[
 * 2. Unescaped currency signs: $50, $100 (which corrupt remark-math parsing)
 * 3. Unbalanced braces: { and }
 * 4. KaTeX syntax/parse errors: via renderToString(..., { throwOnError: true })
 */
export function lintKaTeXContent(text: string, fieldName: string): KaTeXIssue[] {
  const issues: KaTeXIssue[] = [];
  if (!text) return issues;

  // 1. Unclosed display math delimiters $$
  const displayMatches = text.match(/(?<!\\)\$\$/g) || [];
  if (displayMatches.length % 2 !== 0) {
    issues.push({
      field: fieldName,
      type: 'unclosed_delimiter',
      severity: 'error',
      message: `Unclosed display math delimiter "$$" (found ${displayMatches.length} unescaped "$$" delimiters).`,
    });
  }

  // Count \( and \)
  const openParen = (text.match(/\\\(/g) || []).length;
  const closeParen = (text.match(/\\\)/g) || []).length;
  if (openParen !== closeParen) {
    issues.push({
      field: fieldName,
      type: 'unclosed_delimiter',
      severity: 'error',
      message: `Mismatched \\( ... \\) delimiters (${openParen} opened, ${closeParen} closed).`,
    });
  }

  // Count \[ and \]
  const openBracket = (text.match(/\\\[/g) || []).length;
  const closeBracket = (text.match(/\\\]/g) || []).length;
  if (openBracket !== closeBracket) {
    issues.push({
      field: fieldName,
      type: 'unclosed_delimiter',
      severity: 'error',
      message: `Mismatched \\[ ... \\] delimiters (${openBracket} opened, ${closeBracket} closed).`,
    });
  }

  // 2. Scan for unescaped currency signs $50 vs real inline math $x = 5$
  const lines = text.split('\n');
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '$' && (i === 0 || line[i - 1] !== '\\')) {
        // Skip $$
        if (line[i + 1] === '$') {
          i += 2;
          continue;
        }

        // Find matching closing $
        let nextDollar = -1;
        for (let j = i + 1; j < line.length; j++) {
          if (line[j] === '$' && line[j - 1] !== '\\') {
            nextDollar = j;
            break;
          }
        }

        if (nextDollar === -1) {
          // Unclosed single dollar sign
          const snippet = line.slice(i, Math.min(line.length, i + 20)).trim();
          if (/\$\s*\d/.test(snippet)) {
            issues.push({
              field: fieldName,
              type: 'unescaped_currency',
              severity: 'warning',
              message: `Unescaped currency dollar symbol: "${snippet}". Use "\\$" to prevent parser errors.`,
              snippet,
              line: l + 1,
            });
          } else {
            issues.push({
              field: fieldName,
              type: 'unclosed_delimiter',
              severity: 'error',
              message: `Dangling single dollar "$" delimiter on line ${l + 1}: "${snippet}".`,
              snippet,
              line: l + 1,
            });
          }
          i++;
          continue;
        }

        // Content between $ and $
        const mathContent = line.slice(i + 1, nextDollar);
        const charAfter = line[nextDollar + 1];
        const isFollowedByDigit = charAfter !== undefined && /\d/.test(charAfter);
        const startsWithDigit = /^\s*\d/.test(mathContent);
        const hasEnglishProse = /\b(to|and|or|each|per|in|is|was|for|between|with|than|at|of)\b/i.test(
          mathContent
        );
        const hasMathOperators = /[\\^_{}=+\-<>*\/]|\\times|\\text|\\mathrm|\\pm|%/.test(mathContent);

        // Check if this looks like currency range (e.g. "$50 to $100")
        if (isFollowedByDigit || hasEnglishProse || (startsWithDigit && !hasMathOperators)) {
          const snippet = line.slice(i, Math.min(line.length, nextDollar + 8)).trim();
          issues.push({
            field: fieldName,
            type: 'unescaped_currency',
            severity: 'warning',
            message: `Unescaped currency expression: "${snippet}". Escape currency symbols with "\\$".`,
            snippet,
            line: l + 1,
          });
          i++;
          continue;
        }

        // 3. Test genuine candidate formula using KaTeX renderToString
        const trimmedMath = mathContent.trim();
        if (trimmedMath) {
          // Check braces {}
          const openB = (trimmedMath.match(/(?<!\\)\{/g) || []).length;
          const closeB = (trimmedMath.match(/(?<!\\)\}/g) || []).length;
          if (openB !== closeB) {
            issues.push({
              field: fieldName,
              type: 'unbalanced_braces',
              severity: 'error',
              message: `Unbalanced braces in math "$${trimmedMath.slice(0, 30)}$" (${openB} opened, ${closeB} closed).`,
              snippet: `$${trimmedMath.slice(0, 30)}$`,
              line: l + 1,
            });
          }

          try {
            renderToString(trimmedMath, { displayMode: false, throwOnError: true });
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err);
            issues.push({
              field: fieldName,
              type: 'katex_syntax_error',
              severity: 'error',
              message: `KaTeX parsing failed in "$${trimmedMath.slice(0, 30)}$": ${errMsg}`,
              snippet: `$${trimmedMath.slice(0, 30)}$`,
              line: l + 1,
            });
          }
        }

        i = nextDollar + 1;
      } else {
        i++;
      }
    }
  }

  return issues;
}

export function IngestionDiagnostics({
  question,
  onUpdateQuestion,
  onFixKaTeX,
  className,
}: IngestionDiagnosticsProps) {
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'issues'>('all');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // 1. Check 1: Exactly 4 Options (A, B, C, D)
  const checkOptions = useMemo<DiagnosticCheckItem>(() => {
    const options = question.options || [];
    const hasExactCount = options.length === 4;
    const labels = options.map((o) => o.label).sort();
    const hasValidLabels = labels.length === 4 && labels.join('') === 'ABCD';
    const missingLabels = ['A', 'B', 'C', 'D'].filter(
      (l) => !options.some((o) => o.label === l)
    );

    if (hasExactCount && hasValidLabels) {
      return {
        id: 'options_check',
        checkNumber: 1,
        title: '4 Options Check (A, B, C, D)',
        status: 'pass',
        summary: 'Exactly 4 options configured with labels A, B, C, D.',
        severity: 'error',
        icon: ListOrdered,
        details: options.map(
          (o) => `Option ${o.label}: ${(o.content_markdown || '').trim().length} characters`
        ),
      };
    }

    const errors: string[] = [];
    if (!hasExactCount) {
      errors.push(`Found ${options.length} options (Cambridge standard requires exactly 4).`);
    }
    if (missingLabels.length > 0) {
      errors.push(`Missing option labels: ${missingLabels.join(', ')}.`);
    }

    return {
      id: 'options_check',
      checkNumber: 1,
      title: '4 Options Check (A, B, C, D)',
      status: 'fail',
      summary: hasExactCount
        ? 'Option labels are incorrect or duplicated.'
        : `Contains ${options.length} options (Expected exactly 4: A, B, C, D).`,
      severity: 'error',
      icon: ListOrdered,
      details: errors,
    };
  }, [question.options]);

  // 2. Check 2: Single Correct Answer
  const checkCorrectAnswer = useMemo<DiagnosticCheckItem>(() => {
    const options = question.options || [];
    const correctOptions = options.filter((o) => o.is_correct);

    if (correctOptions.length === 1) {
      const label = correctOptions[0].label;
      return {
        id: 'correct_answer_check',
        checkNumber: 2,
        title: 'Single Correct Answer',
        status: 'pass',
        summary: `Exactly one correct option marked: Option ${label}.`,
        severity: 'error',
        icon: CheckCheck,
        details: [
          `Key is Option ${label}: "${correctOptions[0].content_markdown?.slice(0, 60) || ''}..."`,
        ],
      };
    }

    if (correctOptions.length === 0) {
      return {
        id: 'correct_answer_check',
        checkNumber: 2,
        title: 'Single Correct Answer',
        status: 'fail',
        summary: 'No option marked correct (0 marked is_correct: true).',
        severity: 'error',
        icon: CheckCheck,
        details: ['Every Cambridge MCQ must designate exactly one correct answer key.'],
      };
    }

    return {
      id: 'correct_answer_check',
      checkNumber: 2,
      title: 'Single Correct Answer',
      status: 'fail',
      summary: `Multiple options marked correct (${correctOptions.map((o) => o.label).join(', ')}).`,
      severity: 'error',
      icon: CheckCheck,
      details: [
        `Found ${correctOptions.length} correct options: ${correctOptions.map((o) => o.label).join(', ')}. Must designate only 1 correct key.`,
      ],
    };
  }, [question.options]);

  // 3. Check 3: Stem Non-empty (>= 5 characters)
  const checkStemNonEmpty = useMemo<DiagnosticCheckItem>(() => {
    const stem = (question.stem_markdown || '').trim();
    const stemLen = stem.length;

    if (stemLen >= 5) {
      return {
        id: 'stem_non_empty',
        checkNumber: 3,
        title: 'Stem Non-Empty (>= 5 chars)',
        status: 'pass',
        summary: `Stem markdown present (${stemLen} characters).`,
        severity: 'error',
        icon: FileText,
        details: [
          `Word count: ~${stem.split(/\s+/).filter(Boolean).length} words.`,
          `Preview: "${stem.slice(0, 90)}${stemLen > 90 ? '...' : ''}"`,
        ],
      };
    }

    return {
      id: 'stem_non_empty',
      checkNumber: 3,
      title: 'Stem Non-Empty (>= 5 chars)',
      status: 'fail',
      summary: stemLen === 0 ? 'Question stem markdown is blank.' : `Stem text too short (${stemLen}/5 chars).`,
      severity: 'error',
      icon: FileText,
      details: ['Question stem must contain at least 5 characters.'],
    };
  }, [question.stem_markdown]);

  // 4. Check 4: Topic Assigned
  const checkTopicAssigned = useMemo<DiagnosticCheckItem>(() => {
    const topic = (question.topic_name || '').trim();
    const isAssigned =
      topic.length > 0 &&
      topic.toLowerCase() !== 'unassigned' &&
      topic.toLowerCase() !== 'none';

    if (isAssigned) {
      return {
        id: 'topic_assigned',
        checkNumber: 4,
        title: 'Topic Assigned',
        status: 'pass',
        summary: `Assigned to topic: "${topic}".`,
        severity: 'error',
        icon: Tag,
        details: [`Syllabus category: "${topic}".`],
      };
    }

    return {
      id: 'topic_assigned',
      checkNumber: 4,
      title: 'Topic Assigned',
      status: 'fail',
      summary: 'No syllabus topic assigned.',
      severity: 'error',
      icon: Tag,
      details: ['Assign a syllabus topic before publishing this question.'],
    };
  }, [question.topic_name]);

  // 5. Check 5: Diagram Health (Pass / Warning)
  const checkDiagramHealth = useMemo<DiagnosticCheckItem>(() => {
    const hasDiagram = Boolean(question.diagram?.has_diagram);
    const imageUrl = (question.diagram?.image_url || '').trim();

    if (!hasDiagram) {
      if (imageUrl.length > 0) {
        return {
          id: 'diagram_health',
          checkNumber: 5,
          title: 'Diagram Health',
          status: 'warning',
          summary: 'Diagram flag is false, but an image URL is populated.',
          severity: 'warning',
          icon: ImageIcon,
          details: [
            `Image URL is present (${imageUrl}), but diagram.has_diagram is false.`,
            'Enable "Has Diagram" if visual diagram is required, or remove the image URL.',
          ],
        };
      }

      return {
        id: 'diagram_health',
        checkNumber: 5,
        title: 'Diagram Health',
        status: 'pass',
        summary: 'No diagram required (pure text MCQ).',
        severity: 'warning',
        icon: ImageIcon,
        details: ['Question marked as not requiring diagram apparatus.'],
      };
    }

    // hasDiagram is true
    const isValidUrl =
      imageUrl.length > 0 &&
      (imageUrl.startsWith('/') ||
        imageUrl.startsWith('http://') ||
        imageUrl.startsWith('https://') ||
        imageUrl.startsWith('data:image/') ||
        /\.(png|jpe?g|svg|webp|gif)$/i.test(imageUrl));

    if (isValidUrl) {
      return {
        id: 'diagram_health',
        checkNumber: 5,
        title: 'Diagram Health',
        status: 'pass',
        summary: `Diagram linked: ${imageUrl}.`,
        severity: 'warning',
        icon: ImageIcon,
        details: [
          `Image URL: ${imageUrl}`,
          ...(question.diagram?.alt_description
            ? [`Alt description: "${question.diagram.alt_description}"`]
            : []),
        ],
      };
    }

    return {
      id: 'diagram_health',
      checkNumber: 5,
      title: 'Diagram Health',
      status: 'warning',
      summary: 'Diagram flagged as required, but image URL is missing or invalid.',
      severity: 'warning',
      icon: ImageIcon,
      details: [
        'Question has `diagram.has_diagram: true`, but `image_url` is blank or invalid.',
        'Upload or crop the diagram before publishing.',
      ],
    };
  }, [question.diagram]);

  // 6. Check 6: Explanation Presence (Pass / Info)
  const checkExplanationPresence = useMemo<DiagnosticCheckItem>(() => {
    const explanation = (question.explanation_markdown || '').trim();
    const length = explanation.length;

    if (length >= 10) {
      return {
        id: 'explanation_presence',
        checkNumber: 6,
        title: 'Explanation Presence',
        status: 'pass',
        summary: `Step-by-step explanation provided (${length} chars).`,
        severity: 'info',
        icon: BookOpen,
        details: [
          `Word count: ~${explanation.split(/\s+/).filter(Boolean).length} words.`,
          `Preview: "${explanation.slice(0, 100)}${length > 100 ? '...' : ''}"`,
        ],
      };
    }

    if (length > 0) {
      return {
        id: 'explanation_presence',
        checkNumber: 6,
        title: 'Explanation Presence',
        status: 'info',
        summary: `Short explanation provided (${length} chars).`,
        severity: 'info',
        icon: BookOpen,
        details: ['Explanation is brief. Detailed rationale helps student learning.'],
      };
    }

    return {
      id: 'explanation_presence',
      checkNumber: 6,
      title: 'Explanation Presence',
      status: 'info',
      summary: 'No step-by-step explanation provided.',
      severity: 'info',
      icon: BookOpen,
      details: [
        'Step-by-step explanations help students understand why distractors are incorrect.',
      ],
    };
  }, [question.explanation_markdown]);

  // 7. Check 7: KaTeX Formula Syntax Linter
  const { checkKaTeX, allKaTeXIssues } = useMemo<{
    checkKaTeX: DiagnosticCheckItem;
    allKaTeXIssues: KaTeXIssue[];
  }>(() => {
    const issues: KaTeXIssue[] = [];

    // Lint stem
    issues.push(...lintKaTeXContent(question.stem_markdown || '', 'Stem'));

    // Lint options
    (question.options || []).forEach((opt) => {
      issues.push(
        ...lintKaTeXContent(opt.content_markdown || '', `Option ${opt.label}`)
      );
    });

    // Lint explanation
    issues.push(
      ...lintKaTeXContent(question.explanation_markdown || '', 'Explanation')
    );

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    if (issues.length === 0) {
      return {
        allKaTeXIssues: [],
        checkKaTeX: {
          id: 'katex_linter',
          checkNumber: 7,
          title: 'KaTeX Formula Syntax Linter',
          status: 'pass',
          summary: 'All math formulas and delimiters valid across stem, options, and explanation.',
          severity: 'error',
          icon: Sigma,
          details: [
            'Checked stem, options A-D, and explanation for currency $, unclosed delimiters, and balanced braces {}.',
          ],
        },
      };
    }

    if (errorCount > 0) {
      return {
        allKaTeXIssues: issues,
        checkKaTeX: {
          id: 'katex_linter',
          checkNumber: 7,
          title: 'KaTeX Formula Syntax Linter',
          status: 'fail',
          summary: `${errorCount} KaTeX syntax error${errorCount > 1 ? 's' : ''}${warningCount > 0 ? `, ${warningCount} currency warning${warningCount > 1 ? 's' : ''}` : ''} detected.`,
          severity: 'error',
          icon: Sigma,
          details: issues.map(
            (iss) => `[${iss.field}] ${iss.message}${iss.snippet ? ` (${iss.snippet})` : ''}`
          ),
        },
      };
    }

    // Only warnings (e.g. unescaped currency)
    return {
      allKaTeXIssues: issues,
      checkKaTeX: {
        id: 'katex_linter',
        checkNumber: 7,
        title: 'KaTeX Formula Syntax Linter',
        status: 'warning',
        summary: `${warningCount} KaTeX currency warning${warningCount > 1 ? 's' : ''} detected (unescaped $).`,
        severity: 'warning',
        icon: Sigma,
        details: issues.map(
          (iss) => `[${iss.field}] ${iss.message}${iss.snippet ? ` (${iss.snippet})` : ''}`
        ),
      },
    };
  }, [question.stem_markdown, question.options, question.explanation_markdown]);

  // Aggregate all 7 checks
  const allChecks = useMemo<DiagnosticCheckItem[]>(() => {
    return [
      checkOptions,
      checkCorrectAnswer,
      checkStemNonEmpty,
      checkTopicAssigned,
      checkDiagramHealth,
      checkExplanationPresence,
      checkKaTeX,
    ];
  }, [
    checkOptions,
    checkCorrectAnswer,
    checkStemNonEmpty,
    checkTopicAssigned,
    checkDiagramHealth,
    checkExplanationPresence,
    checkKaTeX,
  ]);

  // Overall Health Status calculation
  const failCount = allChecks.filter((c) => c.status === 'fail').length;
  const warningCount = allChecks.filter((c) => c.status === 'warning').length;
  const passCount = allChecks.filter((c) => c.status === 'pass').length;
  const infoCount = allChecks.filter((c) => c.status === 'info').length;

  const isReadyToPublish = failCount === 0;
  const overallStatusPill: 'READY TO PUBLISH' | 'REQUIRES FIXES' = isReadyToPublish
    ? 'READY TO PUBLISH'
    : 'REQUIRES FIXES';

  // Visible checks based on filter
  const displayedChecks = useMemo(() => {
    if (filterMode === 'issues') {
      return allChecks.filter((c) => c.status !== 'pass');
    }
    return allChecks;
  }, [allChecks, filterMode]);

  // One-click KaTeX Auto-Sanitize action
  const handleAutoSanitizeKaTeX = () => {
    const updated: StagingQuestion = {
      ...question,
      stem_markdown: sanitizeKaTeX(question.stem_markdown || ''),
      options: (question.options || []).map((o) => ({
        ...o,
        content_markdown: sanitizeKaTeX(o.content_markdown || ''),
      })),
      explanation_markdown: sanitizeKaTeX(question.explanation_markdown || ''),
    };

    if (onFixKaTeX) {
      onFixKaTeX(updated);
    } else if (onUpdateQuestion) {
      onUpdateQuestion(updated);
    }
  };

  // Copy full diagnostics report
  const handleCopyReport = () => {
    const reportText = [
      `=== QA DIAGNOSTICS REPORT ===`,
      `Question: Q${question.question_number} (${question.cambridge_source_ref || 'Unreferenced'})`,
      `Overall Status: ${overallStatusPill}`,
      `Score: ${passCount}/7 Passed | ${failCount} Errors | ${warningCount} Warnings | ${infoCount} Info`,
      ``,
      ...allChecks.map(
        (c) =>
          `[${c.status.toUpperCase()}] Check ${c.checkNumber}: ${c.title}\n  Summary: ${c.summary}${c.details?.length ? `\n  Details:\n    - ${c.details.join('\n    - ')}` : ''}`
      ),
    ].join('\n');

    navigator.clipboard.writeText(reportText).then(() => {
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2000);
    });
  };

  const toggleCheck = (id: string) => {
    setExpandedCheck((prev) => (prev === id ? null : id));
  };

  return (
    <div
      className={cn(
        'w-full bg-[#fffdf7] rounded-2xl border-2 border-b-4 border-slate-800 shadow-chunky p-5 sm:p-6 transition-all select-none',
        className
      )}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl border-2 border-b-4 border-slate-800 bg-brand-yellow flex items-center justify-center shadow-chunky">
            <Sparkles className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                QA Diagnostics
              </h3>
              <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-lg border-2 border-slate-800 bg-brand-yellow text-slate-900 shadow-xs">
                Q{question.question_number}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-600 mt-0.5">
              Real-time validation &amp; KaTeX syntax linter
            </p>
          </div>
        </div>

        {/* Overall Question Health Status Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isReadyToPublish ? (
            <div
              data-testid="status-ready-to-publish"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border-2 border-b-4 border-slate-800 bg-brand-green text-white font-heading font-black text-xs sm:text-sm tracking-wide shadow-chunky animate-in fade-in duration-150"
            >
              <ShieldCheck className="w-4 h-4 text-white stroke-[2.5]" />
              <span>READY TO PUBLISH</span>
            </div>
          ) : (
            <div
              data-testid="status-requires-fixes"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl border-2 border-b-4 border-slate-800 bg-brand-coral text-white font-heading font-black text-xs sm:text-sm tracking-wide shadow-chunky animate-in fade-in duration-150"
            >
              <ShieldAlert className="w-4 h-4 text-white stroke-[2.5]" />
              <span>REQUIRES FIXES</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        {/* KPI Counter Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-black">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl border-2 border-slate-800 bg-emerald-50 text-emerald-800 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{passCount}/7 Passed</span>
          </div>

          {failCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl border-2 border-slate-800 bg-rose-50 text-rose-800 shadow-xs">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>{failCount} Fail{failCount > 1 ? 's' : ''}</span>
            </div>
          )}

          {warningCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl border-2 border-slate-800 bg-amber-50 text-amber-900 shadow-xs">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{warningCount} Warning{warningCount > 1 ? 's' : ''}</span>
            </div>
          )}

          {infoCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl border-2 border-slate-800 bg-sky-50 text-sky-800 shadow-xs">
              <Info className="w-3.5 h-3.5 text-sky-600" />
              <span>{infoCount} Info</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <div className="inline-flex rounded-xl border-2 border-b-3 border-slate-800 bg-white p-0.5 shadow-xs">
            <button
              onClick={() => setFilterMode('all')}
              className={cn(
                'px-2.5 py-1 text-xs font-black rounded-lg transition-all cursor-pointer',
                filterMode === 'all'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              All (7)
            </button>
            <button
              onClick={() => setFilterMode('issues')}
              className={cn(
                'px-2.5 py-1 text-xs font-black rounded-lg transition-all cursor-pointer',
                filterMode === 'issues'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Issues ({failCount + warningCount})
            </button>
          </div>

          {/* KaTeX Auto-Sanitize button (if issues exist and handler provided) */}
          {allKaTeXIssues.length > 0 && (onFixKaTeX || onUpdateQuestion) && (
            <button
              onClick={handleAutoSanitizeKaTeX}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl border-2 border-b-4 border-slate-800 bg-brand-yellow hover:bg-[#fde047] text-slate-900 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none cursor-pointer transition-all"
              title="Automatically escapes unescaped currency and normalizes math delimiters"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Auto-Fix KaTeX</span>
            </button>
          )}

          {/* Copy Report */}
          <button
            onClick={handleCopyReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl border-2 border-b-4 border-slate-800 bg-white hover:bg-neutral-100 text-slate-800 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none cursor-pointer transition-all"
            title="Copy diagnostic summary to clipboard"
          >
            {copiedReport ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                <span className="text-emerald-700">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Checklist of Neobrutalist Badge Chips */}
      <div className="space-y-3 pt-2">
        {displayedChecks.map((check) => {
          const isExpanded = expandedCheck === check.id;
          const Icon = check.icon;

          return (
            <div
              key={check.id}
              className={cn(
                'rounded-2xl border-2 border-b-4 border-slate-800 bg-white shadow-chunky transition-all overflow-hidden',
                check.status === 'fail' && 'bg-rose-50/40 border-slate-800',
                check.status === 'warning' && 'bg-amber-50/40 border-slate-800',
                check.status === 'pass' && 'hover:bg-slate-50/70'
              )}
            >
              {/* Card Header & Summary */}
              <div
                onClick={() => toggleCheck(check.id)}
                className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-xl border-2 border-slate-800 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 shadow-xs',
                      check.status === 'pass' && 'bg-emerald-100 text-emerald-800',
                      check.status === 'fail' && 'bg-rose-100 text-rose-800',
                      check.status === 'warning' && 'bg-amber-100 text-amber-900',
                      check.status === 'info' && 'bg-sky-100 text-sky-800'
                    )}
                  >
                    <Icon className="w-4 h-4 stroke-[2.2]" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-black text-sm text-slate-900">
                        {check.checkNumber}. {check.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-bold mt-0.5">
                      {check.summary}
                    </p>
                  </div>
                </div>

                {/* Right Badge Chip + Accordion Toggle */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 pl-11 sm:pl-0">
                  {/* Neobrutalist Badge Chip */}
                  {check.status === 'pass' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl border-2 border-slate-800 bg-emerald-100 text-emerald-900 text-xs font-black tracking-wide shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                      PASS
                    </span>
                  )}

                  {check.status === 'fail' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl border-2 border-slate-800 bg-rose-100 text-rose-900 text-xs font-black tracking-wide shadow-xs">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                      FAIL
                    </span>
                  )}

                  {check.status === 'warning' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl border-2 border-slate-800 bg-amber-100 text-amber-950 text-xs font-black tracking-wide shadow-xs">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 stroke-[2.5]" />
                      WARNING
                    </span>
                  )}

                  {check.status === 'info' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl border-2 border-slate-800 bg-sky-100 text-sky-950 text-xs font-black tracking-wide shadow-xs">
                      <Info className="w-3.5 h-3.5 text-sky-700 stroke-[2.5]" />
                      INFO
                    </span>
                  )}

                  {/* Toggle Arrow */}
                  <div className="w-7 h-7 rounded-xl border-2 border-slate-800 flex items-center justify-center text-slate-800 bg-slate-50 shadow-xs active:translate-y-0.5">
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 stroke-[2.5]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expandable Details Pane */}
              {isExpanded && (
                <div className="p-3.5 sm:p-4 bg-slate-50/90 border-t-2 border-slate-800 text-xs text-slate-700 space-y-2 animate-in fade-in duration-100">
                  {check.id === 'katex_linter' && allKaTeXIssues.length > 0 ? (
                    <div className="space-y-2">
                      <div className="font-heading font-black text-slate-800 uppercase tracking-wider text-[11px]">
                        Detected KaTeX / LaTeX Issues:
                      </div>
                      <div className="space-y-1.5">
                        {allKaTeXIssues.map((issue, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'p-2.5 rounded-xl border-2 border-slate-800 shadow-xs flex flex-col gap-1',
                              issue.severity === 'error'
                                ? 'bg-rose-50 text-rose-900'
                                : 'bg-amber-50 text-amber-900'
                            )}
                          >
                            <div className="flex items-center justify-between font-black">
                              <span className="px-1.5 py-0.5 rounded-md bg-white border border-slate-800 text-[10px]">
                                {issue.field}
                              </span>
                              <span className="text-[10px] uppercase tracking-wider">
                                {issue.type.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="font-mono text-[11px] break-all">
                              {issue.message}
                            </div>
                            {issue.snippet && (
                              <div className="font-mono text-[10px] bg-white/90 p-1.5 rounded-md border border-slate-800 text-slate-800 overflow-x-auto">
                                Snippet: <code>{issue.snippet}</code>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Quick Auto-Sanitize button inside accordion */}
                      {(onFixKaTeX || onUpdateQuestion) && (
                        <div className="pt-2 flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAutoSanitizeKaTeX();
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-heading font-black rounded-xl border-2 border-b-4 border-slate-800 bg-brand-yellow hover:bg-[#fde047] text-slate-900 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none cursor-pointer transition-all"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Auto-Sanitize KaTeX Syntax</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : check.details && check.details.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
                      {check.details.map((detail, idx) => (
                        <li key={idx} className="text-slate-700">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-slate-500 italic">No additional details recorded.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info Notice */}
      <div className="mt-5 pt-4 border-t-2 border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
        <div className="flex items-center gap-1.5 font-bold">
          <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
          <span>
            {isReadyToPublish
              ? 'All critical checks passed. Question is verified for Cambridge publishing.'
              : 'Resolve all FAIL badges to unlock publishing status.'}
          </span>
        </div>
        <div className="font-mono text-[11px] font-bold text-slate-500">
          Source: {question.cambridge_source_ref || 'Local Staging'}
        </div>
      </div>
    </div>
  );
}

export default IngestionDiagnostics;

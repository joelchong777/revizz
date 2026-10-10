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
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  FileQuestion,
  HelpCircle,
  Layers,
  CheckCheck,
  ListOrdered,
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

  // 2. Line-by-line inspection for unescaped currency and lone dollar signs
  const lines = text.split('\n');
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '$' && (i === 0 || line[i - 1] !== '\\')) {
        // Skip display math $$
        if (line[i + 1] === '$') {
          const closingDisplay = line.indexOf('$$', i + 2);
          if (closingDisplay !== -1) {
            i = closingDisplay + 2;
            continue;
          } else {
            i += 2;
            continue;
          }
        }

        let nextDollar = -1;
        for (let j = i + 1; j < line.length; j++) {
          if (line[j] === '$' && line[j - 1] !== '\\') {
            nextDollar = j;
            break;
          }
        }

        if (nextDollar === -1) {
          // Lone $ on line
          const snippet = line.slice(i, Math.min(line.length, i + 15));
          if (/\$\s*\d/.test(snippet)) {
            issues.push({
              field: fieldName,
              type: 'unescaped_currency',
              severity: 'warning',
              line: l + 1,
              snippet: snippet.trim(),
              message: `Unescaped currency sign in "${snippet.trim()}". Escape as "\\$".`,
            });
          } else {
            issues.push({
              field: fieldName,
              type: 'unclosed_delimiter',
              severity: 'error',
              line: l + 1,
              snippet: snippet.trim(),
              message: `Unclosed inline math delimiter "$" in "${snippet.trim()}".`,
            });
          }
          i++;
          continue;
        }

        const candidate = line.slice(i + 1, nextDollar);
        const charAfter = line[nextDollar + 1];
        const isFollowedByDigit = charAfter !== undefined && /\d/.test(charAfter);
        const startsWithDigit = /^\s*\d/.test(candidate);
        const hasEnglishProse =
          /\b(to|and|or|each|per|in|is|was|are|were|for|from|between|with|than|at|of)\b/i.test(
            candidate
          );
        const hasMathSyntax =
          /[\\^_{}=+\-<>*\/]|\\times|\\text|\\mathrm|\\pm|\\le|\\ge|\\ne|\\approx|\\alpha|\\beta|\\cdot|%/.test(
            candidate
          );

        if (isFollowedByDigit || hasEnglishProse || (startsWithDigit && !hasMathSyntax)) {
          const snippet = line.slice(i, Math.min(line.length, nextDollar + 8));
          issues.push({
            field: fieldName,
            type: 'unescaped_currency',
            severity: 'warning',
            line: l + 1,
            snippet: snippet.trim(),
            message: `Unescaped currency in "${snippet.trim()}". Escape as "\\$".`,
          });
          i++;
          continue;
        }

        i = nextDollar + 1;
      } else {
        i++;
      }
    }
  }

  // 3. Inspect math blocks for unbalanced braces {} and KaTeX parsing
  const checkMath = (mathStr: string, raw: string, isDisplay: boolean) => {
    // Check brace balance
    let openBraces = 0;
    let balanced = true;
    for (let c = 0; c < mathStr.length; c++) {
      if (mathStr[c] === '{' && (c === 0 || mathStr[c - 1] !== '\\')) {
        openBraces++;
      } else if (mathStr[c] === '}' && (c === 0 || mathStr[c - 1] !== '\\')) {
        openBraces--;
        if (openBraces < 0) {
          balanced = false;
          issues.push({
            field: fieldName,
            type: 'unbalanced_braces',
            severity: 'error',
            snippet: raw,
            message: `Unexpected closing brace "}" in expression "${raw}".`,
          });
          break;
        }
      }
    }
    if (balanced && openBraces > 0) {
      issues.push({
        field: fieldName,
        type: 'unbalanced_braces',
        severity: 'error',
        snippet: raw,
        message: `Missing closing brace "}" in expression "${raw}" (${openBraces} unclosed).`,
      });
    }

    // KaTeX render test
    try {
      renderToString(mathStr, { throwOnError: true, displayMode: isDisplay });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (!issues.some((iss) => iss.snippet === raw && iss.type === 'unbalanced_braces')) {
        issues.push({
          field: fieldName,
          type: 'katex_syntax_error',
          severity: 'error',
          snippet: raw,
          message: `KaTeX Parse Error: ${errMsg}`,
        });
      }
    }
  };

  // Extract $$...$$
  const textWithoutDisplay = text.replace(/(?<!\\)\$\$([\s\S]*?)\$\$/g, (m, math) => {
    checkMath(math, m, true);
    return '';
  });

  // Extract $...$
  textWithoutDisplay.replace(/(?<!\$|\$)\$([^$\n]+?)\$(?!\$)/g, (m, math) => {
    checkMath(math, m, false);
    return '';
  });

  // Extract \(...\)
  text.replace(/\\\(([\s\S]*?)\\\)/g, (m, math) => {
    checkMath(math, m, false);
    return '';
  });

  // Extract \[...\]
  text.replace(/\\\[([\s\S]*?)\\\]/g, (m, math) => {
    checkMath(math, m, true);
    return '';
  });

  return issues;
}

export function IngestionDiagnostics({
  question,
  onUpdateQuestion,
  onFixKaTeX,
  className,
}: IngestionDiagnosticsProps) {
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState(false);
  const [filterMode, setFilterMode] = useState<'all' | 'issues'>('all');

  // 1. Check 1: 4 Options Check
  const checkOptions = useMemo<DiagnosticCheckItem>(() => {
    const options = question.options || [];
    const labels = options.map((o) => o.label);
    const expectedLabels = ['A', 'B', 'C', 'D'];
    const missingLabels = expectedLabels.filter((l) => !labels.includes(l as any));
    const hasExactCount = options.length === 4;
    const hasExactLabels =
      hasExactCount && labels.slice().sort().join('') === expectedLabels.join('');

    if (hasExactCount && hasExactLabels) {
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
        'w-full bg-[#fffdf7] rounded-3xl border-3 border-slate-800 shadow-[0_8px_0_0_#1e293b] p-5 sm:p-6 transition-all select-none',
        className
      )}
    >
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b-2 border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl border-2 border-slate-800 bg-brand-yellow flex items-center justify-center shadow-[0_3px_0_0_#1e293b]">
            <Sparkles className="w-5 h-5 text-slate-900" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                QA Diagnostics
              </h3>
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border border-slate-300 bg-slate-100 text-slate-600">
                Q{question.question_number}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-500">
              Real-time validation &amp; KaTeX syntax linter
            </p>
          </div>
        </div>

        {/* Overall Question Health Status Pill */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {isReadyToPublish ? (
            <div
              data-testid="status-ready-to-publish"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-b-4 border-emerald-700 bg-emerald-400 text-emerald-950 font-black text-xs sm:text-sm tracking-wide shadow-[0_3px_0_0_#047857] animate-in fade-in duration-150"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-950 stroke-[2.5]" />
              <span>READY TO PUBLISH</span>
            </div>
          ) : (
            <div
              data-testid="status-requires-fixes"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-b-4 border-rose-700 bg-rose-400 text-rose-950 font-black text-xs sm:text-sm tracking-wide shadow-[0_3px_0_0_#be123c] animate-in fade-in duration-150"
            >
              <ShieldAlert className="w-4 h-4 text-rose-950 stroke-[2.5]" />
              <span>REQUIRES FIXES</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI Stats & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        {/* KPI Counter Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-emerald-500 bg-emerald-50 text-emerald-800 shadow-[0_2px_0_0_#059669]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{passCount}/7 Passed</span>
          </div>

          {failCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-rose-500 bg-rose-50 text-rose-800 shadow-[0_2px_0_0_#e11d48]">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              <span>{failCount} Fail{failCount > 1 ? 's' : ''}</span>
            </div>
          )}

          {warningCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-amber-500 bg-amber-50 text-amber-900 shadow-[0_2px_0_0_#d97706]">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>{warningCount} Warning{warningCount > 1 ? 's' : ''}</span>
            </div>
          )}

          {infoCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-sky-400 bg-sky-50 text-sky-800 shadow-[0_2px_0_0_#0284c7]">
              <Info className="w-3.5 h-3.5 text-sky-600" />
              <span>{infoCount} Info</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <div className="inline-flex rounded-xl border-2 border-slate-800 bg-white p-0.5 shadow-[0_2px_0_0_#1e293b]">
            <button
              onClick={() => setFilterMode('all')}
              className={cn(
                'px-2.5 py-1 text-xs font-bold rounded-lg transition-all',
                filterMode === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              All (7)
            </button>
            <button
              onClick={() => setFilterMode('issues')}
              className={cn(
                'px-2.5 py-1 text-xs font-bold rounded-lg transition-all',
                filterMode === 'issues'
                  ? 'bg-slate-800 text-white'
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
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl border-2 border-b-3 border-amber-600 bg-brand-yellow hover:bg-amber-300 text-amber-950 shadow-[0_2px_0_0_#b45309] active:translate-y-0.5 active:shadow-none cursor-pointer transition-all"
              title="Automatically escapes unescaped currency and normalizes math delimiters"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Auto-Fix KaTeX</span>
            </button>
          )}

          {/* Copy Report */}
          <button
            onClick={handleCopyReport}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-xl border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-xs active:translate-y-0.5 cursor-pointer transition-all"
            title="Copy diagnostic summary to clipboard"
          >
            {copiedReport ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
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
                'rounded-2xl border-2 border-slate-800 bg-white shadow-[0_3px_0_0_#1e293b] transition-all overflow-hidden',
                check.status === 'fail' && 'bg-rose-50/40 border-rose-800 shadow-[0_3px_0_0_#9f1239]',
                check.status === 'warning' && 'bg-amber-50/40 border-amber-800 shadow-[0_3px_0_0_#92400e]',
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
                      'w-8 h-8 rounded-xl border-2 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0',
                      check.status === 'pass' && 'border-emerald-600 bg-emerald-100 text-emerald-800',
                      check.status === 'fail' && 'border-rose-600 bg-rose-100 text-rose-800',
                      check.status === 'warning' && 'border-amber-600 bg-amber-100 text-amber-900',
                      check.status === 'info' && 'border-sky-500 bg-sky-100 text-sky-800'
                    )}
                  >
                    <Icon className="w-4 h-4 stroke-[2.2]" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-slate-900">
                        {check.checkNumber}. {check.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">
                      {check.summary}
                    </p>
                  </div>
                </div>

                {/* Right Badge Chip + Accordion Toggle */}
                <div className="flex items-center justify-between sm:justify-end gap-2.5 pl-11 sm:pl-0">
                  {/* Neobrutalist Badge Chip */}
                  {check.status === 'pass' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border-2 border-emerald-600 bg-emerald-100 text-emerald-900 text-xs font-black tracking-wide shadow-[0_2px_0_0_#059669]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                      PASS
                    </span>
                  )}

                  {check.status === 'fail' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border-2 border-rose-600 bg-rose-100 text-rose-900 text-xs font-black tracking-wide shadow-[0_2px_0_0_#e11d48]">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                      FAIL
                    </span>
                  )}

                  {check.status === 'warning' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border-2 border-amber-600 bg-amber-100 text-amber-950 text-xs font-black tracking-wide shadow-[0_2px_0_0_#d97706]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700 stroke-[2.5]" />
                      WARNING
                    </span>
                  )}

                  {check.status === 'info' && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full border-2 border-sky-500 bg-sky-100 text-sky-950 text-xs font-black tracking-wide shadow-[0_2px_0_0_#0284c7]">
                      <Info className="w-3.5 h-3.5 text-sky-700 stroke-[2.5]" />
                      INFO
                    </span>
                  )}

                  {/* Toggle Arrow */}
                  <div className="w-6 h-6 rounded-lg border border-slate-300 flex items-center justify-center text-slate-500 hover:text-slate-800 bg-slate-50">
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expandable Details Pane */}
              {isExpanded && (
                <div className="p-3.5 sm:p-4 bg-slate-50/80 border-t-2 border-slate-200 text-xs text-slate-700 space-y-2 animate-in fade-in duration-100">
                  {check.id === 'katex_linter' && allKaTeXIssues.length > 0 ? (
                    <div className="space-y-2">
                      <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                        Detected KaTeX / LaTeX Issues:
                      </div>
                      <div className="space-y-1.5">
                        {allKaTeXIssues.map((issue, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'p-2.5 rounded-xl border-2 flex flex-col gap-1',
                              issue.severity === 'error'
                                ? 'border-rose-400 bg-rose-50 text-rose-900'
                                : 'border-amber-400 bg-amber-50 text-amber-900'
                            )}
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span className="px-1.5 py-0.5 rounded bg-white/80 border border-current text-[10px]">
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
                              <div className="font-mono text-[10px] bg-white/70 p-1.5 rounded border border-current/20 text-slate-800 overflow-x-auto">
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl border-2 border-b-3 border-amber-600 bg-brand-yellow hover:bg-amber-300 text-amber-950 shadow-[0_2px_0_0_#b45309] active:translate-y-0.5 cursor-pointer transition-all"
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
                        <li key={idx} className="text-slate-600">
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
      <div className="mt-5 pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {isReadyToPublish
              ? 'All critical checks passed. Question is verified for Cambridge publishing.'
              : 'Resolve all FAIL badges to unlock publishing status.'}
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          Source: {question.cambridge_source_ref || 'Local Staging'}
        </div>
      </div>
    </div>
  );
}

export default IngestionDiagnostics;

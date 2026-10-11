"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { StagingPaper, StagingQuestion } from "@/types/ingestion";
import {
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  Copy,
  Check,
  Search,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Layers,
  Sparkles,
  ListOrdered,
  CheckCheck,
  Sigma,
  Tag,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import katex from "katex";

export interface IngestionAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  paper: StagingPaper | null;
  onSelectQuestion: (questionIndex: number, field?: string) => void;
  expectedCount?: number;
}

export type AuditStatus = "valid" | "error" | "warning";

export interface AuditIssue {
  type: "error" | "warning";
  field: "options" | "stem" | "topic" | "diagram" | "explanation" | "katex";
  subfield?: "A" | "B" | "C" | "D" | "stem" | "topic" | "diagram" | "explanation";
  message: string;
}

export interface QuestionAuditResult {
  index: number;
  questionNumber: number;
  status: AuditStatus;
  issues: AuditIssue[];
  hasDiagram: boolean;
  hasExplanation: boolean;
  topicName: string;
  stemSnippet: string;
}

export interface QualityGateCheckItem {
  id: string;
  title: string;
  status: "pass" | "fail" | "warn";
  metric: string;
  description: string;
  failingQuestionIndices: number[];
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Checks a string for KaTeX syntax errors, unmatched delimiters, unbalanced braces,
 * and unescaped currency signs.
 */
function lintKaTeXInText(
  text: string,
  fieldName: string,
  subfield?: AuditIssue["subfield"]
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (!text) return issues;

  // 1. Check unescaped display math $$
  const displayMatches = text.match(/(?<!\\)\$\$/g) || [];
  if (displayMatches.length % 2 !== 0) {
    issues.push({
      type: "error",
      field: "katex",
      subfield,
      message: `${fieldName}: Unclosed display math delimiter "$$" (${displayMatches.length} found).`,
    });
  }

  // 2. Check unmatched \( and \)
  const openParen = (text.match(/\\\(/g) || []).length;
  const closeParen = (text.match(/\\\)/g) || []).length;
  if (openParen !== closeParen) {
    issues.push({
      type: "error",
      field: "katex",
      subfield,
      message: `${fieldName}: Unmatched \\( and \\) delimiters (${openParen} open, ${closeParen} close).`,
    });
  }

  // 3. Check unmatched \[ and \]
  const openBracket = (text.match(/\\\[/g) || []).length;
  const closeBracket = (text.match(/\\\]/g) || []).length;
  if (openBracket !== closeBracket) {
    issues.push({
      type: "error",
      field: "katex",
      subfield,
      message: `${fieldName}: Unmatched \\[ and \\] delimiters (${openBracket} open, ${closeBracket} close).`,
    });
  }

  // 4. Check unescaped currency sign $50 vs math
  const lines = text.split("\n");
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    let i = 0;
    while (i < line.length) {
      if (line[i] === "$" && (i === 0 || line[i - 1] !== "\\")) {
        // Skip $$
        if (line[i + 1] === "$") {
          i += 2;
          continue;
        }

        let nextDollar = -1;
        for (let j = i + 1; j < line.length; j++) {
          if (line[j] === "$" && line[j - 1] !== "\\") {
            nextDollar = j;
            break;
          }
        }

        if (nextDollar === -1) {
          // Lone $ on line
          const snippet = line.slice(i, Math.min(line.length, i + 15)).trim();
          if (/\$\s*\d/.test(snippet)) {
            issues.push({
              type: "warning",
              field: "katex",
              subfield,
              message: `${fieldName}: Potential unescaped currency "$": "${snippet}". Escape as "\\$".`,
            });
          } else {
            issues.push({
              type: "error",
              field: "katex",
              subfield,
              message: `${fieldName}: Dangling unclosed inline math delimiter "$": "${snippet}".`,
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
          const snippet = line.slice(i, Math.min(line.length, nextDollar + 8)).trim();
          issues.push({
            type: "warning",
            field: "katex",
            subfield,
            message: `${fieldName}: Unescaped currency dollar in "${snippet}". Use "\\$" to avoid KaTeX corruption.`,
          });
          i++;
          continue;
        }

        // Test candidate math block with KaTeX
        const mathExpr = candidate.trim();
        if (mathExpr) {
          // Check curly brace balance
          const openB = (mathExpr.match(/(?<!\\)\{/g) || []).length;
          const closeB = (mathExpr.match(/(?<!\\)\}/g) || []).length;
          if (openB !== closeB) {
            issues.push({
              type: "error",
              field: "katex",
              subfield,
              message: `${fieldName}: Unbalanced braces in $${mathExpr.slice(0, 30)}$ (${openB} open, ${closeB} close).`,
            });
          }

          try {
            katex.renderToString(mathExpr, { displayMode: false, throwOnError: true });
          } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Invalid syntax";
            issues.push({
              type: "error",
              field: "katex",
              subfield,
              message: `${fieldName}: KaTeX parse error in "$${mathExpr.slice(0, 30)}$": ${errMsg}`,
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

/**
 * Runs comprehensive audit on a single question.
 */
function auditQuestion(q: StagingQuestion, index: number): QuestionAuditResult {
  const qNum = q.question_number || index + 1;
  const issues: AuditIssue[] = [];

  // 1. Check options count
  if (!q.options || q.options.length !== 4) {
    issues.push({
      type: "error",
      field: "options",
      message: `Must contain exactly 4 options A, B, C, D (found ${q.options?.length || 0}).`,
    });
  } else {
    // Check option labels A, B, C, D
    const labels = q.options.map((o) => o.label).sort();
    const hasValidLabels = labels.length === 4 && labels.join("") === "ABCD";
    if (!hasValidLabels) {
      issues.push({
        type: "error",
        field: "options",
        message: `Option labels must be A, B, C, D (found: ${q.options.map((o) => o.label).join(", ")}).`,
      });
    }

    // Check empty options
    q.options.forEach((opt) => {
      const label = opt.label as "A" | "B" | "C" | "D";
      if (!opt.content_markdown || opt.content_markdown.trim().length === 0) {
        issues.push({
          type: "error",
          field: "options",
          subfield: label,
          message: `Option ${opt.label} has empty content.`,
        });
      } else {
        // KaTeX check in option
        const optKatexIssues = lintKaTeXInText(
          opt.content_markdown,
          `Option ${opt.label}`,
          label
        );
        issues.push(...optKatexIssues);
      }
    });

    // Check correct answer count
    const correctOptions = q.options.filter((o) => o.is_correct);
    if (correctOptions.length === 0) {
      issues.push({
        type: "error",
        field: "options",
        message: "Missing correct answer: No option marked as correct.",
      });
    } else if (correctOptions.length > 1) {
      issues.push({
        type: "error",
        field: "options",
        message: `Multiple correct answers: ${correctOptions.map((o) => o.label).join(", ")} are marked correct. Exactly 1 is required.`,
      });
    }
  }

  // 2. Check stem
  if (!q.stem_markdown || q.stem_markdown.trim().length === 0) {
    issues.push({
      type: "error",
      field: "stem",
      subfield: "stem",
      message: "Question stem is empty.",
    });
  } else if (q.stem_markdown.trim().length < 5) {
    issues.push({
      type: "error",
      field: "stem",
      subfield: "stem",
      message: "Question stem is too short (less than 5 characters).",
    });
  } else {
    const stemKatexIssues = lintKaTeXInText(q.stem_markdown, "Stem", "stem");
    issues.push(...stemKatexIssues);
  }

  // 3. Topic check
  const topic = (q.topic_name || "").trim();
  const isTopicAssigned =
    topic.length > 0 &&
    topic.toLowerCase() !== "unassigned" &&
    topic.toLowerCase() !== "none";

  if (!isTopicAssigned) {
    issues.push({
      type: "warning",
      field: "topic",
      subfield: "topic",
      message: "No syllabus topic assigned (defaults to unassigned).",
    });
  }

  // 4. Diagram health check
  const hasDiagram = Boolean(q.diagram?.has_diagram);
  if (hasDiagram) {
    const imageUrl = (q.diagram?.image_url || "").trim();
    if (!imageUrl) {
      issues.push({
        type: "warning",
        field: "diagram",
        subfield: "diagram",
        message: "Diagram flag is enabled but image URL is missing or empty.",
      });
    } else {
      const isValidFormat =
        imageUrl.startsWith("/") ||
        imageUrl.startsWith("http://") ||
        imageUrl.startsWith("https://") ||
        imageUrl.startsWith("data:image/") ||
        /\.(png|jpe?g|svg|webp|gif)$/i.test(imageUrl);

      if (!isValidFormat) {
        issues.push({
          type: "warning",
          field: "diagram",
          subfield: "diagram",
          message: "Diagram image URL format is invalid or unreachable.",
        });
      }
    }
  }

  // 5. Explanation check
  const hasExplanation = Boolean(
    q.explanation_markdown && q.explanation_markdown.trim().length > 0
  );
  if (!hasExplanation) {
    issues.push({
      type: "warning",
      field: "explanation",
      subfield: "explanation",
      message: "No step-by-step derivation or distractor explanation provided.",
    });
  } else {
    const expKatexIssues = lintKaTeXInText(
      q.explanation_markdown || "",
      "Explanation",
      "explanation"
    );
    issues.push(...expKatexIssues);
  }

  // Determine overall status
  const hasErrors = issues.some((i) => i.type === "error");
  const hasWarnings = issues.some((i) => i.type === "warning");
  const status: AuditStatus = hasErrors ? "error" : hasWarnings ? "warning" : "valid";

  // Create clean snippet of stem for card
  const cleanStem = (q.stem_markdown || "")
    .replace(/[#*`$]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const stemSnippet =
    cleanStem.length > 70 ? `${cleanStem.slice(0, 67)}...` : cleanStem || "(Empty Stem)";

  return {
    index,
    questionNumber: qNum,
    status,
    issues,
    hasDiagram,
    hasExplanation,
    topicName: q.topic_name || "Unassigned",
    stemSnippet,
  };
}

/**
 * Focuses the corresponding input or textarea in the editor after jumping to question.
 */
function focusInvalidFieldInDOM(field: AuditIssue["field"], subfield?: AuditIssue["subfield"]) {
  const tryFocus = () => {
    let targetEl: HTMLElement | null = null;

    if (field === "options") {
      if (subfield && ["A", "B", "C", "D"].includes(subfield)) {
        targetEl = document.getElementById(`option-${subfield}-content`);
      }
      if (!targetEl) {
        targetEl = document.querySelector<HTMLElement>('textarea[id^="option-"]');
      }
      if (!targetEl) {
        targetEl = document.querySelector<HTMLElement>('button[role="radio"]');
      }
    } else if (field === "stem") {
      targetEl =
        document.querySelector<HTMLElement>('textarea[placeholder*="stem"]') ||
        document.querySelector<HTMLElement>("textarea");
    } else if (field === "katex") {
      if (subfield && ["A", "B", "C", "D"].includes(subfield)) {
        targetEl = document.getElementById(`option-${subfield}-content`);
      } else if (subfield === "explanation") {
        targetEl = document.getElementById("explanation-textarea");
      } else {
        targetEl =
          document.querySelector<HTMLElement>('textarea[placeholder*="stem"]') ||
          document.querySelector<HTMLElement>("textarea");
      }
    } else if (field === "diagram") {
      targetEl =
        document.getElementById("diagram-alt-description") ||
        document.querySelector<HTMLElement>('input[placeholder*="Demand"]');
    } else if (field === "topic") {
      targetEl =
        document.getElementById("syllabus-topic-select") ||
        document.getElementById("custom-topic-input");
    } else if (field === "explanation") {
      targetEl = document.getElementById("explanation-textarea");
    }

    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      targetEl.focus();
      return true;
    }
    return false;
  };

  // Multiple attempts to ensure DOM rendering completes
  if (!tryFocus()) {
    setTimeout(() => {
      if (!tryFocus()) {
        setTimeout(tryFocus, 180);
      }
    }, 60);
  }
}

export default function IngestionAuditDrawer({
  isOpen,
  onClose,
  paper,
  onSelectQuestion,
  expectedCount = 40,
}: IngestionAuditDrawerProps) {
  const [filter, setFilter] = useState<
    "all" | "error" | "warning" | "valid" | "diagrams" | "no-explanation"
  >("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Compute question audits
  const auditResults = useMemo<QuestionAuditResult[]>(() => {
    if (!paper?.questions) return [];
    return paper.questions.map((q, idx) => auditQuestion(q, idx));
  }, [paper]);

  // 6 Live Quality Gate Checklist calculations
  const qualityGateChecklist = useMemo<QualityGateCheckItem[]>(() => {
    const questions = paper?.questions || [];
    const totalQ = questions.length;
    const effectiveExpected = expectedCount || 40;

    // 1. Total Questions Check (e.g. 40/40 questions present)
    const isCountMet = totalQ >= effectiveExpected;
    const countCheck: QualityGateCheckItem = {
      id: "total_questions",
      title: "Total Questions Present",
      status: isCountMet ? "pass" : totalQ > 0 ? "warn" : "fail",
      metric: `${totalQ}/${effectiveExpected}`,
      description: isCountMet
        ? `Full Cambridge paper standard satisfied (${totalQ}/${effectiveExpected} questions staged).`
        : `Paper currently has ${totalQ} questions. Cambridge MCQ papers typically require ${effectiveExpected}.`,
      failingQuestionIndices: [],
      icon: Layers,
    };

    // 2. Options Validity (all 4 options populated per question)
    const optionsInvalidIndices: number[] = [];
    questions.forEach((q, idx) => {
      const opts = q.options || [];
      const has4 = opts.length === 4;
      const allPopulated =
        has4 && opts.every((o) => (o.content_markdown || "").trim().length > 0);
      if (!allPopulated) {
        optionsInvalidIndices.push(idx);
      }
    });
    const optionsCheck: QualityGateCheckItem = {
      id: "options_validity",
      title: "Options Validity",
      status:
        optionsInvalidIndices.length === 0
          ? "pass"
          : totalQ > 0 && optionsInvalidIndices.length <= 3
          ? "warn"
          : "fail",
      metric: `${totalQ - optionsInvalidIndices.length}/${totalQ}`,
      description:
        optionsInvalidIndices.length === 0
          ? "All questions contain exactly 4 populated options (A, B, C, D)."
          : `${optionsInvalidIndices.length} question(s) have missing or empty MCQ option choices.`,
      failingQuestionIndices: optionsInvalidIndices,
      icon: ListOrdered,
    };

    // 3. Correct Key Parity (exactly 1 correct option per question)
    const keyParityInvalidIndices: number[] = [];
    questions.forEach((q, idx) => {
      const correctCount = (q.options || []).filter((o) => o.is_correct).length;
      if (correctCount !== 1) {
        keyParityInvalidIndices.push(idx);
      }
    });
    const keyParityCheck: QualityGateCheckItem = {
      id: "correct_key_parity",
      title: "Correct Key Parity",
      status: keyParityInvalidIndices.length === 0 ? "pass" : "fail",
      metric: `${totalQ - keyParityInvalidIndices.length}/${totalQ}`,
      description:
        keyParityInvalidIndices.length === 0
          ? "Every question designates exactly 1 correct answer key."
          : `${keyParityInvalidIndices.length} question(s) have 0 or multiple options marked correct.`,
      failingQuestionIndices: keyParityInvalidIndices,
      icon: CheckCheck,
    };

    // 4. KaTeX Syntax Integrity (0 syntax parse errors across all stems & options)
    const katexErrorIndices: number[] = [];
    let totalKatexErrors = 0;
    auditResults.forEach((res) => {
      const kErrors = res.issues.filter(
        (i) => i.field === "katex" && i.type === "error"
      );
      if (kErrors.length > 0) {
        katexErrorIndices.push(res.index);
        totalKatexErrors += kErrors.length;
      }
    });
    const katexCheck: QualityGateCheckItem = {
      id: "katex_integrity",
      title: "KaTeX Syntax Integrity",
      status: katexErrorIndices.length === 0 ? "pass" : "fail",
      metric: `${totalKatexErrors} Errors`,
      description:
        katexErrorIndices.length === 0
          ? "0 KaTeX syntax parse errors across all stems, options, and derivations."
          : `${totalKatexErrors} syntax error(s) detected across ${katexErrorIndices.length} question(s).`,
      failingQuestionIndices: katexErrorIndices,
      icon: Sigma,
    };

    // 5. Diagram Integrity (all questions flagged with diagrams have valid crop & image URL)
    const diagramInvalidIndices: number[] = [];
    let diagramCount = 0;
    questions.forEach((q, idx) => {
      if (q.diagram?.has_diagram) {
        diagramCount++;
        const url = (q.diagram.image_url || "").trim();
        if (!url) {
          diagramInvalidIndices.push(idx);
        }
      }
    });
    const diagramCheck: QualityGateCheckItem = {
      id: "diagram_integrity",
      title: "Diagram Integrity",
      status:
        diagramInvalidIndices.length === 0
          ? "pass"
          : "warn",
      metric: `${diagramCount - diagramInvalidIndices.length}/${diagramCount || 0}`,
      description:
        diagramCount === 0
          ? "No diagrams required for this paper batch."
          : diagramInvalidIndices.length === 0
          ? `All ${diagramCount} diagram-flagged questions possess valid images.`
          : `${diagramInvalidIndices.length} question(s) flagged with diagrams are missing crop or image URL.`,
      failingQuestionIndices: diagramInvalidIndices,
      icon: ImageIcon,
    };

    // 6. Syllabus Alignment (all questions assigned to a valid curriculum topic)
    const topicInvalidIndices: number[] = [];
    questions.forEach((q, idx) => {
      const topicName = (q.topic_name || "").trim().toLowerCase();
      if (!topicName || topicName === "unassigned" || topicName === "none") {
        topicInvalidIndices.push(idx);
      }
    });
    const syllabusCheck: QualityGateCheckItem = {
      id: "syllabus_alignment",
      title: "Syllabus Alignment",
      status: topicInvalidIndices.length === 0 ? "pass" : "warn",
      metric: `${totalQ - topicInvalidIndices.length}/${totalQ}`,
      description:
        topicInvalidIndices.length === 0
          ? "All questions assigned to standard syllabus curriculum topics."
          : `${topicInvalidIndices.length} question(s) unassigned or missing curriculum topics.`,
      failingQuestionIndices: topicInvalidIndices,
      icon: Tag,
    };

    return [
      countCheck,
      optionsCheck,
      keyParityCheck,
      katexCheck,
      diagramCheck,
      syllabusCheck,
    ];
  }, [paper, expectedCount, auditResults]);

  // Comprehensive Metrics & 0-100% Quality Score calculation
  const metrics = useMemo(() => {
    const total = auditResults.length;
    const valid = auditResults.filter((r) => r.status === "valid").length;
    const errors = auditResults.filter((r) => r.status === "error").length;
    const warnings = auditResults.filter((r) => r.status === "warning").length;
    const diagrams = auditResults.filter((r) => r.hasDiagram).length;
    const explanations = auditResults.filter((r) => r.hasExplanation).length;

    // Quality gate pass count
    const passedGateCount = qualityGateChecklist.filter(
      (c) => c.status === "pass"
    ).length;

    // Weighted 0-100% quality score
    let healthScore = 0;
    if (total > 0) {
      // 40% based on question validity percentage
      const validRatio = valid / total;
      // 60% based on quality gate checks (6 checks total, 10% each)
      const gateRatio = passedGateCount / qualityGateChecklist.length;
      healthScore = Math.round(validRatio * 40 + gateRatio * 60);
      healthScore = Math.min(100, Math.max(0, healthScore));
    }

    return {
      total,
      valid,
      errors,
      warnings,
      diagrams,
      explanations,
      healthScore,
      passedGateCount,
    };
  }, [auditResults, qualityGateChecklist]);

  // Filtered and searched list
  const filteredResults = useMemo(() => {
    return auditResults.filter((item) => {
      // 1. Status Filter
      if (filter === "error" && item.status !== "error") return false;
      if (filter === "warning" && item.status !== "warning") return false;
      if (filter === "valid" && item.status !== "valid") return false;
      if (filter === "diagrams" && !item.hasDiagram) return false;
      if (filter === "no-explanation" && item.hasExplanation) return false;

      // 2. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQNum =
          `q${item.questionNumber}`.includes(query) || `${item.questionNumber}` === query;
        const matchesStem = item.stemSnippet.toLowerCase().includes(query);
        const matchesTopic = item.topicName.toLowerCase().includes(query);
        const matchesIssue = item.issues.some((i) =>
          i.message.toLowerCase().includes(query)
        );

        if (!matchesQNum && !matchesStem && !matchesTopic && !matchesIssue) {
          return false;
        }
      }

      return true;
    });
  }, [auditResults, filter, searchQuery]);

  // One-Click Jump to Issue handler
  const handleJumpToIssue = useCallback(
    (questionIndex: number, issue?: AuditIssue) => {
      onSelectQuestion(questionIndex, issue?.field);
      onClose();
      if (issue) {
        focusInvalidFieldInDOM(issue.field, issue.subfield);
      }
    },
    [onSelectQuestion, onClose]
  );

  // Generate audit report string (Markdown)
  const generateMarkdownReport = useCallback((): string => {
    const subjectInfo = `${paper?.subject?.name || "Subject"} (${paper?.subject?.code || "Code"})`;
    const paperInfo = `${paper?.paper?.series || ""}${paper?.paper?.year || ""} Paper ${paper?.paper?.paper_code || ""}`;
    const timestamp = new Date().toISOString();

    let md = `# Ingestion Studio Audit Report\n\n`;
    md += `**Subject:** ${subjectInfo}\n`;
    md += `**Paper:** ${paperInfo}\n`;
    md += `**Generated:** ${timestamp}\n\n`;

    md += `## 🛡️ Live Quality Gate Checklist\n\n`;
    qualityGateChecklist.forEach((gate) => {
      const icon = gate.status === "pass" ? "✅" : gate.status === "warn" ? "⚠️" : "❌";
      md += `- ${icon} **${gate.title}** [${gate.metric}]: ${gate.description}\n`;
    });
    md += `\n`;

    md += `## 📊 Executive Summary\n\n`;
    md += `| Metric | Count | Percentage |\n`;
    md += `| :--- | :--- | :--- |\n`;
    md += `| **Total Questions** | ${metrics.total} | 100% |\n`;
    md += `| **Validated (Ready)** | ${metrics.valid} | ${metrics.total ? Math.round((metrics.valid / metrics.total) * 100) : 0}% |\n`;
    md += `| **Questions with Errors** | ${metrics.errors} | ${metrics.total ? Math.round((metrics.errors / metrics.total) * 100) : 0}% |\n`;
    md += `| **Questions with Warnings** | ${metrics.warnings} | ${metrics.total ? Math.round((metrics.warnings / metrics.total) * 100) : 0}% |\n`;
    md += `| **Questions with Diagrams** | ${metrics.diagrams} | ${metrics.total ? Math.round((metrics.diagrams / metrics.total) * 100) : 0}% |\n`;
    md += `| **Explanations Complete** | ${metrics.explanations} | ${metrics.total ? Math.round((metrics.explanations / metrics.total) * 100) : 0}% |\n`;
    md += `| **Overall Quality Health Score** | **${metrics.healthScore}%** | - |\n\n`;

    md += `## 📋 Question-by-Question Audit Breakdown\n\n`;

    auditResults.forEach((q) => {
      const statusIcon =
        q.status === "valid" ? "✅ VALID" : q.status === "error" ? "❌ ERROR" : "⚠️ WARNING";
      md += `### Q${q.questionNumber}: [${statusIcon}]\n`;
      md += `- **Topic:** ${q.topicName}\n`;
      md += `- **Diagram:** ${q.hasDiagram ? "Yes" : "No"}\n`;
      md += `- **Explanation:** ${q.hasExplanation ? "Present" : "Missing"}\n`;
      md += `- **Stem:** \`${q.stemSnippet}\`\n`;

      if (q.issues.length === 0) {
        md += `- **Validation:** All integrity and KaTeX checks passed.\n\n`;
      } else {
        md += `- **Audit Findings (${q.issues.length}):**\n`;
        q.issues.forEach((issue) => {
          const prefix = issue.type === "error" ? "[ERROR]" : "[WARNING]";
          md += `  - ${prefix} ${issue.message}\n`;
        });
        md += `\n`;
      }
    });

    md += `---\n*Generated by Revizz Ingestion QA Engine*\n`;
    return md;
  }, [paper, metrics, auditResults, qualityGateChecklist]);

  // Export report download
  const handleExportReport = () => {
    const report = generateMarkdownReport();
    const paperName = `${paper?.subject?.code || "paper"}_${paper?.paper?.series || ""}${paper?.paper?.year || ""}_${paper?.paper?.paper_code || ""}`;
    const filename = `audit-report-${paperName}.md`;

    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy report to clipboard
  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(generateMarkdownReport());
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
    } catch (err) {
      console.error("Failed to copy audit report", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop click dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-2xl bg-[#f9f4ed] border-l-4 border-slate-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-250">
        {/* Top Header */}
        <div className="p-5 sm:p-6 bg-[#f5ead8] border-b-2 border-b-4 border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-brand-yellow border-2 border-b-4 border-slate-800 shadow-chunky flex items-center justify-center text-xl font-bold shrink-0">
              📋
            </div>
            <div>
              <h2 className="font-heading text-2xl text-slate-800 tracking-tight leading-tight">
                Quality Gate Audit
              </h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-bold text-slate-600">
                <span>
                  {paper?.subject?.code} {paper?.subject?.name}
                </span>
                <span>•</span>
                <span>
                  {paper?.paper?.series}
                  {paper?.paper?.year} {paper?.paper?.paper_code}
                </span>
                <span>•</span>
                <span>{metrics.total} Questions</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 bg-white hover:bg-neutral-100 border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all text-slate-800 cursor-pointer"
            aria-label="Close Audit Drawer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 flex flex-col gap-6">
          {/* Health Score & Readiness Badge */}
          <div className="p-5 bg-white border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Live Quality Score
                </span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-heading text-4xl text-slate-800">
                    {metrics.healthScore}%
                  </span>
                  <span className="text-sm font-bold text-slate-600">
                    ({metrics.valid} of {metrics.total} valid)
                  </span>
                </div>
              </div>

              {/* Health Score Badge */}
              <div
                className={`px-4 py-2 border-2 border-b-4 border-slate-800 rounded-2xl font-black text-xs sm:text-sm uppercase shadow-chunky flex items-center gap-1.5 transition-all ${
                  metrics.healthScore >= 95
                    ? "bg-brand-green text-white"
                    : metrics.healthScore >= 80
                    ? "bg-brand-yellow text-slate-900"
                    : metrics.healthScore >= 50
                    ? "bg-brand-amber text-slate-900"
                    : "bg-brand-coral text-white"
                }`}
              >
                {metrics.healthScore >= 95 ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Ready to Publish</span>
                  </>
                ) : metrics.healthScore >= 80 ? (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Minor Fixes Needed</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>Requires Attention</span>
                  </>
                )}
              </div>
            </div>

            {/* Chunky Progress Bar */}
            <div className="w-full bg-[#f5ead8] h-4 rounded-full border-2 border-slate-800 overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 border border-slate-800 ${
                  metrics.healthScore >= 90
                    ? "bg-brand-green"
                    : metrics.healthScore >= 60
                    ? "bg-brand-yellow"
                    : "bg-brand-coral"
                }`}
                style={{ width: `${Math.max(4, metrics.healthScore)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-slate-600 pt-1 border-t border-slate-200">
              <span>{metrics.passedGateCount} of 6 Quality Gate checks passing</span>
              <span>Target: 100% compliant for Cambridge ingestion</span>
            </div>
          </div>

          {/* =========================================================================
              LIVE QUALITY GATE CHECKLIST (6 CRITERIA)
             ========================================================================= */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-brand-yellow border border-slate-800" />
                <h3 className="font-heading text-lg text-slate-800">
                  Live Quality Gate Checklist
                </h3>
              </div>
              <span className="text-xs font-black uppercase text-slate-500">
                6 Essential Criteria
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {qualityGateChecklist.map((gate) => {
                const IconComponent = gate.icon;
                const isPass = gate.status === "pass";
                const isWarn = gate.status === "warn";

                return (
                  <div
                    key={gate.id}
                    className={`p-3.5 rounded-2xl border-2 border-b-4 border-slate-800 shadow-chunky flex flex-col justify-between gap-2.5 transition-all ${
                      isPass
                        ? "bg-[#f0fae1]"
                        : isWarn
                        ? "bg-[#fef3c7]"
                        : "bg-[#fee2e2]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-xl border-2 border-slate-800 flex items-center justify-center shrink-0 ${
                            isPass
                              ? "bg-white text-emerald-700"
                              : isWarn
                              ? "bg-white text-amber-700"
                              : "bg-white text-rose-700"
                          }`}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="font-heading text-xs sm:text-sm text-slate-900 truncate">
                          {gate.title}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-lg border-2 border-slate-800 text-[10px] font-black uppercase tracking-tight shrink-0 ${
                          isPass
                            ? "bg-emerald-100 text-emerald-800"
                            : isWarn
                            ? "bg-amber-100 text-amber-900"
                            : "bg-rose-100 text-rose-900"
                        }`}
                      >
                        {gate.metric}
                      </span>
                    </div>

                    <p className="text-[11px] font-bold text-slate-700 leading-snug line-clamp-2">
                      {gate.description}
                    </p>

                    {/* Quick Jump to first issue if failing */}
                    {gate.failingQuestionIndices.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const firstFailIdx = gate.failingQuestionIndices[0];
                          const field =
                            gate.id === "options_validity" || gate.id === "correct_key_parity"
                              ? "options"
                              : gate.id === "katex_integrity"
                              ? "katex"
                              : gate.id === "diagram_integrity"
                              ? "diagram"
                              : "topic";
                          handleJumpToIssue(firstFailIdx, {
                            type: "error",
                            field,
                            message: gate.description,
                          });
                        }}
                        className="mt-1 w-full py-1 px-2.5 bg-white hover:bg-neutral-50 text-slate-900 border-2 border-slate-800 rounded-xl text-[11px] font-black shadow-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:translate-y-0.5"
                      >
                        <span>Fix Issue in Q{gate.failingQuestionIndices[0] + 1}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5 Comprehensive Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-white border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky flex flex-col">
              <span className="text-[10px] font-black uppercase text-slate-500 flex items-center gap-1">
                <Layers className="w-3 h-3" /> Total
              </span>
              <span className="font-heading text-2xl text-slate-800 mt-1">{metrics.total}</span>
            </div>

            <div className="p-3 bg-[#f0fae1] border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky flex flex-col">
              <span className="text-[10px] font-black uppercase text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Valid
              </span>
              <span className="font-heading text-2xl text-emerald-800 mt-1">{metrics.valid}</span>
            </div>

            <div className="p-3 bg-[#fee2e2] border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky flex flex-col">
              <span className="text-[10px] font-black uppercase text-rose-800 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Errors
              </span>
              <span className="font-heading text-2xl text-rose-800 mt-1">{metrics.errors}</span>
            </div>

            <div className="p-3 bg-[#fef3c7] border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky flex flex-col">
              <span className="text-[10px] font-black uppercase text-amber-800 flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Diagrams
              </span>
              <span className="font-heading text-2xl text-amber-800 mt-1">{metrics.diagrams}</span>
            </div>

            <div className="p-3 bg-[#ffe1d0] border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky flex flex-col col-span-2 sm:col-span-1">
              <span className="text-[10px] font-black uppercase text-amber-900 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Notes
              </span>
              <span className="font-heading text-2xl text-amber-900 mt-1">
                {metrics.explanations}
              </span>
            </div>
          </div>

          {/* Action Row: Export Report & Copy */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f5ead8] border-2 border-b-4 border-slate-800 rounded-2xl p-4 shadow-chunky">
            <div className="text-xs font-bold text-slate-700">
              Export full paper audit log with KaTeX integrity and derivation status:
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyReport}
                className="px-3.5 py-2 bg-white hover:bg-neutral-50 border-2 border-b-4 border-slate-800 rounded-xl font-bold text-xs shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1.5 transition-all text-slate-800 cursor-pointer"
              >
                {copiedReport ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>

              <button
                onClick={handleExportReport}
                className="px-3.5 py-2 bg-brand-yellow hover:bg-[#fde047] border-2 border-b-4 border-slate-800 rounded-xl font-bold text-xs shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1.5 transition-all text-slate-800 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Report (.md)</span>
              </button>
            </div>
          </div>

          {/* Filter Chips & Search Bar */}
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search audit by Question #, topic, or error keyword..."
                className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-800 rounded-xl text-sm font-bold text-slate-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand-yellow"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 hover:text-black cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-xl border-2 border-b-4 border-slate-800 font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "all"
                    ? "bg-slate-800 text-white shadow-chunky"
                    : "bg-white text-slate-800 hover:bg-neutral-100"
                }`}
              >
                All ({metrics.total})
              </button>
              <button
                onClick={() => setFilter("error")}
                className={`px-3 py-1.5 rounded-xl border-2 border-b-4 border-slate-800 font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "error"
                    ? "bg-[#b91c1c] text-white shadow-chunky"
                    : "bg-[#fee2e2] text-[#b91c1c] hover:bg-red-200"
                }`}
              >
                Errors ({metrics.errors})
              </button>
              <button
                onClick={() => setFilter("warning")}
                className={`px-3 py-1.5 rounded-xl border-2 border-b-4 border-slate-800 font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "warning"
                    ? "bg-[#b45309] text-white shadow-chunky"
                    : "bg-[#fef3c7] text-[#b45309] hover:bg-amber-200"
                }`}
              >
                Warnings ({metrics.warnings})
              </button>
              <button
                onClick={() => setFilter("valid")}
                className={`px-3 py-1.5 rounded-xl border-2 border-b-4 border-slate-800 font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "valid"
                    ? "bg-[#15803d] text-white shadow-chunky"
                    : "bg-[#f0fae1] text-[#15803d] hover:bg-green-200"
                }`}
              >
                Valid ({metrics.valid})
              </button>
              <button
                onClick={() => setFilter("diagrams")}
                className={`px-3 py-1.5 rounded-xl border-2 border-b-4 border-slate-800 font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "diagrams"
                    ? "bg-[#2563eb] text-white shadow-chunky"
                    : "bg-[#dbeafe] text-[#2563eb] hover:bg-blue-200"
                }`}
              >
                Diagrams ({metrics.diagrams})
              </button>
              <button
                onClick={() => setFilter("no-explanation")}
                className={`px-3 py-1.5 rounded-xl border-2 border-b-4 border-slate-800 font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "no-explanation"
                    ? "bg-slate-700 text-white shadow-chunky"
                    : "bg-white text-slate-700 hover:bg-neutral-100"
                }`}
              >
                No Notes ({metrics.total - metrics.explanations})
              </button>
            </div>
          </div>

          {/* Question Audit Breakdown List */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-slate-500">
              <span>Audit Breakdown ({filteredResults.length} Questions)</span>
              <span>Click any issue to jump &amp; focus field</span>
            </div>

            {filteredResults.length === 0 ? (
              <div className="p-8 text-center bg-white border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky flex flex-col items-center justify-center gap-2">
                <Sparkles className="w-8 h-8 text-brand-yellow" />
                <h4 className="font-heading text-lg text-slate-800">
                  No questions match current filter
                </h4>
                <p className="text-xs text-slate-600 font-bold">
                  Try clearing the search query or selecting a different filter chip.
                </p>
              </div>
            ) : (
              filteredResults.map((item) => {
                return (
                  <div
                    key={item.index}
                    className="p-4 bg-white border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky flex flex-col gap-3 transition-all hover:translate-x-0.5"
                  >
                    {/* Top Row: Q# pill, badges, jump button */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Q# Pill */}
                        <span className="w-8 h-8 rounded-xl bg-slate-800 text-white font-heading flex items-center justify-center text-sm shadow-xs">
                          Q{item.questionNumber}
                        </span>

                        {/* Status Chip */}
                        {item.status === "valid" && (
                          <span className="px-2.5 py-1 rounded-lg bg-[#dcfce7] border-2 border-[#15803d] text-[#15803d] text-xs font-black flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Valid
                          </span>
                        )}
                        {item.status === "error" && (
                          <span className="px-2.5 py-1 rounded-lg bg-[#fee2e2] border-2 border-[#b91c1c] text-[#b91c1c] text-xs font-black flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Error (
                            {item.issues.filter((i) => i.type === "error").length})
                          </span>
                        )}
                        {item.status === "warning" && (
                          <span className="px-2.5 py-1 rounded-lg bg-[#fef3c7] border-2 border-[#b45309] text-[#b45309] text-xs font-black flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Warning (
                            {item.issues.filter((i) => i.type === "warning").length})
                          </span>
                        )}

                        {/* Badges */}
                        {item.hasDiagram && (
                          <span className="px-2 py-0.5 rounded-md bg-purple-100 border border-purple-400 text-purple-700 text-[10px] font-bold flex items-center gap-0.5">
                            <ImageIcon className="w-3 h-3" /> Diagram
                          </span>
                        )}
                        {item.hasExplanation && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 border border-amber-400 text-amber-800 text-[10px] font-bold flex items-center gap-0.5">
                            <FileText className="w-3 h-3" /> Explanation
                          </span>
                        )}
                      </div>

                      {/* Jump to Question button */}
                      <button
                        onClick={() => handleJumpToIssue(item.index)}
                        className="px-3 py-1.5 bg-brand-yellow hover:bg-[#fde047] border-2 border-b-4 border-slate-800 rounded-xl text-xs font-bold text-slate-800 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <span>Jump to Q{item.questionNumber}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Stem Snippet & Topic */}
                    <div className="text-xs text-slate-800">
                      <span className="font-bold text-slate-500">Topic:</span>{" "}
                      <span className="font-semibold">{item.topicName}</span>
                      <p className="mt-1 text-neutral-700 italic line-clamp-2">
                        &quot;{item.stemSnippet}&quot;
                      </p>
                    </div>

                    {/* Issues List with One-Click Jump to Field */}
                    {item.issues.length > 0 ? (
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-200">
                        {item.issues.map((issue, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleJumpToIssue(item.index, issue)}
                            title={`Click to jump to Q${item.questionNumber} and focus ${issue.field}`}
                            className={`w-full text-left px-3 py-2 rounded-xl border-2 text-xs font-medium flex items-center justify-between gap-2 cursor-pointer transition-all hover:translate-x-0.5 active:scale-[0.99] ${
                              issue.type === "error"
                                ? "bg-red-50 border-red-300 text-red-900 hover:bg-red-100"
                                : "bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100"
                            }`}
                          >
                            <div className="flex items-start gap-2 min-w-0">
                              {issue.type === "error" ? (
                                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                              )}
                              <span className="leading-snug truncate">{issue.message}</span>
                            </div>

                            <span className="text-[10px] font-black uppercase tracking-tight px-2 py-0.5 rounded-md bg-white border border-slate-300 text-slate-700 shrink-0 flex items-center gap-1">
                              <span>Fix {issue.field}</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-1.5 rounded-xl bg-green-50 border border-green-200 text-green-800 text-xs font-medium flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                        <span>All validation checks passed. Ready for live gameplay.</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer sticky bar */}
        <div className="p-4 bg-[#f5ead8] border-t-2 border-t-4 border-slate-800 flex items-center justify-between gap-3 text-xs font-bold text-slate-600 shrink-0">
          <div>
            Showing {filteredResults.length} of {auditResults.length} questions
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-neutral-100 border-2 border-b-4 border-slate-800 rounded-xl text-xs font-bold text-slate-800 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none cursor-pointer transition-all"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}

export { IngestionAuditDrawer };

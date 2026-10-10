"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import type { StagingPaper, StagingQuestion, StagingOption } from "@/types/ingestion";
import {
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  Copy,
  Check,
  Search,
  Filter,
  ArrowRight,
  FileText,
  Image as ImageIcon,
  Layers,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import katex from "katex";

export interface IngestionAuditDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  paper: StagingPaper | null;
  onSelectQuestion: (questionIndex: number) => void;
}

export type AuditStatus = "valid" | "error" | "warning";

export interface AuditIssue {
  type: "error" | "warning";
  field: "options" | "stem" | "topic" | "diagram" | "explanation" | "katex";
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

/**
 * Checks a string for KaTeX syntax errors, unmatched delimiters, unbalanced braces,
 * and unescaped currency signs.
 */
function lintKaTeXInText(text: string, fieldName: string): AuditIssue[] {
  const issues: AuditIssue[] = [];
  if (!text) return issues;

  // 1. Check unescaped display math $$
  const displayMatches = text.match(/(?<!\\)\$\$/g) || [];
  if (displayMatches.length % 2 !== 0) {
    issues.push({
      type: "error",
      field: "katex",
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
              message: `${fieldName}: Potential unescaped currency "$": "${snippet}". Escape as "\\$".`,
            });
          } else {
            issues.push({
              type: "error",
              field: "katex",
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
        const hasEnglishProse = /\b(to|and|or|each|per|in|is|was|are|were|for|from|between|with|than|at|of)\b/i.test(candidate);
        const hasMathSyntax = /[\\^_{}=+\-<>*\/]|\\times|\\text|\\mathrm|\\pm|\\le|\\ge|\\ne|\\approx|\\alpha|\\beta|\\cdot|%/.test(candidate);

        if (isFollowedByDigit || hasEnglishProse || (startsWithDigit && !hasMathSyntax)) {
          const snippet = line.slice(i, Math.min(line.length, nextDollar + 8)).trim();
          issues.push({
            type: "warning",
            field: "katex",
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
              message: `${fieldName}: Unbalanced braces in $${mathExpr.slice(0, 30)}$ (${openB} open, ${closeB} close).`,
            });
          }

          try {
            katex.renderToString(mathExpr, { displayMode: false, throwOnError: true });
          } catch (err: any) {
            issues.push({
              type: "error",
              field: "katex",
              message: `${fieldName}: KaTeX parse error in "$${mathExpr.slice(0, 30)}$": ${err?.message || "Invalid syntax"}`,
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
      if (!opt.content_markdown || opt.content_markdown.trim().length === 0) {
        issues.push({
          type: "error",
          field: "options",
          message: `Option ${opt.label} has empty content.`,
        });
      } else {
        // KaTeX check in option
        const optKatexIssues = lintKaTeXInText(opt.content_markdown, `Option ${opt.label}`);
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
      message: "Question stem is empty.",
    });
  } else if (q.stem_markdown.trim().length < 5) {
    issues.push({
      type: "error",
      field: "stem",
      message: "Question stem is too short (less than 5 characters).",
    });
  } else {
    const stemKatexIssues = lintKaTeXInText(q.stem_markdown, "Stem");
    issues.push(...stemKatexIssues);
  }

  // 3. Topic check
  if (!q.topic_name || q.topic_name.trim().length === 0) {
    issues.push({
      type: "warning",
      field: "topic",
      message: "No syllabus topic assigned.",
    });
  }

  // 4. Diagram health check
  const hasDiagram = Boolean(q.diagram?.has_diagram);
  if (hasDiagram) {
    if (!q.diagram?.image_url || q.diagram.image_url.trim().length === 0) {
      issues.push({
        type: "warning",
        field: "diagram",
        message: "Diagram flag is enabled but image URL is missing or empty.",
      });
    }
  }

  // 5. Explanation check
  const hasExplanation = Boolean(q.explanation_markdown && q.explanation_markdown.trim().length > 0);
  if (!hasExplanation) {
    issues.push({
      type: "warning",
      field: "explanation",
      message: "No step-by-step derivation or explanation provided.",
    });
  } else {
    const expKatexIssues = lintKaTeXInText(q.explanation_markdown, "Explanation");
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
  const stemSnippet = cleanStem.length > 70 ? `${cleanStem.slice(0, 67)}...` : cleanStem || "(Empty Stem)";

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

export default function IngestionAuditDrawer({
  isOpen,
  onClose,
  paper,
  onSelectQuestion,
}: IngestionAuditDrawerProps) {
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "valid" | "diagrams" | "no-explanation">("all");
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

  // Metrics
  const metrics = useMemo(() => {
    const total = auditResults.length;
    const valid = auditResults.filter((r) => r.status === "valid").length;
    const errors = auditResults.filter((r) => r.status === "error").length;
    const warnings = auditResults.filter((r) => r.status === "warning").length;
    const diagrams = auditResults.filter((r) => r.hasDiagram).length;
    const explanations = auditResults.filter((r) => r.hasExplanation).length;
    const healthScore = total > 0 ? Math.round((valid / total) * 100) : 0;

    return {
      total,
      valid,
      errors,
      warnings,
      diagrams,
      explanations,
      healthScore,
    };
  }, [auditResults]);

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
        const matchesQNum = `q${item.questionNumber}`.includes(query) || `${item.questionNumber}` === query;
        const matchesStem = item.stemSnippet.toLowerCase().includes(query);
        const matchesTopic = item.topicName.toLowerCase().includes(query);
        const matchesIssue = item.issues.some((i) => i.message.toLowerCase().includes(query));

        if (!matchesQNum && !matchesStem && !matchesTopic && !matchesIssue) {
          return false;
        }
      }

      return true;
    });
  }, [auditResults, filter, searchQuery]);

  // Generate audit report string (Markdown)
  const generateMarkdownReport = useCallback((): string => {
    const subjectInfo = `${paper?.subject?.name || "Subject"} (${paper?.subject?.code || "Code"})`;
    const paperInfo = `${paper?.paper?.series || ""}${paper?.paper?.year || ""} Paper ${paper?.paper?.paper_code || ""}`;
    const timestamp = new Date().toISOString();

    let md = `# Ingestion Studio Audit Report\n\n`;
    md += `**Subject:** ${subjectInfo}\n`;
    md += `**Paper:** ${paperInfo}\n`;
    md += `**Generated:** ${timestamp}\n\n`;

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
      const statusIcon = q.status === "valid" ? "✅ VALID" : q.status === "error" ? "❌ ERROR" : "⚠️ WARNING";
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
  }, [paper, metrics, auditResults]);

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
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity duration-200"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop click dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer Container */}
      <div className="relative w-full max-w-2xl bg-[#f9f4ed] border-l-4 border-[#201e1d] shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-250">
        {/* Top Header */}
        <div className="p-6 bg-[#f5ead8] border-b-2 border-[#201e1d] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#facc15] border-2 border-[#201e1d] shadow-offset-2 flex items-center justify-center text-xl font-bold">
              📋
            </div>
            <div>
              <h2 className="font-heading text-2xl text-[#201e1d] tracking-tight">Paper Quality Audit</h2>
              <div className="flex items-center gap-2 mt-0.5 text-xs font-bold text-[#645c50]">
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
            className="p-2.5 bg-white hover:bg-neutral-100 border-2 border-[#201e1d] rounded-2xl shadow-offset-2 active:translate-y-0.5 active:shadow-none transition-all text-[#201e1d] cursor-pointer"
            aria-label="Close Audit Drawer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Health Score & Progress Card */}
          <div className="p-5 bg-white border-2 border-[#201e1d] rounded-2xl shadow-offset-2 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-[#645c50]">Paper Readiness Score</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="font-heading text-4xl text-[#201e1d]">{metrics.healthScore}%</span>
                  <span className="text-sm font-bold text-[#645c50]">
                    ({metrics.valid} of {metrics.total} valid)
                  </span>
                </div>
              </div>

              <div
                className={`px-4 py-2 border-2 border-[#201e1d] rounded-xl font-black text-xs uppercase shadow-offset-1 ${
                  metrics.healthScore >= 90
                    ? "bg-[#22C55E] text-white"
                    : metrics.healthScore >= 50
                    ? "bg-[#FACC15] text-[#201e1d]"
                    : "bg-[#FB7185] text-white"
                }`}
              >
                {metrics.healthScore >= 90
                  ? "Ready to Publish"
                  : metrics.healthScore >= 50
                  ? "Minor Fixes Needed"
                  : "Requires Attention"}
              </div>
            </div>

            {/* Chunky Progress Bar */}
            <div className="w-full bg-[#f5ead8] h-4 rounded-full border-2 border-[#201e1d] overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 border border-[#201e1d] ${
                  metrics.healthScore >= 90
                    ? "bg-[#22C55E]"
                    : metrics.healthScore >= 50
                    ? "bg-[#FACC15]"
                    : "bg-[#FB7185]"
                }`}
                style={{ width: `${Math.max(4, metrics.healthScore)}%` }}
              />
            </div>
          </div>

          {/* 5 Comprehensive Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-white border-2 border-[#201e1d] rounded-2xl shadow-offset-1 flex flex-col">
              <span className="text-[10px] font-black uppercase text-[#645c50] flex items-center gap-1">
                <Layers className="w-3 h-3" /> Total
              </span>
              <span className="font-heading text-2xl text-[#201e1d] mt-1">{metrics.total}</span>
            </div>

            <div className="p-3 bg-[#f0fae1] border-2 border-[#201e1d] rounded-2xl shadow-offset-1 flex flex-col">
              <span className="text-[10px] font-black uppercase text-[#15803d] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Valid
              </span>
              <span className="font-heading text-2xl text-[#15803d] mt-1">{metrics.valid}</span>
            </div>

            <div className="p-3 bg-[#fee2e2] border-2 border-[#201e1d] rounded-2xl shadow-offset-1 flex flex-col">
              <span className="text-[10px] font-black uppercase text-[#b91c1c] flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> Errors
              </span>
              <span className="font-heading text-2xl text-[#b91c1c] mt-1">{metrics.errors}</span>
            </div>

            <div className="p-3 bg-[#fef3c7] border-2 border-[#201e1d] rounded-2xl shadow-offset-1 flex flex-col">
              <span className="text-[10px] font-black uppercase text-[#b45309] flex items-center gap-1">
                <ImageIcon className="w-3 h-3" /> Diagrams
              </span>
              <span className="font-heading text-2xl text-[#b45309] mt-1">{metrics.diagrams}</span>
            </div>

            <div className="p-3 bg-[#ffe1d0] border-2 border-[#201e1d] rounded-2xl shadow-offset-1 flex flex-col col-span-2 sm:col-span-1">
              <span className="text-[10px] font-black uppercase text-[#c67139] flex items-center gap-1">
                <FileText className="w-3 h-3" /> Notes
              </span>
              <span className="font-heading text-2xl text-[#c67139] mt-1">{metrics.explanations}</span>
            </div>
          </div>

          {/* Action Row: Export Report & Copy */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f5ead8] border-2 border-[#201e1d] rounded-2xl p-4 shadow-offset-1">
            <div className="text-xs font-bold text-[#645c50]">
              Export full paper audit log with KaTeX integrity and derivation status:
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyReport}
                className="px-3.5 py-2 bg-white hover:bg-neutral-50 border-2 border-[#201e1d] rounded-xl font-bold text-xs shadow-offset-2 active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 transition-all text-[#201e1d] cursor-pointer"
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
                className="px-3.5 py-2 bg-[#facc15] hover:bg-[#fde047] border-2 border-[#201e1d] rounded-xl font-bold text-xs shadow-offset-2 active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 transition-all text-[#201e1d] cursor-pointer"
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
                className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-[#201e1d] rounded-xl text-sm font-bold text-[#201e1d] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#facc15]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400 hover:text-black"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "all"
                    ? "bg-[#201e1d] text-white shadow-offset-1"
                    : "bg-white text-[#201e1d] hover:bg-neutral-100"
                }`}
              >
                All ({metrics.total})
              </button>
              <button
                onClick={() => setFilter("error")}
                className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "error"
                    ? "bg-[#b91c1c] text-white shadow-offset-1"
                    : "bg-[#fee2e2] text-[#b91c1c] hover:bg-red-200"
                }`}
              >
                Errors ({metrics.errors})
              </button>
              <button
                onClick={() => setFilter("warning")}
                className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "warning"
                    ? "bg-[#b45309] text-white shadow-offset-1"
                    : "bg-[#fef3c7] text-[#b45309] hover:bg-amber-200"
                }`}
              >
                Warnings ({metrics.warnings})
              </button>
              <button
                onClick={() => setFilter("valid")}
                className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "valid"
                    ? "bg-[#15803d] text-white shadow-offset-1"
                    : "bg-[#f0fae1] text-[#15803d] hover:bg-green-200"
                }`}
              >
                Valid ({metrics.valid})
              </button>
              <button
                onClick={() => setFilter("diagrams")}
                className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "diagrams"
                    ? "bg-[#2563eb] text-white shadow-offset-1"
                    : "bg-[#dbeafe] text-[#2563eb] hover:bg-blue-200"
                }`}
              >
                Diagrams ({metrics.diagrams})
              </button>
              <button
                onClick={() => setFilter("no-explanation")}
                className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] font-bold shrink-0 transition-all cursor-pointer ${
                  filter === "no-explanation"
                    ? "bg-[#645c50] text-white shadow-offset-1"
                    : "bg-white text-[#645c50] hover:bg-neutral-100"
                }`}
              >
                No Derivation ({metrics.total - metrics.explanations})
              </button>
            </div>
          </div>

          {/* Question Audit Breakdown List */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#645c50]">
              <span>Audit Breakdown ({filteredResults.length} Questions)</span>
              <span>Click card to jump to editor</span>
            </div>

            {filteredResults.length === 0 ? (
              <div className="p-8 text-center bg-white border-2 border-[#201e1d] rounded-2xl shadow-offset-2 flex flex-col items-center justify-center gap-2">
                <Sparkles className="w-8 h-8 text-[#facc15]" />
                <h4 className="font-heading text-lg text-[#201e1d]">No questions match current filter</h4>
                <p className="text-xs text-[#645c50] font-bold">
                  Try clearing the search query or selecting a different filter chip.
                </p>
              </div>
            ) : (
              filteredResults.map((item) => {
                const statusBorder =
                  item.status === "valid"
                    ? "border-[#15803d]"
                    : item.status === "error"
                    ? "border-[#b91c1c]"
                    : "border-[#b45309]";

                return (
                  <div
                    key={item.index}
                    className="p-4 bg-white border-2 border-[#201e1d] rounded-2xl shadow-offset-2 flex flex-col gap-3 transition-all hover:translate-x-0.5"
                  >
                    {/* Top Row: Q# pill, badges, jump button */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {/* Q# Pill */}
                        <span className="w-8 h-8 rounded-xl bg-[#201e1d] text-white font-heading flex items-center justify-center text-sm">
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
                            <AlertCircle className="w-3.5 h-3.5" /> Error ({item.issues.filter((i) => i.type === "error").length})
                          </span>
                        )}
                        {item.status === "warning" && (
                          <span className="px-2.5 py-1 rounded-lg bg-[#fef3c7] border-2 border-[#b45309] text-[#b45309] text-xs font-black flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Warning ({item.issues.filter((i) => i.type === "warning").length})
                          </span>
                        )}

                        {/* Badges */}
                        {item.hasDiagram && (
                          <span className="px-2 py-0.5 rounded-md bg-[#dbeafe] border border-[#2563eb] text-[#2563eb] text-[10px] font-bold flex items-center gap-0.5">
                            <ImageIcon className="w-3 h-3" /> Diagram
                          </span>
                        )}
                        {item.hasExplanation && (
                          <span className="px-2 py-0.5 rounded-md bg-[#fef08a] border border-[#ca8a04] text-[#ca8a04] text-[10px] font-bold flex items-center gap-0.5">
                            <FileText className="w-3 h-3" /> Explanation
                          </span>
                        )}
                      </div>

                      {/* Jump to Question button */}
                      <button
                        onClick={() => {
                          onSelectQuestion(item.index);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-[#facc15] hover:bg-[#fde047] border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] shadow-offset-1 active:translate-y-0.5 active:shadow-none flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <span>Jump to Q{item.questionNumber}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Stem Snippet & Topic */}
                    <div className="text-xs text-[#201e1d]">
                      <span className="font-bold text-[#645c50]">Topic:</span>{" "}
                      <span className="font-semibold">{item.topicName}</span>
                      <p className="mt-1 text-neutral-700 italic line-clamp-2">
                        &quot;{item.stemSnippet}&quot;
                      </p>
                    </div>

                    {/* Issues List */}
                    {item.issues.length > 0 ? (
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-200">
                        {item.issues.map((issue, idx) => (
                          <div
                            key={idx}
                            className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                              issue.type === "error"
                                ? "bg-red-50 border-red-300 text-red-800"
                                : "bg-amber-50 border-amber-300 text-amber-800"
                            }`}
                          >
                            {issue.type === "error" ? (
                              <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            )}
                            <span className="leading-tight">{issue.message}</span>
                          </div>
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
        <div className="p-4 bg-[#f5ead8] border-t-2 border-[#201e1d] flex items-center justify-between gap-3 text-xs font-bold text-[#645c50]">
          <div>
            Showing {filteredResults.length} of {auditResults.length} questions
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-neutral-100 border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] shadow-offset-1 active:translate-y-0.5 active:shadow-none cursor-pointer"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
}

export { IngestionAuditDrawer };

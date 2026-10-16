"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { StagingQuestion, StagingPaper } from "@/types/ingestion";
import {
  Search,
  Plus,
  Camera,
  ChevronLeft,
  ChevronRight,
  X,
  FileQuestion,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  LayoutGrid,
  Rows,
} from "lucide-react";
import katex from "katex";

export interface IngestionQuestionNavProps {
  questions?: StagingQuestion[];
  selectedIdx: number;
  onSelectIdx?: (idx: number) => void;
  onAddQuestion?: () => void;
  onDuplicateQuestion?: (idx: number) => void;
  onDeleteQuestion?: (idx: number) => void;
  onMoveQuestion?: (fromIdx: number, toIdx: number) => void;
  syllabusTopics?: { name: string; order_index: number }[];
  expectedCount?: number;
  paper?: StagingPaper;
  onSelect?: (idx: number) => void;
  className?: string;
}

export type FilterTabMode = "all" | "valid" | "review" | "diagrams" | "errors";

export interface QuestionStatusItem {
  isValid: boolean;
  isError: boolean;
  isWarning: boolean;
  hasDiagram: boolean;
  hasExplanation: boolean;
  correctKey: string | null;
  errorMessages: string[];
  warningMessages: string[];
}

/**
 * Checks for KaTeX syntax error in string
 */
export function hasKaTeXSyntaxError(text: string): boolean {
  if (!text) return false;
  // Check display delimiters
  const displayMatches = text.match(/(?<!\\)\$\$/g) || [];
  if (displayMatches.length % 2 !== 0) return true;

  // Check inline math
  const inlineRegex = /(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;
  let match: RegExpExecArray | null;
  while ((match = inlineRegex.exec(text)) !== null) {
    const expr = match[1].trim();
    if (expr) {
      const openB = (expr.match(/(?<!\\)\{/g) || []).length;
      const closeB = (expr.match(/(?<!\\)\}/g) || []).length;
      if (openB !== closeB) return true;
      try {
        katex.renderToString(expr, { displayMode: false, throwOnError: true });
      } catch {
        return true;
      }
    }
  }
  return false;
}

/**
 * Question validation helper according to Cambridge ingestion rules:
 * - Non-empty stem markdown
 * - Exactly 4 options (A, B, C, D)
 * - Exactly 1 correct option marked
 * - All options have content
 * - Not marked as withdrawn
 */
export function getQuestionValidation(q?: StagingQuestion): {
  isValid: boolean;
  issues: string[];
} {
  if (!q) return { isValid: false, issues: ["Question object is missing"] };
  const issues: string[] = [];

  const stem = (q.stem_markdown || "").trim();
  if (!stem) {
    issues.push("Stem text is empty");
  }

  const options = q.options || [];
  if (options.length !== 4) {
    issues.push(`Requires 4 options (currently ${options.length})`);
  } else {
    const correctCount = options.filter((o) => o.is_correct).length;
    if (correctCount === 0) {
      issues.push("No correct option marked");
    } else if (correctCount > 1) {
      issues.push(`Multiple correct options marked (${correctCount})`);
    }

    const emptyOptions = options.filter(
      (o) => !(o.content_markdown || "").trim()
    );
    if (emptyOptions.length > 0) {
      issues.push(`${emptyOptions.length} option(s) blank`);
    }
  }

  if (q.status === "withdrawn") {
    issues.push("Marked as withdrawn");
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Checks if question contains diagram image
 */
export function hasDiagram(q?: StagingQuestion): boolean {
  if (!q) return false;
  return Boolean(
    q.diagram?.has_diagram === true ||
      (q.diagram?.image_url && q.diagram.image_url.trim().length > 0) ||
      (q.diagram?.storage_path && q.diagram.storage_path.trim().length > 0) ||
      (q.stem_markdown && q.stem_markdown.includes("!["))
  );
}

/**
 * Evaluates comprehensive status of question item:
 * - Green dot: Valid and complete
 * - Amber dot: Missing distractor explanation or warning
 * - Camera: Has diagram attached
 * - Red dot: Missing required option or syntax error
 */
export function evaluateQuestionStatus(q?: StagingQuestion): QuestionStatusItem {
  if (!q) {
    return {
      isValid: false,
      isError: true,
      isWarning: false,
      hasDiagram: false,
      hasExplanation: false,
      correctKey: null,
      errorMessages: ["No question data available"],
      warningMessages: [],
    };
  }

  const errorMessages: string[] = [];
  const warningMessages: string[] = [];

  const validation = getQuestionValidation(q);
  if (!validation.isValid) {
    errorMessages.push(...validation.issues);
  }

  if (hasKaTeXSyntaxError(q.stem_markdown || "")) {
    errorMessages.push("Stem contains KaTeX math syntax error");
  }

  const correctOption = q.options?.find((o) => o.is_correct);
  const correctKey = correctOption?.label || null;

  const expl = (q.explanation_markdown || "").trim();
  const hasExplanation = expl.length > 0;
  if (!hasExplanation && validation.isValid) {
    warningMessages.push("Missing derivation / explanation");
  }

  const diag = hasDiagram(q);

  const isError = errorMessages.length > 0;
  const isWarning = !isError && warningMessages.length > 0;
  const isValid = !isError && !isWarning;

  return {
    isValid,
    isError,
    isWarning,
    hasDiagram: diag,
    hasExplanation,
    correctKey,
    errorMessages,
    warningMessages,
  };
}

export function IngestionQuestionNav({
  questions: propQuestions,
  selectedIdx,
  onSelectIdx,
  onAddQuestion,
  onDuplicateQuestion: _onDuplicateQuestion,
  onDeleteQuestion: _onDeleteQuestion,
  onMoveQuestion: _onMoveQuestion,
  syllabusTopics: _propSyllabusTopics,
  expectedCount: _expectedCount = 40,
  paper,
  onSelect,
  className = "",
}: IngestionQuestionNavProps) {
  // Resolve questions & selection dispatcher
  const questions = propQuestions ?? paper?.questions ?? [];
  const totalQuestions = questions.length;

  const handleSelect = useCallback(
    (idx: number) => {
      if (totalQuestions <= 0) return;
      const clamped = Math.max(0, Math.min(totalQuestions - 1, idx));
      if (onSelectIdx) onSelectIdx(clamped);
      else if (onSelect) onSelect(clamped);
    },
    [onSelectIdx, onSelect, totalQuestions]
  );

  // Search, filter, and view mode states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTabMode>("all");
  const [viewMode, setViewMode] = useState<"strip" | "grid">("strip");

  // References for auto-scrolling
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const navScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active item into view horizontally
  useEffect(() => {
    if (viewMode === "strip") {
      const el = buttonRefs.current.get(selectedIdx);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }
  }, [selectedIdx, viewMode]);

  // Evaluate status map
  const questionStatuses = useMemo(() => {
    return questions.map((q) => evaluateQuestionStatus(q));
  }, [questions]);

  // Next Issue Quick-Jump: circularly search from (selectedIdx + 1) % totalQuestions
  const handleJumpNextIssue = useCallback(() => {
    if (totalQuestions <= 0) return;
    for (let offset = 1; offset <= totalQuestions; offset++) {
      const idx = (selectedIdx + offset) % totalQuestions;
      const status = questionStatuses[idx];
      const q = questions[idx];
      if (!status?.isValid || q?.status === "needs_review") {
        handleSelect(idx);
        break;
      }
    }
  }, [totalQuestions, selectedIdx, questionStatuses, questions, handleSelect]);

  // Global Keyboard Navigation: Left/Right arrow keys to cycle questions, Alt+N for Next Issue
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (totalQuestions <= 0) return;

      if (e.altKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        handleJumpNextIssue();
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSelect(selectedIdx - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSelect(selectedIdx + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIdx, totalQuestions, handleSelect, handleJumpNextIssue]);

  // Tab counts
  const validCount = useMemo(
    () => questionStatuses.filter((s) => s.isValid).length,
    [questionStatuses]
  );
  const reviewCount = useMemo(
    () => questionStatuses.filter((s) => s.isWarning).length,
    [questionStatuses]
  );
  const diagramCount = useMemo(
    () => questionStatuses.filter((s) => s.hasDiagram).length,
    [questionStatuses]
  );
  const errorCount = useMemo(
    () => questionStatuses.filter((s) => s.isError).length,
    [questionStatuses]
  );

  // Search & Filter evaluation per question
  const matchesSearchAndFilter = useCallback(
    (q: StagingQuestion, idx: number): boolean => {
      const status = questionStatuses[idx];

      // Filter tabs: 'all', 'valid', 'review', 'diagrams', 'errors'
      if (filterTab === "valid" && !status?.isValid) return false;
      if (filterTab === "review" && !status?.isWarning) return false;
      if (filterTab === "diagrams" && !status?.hasDiagram) return false;
      if (filterTab === "errors" && !status?.isError) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const qNumStr = `${q.question_number || idx + 1}`;
        const stem = (q.stem_markdown || "").toLowerCase();
        const ref = (q.cambridge_source_ref || "").toLowerCase();
        const topic = (q.topic_name || "").toLowerCase();
        const optionsMatch = q.options?.some((o) =>
          (o.content_markdown || "").toLowerCase().includes(query)
        );

        const matched =
          stem.includes(query) ||
          ref.includes(query) ||
          topic.includes(query) ||
          qNumStr === query ||
          Boolean(optionsMatch);

        if (!matched) return false;
      }

      return true;
    },
    [questionStatuses, filterTab, searchQuery]
  );

  const matchingIndices = useMemo(() => {
    const list: number[] = [];
    questions.forEach((q, idx) => {
      if (matchesSearchAndFilter(q, idx)) {
        list.push(idx);
      }
    });
    return list;
  }, [questions, matchesSearchAndFilter]);

  const hasActiveFilters = searchQuery.trim().length > 0 || filterTab !== "all";

  return (
    <nav
      aria-label="Question Navigation Toolbar & Strip"
      className={`w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3 sm:p-3.5 shadow-[2px_2px_0_#201e1d] flex flex-col gap-2.5 font-body text-[#201e1d] select-none ${className}`}
    >
      {/* Row 1: Filters (Left) + Search, Stepper, View Toggle & New (Right) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        {/* Left: Segmented Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {/* All Tab */}
          <button
            type="button"
            onClick={() => setFilterTab("all")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              filterTab === "all"
                ? "bg-[#201e1d] text-[#f9f4ed] border-[#201e1d] shadow-[1px_1px_0_#201e1d]"
                : "bg-white border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]"
            }`}
          >
            <span>All</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                filterTab === "all" ? "bg-white/20 text-[#f9f4ed]" : "bg-[#eee7db] text-[#474238]"
              }`}
            >
              {totalQuestions}
            </span>
          </button>

          {/* Valid Tab */}
          <button
            type="button"
            onClick={() => setFilterTab("valid")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              filterTab === "valid"
                ? "bg-[#728157] text-[#f9f4ed] border-[#56633f] shadow-[1px_1px_0_#201e1d]"
                : "bg-white border-[#dcd3c4] text-[#3d472b] hover:bg-[#f0fae1]"
            }`}
          >
            <CheckCircle2 className="w-3 h-3 text-[#56633f]" />
            <span>Valid</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                filterTab === "valid" ? "bg-white/20 text-[#f9f4ed]" : "bg-[#f0fae1] text-[#3d472b]"
              }`}
            >
              {validCount}
            </span>
          </button>

          {/* Needs Review Tab */}
          <button
            type="button"
            onClick={() => setFilterTab("review")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              filterTab === "review"
                ? "bg-[#c67139] text-[#f9f4ed] border-[#8c491a] shadow-[1px_1px_0_#201e1d]"
                : "bg-white border-[#dcd3c4] text-[#c67139] hover:bg-[#ffe1d0]"
            }`}
          >
            <AlertTriangle className="w-3 h-3 text-[#c67139]" />
            <span>Review</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                filterTab === "review" ? "bg-white/20 text-[#f9f4ed]" : "bg-[#ffe1d0] text-[#c67139]"
              }`}
            >
              {reviewCount}
            </span>
          </button>

          {/* Diagrams Tab */}
          <button
            type="button"
            onClick={() => setFilterTab("diagrams")}
            className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
              filterTab === "diagrams"
                ? "bg-[#645c50] text-[#f9f4ed] border-[#383431] shadow-[1px_1px_0_#201e1d]"
                : "bg-white border-[#dcd3c4] text-[#645c50] hover:bg-[#eee7db]"
            }`}
          >
            <Camera className="w-3 h-3 text-[#645c50]" />
            <span>Diagrams</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                filterTab === "diagrams" ? "bg-white/20 text-[#f9f4ed]" : "bg-[#eee7db] text-[#474238]"
              }`}
            >
              {diagramCount}
            </span>
          </button>

          {/* Errors Tab (if any) */}
          {errorCount > 0 && (
            <button
              type="button"
              onClick={() => setFilterTab("errors")}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                filterTab === "errors"
                  ? "bg-[#b91c1c] text-[#f9f4ed] border-[#7f1d1d] shadow-[1px_1px_0_#201e1d]"
                  : "bg-white border-[#b91c1c]/40 text-[#b91c1c] hover:bg-[#fee2e2]"
              }`}
            >
              <AlertCircle className="w-3 h-3 text-[#b91c1c]" />
              <span>Errors</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                  filterTab === "errors" ? "bg-white/20 text-[#f9f4ed]" : "bg-[#fee2e2] text-[#b91c1c]"
                }`}
              >
                {errorCount}
              </span>
            </button>
          )}

          {/* Next Issue (⚠) Quick-Jump Button */}
          {(reviewCount > 0 || errorCount > 0) && (
            <button
              type="button"
              onClick={handleJumpNextIssue}
              className="bg-[#fef3c7] hover:bg-[#fde68a] text-[#92400e] border-2 border-[#201e1d] rounded-full px-2.5 py-1 text-xs font-bold shadow-[1px_1px_0_#201e1d] active:translate-y-0.5 flex items-center gap-1 cursor-pointer transition-colors"
              title="Jump to next issue (Alt+N)"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-[#92400e]" />
              <span>Next Issue</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-[#fde68a] text-[#92400e] border border-[#d97706]/30">
                {reviewCount + errorCount}
              </span>
            </button>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterTab("all");
              }}
              className="text-xs font-bold text-[#c67139] hover:underline cursor-pointer ml-1"
            >
              Reset
            </button>
          )}
        </div>

        {/* Right: Quick Search + Stepper + View Mode Toggle + Add Question */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Keyboard Shortcut Hint */}
          <span
            className="text-[10px] font-mono text-[#82796a] hidden xl:inline-flex items-center gap-1 bg-white/70 border border-[#dcd3c4] px-2.5 py-1 rounded-full select-none"
            title="Keyboard shortcuts: Left/Right arrows to navigate questions, Alt+N to jump to next issue"
          >
            ←/→ Nav · Alt+N Next Issue
          </span>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#82796a] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find Q..."
              className="pl-7 pr-6 py-1 rounded-full bg-white border-2 border-[#dcd3c4] text-xs text-[#201e1d] placeholder-[#82796a] outline-none focus:border-[#c67139] w-24 sm:w-28 transition-all font-mono"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#82796a] hover:text-[#201e1d]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Stepper Controls */}
          <div className="flex items-center border-2 border-[#201e1d] rounded-full bg-white px-1 py-0.5 shadow-[1.5px_1.5px_0_#201e1d]">
            <button
              type="button"
              onClick={() => handleSelect(selectedIdx - 1)}
              disabled={selectedIdx <= 0}
              className="p-1 rounded-full hover:bg-[#eee7db] text-[#201e1d] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous question (←)"
              aria-label="Previous question"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-adminHeading font-bold text-[#201e1d] px-2 min-w-[70px] text-center font-mono">
              {totalQuestions > 0 ? `Q${selectedIdx + 1} / ${totalQuestions}` : "—"}
            </span>
            <button
              type="button"
              onClick={() => handleSelect(selectedIdx + 1)}
              disabled={selectedIdx >= totalQuestions - 1}
              className="p-1 rounded-full hover:bg-[#eee7db] text-[#201e1d] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next question (→)"
              aria-label="Next question"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* View Mode Toggle: Strip vs Grid Matrix */}
          <div className="flex items-center border-2 border-[#201e1d] rounded-full bg-white overflow-hidden shadow-[1.5px_1.5px_0_#201e1d]">
            <button
              type="button"
              onClick={() => setViewMode("strip")}
              className={`p-1.5 transition-colors cursor-pointer ${
                viewMode === "strip"
                  ? "bg-[#201e1d] text-[#f9f4ed]"
                  : "bg-white text-[#645c50] hover:bg-[#eee7db]"
              }`}
              title="Strip view (horizontal scroll)"
              aria-label="Strip view"
            >
              <Rows className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 transition-colors cursor-pointer ${
                viewMode === "grid"
                  ? "bg-[#201e1d] text-[#f9f4ed]"
                  : "bg-white text-[#645c50] hover:bg-[#eee7db]"
              }`}
              title="Grid matrix view (all questions)"
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Add Question Button */}
          {onAddQuestion && (
            <button
              type="button"
              onClick={onAddQuestion}
              className="px-3 py-1.5 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-adminHeading font-bold hover:bg-[#b2622d] transition-all flex items-center gap-1 shadow-[1.5px_1.5px_0_#201e1d] border-2 border-[#201e1d] active:translate-y-0.5 cursor-pointer"
              title="Add a new blank question"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Question Navigator (Strip View or Grid Matrix) */}
      {totalQuestions === 0 ? (
        <div className="p-4 text-center border-2 border-dashed border-[#dcd3c4] rounded-xl bg-white flex items-center justify-center gap-2">
          <FileQuestion className="w-5 h-5 text-[#82796a]" />
          <p className="text-xs font-bold text-[#645c50]">No questions staged in this paper.</p>
        </div>
      ) : viewMode === "grid" ? (
        /* Full Grid Matrix Mode: see all questions at a glance */
        <div className="flex flex-col gap-2 p-3 bg-white border-2 border-[#201e1d] rounded-xl shadow-inner">
          {/* Grid Mode Ergonomics Header Bar */}
          <div className="flex items-center justify-between gap-2 px-1 pb-2 border-b border-[#dcd3c4] flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-adminHeading font-bold text-xs text-[#201e1d]">
                Question Matrix ({matchingIndices.length}/{totalQuestions})
              </span>
              {/* Status legend pills */}
              <div className="hidden sm:flex items-center gap-2.5 text-[10px] font-mono text-[#645c50]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#728157]" /> Valid
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#c67139]" /> Review
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#b91c1c]" /> Error
                </span>
                <span className="flex items-center gap-1">
                  <Camera className="w-2.5 h-2.5 text-[#645c50]" /> Diagram
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewMode("strip")}
              className="px-2.5 py-1 rounded-full border border-[#201e1d] bg-[#f9f4ed] hover:bg-[#ffe1d0] hover:text-[#c67139] text-[11px] font-bold text-[#201e1d] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:translate-y-0.5"
              title="Collapse grid drawer and switch to strip view"
            >
              <Rows className="w-3 h-3 text-[#c67139]" />
              <span>Collapse Grid</span>
            </button>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
            {questions.map((q, idx) => {
              const status = questionStatuses[idx];
              const isSelected = selectedIdx === idx;
              const isMatch = matchingIndices.includes(idx);
              const qNum = q.question_number || idx + 1;

              return (
                <button
                  key={`q-grid-${idx}-${qNum}`}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  aria-pressed={isSelected}
                  title={`Question ${qNum}${
                    status.isValid
                      ? " (Valid)"
                      : status.isError
                      ? ` (Error: ${status.errorMessages.join(", ")})`
                      : ` (Needs Review: ${status.warningMessages.join(", ")})`
                  }${status.hasDiagram ? " · Has Diagram" : ""}${
                    status.correctKey ? ` · Key ${status.correctKey}` : ""
                  }`}
                  className={`relative rounded-lg p-1.5 transition-all flex flex-col items-center justify-center cursor-pointer select-none ${
                    isSelected
                      ? "bg-[#ffe1d0] border-2 border-[#c67139] text-[#201e1d] shadow-[2px_2px_0_#c67139] font-bold scale-[1.04] z-10"
                      : "bg-[#fcfaf6] border border-[#dcd3c4] hover:border-[#201e1d] hover:bg-[#eee7db] text-[#474238]"
                  } ${!isMatch && hasActiveFilters ? "opacity-30 grayscale" : "opacity-100"}`}
                >
                  <div className="w-full flex items-center justify-between gap-1 leading-none mb-0.5">
                    {status.hasDiagram ? (
                      <Camera className="w-2.5 h-2.5 text-[#645c50]" />
                    ) : (
                      <span className="w-2.5 h-2.5" />
                    )}
                    {status.isError ? (
                      <span className="w-2 h-2 rounded-full bg-[#b91c1c]" />
                    ) : status.isWarning ? (
                      <span className="w-2 h-2 rounded-full bg-[#c67139]" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#728157]" />
                    )}
                  </div>
                  <span className="text-xs font-adminHeading font-bold text-[#201e1d] leading-tight">
                    {qNum}
                  </span>
                  <span className="text-[9px] font-mono font-bold uppercase text-[#645c50] leading-none mt-0.5">
                    {status.correctKey ? status.correctKey : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Strip View Mode: Sleek horizontal scroll strip */
        <div
          ref={navScrollRef}
          className="flex items-center gap-1.5 overflow-x-auto py-1 px-0.5 scrollbar-thin scrollbar-thumb-[#dcd3c4] scrollbar-track-transparent"
        >
          {questions.map((q, idx) => {
            const status = questionStatuses[idx];
            const isSelected = selectedIdx === idx;
            const isMatch = matchingIndices.includes(idx);
            const qNum = q.question_number || idx + 1;

            return (
              <button
                key={`q-chip-${idx}-${qNum}`}
                ref={(el) => {
                  if (el) buttonRefs.current.set(idx, el);
                  else buttonRefs.current.delete(idx);
                }}
                type="button"
                onClick={() => handleSelect(idx)}
                aria-pressed={isSelected}
                title={`Question ${qNum}${
                  status.isValid
                    ? " (Valid)"
                    : status.isError
                    ? ` (Error: ${status.errorMessages.join(", ")})`
                    : ` (Needs Review: ${status.warningMessages.join(", ")})`
                }${status.hasDiagram ? " · Has Diagram" : ""}${
                  status.correctKey ? ` · Key ${status.correctKey}` : ""
                }`}
                className={`relative shrink-0 min-w-[54px] h-12 rounded-xl transition-all flex flex-col items-center justify-center px-2 py-1 select-none cursor-pointer ${
                  isSelected
                    ? "bg-[#ffe1d0] border-2 border-[#c67139] text-[#201e1d] font-bold shadow-[2px_2px_0_#c67139] scale-[1.02] z-10"
                    : "bg-white border-2 border-[#dcd3c4] hover:border-[#201e1d] hover:bg-[#eee7db] text-[#474238]"
                } ${
                  !isMatch && hasActiveFilters
                    ? "opacity-30 grayscale"
                    : "opacity-100"
                }`}
              >
                {/* Top: Status indicator & Diagram icon */}
                <div className="w-full flex items-center justify-between gap-1 leading-none">
                  {status.hasDiagram ? (
                    <Camera className="w-2.5 h-2.5 text-[#645c50]" />
                  ) : (
                    <span className="w-2.5 h-2.5" />
                  )}

                  {/* Dot */}
                  {status.isError ? (
                    <span className="w-2 h-2 rounded-full bg-[#b91c1c]" />
                  ) : status.isWarning ? (
                    <span className="w-2 h-2 rounded-full bg-[#c67139]" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-[#728157]" />
                  )}
                </div>

                {/* Question Number */}
                <span className="text-xs font-adminHeading font-bold leading-tight text-[#201e1d]">
                  {qNum}
                </span>

                {/* Key Badge */}
                <span className="text-[9px] font-mono font-bold uppercase text-[#645c50] leading-none">
                  {status.correctKey ? status.correctKey : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}

export default IngestionQuestionNav;

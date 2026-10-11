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
  Layers,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  LayoutGrid,
  List,
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
function hasKaTeXSyntaxError(text: string): boolean {
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
 * - Green check: Valid and complete
 * - Amber alert: Missing distractor explanation or warning
 * - Purple camera: Has diagram attached
 * - Red badge: Missing required option or syntax error
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
      errorMessages: ["Question data missing"],
      warningMessages: [],
    };
  }

  const errorMessages: string[] = [];
  const warningMessages: string[] = [];

  // Stem validation
  const stem = (q.stem_markdown || "").trim();
  if (!stem) {
    errorMessages.push("Question stem is empty");
  } else if (stem.length < 5) {
    errorMessages.push("Question stem is too short (< 5 chars)");
  } else if (hasKaTeXSyntaxError(stem)) {
    errorMessages.push("KaTeX syntax error in stem");
  }

  // Options validation
  const options = q.options || [];
  if (options.length !== 4) {
    errorMessages.push(`Requires 4 options A, B, C, D (found ${options.length})`);
  } else {
    const correctCount = options.filter((o) => o.is_correct).length;
    if (correctCount === 0) {
      errorMessages.push("Missing correct option: No option marked correct");
    } else if (correctCount > 1) {
      errorMessages.push(`Multiple correct options marked (${correctCount})`);
    }

    const emptyOptions = options.filter((o) => !(o.content_markdown || "").trim());
    if (emptyOptions.length > 0) {
      errorMessages.push(`${emptyOptions.length} option(s) blank`);
    }

    // KaTeX check in options
    options.forEach((opt) => {
      if (hasKaTeXSyntaxError(opt.content_markdown || "")) {
        errorMessages.push(`KaTeX syntax error in Option ${opt.label}`);
      }
    });
  }

  if (q.status === "withdrawn") {
    errorMessages.push("Question is withdrawn");
  }

  // Topic validation
  const topic = (q.topic_name || "").trim();
  if (!topic || topic.toLowerCase() === "unassigned" || topic.toLowerCase() === "none") {
    warningMessages.push("No syllabus topic assigned");
  }

  // Diagram validation
  const isDiagram = Boolean(
    q.diagram?.has_diagram === true ||
      (q.diagram?.image_url && q.diagram.image_url.trim().length > 0) ||
      (q.diagram?.storage_path && q.diagram.storage_path.trim().length > 0) ||
      (q.stem_markdown && q.stem_markdown.includes("!["))
  );

  if (q.diagram?.has_diagram && (!q.diagram?.image_url || !q.diagram.image_url.trim())) {
    warningMessages.push("Diagram flagged without image URL");
  }

  // Explanation validation
  const hasExplanation = Boolean(
    q.explanation_markdown && q.explanation_markdown.trim().length > 0
  );
  if (!hasExplanation) {
    warningMessages.push("Missing distractor explanation or derivation");
  } else if (hasKaTeXSyntaxError(q.explanation_markdown || "")) {
    errorMessages.push("KaTeX syntax error in explanation");
  }

  const correctOpt = options.find((o) => o.is_correct);
  const isError = errorMessages.length > 0;
  const isWarning = !isError && warningMessages.length > 0;
  const isValid = !isError && !isWarning;

  return {
    isValid,
    isError,
    isWarning,
    hasDiagram: isDiagram,
    hasExplanation,
    correctKey: correctOpt?.label || null,
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
  expectedCount = 40,
  paper,
  onSelect,
  className = "",
}: IngestionQuestionNavProps) {
  // Resolve questions & selection dispatcher
  const questions = propQuestions ?? paper?.questions ?? [];
  const totalQuestions = questions.length;
  const effectiveExpected = expectedCount || 40;

  const handleSelect = useCallback(
    (idx: number) => {
      if (totalQuestions <= 0) return;
      const clamped = Math.max(0, Math.min(totalQuestions - 1, idx));
      if (onSelectIdx) onSelectIdx(clamped);
      else if (onSelect) onSelect(clamped);
    },
    [onSelectIdx, onSelect, totalQuestions]
  );

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<FilterTabMode>("all");
  const [viewLayout, setViewLayout] = useState<"grid" | "list">("grid");

  // References for keyboard navigation and auto-scrolling
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const navContainerRef = useRef<HTMLElement>(null);

  // Auto-scroll active item into view
  useEffect(() => {
    const el = buttonRefs.current.get(selectedIdx);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [selectedIdx]);

  // Global Keyboard Navigation: Left/Right arrow keys to cycle questions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing inside an input, textarea, or contentEditable
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

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSelect(selectedIdx - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSelect(selectedIdx + 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        handleSelect(0);
      } else if (e.key === "End") {
        e.preventDefault();
        handleSelect(totalQuestions - 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIdx, totalQuestions, handleSelect]);

  // Evaluate status map
  const questionStatuses = useMemo(() => {
    return questions.map((q) => evaluateQuestionStatus(q));
  }, [questions]);

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

      // Filter tabs: 'All', 'Valid', 'Needs Review', 'Has Diagram', 'Errors'
      if (filterTab === "valid" && !status.isValid) return false;
      if (filterTab === "review" && !status.isWarning) return false;
      if (filterTab === "diagrams" && !status.hasDiagram) return false;
      if (filterTab === "errors" && !status.isError) return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const qNumStr = `${q.question_number || idx + 1}`;
        const qPrefixed = `q${qNumStr}`.toLowerCase();
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
          qPrefixed === query ||
          Boolean(optionsMatch);

        if (!matched) return false;
      }

      return true;
    },
    [filterTab, searchQuery, questionStatuses]
  );

  // Filtered indices
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

  const progressPct =
    effectiveExpected > 0
      ? Math.min(100, Math.round((totalQuestions / effectiveExpected) * 100))
      : 100;

  return (
    <nav
      ref={navContainerRef}
      aria-label="Question Navigation"
      className={`bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col gap-3 font-body text-[#201e1d] select-none ${className}`}
    >
      {/* =========================================================================
          1. HEADER & OVERVIEW
         ========================================================================= */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1.5 bg-[#ffe1d0] text-[#c67139] rounded-xl shrink-0">
              <Layers className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h2 className="font-heading text-sm font-black tracking-tight leading-none text-[#201e1d] truncate">
                Questions
              </h2>
              <p className="text-[11px] font-medium text-[#645c50] mt-0.5 truncate">
                {totalQuestions} of {effectiveExpected} staged · {validCount} valid
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onAddQuestion && (
              <button
                type="button"
                onClick={onAddQuestion}
                className="px-3 py-1.5 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-bold hover:bg-[#b2622d] transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
                title="Add new question"
                aria-label="Add question"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#eee7db] h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[#c67139] h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* =========================================================================
          2. SEARCH INPUT
         ========================================================================= */}
      <div className="relative w-full">
        <Search className="w-3.5 h-3.5 text-[#82796a] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search stems, IDs, citations..."
          className="w-full pl-9 pr-7 py-1.5 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#c0b6a5] text-xs text-[#201e1d] placeholder-[#82796a] outline-none focus:border-[#c67139] transition-all"
          aria-label="Search questions"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#82796a] hover:text-[#201e1d] p-0.5 rounded cursor-pointer transition-colors"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* =========================================================================
          3. FILTER PILLS ('All', 'Valid', 'Needs Review', 'Has Diagram', 'Errors')
         ========================================================================= */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {/* All Tab */}
        <button
          type="button"
          onClick={() => setFilterTab("all")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            filterTab === "all"
              ? "bg-[#ffe1d0] text-[#201e1d] font-bold"
              : "text-[#645c50] hover:bg-[#eee7db]"
          }`}
        >
          <span>All</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filterTab === "all"
                ? "bg-[#c67139] text-[#f9f4ed]"
                : "bg-[#c0b6a5]/50 text-[#201e1d]"
            }`}
          >
            {totalQuestions}
          </span>
        </button>

        {/* Valid Tab */}
        <button
          type="button"
          onClick={() => setFilterTab("valid")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            filterTab === "valid"
              ? "bg-[#f0fae1] text-[#3d472b] border border-[#728157]/40 font-bold"
              : "text-[#645c50] hover:bg-[#eee7db]"
          }`}
        >
          <CheckCircle2 className="w-3 h-3 text-[#728157]" />
          <span>Valid</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filterTab === "valid"
                ? "bg-[#728157] text-[#f9f4ed]"
                : "bg-[#f0fae1] text-[#3d472b]"
            }`}
          >
            {validCount}
          </span>
        </button>

        {/* Needs Review Tab */}
        <button
          type="button"
          onClick={() => setFilterTab("review")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            filterTab === "review"
              ? "bg-[#fef3c7] text-[#92400e] border border-[#f59e0b]/40 font-bold"
              : "text-[#645c50] hover:bg-[#eee7db]"
          }`}
        >
          <AlertTriangle className="w-3 h-3 text-[#c67139]" />
          <span>Review</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filterTab === "review"
                ? "bg-[#c67139] text-[#f9f4ed]"
                : "bg-[#fef3c7] text-[#92400e]"
            }`}
          >
            {reviewCount}
          </span>
        </button>

        {/* Has Diagram Tab */}
        <button
          type="button"
          onClick={() => setFilterTab("diagrams")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            filterTab === "diagrams"
              ? "bg-[#eee7db] text-[#201e1d] border border-[#c0b6a5] font-bold"
              : "text-[#645c50] hover:bg-[#eee7db]"
          }`}
        >
          <Camera className="w-3 h-3 text-[#645c50]" />
          <span>Diagrams</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filterTab === "diagrams"
                ? "bg-[#645c50] text-[#f9f4ed]"
                : "bg-[#eee7db] text-[#474238]"
            }`}
          >
            {diagramCount}
          </span>
        </button>

        {/* Errors Tab */}
        <button
          type="button"
          onClick={() => setFilterTab("errors")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
            filterTab === "errors"
              ? "bg-[#fee2e2] text-[#991b1b] border border-[#ef4444]/40 font-bold"
              : "text-[#645c50] hover:bg-[#eee7db]"
          }`}
        >
          <AlertCircle className="w-3 h-3 text-[#b91c1c]" />
          <span>Errors</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              filterTab === "errors"
                ? "bg-[#b91c1c] text-[#f9f4ed]"
                : "bg-[#fee2e2] text-[#991b1b]"
            }`}
          >
            {errorCount}
          </span>
        </button>

        {/* Reset Action */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFilterTab("all");
            }}
            className="ml-auto text-[11px] font-bold text-[#c67139] hover:underline cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* =========================================================================
          4. QUESTION NAVIGATION STEPPER & LAYOUT CONTROLS
         ========================================================================= */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#dcd3c4]">
          {/* Stepper Buttons & Counter */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSelect(selectedIdx - 1)}
              disabled={selectedIdx <= 0}
              className="p-1 rounded-full border border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] text-[#201e1d] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Previous question (Arrow Left/Up)"
              aria-label="Previous question"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-bold text-[#201e1d] min-w-[32px] text-center">
              {totalQuestions > 0 ? `Q${selectedIdx + 1}` : "—"}
            </span>
            <button
              type="button"
              onClick={() => handleSelect(selectedIdx + 1)}
              disabled={selectedIdx >= totalQuestions - 1}
              className="p-1 rounded-full border border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] text-[#201e1d] disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Next question (Arrow Right/Down)"
              aria-label="Next question"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-[#82796a] hidden sm:inline-flex items-center gap-1 ml-1">
              <kbd className="font-mono bg-[#eee7db] text-[#474238] px-1 py-0.5 rounded text-[10px] border border-[#dcd3c4]">←</kbd>
              <kbd className="font-mono bg-[#eee7db] text-[#474238] px-1 py-0.5 rounded text-[10px] border border-[#dcd3c4]">→</kbd>
            </span>
          </div>

          {/* Layout Toggle (Grid / List) */}
          <div className="flex items-center border border-[#dcd3c4] rounded-full bg-[#f9f4ed] p-0.5 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewLayout("grid")}
              title="Grid View"
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                viewLayout === "grid"
                  ? "bg-[#201e1d] text-[#f9f4ed]"
                  : "text-[#645c50] hover:bg-[#eee7db]"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout("list")}
              title="List View"
              className={`p-1 rounded-full transition-colors cursor-pointer ${
                viewLayout === "list"
                  ? "bg-[#201e1d] text-[#f9f4ed]"
                  : "text-[#645c50] hover:bg-[#eee7db]"
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {totalQuestions === 0 ? (
          <div className="p-6 text-center border-[1.5px] border-dashed border-[#dcd3c4] rounded-2xl bg-white/60 flex flex-col items-center gap-2">
            <FileQuestion className="w-7 h-7 text-[#82796a]" />
            <p className="text-xs font-bold text-[#645c50]">
              No questions found. Add your first question below.
            </p>
          </div>
        ) : viewLayout === "grid" ? (
          /* =========================================================================
              GRID VIEW: Clean Organic Tiles
             ========================================================================= */
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-[420px] overflow-y-auto pr-1 py-1">
            {questions.map((q, idx) => {
              const status = questionStatuses[idx];
              const isSelected = selectedIdx === idx;
              const isMatch = matchingIndices.includes(idx);
              const qNum = q.question_number || idx + 1;

              return (
                <button
                  key={`q-card-${idx}-${qNum}`}
                  ref={(el) => {
                    if (el) buttonRefs.current.set(idx, el);
                    else buttonRefs.current.delete(idx);
                  }}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  aria-pressed={isSelected}
                  title={`Question ${qNum}${
                    status.isValid
                      ? " (Valid & Complete)"
                      : status.isError
                      ? ` (Error: ${status.errorMessages.join(", ")})`
                      : ` (Warning: ${status.warningMessages.join(", ")})`
                  }${status.hasDiagram ? " · Has Diagram" : ""}${
                    status.correctKey ? ` · Key: ${status.correctKey}` : ""
                  }`}
                  className={`relative h-13 rounded-xl transition-all flex flex-col items-center justify-between p-1.5 select-none cursor-pointer ${
                    isSelected
                      ? "bg-[#ffe1d0] border-[1.5px] border-[#c67139] text-[#201e1d] font-bold shadow-xs scale-[1.02] z-10"
                      : "bg-white/80 border border-[#dcd3c4] hover:bg-[#eee7db] text-[#474238]"
                  } ${
                    !isMatch && hasActiveFilters
                      ? "opacity-30 grayscale"
                      : "opacity-100"
                  }`}
                >
                  {/* Top Indicators Row */}
                  <div className="w-full flex items-center justify-between px-0.5">
                    {status.hasDiagram ? (
                      <span
                        className="p-0.5 rounded text-[#645c50]"
                        title="Has diagram attached"
                      >
                        <Camera className="w-2.5 h-2.5" />
                      </span>
                    ) : (
                      <span className="w-2.5 h-2.5" />
                    )}

                    {/* Subtle status indicator dot */}
                    {status.isError ? (
                      <span
                        className="w-2 h-2 rounded-full bg-[#b91c1c]"
                        title={`Error: ${status.errorMessages.join("; ")}`}
                      />
                    ) : status.isWarning ? (
                      <span
                        className="w-2 h-2 rounded-full bg-[#c67139]"
                        title={`Review: ${status.warningMessages.join("; ")}`}
                      />
                    ) : (
                      <span
                        className="w-2 h-2 rounded-full bg-[#728157]"
                        title="Valid & Complete"
                      />
                    )}
                  </div>

                  {/* Question Number */}
                  <span className="text-xs sm:text-sm font-bold text-[#201e1d] leading-none">
                    {qNum}
                  </span>

                  {/* Option Key Pill at Bottom */}
                  <span className="text-[9px] font-semibold uppercase text-[#645c50] leading-tight">
                    {status.correctKey || "—"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* =========================================================================
              LIST VIEW: Clean Diagnostic Rows
             ========================================================================= */
          <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1 py-1">
            {questions.map((q, idx) => {
              const status = questionStatuses[idx];
              const isSelected = selectedIdx === idx;
              const isMatch = matchingIndices.includes(idx);
              const qNum = q.question_number || idx + 1;
              const stemExcerpt = (q.stem_markdown || "")
                .replace(/!\[.*?\]\(.*?\)/g, "")
                .replace(/[#*`_$\\]/g, "")
                .trim();
              const displayStem = stemExcerpt || q.topic_name || "Untitled Question";
              const citation = q.cambridge_source_ref || q.topic_name || `Question ${qNum}`;

              return (
                <button
                  key={`q-list-${idx}-${qNum}`}
                  ref={(el) => {
                    if (el) buttonRefs.current.set(idx, el);
                    else buttonRefs.current.delete(idx);
                  }}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  className={`w-full text-left p-2.5 transition-all flex items-center justify-between gap-2.5 cursor-pointer rounded-xl ${
                    isSelected
                      ? "bg-[#ffe1d0] border-[1.5px] border-[#c67139] text-[#201e1d] font-bold shadow-xs"
                      : "bg-white/80 border border-[#dcd3c4] hover:bg-[#eee7db] text-[#474238]"
                  } ${
                    !isMatch && hasActiveFilters
                      ? "opacity-30 grayscale"
                      : "opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-[#c67139] text-[#f9f4ed]"
                          : "bg-[#eee7db] text-[#201e1d]"
                      }`}
                    >
                      Q{qNum}
                    </span>

                    <div className="min-w-0 flex flex-col">
                      <span
                        className={`text-xs truncate ${
                          isSelected ? "text-[#201e1d] font-bold" : "text-[#201e1d] font-semibold"
                        }`}
                      >
                        {displayStem}
                      </span>
                      <div className="text-[11px] text-[#645c50] truncate flex items-center gap-1.5 mt-0.5">
                        <span className="truncate">{citation}</span>
                        <span>·</span>
                        <span className="font-mono text-[10px] shrink-0 font-bold">
                          {status.correctKey ? `Key ${status.correctKey}` : "No key"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Indicators */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {status.hasDiagram && (
                      <span
                        className="p-1 rounded-md bg-[#eee7db] text-[#645c50]"
                        title="Has diagram attached"
                      >
                        <Camera className="w-3 h-3" />
                      </span>
                    )}

                    {status.isError ? (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-[#b91c1c]"
                        title={`Error: ${status.errorMessages.join("; ")}`}
                      />
                    ) : status.isWarning ? (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-[#c67139]"
                        title={`Review: ${status.warningMessages.join("; ")}`}
                      />
                    ) : (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-[#728157]"
                        title="Valid & Complete"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          5. ADD QUESTION ACTION
         ========================================================================= */}
      {onAddQuestion && (
        <div className="pt-2 border-t border-[#dcd3c4] mt-auto">
          <button
            type="button"
            onClick={onAddQuestion}
            className="w-full py-2 px-3 bg-[#f9f4ed] hover:bg-[#eee7db] border-[1.5px] border-[#c0b6a5] text-[#201e1d] rounded-full text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Add question to paper"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Question</span>
          </button>
        </div>
      )}
    </nav>
  );
}

export default IngestionQuestionNav;

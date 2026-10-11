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
      aria-label="Question Navigation Matrix"
      className={`bg-[#f9f4ed] border-2 border-b-4 border-slate-800 rounded-2xl p-4 shadow-chunky flex flex-col gap-3.5 w-full text-slate-800 font-body select-none ${className}`}
    >
      {/* =========================================================================
          1. HEADER & OVERVIEW
         ========================================================================= */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-brand-yellow border-2 border-slate-800 rounded-xl shadow-xs">
              <Layers className="w-4 h-4 text-slate-900" />
            </span>
            <div>
              <h2 className="font-heading text-sm font-black tracking-tight leading-none text-slate-800">
                Question Matrix
              </h2>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                {totalQuestions} of {effectiveExpected} Questions Staged
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-lg border-2 border-slate-800 text-[11px] font-black shadow-xs ${
                errorCount === 0 && validCount === totalQuestions && totalQuestions > 0
                  ? "bg-[#dcfce7] text-emerald-800"
                  : errorCount > 0
                  ? "bg-[#fee2e2] text-rose-800"
                  : "bg-[#fef3c7] text-amber-800"
              }`}
            >
              {validCount}/{totalQuestions} Valid
            </span>

            {/* Layout Toggle (Grid / List) */}
            <div className="flex items-center border-2 border-slate-800 rounded-lg bg-white overflow-hidden shadow-xs">
              <button
                type="button"
                onClick={() => setViewLayout("grid")}
                title="Grid View"
                className={`p-1 transition-colors cursor-pointer ${
                  viewLayout === "grid" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-neutral-100"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewLayout("list")}
                title="List View"
                className={`p-1 transition-colors cursor-pointer ${
                  viewLayout === "list" ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-neutral-100"
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#eee7db] h-2 rounded-full border-2 border-slate-800 overflow-hidden p-0.5">
          <div
            className="bg-brand-yellow h-full rounded-full transition-all duration-300 border border-slate-800"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* =========================================================================
          2. SEARCH INPUT
         ========================================================================= */}
      <div className="relative w-full">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search questions (e.g. Q1, elasticity, topic)..."
          className="w-full bg-white border-2 border-slate-800 rounded-xl pl-8 pr-7 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow transition-all"
          aria-label="Search questions"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-800 p-0.5 rounded cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* =========================================================================
          3. TACTILE FILTER TABS ('All', 'Valid', 'Needs Review', 'Has Diagram', 'Errors')
         ========================================================================= */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {/* All Tab */}
        <button
          type="button"
          onClick={() => setFilterTab("all")}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all border-2 border-b-4 border-slate-800 active:translate-y-0.5 active:border-b-2 active:shadow-none cursor-pointer ${
            filterTab === "all"
              ? "bg-slate-800 text-white shadow-chunky"
              : "bg-white text-slate-800 hover:bg-neutral-100"
          }`}
        >
          All ({totalQuestions})
        </button>

        {/* Valid Tab */}
        <button
          type="button"
          onClick={() => setFilterTab("valid")}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all border-2 border-b-4 border-slate-800 active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1 cursor-pointer ${
            filterTab === "valid"
              ? "bg-[#15803d] text-white shadow-chunky"
              : "bg-[#f0fae1] text-[#15803d] hover:bg-green-200"
          }`}
        >
          <CheckCircle2 className="w-3 h-3 text-current" />
          <span>Valid ({validCount})</span>
        </button>

        {/* Needs Review Tab */}
        <button
          type="button"
          onClick={() => setFilterTab("review")}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all border-2 border-b-4 border-slate-800 active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1 cursor-pointer ${
            filterTab === "review"
              ? "bg-[#b45309] text-white shadow-chunky"
              : "bg-[#fef3c7] text-[#b45309] hover:bg-amber-200"
          }`}
        >
          <AlertTriangle className="w-3 h-3 text-current" />
          <span>Needs Review ({reviewCount})</span>
        </button>

        {/* Has Diagram Tab */}
        <button
          type="button"
          onClick={() => setFilterTab("diagrams")}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all border-2 border-b-4 border-slate-800 active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1 cursor-pointer ${
            filterTab === "diagrams"
              ? "bg-[#7c3aed] text-white shadow-chunky"
              : "bg-purple-100 text-[#7c3aed] hover:bg-purple-200"
          }`}
        >
          <Camera className="w-3 h-3 text-current" />
          <span>Has Diagram ({diagramCount})</span>
        </button>

        {/* Errors Tab */}
        <button
          type="button"
          onClick={() => setFilterTab("errors")}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-black transition-all border-2 border-b-4 border-slate-800 active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1 cursor-pointer ${
            filterTab === "errors"
              ? "bg-[#b91c1c] text-white shadow-chunky"
              : "bg-[#fee2e2] text-[#b91c1c] hover:bg-red-200"
          }`}
        >
          <AlertCircle className="w-3 h-3 text-current" />
          <span>Errors ({errorCount})</span>
        </button>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFilterTab("all");
            }}
            className="ml-auto text-[10px] font-black text-slate-500 hover:text-slate-900 underline cursor-pointer"
          >
            Reset
          </button>
        )}
      </div>

      {/* =========================================================================
          4. QUESTION NAVIGATION (GRID / LIST) WITH VISUAL STATUS INDICATORS
         ========================================================================= */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
            Questions ({totalQuestions > 0 ? `1–${totalQuestions}` : 0}) · <kbd className="font-mono bg-white px-1 py-0.5 border border-slate-300 rounded text-[10px]">←</kbd> <kbd className="font-mono bg-white px-1 py-0.5 border border-slate-300 rounded text-[10px]">→</kbd>
          </span>

          {/* Stepper Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSelect(selectedIdx - 1)}
              disabled={selectedIdx <= 0}
              className="p-1 rounded-xl border-2 border-b-4 border-slate-800 bg-white text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-100 shadow-xs active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer"
              title="Previous question (Arrow Left)"
              aria-label="Previous question"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-black text-slate-900 px-1 min-w-[34px] text-center">
              {totalQuestions > 0 ? `Q${selectedIdx + 1}` : "—"}
            </span>
            <button
              type="button"
              onClick={() => handleSelect(selectedIdx + 1)}
              disabled={selectedIdx >= totalQuestions - 1}
              className="p-1 rounded-xl border-2 border-b-4 border-slate-800 bg-white text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-amber-100 shadow-xs active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer"
              title="Next question (Arrow Right)"
              aria-label="Next question"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {totalQuestions === 0 ? (
          <div className="p-6 text-center border-2 border-dashed border-slate-800 rounded-2xl bg-white/60 flex flex-col items-center gap-1.5">
            <FileQuestion className="w-7 h-7 text-slate-400" />
            <p className="text-xs font-bold text-slate-600">
              No questions found. Add your first question below.
            </p>
          </div>
        ) : viewLayout === "grid" ? (
          /* =========================================================================
              GRID VIEW: Tactile Neobrutalist Cards
             ========================================================================= */
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-[380px] overflow-y-auto pr-1 py-1">
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
                  className={`relative h-13 rounded-2xl transition-all duration-75 flex flex-col items-center justify-between p-1.5 select-none cursor-pointer border-2 border-b-4 border-slate-800 ${
                    isSelected
                      ? "bg-brand-yellow text-slate-900 shadow-chunky scale-[1.04] z-10 font-black ring-2 ring-slate-800"
                      : "bg-white text-slate-800 hover:bg-amber-50/80 font-bold shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none"
                  } ${
                    !isMatch && hasActiveFilters
                      ? "opacity-25 grayscale hover:opacity-100 hover:grayscale-0"
                      : "opacity-100"
                  }`}
                >
                  {/* Top Indicators Row */}
                  <div className="w-full flex items-center justify-between px-0.5">
                    {/* Purple Camera if has diagram */}
                    {status.hasDiagram ? (
                      <span
                        className="p-0.5 rounded bg-purple-100 text-purple-700 border border-purple-400"
                        title="Has diagram attached"
                      >
                        <Camera className="w-2.5 h-2.5 stroke-[2.5]" />
                      </span>
                    ) : (
                      <span className="w-2.5 h-2.5" />
                    )}

                    {/* Status Badge (Green check / Amber alert / Red badge) */}
                    {status.isError ? (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-slate-800"
                        title={`Error: ${status.errorMessages.join("; ")}`}
                      />
                    ) : status.isWarning ? (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-800"
                        title={`Warning: ${status.warningMessages.join("; ")}`}
                      />
                    ) : (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-800"
                        title="Valid & Complete"
                      />
                    )}
                  </div>

                  {/* Question Number */}
                  <span className="text-xs sm:text-sm font-black text-slate-900 tracking-tight leading-none">
                    {qNum}
                  </span>

                  {/* Correct Option Key pill at bottom */}
                  <span className="text-[9px] font-black uppercase text-slate-600 leading-tight">
                    {status.correctKey || "—"}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          /* =========================================================================
              LIST VIEW: Detailed Diagnostic Rows
             ========================================================================= */
          <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1 py-1">
            {questions.map((q, idx) => {
              const status = questionStatuses[idx];
              const isSelected = selectedIdx === idx;
              const isMatch = matchingIndices.includes(idx);
              const qNum = q.question_number || idx + 1;

              return (
                <button
                  key={`q-list-${idx}-${qNum}`}
                  ref={(el) => {
                    if (el) buttonRefs.current.set(idx, el);
                    else buttonRefs.current.delete(idx);
                  }}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  className={`w-full text-left p-2.5 rounded-2xl border-2 border-b-4 border-slate-800 transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-brand-yellow text-slate-900 shadow-chunky font-black ring-2 ring-slate-800"
                      : "bg-white text-slate-800 hover:bg-neutral-50 shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none"
                  } ${
                    !isMatch && hasActiveFilters
                      ? "opacity-30 grayscale"
                      : "opacity-100"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-xl bg-slate-800 text-white font-heading text-xs flex items-center justify-center shrink-0">
                      Q{qNum}
                    </span>

                    <div className="min-w-0 flex flex-col">
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {q.topic_name || "Unassigned"}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate">
                        Key: {status.correctKey || "None"} · {status.hasExplanation ? "Notes ✓" : "No notes"}
                      </span>
                    </div>
                  </div>

                  {/* Status Indicators */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {status.hasDiagram && (
                      <span className="p-1 rounded-lg bg-purple-100 text-purple-700 border border-purple-400">
                        <Camera className="w-3 h-3" />
                      </span>
                    )}

                    {status.isError ? (
                      <span className="px-2 py-0.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-800 text-[10px] font-black flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>Error</span>
                      </span>
                    ) : status.isWarning ? (
                      <span className="px-2 py-0.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-black flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Review</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 text-[10px] font-black flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Valid</span>
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          5. ADD QUESTION BUTTON
         ========================================================================= */}
      <div className="pt-2 border-t-2 border-slate-800/20 mt-auto">
        <button
          type="button"
          onClick={() => {
            if (onAddQuestion) onAddQuestion();
          }}
          disabled={!onAddQuestion}
          className="w-full py-2.5 px-4 bg-brand-yellow hover:bg-[#fde047] text-slate-900 font-heading font-black text-xs sm:text-sm border-2 border-b-4 border-slate-800 rounded-2xl shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
          aria-label="Add question to paper"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Question</span>
        </button>
      </div>
    </nav>
  );
}

export default IngestionQuestionNav;

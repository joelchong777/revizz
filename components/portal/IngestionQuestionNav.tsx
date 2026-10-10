"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import type { StagingQuestion, StagingPaper } from "@/types/ingestion";
import {
  Search,
  Plus,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
  FileQuestion,
  Layers,
  Sparkles,
} from "lucide-react";

export interface IngestionQuestionNavProps {
  questions?: StagingQuestion[];
  selectedIdx: number;
  onSelectIdx?: (idx: number) => void;
  onAddQuestion?: () => void;
  onDuplicateQuestion?: (idx: number) => void;
  onDeleteQuestion?: (idx: number) => void;
  onMoveQuestion?: (fromIdx: number, toIdx: number) => void;
  syllabusTopics?: { name: string; order_index: number }[];
  // Backwards & alternate compatibility
  expectedCount?: number;
  paper?: StagingPaper;
  onSelect?: (idx: number) => void;
  className?: string;
}

export type FilterChipMode = "all" | "valid" | "review" | "diagrams";

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
 * Strips basic markdown markers for compact snippet display
 */
function cleanMarkdownSnippet(text?: string): string {
  if (!text) return "";
  return text
    .replace(/!\[.*?\]\(.*?\)/g, "[Image]")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[#*_~`$]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function IngestionQuestionNav({
  questions: propQuestions,
  selectedIdx,
  onSelectIdx,
  onAddQuestion,
  onDuplicateQuestion,
  onDeleteQuestion,
  onMoveQuestion,
  syllabusTopics: propSyllabusTopics,
  expectedCount = 30,
  paper,
  onSelect,
  className = "",
}: IngestionQuestionNavProps) {
  // Resolve questions & selection dispatcher
  const questions = propQuestions ?? paper?.questions ?? [];
  const totalQuestions = questions.length;
  const effectiveExpected = expectedCount || 30;
  const syllabusTopics = propSyllabusTopics ?? paper?.syllabus_topics ?? [];

  const handleSelect = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(totalQuestions - 1, idx));
      if (onSelectIdx) onSelectIdx(clamped);
      else if (onSelect) onSelect(clamped);
    },
    [onSelectIdx, onSelect, totalQuestions]
  );

  // Search and filter chip states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<FilterChipMode>("all");
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState<number | null>(null);

  // References for keyboard navigation and auto-scrolling
  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const navContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll active item into view
  useEffect(() => {
    const el = buttonRefs.current.get(selectedIdx);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
    // Reset any pending delete confirmation on selection change
    setDeleteConfirmIdx(null);
  }, [selectedIdx]);

  // Global & container keyboard navigation (Arrow Up/Down/Left/Right)
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

      if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault();
        handleSelect(selectedIdx - 1);
      } else if (e.key === "ArrowDown" || e.key === "ArrowRight") {
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

  // Metrics and status computations
  const questionStatusMap = useMemo(() => {
    return questions.map((q) => {
      const validation = getQuestionValidation(q);
      const isDiagram = hasDiagram(q);
      const correctOpt = q.options?.find((o) => o.is_correct);
      return {
        isValid: validation.isValid,
        issues: validation.issues,
        hasDiagram: isDiagram,
        correctKey: correctOpt?.label || null,
      };
    });
  }, [questions]);

  const validCount = useMemo(
    () => questionStatusMap.filter((s) => s.isValid).length,
    [questionStatusMap]
  );
  const needsReviewCount = totalQuestions - validCount;
  const diagramCount = useMemo(
    () => questionStatusMap.filter((s) => s.hasDiagram).length,
    [questionStatusMap]
  );

  // Filter & search evaluation per question
  const matchesSearchAndFilter = useCallback(
    (q: StagingQuestion, idx: number): boolean => {
      const status = questionStatusMap[idx];

      // Filter chips
      if (filterMode === "valid" && !status.isValid) return false;
      if (filterMode === "review" && status.isValid) return false;
      if (filterMode === "diagrams" && !status.hasDiagram) return false;

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
    [filterMode, searchQuery, questionStatusMap]
  );

  // Indices that pass search and filter
  const matchingIndices = useMemo(() => {
    const list: number[] = [];
    questions.forEach((q, idx) => {
      if (matchesSearchAndFilter(q, idx)) {
        list.push(idx);
      }
    });
    return list;
  }, [questions, matchesSearchAndFilter]);

  const hasActiveFilters = searchQuery.trim().length > 0 || filterMode !== "all";

  // Active question details
  const activeQuestion = questions[selectedIdx];
  const activeStatus = questionStatusMap[selectedIdx] || {
    isValid: false,
    issues: ["Question not selected"],
    hasDiagram: false,
    correctKey: null,
  };

  // Safe action callbacks
  const handleMoveUp = () => {
    if (selectedIdx > 0 && onMoveQuestion) {
      onMoveQuestion(selectedIdx, selectedIdx - 1);
    }
  };

  const handleMoveDown = () => {
    if (selectedIdx < totalQuestions - 1 && onMoveQuestion) {
      onMoveQuestion(selectedIdx, selectedIdx + 1);
    }
  };

  const handleDuplicate = () => {
    if (onDuplicateQuestion) {
      onDuplicateQuestion(selectedIdx);
    }
  };

  const handleDelete = () => {
    if (!onDeleteQuestion) return;
    if (deleteConfirmIdx === selectedIdx) {
      onDeleteQuestion(selectedIdx);
      setDeleteConfirmIdx(null);
    } else {
      setDeleteConfirmIdx(selectedIdx);
    }
  };

  const progressPct =
    effectiveExpected > 0
      ? Math.min(100, Math.round((totalQuestions / effectiveExpected) * 100))
      : 100;

  return (
    <nav
      ref={navContainerRef}
      aria-label="Question Navigation and Studio Matrix"
      className={`flex flex-col gap-3.5 w-full text-[#201e1d] font-body select-none ${className}`}
    >
      {/* =========================================================================
          1. HEADER & OVERVIEW BAR
         ========================================================================= */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-2 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#FACC15] border border-[#201e1d] rounded-lg shadow-sm">
              <Layers className="w-4 h-4 text-[#201e1d]" />
            </span>
            <div>
              <h2 className="font-heading text-sm md:text-base font-black tracking-tight leading-tight">
                Question Matrix
              </h2>
              <p className="text-[11px] font-bold text-[#82796a]">
                {totalQuestions} of {effectiveExpected} Questions Staged
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`px-2 py-0.5 rounded-lg border border-[#201e1d] text-[11px] font-black ${
                validCount === totalQuestions && totalQuestions > 0
                  ? "bg-[#f0fae1] text-[#3d472b]"
                  : "bg-[#ffe1d0] text-[#c67139]"
              }`}
              title={`${validCount} questions ready for publish`}
            >
              {validCount}/{totalQuestions} Valid
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#eee7db] h-2 rounded-full border border-[#201e1d] overflow-hidden">
          <div
            className="bg-[#FACC15] h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* =========================================================================
          2. SEARCH INPUT & FILTER CHIPS
         ========================================================================= */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-2 flex flex-col gap-2.5">
        {/* Instant Search Bar */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-[#82796a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search stems, citations, Q#..."
            className="w-full bg-white border-2 border-[#201e1d] rounded-xl pl-9 pr-8 py-1.5 text-xs font-bold text-[#201e1d] placeholder-[#a19786] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FACC15] transition-all"
            aria-label="Search questions"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#82796a] hover:text-[#201e1d] p-0.5"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* All */}
          <button
            type="button"
            onClick={() => setFilterMode("all")}
            className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all border-2 active:translate-y-0.5 ${
              filterMode === "all"
                ? "bg-[#201e1d] text-[#f9f4ed] border-[#201e1d] shadow-offset-2"
                : "bg-white text-[#201e1d] border-[#201e1d] hover:bg-[#fff9e6]"
            }`}
          >
            All ({totalQuestions})
          </button>

          {/* Valid */}
          <button
            type="button"
            onClick={() => setFilterMode("valid")}
            className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all border-2 flex items-center gap-1 active:translate-y-0.5 ${
              filterMode === "valid"
                ? "bg-[#22C55E] text-[#201e1d] border-[#201e1d] shadow-offset-2"
                : "bg-white text-[#201e1d] border-[#201e1d] hover:bg-[#f0fae1]"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#22C55E] border border-[#201e1d]" />
            Valid ({validCount})
          </button>

          {/* Needs Review */}
          <button
            type="button"
            onClick={() => setFilterMode("review")}
            className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all border-2 flex items-center gap-1 active:translate-y-0.5 ${
              filterMode === "review"
                ? "bg-[#FB7185] text-[#201e1d] border-[#201e1d] shadow-offset-2"
                : "bg-white text-[#201e1d] border-[#201e1d] hover:bg-[#ffe1d0]"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#FB7185] border border-[#201e1d]" />
            Needs Review ({needsReviewCount})
          </button>

          {/* Has Diagrams */}
          <button
            type="button"
            onClick={() => setFilterMode("diagrams")}
            className={`px-2.5 py-1 rounded-xl text-xs font-black transition-all border-2 flex items-center gap-1 active:translate-y-0.5 ${
              filterMode === "diagrams"
                ? "bg-[#ffe1d0] text-[#201e1d] border-[#201e1d] shadow-offset-2"
                : "bg-white text-[#201e1d] border-[#201e1d] hover:bg-[#eee7db]"
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-[#201e1d]" />
            Diagrams ({diagramCount})
          </button>

          {/* Reset button if active */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterMode("all");
              }}
              className="ml-auto text-[11px] font-black text-[#82796a] hover:text-[#201e1d] underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {/* Filter feedback hint */}
        {hasActiveFilters && (
          <div className="text-[11px] font-bold text-[#82796a] flex justify-between items-center px-0.5">
            <span>
              Showing{" "}
              <strong className="text-[#201e1d]">
                {matchingIndices.length}
              </strong>{" "}
              matching questions
            </span>
            <span className="text-[10px] text-[#a19786]">
              Non-matches dimmed below
            </span>
          </div>
        )}
      </div>

      {/* =========================================================================
          3. FAST-ACCESS NUMERIC PILL MATRIX (30 / 40 Questions)
         ========================================================================= */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-2 flex flex-col gap-2">
        <div className="flex items-center justify-between pb-1 border-b border-[#dcd3c4]">
          <span className="text-xs font-black uppercase tracking-wider text-[#645c50]">
            Quick Select (1–{totalQuestions})
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleSelect(selectedIdx - 1)}
              disabled={selectedIdx <= 0}
              className="p-1 rounded-lg border border-[#201e1d] bg-white text-[#201e1d] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ffe1d0] transition-colors"
              title="Previous question (Arrow Left/Up)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-black text-[#201e1d] px-1">
              Q{selectedIdx + 1}
            </span>
            <button
              type="button"
              onClick={() => handleSelect(selectedIdx + 1)}
              disabled={selectedIdx >= totalQuestions - 1}
              className="p-1 rounded-lg border border-[#201e1d] bg-white text-[#201e1d] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ffe1d0] transition-colors"
              title="Next question (Arrow Right/Down)"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {totalQuestions === 0 ? (
          <div className="p-6 text-center border-2 border-dashed border-[#201e1d] rounded-xl bg-white/50 flex flex-col items-center gap-1.5">
            <FileQuestion className="w-6 h-6 text-[#82796a]" />
            <p className="text-xs font-bold text-[#645c50]">
              No questions found. Add your first question below.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-[260px] overflow-y-auto pr-1 py-1">
            {questions.map((q, idx) => {
              const status = questionStatusMap[idx];
              const isSelected = selectedIdx === idx;
              const isMatch = matchingIndices.includes(idx);
              const qNum = q.question_number || idx + 1;

              return (
                <button
                  key={`q-pill-${idx}-${qNum}`}
                  ref={(el) => {
                    if (el) buttonRefs.current.set(idx, el);
                    else buttonRefs.current.delete(idx);
                  }}
                  type="button"
                  onClick={() => handleSelect(idx)}
                  aria-pressed={isSelected}
                  title={`Question ${qNum}${
                    status.isValid ? " (Valid)" : ` (Needs attention: ${status.issues.join(", ")})`
                  }${status.hasDiagram ? " · Has Diagram" : ""}${
                    status.correctKey ? ` · Key: ${status.correctKey}` : ""
                  }`}
                  className={`relative h-11 rounded-xl transition-all duration-75 flex flex-col items-center justify-center p-1 select-none cursor-pointer border-2 ${
                    isSelected
                      ? "bg-[#FACC15] border-[#201e1d] shadow-offset-2 scale-[1.05] z-10 font-black ring-2 ring-[#201e1d]/20"
                      : "bg-white border-[#201e1d] hover:bg-[#fff9e6] font-bold shadow-sm active:translate-y-0.5 active:shadow-none"
                  } ${
                    !isMatch && hasActiveFilters
                      ? "opacity-25 grayscale hover:opacity-100 hover:grayscale-0"
                      : "opacity-100"
                  }`}
                >
                  {/* Status dot in top-right */}
                  <span
                    className={`absolute top-1 right-1 w-2 h-2 rounded-full border border-[#201e1d] ${
                      status.isValid ? "bg-[#22C55E]" : "bg-[#FB7185]"
                    }`}
                  />

                  {/* Diagram indicator in top-left */}
                  {status.hasDiagram && (
                    <span className="absolute top-1 left-1" title="Diagram attached">
                      <Camera className="w-2.5 h-2.5 text-[#201e1d] stroke-[2.5]" />
                    </span>
                  )}

                  {/* Question Number */}
                  <span className="text-xs sm:text-sm font-black text-[#201e1d] tracking-tight mt-1 leading-none">
                    {qNum}
                  </span>

                  {/* Correct Option Key pill at bottom */}
                  <span className="text-[9px] font-black uppercase text-[#645c50] leading-tight">
                    {status.correctKey || "—"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
          4. SELECTED QUESTION CARD PREVIEW
         ========================================================================= */}
      {activeQuestion && (
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3.5 shadow-offset-2 flex flex-col gap-2.5 transition-all">
          {/* Card Header */}
          <div className="flex items-center justify-between gap-2 border-b border-[#dcd3c4] pb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 bg-[#201e1d] text-[#f9f4ed] rounded-lg text-xs font-black">
                Q{activeQuestion.question_number || selectedIdx + 1}
              </span>
              {activeQuestion.cambridge_source_ref && (
                <span className="px-2 py-0.5 bg-[#eee7db] border border-[#201e1d] rounded-lg text-[10px] font-bold text-[#645c50] truncate max-w-[130px]">
                  {activeQuestion.cambridge_source_ref}
                </span>
              )}
            </div>

            {/* Validation Badge */}
            <div className="flex items-center">
              {activeStatus.isValid ? (
                <span className="px-2 py-0.5 bg-[#f0fae1] border border-[#201e1d] rounded-full text-[11px] font-black text-[#3d472b] flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[#22C55E]" />
                  Valid
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-[#ffe1d0] border border-[#201e1d] rounded-full text-[11px] font-black text-[#c67139] flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-[#FB7185]" />
                  Review
                </span>
              )}
            </div>
          </div>

          {/* Stem Markdown Snippet */}
          <div className="bg-white border-2 border-[#201e1d] rounded-xl p-2.5 shadow-sm text-xs font-medium text-[#201e1d]">
            <p className="line-clamp-2 leading-relaxed font-body">
              {cleanMarkdownSnippet(activeQuestion.stem_markdown) || (
                <span className="italic text-[#a19786]">
                  No stem text entered yet...
                </span>
              )}
            </p>
          </div>

          {/* Badges Row (Topic & Diagram) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Topic Badge */}
            <span className="px-2 py-0.5 bg-[#eee7db] border border-[#201e1d] rounded-lg text-[11px] font-bold text-[#474238] truncate max-w-[170px]">
              🏷️ {activeQuestion.topic_name || "General Topic"}
            </span>

            {/* Diagram Badge */}
            {activeStatus.hasDiagram ? (
              <span className="px-2 py-0.5 bg-[#f0fae1] border border-[#201e1d] rounded-lg text-[11px] font-black text-[#201e1d] flex items-center gap-1">
                <Camera className="w-3 h-3 text-[#201e1d]" />
                Diagram
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-white border border-[#dcd3c4] rounded-lg text-[10px] font-bold text-[#82796a]">
                Text only
              </span>
            )}

            {/* Key Badge */}
            <span className="px-2 py-0.5 bg-[#fff9e6] border border-[#201e1d] rounded-lg text-[11px] font-black text-[#201e1d] ml-auto">
              Key: {activeStatus.correctKey || "?"}
            </span>
          </div>

          {/* Validation Issues Callout (if invalid) */}
          {!activeStatus.isValid && activeStatus.issues.length > 0 && (
            <div className="p-2 rounded-xl bg-[#ffe1d0] border border-[#201e1d] text-[11px] text-[#c67139] font-bold flex flex-col gap-0.5">
              <span className="font-black text-[#201e1d]">Attention needed:</span>
              <ul className="list-disc list-inside space-y-0.5 pl-0.5">
                {activeStatus.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Toolbar (Move Up, Move Down, Duplicate, Delete) */}
          <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-[#dcd3c4]">
            {/* Move Up */}
            <button
              type="button"
              onClick={handleMoveUp}
              disabled={selectedIdx <= 0 || !onMoveQuestion}
              className="py-1.5 px-2 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-black text-[#201e1d] hover:bg-[#ffe1d0] active:translate-y-0.5 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-all"
              title="Move question up"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Up</span>
            </button>

            {/* Move Down */}
            <button
              type="button"
              onClick={handleMoveDown}
              disabled={selectedIdx >= totalQuestions - 1 || !onMoveQuestion}
              className="py-1.5 px-2 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-black text-[#201e1d] hover:bg-[#ffe1d0] active:translate-y-0.5 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-all"
              title="Move question down"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Down</span>
            </button>

            {/* Duplicate */}
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={!onDuplicateQuestion}
              className="py-1.5 px-2 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-black text-[#201e1d] hover:bg-[#ffe1d0] active:translate-y-0.5 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-all"
              title="Duplicate this question"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clone</span>
            </button>

            {/* Delete */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={!onDeleteQuestion || totalQuestions <= 1}
              className={`py-1.5 px-2 border-2 border-[#201e1d] rounded-xl text-xs font-black active:translate-y-0.5 shadow-sm disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 transition-all ${
                deleteConfirmIdx === selectedIdx
                  ? "bg-red-500 text-white animate-pulse"
                  : "bg-white text-rose-600 hover:bg-rose-50"
              }`}
              title={
                deleteConfirmIdx === selectedIdx
                  ? "Click again to confirm deletion"
                  : "Delete this question"
              }
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {deleteConfirmIdx === selectedIdx ? "Confirm?" : "Del"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. STICKY BOTTOM BAR ("Add Question (+)")
         ========================================================================= */}
      <div className="sticky bottom-0 bg-[#f9f4ed]/95 backdrop-blur-sm pt-2 pb-1 border-t-2 border-[#201e1d] mt-auto z-20">
        <button
          type="button"
          onClick={() => {
            if (onAddQuestion) onAddQuestion();
          }}
          disabled={!onAddQuestion}
          className="w-full py-2.5 px-4 bg-[#FACC15] hover:bg-[#ffe1d0] text-[#201e1d] font-heading font-black text-xs sm:text-sm border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 cursor-pointer"
          aria-label="Add question to paper"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Add Question (+)</span>
        </button>
      </div>
    </nav>
  );
}

export default IngestionQuestionNav;

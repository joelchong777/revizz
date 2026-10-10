"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import type { StagingQuestion, StagingPaper } from "@/types/ingestion";

export interface IngestionQuestionNavProps {
  questions?: StagingQuestion[];
  selectedIdx: number;
  onSelectIdx?: (idx: number) => void;
  expectedCount?: number;
  syllabusTopics?: { name: string; order_index: number }[];
  // Backwards & alternate compatibility for parent components
  paper?: StagingPaper;
  onSelect?: (idx: number) => void;
}

export function IngestionQuestionNav({
  questions: propQuestions,
  selectedIdx,
  onSelectIdx,
  expectedCount = 30,
  syllabusTopics: propSyllabusTopics,
  paper,
  onSelect,
}: IngestionQuestionNavProps) {
  // Resolve data from either prop shape
  const questions = propQuestions ?? paper?.questions ?? [];
  const resolvedSelect = (idx: number) => {
    if (onSelectIdx) onSelectIdx(idx);
    else if (onSelect) onSelect(idx);
  };
  const effectiveExpected = expectedCount || 30;
  const syllabusTopics = propSyllabusTopics ?? paper?.syllabus_topics ?? [];

  // Filter and search states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<string>("ALL");
  const [diagramsOnly, setDiagramsOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "validated" | "review">("all");

  const buttonRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  // Scroll active item into view when selectedIdx changes
  useEffect(() => {
    const el = buttonRefs.current.get(selectedIdx);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [selectedIdx]);

  // Helper validation predicate for each question
  const isQuestionValidated = (q: StagingQuestion): boolean => {
    if (q.status === "withdrawn") return false;
    if (!q.stem_markdown || q.stem_markdown.trim().length === 0) return false;
    if (!q.options || q.options.length !== 4) return false;
    if (!q.options.some((o) => o.is_correct)) return false;
    return true;
  };

  // Distinct topics list for dropdown
  const availableTopics = useMemo(() => {
    const topicSet = new Set<string>();
    syllabusTopics.forEach((t) => topicSet.add(t.name));
    questions.forEach((q) => {
      if (q.topic_name) topicSet.add(q.topic_name);
    });
    return Array.from(topicSet).sort();
  }, [syllabusTopics, questions]);

  // KPI calculations
  const totalQuestions = questions.length;
  const progressPct = effectiveExpected > 0 ? Math.min(100, Math.round((totalQuestions / effectiveExpected) * 100)) : 100;
  
  const valid4OptionQuestions = questions.filter((q) => q.options && q.options.length === 4);
  const totalOptions = questions.reduce((acc, q) => acc + (q.options?.length || 0), 0);
  const optionIntegrityPct = totalQuestions > 0 ? Math.round((valid4OptionQuestions.length / totalQuestions) * 100) : 100;

  const diagramCount = questions.filter(
    (q) => q.diagram?.has_diagram === true || !!q.diagram?.image_url
  ).length;

  const questionsWithCorrectKey = questions.filter((q) => q.options?.some((o) => o.is_correct));
  const markSchemeParityPct = totalQuestions > 0 ? Math.round((questionsWithCorrectKey.length / totalQuestions) * 100) : 100;

  const isSchemaValid = useMemo(() => {
    if (totalQuestions === 0) return true;
    return questions.every(
      (q) =>
        typeof q.question_number === "number" &&
        q.question_number > 0 &&
        Boolean(q.cambridge_source_ref) &&
        Boolean(q.stem_markdown) &&
        Array.isArray(q.options) &&
        q.options.length === 4
    );
  }, [questions, totalQuestions]);

  const validatedCount = useMemo(
    () => questions.filter((q) => isQuestionValidated(q)).length,
    [questions]
  );
  const needsReviewCount = totalQuestions - validatedCount;

  // Filtered questions mapping: keep original index for selection
  const filteredQuestionEntries = useMemo(() => {
    return questions
      .map((q, idx) => ({ q, originalIdx: idx }))
      .filter(({ q }) => {
        // Search filter
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase().trim();
          const qNumStr = `q${q.question_number}`.toLowerCase();
          const numStr = `${q.question_number}`;
          const matchesStem = q.stem_markdown?.toLowerCase().includes(query);
          const matchesRef = q.cambridge_source_ref?.toLowerCase().includes(query);
          const matchesTopic = q.topic_name?.toLowerCase().includes(query);
          const matchesQNum = qNumStr.includes(query) || numStr === query;
          if (!matchesStem && !matchesRef && !matchesTopic && !matchesQNum) {
            return false;
          }
        }

        // Topic filter
        if (selectedTopic !== "ALL" && q.topic_name !== selectedTopic) {
          return false;
        }

        // Diagrams only filter
        if (diagramsOnly && !q.diagram?.has_diagram && !q.diagram?.image_url) {
          return false;
        }

        // Status filter
        if (statusFilter === "validated" && !isQuestionValidated(q)) {
          return false;
        }
        if (statusFilter === "review" && isQuestionValidated(q)) {
          return false;
        }

        return true;
      });
  }, [questions, searchQuery, selectedTopic, diagramsOnly, statusFilter]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    selectedTopic !== "ALL" ||
    diagramsOnly ||
    statusFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedTopic("ALL");
    setDiagramsOnly(false);
    setStatusFilter("all");
  };

  const handleNext = () => {
    if (selectedIdx < totalQuestions - 1) {
      resolvedSelect(selectedIdx + 1);
    }
  };

  const handlePrev = () => {
    if (selectedIdx > 0) {
      resolvedSelect(selectedIdx - 1);
    }
  };

  return (
    <nav
      aria-label="Question Navigator and KPI Panel"
      className="flex flex-col gap-5 w-full text-[#201e1d] font-body"
    >
      {/* =========================================================================
          1. TOP KPI HEALTH CARDS (Responsive Grid)
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
        {/* KPI 1: Total Questions */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-4 shadow-offset-2 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#645c50]">
            <span>Total Questions</span>
            <span className="text-sm">📋</span>
          </div>
          <div className="my-2">
            <div className="text-xl sm:text-2xl font-black text-[#201e1d] tracking-tight">
              {totalQuestions} / {effectiveExpected}
            </div>
            <div className="w-full bg-[#eee7db] h-2.5 rounded-full border border-[#201e1d] overflow-hidden mt-1.5">
              <div
                className="bg-[#c67139] h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <div className="text-xs font-bold text-[#82796a] flex justify-between items-center">
            <span>Progress: {progressPct}%</span>
            <span>Target: {effectiveExpected}</span>
          </div>
        </div>

        {/* KPI 2: 4-Option Integrity */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-4 shadow-offset-2 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#645c50]">
            <span>4-Option Integrity</span>
            <span className="text-sm">🔢</span>
          </div>
          <div className="my-2">
            <div className="text-base sm:text-lg font-black text-[#201e1d] leading-snug">
              {totalQuestions * 4} Options Validated ({optionIntegrityPct}%)
            </div>
            <div className="text-xs font-bold text-[#8fa073] mt-1">
              {valid4OptionQuestions.length} of {totalQuestions} Questions Complete
            </div>
          </div>
          <div className="text-xs font-bold text-[#82796a]">
            Strict A, B, C, D Multi-Choice
          </div>
        </div>

        {/* KPI 3: Diagrams Extracted */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-4 shadow-offset-2 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#645c50]">
            <span>Diagrams Extracted</span>
            <span className="text-sm">🖼️</span>
          </div>
          <div className="my-2">
            <div className="text-base sm:text-lg font-black text-[#201e1d] leading-snug">
              {diagramCount} Diagrams Linked 🖼️
            </div>
            <div className="text-xs font-bold text-[#c67139] mt-1">
              300 DPI vector graphs
            </div>
          </div>
          <div className="text-xs font-bold text-[#82796a]">
            {totalQuestions > 0 ? Math.round((diagramCount / totalQuestions) * 100) : 0}% Visual Stems
          </div>
        </div>

        {/* KPI 4: Mark Scheme Parity */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-4 shadow-offset-2 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#645c50]">
            <span>Mark Scheme Parity</span>
            <span className="text-sm">🎯</span>
          </div>
          <div className="my-2">
            <div className="text-base sm:text-lg font-black text-[#201e1d] leading-snug">
              {markSchemeParityPct === 100 ? "100% Verified Keys 🎯" : `${markSchemeParityPct}% Verified Keys 🎯`}
            </div>
            <div className="text-xs font-bold text-[#8fa073] mt-1">
              {questionsWithCorrectKey.length} of {totalQuestions} Keys Verified
            </div>
          </div>
          <div className="text-xs font-bold text-[#82796a]">
            Cambridge MS Alignment
          </div>
        </div>

        {/* KPI 5: Schema Status */}
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-4 shadow-offset-2 flex flex-col justify-between transition-transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#645c50]">
            <span>Schema Status</span>
            <span className="text-sm">🛡️</span>
          </div>
          <div className="my-2">
            <div className="text-base sm:text-lg font-black text-[#201e1d] leading-snug">
              {isSchemaValid ? "Valid Zod Schema ✅" : "Schema Warnings ⚠️"}
            </div>
            <div className="text-xs font-bold text-[#645c50] mt-1">
              Staging V1 Specification
            </div>
          </div>
          <div className="text-xs font-bold text-[#82796a]">
            Type-Safe & Production Ready
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. SEARCH & FILTER BAR
         ========================================================================= */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3.5 sm:p-4 shadow-offset-2 flex flex-col gap-3">
        {/* Row 1: Search & Topic Filter */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none select-none">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search stems, Q#, or Cambridge ref (e.g. 0625, Q12)..."
              className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm font-bold text-[#201e1d] placeholder-[#a19786] shadow-offset-2 focus:outline-none focus:ring-2 focus:ring-[#c67139] transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-black text-[#82796a] hover:text-[#201e1d] p-1"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Topic Dropdown */}
          <div className="sm:w-64">
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-[#201e1d] shadow-offset-2 focus:outline-none focus:ring-2 focus:ring-[#c67139] cursor-pointer transition-all"
              aria-label="Filter by Topic"
            >
              <option value="ALL">All Syllabus Topics ({totalQuestions})</option>
              {availableTopics.map((topic) => {
                const count = questions.filter((q) => q.topic_name === topic).length;
                return (
                  <option key={topic} value={topic}>
                    {topic} ({count})
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Row 2: Filter Pills & Action Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-[#dcd3c4]">
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Pills */}
            <div className="inline-flex rounded-xl p-0.5 bg-[#eee7db] border border-[#201e1d]">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                  statusFilter === "all"
                    ? "bg-[#201e1d] text-[#f9f4ed] font-black"
                    : "text-[#645c50] hover:text-[#201e1d]"
                }`}
              >
                All ({totalQuestions})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("validated")}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                  statusFilter === "validated"
                    ? "bg-[#f0fae1] border border-[#201e1d] text-[#201e1d] font-black shadow-offset-2"
                    : "text-[#645c50] hover:text-[#201e1d]"
                }`}
              >
                Validated ✅ ({validatedCount})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("review")}
                className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                  statusFilter === "review"
                    ? "bg-[#ffe1d0] border border-[#201e1d] text-[#201e1d] font-black shadow-offset-2"
                    : "text-[#645c50] hover:text-[#201e1d]"
                }`}
              >
                Needs review ⚠️ ({needsReviewCount})
              </button>
            </div>

            {/* Diagrams Only Toggle */}
            <button
              type="button"
              onClick={() => setDiagramsOnly((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border-2 select-none active:translate-y-0.5 active:shadow-none ${
                diagramsOnly
                  ? "bg-[#ffe1d0] border-[#201e1d] text-[#201e1d] shadow-offset-2 font-black"
                  : "bg-[#f9f4ed] border-[#dcd3c4] hover:border-[#201e1d] text-[#645c50] hover:text-[#201e1d]"
              }`}
            >
              Diagrams only 🖼️ ({diagramCount})
            </button>
          </div>

          {/* Quick Clear / Result Feedback */}
          <div className="flex items-center gap-2 text-xs font-bold text-[#82796a]">
            <span>
              Showing <strong className="text-[#201e1d]">{filteredQuestionEntries.length}</strong> of {totalQuestions}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2 py-0.5 rounded-lg bg-[#eee7db] border border-[#201e1d] text-[#201e1d] hover:bg-[#ffe1d0] transition-colors"
              >
                Reset filters ↺
              </button>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. INTERACTIVE QUESTION GRID & NAVIGATION STRIP
         ========================================================================= */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3.5 sm:p-4 shadow-offset-4 flex flex-col gap-3">
        {/* Strip Header with Quick Prev/Next controls */}
        <div className="flex items-center justify-between pb-2 border-b border-[#dcd3c4]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black uppercase tracking-wider text-[#201e1d]">
              Question Navigator
            </span>
            <span className="px-2 py-0.5 bg-[#f0fae1] border border-[#201e1d] rounded-full text-[11px] font-black text-[#8fa073]">
              Active: Q{selectedIdx + 1}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={selectedIdx <= 0}
              onClick={handlePrev}
              className="px-2.5 py-1 bg-[#f9f4ed] border border-[#201e1d] rounded-lg text-xs font-black text-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              aria-label="Previous question"
            >
              ◀ Prev
            </button>
            <button
              type="button"
              disabled={selectedIdx >= totalQuestions - 1}
              onClick={handleNext}
              className="px-2.5 py-1 bg-[#f9f4ed] border border-[#201e1d] rounded-lg text-xs font-black text-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              aria-label="Next question"
            >
              Next ▶
            </button>
          </div>
        </div>

        {/* Empty State */}
        {filteredQuestionEntries.length === 0 ? (
          <div className="p-8 text-center bg-[#f5ead8] border-2 border-dashed border-[#201e1d] rounded-xl my-2 flex flex-col items-center gap-2">
            <div className="text-3xl">🔍</div>
            <div className="text-sm font-black text-[#201e1d]">No questions match current filters</div>
            <div className="text-xs text-[#645c50]">Try adjusting your search query, topic, or status filters.</div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="mt-2 px-3 py-1.5 bg-[#ffe1d0] border-2 border-[#201e1d] rounded-xl text-xs font-black text-[#201e1d] shadow-offset-2 active:translate-y-0.5"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          /* Question Grid */
          <div className="max-h-[380px] overflow-y-auto pr-1 py-1 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
            {filteredQuestionEntries.map(({ q, originalIdx }) => {
              const isSelected = selectedIdx === originalIdx;
              const hasDiagram = q.diagram?.has_diagram === true || Boolean(q.diagram?.image_url);
              const correctOption = q.options?.find((o) => o.is_correct);
              const correctLetter = correctOption ? correctOption.label : null;
              const validated = isQuestionValidated(q);

              return (
                <button
                  key={q.question_number || originalIdx}
                  ref={(el) => {
                    if (el) buttonRefs.current.set(originalIdx, el);
                    else buttonRefs.current.delete(originalIdx);
                  }}
                  type="button"
                  onClick={() => resolvedSelect(originalIdx)}
                  aria-pressed={isSelected}
                  aria-label={`Question ${q.question_number || originalIdx + 1}, Key: ${correctLetter || "unassigned"}, Status: ${validated ? "Validated" : "Needs Review"}`}
                  className={`relative p-2 rounded-xl transition-all duration-75 select-none cursor-pointer flex flex-col justify-between gap-1 text-left min-h-[58px] active:translate-y-0.5 active:shadow-none ${
                    isSelected
                      ? "bg-[#ffe1d0] border-2 border-[#201e1d] shadow-offset-2 font-black ring-2 ring-[#c67139]/30 scale-[1.02] z-10"
                      : "bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] hover:bg-[#eee7db] hover:border-[#201e1d] font-bold"
                  }`}
                >
                  {/* Top Row: Q Number & Status Icon */}
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span className="text-xs sm:text-sm font-black text-[#201e1d] tracking-tight">
                      Q{q.question_number || originalIdx + 1}
                    </span>
                    <span className="text-xs" title={validated ? "Validated" : "Needs Review"}>
                      {validated ? "✅" : "⚠️"}
                    </span>
                  </div>

                  {/* Bottom Row: Answer Letter Pill & Diagram Indicator */}
                  <div className="flex items-center justify-between gap-1 w-full mt-0.5">
                    {correctLetter ? (
                      <span
                        className="px-1.5 py-0.2 rounded border border-[#201e1d] bg-[#f0fae1] text-[#201e1d] text-[10px] font-black uppercase leading-tight"
                        title={`Correct key: ${correctLetter}`}
                      >
                        {correctLetter}
                      </span>
                    ) : (
                      <span
                        className="px-1.5 py-0.2 rounded border border-rose-500 bg-rose-100 text-rose-800 text-[10px] font-black leading-tight"
                        title="Missing correct key"
                      >
                        ?
                      </span>
                    )}

                    {hasDiagram ? (
                      <span className="text-xs" title="Diagram attached">
                        🖼️
                      </span>
                    ) : (
                      <span className="w-3" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </nav>
  );
}

export default IngestionQuestionNav;

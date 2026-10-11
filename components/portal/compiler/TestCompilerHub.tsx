'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  X,
  Settings2,
  Download,
  Save,
  Trash2,
  GripVertical,
  FileText,
  Check,
  Zap,
  Filter,
  Image as ImageIcon,
  ArrowUp,
  ArrowDown,
  Table,
  Calculator,
  RotateCcw
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { CAMBRIDGE_QUESTIONS, CAMBRIDGE_TOPICS } from '@/lib/questions';
import { saveTestDraft, listTestDrafts, autoSelectQuestions } from '@/lib/testCompiler';
import {
  SelectionFilter,
  SortOption,
  hasDataTable,
  isMathOrCalculation,
  getAvailableSeries,
  filterAndSortQuestions,
  countActiveFilters
} from '@/lib/compilerFilters';
import { TestPaperConfig } from '@/types/testCompiler';

export default function TestCompilerHub() {
  // --- Left Column / Filter State ---
  const [search, setSearch] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('all');
  const [selectedSeries, setSelectedSeries] = useState<string>('all');
  const [selectionFilter, setSelectionFilter] = useState<SelectionFilter>('all');
  const [withDiagramsOnly, setWithDiagramsOnly] = useState(false);
  const [withTablesOnly, setWithTablesOnly] = useState(false);
  const [withMathOnly, setWithMathOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('paper');

  // --- Right Column (Test Config) State ---
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [testTitle, setTestTitle] = useState('Term 1 Mock Assessment - Economics');
  const [schoolName, setSchoolName] = useState('Frontier International Academy');
  const [dateString, setDateString] = useState('October 2026');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [testCode, setTestCode] = useState('REV-0455-M26-001');

  const [includeCoverPage, setIncludeCoverPage] = useState(true);
  const [includeCandidateHeader, setIncludeCandidateHeader] = useState(true);
  const [includeBubbleSheet, setIncludeBubbleSheet] = useState(true);
  const [includeMarkScheme, setIncludeMarkScheme] = useState(true);

  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // --- Modals State ---
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [autoCount, setAutoCount] = useState<number>(10);
  const [autoTopicId, setAutoTopicId] = useState<string>('all');

  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false);
  const [drafts, setDrafts] = useState<TestPaperConfig[]>([]);

  // --- Derived State & Series Extraction ---
  const availableSeries = useMemo(() => {
    return getAvailableSeries(CAMBRIDGE_QUESTIONS);
  }, []);

  const filteredQuestions = useMemo(() => {
    return filterAndSortQuestions(CAMBRIDGE_QUESTIONS, {
      search,
      topicId: selectedTopicId,
      series: selectedSeries,
      selection: selectionFilter,
      selectedQuestionIds,
      withDiagramsOnly,
      withTablesOnly,
      withMathOnly,
      sortBy,
    });
  }, [
    search,
    selectedTopicId,
    selectedSeries,
    selectionFilter,
    selectedQuestionIds,
    withDiagramsOnly,
    withTablesOnly,
    withMathOnly,
    sortBy,
  ]);

  const activeFilterCount = useMemo(() => {
    return countActiveFilters({
      search,
      topicId: selectedTopicId,
      series: selectedSeries,
      selection: selectionFilter,
      withDiagramsOnly,
      withTablesOnly,
      withMathOnly,
      sortBy,
    });
  }, [
    search,
    selectedTopicId,
    selectedSeries,
    selectionFilter,
    withDiagramsOnly,
    withTablesOnly,
    withMathOnly,
    sortBy,
  ]);

  const handleResetAllFilters = () => {
    setSearch('');
    setSelectedTopicId('all');
    setSelectedSeries('all');
    setSelectionFilter('all');
    setWithDiagramsOnly(false);
    setWithTablesOnly(false);
    setWithMathOnly(false);
    setSortBy('paper');
  };

  const allFilteredSelected = useMemo(() => {
    if (filteredQuestions.length === 0) return false;
    return filteredQuestions.every((q) => selectedQuestionIds.includes(q.id));
  }, [filteredQuestions, selectedQuestionIds]);

  const selectedQuestions = useMemo(() => {
    return selectedQuestionIds
      .map((id) => CAMBRIDGE_QUESTIONS.find((q) => q.id === id))
      .filter(Boolean) as typeof CAMBRIDGE_QUESTIONS;
  }, [selectedQuestionIds]);

  const estimatedTime = selectedQuestionIds.length * 1.5;

  // --- Handlers ---
  const handleToggleQuestion = (id: string) => {
    setSelectedQuestionIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      return [...prev, id];
    });
  };

  const handleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedQuestionIds((prev) => prev.filter((id) => !filteredQuestions.find((q) => q.id === id)));
    } else {
      const newIds = [...selectedQuestionIds];
      filteredQuestions.forEach((q) => {
        if (!newIds.includes(q.id)) newIds.push(q.id);
      });
      setSelectedQuestionIds(newIds);
    }
  };

  const handleClearSelection = () => setSelectedQuestionIds([]);

  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newIds = [...selectedQuestionIds];
      [newIds[index - 1], newIds[index]] = [newIds[index], newIds[index - 1]];
      setSelectedQuestionIds(newIds);
    } else if (direction === 'down' && index < selectedQuestionIds.length - 1) {
      const newIds = [...selectedQuestionIds];
      [newIds[index + 1], newIds[index]] = [newIds[index], newIds[index + 1]];
      setSelectedQuestionIds(newIds);
    }
  };

  const handleRemoveQuestion = (index: number) => {
    const newIds = [...selectedQuestionIds];
    newIds.splice(index, 1);
    setSelectedQuestionIds(newIds);
  };

  const generateConfig = (): TestPaperConfig => {
    return {
      id: Math.random().toString(36).substring(7),
      title: testTitle,
      subjectCode: '0455', // Example
      subjectName: 'Economics',
      schoolName: schoolName,
      durationMinutes: durationMinutes,
      totalMarks: selectedQuestionIds.length,
      testCode: testCode,
      dateString: dateString,
      includeCoverPage: includeCoverPage,
      includeCandidateHeader: includeCandidateHeader,
      includeBubbleSheet: includeBubbleSheet,
      includeMarkScheme: includeMarkScheme,
      questionIds: selectedQuestionIds,
      createdAt: new Date().toISOString(),
    };
  };

  const handleSaveDraft = () => {
    const config = generateConfig();
    saveTestDraft(config);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleGeneratePDF = () => {
    const config = generateConfig();
    saveTestDraft(config);
    window.open(`/portal/compiler/print?testId=${config.id}`, '_blank');
  };

  const handleAutoCompile = () => {
    const ids = autoSelectQuestions({
      count: autoCount,
      topicIds: autoTopicId === 'all' ? undefined : [autoTopicId],
    });
    setSelectedQuestionIds((prev) => {
      const newIds = [...prev];
      ids.forEach((id) => {
        if (!newIds.includes(id)) newIds.push(id);
      });
      return newIds;
    });
    setIsAutoModalOpen(false);
  };

  const handleOpenDrafts = () => {
    setDrafts(listTestDrafts());
    setIsDraftsModalOpen(true);
  };

  const handleLoadDraft = (draft: TestPaperConfig) => {
    setTestTitle(draft.title);
    setSchoolName(draft.schoolName);
    setDateString(draft.dateString);
    setDurationMinutes(draft.durationMinutes);
    setTestCode(draft.testCode);
    setIncludeCoverPage(draft.includeCoverPage);
    setIncludeCandidateHeader(draft.includeCandidateHeader);
    setIncludeBubbleSheet(draft.includeBubbleSheet);
    setIncludeMarkScheme(draft.includeMarkScheme);
    setSelectedQuestionIds(draft.questionIds);
    setIsDraftsModalOpen(false);
  };

  const handleDeleteDraft = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.removeItem(`revizz_test_draft_${id}`);
    setDrafts(listTestDrafts());
  };

  // Close modals on Escape key per revizz-a11y-keyboard standards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAutoModalOpen) {
          setIsAutoModalOpen(false);
        } else if (isDraftsModalOpen) {
          setIsDraftsModalOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAutoModalOpen, isDraftsModalOpen]);

  return (
    <div className="flex flex-col gap-6 text-[#201e1d] font-body pb-12">
      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 items-start">
        {/* LEFT COLUMN: Test Compiler */}
        <div className="flex flex-col gap-3 min-w-0">
          {/* List Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#f9f4ed] rounded-2xl border-2 border-[#dcd3c4] shadow-sm">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-heading font-black text-[#201e1d] text-base">Test Compiler</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-[#eee7db] text-xs font-bold text-[#645c50]">
                {filteredQuestions.length} of {CAMBRIDGE_QUESTIONS.length} found
              </span>
              {activeFilterCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-[#ffe1d0] text-[#c67139] border border-[#c67139] text-[10px] font-bold">
                  {activeFilterCount} active
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              aria-label={allFilteredSelected ? 'Deselect all filtered questions' : 'Select all filtered questions'}
              title={allFilteredSelected ? 'Deselect all filtered questions' : 'Select all filtered questions'}
              className="text-xs font-bold text-[#c67139] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-2 rounded-md transition-all active:translate-y-0.5"
            >
              {allFilteredSelected ? 'Deselect All' : 'Select All Filtered'}
            </button>
          </div>

          {/* Scrollable Question Cards */}
          <div className="h-[calc(100vh-140px)] min-h-[650px] overflow-y-auto pr-2 flex flex-col gap-4">
            {filteredQuestions.map((q) => {
              const isSelected = selectedQuestionIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  aria-label={`Question ${q.citation || q.id}: ${q.topic}. ${isSelected ? 'Selected' : 'Not selected'}`}
                  className={`p-5 rounded-3xl border-2 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#728157] focus-visible:ring-offset-2 active:translate-y-0.5 ${
                    isSelected
                      ? 'border-[#728157] bg-[#f0fae1] shadow-[4px_4px_0_0_#728157]'
                      : 'border-[#dcd3c4] bg-[#f9f4ed] shadow-sm hover:border-[#a19786]'
                  }`}
                  onClick={() => handleToggleQuestion(q.id)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      handleToggleQuestion(q.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-md bg-[#201e1d] text-white font-mono text-[10px] font-bold tracking-wider uppercase">
                        {q.citation || q.id}
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-[#eee7db] text-[#474238] text-[10px] font-bold">
                        {q.topic}
                      </span>
                      {q.image_url && (
                        <span className="px-2.5 py-1 rounded-md bg-[#ffe1d0] text-[#c67139] text-[10px] font-bold flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" aria-hidden="true" /> Diagram
                        </span>
                      )}
                      {hasDataTable(q.stem_markdown) && (
                        <span className="px-2.5 py-1 rounded-md bg-[#e1f0fa] text-[#2c6e91] text-[10px] font-bold flex items-center gap-1">
                          <Table className="w-3 h-3" aria-hidden="true" /> Table
                        </span>
                      )}
                      {isMathOrCalculation(q.stem_markdown) && (
                        <span className="px-2.5 py-1 rounded-md bg-[#ede8f5] text-[#5e4b8b] text-[10px] font-bold flex items-center gap-1">
                          <Calculator className="w-3 h-3" aria-hidden="true" /> Math
                        </span>
                      )}
                    </div>
                    <div
                      aria-hidden="true"
                      className={`w-6 h-6 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'border-[#728157] bg-[#728157] text-white'
                          : 'border-[#c0b6a5] bg-white text-transparent'
                      }`}
                    >
                      <Check className="w-4 h-4" />
                    </div>
                  </div>

                  <div className="prose prose-sm max-w-none text-[#201e1d] font-medium leading-relaxed mb-4">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {q.stem_markdown || ''}
                    </ReactMarkdown>
                  </div>

                  {q.image_url && (
                    <div className="mb-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={q.image_url}
                        alt="Question diagram"
                        className="max-h-32 rounded-lg border-[1.5px] border-[#dcd3c4] object-contain bg-white p-1"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, i) => (
                      <div
                        key={opt.id}
                        className={`px-3 py-2 rounded-xl text-xs flex gap-2 ${
                          opt.id === q.correct_option_id
                            ? 'bg-[#ccdbb2] border border-[#8fa073] font-bold text-[#272e1b]'
                            : 'bg-white border border-[#dcd3c4] text-[#474238]'
                        }`}
                      >
                        <span className="font-bold opacity-70 w-4">{String.fromCharCode(65 + i)}.</span>
                        <div className="flex-1">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {opt.text_markdown}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {filteredQuestions.length === 0 && (
              <div className="text-center py-16 px-4 bg-[#f9f4ed] rounded-3xl border-2 border-dashed border-[#dcd3c4] text-[#645c50] flex flex-col items-center justify-center gap-3">
                <span className="font-bold text-sm">No questions match your filters.</span>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetAllFilters}
                    className="px-4 py-2 rounded-full bg-white border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-sm hover:bg-[#eee7db] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#c67139]" aria-hidden="true" />
                    <span>Clear All Filters</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Filters & Assembly Drawer (Sticky) */}
        <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-32px)] lg:overflow-y-auto pr-1 flex flex-col gap-4">
          {/* Card B: Search & Filters */}
          <div className="p-4 rounded-3xl bg-[#f9f4ed] border-2 border-[#dcd3c4] shadow-sm flex flex-col gap-3.5">
            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIsAutoModalOpen(true)}
                title="Auto-generate question preset"
                aria-label="Auto-generate question preset"
                className="px-3.5 py-1.5 rounded-full bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-xs font-bold text-[#3d472b] hover:bg-[#e1eecc] hover:border-[#64724d] active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#728157] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f9f4ed] flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Auto-Generate Preset</span>
              </button>
              <button
                type="button"
                onClick={handleOpenDrafts}
                title="View and load saved test drafts"
                aria-label="View and load saved test drafts"
                className="px-3.5 py-1.5 rounded-full bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#474238] hover:bg-[#eee7db] hover:border-[#201e1d] active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f9f4ed] flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Saved Drafts</span>
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                title="Clear all selected questions"
                aria-label="Clear all selected questions"
                disabled={selectedQuestionIds.length === 0}
                className="px-3.5 py-1.5 rounded-full bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#474238] hover:bg-[#eee7db] hover:border-[#201e1d] active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f9f4ed] flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#dcd3c4] disabled:hover:bg-white disabled:active:translate-y-0"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Clear Selection</span>
              </button>
            </div>

            {/* Section Header with Active Indicator & Reset Button */}
            <div className="pt-2 border-t border-[#dcd3c4] flex items-center justify-between gap-2 text-xs font-black uppercase tracking-wider text-[#645c50]">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-[#c67139]" aria-hidden="true" />
                <span>Search & Filters</span>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#ffe1d0] text-[#c67139] border border-[#c67139] text-[10px] font-bold lowercase tracking-normal">
                    {activeFilterCount} active
                  </span>
                )}
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetAllFilters}
                  aria-label="Reset all search and filter controls to default"
                  title="Reset all filters"
                  className="text-[11px] font-bold text-[#c67139] hover:underline flex items-center gap-1 cursor-pointer normal-case tracking-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] rounded-md active:translate-y-0.5 transition-all"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>Reset All</span>
                </button>
              )}
            </div>

            {/* Text Search Input */}
            <div className="relative">
              <label htmlFor="compiler-search-input" className="sr-only">
                Search stems, question IDs, citations, and option texts
              </label>
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#82796a] pointer-events-none" aria-hidden="true" />
              <input
                id="compiler-search-input"
                type="text"
                placeholder="Search stems, citations, IDs, options..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search questions by stem, citations, IDs, or option text"
                className="w-full pl-9 pr-9 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-sm text-[#201e1d] focus-visible:outline-none focus-visible:border-[#c67139] focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-1 hover:border-[#201e1d] placeholder:text-[#a19786] transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search query"
                  title="Clear search query"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#82796a] hover:text-[#201e1d] p-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] active:translate-y-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Dropdowns Group (Topic, Series/Year, Sort) */}
            <div className="flex flex-col gap-2">
              <div>
                <label htmlFor="compiler-topic-filter" className="block text-[11px] font-bold text-[#645c50] mb-1">
                  Topic
                </label>
                <select
                  id="compiler-topic-filter"
                  aria-label="Filter by Cambridge topic"
                  value={selectedTopicId}
                  onChange={(e) => setSelectedTopicId(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] focus-visible:outline-none focus-visible:border-[#c67139] focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-1 hover:border-[#201e1d] transition-all"
                >
                  <option value="all">All Topics</option>
                  {CAMBRIDGE_TOPICS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label htmlFor="compiler-series-filter" className="block text-[11px] font-bold text-[#645c50] mb-1">
                    Exam Series / Year
                  </label>
                  <select
                    id="compiler-series-filter"
                    aria-label="Filter by exam series or year"
                    value={selectedSeries}
                    onChange={(e) => setSelectedSeries(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] focus-visible:outline-none focus-visible:border-[#c67139] focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-1 hover:border-[#201e1d] transition-all"
                  >
                    <option value="all">All Series / Years</option>
                    {availableSeries.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="compiler-sort-control" className="block text-[11px] font-bold text-[#645c50] mb-1">
                    Sort By
                  </label>
                  <select
                    id="compiler-sort-control"
                    aria-label="Sort questions"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="w-full px-3 py-1.5 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] focus-visible:outline-none focus-visible:border-[#c67139] focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-1 hover:border-[#201e1d] transition-all"
                  >
                    <option value="paper">Paper Order (Default)</option>
                    <option value="shortest">Shortest Stem</option>
                    <option value="longest">Longest / Scenario</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Selection Status Chips */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-[#645c50]">Selection Status</span>
                <span className="text-[10px] text-[#82796a] font-semibold">
                  {selectedQuestionIds.length} of {CAMBRIDGE_QUESTIONS.length} in test
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Selection status filter">
                {(
                  [
                    { id: 'all', label: 'All Questions', count: CAMBRIDGE_QUESTIONS.length },
                    { id: 'selected', label: 'Selected in Test', count: selectedQuestionIds.length },
                    {
                      id: 'unselected',
                      label: 'Unselected',
                      count: Math.max(0, CAMBRIDGE_QUESTIONS.length - selectedQuestionIds.length),
                    },
                  ] as const
                ).map((opt) => {
                  const isActive = selectionFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      aria-label={`Filter by ${opt.label} (${opt.count} questions)`}
                      onClick={() => setSelectionFilter(opt.id)}
                      className={`px-2 py-1.5 rounded-xl border-[1.5px] text-xs font-bold transition-all text-center flex flex-col items-center justify-center gap-0.5 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-1 cursor-pointer ${
                        isActive
                          ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] shadow-sm'
                          : 'bg-white border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db] hover:border-[#201e1d]'
                      }`}
                    >
                      <span className="truncate w-full text-[11px]">{opt.label}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                          isActive ? 'bg-[#c67139] text-white' : 'bg-[#eee7db] text-[#645c50]'
                        }`}
                      >
                        {opt.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Question Type / Content Toggle Chips */}
            <div>
              <span className="block text-[11px] font-bold text-[#645c50] mb-1.5">Question Type / Content</span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  role="switch"
                  aria-checked={withDiagramsOnly}
                  aria-label="Filter questions with diagrams only"
                  title="Toggle diagrams only filter"
                  onClick={() => setWithDiagramsOnly(!withDiagramsOnly)}
                  className={`px-3 py-1.5 rounded-xl border-[1.5px] text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-1 cursor-pointer ${
                    withDiagramsOnly
                      ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] shadow-sm'
                      : 'bg-white border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db] hover:border-[#201e1d]'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>With Diagrams</span>
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={withTablesOnly}
                  aria-label="Filter questions with data tables only"
                  title="Toggle data tables only filter"
                  onClick={() => setWithTablesOnly(!withTablesOnly)}
                  className={`px-3 py-1.5 rounded-xl border-[1.5px] text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-1 cursor-pointer ${
                    withTablesOnly
                      ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] shadow-sm'
                      : 'bg-white border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db] hover:border-[#201e1d]'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>With Data Tables</span>
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={withMathOnly}
                  aria-label="Filter questions with calculations or math formulas only"
                  title="Toggle calculations / math filter"
                  onClick={() => setWithMathOnly(!withMathOnly)}
                  className={`px-3 py-1.5 rounded-xl border-[1.5px] text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-1 cursor-pointer ${
                    withMathOnly
                      ? 'bg-[#ffe1d0] border-[#c67139] text-[#c67139] shadow-sm'
                      : 'bg-white border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db] hover:border-[#201e1d]'
                  }`}
                >
                  <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Calculations / Math</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card C: Test Assembly Drawer */}
          <div className="p-5 rounded-3xl bg-[#f9f4ed] border-4 border-[#201e1d] shadow-[8px_8px_0_0_rgba(32,30,29,0.15)] flex flex-col gap-4">
            {/* Summary Header */}
            <div className="flex items-center justify-between border-b-[1.5px] border-[#dcd3c4] pb-4">
              <div>
                <h2 className="font-heading text-xl font-black text-[#201e1d]">Test Assembly</h2>
                <div className="flex gap-3 text-xs font-bold text-[#645c50] mt-1">
                  <span>{selectedQuestionIds.length} Questions</span>
                  <span>•</span>
                  <span>{selectedQuestionIds.length} Marks</span>
                  <span>•</span>
                  <span>~{estimatedTime} mins</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center font-black text-[#201e1d] shadow-offset-2">
                {selectedQuestionIds.length}
              </div>
            </div>

            {/* Collapsible Settings */}
            <div className="flex flex-col gap-3 border-b-[1.5px] border-[#dcd3c4] pb-4">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                aria-expanded={isSettingsOpen}
                aria-label={isSettingsOpen ? 'Collapse layout and settings' : 'Expand layout and settings'}
                className="flex items-center justify-between font-bold text-sm text-[#201e1d] w-full p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] focus-visible:ring-offset-1 active:translate-y-0.5 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" aria-hidden="true" /> Layout & Settings
                </div>
                <span aria-hidden="true">{isSettingsOpen ? '▼' : '▶'}</span>
              </button>

              {isSettingsOpen && (
                <div className="flex flex-col gap-3 mt-1">
                  <input
                    type="text"
                    value={testTitle}
                    onChange={(e) => setTestTitle(e.target.value)}
                    placeholder="Test Title"
                    aria-label="Test Title"
                    className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#c67139]"
                  />
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="School Name"
                    aria-label="School Name"
                    className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#c67139]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={dateString}
                      onChange={(e) => setDateString(e.target.value)}
                      placeholder="Exam Date"
                      aria-label="Exam Date"
                      className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#c67139]"
                    />
                    <input
                      type="number"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 0)}
                      placeholder="Duration (m)"
                      aria-label="Duration in minutes"
                      className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#c67139]"
                    />
                  </div>
                  <input
                    type="text"
                    value={testCode}
                    onChange={(e) => setTestCode(e.target.value)}
                    placeholder="Test Code"
                    aria-label="Test Code"
                    className="w-full px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#c67139]"
                  />

                  {/* Layout Toggles */}
                  <div className="flex flex-col gap-2 mt-2">
                    {[
                      { label: 'Cambridge Cover Page', state: includeCoverPage, set: setIncludeCoverPage, id: 'toggle-cover-page' },
                      { label: 'Candidate Details Header', state: includeCandidateHeader, set: setIncludeCandidateHeader, id: 'toggle-header' },
                      { label: 'Candidate MCQ Bubble Sheet', state: includeBubbleSheet, set: setIncludeBubbleSheet, id: 'toggle-bubble' },
                      { label: 'Teacher Mark Scheme', state: includeMarkScheme, set: setIncludeMarkScheme, id: 'toggle-mark-scheme' },
                    ].map((toggle, i) => (
                      <label key={i} htmlFor={toggle.id} className="flex items-center gap-2.5 text-xs text-[#201e1d] cursor-pointer">
                        <button
                          id={toggle.id}
                          type="button"
                          role="switch"
                          aria-checked={toggle.state}
                          aria-label={toggle.label}
                          onClick={() => toggle.set(!toggle.state)}
                          className={`w-8 h-4 shrink-0 rounded-full relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#728157] focus-visible:ring-offset-2 ${
                            toggle.state ? 'bg-[#728157]' : 'bg-[#c0b6a5]'
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${
                              toggle.state ? 'right-0.5' : 'left-0.5'
                            }`}
                          />
                        </button>
                        <span className="font-bold">{toggle.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Selected Questions List */}
            <div className="flex flex-col gap-2 max-h-[35vh] overflow-y-auto pr-2 no-scrollbar">
              {selectedQuestions.length === 0 ? (
                <div className="text-center py-6 text-[#645c50] text-xs font-medium">
                  No questions selected yet. Add some from the bank.
                </div>
              ) : (
                selectedQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="flex items-start gap-2 p-2 rounded-xl hover:bg-[#eee7db] transition-colors group"
                  >
                    <span className="w-5 text-center text-xs font-black text-[#645c50] mt-0.5">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#201e1d] line-clamp-1">{q.stem_markdown}</div>
                      <div className="text-[10px] text-[#645c50] font-mono mt-0.5">{q.citation || q.id}</div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(idx, 'up')}
                        disabled={idx === 0}
                        aria-label={`Move question ${idx + 1} up`}
                        title="Move question up"
                        className="p-1 hover:bg-[#dcd3c4] rounded disabled:opacity-30 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
                      >
                        <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveQuestion(idx, 'down')}
                        disabled={idx === selectedQuestions.length - 1}
                        aria-label={`Move question ${idx + 1} down`}
                        title="Move question down"
                        className="p-1 hover:bg-[#dcd3c4] rounded disabled:opacity-30 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
                      >
                        <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuestion(idx)}
                        aria-label={`Remove question ${idx + 1} from selection`}
                        title="Remove question"
                        className="p-1 hover:bg-[#ffc6a5] text-[#c67139] rounded ml-1 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139]"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2 border-t-[1.5px] border-[#dcd3c4]">
              {saveSuccess && (
                <div className="text-[11px] font-bold text-[#56633f] flex items-center justify-center gap-1 mb-1">
                  <Check className="w-3 h-3" /> Draft saved
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  title="Save test configuration as draft"
                  aria-label="Save current test configuration as draft"
                  className="flex-1 py-2.5 rounded-full bg-white border-2 border-[#201e1d] font-bold text-xs shadow-[2px_2px_0_0_#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f9f4ed] transition-all cursor-pointer"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePDF}
                  disabled={selectedQuestions.length === 0}
                  title={selectedQuestions.length === 0 ? 'Select questions to generate PDF' : 'Generate printable PDF'}
                  aria-label="Generate printable PDF of compiled test paper"
                  className="flex-[2] py-2.5 rounded-full bg-[#c67139] border-2 border-[#201e1d] text-[#f9f4ed] font-black text-sm shadow-[2px_2px_0_0_#201e1d] hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f9f4ed] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" aria-hidden="true" /> PDF / Print
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-Generate Modal */}
      {isAutoModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auto-generate-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <div className="bg-[#f9f4ed] p-6 rounded-3xl border-4 border-[#201e1d] shadow-[8px_8px_0_0_rgba(32,30,29,0.15)] w-full max-w-sm flex flex-col gap-5">
            <h3 id="auto-generate-modal-title" className="font-heading text-xl font-black text-[#201e1d]">Auto-Generate Config</h3>
            <div className="flex flex-col gap-3">
              <label htmlFor="auto-count-select" className="text-xs font-bold text-[#645c50]">Number of Questions</label>
              <select
                id="auto-count-select"
                aria-label="Number of Questions"
                value={autoCount}
                onChange={(e) => setAutoCount(Number(e.target.value))}
                className="px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-sm font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
              >
                {[5, 10, 15, 20, 30].map((c) => (
                  <option key={c} value={c}>
                    {c} Questions
                  </option>
                ))}
              </select>
              <label htmlFor="auto-topic-select" className="text-xs font-bold text-[#645c50] mt-2">Topic Focus</label>
              <select
                id="auto-topic-select"
                aria-label="Topic Focus"
                value={autoTopicId}
                onChange={(e) => setAutoTopicId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-white border-[1.5px] border-[#dcd3c4] text-sm font-bold text-[#201e1d] outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]"
              >
                <option value="all">All Topics (Mixed)</option>
                {CAMBRIDGE_TOPICS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setIsAutoModalOpen(false)}
                title="Cancel auto-generation"
                aria-label="Cancel auto-generation"
                className="flex-1 py-2 rounded-full border-2 border-[#201e1d] font-bold text-xs hover:bg-[#eee7db] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAutoCompile}
                title="Auto-compile questions"
                aria-label="Auto-compile questions with selected options"
                className="flex-[2] py-2 rounded-full bg-[#201e1d] text-white font-black text-xs hover:bg-[#3d3a36] active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] focus-visible:ring-offset-2 transition-all cursor-pointer"
              >
                Auto-Compile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Drafts Modal */}
      {isDraftsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="saved-drafts-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        >
          <div className="bg-[#f9f4ed] p-6 rounded-3xl border-4 border-[#201e1d] shadow-[8px_8px_0_0_rgba(32,30,29,0.15)] w-full max-w-lg flex flex-col gap-4 max-h-[80vh]">
            <div className="flex items-center justify-between">
              <h3 id="saved-drafts-modal-title" className="font-heading text-xl font-black text-[#201e1d]">Saved Drafts</h3>
              <button
                type="button"
                onClick={() => setIsDraftsModalOpen(false)}
                aria-label="Close saved drafts dialog"
                title="Close dialog"
                className="p-1 hover:bg-[#dcd3c4] rounded-full active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar">
              {drafts.length === 0 ? (
                <div className="text-center py-6 text-[#645c50] text-sm font-bold">No saved drafts found.</div>
              ) : (
                drafts.map((d) => (
                  <div
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Load draft: ${d.title}, ${d.questionIds.length} questions`}
                    onClick={() => handleLoadDraft(d)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleLoadDraft(d);
                      }
                    }}
                    className="p-3 rounded-2xl border-2 border-[#dcd3c4] bg-white hover:border-[#201e1d] cursor-pointer flex items-center justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d] focus-visible:ring-offset-2 active:translate-y-0.5"
                  >
                    <div>
                      <div className="font-bold text-[#201e1d]">{d.title}</div>
                      <div className="text-xs text-[#645c50] mt-0.5">
                        {d.questionIds.length} Questions • {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteDraft(d.id, e)}
                      aria-label={`Delete draft ${d.title}`}
                      title="Delete draft"
                      className="p-2 text-[#c67139] hover:bg-[#ffe1d0] rounded-xl transition-colors active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

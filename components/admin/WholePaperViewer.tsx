'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Filter,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  AlertCircle,
  Layers,
  Check,
  ZoomIn,
  X,
  Table as TableIcon,
  ListOrdered,
  Image as ImageIcon,
  Tag,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import type { StagingPaper, StagedPaperSummary, StagingQuestion } from '@/types/ingestion';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';
import { resolveDiagramUrl } from '@/lib/resolveDiagramUrl';
import { MarkdownErrorBoundary } from '@/components/ui/MarkdownErrorBoundary';

export interface WholePaperViewerProps {
  initialPaperId?: string;
}

export default function WholePaperViewer({ initialPaperId }: WholePaperViewerProps) {
  // Papers list & selection
  const [stagedPapers, setStagedPapers] = useState<StagedPaperSummary[]>([]);
  const [selectedPaperId, setSelectedPaperId] = useState<string>(initialPaperId || '');
  const [loadingList, setLoadingList] = useState<boolean>(true);
  const [listError, setListError] = useState<string | null>(null);

  // Paper content & metadata
  const [paper, setPaper] = useState<StagingPaper | null>(null);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [publishedExamPaperId, setPublishedExamPaperId] = useState<string | null>(null);
  const [isArchived, setIsArchived] = useState<boolean>(false);
  const [loadingPaper, setLoadingPaper] = useState<boolean>(false);
  const [paperError, setPaperError] = useState<string | null>(null);

  // View mode & filters
  const [viewMode, setViewMode] = useState<'continuous' | 'table'>('continuous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [diagramFilter, setDiagramFilter] = useState<'all' | 'with_diagrams' | 'without_diagrams'>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');

  // Explanations expansion state
  const [expandedExplanations, setExpandedExplanations] = useState<Record<number, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean>(false);

  // Diagram zoom modal
  const [zoomedDiagram, setZoomedDiagram] = useState<{
    url: string;
    questionNumber: number;
    alt?: string;
  } | null>(null);

  // 1. Fetch available papers list on mount
  const fetchPapersList = useCallback(async (preferredId?: string) => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch('/api/ingest/staged-paper');
      if (!res.ok) {
        throw new Error(`Failed to list papers: HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load papers');
      }

      const list: StagedPaperSummary[] = data.stagedPapers || data.papers || [];
      setStagedPapers(list);

      // Determine initial selection
      let candidateId = preferredId || selectedPaperId;
      if (!candidateId && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        candidateId = urlParams.get('paperId') || urlParams.get('id') || '';
      }

      const found = list.find((p) => p.id === candidateId);
      if (found) {
        setSelectedPaperId(found.id);
      } else if (list.length > 0) {
        setSelectedPaperId(list[0].id);
      }
    } catch (err: any) {
      console.error('[WholePaperViewer] Error fetching paper list:', err);
      setListError(err?.message || 'Failed to load paper index');
    } finally {
      setLoadingList(false);
    }
  }, [selectedPaperId]);

  useEffect(() => {
    fetchPapersList(initialPaperId);
  }, [fetchPapersList, initialPaperId]);

  // 2. Fetch specific paper whenever selectedPaperId changes
  const loadPaper = useCallback(async (paperId: string) => {
    if (!paperId) return;
    setLoadingPaper(true);
    setPaperError(null);
    try {
      const res = await fetch(`/api/ingest/staged-paper?id=${encodeURIComponent(paperId)}`);
      if (!res.ok) {
        throw new Error(`Failed to load paper "${paperId}": HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success || !data.paper) {
        throw new Error(data.error || `Staged paper "${paperId}" not found`);
      }

      setPaper(data.paper);
      setIsPublished(Boolean(data.is_published));
      setPublishedExamPaperId(data.published_exam_paper_id || null);
      setIsArchived(Boolean(data.is_archived));

      // Reset explanation toggles on paper change
      setExpandedExplanations({});
      setAllExpanded(false);

      // Sync URL parameter paperId
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('paperId', paperId);
        window.history.replaceState(null, '', url.toString());
      }
    } catch (err: any) {
      console.error('[WholePaperViewer] Error loading paper details:', err);
      setPaperError(err?.message || 'Failed to load staged paper content');
    } finally {
      setLoadingPaper(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPaperId) {
      loadPaper(selectedPaperId);
    }
  }, [selectedPaperId, loadPaper]);

  // Metric derivations
  const questionsList = useMemo(() => paper?.questions || [], [paper]);
  const totalQuestions = questionsList.length;

  const diagramsCount = useMemo(() => {
    return questionsList.filter((q) => Boolean(q.diagram?.has_diagram || q.diagram?.image_url)).length;
  }, [questionsList]);

  const answerKeyBreakdown = useMemo(() => {
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    questionsList.forEach((q) => {
      const correct = q.options?.find((o) => o.is_correct);
      if (correct?.label && counts[correct.label] !== undefined) {
        counts[correct.label]++;
      }
    });
    return counts;
  }, [questionsList]);

  const topicsList = useMemo(() => {
    const set = new Set<string>();
    questionsList.forEach((q) => {
      if (q.topic_name) {
        set.add(q.topic_name.trim());
      }
    });
    return Array.from(set).sort();
  }, [questionsList]);

  // Filtering questions
  const filteredQuestions = useMemo(() => {
    return questionsList.filter((q) => {
      // 1. Diagram filter
      const hasDiag = Boolean(q.diagram?.has_diagram || q.diagram?.image_url);
      if (diagramFilter === 'with_diagrams' && !hasDiag) return false;
      if (diagramFilter === 'without_diagrams' && hasDiag) return false;

      // 2. Topic filter
      if (topicFilter !== 'all' && q.topic_name !== topicFilter) return false;

      // 3. Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const numMatch = `q${q.question_number}`.includes(query) || `${q.question_number}` === query;
        const stemMatch = (q.stem_markdown || '').toLowerCase().includes(query);
        const refMatch = (q.cambridge_source_ref || '').toLowerCase().includes(query);
        const topicMatch = (q.topic_name || '').toLowerCase().includes(query);
        const optionMatch = (q.options || []).some((opt) =>
          (opt.content_markdown || '').toLowerCase().includes(query)
        );
        const expMatch = (q.explanation_markdown || '').toLowerCase().includes(query);

        if (!numMatch && !stemMatch && !refMatch && !topicMatch && !optionMatch && !expMatch) {
          return false;
        }
      }

      return true;
    });
  }, [questionsList, diagramFilter, topicFilter, searchQuery]);

  // Explanation toggles
  const toggleExplanation = (questionNumber: number) => {
    setExpandedExplanations((prev) => ({
      ...prev,
      [questionNumber]: !prev[questionNumber],
    }));
  };

  const handleToggleAllExplanations = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const updated: Record<number, boolean> = {};
    questionsList.forEach((q) => {
      updated[q.question_number] = nextState;
    });
    setExpandedExplanations(updated);
  };

  // Smooth scroll jump to question card
  const scrollToQuestion = (questionNumber: number) => {
    if (viewMode !== 'continuous') {
      setViewMode('continuous');
      // Wait one tick for layout switch
      setTimeout(() => {
        const el = document.getElementById(`question-q${questionNumber}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    } else {
      const el = document.getElementById(`question-q${questionNumber}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Series formatting helper
  const formatSeriesText = (series?: string, year?: number) => {
    if (!series && !year) return 'Cambridge IGCSE Exam Paper';
    const s = (series || '').toLowerCase();
    let seriesLabel = series || '';
    if (s === 's' || s.includes('may') || s.includes('june')) seriesLabel = 'May/June';
    else if (s === 'm' || s.includes('feb') || s.includes('march')) seriesLabel = 'Feb/March';
    else if (s === 'w' || s.includes('oct') || s.includes('nov')) seriesLabel = 'Oct/Nov';
    return `${seriesLabel} ${year || ''}`.trim();
  };

  return (
    <div className="w-full space-y-5 font-body text-[#201e1d]">
      {/* ── Print-only Header (Visible during window.print()) ── */}
      <div className="hidden print:block p-4 mb-6 border-b-2 border-black text-black">
        <div className="text-center space-y-1">
          <div className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-600">
            Cambridge Assessment International Education
          </div>
          <h1 className="text-xl font-bold font-heading">
            {paper?.subject?.code} {paper?.subject?.name || 'Economics'}
          </h1>
          <div className="text-sm font-medium">
            Paper {paper?.paper?.paper_code || '12'} Multiple Choice ·{' '}
            {formatSeriesText(paper?.paper?.series, paper?.paper?.year)}
          </div>
          <div className="text-xs font-mono text-neutral-500 pt-1">
            Total Questions: {totalQuestions} · Answer Key Distribution: [A: {answerKeyBreakdown.A}, B:{' '}
            {answerKeyBreakdown.B}, C: {answerKeyBreakdown.C}, D: {answerKeyBreakdown.D}]
          </div>
        </div>
      </div>

      {/* ── Control Deck: Paper Selector & Actions ── */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_#201e1d] space-y-4 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Badge */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-[#ffe1d0] border border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#8c491a] shadow-xs">
                CAMBRIDGE INGESTION ARCHIVE
              </span>
              {isPublished ? (
                <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-xs font-mono font-black text-[#272e1b] flex items-center gap-1 shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" />
                  Live in Supabase
                </span>
              ) : isArchived ? (
                <span className="px-2.5 py-0.5 rounded-full bg-[#eee7db] border border-[#201e1d]/30 text-xs font-mono font-bold text-[#645c50]">
                  Archived
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-[#fff2eb] border border-[#201e1d]/40 text-xs font-mono font-bold text-[#b91c1c]">
                  Staged (Review)
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#201e1d] font-heading tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[#201e1d]" />
              Whole Paper Viewer
            </h1>
            <p className="text-xs sm:text-sm font-medium text-[#645c50]">
              Continuous exam paper reading experience with mathematical typography, diagrams, and distractor derivations.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (selectedPaperId) {
                  loadPaper(selectedPaperId);
                } else {
                  fetchPapersList();
                }
              }}
              disabled={loadingPaper || loadingList}
              className="px-3.5 py-2 rounded-xl bg-[#f5ead8] border-2 border-[#201e1d] font-heading font-black text-xs text-[#201e1d] shadow-[2px_2px_0_#201e1d] hover:bg-[#ffe1d0] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Refresh current paper"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPaper ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={!paper || loadingPaper}
              className="px-3.5 py-2 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] font-heading font-black text-xs text-[#272e1b] shadow-[2px_2px_0_#201e1d] hover:bg-[#b8c99d] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              title="Print clean A4 Cambridge exam paper"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Paper</span>
            </button>
          </div>
        </div>

        {/* Paper Selector Dropdown & Quick Details */}
        <div className="pt-2 border-t-2 border-[#201e1d]/15 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 max-w-xl">
            <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
              Select Ingested Cambridge Paper:
            </label>
            <div className="relative">
              <select
                value={selectedPaperId}
                onChange={(e) => setSelectedPaperId(e.target.value)}
                disabled={loadingList || stagedPapers.length === 0}
                className="w-full bg-white border-2 border-[#201e1d] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-heading font-bold text-[#201e1d] shadow-[2px_2px_0_#201e1d] focus:outline-none focus:ring-2 focus:ring-[#ffe1d0] appearance-none pr-9 cursor-pointer"
              >
                {stagedPapers.length === 0 ? (
                  <option value="">No staged papers found</option>
                ) : (
                  stagedPapers.map((p) => {
                    const subjectCode = p.subject?.code || '';
                    const subjectName = p.subject?.name ? ` ${p.subject.name}` : '';
                    const series = p.paper?.series ? ` ${p.paper.series.toUpperCase()}` : '';
                    const year = p.paper?.year ? `${p.paper.year}` : '';
                    const paperCode = p.paper?.paper_code ? ` P${p.paper.paper_code}` : '';
                    const qCount = p.questionsCount !== undefined ? ` (${p.questionsCount} Qs)` : '';
                    const statusStr = p.is_published ? ' [Live]' : p.is_archived ? ' [Archived]' : '';

                    return (
                      <option key={p.id} value={p.id}>
                        {p.id} — {subjectCode}
                        {subjectName}
                        {series}
                        {year}
                        {paperCode}
                        {qCount}
                        {statusStr}
                      </option>
                    );
                  })
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-[#201e1d] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>

          {/* View mode toggle switch */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 md:pt-0">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
              View Mode:
            </span>
            <div className="inline-flex p-1 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] shadow-offset-1">
              <button
                type="button"
                onClick={() => setViewMode('continuous')}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'continuous'
                    ? 'bg-[#ffe1d0] border border-[#201e1d] text-[#201e1d] shadow-xs'
                    : 'text-[#645c50] hover:text-[#201e1d]'
                }`}
              >
                <ListOrdered className="w-3.5 h-3.5" />
                <span>Continuous Paper</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-heading font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-[#ffe1d0] border border-[#201e1d] text-[#201e1d] shadow-xs'
                    : 'text-[#645c50] hover:text-[#201e1d]'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Mark Scheme Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Paper Metadata & Metrics Strip */}
        {paper && (
          <div className="pt-3 border-t-2 border-[#201e1d]/15 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {/* Subject */}
            <div className="p-2.5 rounded-xl bg-white border border-[#201e1d] shadow-xs">
              <span className="text-[10px] font-mono uppercase text-[#645c50] block font-bold">
                Subject
              </span>
              <span className="text-xs font-heading font-black text-[#201e1d] truncate block">
                {paper.subject?.code} {paper.subject?.name || 'Economics'}
              </span>
            </div>

            {/* Series & Paper */}
            <div className="p-2.5 rounded-xl bg-white border border-[#201e1d] shadow-xs">
              <span className="text-[10px] font-mono uppercase text-[#645c50] block font-bold">
                Series & Paper
              </span>
              <span className="text-xs font-heading font-black text-[#201e1d] truncate block">
                {formatSeriesText(paper.paper?.series, paper.paper?.year)} · P
                {paper.paper?.paper_code || '12'}
              </span>
            </div>

            {/* Total Questions */}
            <div className="p-2.5 rounded-xl bg-white border border-[#201e1d] shadow-xs">
              <span className="text-[10px] font-mono uppercase text-[#645c50] block font-bold">
                Total Questions
              </span>
              <span className="text-xs font-heading font-black text-[#201e1d] flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-[#8c491a]" />
                {totalQuestions} Questions
              </span>
            </div>

            {/* Diagrams Count */}
            <div className="p-2.5 rounded-xl bg-white border border-[#201e1d] shadow-xs">
              <span className="text-[10px] font-mono uppercase text-[#645c50] block font-bold">
                Diagrams
              </span>
              <span className="text-xs font-heading font-black text-[#201e1d] flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-blue-700" />
                {diagramsCount} with Diagrams
              </span>
            </div>

            {/* Answer Key Distribution */}
            <div className="col-span-2 p-2.5 rounded-xl bg-white border border-[#201e1d] shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-[#645c50] font-bold">
                  Answer Key Distribution
                </span>
                <span className="text-[10px] font-mono font-bold text-[#8c491a]">
                  Sum: {totalQuestions}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                {(['A', 'B', 'C', 'D'] as const).map((keyLetter) => (
                  <span
                    key={keyLetter}
                    className="flex-1 px-1.5 py-0.5 rounded-lg bg-[#f0fae1] border border-[#8fa073] text-[11px] font-mono font-bold text-[#3d472b] text-center"
                    title={`Option ${keyLetter} is correct in ${answerKeyBreakdown[keyLetter]} questions`}
                  >
                    <span className="font-heading font-black text-[#201e1d]">{keyLetter}:</span>{' '}
                    {answerKeyBreakdown[keyLetter]}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Interactive Question Jump Bar ── */}
      {paper && questionsList.length > 0 && (
        <div className="bg-[#ebddc5] border-2 border-[#201e1d] rounded-2xl p-3 shadow-[2px_2px_0_#201e1d] space-y-2 print:hidden sticky top-2 z-20">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="font-heading font-black text-[#201e1d] flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[#8c491a]" />
              Question Navigation Bar (Q1 – Q{totalQuestions})
            </span>
            <span className="text-[11px] font-mono text-[#645c50]">
              Click pill to jump smoothly
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {questionsList.map((q) => {
              const correctOpt = q.options?.find((o) => o.is_correct);
              const keyLetter = correctOpt?.label || '?';
              const hasDiag = Boolean(q.diagram?.has_diagram || q.diagram?.image_url);

              return (
                <button
                  key={q.question_number}
                  type="button"
                  onClick={() => scrollToQuestion(q.question_number)}
                  className="shrink-0 px-2.5 py-1.5 rounded-xl bg-white border border-[#201e1d] font-mono text-xs font-bold text-[#201e1d] shadow-offset-1 hover:bg-[#ffe1d0] active:translate-y-0.5 transition-all flex items-center gap-1 cursor-pointer"
                  title={`Jump to Q${q.question_number} (Correct: ${keyLetter}${hasDiag ? ', with diagram' : ''})`}
                >
                  <span className="font-heading font-black">Q{q.question_number}</span>
                  <span className="text-[10px] px-1 py-0.2 rounded bg-[#ccdbb2] border border-[#201e1d]/40 font-bold text-[#272e1b]">
                    {keyLetter}
                  </span>
                  {hasDiag && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filter Bar ── */}
      {paper && (
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3.5 shadow-offset-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 print:hidden">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#645c50] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search stem text, options, citations, formulas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-medium text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#ffe1d0]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#645c50] hover:text-[#201e1d]"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Toggles & Topic dropdown */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Diagram filter pills */}
            <div className="inline-flex p-0.5 rounded-xl bg-[#eee7db] border border-[#201e1d] text-xs font-bold">
              <button
                type="button"
                onClick={() => setDiagramFilter('all')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  diagramFilter === 'all'
                    ? 'bg-white border border-[#201e1d] text-[#201e1d] shadow-xs'
                    : 'text-[#645c50] hover:text-[#201e1d]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setDiagramFilter('with_diagrams')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                  diagramFilter === 'with_diagrams'
                    ? 'bg-white border border-[#201e1d] text-[#201e1d] shadow-xs'
                    : 'text-[#645c50] hover:text-[#201e1d]'
                }`}
              >
                <ImageIcon className="w-3 h-3" />
                With Diagrams ({diagramsCount})
              </button>
              <button
                type="button"
                onClick={() => setDiagramFilter('without_diagrams')}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  diagramFilter === 'without_diagrams'
                    ? 'bg-white border border-[#201e1d] text-[#201e1d] shadow-xs'
                    : 'text-[#645c50] hover:text-[#201e1d]'
                }`}
              >
                No Diagrams
              </button>
            </div>

            {/* Topic Filter */}
            {topicsList.length > 0 && (
              <select
                value={topicFilter}
                onChange={(e) => setTopicFilter(e.target.value)}
                className="bg-white border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#ffe1d0] cursor-pointer"
              >
                <option value="all">All Topics ({topicsList.length})</option>
                {topicsList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

            {/* Toggle all derivations button (only continuous view) */}
            {viewMode === 'continuous' && (
              <button
                type="button"
                onClick={handleToggleAllExplanations}
                className="px-3 py-1.5 rounded-xl bg-white border border-[#201e1d] text-xs font-bold text-[#474238] hover:bg-[#ffe1d0] transition-colors shadow-xs cursor-pointer"
              >
                {allExpanded ? 'Collapse All Derivations' : 'Expand All Derivations'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Status Messages & Loading / Error States ── */}
      {loadingPaper && (
        <div className="py-16 text-center space-y-3 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl shadow-offset-2">
          <div className="w-8 h-8 rounded-full border-4 border-[#201e1d] border-t-transparent animate-spin mx-auto" />
          <div className="font-heading font-black text-sm text-[#201e1d]">
            Loading Staged Paper & Questions...
          </div>
          <p className="text-xs text-[#645c50]">
            Sanitizing LaTeX expressions, resolving diagram paths, and parsing answer keys.
          </p>
        </div>
      )}

      {paperError && !loadingPaper && (
        <div className="p-6 rounded-2xl bg-[#fee2e2] border-2 border-[#b91c1c] text-[#7f1d1d] space-y-2 shadow-offset-2">
          <div className="font-heading font-black text-base flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#b91c1c]" />
            Error Loading Staged Paper
          </div>
          <p className="text-xs font-medium">{paperError}</p>
          <button
            type="button"
            onClick={() => selectedPaperId && loadPaper(selectedPaperId)}
            className="px-3 py-1.5 rounded-lg bg-white border border-[#b91c1c] text-xs font-bold text-[#b91c1c] hover:bg-neutral-50 shadow-xs cursor-pointer mt-2"
          >
            Retry Loading
          </button>
        </div>
      )}

      {/* ── Content View 1: Continuous Exam Paper ── */}
      {!loadingPaper && !paperError && paper && viewMode === 'continuous' && (
        <div className="space-y-6">
          {filteredQuestions.length === 0 ? (
            <div className="py-16 text-center space-y-2 bg-white border-2 border-dashed border-[#c0b6a5] rounded-2xl">
              <div className="text-3xl">🔍</div>
              <div className="font-heading font-black text-base text-[#201e1d]">
                No Questions Match Current Filters
              </div>
              <p className="text-xs text-[#645c50]">
                Try adjusting your search query, topic filter, or diagram toggle.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDiagramFilter('all');
                  setTopicFilter('all');
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#ffe1d0] border border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-1 hover:bg-[#ffc6a5] cursor-pointer mt-2"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const sanitizedStem = sanitizeKaTeX(q.stem_markdown || '');
              const isExplanationOpen = Boolean(expandedExplanations[q.question_number]);
              const hasDiag = Boolean(q.diagram?.has_diagram || q.diagram?.image_url);
              const diagramUrl = resolveDiagramUrl(q.diagram?.image_url) || q.diagram?.image_url;

              return (
                <article
                  key={q.question_number}
                  id={`question-q${q.question_number}`}
                  className="bg-white border-2 border-[#201e1d] rounded-2xl p-5 sm:p-6 shadow-[3px_3px_0_#201e1d] space-y-4 print:shadow-none print:border-black print:rounded-none print:break-inside-avoid print:p-4"
                >
                  {/* Question Header Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#201e1d]/15">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-full bg-[#201e1d] text-[#f9f4ed] font-heading font-black text-xs shadow-xs">
                        Q{q.question_number}
                      </span>

                      {q.cambridge_source_ref && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#eee7db] text-[#474238] font-mono text-[11px] font-bold">
                          {q.cambridge_source_ref}
                        </span>
                      )}

                      {q.topic_name && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#f0fae1] border border-[#8fa073] text-[#3d472b] text-[11px] font-bold flex items-center gap-1">
                          <Tag className="w-3 h-3 text-[#56633f]" />
                          {q.topic_name}
                        </span>
                      )}

                      {hasDiag && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#ffe1d0] border border-[#201e1d]/30 text-[#8c491a] text-[11px] font-bold flex items-center gap-1 print:hidden">
                          <ImageIcon className="w-3 h-3" />
                          Diagram
                        </span>
                      )}
                    </div>

                    {/* Page number badge if available */}
                    {q.page_number && (
                      <span className="text-[11px] font-mono text-[#645c50] font-bold">
                        Page {q.page_number}
                      </span>
                    )}
                  </div>

                  {/* Question Stem Text */}
                  <div className="prose prose-sm sm:prose-base max-w-none text-[#201e1d] font-medium leading-relaxed">
                    <MarkdownErrorBoundary fallbackText={sanitizedStem}>
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {sanitizedStem || '_No question stem content provided._'}
                      </ReactMarkdown>
                    </MarkdownErrorBoundary>
                  </div>

                  {/* Question Diagram / Graphic */}
                  {hasDiag && (
                    <div className="p-3 sm:p-4 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] flex flex-col items-center justify-center gap-2 print:border-black print:bg-white">
                      {diagramUrl ? (
                        <div className="relative group flex flex-col items-center">
                          <img
                            src={diagramUrl}
                            alt={
                              q.diagram?.alt_description ||
                              `Cambridge Exam Diagram for Question ${q.question_number}`
                            }
                            className="max-h-72 w-auto object-contain rounded-lg border border-[#201e1d]/20 bg-white p-1 cursor-zoom-in hover:shadow-md transition-shadow"
                            onClick={() =>
                              setZoomedDiagram({
                                url: diagramUrl,
                                questionNumber: q.question_number,
                                alt: q.diagram?.alt_description,
                              })
                            }
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setZoomedDiagram({
                                url: diagramUrl,
                                questionNumber: q.question_number,
                                alt: q.diagram?.alt_description,
                              })
                            }
                            className="mt-2.5 px-3 py-1 rounded-lg bg-white border border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-1 hover:bg-[#ffe1d0] flex items-center gap-1.5 transition-colors cursor-pointer print:hidden"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                            <span>Click to Zoom Diagram</span>
                          </button>
                        </div>
                      ) : (
                        <div className="py-4 text-center text-xs text-[#645c50] font-bold flex flex-col items-center gap-1">
                          <ImageIcon className="w-6 h-6 text-[#82796a]" />
                          <span>Diagram referenced in official Cambridge Question Paper</span>
                          {q.diagram?.bounding_box && (
                            <span className="font-mono text-[10px] text-[#82796a]">
                              Page {q.diagram.bounding_box.page_number} coordinates [
                              {q.diagram.bounding_box.xmin}, {q.diagram.bounding_box.ymin},{' '}
                              {q.diagram.bounding_box.xmax}, {q.diagram.bounding_box.ymax}]
                            </span>
                          )}
                        </div>
                      )}

                      {q.diagram?.alt_description && (
                        <p className="text-[11px] text-[#645c50] italic text-center max-w-lg mt-1">
                          {q.diagram.alt_description}
                        </p>
                      )}
                    </div>
                  )}

                  {/* 4 MCQ Options */}
                  <div className="space-y-2 pt-1">
                    <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50] px-0.5">
                      Options & Key:
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {(q.options || []).map((opt) => {
                        const isCorrect = Boolean(opt.is_correct);
                        const sanitizedOpt = sanitizeKaTeX(opt.content_markdown || '');

                        return (
                          <div
                            key={opt.label}
                            className={`p-3 sm:p-3.5 rounded-xl border-2 transition-all flex items-start gap-3 ${
                              isCorrect
                                ? 'bg-[#f0fae1] border-[#728157] text-[#201e1d] shadow-[2px_2px_0_#728157]'
                                : 'bg-white border-[#201e1d]/25 hover:border-[#201e1d] text-[#201e1d]'
                            }`}
                          >
                            {/* Option letter pill */}
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center font-heading font-black text-xs shrink-0 mt-0.5 ${
                                isCorrect
                                  ? 'bg-[#728157] text-[#f9f4ed]'
                                  : 'bg-[#eee7db] text-[#201e1d] border border-[#201e1d]/20'
                              }`}
                            >
                              {opt.label}
                            </span>

                            {/* Option markdown */}
                            <div className="flex-1 min-w-0 prose prose-sm max-w-none text-xs sm:text-sm font-medium leading-relaxed">
                              <MarkdownErrorBoundary fallbackText={sanitizedOpt}>
                                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                                  {sanitizedOpt || '_Empty option_'}
                                </ReactMarkdown>
                              </MarkdownErrorBoundary>
                            </div>

                            {/* Correct indicator badge */}
                            {isCorrect && (
                              <span className="shrink-0 px-2.5 py-1 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[11px] font-heading font-black text-[#272e1b] flex items-center gap-1 shadow-xs">
                                <Check className="w-3.5 h-3.5 text-emerald-800" />
                                <span>Correct Key</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Expandable Mark Scheme & Distractor Derivation */}
                  <div className="pt-2">
                    <div className="rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleExplanation(q.question_number)}
                        className="w-full px-4 py-2.5 bg-[#eee7db] hover:bg-[#e4dac9] transition-colors flex items-center justify-between text-xs font-heading font-black text-[#201e1d] cursor-pointer print:hidden"
                      >
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-[#8c491a]" />
                          <span>Mark Scheme Derivation & Distractor Analysis</span>
                        </div>
                        {isExplanationOpen ? (
                          <ChevronUp className="w-4 h-4 text-[#201e1d]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[#201e1d]" />
                        )}
                      </button>

                      {/* Content (Visible if expanded or during printing) */}
                      <div
                        className={`p-4 bg-white border-t-2 border-[#201e1d] space-y-3 ${
                          isExplanationOpen ? 'block' : 'hidden print:block'
                        }`}
                      >
                        {/* Distractor analysis record if present */}
                        {q.distractor_analysis && Object.keys(q.distractor_analysis).length > 0 && (
                          <div className="space-y-2 pb-3 border-b border-[#201e1d]/15">
                            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50] block">
                              Option-by-Option Distractor Breakdown:
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {Object.entries(q.distractor_analysis).map(([optKey, text]) => {
                                const isCorrect = q.options?.find(
                                  (o) => o.label === optKey && o.is_correct
                                );
                                return (
                                  <div
                                    key={optKey}
                                    className={`p-2.5 rounded-xl border text-xs leading-relaxed ${
                                      isCorrect
                                        ? 'bg-[#f0fae1] border-[#8fa073] text-[#272e1b]'
                                        : 'bg-[#fff9f2] border-[#e2d5c3] text-[#474238]'
                                    }`}
                                  >
                                    <span className="font-heading font-black text-[#201e1d] mr-1.5">
                                      Option {optKey} {isCorrect ? '(Correct)' : '(Incorrect)'}:
                                    </span>
                                    <span>{text}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Full explanation markdown */}
                        <div className="prose prose-sm max-w-none text-[#201e1d] leading-relaxed">
                          <MarkdownErrorBoundary
                            fallbackText={sanitizeKaTeX(q.explanation_markdown || '')}
                          >
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {sanitizeKaTeX(
                                q.explanation_markdown || '_No official explanation provided._'
                              )}
                            </ReactMarkdown>
                          </MarkdownErrorBoundary>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* ── Content View 2: Mark Scheme Table View ── */}
      {!loadingPaper && !paperError && paper && viewMode === 'table' && (
        <div className="bg-white border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_#201e1d] overflow-hidden">
          <div className="p-4 bg-[#ebddc5] border-b-2 border-[#201e1d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TableIcon className="w-5 h-5 text-[#201e1d]" />
              <h3 className="font-heading font-black text-sm text-[#201e1d]">
                Cambridge Official Mark Scheme Table
              </h3>
            </div>
            <span className="text-xs font-mono font-bold text-[#645c50]">
              Showing {filteredQuestions.length} of {totalQuestions} questions
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#f5ead8] border-b-2 border-[#201e1d] font-heading font-black text-[#201e1d]">
                  <th className="p-3 w-16 text-center">Q#</th>
                  <th className="p-3 w-20 text-center">Key</th>
                  <th className="p-3">Syllabus Topic</th>
                  <th className="p-3">Cambridge Citation</th>
                  <th className="p-3 w-24 text-center">Diagram</th>
                  <th className="p-3">Mark Scheme Summary</th>
                  <th className="p-3 w-24 text-right print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#201e1d]/15">
                {filteredQuestions.map((q) => {
                  const correctOpt = q.options?.find((o) => o.is_correct);
                  const keyLetter = correctOpt?.label || '-';
                  const hasDiag = Boolean(q.diagram?.has_diagram || q.diagram?.image_url);
                  const cleanExpSnippet = (q.explanation_markdown || '')
                    .replace(/[#*`$\\]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 110);

                  return (
                    <tr key={q.question_number} className="hover:bg-[#fff9f2] transition-colors">
                      <td className="p-3 text-center font-heading font-black text-sm text-[#201e1d]">
                        Q{q.question_number}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex w-7 h-7 rounded-lg bg-[#ccdbb2] border border-[#201e1d] font-heading font-black text-xs text-[#272e1b] items-center justify-center shadow-xs">
                          {keyLetter}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-[#201e1d] max-w-xs">
                        {q.topic_name || 'General'}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-[#645c50] max-w-xs truncate">
                        {q.cambridge_source_ref || `0455 Q${q.question_number}`}
                      </td>
                      <td className="p-3 text-center">
                        {hasDiag ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ffe1d0] border border-[#201e1d]/30 text-[10px] font-bold text-[#8c491a]">
                            <ImageIcon className="w-3 h-3" />
                            Yes
                          </span>
                        ) : (
                          <span className="text-[11px] text-[#a19786] font-mono">None</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-[#474238] max-w-md">
                        <span className="line-clamp-2">{cleanExpSnippet || 'Derivation available'}</span>
                      </td>
                      <td className="p-3 text-right print:hidden">
                        <button
                          type="button"
                          onClick={() => scrollToQuestion(q.question_number)}
                          className="px-2.5 py-1 rounded-lg bg-[#ffe1d0] border border-[#201e1d] font-heading font-bold text-[11px] text-[#201e1d] hover:bg-[#ffc6a5] transition-colors shadow-xs active:translate-y-0.5 cursor-pointer whitespace-nowrap"
                        >
                          View Card
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Diagram Enlarge Zoom Modal ── */}
      {zoomedDiagram && (
        <div
          className="fixed inset-0 z-50 bg-[#201e1d]/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
          onClick={() => setZoomedDiagram(null)}
        >
          <div
            className="bg-[#f9f4ed] border-3 border-[#201e1d] rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-[6px_6px_0_#201e1d] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-[#ebddc5] border-b-2 border-[#201e1d] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-[#201e1d]" />
                <h3 className="font-heading font-black text-sm sm:text-base text-[#201e1d]">
                  Question {zoomedDiagram.questionNumber} Diagram Enlarge
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setZoomedDiagram(null)}
                className="p-1 rounded-xl bg-white border-2 border-[#201e1d] hover:bg-[#ffe1d0] transition-colors cursor-pointer"
                aria-label="Close Diagram"
              >
                <X className="w-4 h-4 text-[#201e1d]" />
              </button>
            </div>

            {/* Modal Image Body */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-white min-h-[300px]">
              <img
                src={zoomedDiagram.url}
                alt={zoomedDiagram.alt || 'Enlarged diagram'}
                className="max-h-[65vh] w-auto max-w-full object-contain rounded-lg"
              />
              {zoomedDiagram.alt && (
                <p className="mt-4 text-xs text-[#645c50] text-center max-w-xl italic">
                  {zoomedDiagram.alt}
                </p>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-[#f5ead8] border-t-2 border-[#201e1d] flex justify-end">
              <button
                type="button"
                onClick={() => setZoomedDiagram(null)}
                className="px-4 py-1.5 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] font-heading font-black text-xs text-[#201e1d] shadow-offset-1 hover:bg-[#ffc6a5] cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

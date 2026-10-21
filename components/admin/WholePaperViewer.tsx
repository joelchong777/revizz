'use client';
import { authFetch } from '../../lib/authFetch';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Image as ImageIcon,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ChevronDown,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutList,
  Trash2,
  X,
} from 'lucide-react';

import type { StagingPaper, StagedPaperSummary } from '@/types/ingestion';
import {
  filterPaperQuestions,
  formatSeriesText,
  getAnswerKeyBreakdown,
  hasDiagram,
  isTypingTarget,
  stepQuestion,
  type DiagramFilter,
} from '@/lib/paperViewer';
import { PaperQuestionCard } from '@/components/admin/paper-viewer/PaperQuestionCard';
import { PaperDropdown } from '@/components/admin/paper-viewer/PaperDropdown';
import { PaperTableView } from '@/components/admin/paper-viewer/PaperTableView';

export interface WholePaperViewerProps {
  initialPaperId?: string;
}

const PANEL = 'bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[3px_3px_0_0_#201e1d] print:hidden';
const LABEL = 'text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50]';

function ToggleRow({
  label,
  pressed,
  onClick,
}: {
  label: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] hover:bg-[#eee7db] transition-colors cursor-pointer"
    >
      <span>{label}</span>
      <span
        className={`w-8 h-[18px] rounded-full border-2 border-[#201e1d] relative transition-colors ${
          pressed ? 'bg-[#728157]' : 'bg-[#eee7db]'
        }`}
        aria-hidden="true"
      >
        <span
          className={`absolute top-[1px] w-3 h-3 rounded-full bg-[#201e1d] transition-all ${
            pressed ? 'left-[15px]' : 'left-[1px]'
          }`}
        />
      </span>
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex p-0.5 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] text-xs font-bold gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 px-2 py-1 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 whitespace-nowrap ${
            value === o.value ? 'bg-white border border-[#201e1d] text-[#201e1d]' : 'text-[#645c50] hover:text-[#201e1d]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
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
  const [paperSource, setPaperSource] = useState<'database' | 'staging' | string>('staging');
  const [loadingPaper, setLoadingPaper] = useState<boolean>(false);
  const [paperError, setPaperError] = useState<string | null>(null);

  // Delete paper states
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<{ message: string; deletedCount?: number } | null>(null);

  // View mode & filters
  const [viewMode, setViewMode] = useState<'continuous' | 'table'>('continuous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [diagramFilter, setDiagramFilter] = useState<DiagramFilter>('all');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [showAnswers, setShowAnswers] = useState<boolean>(true);
  const [panelOpen, setPanelOpen] = useState<boolean>(false); // phone/tablet collapsible

  // Explanations expansion state
  const [expandedExplanations, setExpandedExplanations] = useState<Record<number, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean>(false);

  // Diagram zoom modal
  const [zoomedDiagram, setZoomedDiagram] = useState<{
    url: string;
    questionNumber: number;
    alt?: string;
  } | null>(null);

  // Active question tracking, feed scroll
  const [activeQ, setActiveQ] = useState<number | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [scrollFadeState, setScrollFadeState] = useState<'top' | 'middle' | 'bottom' | 'none'>('top');
  const feedRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const lockActiveUntilRef = useRef<number>(0);
  const pendingScrollRef = useRef<number | null>(null);

  // 1. Fetch available papers list on mount
  const fetchPapersList = useCallback(async (preferredId?: string) => {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await authFetch('/api/ingest/staged-paper');
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
        // Default to the first available paper with questions (e.g. 0455_w24_11 or 0455_m24_12)
        const firstWithQuestions = list.find((p) => (p.questionsCount ?? 0) > 0) || list[0];
        setSelectedPaperId(firstWithQuestions.id);
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
      const res = await authFetch(`/api/ingest/staged-paper?id=${encodeURIComponent(paperId)}`);
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
      setPaperSource(data.source || data.paper?.source || (data.is_published ? 'database' : 'staging'));

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

  // Delete paper handler
  const handleDeletePaper = async () => {
    const targetId = publishedExamPaperId || selectedPaperId || paper?.id || '';
    if (!targetId) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await authFetch(`/api/ingest/staged-paper?id=${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to delete paper (HTTP ${res.status})`);
      }

      // Clean localStorage for any relating question IDs: revizz_guest_review_pile, revizz_first_try_correct_ids
      if (typeof window !== 'undefined') {
        try {
          const questionIdsToRemove = new Set<string>();
          (paper?.questions || []).forEach((q: any) => {
            if (q.cambridge_source_ref) questionIdsToRemove.add(q.cambridge_source_ref);
            if (q.id) questionIdsToRemove.add(q.id);
            if (q.question_number) {
              questionIdsToRemove.add(`${targetId}_q${q.question_number}`);
              questionIdsToRemove.add(`q${q.question_number}`);
            }
          });

          // 1. Clean revizz_guest_review_pile
          const storedPile = localStorage.getItem('revizz_guest_review_pile');
          if (storedPile) {
            try {
              const parsed = JSON.parse(storedPile);
              if (Array.isArray(parsed)) {
                const filtered = parsed.filter((item: any) => {
                  const id = typeof item === 'string' ? item : item?.questionId || item?.id;
                  return !questionIdsToRemove.has(id);
                });
                localStorage.setItem('revizz_guest_review_pile', JSON.stringify(filtered));
              }
            } catch {
              // ignore parse errors
            }
          }

          // 2. Clean revizz_first_try_correct_ids
          const storedFirstTry = localStorage.getItem('revizz_first_try_correct_ids');
          if (storedFirstTry) {
            try {
              const parsed = JSON.parse(storedFirstTry);
              if (Array.isArray(parsed)) {
                const filtered = parsed.filter((id: string) => !questionIdsToRemove.has(id));
                localStorage.setItem('revizz_first_try_correct_ids', JSON.stringify(filtered));
              }
            } catch {
              // ignore parse errors
            }
          }
        } catch (lsErr) {
          console.warn('[WholePaperViewer] Error clearing localStorage:', lsErr);
        }
      }

      const deletedCount = data.deletedQuestionsCount ?? data.deletedCount ?? paper?.questions?.length ?? 0;
      setSuccessBanner({
        message: `Paper "${targetId}" and all relating questions and logs were permanently deleted.`,
        deletedCount,
      });

      setIsDeleteDialogOpen(false);
      setPaper(null);
      setSelectedPaperId('');

      // Refresh paper list to pick next available paper
      await fetchPapersList();
    } catch (err: any) {
      console.error('[WholePaperViewer] Error deleting paper:', err);
      setDeleteError(err?.message || 'Failed to delete paper');
    } finally {
      setIsDeleting(false);
    }
  };

  // Metric derivations
  const questionsList = useMemo(() => paper?.questions || [], [paper]);
  const totalQuestions = questionsList.length;
  const diagramsCount = useMemo(() => questionsList.filter(hasDiagram).length, [questionsList]);
  const answerKeyBreakdown = useMemo(() => getAnswerKeyBreakdown(questionsList), [questionsList]);

  const selectedSummary = useMemo(() => {
    return stagedPapers.find((p) => p.id === selectedPaperId);
  }, [stagedPapers, selectedPaperId]);

  const topicsList = useMemo(() => {
    const set = new Set<string>();
    questionsList.forEach((q) => {
      if (q.topic_name) set.add(q.topic_name.trim());
    });
    return Array.from(set).sort();
  }, [questionsList]);

  const filteredQuestions = useMemo(
    () => filterPaperQuestions(questionsList, { search: searchQuery, diagram: diagramFilter, topic: topicFilter }),
    [questionsList, diagramFilter, topicFilter, searchQuery]
  );
  const filteredNumbers = useMemo(() => filteredQuestions.map((q) => q.question_number), [filteredQuestions]);
  const visibleSet = useMemo(() => new Set(filteredNumbers), [filteredNumbers]);

  // Explanation toggles
  const toggleExplanation = useCallback((questionNumber: number) => {
    setExpandedExplanations((prev) => ({
      ...prev,
      [questionNumber]: !prev[questionNumber],
    }));
  }, []);

  const handleToggleAllExplanations = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const updated: Record<number, boolean> = {};
    questionsList.forEach((q) => {
      updated[q.question_number] = nextState;
    });
    setExpandedExplanations(updated);
  };

  const handleZoom = useCallback(
    (d: { url: string; questionNumber: number; alt?: string }) => setZoomedDiagram(d),
    []
  );

  // Scroll a question card into view (works in the nested feed and on the window)
  const scrollToQuestion = useCallback(
    (questionNumber: number) => {
      lockActiveUntilRef.current = Date.now() + 800;
      setActiveQ(questionNumber);
      pendingScrollRef.current = questionNumber;
      if (viewMode !== 'continuous') setViewMode('continuous');
      if (!visibleSet.has(questionNumber)) {
        setSearchQuery('');
        setDiagramFilter('all');
        setTopicFilter('all');
      }
      // Try immediately; the effect below retries after a layout change
      const el = document.getElementById(`question-q${questionNumber}`);
      if (el && viewMode === 'continuous' && visibleSet.has(questionNumber)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        pendingScrollRef.current = null;
      }
    },
    [viewMode, visibleSet]
  );

  useEffect(() => {
    const n = pendingScrollRef.current;
    if (n === null || viewMode !== 'continuous') return;
    const id = window.requestAnimationFrame(() => {
      const el = document.getElementById(`question-q${n}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        pendingScrollRef.current = null;
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [viewMode, filteredQuestions, paper]);

  // Reset active question when paper changes
  useEffect(() => {
    setActiveQ(null);
  }, [selectedPaperId]);

  // Breakpoint tracking (feed is the scroll root on lg+, the viewport below)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Active question via IntersectionObserver (top-most card in the upper band)
  useEffect(() => {
    if (viewMode !== 'continuous' || !paper || loadingPaper || filteredNumbers.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') return;
    const visible = new Map<number, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          const n = Number((en.target as HTMLElement).dataset.q);
          visible.set(n, en.isIntersecting);
        });
        if (Date.now() < lockActiveUntilRef.current) return;
        const first = filteredNumbers.find((n) => visible.get(n));
        if (first !== undefined) setActiveQ(first);
      },
      {
        root: isDesktop ? feedRef.current : null,
        rootMargin: isDesktop ? '0px 0px -60% 0px' : '-64px 0px -60% 0px',
        threshold: 0,
      }
    );
    filteredNumbers.forEach((n) => {
      const el = document.getElementById(`question-q${n}`);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [viewMode, paper, loadingPaper, filteredNumbers, isDesktop]);

  // Soft-edge scroll mask (compiler style)
  const updateFade = useCallback((el: HTMLElement) => {
    const isAtTop = el.scrollTop <= 4;
    const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    if (isAtTop && isAtBottom) setScrollFadeState('none');
    else if (isAtTop) setScrollFadeState('top');
    else if (isAtBottom) setScrollFadeState('bottom');
    else setScrollFadeState('middle');
  }, []);

  const handleFeedScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => updateFade(e.currentTarget), [updateFade]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      if (feedRef.current) updateFade(feedRef.current);
    });
    return () => window.cancelAnimationFrame(id);
  }, [filteredQuestions, viewMode, paper, loadingPaper, expandedExplanations, updateFade]);

  const feedMask = useMemo(() => {
    if (scrollFadeState === 'none') return 'none';
    if (scrollFadeState === 'top') return 'linear-gradient(to bottom, black calc(100% - 36px), transparent 100%)';
    if (scrollFadeState === 'bottom') return 'linear-gradient(to bottom, transparent 0%, black 24px)';
    return 'linear-gradient(to bottom, transparent 0%, black 24px, black calc(100% - 36px), transparent 100%)';
  }, [scrollFadeState]);

  // Keyboard workflow
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (zoomedDiagram) {
          setZoomedDiagram(null);
          return;
        }
        if (isDeleteDialogOpen) {
          if (!isDeleting) setIsDeleteDialogOpen(false);
          return;
        }
        const inSearch = e.target === searchRef.current;
        if (inSearch || !isTypingTarget(e.target)) {
          if (searchQuery) setSearchQuery('');
          if (inSearch) searchRef.current?.blur();
        }
        return;
      }

      if (zoomedDiagram || isDeleteDialogOpen) return;
      if (isTypingTarget(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === 'j' || key === 'k') {
        if (viewMode !== 'continuous') return;
        const next = stepQuestion(filteredNumbers, activeQ, key === 'j' ? 1 : -1);
        if (next !== null) {
          e.preventDefault();
          scrollToQuestion(next);
        }
      } else if (key === 'e') {
        if (viewMode !== 'continuous' || activeQ === null) return;
        e.preventDefault();
        toggleExplanation(activeQ);
      } else if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (key === 't') {
        e.preventDefault();
        setViewMode((m) => (m === 'table' ? 'continuous' : 'table'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    zoomedDiagram,
    isDeleteDialogOpen,
    isDeleting,
    searchQuery,
    viewMode,
    filteredNumbers,
    activeQ,
    scrollToQuestion,
    toggleExplanation,
  ]);


  // Status for the selected paper
  const isLive = selectedSummary
    ? Boolean(selectedSummary.is_published || selectedSummary.lifecycle_state === 'published' || selectedSummary.source === 'database')
    : Boolean(isPublished || paperSource === 'database');
  const isArchivedNow = selectedSummary ? Boolean(selectedSummary.is_archived) : isArchived;
  const collapse = panelOpen ? 'block' : 'hidden lg:block';

  const handleRefresh = () => {
    if (selectedPaperId) loadPaper(selectedPaperId);
    else fetchPapersList();
  };

  return (
    <div className="w-full flex flex-col flex-1 min-h-0 font-body text-[#201e1d] lg:h-full lg:overflow-hidden print:h-auto print:overflow-visible">
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

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)] gap-4 lg:gap-6 flex-1 min-h-0 lg:h-full lg:overflow-hidden print:block print:overflow-visible">
        {/* ── SIDEBAR (first on phones, right on desktop) ── */}
        <aside
          aria-label="Paper controls"
          className="min-w-0 flex flex-col gap-3 lg:order-2 lg:overflow-y-auto lg:min-h-0 p-0.5 lg:pr-2 lg:pb-6 print:hidden"
        >
          {/* 1. Paper panel */}
          <section className={`${PANEL} rounded-2xl p-3.5 space-y-2.5`}>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="paper-select" className={LABEL}>
                Paper
              </label>
              {selectedPaperId && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black border flex items-center gap-1 ${
                    isLive
                      ? 'bg-[#f0fae1] text-[#3d472b] border-[#728157]'
                      : isArchivedNow
                      ? 'bg-[#eee7db] text-[#645c50] border-[#201e1d]/40'
                      : 'bg-[#fff0db] text-[#9a4200] border-[#c67139]'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isLive ? 'bg-[#728157]' : isArchivedNow ? 'bg-[#82796a]' : 'bg-amber-500'
                    }`}
                  />
                  {isLive ? 'Live' : isArchivedNow ? 'Archived' : 'Staged'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <PaperDropdown
                  id="paper-select"
                  ariaLabel="Select paper"
                  value={selectedPaperId}
                  onChange={setSelectedPaperId}
                  disabled={loadingList || stagedPapers.length === 0}
                  placeholder={loadingList ? 'Loading papers...' : 'No papers found'}
                  options={stagedPapers.map((p) => {
                    const series = formatSeriesText(p.paper?.series, p.paper?.year);
                    const code = p.paper?.paper_code ? ` · P${p.paper.paper_code}` : '';
                    const qs = p.questionsCount !== undefined ? ` · ${p.questionsCount} Qs` : '';
                    return { value: p.id, label: p.id, sublabel: `${series}${code}${qs}` };
                  })}
                />
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loadingPaper || loadingList}
                className="p-2 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#ffe1d0] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
                title="Refresh current paper"
                aria-label="Refresh current paper"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPaper ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {paper && (
              <p className="text-xs font-bold text-[#645c50] truncate">
                {paper.subject?.code} {paper.subject?.name || 'Economics'} ·{' '}
                {formatSeriesText(paper.paper?.series, paper.paper?.year)}
              </p>
            )}
          </section>

          {/* 2. Search + filters */}
          <section className={`${PANEL} rounded-2xl p-3.5 space-y-2.5`}>
            <div className="relative">
              <Search className="w-4 h-4 text-[#645c50] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchRef}
                type="text"
                aria-label="Search questions"
                placeholder="Search stems, options, refs..."
                value={searchQuery}
                disabled={!paper}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-medium text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#ffe1d0] disabled:opacity-50"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#645c50] hover:text-[#201e1d] cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPanelOpen((o) => !o)}
              aria-expanded={panelOpen}
              className="lg:hidden w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filters, stats &amp; navigator
              </span>
              <ChevronDown className={`w-4 h-4 transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className={`${collapse} space-y-2.5`}>
              <Segmented<DiagramFilter>
                value={diagramFilter}
                onChange={setDiagramFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'with_diagrams', label: `With diagrams (${diagramsCount})` },
                  { value: 'without_diagrams', label: 'None' },
                ]}
              />
              {topicsList.length > 0 && (
                <PaperDropdown
                  size="sm"
                  value={topicFilter}
                  onChange={setTopicFilter}
                  ariaLabel="Filter by topic"
                  options={[
                    { value: 'all', label: `All topics (${topicsList.length})` },
                    ...topicsList.map((t) => ({ value: t, label: t })),
                  ]}
                />
              )}
              <ToggleRow label="Show answers" pressed={showAnswers} onClick={() => setShowAnswers((v) => !v)} />
              <ToggleRow label="Expand explanations" pressed={allExpanded} onClick={handleToggleAllExplanations} />
            </div>
          </section>

          {paper && (
            <>
              {/* 3. Stats */}
              <section className={`${PANEL} ${collapse} rounded-2xl p-3.5 space-y-2.5`}>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded-xl bg-white border-2 border-[#201e1d]">
                    <div className="font-heading font-black text-xl leading-none">{totalQuestions}</div>
                    <div className={`${LABEL} mt-1`}>Questions</div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-white border-2 border-[#201e1d]">
                    <div className="font-heading font-black text-xl leading-none">{diagramsCount}</div>
                    <div className={`${LABEL} mt-1`}>Diagrams</div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-1.5" aria-label="Answer key distribution">
                  {(['A', 'B', 'C', 'D'] as const).map((k) => (
                    <div
                      key={k}
                      className="text-center py-1 rounded-lg bg-[#f0fae1] border border-[#8fa073] text-[11px] font-mono font-bold text-[#3d472b]"
                      title={`Option ${k} is correct in ${answerKeyBreakdown[k]} questions`}
                    >
                      <span className="font-heading font-black text-[#201e1d]">{k}</span>{' '}
                      {showAnswers ? answerKeyBreakdown[k] : '•'}
                    </div>
                  ))}
                </div>
              </section>

              {/* 4. Question navigator */}
              {questionsList.length > 0 && (
                <nav aria-label="Question navigator" className={`${PANEL} ${collapse} rounded-2xl p-3.5 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className={LABEL}>Navigator</span>
                    <span className="text-[10px] font-mono text-[#645c50]">
                      {filteredQuestions.length}/{totalQuestions} shown
                    </span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {questionsList.map((q) => {
                      const key = q.options?.find((o) => o.is_correct)?.label || '?';
                      const diag = hasDiagram(q);
                      const active = activeQ === q.question_number;
                      const dim = !visibleSet.has(q.question_number);
                      return (
                        <button
                          key={q.question_number}
                          type="button"
                          onClick={() => scrollToQuestion(q.question_number)}
                          aria-current={active ? 'true' : undefined}
                          aria-label={`Question ${q.question_number}${showAnswers ? `, answer ${key}` : ''}${
                            diag ? ', has diagram' : ''
                          }${dim ? ', hidden by filters' : ''}`}
                          className={`relative py-1 rounded-lg border-2 font-mono text-[11px] font-bold leading-tight transition-colors cursor-pointer flex flex-col items-center ${
                            active
                              ? 'bg-[#c67139] border-[#c67139] text-white'
                              : 'bg-white border-[#201e1d] text-[#201e1d] hover:bg-[#ffe1d0]'
                          } ${dim ? 'opacity-35' : ''}`}
                        >
                          <span>{q.question_number}</span>
                          {showAnswers && (
                            <span className={`text-[10px] ${active ? 'text-white/90' : 'text-[#645c50]'}`}>{key}</span>
                          )}
                          {diag && (
                            <span
                              className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                                active ? 'bg-white' : 'bg-[#c67139]'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </nav>
              )}

              {/* 5. View and actions */}
              <section className={`${PANEL} ${collapse} rounded-2xl p-3.5 space-y-2.5`}>
                <Segmented<'continuous' | 'table'>
                  value={viewMode}
                  onChange={setViewMode}
                  options={[
                    { value: 'continuous', label: <><LayoutList className="w-3.5 h-3.5" />Cards</> },
                    { value: 'table', label: <><TableIcon className="w-3.5 h-3.5" />Mark scheme</> },
                  ]}
                />
                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={!paper || loadingPaper}
                  className="w-full px-3 py-2 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] font-heading font-black text-xs text-[#272e1b] shadow-[2px_2px_0_0_#201e1d] hover:bg-[#b8c99d] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Print clean A4 Cambridge exam paper"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print paper
                </button>
                <div className="pt-2.5 mt-1 border-t-2 border-dashed border-[#201e1d]/20">
                  <button
                    type="button"
                    data-testid="delete-paper-button"
                    onClick={() => {
                      setDeleteError(null);
                      setIsDeleteDialogOpen(true);
                    }}
                    disabled={!paper || loadingPaper || isDeleting}
                    className="w-full px-3 py-2 rounded-xl bg-[#fee2e2] hover:bg-[#fecaca] text-[#991b1b] border-2 border-[#991b1b] font-heading font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    title="Delete paper, relating questions, and logs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete paper
                  </button>
                </div>
              </section>
            </>
          )}

          {/* 6. Hotkey legend */}
          <p className="px-1 text-[10px] font-mono text-[#645c50] leading-relaxed hidden lg:block">
            J/K next/prev · E explanation · / search · T table · Esc clear
          </p>
        </aside>

        {/* ── LEFT FEED ── */}
        <div className="flex flex-col min-w-0 lg:order-1 lg:min-h-0 lg:overflow-hidden gap-3 print:block print:overflow-visible">
        {successBanner && (
          <div
            data-testid="delete-success-banner"
            className="shrink-0 p-4 rounded-2xl bg-[#ecfdf5] border-2 border-[#065f46] text-[#065f46] shadow-[3px_3px_0_#065f46] flex items-center justify-between gap-3 print:hidden animate-in fade-in slide-in-from-top-2 duration-200"
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-xl bg-[#a7f3d0] border border-[#065f46] text-[#065f46] shrink-0">
                <Check className="w-4 h-4 stroke-[3]" />
              </div>
              <div>
                <p className="font-heading font-black text-sm">{successBanner.message}</p>
                {typeof successBanner.deletedCount === 'number' && successBanner.deletedCount > 0 && (
                  <p className="text-xs font-mono font-medium opacity-90">
                    {successBanner.deletedCount} question{successBanner.deletedCount === 1 ? '' : 's'} removed.
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSuccessBanner(null)}
              className="p-1 rounded-lg border border-[#065f46] hover:bg-[#a7f3d0] transition-colors cursor-pointer shrink-0"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
          <div
            ref={feedRef}
            onScroll={handleFeedScroll}
            role={viewMode === 'continuous' ? 'feed' : 'region'}
            aria-label={viewMode === 'continuous' ? 'Questions' : 'Mark scheme table'}
            aria-busy={loadingPaper}
            style={{ ['--feed-mask' as string]: feedMask } as React.CSSProperties}
            className="flex-1 min-h-0 lg:overflow-y-auto lg:[mask-image:var(--feed-mask)] lg:[-webkit-mask-image:var(--feed-mask)] pt-1 pb-20 px-1 lg:pr-2.5 flex flex-col gap-3 print:overflow-visible print:pb-0 print:h-auto"
          >
            {loadingPaper && (
              <div className="py-16 text-center space-y-3 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-3xl shadow-[3px_3px_0_0_#201e1d]">
                <div className="w-8 h-8 rounded-full border-4 border-[#201e1d] border-t-transparent animate-spin mx-auto" />
                <div className="font-heading font-black text-sm text-[#201e1d]">Loading staged paper &amp; questions...</div>
              </div>
            )}

            {listError && !loadingPaper && !paper && (
              <div className="p-5 rounded-3xl bg-[#fee2e2] border-2 border-[#b91c1c] text-[#7f1d1d] text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {listError}
              </div>
            )}

            {paperError && !loadingPaper && (
              <div className="p-5 rounded-3xl bg-[#fee2e2] border-2 border-[#b91c1c] text-[#7f1d1d] space-y-2 shadow-[3px_3px_0_0_#b91c1c]">
                <div className="font-heading font-black text-base flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#b91c1c]" />
                  Error loading staged paper
                </div>
                <p className="text-xs font-medium">{paperError}</p>
                <button
                  type="button"
                  onClick={() => selectedPaperId && loadPaper(selectedPaperId)}
                  className="px-3 py-1.5 rounded-lg bg-white border-2 border-[#b91c1c] text-xs font-bold text-[#b91c1c] hover:bg-neutral-50 cursor-pointer mt-1"
                >
                  Retry loading
                </button>
              </div>
            )}

            {!loadingPaper && !paperError && !paper && !listError && !loadingList && (
              <div className="py-16 px-4 bg-[#f9f4ed] rounded-3xl border-2 border-dashed border-[#dcd3c4] text-center">
                <div className="font-heading font-black text-lg text-[#201e1d]">No paper selected</div>
                <div className="text-sm text-[#645c50]">Pick a paper from the sidebar to review it.</div>
              </div>
            )}

            {!loadingPaper && !paperError && paper && viewMode === 'continuous' &&
              (filteredQuestions.length === 0 ? (
                <div className="py-16 px-4 bg-[#f9f4ed] rounded-3xl border-2 border-dashed border-[#dcd3c4] text-center flex flex-col items-center gap-2.5">
                  <div className="font-heading font-black text-xl text-[#201e1d]">No questions match</div>
                  <div className="text-sm text-[#645c50]">Try a different search or clear a filter.</div>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setDiagramFilter('all');
                      setTopicFilter('all');
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 transition-all shadow-[2px_2px_0_0_#201e1d] cursor-pointer"
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                filteredQuestions.map((q, i) => (
                  <PaperQuestionCard
                    key={q.question_number}
                    q={q}
                    index={i}
                    total={filteredQuestions.length}
                    isActive={activeQ === q.question_number}
                    showAnswers={showAnswers}
                    isExplanationOpen={Boolean(expandedExplanations[q.question_number])}
                    onToggleExplanation={toggleExplanation}
                    onZoom={handleZoom}
                  />
                ))
              ))}

            {!loadingPaper && !paperError && paper && viewMode === 'table' && (
              <PaperTableView
                questions={filteredQuestions}
                totalQuestions={totalQuestions}
                showAnswers={showAnswers}
                onView={scrollToQuestion}
              />
            )}
          </div>
        </div>
      </div>

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

      {/* ── Confirmation Modal for Paper Deletion ── */}
      {isDeleteDialogOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-paper-dialog-title"
          data-testid="delete-paper-dialog"
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => {
            if (!isDeleting) setIsDeleteDialogOpen(false);
          }}
        >
          <div
            className="bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[6px_6px_0_#201e1d] rounded-2xl max-w-md w-full p-6 text-[#201e1d] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Danger badge + Title */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-[#fee2e2] border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] text-[#991b1b] shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 flex-1">
                <span className="inline-block px-2 py-0.5 rounded-md bg-[#fee2e2] border border-[#991b1b]/40 text-[10px] font-mono font-bold uppercase tracking-wider text-[#991b1b]">
                  Permanent Deletion
                </span>
                <h3 id="delete-paper-dialog-title" className="text-lg font-heading font-black text-[#201e1d]">
                  Delete Whole Paper?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) setIsDeleteDialogOpen(false);
                }}
                disabled={isDeleting}
                className="p-1 rounded-xl bg-white border border-[#201e1d] hover:bg-[#ffe1d0] transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4 text-[#201e1d]" />
              </button>
            </div>

            {/* Error banner if deletion failed */}
            {deleteError && (
              <div className="p-3 rounded-xl bg-[#fee2e2] border-2 border-[#991b1b] text-[#991b1b] text-xs font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            {/* Summary Box */}
            <div className="p-3.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] text-xs space-y-1.5 font-mono">
              <div className="flex justify-between items-center text-[#645c50]">
                <span>Paper ID:</span>
                <span className="font-bold text-[#201e1d] truncate max-w-[200px]" title={publishedExamPaperId || selectedPaperId || paper?.id || ''}>
                  {publishedExamPaperId || selectedPaperId || paper?.id || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[#645c50]">
                <span>Subject:</span>
                <span className="font-bold text-[#201e1d]">
                  {paper?.subject?.code} {paper?.subject?.name || ''}
                </span>
              </div>
              <div className="flex justify-between items-center text-[#645c50]">
                <span>Series / Year:</span>
                <span className="font-bold text-[#201e1d]">
                  {formatSeriesText(paper?.paper?.series, paper?.paper?.year)} {paper?.paper?.paper_code ? `(P${paper.paper.paper_code})` : ''}
                </span>
              </div>
              <div className="flex justify-between items-center text-[#645c50]">
                <span>Total Questions:</span>
                <span className="font-bold text-[#991b1b] bg-[#fee2e2] px-1.5 py-0.5 rounded border border-[#991b1b]/30">
                  {totalQuestions} questions
                </span>
              </div>
            </div>

            {/* What will be permanently deleted */}
            <div className="space-y-1.5 text-xs text-[#403c39]">
              <p className="font-bold text-[#201e1d]">The following records will be permanently removed:</p>
              <ul className="space-y-1 text-[11px] list-disc list-inside text-[#645c50] pl-1">
                <li>Paper definition and syllabus metadata</li>
                <li>All relating questions &amp; options</li>
                <li>All student attempt logs (<code className="bg-[#eee7db] px-1 rounded font-mono">user_attempts</code>)</li>
                <li>All student mistake review logs (<code className="bg-[#eee7db] px-1 rounded font-mono">review_pile</code>)</li>
                <li>Staged files and storage records</li>
              </ul>
            </div>

            {/* Warning Box */}
            <div className="p-3 rounded-xl bg-[#fff7ed] border border-[#ea580c]/40 text-[#9a3412] text-xs font-bold flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>This action is permanent and cannot be undone.</span>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                data-testid="cancel-delete-button"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] font-heading font-bold text-xs text-[#201e1d] shadow-[2px_2px_0_#201e1d] hover:bg-[#e4dcce] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-delete-button"
                onClick={handleDeletePaper}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-[#ef4444] hover:bg-[#dc2626] text-white border-2 border-[#201e1d] font-heading font-black text-xs shadow-[2px_2px_0_#201e1d] hover:shadow-[1px_1px_0_#201e1d] active:translate-x-[1px] active:translate-y-[1px] transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting Paper...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete Paper &amp; Logs</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

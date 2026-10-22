'use client';
import { authFetch } from '../../lib/authFetch';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  BookOpen,
  Image as ImageIcon,
  Tag,
  Check,
  X,
  Edit3,
  SlidersHorizontal,
  Archive,
  Eye,
  CheckCircle,
  FileCode2,
  FolderOpen,
  ArrowRight,
  ShieldCheck,
  Hash,
  HelpCircle,
  Trash2,
} from 'lucide-react';
import type { StagedPaperSummary, StagingPaper, StagingQuestion } from '@/types/ingestion';
import { useQuestions, type Question } from '@/lib/questions';
import { resolveDiagramUrl } from '@/lib/resolveDiagramUrl';
import { useIngestionStore, ingestionStore } from '@/lib/ingestion/useIngestionStore';

export interface IngestionHistoryItem extends StagedPaperSummary {
  activeCount?: number;
  needsReviewCount?: number;
  withdrawnCount?: number;
  topicsCount?: number;
  topicBreakdown?: { name: string; count: number }[];
  ingested_at?: string | null;
  updated_at?: string | null;
  published_at?: string | null;
  source_qp_filename?: string | null;
  source_ms_filename?: string | null;
}

export interface IngestionHistoryHubProps {
  onSelectTab?: (tab: string, sub?: string) => void;
  onOpenEditor?: (questionId: string) => void;
  /** Called after a paper is preloaded into the Studio store. */
  onOpenInStudio?: (paperId: string) => void;
  /** Rendered first in the header row (the Studio passes its tab strip). */
  headerStart?: React.ReactNode;
}

// Formatting helpers
function formatSeries(series?: string): string {
  if (!series) return '';
  const s = series.toLowerCase();
  if (s === 's' || s.startsWith('may') || s.startsWith('jun')) return 'May/June';
  if (s === 'm' || s.startsWith('feb') || s.startsWith('mar')) return 'Feb/March';
  if (s === 'w' || s.startsWith('oct') || s.startsWith('nov')) return 'Oct/Nov';
  return series.toUpperCase();
}

function formatDateTime(isoString?: string | null, fallbackYear?: number): string {
  if (!isoString) {
    return fallbackYear ? `Exam Year ${fallbackYear}` : 'Unknown date';
  }
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return fallbackYear ? `Exam Year ${fallbackYear}` : 'Unknown date';
  }
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatRelativeTime(isoString?: string | null, fallbackYear?: number): string {
  if (!isoString) {
    return fallbackYear ? `${fallbackYear} Series` : 'Historical';
  }
  const date = new Date(isoString);
  if (isNaN(date.getTime())) {
    return fallbackYear ? `${fallbackYear} Series` : 'Historical';
  }
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec >= 0 && diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin >= 0 && diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours >= 0 && diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays >= 0 && diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths >= 0 && diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  if (diffYears >= 1) return `${diffYears}y ago`;
  return formatDateTime(isoString, fallbackYear);
}

export default function IngestionHistoryHub({
  onSelectTab,
  onOpenEditor,
  onOpenInStudio,
  headerStart,
}: IngestionHistoryHubProps) {
  // UNCONDITIONAL HOOKS DECLARATION AT TOP (Error #310 rule compliance)
  const { questions: liveQuestions, loading: questionsLoading, refetch: refetchLiveQuestions } = useQuestions();

  const [papers, setPapers] = useState<IngestionHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'staged' | 'archived'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'year' | 'questions'>('newest');

  // Expanded Inspector state
  const [expandedPaperId, setExpandedPaperId] = useState<string | null>(null);
  const [paperDetailCache, setPaperDetailCache] = useState<Record<string, StagingPaper>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);
  const [detailErrorId, setDetailErrorId] = useState<Record<string, string>>({});

  // Inspector-internal filters state
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string | null>(null);
  const [inspectorSearchQuery, setInspectorSearchQuery] = useState<string>('');
  const [inspectorFilter, setInspectorFilter] = useState<'all' | 'diagrams' | 'needs_review'>('all');
  const [visibleCount, setVisibleCount] = useState<number>(10);
  const [expandedExplanationMap, setExpandedExplanationMap] = useState<Record<number, boolean>>({});

  // Load staged papers from API
  const fetchStagedPapers = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await authFetch('/api/ingest/staged-paper?include_archived=true', {
        cache: 'no-store',
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          'You are not signed in with an admin account (Demo App Admin has no server access). Sign in with your admin account to see ingestion history.'
        );
      }
      if (!res.ok) {
        throw new Error(`Failed to fetch staged paper ledger: HTTP ${res.status}`);
      }
      const data = await res.json();
      const rawList: IngestionHistoryItem[] = Array.isArray(data.stagedPapers)
        ? data.stagedPapers
        : Array.isArray(data.papers)
        ? data.papers.map((p: any) => (typeof p === 'string' ? { id: p, filename: `${p}.json` } : p))
        : [];

      setPapers(rawList);
    } catch (err: any) {
      console.error('[IngestionHistoryHub] Error loading papers:', err);
      setError(err?.message || 'Failed to load ingestion history ledger');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStagedPapers();
  }, [fetchStagedPapers]);

  // Fetch individual paper details when expanding
  const fetchPaperDetails = useCallback(async (paperId: string) => {
    if (paperDetailCache[paperId]) {
      return;
    }
    setLoadingDetailId(paperId);
    setDetailErrorId((prev) => {
      const next = { ...prev };
      delete next[paperId];
      return next;
    });

    try {
      const res = await authFetch(`/api/ingest/staged-paper?id=${encodeURIComponent(paperId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to fetch paper manifest: HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.paper) {
        throw new Error('No paper payload returned from API.');
      }
      setPaperDetailCache((prev) => ({
        ...prev,
        [paperId]: data.paper,
      }));
    } catch (err: any) {
      console.error(`[IngestionHistoryHub] Failed to fetch details for ${paperId}:`, err);
      setDetailErrorId((prev) => ({
        ...prev,
        [paperId]: err?.message || 'Failed to load ingest contents',
      }));
    } finally {
      setLoadingDetailId((current) => (current === paperId ? null : current));
    }
  }, [paperDetailCache]);

  const handleToggleExpand = useCallback((paperId: string) => {
    setExpandedPaperId((prev) => {
      if (prev === paperId) {
        return null;
      }
      // Reset inspector sub-filters when switching papers
      setSelectedTopicFilter(null);
      setInspectorSearchQuery('');
      setInspectorFilter('all');
      setExpandedExplanationMap({});
      fetchPaperDetails(paperId);
      return paperId;
    });
  }, [fetchPaperDetails]);

  // Handle deleting a staged or draft paper
  const [deletingPaperId, setDeletingPaperId] = useState<string | null>(null);
  const handleDeletePaper = useCallback(async (paperId: string) => {
    if (!window.confirm(`Are you sure you want to delete "${paperId}"? This will remove the paper and its questions.`)) {
      return;
    }
    setDeletingPaperId(paperId);
    try {
      const res = await authFetch(`/api/ingest/staged-paper?id=${encodeURIComponent(paperId)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete paper');
      }
      setPapers((prev) => prev.filter((p) => p.id !== paperId));
      if (expandedPaperId === paperId) {
        setExpandedPaperId(null);
      }
    } catch (err: any) {
      alert(`Error deleting paper: ${err?.message || 'Unknown error'}`);
    } finally {
      setDeletingPaperId(null);
    }
  }, [expandedPaperId]);

  // Handle opening directly in Ingestion Studio
  const handleOpenInStudio = useCallback(async (paperId: string) => {
    try {
      if (typeof (useIngestionStore as any).getState === 'function') {
        await (useIngestionStore as any).getState().loadPreset(paperId);
      } else if (typeof ingestionStore.loadPreset === 'function') {
        await ingestionStore.loadPreset(paperId);
      }
    } catch (err) {
      console.warn('[IngestionHistoryHub] Could not preload preset in store:', err);
    }
    if (onOpenInStudio) {
      onOpenInStudio(paperId);
    } else if (onSelectTab) {
      onSelectTab('ingestion');
    }
  }, [onSelectTab, onOpenInStudio]);

  // Match live question ID for CMS editor link
  const findLiveQuestionId = useCallback((
    stagedPaper: StagingPaper | null,
    q: StagingQuestion
  ): string | undefined => {
    if (!liveQuestions || liveQuestions.length === 0) return undefined;

    // 1. Check exact citation or cambridge_source_ref
    if (q.cambridge_source_ref) {
      const matchRef = liveQuestions.find(
        (lq) =>
          lq.id === q.cambridge_source_ref ||
          lq.citation?.toLowerCase().includes(q.cambridge_source_ref.toLowerCase())
      );
      if (matchRef) return matchRef.id;
    }

    // 2. Match by paper metadata + question number
    const pCode = stagedPaper?.subject?.code;
    const pYear = stagedPaper?.paper?.year;
    const qNum = q.question_number;

    const matchMeta = liveQuestions.find((lq) => {
      const cit = (lq.citation || '').toLowerCase();
      const hasQNum = cit.includes(`q${qNum}`) || cit.endsWith(` ${qNum}`) || cit.includes(`question ${qNum}`);
      if (!hasQNum) return false;
      if (pCode && !cit.includes(pCode.toLowerCase())) return false;
      if (pYear && !cit.includes(String(pYear))) return false;
      return true;
    });
    if (matchMeta) return matchMeta.id;

    // 3. Fallback stem text snippet match
    if (q.stem_markdown && q.stem_markdown.length > 25) {
      const snippet = q.stem_markdown.slice(0, 35).trim().toLowerCase();
      const matchStem = liveQuestions.find((lq) =>
        (lq.stem_markdown || '').toLowerCase().includes(snippet)
      );
      if (matchStem) return matchStem.id;
    }

    return undefined;
  }, [liveQuestions]);

  // Unique subjects for dropdown filter
  const uniqueSubjects = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number }>();
    for (const p of papers) {
      const code = p.subject?.code || p.id.split('_')[0] || 'Unknown';
      const name = p.subject?.name || (code === '0455' ? 'Economics' : code);
      const existing = map.get(code);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(code, { code, name, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [papers]);

  // Filtered & Sorted Papers
  const filteredPapers = useMemo(() => {
    return papers
      .filter((paper) => {
        // Status filter
        if (statusFilter === 'published' && !paper.is_published) return false;
        if (statusFilter === 'archived' && !paper.is_archived) return false;
        if (statusFilter === 'staged' && (paper.is_published || paper.is_archived)) return false;

        // Subject filter
        if (subjectFilter !== 'all') {
          const sCode = paper.subject?.code || paper.id.split('_')[0] || '';
          if (sCode.toLowerCase() !== subjectFilter.toLowerCase()) return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const pId = paper.id.toLowerCase();
          const sCode = (paper.subject?.code || '').toLowerCase();
          const sName = (paper.subject?.name || '').toLowerCase();
          const series = (paper.paper?.series || '').toLowerCase();
          const seriesFormatted = formatSeries(paper.paper?.series).toLowerCase();
          const year = String(paper.paper?.year || '');
          const paperCode = (paper.paper?.paper_code || '').toLowerCase();
          const topics = (paper.topicBreakdown || []).map((t) => t.name.toLowerCase()).join(' ');

          const matches =
            pId.includes(q) ||
            sCode.includes(q) ||
            sName.includes(q) ||
            series.includes(q) ||
            seriesFormatted.includes(q) ||
            year.includes(q) ||
            paperCode.includes(q) ||
            topics.includes(q);

          if (!matches) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          const timeA = new Date(a.ingested_at || a.updated_at || 0).getTime() || (a.paper?.year || 0);
          const timeB = new Date(b.ingested_at || b.updated_at || 0).getTime() || (b.paper?.year || 0);
          return timeB - timeA;
        }
        if (sortBy === 'oldest') {
          const timeA = new Date(a.ingested_at || a.updated_at || 0).getTime() || (a.paper?.year || 0);
          const timeB = new Date(b.ingested_at || b.updated_at || 0).getTime() || (b.paper?.year || 0);
          return timeA - timeB;
        }
        if (sortBy === 'year') {
          const yearA = a.paper?.year || 0;
          const yearB = b.paper?.year || 0;
          if (yearA !== yearB) return yearB - yearA;
          return (a.paper?.series || '').localeCompare(b.paper?.series || '');
        }
        if (sortBy === 'questions') {
          return (b.questionsCount || 0) - (a.questionsCount || 0);
        }
        return 0;
      });
  }, [papers, statusFilter, subjectFilter, searchQuery, sortBy]);

  // KPI Calculations
  const kpiData = useMemo(() => {
    const totalBatches = papers.length;
    const archivedCount = papers.filter((p) => p.is_archived).length;
    const activeStagedCount = totalBatches - archivedCount;
    const publishedCount = papers.filter((p) => p.is_published).length;
    const publishedPercent = totalBatches > 0 ? Math.round((publishedCount / totalBatches) * 100) : 0;

    const totalQuestions = papers.reduce((sum, p) => sum + (p.questionsCount || 0), 0);
    const totalDiagrams = papers.reduce((sum, p) => sum + (p.diagramsCount || 0), 0);

    // Find the latest paper
    const sortedByTime = [...papers].sort((a, b) => {
      const timeA = new Date(a.ingested_at || a.updated_at || 0).getTime() || (a.paper?.year || 0);
      const timeB = new Date(b.ingested_at || b.updated_at || 0).getTime() || (b.paper?.year || 0);
      return timeB - timeA;
    });
    const latestPaper = sortedByTime[0];
    const latestTimeFormatted = latestPaper
      ? formatRelativeTime(latestPaper.ingested_at || latestPaper.updated_at, latestPaper.paper?.year)
      : 'No activity';

    const latestPaperLabel = latestPaper
      ? `${latestPaper.subject?.code || latestPaper.id.split('_')[0]}/${latestPaper.paper?.paper_code || '12'} ${formatSeries(latestPaper.paper?.series)} ${latestPaper.paper?.year || ''}`
      : 'No papers ingested yet';

    return {
      totalBatches,
      activeStagedCount,
      archivedCount,
      publishedCount,
      publishedPercent,
      totalQuestions,
      totalDiagrams,
      latestTimeFormatted,
      latestPaperLabel,
    };
  }, [papers]);

  // Counts for status tabs
  const statusCounts = useMemo(() => {
    return {
      all: papers.length,
      published: papers.filter((p) => p.is_published).length,
      staged: papers.filter((p) => !p.is_published && !p.is_archived).length,
      archived: papers.filter((p) => p.is_archived).length,
    };
  }, [papers]);

  const activeExpandedPaper = expandedPaperId ? paperDetailCache[expandedPaperId] : null;

  // Filter questions inside the expanded paper manifest
  const filteredExpandedQuestions = useMemo(() => {
    if (!activeExpandedPaper?.questions) return [];
    return activeExpandedPaper.questions.filter((q) => {
      // Topic filter
      if (selectedTopicFilter && q.topic_name !== selectedTopicFilter) {
        return false;
      }
      // Status/Diagrams toggle
      if (inspectorFilter === 'diagrams' && !q.diagram?.has_diagram && !q.diagram?.image_url) {
        return false;
      }
      if (inspectorFilter === 'needs_review' && q.status !== 'needs_review') {
        return false;
      }
      // Text Search
      if (inspectorSearchQuery.trim()) {
        const sq = inspectorSearchQuery.toLowerCase().trim();
        const stem = (q.stem_markdown || '').toLowerCase();
        const ref = (q.cambridge_source_ref || '').toLowerCase();
        const topic = (q.topic_name || '').toLowerCase();
        const optText = (q.options || []).map((o) => o.content_markdown.toLowerCase()).join(' ');
        const expl = (q.explanation_markdown || '').toLowerCase();
        if (
          !stem.includes(sq) &&
          !ref.includes(sq) &&
          !topic.includes(sq) &&
          !optText.includes(sq) &&
          !expl.includes(sq)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [activeExpandedPaper, selectedTopicFilter, inspectorFilter, inspectorSearchQuery]);

  // Reset manifest pagination when the viewed set changes
  useEffect(() => {
    setVisibleCount(10);
  }, [expandedPaperId, selectedTopicFilter, inspectorSearchQuery, inspectorFilter]);

  const receiptStats = useMemo(() => {
    const qs = activeExpandedPaper?.questions || [];
    return {
      active: qs.filter((q) => q.status === 'active').length,
      review: qs.filter((q) => q.status === 'needs_review').length,
      diagrams: qs.filter((q) => q.diagram?.has_diagram || q.diagram?.image_url).length,
    };
  }, [activeExpandedPaper]);

  // Topic breakdown from expanded paper
  const activePaperTopicDistribution = useMemo(() => {
    if (!activeExpandedPaper?.questions) return [];
    const countMap = new Map<string, number>();
    for (const q of activeExpandedPaper.questions) {
      const tName = q.topic_name || 'General';
      countMap.set(tName, (countMap.get(tName) || 0) + 1);
    }
    const total = activeExpandedPaper.questions.length;
    return Array.from(countMap.entries()).map(([name, count]) => ({
      name,
      count,
      percent: total > 0 ? Math.round((count / total) * 100) : 0,
    })).sort((a, b) => b.count - a.count);
  }, [activeExpandedPaper]);

  return (
    <div className="space-y-3.5">
      {/* HEADER ROW */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#201e1d]/15 pb-2.5 sm:pb-3">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap min-w-0">
          {headerStart && <div className="shrink-0">{headerStart}</div>}
          <h2 className="text-base sm:text-lg font-black font-adminHeading tracking-tight text-[#201e1d] whitespace-nowrap" data-title="Ingestion history">
            Ingestion History
          </h2>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#f0eade] border border-[#201e1d] text-[#645c50] rounded-full text-[11px] font-mono font-bold shadow-[1px_1px_0_#201e1d]">
            {papers.length} {papers.length === 1 ? 'paper' : 'papers'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            fetchStagedPapers(true);
            refetchLiveQuestions();
          }}
          disabled={isRefreshing || loading}
          className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#ffe1d0] border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none text-xs font-bold text-[#201e1d] flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
          title="Refresh with latest disk & cloud state"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* COMPACT STAT STRIP */}
      <div className="grid grid-cols-2 sm:grid-cols-4 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0px_#201e1d] overflow-hidden">
        {[
          { label: 'Papers', value: String(kpiData.totalBatches), sub: `${kpiData.archivedCount} archived` },
          { label: 'Live', value: String(kpiData.publishedCount), sub: `${kpiData.publishedPercent}% of papers` },
          { label: 'Questions', value: String(kpiData.totalQuestions), sub: `${kpiData.totalDiagrams} diagrams` },
          { label: 'Last ingest', value: kpiData.latestPaperLabel, sub: kpiData.latestTimeFormatted, isText: true },
        ].map((s) => (
          <div
            key={s.label}
            className="px-3 py-2 min-w-0 border-[#201e1d]/20 border-r [&:nth-child(2)]:border-r-0 sm:[&:nth-child(2)]:border-r [&:nth-child(4)]:border-r-0 [&:nth-child(-n+2)]:border-b sm:[&:nth-child(-n+2)]:border-b-0"
          >
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#645c50]">{s.label}</div>
            <div
              className={`font-black font-adminHeading text-[#201e1d] ${s.isText ? 'text-xs sm:text-sm leading-snug pt-0.5 break-words truncate' : 'text-base sm:text-lg leading-tight'}`}
            >
              {s.value}
            </div>
            <div className="text-[10px] sm:text-[11px] font-medium text-[#645c50] truncate">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap gap-2 sm:items-center">
        <div className="relative w-full sm:flex-1 sm:basis-56 min-w-0">
          <Search className="w-4 h-4 text-[#645c50] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            data-testid="ingestion-history-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search paper, subject, session or topic..."
            className="w-full pl-9 pr-8 py-1.5 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-medium text-[#201e1d] placeholder:text-[#8c8273] focus:outline-none focus:ring-2 focus:ring-[#201e1d] shadow-[1.5px_1.5px_0_#201e1d]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-[#645c50] hover:text-[#201e1d]"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap border-2 border-[#201e1d] rounded-xl overflow-hidden bg-white shadow-[1.5px_1.5px_0_#201e1d]" role="group" aria-label="Status filter">
            {(
              [
                { key: 'all', label: 'All', count: statusCounts.all },
                { key: 'published', label: 'Published', count: statusCounts.published },
                { key: 'staged', label: 'Staged', count: statusCounts.staged },
                { key: 'archived', label: 'Archived', count: statusCounts.archived },
              ] as const
            ).map((tab) => {
              const isActive = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  aria-pressed={isActive}
                  className={`px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors cursor-pointer border-r border-[#201e1d]/20 last:border-r-0 ${
                    isActive ? 'bg-[#201e1d] text-white font-bold shadow-xs' : 'bg-white text-[#474238] hover:bg-[#f5ead8] font-medium'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1 text-[10px] font-mono ${isActive ? 'text-white/75' : 'text-[#645c50]'}`}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              aria-label="Subject filter"
              className="appearance-none bg-white border-2 border-[#201e1d] rounded-xl pl-3 pr-8 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#201e1d] cursor-pointer max-w-[180px] shadow-[1.5px_1.5px_0_#201e1d]"
            >
              <option value="all">All subjects ({papers.length})</option>
              {uniqueSubjects.map((sub) => (
                <option key={sub.code} value={sub.code}>
                  {sub.code} · {sub.name} ({sub.count})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#201e1d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sort papers"
              className="appearance-none bg-white border-2 border-[#201e1d] rounded-xl pl-3 pr-8 py-1.5 text-xs font-bold text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#201e1d] cursor-pointer shadow-[1.5px_1.5px_0_#201e1d]"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="year">Exam year</option>
              <option value="questions">Most questions</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 text-[#201e1d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* SECTION 3: INGEST HISTORY LEDGER & EXPANDABLE INSPECTOR */}
      {loading ? (
        <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-12 text-center shadow-[3px_3px_0px_#201e1d]">
          <RefreshCw className="w-8 h-8 text-[#201e1d] animate-spin mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#201e1d]">Loading Ingestion Audit Ledger...</h3>
          <p className="text-xs text-[#645c50] mt-1">Reading staged paper files and matching published state.</p>
        </div>
      ) : error ? (
        <div className="bg-[#ffe1d0] border-2 border-[#201e1d] rounded-2xl p-6 text-center shadow-[3px_3px_0px_#201e1d]">
          <AlertTriangle className="w-8 h-8 text-amber-700 mx-auto mb-2" />
          <h3 className="text-base font-bold text-[#201e1d]">Failed to load ingestion history</h3>
          <p className="text-xs text-red-700 mt-1 font-mono">{error}</p>
          <button
            type="button"
            onClick={() => fetchStagedPapers(true)}
            className="mt-4 px-4 py-2 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-bold hover:bg-[#f5ead8] transition-all"
          >
            Try Again
          </button>
        </div>
      ) : filteredPapers.length === 0 ? (
        <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-12 text-center shadow-[3px_3px_0px_#201e1d]">
          <FolderOpen className="w-10 h-10 text-[#8c8273] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#201e1d]">No Ingested Papers Found</h3>
          <p className="text-xs text-[#645c50] mt-1 max-w-md mx-auto">
            {searchQuery || statusFilter !== 'all' || subjectFilter !== 'all'
              ? 'No ingested paper batches match your current search query or active filter settings.'
              : 'No exam paper batches have been ingested yet. Use the "New paper" tab to extract your first paper.'}
          </p>
          {(searchQuery || statusFilter !== 'all' || subjectFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setSubjectFilter('all');
              }}
              className="mt-4 px-4 py-2 bg-[#f5ead8] border-2 border-[#201e1d] rounded-xl text-xs font-bold hover:bg-[#ffe1d0] transition-all"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPapers.map((paper) => {
            const isExpanded = expandedPaperId === paper.id;
            const sCode = paper.subject?.code || paper.id.split('_')[0] || 'Unknown';
            const sName = paper.subject?.name || (sCode === '0455' ? 'Economics' : sCode);
            const seriesFormatted = formatSeries(paper.paper?.series);
            const yearStr = paper.paper?.year ? String(paper.paper.year) : '';
            const paperCodeStr = paper.paper?.paper_code || '12';

            const questionsCount = paper.questionsCount ?? 0;
            const diagramsCount = paper.diagramsCount ?? 0;
            const topicsCount = paper.topicsCount ?? paper.topicBreakdown?.length ?? 0;

            const timeStr = formatDateTime(paper.ingested_at || paper.updated_at, paper.paper?.year);
            const relTime = formatRelativeTime(paper.ingested_at || paper.updated_at, paper.paper?.year);

            return (
              <div
                key={paper.id}
                data-testid="ingest-history-row"
                className={`bg-white border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0px_#201e1d] overflow-hidden ${
                  isExpanded ? 'ring-2 ring-[#201e1d]' : ''
                }`}
              >
                {/* PAPER ROW SUMMARY BAR */}
                <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <h3 className="text-sm sm:text-base font-black font-adminHeading text-[#201e1d] tracking-tight lg:whitespace-nowrap">
                        {seriesFormatted} {yearStr} · Paper {paperCodeStr}
                      </h3>
                      {paper.is_published ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ccdbb2] text-[#201e1d] border border-[#201e1d]/40 font-mono text-[10px] font-bold whitespace-nowrap shadow-[1px_1px_0_#201e1d]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          PUBLISHED LIVE
                        </span>
                      ) : paper.is_archived ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-200 text-[#474238] border border-[#201e1d]/30 font-mono text-[10px] font-bold whitespace-nowrap shadow-[1px_1px_0_#201e1d]">
                          <Archive className="w-3 h-3 text-neutral-600" />
                          ARCHIVED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fde68a] text-[#201e1d] border border-[#201e1d]/40 font-mono text-[10px] font-bold whitespace-nowrap shadow-[1px_1px_0_#201e1d]">
                          <AlertTriangle className="w-3 h-3 text-amber-700" />
                          STAGED REVIEW
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-[#645c50] truncate" title={`${sCode} · ${sName} · ${paper.source_qp_filename || `${paper.id}.json`}`}>
                      {sCode} · {sName} · {paper.source_qp_filename || `${paper.id}.json`}{yearStr ? ` · ${yearStr}` : ''}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 font-mono text-[11px] font-bold text-[#201e1d]">
                      <span className="inline-flex items-center gap-1 bg-[#f9f4ed] border border-[#201e1d]/15 rounded-md px-2 py-0.5">
                        <FileText className="w-3 h-3 text-[#645c50]" />{questionsCount} Qs
                      </span>
                      <span className="inline-flex items-center gap-1 bg-[#f9f4ed] border border-[#201e1d]/15 rounded-md px-2 py-0.5">
                        <ImageIcon className="w-3 h-3 text-[#645c50]" />{diagramsCount} diagrams
                      </span>
                      <span className="inline-flex items-center gap-1 bg-[#f9f4ed] border border-[#201e1d]/15 rounded-md px-2 py-0.5">
                        <BookOpen className="w-3 h-3 text-[#645c50]" />{topicsCount} topics
                      </span>
                      <span className="inline-flex items-center gap-1 bg-[#f9f4ed] border border-[#201e1d]/15 rounded-md px-2 py-0.5 font-medium text-[#645c50]" title={timeStr}>
                        <Clock className="w-3 h-3 text-[#645c50]" />{relTime}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenInStudio(paper.id)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#201e1d] hover:bg-[#3a3735] border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none text-xs font-bold text-white transition-all cursor-pointer"
                      title="Open this paper directly in Ingestion Studio"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open in Studio</span>
                    </button>

                    <button
                      type="button"
                      data-testid="inspect-ingest-btn"
                      onClick={() => handleToggleExpand(paper.id)}
                      aria-expanded={isExpanded}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-[#f5ead8] border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none text-xs font-bold text-[#201e1d] transition-all cursor-pointer"
                    >
                      <span>Inspect</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {!paper.is_published && (
                      <button
                        type="button"
                        onClick={() => handleDeletePaper(paper.id)}
                        disabled={deletingPaperId === paper.id}
                        className="inline-flex items-center justify-center p-1.5 rounded-xl bg-white hover:bg-red-50 border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none text-red-600 hover:text-red-700 transition-all cursor-pointer disabled:opacity-50"
                        title="Delete this paper from staging"
                        aria-label={`Delete paper ${paper.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* EXPANDED INSPECTOR DRAWER / PANEL */}
                {isExpanded && (
                  <div className="border-t-2 border-[#201e1d] bg-[#fdfbf7] p-4 sm:p-6 space-y-6">
                    {loadingDetailId === paper.id ? (
                      <div className="py-12 text-center">
                        <RefreshCw className="w-6 h-6 text-[#201e1d] animate-spin mx-auto mb-2" />
                        <p className="text-xs font-bold text-[#201e1d]">Fetching complete ingest manifest for {paper.id}...</p>
                      </div>
                    ) : detailErrorId[paper.id] ? (
                      <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl text-center">
                        <p className="text-xs font-bold text-red-700">{detailErrorId[paper.id]}</p>
                        <button
                          type="button"
                          onClick={() => fetchPaperDetails(paper.id)}
                          className="mt-2 px-3 py-1 bg-white border border-red-400 rounded-lg text-xs font-bold text-red-800"
                        >
                          Retry Loading Manifest
                        </button>
                      </div>
                    ) : activeExpandedPaper ? (
                      <>
                        {/* 1. INGEST RECEIPT METADATA STRIP */}
                        <div className="bg-[#f5ead8] border-2 border-[#201e1d]/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-[#201e1d]">
                                RECEIPT: {paper.id}
                              </span>
                              <span className="text-[#645c50]">•</span>
                              <span className="text-xs font-semibold text-[#201e1d]">
                                {activeExpandedPaper.subject?.name} ({activeExpandedPaper.subject?.code})
                              </span>
                            </div>
                            <div className="text-xs text-[#645c50] font-mono">
                              Exam Session: {formatSeries(activeExpandedPaper.paper?.series)} {activeExpandedPaper.paper?.year} · Paper {activeExpandedPaper.paper?.paper_code}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {/* Active vs Review Counts */}
                            <span className="px-2.5 py-1 rounded-md bg-[#ccdbb2] border border-[#201e1d] text-[11px] font-mono font-bold text-[#201e1d]">
                              ✓ {receiptStats.active} Active
                            </span>
                            <span className="px-2.5 py-1 rounded-md bg-[#fde68a] border border-[#201e1d] text-[11px] font-mono font-bold text-[#201e1d]">
                              ⚠️ {receiptStats.review} Review
                            </span>
                            <span className="px-2.5 py-1 rounded-md bg-[#b8dcff] border border-[#201e1d] text-[11px] font-mono font-bold text-[#201e1d]">
                              🖼️ {receiptStats.diagrams} Diagrams
                            </span>
                          </div>
                        </div>

                        {/* 2. SYLLABUS TOPIC BREAKDOWN GRID */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#645c50] flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-[#201e1d]" />
                              Syllabus Topic Distribution ({activePaperTopicDistribution.length} Topics)
                            </h3>
                            {selectedTopicFilter && (
                              <button
                                type="button"
                                onClick={() => setSelectedTopicFilter(null)}
                                className="text-[11px] font-mono text-amber-900 underline hover:text-[#201e1d]"
                              >
                                Show All Topics
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
                            {/* All Topics Reset Card */}
                            <button
                              type="button"
                              onClick={() => setSelectedTopicFilter(null)}
                              className={`px-2 py-1.5 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                                selectedTopicFilter === null
                                  ? 'bg-[#ffe1d0] border-[#201e1d] font-bold'
                                  : 'bg-white border-[#201e1d]/30 hover:border-[#201e1d] hover:bg-[#f5ead8]'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-[#201e1d]">All Topics</span>
                                <span className="font-mono text-[11px] bg-[#201e1d]/10 px-1.5 py-0.5 rounded">
                                  {activeExpandedPaper.questions.length} Qs
                                </span>
                              </div>
                              <div className="w-full bg-[#201e1d]/10 rounded-full h-1 mt-1.5 overflow-hidden">
                                <div className="bg-[#201e1d] h-full w-full" />
                              </div>
                            </button>

                            {activePaperTopicDistribution.map((t) => {
                              const isSelected = selectedTopicFilter === t.name;
                              return (
                                <button
                                  key={t.name}
                                  type="button"
                                  onClick={() => setSelectedTopicFilter(isSelected ? null : t.name)}
                                  className={`px-2 py-1.5 rounded-lg border-2 text-left transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#ffe1d0] border-[#201e1d] font-bold'
                                      : 'bg-white border-[#201e1d]/30 hover:border-[#201e1d] hover:bg-[#f5ead8]'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-xs gap-2">
                                    <span className="font-semibold text-[#201e1d] truncate" title={t.name}>
                                      {t.name}
                                    </span>
                                    <span className="font-mono text-[10px] bg-[#201e1d]/10 px-1 py-0.5 rounded shrink-0">
                                      {t.count} ({t.percent}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-[#201e1d]/10 rounded-full h-1 mt-1.5 overflow-hidden">
                                    <div
                                      className="bg-[#ccdbb2] h-full"
                                      style={{ width: `${t.percent}%` }}
                                    />
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3. DETAILED QUESTION MANIFEST (EVERY QUESTION IN INGEST) */}
                        <div className="space-y-4 pt-2">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-[#201e1d]/15">
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-black font-heading text-[#201e1d]">
                                Question Manifest ({filteredExpandedQuestions.length} of {activeExpandedPaper.questions.length})
                              </h3>
                              {selectedTopicFilter && (
                                <span className="font-mono text-[10px] bg-[#ffe1d0] border border-[#201e1d] px-2 py-0.5 rounded-full font-bold">
                                  Topic: {selectedTopicFilter}
                                </span>
                              )}
                            </div>

                            {/* Search & Toggle Filters within Manifest */}
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Search in questions */}
                              <div className="relative">
                                <Search className="w-3.5 h-3.5 text-[#645c50] absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="text"
                                  value={inspectorSearchQuery}
                                  onChange={(e) => setInspectorSearchQuery(e.target.value)}
                                  placeholder="Search question text or options..."
                                  className="pl-8 pr-6 py-1 bg-white border border-[#201e1d] rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#201e1d] w-48 sm:w-56"
                                />
                                {inspectorSearchQuery && (
                                  <button
                                    type="button"
                                    onClick={() => setInspectorSearchQuery('')}
                                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#645c50]"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* Filter Toggles */}
                              <div className="flex items-center gap-1">
                                {(
                                  [
                                    { key: 'all', label: 'All' },
                                    { key: 'diagrams', label: 'Diagrams 🖼️' },
                                    { key: 'needs_review', label: 'Review ⚠️' },
                                  ] as const
                                ).map((f) => (
                                  <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setInspectorFilter(f.key)}
                                    className={`px-2 py-1 rounded-lg text-[11px] font-mono transition-all border ${
                                      inspectorFilter === f.key
                                        ? 'bg-[#201e1d] text-white border-[#201e1d] font-bold'
                                        : 'bg-white text-[#474238] border-[#201e1d]/30 hover:border-[#201e1d]'
                                    }`}
                                  >
                                    {f.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Questions List */}
                          {filteredExpandedQuestions.length === 0 ? (
                            <div className="p-8 text-center bg-white border border-[#201e1d]/20 rounded-xl">
                              <p className="text-xs text-[#645c50]">No questions match the current manifest filter.</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTopicFilter(null);
                                  setInspectorSearchQuery('');
                                  setInspectorFilter('all');
                                }}
                                className="mt-2 text-xs font-bold text-[#201e1d] underline"
                              >
                                Clear manifest filters
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {filteredExpandedQuestions.slice(0, visibleCount).map((q) => {
                                const liveQuestionId = findLiveQuestionId(activeExpandedPaper, q);
                                const correctOption = (q.options || []).find((o) => o.is_correct);
                                const correctLabel = correctOption?.label || '?';
                                const hasDiagram = Boolean(q.diagram?.has_diagram || q.diagram?.image_url);
                                const resolvedImageUrl = hasDiagram ? resolveDiagramUrl(q.diagram?.image_url) : undefined;
                                const isExplanationOpen = Boolean(expandedExplanationMap[q.question_number]);

                                return (
                                  <div
                                    key={q.question_number}
                                    className="bg-white border-2 border-[#201e1d]/25 rounded-xl p-4 space-y-3"
                                  >
                                    {/* Question Header */}
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {/* Q# Badge */}
                                        <span className="font-heading font-black text-xs px-2.5 py-0.5 rounded-lg bg-[#201e1d] text-white">
                                          Q{q.question_number}
                                        </span>

                                        {/* Citation */}
                                        <span className="font-mono text-[11px] text-[#645c50] bg-[#f5ead8] px-2 py-0.5 rounded-md border border-[#201e1d]/20">
                                          {q.cambridge_source_ref || `${paper.id}_q${q.question_number}`}
                                        </span>

                                        {/* Topic Badge */}
                                        <span className="font-mono text-[11px] font-semibold text-[#201e1d] bg-[#f9f4ed] px-2 py-0.5 rounded-md border border-[#201e1d]/30">
                                          {q.topic_name || 'General'}
                                        </span>

                                        {/* Status Badge */}
                                        {q.status === 'needs_review' ? (
                                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fde68a] text-[#201e1d] border border-[#201e1d]">
                                            Needs Review
                                          </span>
                                        ) : q.status === 'withdrawn' ? (
                                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-200 text-[#474238] border border-[#201e1d]/30">
                                            Withdrawn
                                          </span>
                                        ) : (
                                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ccdbb2] text-[#201e1d] border border-[#201e1d]">
                                            Active
                                          </span>
                                        )}

                                        {/* Answer Key Badge */}
                                        <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded-md bg-[#ffe1d0] text-[#201e1d] border border-[#201e1d]">
                                          Key: {correctLabel}
                                        </span>
                                      </div>

                                      {/* Quick Action: Open in CMS if matched in Supabase */}
                                      {onOpenEditor && liveQuestionId && (
                                        <button
                                          type="button"
                                          onClick={() => onOpenEditor(liveQuestionId)}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#f5ead8] hover:bg-[#ffe1d0] border border-[#201e1d] text-xs font-bold text-[#201e1d] cursor-pointer"
                                          title={`Open live Question ${q.question_number} in Admin Question Editor`}
                                        >
                                          <Edit3 className="w-3 h-3" />
                                          <span>Edit in CMS ✎</span>
                                        </button>
                                      )}
                                    </div>

                                    {/* Question Stem Text */}
                                    <div className="text-sm font-medium text-[#201e1d] leading-relaxed whitespace-pre-line">
                                      {q.stem_markdown}
                                    </div>

                                    {/* Diagram Preview if present */}
                                    {hasDiagram && resolvedImageUrl && (
                                      <div className="bg-[#f9f4ed] border border-[#201e1d]/30 rounded-xl p-2.5 max-w-lg">
                                        <div className="text-[10px] font-mono font-bold text-[#645c50] mb-1.5 flex items-center gap-1">
                                          <ImageIcon className="w-3 h-3" />
                                          <span>Diagram · {q.diagram?.alt_description || 'Extracted Question Diagram'}</span>
                                        </div>
                                        <div className="bg-white rounded-lg border border-[#201e1d]/20 p-2 flex items-center justify-center overflow-hidden">
                                          {/* Diagram image */}
                                          {/* eslint-disable-next-line @next/next/no-img-element */}
                                          <img
                                            src={resolvedImageUrl}
                                            alt={q.diagram?.alt_description || `Question ${q.question_number} diagram`}
                                            loading="lazy"
                                            decoding="async"
                                            className="max-h-60 max-w-full object-contain rounded"
                                            onError={(e) => {
                                              // Fallback when image fails to load
                                              const target = e.currentTarget;
                                              target.style.display = 'none';
                                              const parent = target.parentElement;
                                              if (parent && !parent.querySelector('.diag-fallback')) {
                                                const fallback = document.createElement('div');
                                                fallback.className = 'diag-fallback text-xs text-[#8c8273] font-mono py-4 text-center';
                                                fallback.innerText = `[Diagram file cropped: ${q.diagram?.image_url || 'pending upload'}]`;
                                                parent.appendChild(fallback);
                                              }
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {/* 4 Options Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                      {(q.options || []).map((opt) => {
                                        const isCorrect = opt.is_correct;
                                        return (
                                          <div
                                            key={opt.label}
                                            className={`p-2.5 rounded-xl border-2 flex items-start gap-2.5 transition-all ${
                                              isCorrect
                                                ? 'bg-[#ccdbb2] border-[#201e1d]/40 font-bold'
                                                : 'bg-[#fdfbf7] border-[#201e1d]/20 text-[#474238]'
                                            }`}
                                          >
                                            <span
                                              className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 font-heading font-black text-xs ${
                                                isCorrect
                                                  ? 'bg-[#201e1d] text-white'
                                                  : 'bg-white border border-[#201e1d]/30 text-[#201e1d]'
                                              }`}
                                            >
                                              {opt.label}
                                            </span>
                                            <div className="flex-1 min-w-0 text-xs leading-normal">
                                              <span>{opt.content_markdown}</span>
                                              {isCorrect && (
                                                <span className="ml-1.5 inline-flex items-center text-[10px] text-emerald-800 font-mono">
                                                  ✓ Correct Key
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>

                                    {/* Collapsible Mark Scheme & Explanation Box */}
                                    {(q.explanation_markdown || q.distractor_analysis) && (
                                      <div className="pt-1">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedExplanationMap((prev) => ({
                                              ...prev,
                                              [q.question_number]: !prev[q.question_number],
                                            }))
                                          }
                                          className="text-xs font-mono font-bold text-[#645c50] hover:text-[#201e1d] flex items-center gap-1 cursor-pointer"
                                        >
                                          {isExplanationOpen ? (
                                            <ChevronUp className="w-3.5 h-3.5" />
                                          ) : (
                                            <ChevronDown className="w-3.5 h-3.5" />
                                          )}
                                          <span>{isExplanationOpen ? 'Hide' : 'View'} Mark Scheme & Distractor Notes</span>
                                        </button>

                                        {isExplanationOpen && (
                                          <div className="mt-2 p-3 bg-[#f5ead8]/60 border border-[#201e1d]/20 rounded-xl space-y-2 text-xs">
                                            {q.explanation_markdown && (
                                              <div>
                                                <span className="font-mono font-bold text-[#201e1d] block mb-0.5">
                                                  Mark Scheme Explanation:
                                                </span>
                                                <p className="text-[#474238] whitespace-pre-line leading-relaxed">
                                                  {q.explanation_markdown}
                                                </p>
                                              </div>
                                            )}

                                            {q.distractor_analysis && Object.keys(q.distractor_analysis).length > 0 && (
                                              <div className="pt-2 border-t border-[#201e1d]/15">
                                                <span className="font-mono font-bold text-[#201e1d] block mb-1">
                                                  Distractor Analysis:
                                                </span>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                                  {Object.entries(q.distractor_analysis).map(([label, note]) => (
                                                    <div key={label} className="bg-white/80 p-2 rounded-lg border border-[#201e1d]/10 text-[11px]">
                                                      <span className="font-bold text-[#201e1d] mr-1">Option {label}:</span>
                                                      <span className="text-[#645c50]">{note}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {filteredExpandedQuestions.length > visibleCount && (
                                <button
                                  type="button"
                                  onClick={() => setVisibleCount((c) => c + 10)}
                                  className="w-full py-2 rounded-xl bg-white hover:bg-[#f5ead8] border-2 border-[#201e1d]/30 hover:border-[#201e1d] text-xs font-bold text-[#201e1d] cursor-pointer"
                                >
                                  Show 10 more ({filteredExpandedQuestions.length - visibleCount} left)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

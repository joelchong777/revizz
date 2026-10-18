'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { StagingPaper, StagingQuestion, StagingOption } from '@/types/ingestion';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Download,
  Upload,
  Send,
  Loader2,
  ZoomIn,
  X,
  Edit2,
  Check,
  Search,
  ExternalLink,
  ImageIcon,
  Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';
import { playPop, playChime, playBuzzer } from '@/lib/audio';
import { resolveDiagramUrl } from '@/lib/resolveDiagramUrl';

export interface StagedPaperAuditorProps {
  paperId: string;
  onBackToQueue: () => void;
  onOpenFullStudio?: (paperId: string) => void;
}

function isInputElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

export function StagedPaperAuditor({
  paperId,
  onBackToQueue,
  onOpenFullStudio,
}: StagedPaperAuditorProps) {
  const [paper, setPaper] = useState<StagingPaper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [filter, setFilter] = useState<'all' | 'review' | 'diagrams' | 'issues'>('all');
  const [search, setSearch] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishMessage, setPublishMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [isEditingStem, setIsEditingStem] = useState(false);
  const [isEditingExplanation, setIsEditingExplanation] = useState(false);

  // Fetch paper data on mount
  useEffect(() => {
    let active = true;
    async function loadPaper() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/ingest/staged-paper?id=${encodeURIComponent(paperId)}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch staged paper.');
        if (active) {
          setPaper(data.paper);
          setSelectedIdx(0);
        }
      } catch (err: any) {
        if (active) setError(err.message || 'Error fetching paper');
      } finally {
        if (active) setLoading(false);
      }
    }
    loadPaper();
    return () => { active = false; };
  }, [paperId]);

  // Filtered questions mapping
  const filteredQuestions = useMemo(() => {
    if (!paper) return [];
    const query = search.trim().toLowerCase();
    return (paper.questions || [])
      .map((q, originalIdx) => ({ q, originalIdx }))
      .filter(({ q }) => {
        if (filter === 'review') {
          const isReview = q.status !== 'active' || (q.status as string) === 'needs_review' || !q.options.some((o) => o.is_correct);
          if (!isReview) return false;
        } else if (filter === 'diagrams') {
          const hasDiag = Boolean(q.diagram?.has_diagram || (q as any).has_diagram || q.diagram?.image_url || q.stem_markdown?.includes('!['));
          if (!hasDiag) return false;
        } else if (filter === 'issues') {
          const hasIssue = !q.stem_markdown || !q.options || q.options.length !== 4 || q.options.filter((o) => o.is_correct).length !== 1;
          if (!hasIssue) return false;
        }
        if (query) {
          const matchNum = String(q.question_number).includes(query);
          const matchStem = q.stem_markdown?.toLowerCase().includes(query);
          const matchTopic = q.topic_name?.toLowerCase().includes(query);
          const matchOpts = q.options?.some((o) => o.content_markdown.toLowerCase().includes(query));
          if (!matchNum && !matchStem && !matchTopic && !matchOpts) return false;
        }
        return true;
      });
  }, [paper, filter, search]);

  // Metric counts
  const counts = useMemo(() => {
    if (!paper) return { all: 0, review: 0, diagrams: 0, issues: 0 };
    const list = paper.questions || [];
    return {
      all: list.length,
      review: list.filter((q) => q.status !== 'active' || (q.status as string) === 'needs_review' || !q.options.some((o) => o.is_correct)).length,
      diagrams: list.filter((q) => Boolean(q.diagram?.has_diagram || (q as any).has_diagram || q.diagram?.image_url || q.stem_markdown?.includes('!['))).length,
      issues: list.filter((q) => !q.stem_markdown || !q.options || q.options.length !== 4 || q.options.filter((o) => o.is_correct).length !== 1).length,
    };
  }, [paper]);

  // Keep selected index aligned with filtered list
  useEffect(() => {
    if (filteredQuestions.length > 0 && !filteredQuestions.some((item) => item.originalIdx === selectedIdx)) {
      setSelectedIdx(filteredQuestions[0].originalIdx);
    }
  }, [filteredQuestions, selectedIdx]);

  const currentQuestion: StagingQuestion | null = paper?.questions[selectedIdx] ?? null;
  const currentFilteredPos = filteredQuestions.findIndex((item) => item.originalIdx === selectedIdx);

  // Set option as correct
  const setOptionCorrect = useCallback((optIndex: number) => {
    if (!paper || !paper.questions[selectedIdx]) return;
    playPop();
    setPaper((prev) => {
      if (!prev) return null;
      const questions = [...prev.questions];
      const curQ = { ...questions[selectedIdx] };
      curQ.options = curQ.options.map((opt, i) => ({ ...opt, is_correct: i === optIndex }));
      questions[selectedIdx] = curQ;
      return { ...prev, questions };
    });
  }, [paper, selectedIdx]);

  // Navigate prev / next
  const handlePrev = useCallback(() => {
    if (currentFilteredPos > 0) {
      playPop();
      setSelectedIdx(filteredQuestions[currentFilteredPos - 1].originalIdx);
      setIsEditingStem(false);
      setIsEditingExplanation(false);
    }
  }, [currentFilteredPos, filteredQuestions]);

  const handleNext = useCallback(() => {
    if (currentFilteredPos >= 0 && currentFilteredPos < filteredQuestions.length - 1) {
      playPop();
      setSelectedIdx(filteredQuestions[currentFilteredPos + 1].originalIdx);
      setIsEditingStem(false);
      setIsEditingExplanation(false);
    }
  }, [currentFilteredPos, filteredQuestions]);

  // Toggle question status
  const toggleQuestionStatus = useCallback((advance = false) => {
    if (!paper || !paper.questions[selectedIdx]) return;
    playChime();
    setPaper((prev) => {
      if (!prev) return null;
      const questions = [...prev.questions];
      const curQ = { ...questions[selectedIdx] };
      curQ.status = curQ.status === 'active' ? 'needs_review' : 'active';
      questions[selectedIdx] = curQ;
      return { ...prev, questions };
    });
    if (advance && currentFilteredPos >= 0 && currentFilteredPos < filteredQuestions.length - 1) {
      setSelectedIdx(filteredQuestions[currentFilteredPos + 1].originalIdx);
      setIsEditingStem(false);
      setIsEditingExplanation(false);
    }
  }, [paper, selectedIdx, currentFilteredPos, filteredQuestions]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (zoomImageUrl) {
        if (e.key === 'Escape') { e.preventDefault(); setZoomImageUrl(null); }
        return;
      }
      if (isInputElement(e.target)) return;
      const key = e.key.toUpperCase();
      if (key === '1' || key === 'A') { e.preventDefault(); setOptionCorrect(0); }
      else if (key === '2' || key === 'B') { e.preventDefault(); setOptionCorrect(1); }
      else if (key === '3' || key === 'C') { e.preventDefault(); setOptionCorrect(2); }
      else if (key === '4' || key === 'D') { e.preventDefault(); setOptionCorrect(3); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleQuestionStatus(true); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleNext(); }
      else if (e.key === 'Escape') { e.preventDefault(); onBackToQueue(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomImageUrl, setOptionCorrect, toggleQuestionStatus, handlePrev, handleNext, onBackToQueue]);

  // Export JSON
  const handleExportJSON = () => {
    if (!paper) return;
    playPop();
    const filename = `${paper.paper?.paper_code || paperId}_reviewed.json`;
    const blob = new Blob([JSON.stringify(paper, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Publish to Supabase
  const handlePublish = async () => {
    if (!paper) return;
    playPop();
    setIsPublishing(true);
    setPublishMessage(null);
    try {
      const res = await fetch('/api/ingest/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Publish failed');
      playChime();
      setPublishMessage({
        type: 'success',
        text: `Published to Supabase! (${data.receipt?.questions_count ?? paper.questions.length} questions recorded)`,
      });
    } catch (err: any) {
      playBuzzer();
      setPublishMessage({ type: 'error', text: err.message || 'Failed to publish to database' });
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-[#201e1d]">
        <Loader2 className="w-8 h-8 animate-spin text-[#c67139]" />
        <p className="font-black text-sm">Loading Staged Paper Auditor...</p>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="p-6 max-w-xl mx-auto my-12 bg-[#fef2f2] border-2 border-[#ef4444] rounded-2xl shadow-offset-2">
        <h3 className="font-black text-lg text-[#b91c1c] flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Error Loading Paper
        </h3>
        <p className="text-sm font-medium text-[#7f1d1d] mt-2">{error || 'Paper not found.'}</p>
        <button
          onClick={onBackToQueue}
          className="mt-4 px-4 py-2 bg-white border-2 border-[#201e1d] font-bold text-xs rounded-xl shadow-offset-2 hover:bg-[#ffe1d0] cursor-pointer"
        >
          ← Back to Queue
        </button>
      </div>
    );
  }

  const rawUrl = currentQuestion?.diagram?.image_url || (currentQuestion?.diagram?.storage_path ? currentQuestion.diagram.storage_path : null);
  const diagramUrl = resolveDiagramUrl(rawUrl) || rawUrl;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-7xl mx-auto px-2 sm:px-4 py-2 gap-3 text-[#201e1d]">
      {/* Top Header Bar */}
      <header className="bg-white border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { playPop(); onBackToQueue(); }}
            className="px-3 py-1.5 rounded-xl border-2 border-[#201e1d] font-black text-xs bg-[#f9f4ed] hover:bg-[#ffe1d0] shadow-offset-2 flex items-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Queue
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm md:text-base">{paper.subject?.name || 'MCQ'} {paper.paper?.paper_code}</span>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-[#ffe1d0] border border-[#c67139] text-[#c67139] rounded-md">
                {paper.paper?.year} {paper.paper?.series?.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] font-medium text-[#645c50]">{counts.all} Questions · {counts.review} Need Review · {counts.issues} Issues</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded-xl border-2 border-[#201e1d] bg-[#fdfbf7] hover:bg-[#ffe1d0] text-xs font-bold shadow-offset-2 flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#c67139]" /> Export JSON
          </button>
          {onOpenFullStudio && (
            <button
              onClick={() => { playPop(); onOpenFullStudio(paperId); }}
              className="px-3 py-1.5 rounded-xl border-2 border-[#201e1d] bg-[#fdfbf7] hover:bg-[#ffe1d0] text-xs font-bold shadow-offset-2 flex items-center gap-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Full Studio
            </button>
          )}
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="px-4 py-1.5 rounded-xl border-2 border-[#201e1d] bg-[#201e1d] text-white hover:bg-[#34302e] text-xs font-black shadow-offset-2 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isPublishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 text-[#ffe1d0]" />}
            Publish
          </button>
        </div>
      </header>

      {/* Publish Feedback Banner */}
      {publishMessage && (
        <div className={`px-4 py-2 rounded-xl border-2 text-xs font-bold flex items-center justify-between shadow-offset-2 ${
          publishMessage.type === 'success' ? 'bg-emerald-50 border-emerald-600 text-emerald-900' : 'bg-red-50 border-red-500 text-red-900'
        }`}>
          <span>{publishMessage.text}</span>
          <button onClick={() => setPublishMessage(null)} className="p-1 hover:bg-black/10 rounded font-black cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Workspace (Drawer + Auditor) */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 min-h-0 overflow-hidden">
        {/* Left Drawer / Nav List */}
        <aside className="w-full md:w-80 shrink-0 bg-[#fdfbf7] border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-2 flex flex-col gap-2.5 overflow-hidden">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#82796a] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search Q#, stem, topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-medium rounded-xl border-2 border-[#201e1d] bg-white outline-none focus:bg-[#fff9f2]"
            />
          </div>

          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'all', label: 'All', count: counts.all },
              { id: 'review', label: 'Review', count: counts.review },
              { id: 'diagrams', label: 'Diag', count: counts.diagrams },
              { id: 'issues', label: 'Issues', count: counts.issues },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { playPop(); setFilter(tab.id as any); }}
                className={`py-1 px-1 text-center rounded-lg border text-[11px] font-black cursor-pointer transition-all ${
                  filter === tab.id ? 'bg-[#201e1d] text-white border-[#201e1d]' : 'bg-white border-[#201e1d]/40 hover:bg-[#ffe1d0] text-[#201e1d]'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {filteredQuestions.length === 0 ? (
              <p className="text-xs text-[#82796a] text-center py-6 font-medium">No matching questions</p>
            ) : (
              filteredQuestions.map(({ q, originalIdx }) => {
                const isSelected = originalIdx === selectedIdx;
                const correctOpt = q.options?.find((o) => o.is_correct);
                const isReview = q.status !== 'active' || (q.status as string) === 'needs_review';
                const hasDiag = Boolean(q.diagram?.has_diagram || (q as any).has_diagram || q.diagram?.image_url);

                return (
                  <button
                    key={q.question_number}
                    onClick={() => { playPop(); setSelectedIdx(originalIdx); setIsEditingStem(false); setIsEditingExplanation(false); }}
                    className={`w-full text-left p-2 rounded-xl border-2 transition-all flex items-center justify-between cursor-pointer ${
                      isSelected ? 'bg-[#ffe1d0] border-[#201e1d] shadow-offset-2 scale-[1.01]' : 'bg-white border-[#201e1d]/30 hover:border-[#201e1d] hover:bg-[#fff9f5]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-black text-xs shrink-0 w-7 h-7 rounded-lg bg-[#f9f4ed] border border-[#201e1d] flex items-center justify-center">
                        Q{q.question_number}
                      </span>
                      <span className="text-[11px] font-medium text-[#645c50] truncate">{q.topic_name || 'General'}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {hasDiag && <ImageIcon className="w-3.5 h-3.5 text-[#c67139]" />}
                      {isReview ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                        correctOpt ? 'bg-emerald-100 border-emerald-500 text-emerald-900' : 'bg-red-100 border-red-500 text-red-900'
                      }`}>
                        {correctOpt ? correctOpt.label : '?'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Auditor Main Panel */}
        <main className="flex-1 bg-[#fdfbf7] border-2 border-[#201e1d] rounded-2xl p-4 shadow-offset-2 flex flex-col gap-3 min-w-0 overflow-y-auto">
          {currentQuestion ? (
            <>
              {/* Question Navigation & Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b-2 border-[#201e1d]/20">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-xl bg-[#201e1d] text-white font-black text-xs">
                    Question {currentQuestion.question_number}
                  </span>
                  <span className="text-xs font-bold text-[#645c50]">
                    ({currentFilteredPos + 1} of {filteredQuestions.length})
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-[#f4ebe1] border border-[#201e1d]/20">
                    {currentQuestion.topic_name || 'General'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleQuestionStatus(false)}
                    className={`px-3 py-1 rounded-xl border-2 text-xs font-black shadow-offset-2 flex items-center gap-1.5 cursor-pointer transition-all ${
                      currentQuestion.status === 'active'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900 hover:bg-emerald-100'
                        : 'bg-amber-100 border-amber-600 text-amber-900 hover:bg-amber-200'
                    }`}
                  >
                    {currentQuestion.status === 'active' ? (
                      <><Check className="w-3.5 h-3.5" /> Validated [Active]</>
                    ) : (
                      <><AlertTriangle className="w-3.5 h-3.5" /> Needs Review</>
                    )}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={handlePrev}
                      disabled={currentFilteredPos <= 0}
                      className="px-2.5 py-1 rounded-xl border-2 border-[#201e1d] bg-white font-bold text-xs shadow-offset-2 hover:bg-[#ffe1d0] disabled:opacity-40 cursor-pointer"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={handleNext}
                      disabled={currentFilteredPos >= filteredQuestions.length - 1}
                      className="px-2.5 py-1 rounded-xl border-2 border-[#201e1d] bg-white font-bold text-xs shadow-offset-2 hover:bg-[#ffe1d0] disabled:opacity-40 cursor-pointer"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              </div>

              {/* Stem Section */}
              <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 shadow-offset-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#645c50]">Question Stem</span>
                  <button
                    onClick={() => setIsEditingStem(!isEditingStem)}
                    className="text-[11px] font-bold text-[#c67139] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" /> {isEditingStem ? 'Done' : 'Edit Stem'}
                  </button>
                </div>
                {isEditingStem ? (
                  <textarea
                    rows={4}
                    value={currentQuestion.stem_markdown}
                    onChange={(e) => {
                      const newStem = e.target.value;
                      setPaper((prev) => {
                        if (!prev) return null;
                        const questions = [...prev.questions];
                        questions[selectedIdx] = { ...questions[selectedIdx], stem_markdown: newStem };
                        return { ...prev, questions };
                      });
                    }}
                    className="w-full p-2.5 text-xs font-mono rounded-xl border-2 border-[#201e1d] outline-none bg-[#fffdfa]"
                  />
                ) : (
                  <div className="text-sm font-medium leading-relaxed">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {sanitizeKaTeX(currentQuestion.stem_markdown)}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Diagram Lightbox Preview */}
              {diagramUrl && (
                <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-3 shadow-offset-2 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={diagramUrl}
                      alt="Question diagram"
                      className="h-16 w-24 object-contain rounded-lg border border-[#201e1d]/40 bg-[#f9f4ed]"
                    />
                    <div>
                      <p className="text-xs font-bold text-[#201e1d]">Diagram Attached</p>
                      <p className="text-[11px] text-[#645c50]">Click thumbnail to inspect full resolution</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setZoomImageUrl(diagramUrl)}
                    className="px-3 py-1.5 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] hover:bg-[#ffe1d0] text-xs font-bold shadow-offset-2 flex items-center gap-1 cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5 text-[#c67139]" /> Zoom
                  </button>
                </div>
              )}

              {/* 4 Options Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentQuestion.options.map((opt, i) => {
                  const keyLetter = ['A', 'B', 'C', 'D'][i] || opt.label;
                  const isCorrect = opt.is_correct;
                  return (
                    <button
                      key={opt.label || i}
                      type="button"
                      onClick={() => setOptionCorrect(i)}
                      className={`text-left p-3.5 rounded-2xl border-2 transition-all flex items-start gap-3 cursor-pointer ${
                        isCorrect ? 'bg-emerald-50 border-emerald-600 shadow-offset-2 ring-1 ring-emerald-500' : 'bg-white border-[#201e1d] hover:bg-[#fff9f2] shadow-offset-2'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl border-2 border-[#201e1d] font-black text-xs flex items-center justify-center shrink-0 shadow-offset-2 ${
                        isCorrect ? 'bg-emerald-500 text-white' : 'bg-[#f4ebe1] text-[#201e1d]'
                      }`}>
                        {keyLetter}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[10px] font-bold text-[#82796a]">Key [{i + 1} / {keyLetter}]</span>
                          {isCorrect && (
                            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-500">
                              CORRECT KEY ✅
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-medium leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {sanitizeKaTeX(opt.content_markdown)}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Explanation & Distractor Reasoning */}
              <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-4 shadow-offset-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#645c50]">Explanation & Distractor Walkthrough</span>
                  <button
                    onClick={() => setIsEditingExplanation(!isEditingExplanation)}
                    className="text-[11px] font-bold text-[#c67139] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3" /> {isEditingExplanation ? 'Done' : 'Edit Explanation'}
                  </button>
                </div>
                {isEditingExplanation ? (
                  <textarea
                    rows={4}
                    value={currentQuestion.explanation_markdown}
                    onChange={(e) => {
                      const newExp = e.target.value;
                      setPaper((prev) => {
                        if (!prev) return null;
                        const questions = [...prev.questions];
                        questions[selectedIdx] = { ...questions[selectedIdx], explanation_markdown: newExp };
                        return { ...prev, questions };
                      });
                    }}
                    className="w-full p-2.5 text-xs font-mono rounded-xl border-2 border-[#201e1d] outline-none bg-white"
                  />
                ) : currentQuestion.explanation_markdown ? (
                  <div className="text-xs font-medium leading-relaxed text-[#474238]">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {sanitizeKaTeX(currentQuestion.explanation_markdown)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs text-[#82796a] italic">No explanation provided for this question.</p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
              <Sparkles className="w-8 h-8 text-[#c67139] mb-2" />
              <p className="font-black text-sm">No Question Selected</p>
              <p className="text-xs text-[#645c50] mt-1">Adjust your filters or pick a question from the left drawer.</p>
            </div>
          )}
        </main>
      </div>

      {/* Keyboard Shortcuts Footer Legend */}
      <footer className="bg-[#f4ebe1] border-2 border-[#201e1d] rounded-xl px-4 py-2 shadow-offset-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[11px] font-black text-[#645c50]">
        <span>
          <kbd className="px-1.5 py-0.5 bg-white border border-[#201e1d] rounded shadow-[1px_1px_0_#201e1d] mr-1 text-[#201e1d]">1-4</kbd>
          or
          <kbd className="px-1.5 py-0.5 bg-white border border-[#201e1d] rounded shadow-[1px_1px_0_#201e1d] mx-1 text-[#201e1d]">A-D</kbd>
          Set Correct Key
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-white border border-[#201e1d] rounded shadow-[1px_1px_0_#201e1d] mr-1 text-[#201e1d]">Space / Enter</kbd>
          Toggle Complete & Advance
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-white border border-[#201e1d] rounded shadow-[1px_1px_0_#201e1d] mr-1 text-[#201e1d]">← / →</kbd>
          Prev / Next
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 bg-white border border-[#201e1d] rounded shadow-[1px_1px_0_#201e1d] mr-1 text-[#201e1d]">Esc</kbd>
          Back to Queue
        </span>
      </footer>

      {/* Lightbox Modal */}
      {zoomImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setZoomImageUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white p-2 rounded-2xl border-4 border-[#201e1d] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setZoomImageUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-[#c67139] text-white border-2 border-[#201e1d] flex items-center justify-center font-bold hover:scale-110 transition shadow-offset-2 cursor-pointer"
              aria-label="Close image preview"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomImageUrl}
              alt="Question Diagram Preview"
              className="max-h-[82vh] max-w-full rounded-lg object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default StagedPaperAuditor;

'use client';
import { authFetch } from '../../../lib/authFetch';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Sparkles,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Download,
  ExternalLink,
  Layers,
  Image as ImageIcon,
  FolderOpen,
  ArrowRight,
  TrendingUp,
  Calculator,
  Atom,
  Dna,
  BookOpen,
  Check,
  AlertCircle,
  Trash2,
  Loader2,
} from 'lucide-react';
import { playPop, playChime, playBuzzer } from '@/lib/audio';

export interface StagedPaperItem {
  id: string;
  filename: string;
  subject?: {
    code?: string;
    name?: string;
    icon?: string;
  };
  paper?: {
    year?: number;
    series?: string;
    paper_code?: string;
  };
  questionsCount?: number;
  diagramsCount?: number;
  lifecycle_state?: string;
  isValid?: boolean;
}

export interface StagedPapersQueueProps {
  onSelectPaper: (paperId: string) => void;
  onOpenFullStudio?: (paperId: string) => void;
}

/**
 * Format Cambridge series code to readable label.
 */
function formatSeries(series?: string): string {
  if (!series) return 'Series ?';
  const s = series.toLowerCase().trim();
  if (s === 's' || s.includes('may') || s.includes('june') || s === 'm/j') return 'M/J';
  if (s === 'w' || s.includes('oct') || s.includes('nov') || s === 'o/n') return 'O/N';
  if (s === 'm' || s.includes('feb') || s.includes('march') || s === 'f/m') return 'F/M';
  return series.toUpperCase();
}

/**
 * Render subject icon based on icon identifier or subject code/name.
 */
function SubjectIcon({ icon, name }: { icon?: string; name?: string }) {
  const iconStr = (icon || '').toLowerCase();
  const nameStr = (name || '').toLowerCase();

  if (iconStr.includes('trend') || nameStr.includes('econ')) {
    return <TrendingUp className="w-5 h-5 text-[#c67139]" />;
  }
  if (iconStr.includes('calc') || nameStr.includes('math')) {
    return <Calculator className="w-5 h-5 text-[#c67139]" />;
  }
  if (iconStr.includes('atom') || nameStr.includes('phys')) {
    return <Atom className="w-5 h-5 text-[#c67139]" />;
  }
  if (iconStr.includes('dna') || nameStr.includes('bio')) {
    return <Dna className="w-5 h-5 text-[#c67139]" />;
  }
  return <BookOpen className="w-5 h-5 text-[#c67139]" />;
}

export default function StagedPapersQueue({
  onSelectPaper,
  onOpenFullStudio,
}: StagedPapersQueueProps) {
  const [papers, setPapers] = useState<StagedPaperItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isExportingId, setIsExportingId] = useState<string | null>(null);
  const [paperToDelete, setPaperToDelete] = useState<StagedPaperItem | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch papers from API
  const fetchPapers = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const res = await authFetch('/api/ingest/staged-paper');
      if (!res.ok) {
        throw new Error(`Failed to load staged papers (HTTP ${res.status})`);
      }
      const data = await res.json();
      if (data?.success && Array.isArray(data.stagedPapers)) {
        setPapers(data.stagedPapers);
      } else if (Array.isArray(data?.papers)) {
        // Fallback for simple ID array
        setPapers(
          data.papers.map((id: string) => ({
            id,
            filename: `${id}.json`,
            questionsCount: 40,
            lifecycle_state: 'review',
          }))
        );
      } else {
        setPapers([]);
      }
    } catch (err: any) {
      console.error('[StagedPapersQueue] Fetch error:', err);
      setError(err?.message || 'Error loading staged papers');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // Handle Delete Staged Paper
  const handleDeletePaper = async (paperId: string) => {
    setIsDeletingId(paperId);
    try {
      const res = await authFetch(`/api/ingest/staged-paper?id=${encodeURIComponent(paperId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: paperId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        playChime();
        setUploadMessage({
          type: 'success',
          text: `Permanently deleted ${paperId}.json from staging.`,
        });
        await fetchPapers();
      } else {
        playBuzzer();
        setUploadMessage({
          type: 'error',
          text: `Failed to delete paper: ${data?.error || `HTTP ${res.status}`}`,
        });
      }
    } catch (err: any) {
      playBuzzer();
      setUploadMessage({
        type: 'error',
        text: `Delete error: ${err?.message || 'Network error'}`,
      });
    } finally {
      setIsDeletingId(null);
    }
  };

  const confirmDeletePaper = async () => {
    if (!paperToDelete?.id) return;
    const targetId = paperToDelete.id;
    setPaperToDelete(null);
    await handleDeletePaper(targetId);
  };

  // Handle Export JSON
  const handleExportJSON = async (e: React.MouseEvent, paperId: string) => {
    e.stopPropagation();
    playPop();
    setIsExportingId(paperId);

    try {
      const res = await authFetch(`/api/ingest/staged-paper?id=${encodeURIComponent(paperId)}`);
      if (!res.ok) throw new Error('Could not fetch paper data for download.');
      const data = await res.json();
      const payload = data?.paper || data;

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${paperId}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsExportingId(null);
    }
  };

  // Handle Open in Full Studio
  const handleOpenStudio = (e: React.MouseEvent, paperId: string) => {
    e.stopPropagation();
    playPop();
    if (onOpenFullStudio) {
      onOpenFullStudio(paperId);
    } else {
      window.location.href = `/admin?tab=ingestion&preset=${encodeURIComponent(paperId)}`;
    }
  };

  // Handle File Upload & Staging
  const processUploadedJson = async (file: File) => {
    setUploadMessage(null);
    try {
      const text = await file.text();
      let parsedJson: any;
      try {
        parsedJson = JSON.parse(text);
      } catch {
        throw new Error('File is not valid JSON.');
      }

      const res = await authFetch('/api/ingest/staged-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paper: parsedJson, filename: file.name }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result?.error || result?.details?.[0] || 'Validation failed on server.');
      }

      playChime();
      setUploadMessage({
        type: 'success',
        text: `Successfully staged "${result.id || file.name}"!`,
      });
      await fetchPapers(true);
    } catch (err: any) {
      playBuzzer();
      console.error('[StagedPapersQueue] Upload error:', err);
      setUploadMessage({
        type: 'error',
        text: err?.message || 'Failed to stage JSON paper.',
      });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    playPop();

    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      await processUploadedJson(file);
    } else {
      setUploadMessage({
        type: 'error',
        text: 'Please drop a valid .json file.',
      });
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processUploadedJson(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Calculate aggregates
  const totalPapers = papers.length;
  const totalQuestions = papers.reduce((sum, p) => sum + (p.questionsCount || 0), 0);
  const totalDiagrams = papers.reduce((sum, p) => sum + (p.diagramsCount || 0), 0);
  const readyCount = papers.filter((p) => p.isValid !== false && (p.questionsCount || 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar & Metrics */}
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#ccdbb2] border-2 border-[#201e1d] text-xs font-mono font-bold uppercase tracking-wider text-[#201e1d]">
                STAGE 03 · READY VAULT
              </span>
              <span className="text-xs font-mono font-bold text-[#645c50]">
                Pre-Supabase Publishing Queue
              </span>
            </div>
            <h2 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight">
              Staged Papers Matrix
            </h2>
            <p className="text-xs sm:text-sm font-medium text-[#645c50]">
              Review extracted MCQs, inspect diagram crops, lock correct keys, and publish directly to live Supabase tables.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Quick Metrics Badges */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-offset-2">
              <span className="text-xs font-bold text-[#645c50]">Papers:</span>
              <span className="font-mono font-black text-sm text-[#201e1d]">{totalPapers}</span>
              <span className="text-[#645c50]">•</span>
              <span className="text-xs font-bold text-[#645c50]">Questions:</span>
              <span className="font-mono font-black text-sm text-[#c67139]">{totalQuestions}</span>
              <span className="text-[#645c50]">•</span>
              <span className="text-xs font-bold text-[#645c50]">Diagrams:</span>
              <span className="font-mono font-black text-sm text-[#201e1d]">{totalDiagrams}</span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => {
                playPop();
                fetchPapers(true);
              }}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl bg-[#eee7db] hover:bg-[#e2d9ca] border-2 border-[#201e1d] font-bold text-xs text-[#201e1d] shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="Refresh staged papers queue"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Compact Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => {
            playPop();
            fileInputRef.current?.click();
          }}
          className={`mt-4 p-3.5 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-3 ${
            isDragging
              ? 'bg-[#ffe1d0] border-[#c67139] scale-[1.01]'
              : 'bg-[#f4ebe1] hover:bg-[#eee3d7] border-[#201e1d]/50'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border-2 border-[#201e1d] shadow-offset-2 flex items-center justify-center shrink-0">
              <UploadCloud className="w-5 h-5 text-[#c67139]" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-black text-[#201e1d]">
                Drop any Cambridge MCQ Staged Paper JSON here
              </p>
              <p className="text-[11px] font-medium text-[#645c50]">
                Or click to browse and stage a validated paper immediately into this matrix.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all shrink-0 cursor-pointer"
          >
            Upload JSON
          </button>
        </div>

        {/* Upload Status Banner */}
        {uploadMessage && (
          <div
            className={`mt-3 p-3 rounded-xl border-2 flex items-center justify-between text-xs font-bold ${
              uploadMessage.type === 'success'
                ? 'bg-[#ecfdf5] border-[#22c55e] text-[#15803d]'
                : 'bg-[#fef2f2] border-[#ef4444] text-[#b91c1c]'
            }`}
          >
            <div className="flex items-center gap-2">
              {uploadMessage.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{uploadMessage.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setUploadMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* 2. Loading & Error States */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 animate-pulse space-y-4"
            >
              <div className="h-6 bg-[#ebddc5] rounded-xl w-3/4" />
              <div className="h-4 bg-[#ebddc5] rounded-lg w-1/2" />
              <div className="h-10 bg-[#ebddc5] rounded-xl w-full" />
              <div className="h-9 bg-[#ebddc5] rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-[#fef2f2] border-2 border-[#ef4444] rounded-[24px] p-6 text-center space-y-3 shadow-offset-3">
          <AlertTriangle className="w-10 h-10 text-[#ef4444] mx-auto" />
          <h3 className="text-lg font-black text-[#991b1b]">Error Loading Staged Papers</h3>
          <p className="text-xs sm:text-sm text-[#b91c1c] max-w-md mx-auto">{error}</p>
          <button
            type="button"
            onClick={() => fetchPapers()}
            className="px-4 py-2 rounded-xl bg-white border-2 border-[#ef4444] text-xs font-black text-[#991b1b] shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : papers.length === 0 ? (
        /* 3. Empty State */
        <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[28px] p-10 text-center space-y-5 shadow-offset-4 max-w-xl mx-auto my-6">
          <div className="w-16 h-16 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] shadow-offset-3 mx-auto flex items-center justify-center">
            <FolderOpen className="w-8 h-8 text-[#c67139]" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-xl font-black text-[#201e1d] font-heading">
              No Staged Papers Found
            </h3>
            <p className="text-xs sm:text-sm text-[#645c50] max-w-md mx-auto leading-relaxed">
              Your staging directory is currently empty. Drop a Cambridge JSON paper here or ingest a new Question Paper PDF in the Ingestion Studio.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                playPop();
                fileInputRef.current?.click();
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#c67139] hover:bg-[#b2622d] text-white border-2 border-[#201e1d] font-black text-xs shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Staged JSON</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playPop();
                if (onOpenFullStudio) onOpenFullStudio('');
                else window.location.href = '/admin?tab=ingestion';
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white hover:bg-[#f4ebe1] text-[#201e1d] border-2 border-[#201e1d] font-bold text-xs shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-[#c67139]" />
              <span>Go to Ingestion Studio</span>
            </button>
          </div>
        </div>
      ) : (
        /* 4. Papers Grid Matrix */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {papers.map((paper) => {
            const subjectCode = paper.subject?.code || '0455';
            const subjectName = paper.subject?.name || 'Economics';
            const series = formatSeries(paper.paper?.series);
            const year = paper.paper?.year || 2024;
            const paperCode = paper.paper?.paper_code || '12';
            const questionsCount = paper.questionsCount ?? 0;
            const diagramsCount = paper.diagramsCount ?? 0;

            const isPublished = paper.lifecycle_state === 'published';
            const isReady = !isPublished && (paper.isValid !== false && questionsCount > 0);

            return (
              <div
                key={paper.id}
                className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] p-5 shadow-offset-3 hover:shadow-offset-4 transition-all flex flex-col justify-between gap-5 group"
              >
                {/* Top Section: Subject & Series Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    {/* Subject Pill */}
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-white border-2 border-[#201e1d] shadow-offset-2 flex items-center justify-center shrink-0">
                        <SubjectIcon icon={paper.subject?.icon} name={subjectName} />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-heading font-black text-sm text-[#201e1d]">
                            {subjectName}
                          </span>
                          <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#ebddc5] border border-[#201e1d]/40 text-[#201e1d]">
                            {subjectCode}
                          </span>
                        </div>
                        <p className="text-xs font-mono font-bold text-[#645c50]">
                          {series} {year} · Paper {paperCode}
                        </p>
                      </div>
                    </div>

                    {/* Health Status Badge */}
                    <div>
                      {isPublished ? (
                        <span className="px-2.5 py-1 rounded-full bg-[#f3e8ff] border-2 border-[#201e1d] text-[11px] font-mono font-bold text-[#7e22ce] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#7e22ce]" />
                          Published
                        </span>
                      ) : isReady ? (
                        <span className="px-2.5 py-1 rounded-full bg-[#dcfce7] border-2 border-[#201e1d] text-[11px] font-mono font-bold text-[#15803d] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                          Ready to Publish
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-[#fef9c3] border-2 border-[#201e1d] text-[11px] font-mono font-bold text-[#854d0e] flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" />
                          Review Needed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata Chips: Question & Diagram Counts */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-offset-2 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#c67139] shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase font-mono font-bold text-[#645c50]">
                          Items
                        </p>
                        <p className="font-mono font-black text-xs text-[#201e1d]">
                          {questionsCount} Questions
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-offset-2 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-[#c67139] shrink-0" />
                      <div>
                        <p className="text-[10px] uppercase font-mono font-bold text-[#645c50]">
                          Diagrams
                        </p>
                        <p className="font-mono font-black text-xs text-[#201e1d]">
                          {diagramsCount} Crops
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-[#645c50] truncate px-1">
                    ID: <span className="font-bold text-[#201e1d]">{paper.id}</span>
                  </div>
                </div>

                {/* Bottom Section: Action Buttons */}
                <div className="space-y-2 pt-2 border-t-2 border-[#201e1d]/10">
                  {/* Primary CTA: Audit & Approve */}
                  <button
                    type="button"
                    onClick={() => {
                      playPop();
                      onSelectPaper(paper.id);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#c67139] hover:bg-[#b2622d] text-white border-2 border-[#201e1d] font-black text-xs shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer group-hover:bg-[#b2622d]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Audit & Approve</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-auto opacity-80" />
                  </button>

                  <div className="flex items-center gap-2">
                    {/* Open in Full Studio */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenStudio(e, paper.id)}
                      className="flex-1 py-1.5 px-2.5 rounded-xl bg-white hover:bg-[#f4ebe1] text-[#201e1d] border-2 border-[#201e1d] font-bold text-[11px] shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate"
                      title="Open in Cambridge Ingestion Studio"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#c67139] shrink-0" />
                      <span className="truncate">Full Studio</span>
                    </button>

                    {/* Export JSON */}
                    <button
                      type="button"
                      onClick={(e) => handleExportJSON(e, paper.id)}
                      disabled={isExportingId === paper.id}
                      className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#eee7db] hover:bg-[#e2d9ca] text-[#201e1d] border-2 border-[#201e1d] font-bold text-[11px] shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 truncate"
                      title="Export clean Cambridge JSON format"
                    >
                      <Download className={`w-3.5 h-3.5 ${isExportingId === paper.id ? 'animate-bounce' : ''}`} />
                      <span className="truncate">Export JSON</span>
                    </button>

                    {/* Delete Staged Paper */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPaperToDelete(paper);
                      }}
                      disabled={isDeletingId === paper.id}
                      className="p-1.5 px-2.5 rounded-xl bg-white hover:bg-[#fee2e2] text-[#645c50] hover:text-[#b91c1c] border-2 border-[#201e1d] hover:border-[#b91c1c] shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 shrink-0"
                      title={`Delete ${paper.id}.json permanently`}
                      aria-label={`Delete ${paper.id}.json`}
                    >
                      {isDeletingId === paper.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b91c1c]" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Defensive Delete Confirmation Dialog */}
      {paperToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="queue-delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setPaperToDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-6 max-w-md w-full shadow-[6px_6px_0_#201e1d] flex flex-col gap-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#fee2e2] border-2 border-[#b91c1c] text-[#b91c1c] flex items-center justify-center font-bold text-lg shrink-0 shadow-[1px_1px_0_#201e1d]">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="queue-delete-dialog-title" className="font-heading font-black text-base text-[#201e1d]">
                  Delete Paper from Staging?
                </h3>
                <p className="text-xs text-[#645c50] font-mono">
                  {paperToDelete.id || 'paper'}.json
                </p>
              </div>
            </div>

            <div className="p-3 bg-white border-2 border-[#201e1d] rounded-xl text-xs space-y-1.5 shadow-[2px_2px_0_#201e1d]">
              <div className="flex items-center justify-between">
                <p className="font-heading font-bold text-[#201e1d]">
                  {paperToDelete.subject?.name || paperToDelete.subject?.code || 'Cambridge Paper'}
                </p>
                <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded-md border border-[#201e1d] bg-[#f9f4ed]">
                  {paperToDelete.paper?.paper_code || paperToDelete.id.split('_')[2] || 'Paper'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#645c50] font-mono text-[11px]">
                <span>{paperToDelete.questionsCount ?? 0} Questions</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                    paperToDelete.lifecycle_state === 'published'
                      ? 'bg-[#d1fae5] text-[#065f46] border-[#059669]'
                      : 'bg-[#fef3c7] text-[#92400e] border-[#d97706]'
                  }`}
                >
                  {paperToDelete.lifecycle_state === 'published' ? 'PUBLISHED' : 'DRAFT'}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#b91c1c] font-medium leading-relaxed">
              This will permanently delete this paper from your local staging environment. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t-2 border-[#201e1d]/20">
              <button
                type="button"
                onClick={() => setPaperToDelete(null)}
                className="px-4 py-2 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-heading font-bold text-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingId === paperToDelete.id}
                onClick={confirmDeletePaper}
                className="px-4 py-2 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-heading font-bold border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingId === paperToDelete.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

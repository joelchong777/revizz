"use client";

import React, { useState } from "react";
import { useIngestionStore, PublishReceipt } from "@/lib/ingestion/useIngestionStore";
import {
  CheckCircle2,
  AlertTriangle,
  Loader2,
  UploadCloud,
  FileText,
  Database,
  ArrowRight,
  ExternalLink,
  X,
  RotateCw,
  Layers,
  BookOpen,
  Check,
  Archive,
} from "lucide-react";

export interface IngestionPipelineModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onOpenWorkspace?: () => void;
  onUploadAnother?: () => void;
  onViewQuestionBank?: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function IngestionPipelineModal({
  isOpen,
  onClose,
  onOpenWorkspace,
  onUploadAnother,
  onViewQuestionBank,
}: IngestionPipelineModalProps) {
  const {
    paper,
    isPipelineModalOpen,
    pipelineStep,
    pipelineFileSummary,
    lastPublishReceipt,
    publishStatus,
    publishMessage,
    setIsPipelineModalOpen,
    setPipelineStep,
    publishToSupabase,
    archiveStagedPaper,
  } = useIngestionStore();

  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const handleArchivePaper = async () => {
    const paperId = lastPublishReceipt?.paper_id || paper?.id;
    if (!paperId) return;
    setIsArchiving(true);
    setArchiveError(null);
    try {
      const res = await archiveStagedPaper(paperId);
      if (!res.success) {
        throw new Error(res.error || 'Failed to archive staged JSON paper.');
      }
      setArchiveSuccess('Archived to staging/archive/');
    } catch (err: any) {
      setArchiveError(err?.message || 'Error archiving paper');
    } finally {
      setIsArchiving(false);
    }
  };

  const open = isOpen !== undefined ? isOpen : isPipelineModalOpen;
  if (!open) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setIsPipelineModalOpen(false);
  };

  const handleOpenWorkspace = () => {
    setIsPipelineModalOpen(false);
    if (onOpenWorkspace) onOpenWorkspace();
  };

  const handleStartUpsert = async () => {
    await publishToSupabase();
  };

  const handleUploadAnother = () => {
    setIsPipelineModalOpen(false);
    if (onUploadAnother) onUploadAnother();
  };

  const handleViewQuestionBank = () => {
    setIsPipelineModalOpen(false);
    if (onViewQuestionBank) {
      onViewQuestionBank();
    } else if (typeof window !== "undefined") {
      window.location.href = "/admin?tab=compiler";
    }
  };

  // Integrity counts
  const totalQuestions = paper?.questions?.length || pipelineFileSummary?.questionCount || 0;
  const validQuestionsCount =
    pipelineFileSummary?.validCount ??
    (paper?.questions || []).filter((q) => {
      if (q.status === "withdrawn") return false;
      if (!q.stem_markdown || !q.stem_markdown.trim()) return false;
      if (!Array.isArray(q.options) || q.options.length !== 4) return false;
      const correct = q.options.filter((o) => o.is_correct).length;
      return correct === 1;
    }).length;

  const totalOptionsCount =
    pipelineFileSummary?.optionCount ??
    (paper?.questions || []).reduce((acc, q) => acc + (q.options?.length || 0), 0);

  const totalTopicsCount =
    paper?.syllabus_topics?.length || pipelineFileSummary?.topicCount || 0;

  const diagramCount =
    pipelineFileSummary?.diagramCount ??
    (paper?.questions || []).filter((q) => Boolean(q.diagram?.has_diagram || (q as any).has_diagram)).length;

  const fileName = pipelineFileSummary?.name || `${paper?.id || "paper"}.json`;
  const fileSize = formatBytes(pipelineFileSummary?.size);
  const receipt: PublishReceipt | null = lastPublishReceipt;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingestion-pipeline-title"
      className="fixed inset-0 z-50 bg-[#201e1d]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[8px_8px_0_#201e1d] rounded-[28px] sm:rounded-[36px] max-w-2xl w-full p-5 sm:p-8 flex flex-col gap-6 relative animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-[#eee7db] pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📋</span>
              <h2
                id="ingestion-pipeline-title"
                className="font-heading text-lg sm:text-2xl font-black text-[#201e1d]"
              >
                Cambridge Ingestion Pipeline
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-medium text-[#645c50]">
              End-to-End JSON Ingestion, Schema Audit &amp; Live Supabase Upsert
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-9 h-9 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] flex items-center justify-center text-[#201e1d] active:translate-y-0.5 shadow-[2px_2px_0_#201e1d] transition-all cursor-pointer shrink-0"
            aria-label="Close pipeline dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STAGE 1: PREVIEW / READY TO UPSERT */}
        {pipelineStep === "preview" && (
          <div className="flex flex-col gap-5">
            {/* File Details Card */}
            <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 shadow-[3px_3px_0_#201e1d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] text-[#c67139] flex items-center justify-center font-bold text-lg shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-heading font-black text-sm sm:text-base text-[#201e1d] break-all">
                    {fileName}
                  </div>
                  <div className="text-xs font-mono font-bold text-[#82796a]">
                    Size: {fileSize} • {paper?.subject?.name || "Cambridge"} (
                    {paper?.subject?.code || "0455"}) • {paper?.paper?.series?.toUpperCase()}
                    {paper?.paper?.year} P{paper?.paper?.paper_code}
                  </div>
                </div>
              </div>
              <span className="self-start sm:self-auto px-3 py-1 bg-emerald-100 text-emerald-800 border-2 border-emerald-300 rounded-full font-heading font-black text-[11px] uppercase tracking-wider">
                ✓ JSON Parsed
              </span>
            </div>

            {/* Schema & Integrity Audit Card */}
            <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_#201e1d] flex flex-col gap-3">
              <h3 className="font-heading text-xs font-black text-[#201e1d] uppercase tracking-wider">
                Schema &amp; Integrity Audit
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4]">
                  <div className="font-heading text-xl sm:text-2xl font-black text-[#201e1d]">
                    {totalQuestions}
                  </div>
                  <div className="text-[11px] font-bold text-[#645c50]">Questions Parsed</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300">
                  <div className="font-heading text-xl sm:text-2xl font-black text-emerald-700">
                    {validQuestionsCount}
                  </div>
                  <div className="text-[11px] font-bold text-emerald-800">Valid Questions</div>
                </div>
                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4]">
                  <div className="font-heading text-xl sm:text-2xl font-black text-[#201e1d]">
                    {totalOptionsCount}
                  </div>
                  <div className="text-[11px] font-bold text-[#645c50]">Total Options</div>
                </div>
                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4]">
                  <div className="font-heading text-xl sm:text-2xl font-black text-[#201e1d]">
                    {totalTopicsCount}
                  </div>
                  <div className="text-[11px] font-bold text-[#645c50]">Syllabus Topics</div>
                </div>
              </div>

              {diagramCount > 0 && (
                <div className="text-xs font-bold text-[#645c50] flex items-center gap-1.5 pt-1">
                  <span>🖼️</span>
                  <span>{diagramCount} question diagram(s) verified with bounding boxes &amp; image sources.</span>
                </div>
              )}
            </div>

            {/* Supabase Destination Status Callout */}
            <div className="bg-[#fffbeb] border-2 border-[#d97706] rounded-2xl p-4 shadow-[3px_3px_0_#d97706] flex items-start gap-3">
              <div className="text-2xl shrink-0 mt-0.5">⚠️</div>
              <div className="flex flex-col gap-1">
                <div className="font-heading text-xs sm:text-sm font-black text-[#92400e]">
                  Ready to Upsert: Loaded in browser memory only. Not yet written to live database.
                </div>
                <p className="text-xs text-[#78350f] font-medium leading-relaxed">
                  Your JSON paper has passed integrity checks and is staged in browser state. Click the primary button below to write subjects, syllabus topics, paper metadata, questions, and options directly to the Supabase Live Bank.
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenWorkspace}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs sm:text-sm font-heading font-black text-[#201e1d] shadow-[3px_3px_0_#201e1d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer text-center"
              >
                🛠️ Open Studio Workspace to Inspect/Edit
              </button>

              <button
                type="button"
                onClick={handleStartUpsert}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl border-2 border-[#201e1d] bg-[#c67139] hover:bg-[#b2622d] text-white font-heading font-black text-sm sm:text-base shadow-[4px_4px_0_#201e1d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-5 h-5" />
                <span>🚀 Upsert {totalQuestions} Questions to Supabase Live Bank</span>
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: UPSERTING IN PROGRESS */}
        {pipelineStep === "upserting" && (
          <div className="py-8 px-4 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[4px_4px_0_#201e1d] flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center text-[#c67139] shadow-[3px_3px_0_#201e1d]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>

            <div className="flex flex-col gap-1 max-w-md">
              <h3 className="font-heading text-lg font-black text-[#201e1d]">
                Upserting to Supabase Live Bank...
              </h3>
              <p className="text-xs sm:text-sm font-medium text-[#645c50]">
                {publishMessage || "Writing subjects, topics, papers, questions & options with relational integrity."}
              </p>
            </div>

            <div className="w-full max-w-md bg-[#eee7db] rounded-full h-3 border border-[#dcd3c4] overflow-hidden mt-2">
              <div className="bg-[#c67139] h-full w-3/4 animate-pulse rounded-full" />
            </div>

            <span className="text-[11px] font-mono font-bold text-[#82796a]">
              Target: /api/ingest/publish (Supabase PostgreSQL)
            </span>
          </div>
        )}

        {/* STAGE 3: SUCCESSFUL RECEIPT */}
        {pipelineStep === "success" && (
          <div className="flex flex-col gap-5">
            {/* Success Banner with Archive Action */}
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_#10b981] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-xs">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-heading text-sm sm:text-base font-black text-emerald-950">
                    Paper Successfully Upserted to Supabase!
                  </h3>
                  <p className="text-xs text-emerald-800 font-medium">
                    All relational entities are live and queryable in the Cambridge Question Bank.
                  </p>
                </div>
              </div>

              {/* Helpful Post-Publish Action */}
              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 border-emerald-200 pt-2 sm:pt-0 shrink-0">
                <span className="text-xs font-black text-emerald-950 hidden md:inline">
                  Paper is live in Supabase!
                </span>
                {archiveSuccess ? (
                  <span className="px-3 py-1.5 bg-emerald-100 border border-emerald-400 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-1">
                    ✓ {archiveSuccess}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleArchivePaper}
                    disabled={isArchiving}
                    className="px-3.5 py-2 bg-[#728157] hover:bg-[#5e6b47] text-white rounded-xl text-xs font-heading font-black shadow-xs active:translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    title="Archive local staged JSON file to staging/archive/"
                  >
                    {isArchiving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Archiving...</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive Staged JSON File</span>
                      </>
                    )}
                  </button>
                )}
                {archiveError && (
                  <span className="text-xs font-bold text-red-600">
                    ⚠️ {archiveError}
                  </span>
                )}
              </div>
            </div>

            {/* Comprehensive Database Receipt Card */}
            <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-5 shadow-[4px_4px_0_#201e1d] flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-[#eee7db] pb-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#c67139]" />
                  <span className="font-heading text-xs font-black text-[#201e1d] uppercase tracking-wider">
                    Supabase Database Receipt
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold bg-[#eee7db] px-2 py-0.5 rounded text-[#645c50]">
                  Verified
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4] flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#82796a] uppercase">Paper ID</span>
                  <span className="font-mono font-black text-[#201e1d] text-sm break-all">
                    {receipt?.paper_id || paper?.id || "N/A"}
                  </span>
                </div>

                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4] flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#82796a] uppercase">Subject</span>
                  <span className="font-heading font-black text-[#201e1d] text-sm">
                    {paper?.subject?.name || "Economics"} ({paper?.subject?.code || "0455"})
                  </span>
                </div>

                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4] flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#82796a] uppercase">Questions Upserted</span>
                  <span className="font-heading font-black text-emerald-700 text-base">
                    {receipt?.questions_count ?? totalQuestions} Questions
                  </span>
                </div>

                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4] flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#82796a] uppercase">Options Upserted</span>
                  <span className="font-heading font-black text-emerald-700 text-base">
                    {receipt?.options_count ?? totalOptionsCount} Options (4/Q)
                  </span>
                </div>

                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4] flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#82796a] uppercase">Topics Mapped</span>
                  <span className="font-heading font-black text-[#201e1d] text-sm">
                    {receipt?.topics_count ?? totalTopicsCount} Syllabus Topics
                  </span>
                </div>

                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4] flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#82796a] uppercase">Live Status</span>
                  <span className="font-heading font-black text-emerald-600 text-sm flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Live in Bank
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleUploadAnother}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#dcd3c4] bg-white hover:bg-[#eee7db] text-xs font-bold text-[#645c50] active:translate-y-0.5 transition-all cursor-pointer"
                >
                  Upload Another Paper 📄
                </button>
                <button
                  type="button"
                  onClick={handleOpenWorkspace}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#dcd3c4] bg-white hover:bg-[#eee7db] text-xs font-bold text-[#201e1d] active:translate-y-0.5 transition-all cursor-pointer"
                >
                  Done / Return to Workspace 🛠️
                </button>
              </div>

              <button
                type="button"
                onClick={handleViewQuestionBank}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border-2 border-[#201e1d] bg-[#728157] hover:bg-[#5e6b47] text-white font-heading font-black text-xs sm:text-sm shadow-[3px_3px_0_#201e1d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>View in Question Bank</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STAGE 4: ERROR STATE */}
        {pipelineStep === "error" && (
          <div className="flex flex-col gap-5">
            <div className="bg-[#fee2e2] border-2 border-[#b91c1c] rounded-2xl p-4 shadow-[4px_4px_0_#b91c1c] flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-[#b91c1c] shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <h3 className="font-heading text-sm font-black text-[#b91c1c]">
                  Supabase Upsert Failed
                </h3>
                <p className="text-xs text-[#7f1d1d] font-mono whitespace-pre-wrap break-all">
                  {publishMessage || "An error occurred while validating or upserting to Supabase."}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleOpenWorkspace}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-heading font-black text-[#201e1d] shadow-[3px_3px_0_#201e1d] active:translate-y-0.5 transition-all cursor-pointer"
              >
                🛠️ Fix Questions in Studio Workspace
              </button>
              <button
                type="button"
                onClick={handleStartUpsert}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl border-2 border-[#201e1d] bg-[#c67139] hover:bg-[#b2622d] text-white font-heading font-black text-xs sm:text-sm shadow-[3px_3px_0_#201e1d] active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCw className="w-4 h-4" />
                <span>Retry Supabase Upsert</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

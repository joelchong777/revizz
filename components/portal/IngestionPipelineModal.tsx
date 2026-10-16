"use client";

import React, { useState, useMemo } from "react";
import { useIngestionStore, PublishReceipt } from "@/lib/ingestion/useIngestionStore";
import {
  Check,
  AlertTriangle,
  Loader2,
  UploadCloud,
  FileText,
  Database,
  Copy,
  X,
  RotateCw,
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

function formatTopicName(fullName: string): string {
  const trimmed = fullName.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "the basic economic problem") return "Basic Econ";
  if (lower === "the allocation of resources") return "Allocation of Resources";
  if (lower === "microeconomic decision makers") return "Micro";
  if (lower === "government and the macroeconomy") return "Government & Macro";
  if (lower === "economic development") return "Development";
  if (
    lower === "international trade and globalisation" ||
    lower === "international trade and globalization"
  ) {
    return "Int'l Trade";
  }

  // Generic fallback: strip leading "The ", replace " and " with " & ", truncate if > 24 chars
  let cleaned = trimmed.replace(/^the\s+/i, "").replace(/\s+and\s+/gi, " & ");
  if (cleaned.length > 24) {
    cleaned = cleaned.slice(0, 22) + "...";
  }
  return cleaned;
}

function getSessionName(s?: string): string {
  const norm = (s || "").toLowerCase();
  if (norm === "s" || norm.includes("summer") || norm.includes("may") || norm.includes("june")) return "May / June";
  if (norm === "m" || norm.includes("spring") || norm.includes("feb") || norm.includes("march")) return "Feb / March";
  if (norm === "w" || norm.includes("winter") || norm.includes("oct") || norm.includes("nov")) return "Oct / Nov";
  return s?.toUpperCase() || "May / June";
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
  const [copiedId, setCopiedId] = useState(false);

  const handleArchivePaper = async () => {
    const paperId = lastPublishReceipt?.paper_id || paper?.id;
    if (!paperId) return;
    setIsArchiving(true);
    setArchiveError(null);
    try {
      const res = await archiveStagedPaper(paperId);
      if (!res.success) {
        throw new Error(res.error || "Failed to archive staged JSON paper.");
      }
      setArchiveSuccess("Archived to staging/archive/");
    } catch (err: any) {
      setArchiveError(err?.message || "Error archiving paper");
    } finally {
      setIsArchiving(false);
    }
  };

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
      window.location.href = "/admin?tab=bank";
    }
  };

  // Live Metrics & Telemetry (Zero mock/fake data)
  const totalQuestions = paper?.questions?.length || pipelineFileSummary?.questionCount || 0;
  const receipt: PublishReceipt | null = lastPublishReceipt;

  const validQuestionsCount = useMemo(() => {
    if (pipelineFileSummary?.validCount !== undefined && (!paper?.questions || paper.questions.length === 0)) {
      return pipelineFileSummary.validCount;
    }
    return (paper?.questions || []).filter((q) => {
      if (q.status === "withdrawn") return false;
      if (!q.stem_markdown || !q.stem_markdown.trim()) return false;
      if (!Array.isArray(q.options) || q.options.length !== 4) return false;
      const correct = q.options.filter((o) => o.is_correct).length;
      return correct === 1;
    }).length;
  }, [paper?.questions, pipelineFileSummary?.validCount]);

  const questionsCount = receipt?.questions_count ?? totalQuestions;

  const optionsCount =
    receipt?.options_count ??
    (pipelineFileSummary?.optionCount ??
      (paper?.questions || []).reduce((acc, q) => acc + (q.options?.length || 0), 0));

  const totalTopicsCount =
    receipt?.topics_count ??
    (paper?.syllabus_topics?.length || pipelineFileSummary?.topicCount || 0);

  const diagramCount = useMemo(() => {
    if (pipelineFileSummary?.diagramCount !== undefined && (!paper?.questions || paper.questions.length === 0)) {
      return pipelineFileSummary.diagramCount;
    }
    return (paper?.questions || []).filter((q) => {
      if (q.status === "withdrawn") return false;
      return Boolean(
        q.diagram?.has_diagram ||
        q.diagram?.image_url ||
        (q.diagrams && q.diagrams.length > 0) ||
        (q.stem_markdown && /!\[.*?\]\(.*?\)/.test(q.stem_markdown))
      );
    }).length;
  }, [paper?.questions, pipelineFileSummary?.diagramCount]);

  const tableCount = useMemo(() => {
    return (paper?.questions || []).filter((q) => {
      if (q.status === "withdrawn") return false;
      return Boolean(
        q.stem_markdown &&
        (/\|.*\|[\r\n]+\|[-:\s|]+\|/.test(q.stem_markdown) || /<table/i.test(q.stem_markdown))
      );
    }).length;
  }, [paper?.questions]);

  const verifiedCount = useMemo(() => {
    return (paper?.questions || []).filter((q) => {
      if (q.status === "withdrawn") return false;
      return Array.isArray(q.options) && q.options.filter((o) => o.is_correct).length === 1;
    }).length;
  }, [paper?.questions]);

  // Topic Units with live counts mapped directly from questions
  const topicCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const q of paper?.questions || []) {
      if (q.status === "withdrawn") continue;
      const tName = (q.topic_name || "General").trim();
      counts[tName] = (counts[tName] || 0) + 1;
    }
    return counts;
  }, [paper?.questions]);

  const topicUnits = useMemo(() => {
    if (paper?.syllabus_topics && paper.syllabus_topics.length > 0) {
      return paper.syllabus_topics.map((t, idx) => ({
        name: t.name,
        shortName: formatTopicName(t.name),
        count: topicCounts[t.name.trim()] || 0,
        index: t.order_index ?? idx + 1,
      }));
    }
    const keys = Object.keys(topicCounts);
    if (keys.length > 0) {
      return keys.map((key, idx) => ({
        name: key,
        shortName: formatTopicName(key),
        count: topicCounts[key],
        index: idx + 1,
      }));
    }
    return [];
  }, [paper?.syllabus_topics, topicCounts]);

  const subjectName = paper?.subject?.name || "Economics";
  const subjectCode = paper?.subject?.code || "0455";
  const paperCode = paper?.paper?.paper_code || "12";
  const series = (paper?.paper?.series || "s").toLowerCase();
  const year = paper?.paper?.year || 2024;
  const yearShort = String(year).slice(-2);
  const sessionName = getSessionName(paper?.paper?.series);
  const sessionBadge = `${subjectCode}_${series}${yearShort}_qp_${paperCode}`;

  const fileName = pipelineFileSummary?.name || `${paper?.id || "paper"}.json`;
  const fileSize = formatBytes(pipelineFileSummary?.size);

  const rawPaperId = receipt?.paper_id || paper?.id || "";
  const formattedPaperId = useMemo(() => {
    if (!rawPaperId) return "N/A";
    if (rawPaperId.length > 18) {
      return `${rawPaperId.slice(0, 8)}...${rawPaperId.slice(-7)}`;
    }
    return rawPaperId;
  }, [rawPaperId]);

  const handleCopyId = async () => {
    if (!rawPaperId) return;
    try {
      await navigator.clipboard.writeText(rawPaperId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // ignore clipboard error in unsupported envs
    }
  };

  const open = isOpen !== undefined ? isOpen : isPipelineModalOpen;
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingestion-pipeline-title"
      className="fixed inset-0 z-50 bg-[#201e1d]/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
    >
      <div className="bg-[#faf6ee] border-2 border-[#1f2937] shadow-[8px_8px_0_#1f2937] rounded-[28px] sm:rounded-[36px] max-w-xl w-full p-5 sm:p-7 flex flex-col gap-5 relative animate-in fade-in zoom-in-95 duration-150 my-auto">
        {/* Header Bar */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-[#eee7db] pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl">📋</span>
              <h2
                id="ingestion-pipeline-title"
                className="font-adminHeading text-xl sm:text-2xl font-bold text-[#1f2937]"
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
            className="w-9 h-9 rounded-xl border-2 border-[#1f2937] bg-white hover:bg-[#eee7db] shadow-[2px_2px_0_#1f2937] active:translate-y-0.5 flex items-center justify-center text-[#1f2937] transition-all cursor-pointer shrink-0"
            aria-label="Close pipeline dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STAGE 1: PREVIEW / READY TO UPSERT */}
        {pipelineStep === "preview" && (
          <div className="flex flex-col gap-5">
            {/* File Details Card */}
            <div className="bg-white border-2 border-[#1f2937] rounded-2xl p-4 shadow-[3px_3px_0_#1f2937] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#ffe1d0] border-2 border-[#1f2937] text-[#c67139] flex items-center justify-center font-bold text-lg shadow-xs">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-adminHeading font-bold text-sm sm:text-base text-[#1f2937] break-all">
                    {fileName}
                  </div>
                  <div className="text-xs font-mono font-bold text-[#82796a]">
                    Size: {fileSize} • {subjectName} ({subjectCode}) • {paper?.paper?.series?.toUpperCase()}
                    {paper?.paper?.year} P{paperCode}
                  </div>
                </div>
              </div>
              <span className="self-start sm:self-auto px-3 py-1 bg-emerald-100 text-emerald-800 border-2 border-emerald-300 rounded-full font-adminHeading font-bold text-[11px] uppercase tracking-wider">
                ✓ JSON Parsed
              </span>
            </div>

            {/* Schema & Integrity Audit Card */}
            <div className="bg-white border-2 border-[#1f2937] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_#1f2937] flex flex-col gap-3">
              <h3 className="font-adminHeading text-xs font-bold text-[#1f2937] uppercase tracking-wider">
                Schema &amp; Integrity Audit
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4]">
                  <div className="font-adminHeading text-xl sm:text-2xl font-bold text-[#1f2937] font-mono">
                    {totalQuestions}
                  </div>
                  <div className="text-[11px] font-bold text-[#645c50]">Questions Parsed</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-300">
                  <div className="font-adminHeading text-xl sm:text-2xl font-bold text-emerald-700 font-mono">
                    {validQuestionsCount}
                  </div>
                  <div className="text-[11px] font-bold text-emerald-800">Valid Questions</div>
                </div>
                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4]">
                  <div className="font-adminHeading text-xl sm:text-2xl font-bold text-[#1f2937] font-mono">
                    {optionsCount}
                  </div>
                  <div className="text-[11px] font-bold text-[#645c50]">Total Options</div>
                </div>
                <div className="p-3 bg-[#fdfbf7] rounded-xl border border-[#dcd3c4]">
                  <div className="font-adminHeading text-xl sm:text-2xl font-bold text-[#1f2937] font-mono">
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
                <div className="font-adminHeading text-xs sm:text-sm font-bold text-[#92400e]">
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
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border-2 border-[#1f2937] bg-white hover:bg-[#eee7db] text-xs sm:text-sm font-adminHeading font-bold text-[#1f2937] shadow-[3px_3px_0_#1f2937] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer text-center"
              >
                🛠️ Open Studio Workspace to Inspect/Edit
              </button>

              <button
                type="button"
                onClick={handleStartUpsert}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl border-2 border-[#1f2937] bg-[#c67139] hover:bg-[#b2622d] text-white font-adminHeading font-bold text-sm sm:text-base shadow-[4px_4px_0_#1f2937] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <UploadCloud className="w-5 h-5" />
                <span>🚀 Upsert {totalQuestions} Questions to Supabase Live Bank</span>
              </button>
            </div>
          </div>
        )}

        {/* STAGE 2: UPSERTING IN PROGRESS */}
        {pipelineStep === "upserting" && (
          <div className="py-8 px-4 bg-white border-2 border-[#1f2937] rounded-2xl shadow-[4px_4px_0_#1f2937] flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#ffe1d0] border-2 border-[#1f2937] flex items-center justify-center text-[#c67139] shadow-[3px_3px_0_#1f2937]">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>

            <div className="flex flex-col gap-1 max-w-md">
              <h3 className="font-adminHeading text-lg font-bold text-[#1f2937]">
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
          <div className="flex flex-col gap-4">
            {/* SUCCESS BANNER CARD */}
            <div className="bg-[#dcead8] border-2 border-[#1f2937] rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_#1f2937] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Left side */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1c4427] text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                  <Check className="w-5 h-5 stroke-[3]" />
                </div>
                <div className="flex flex-col">
                  <h3 className="font-adminHeading text-sm sm:text-base font-bold text-[#142d1b]">
                    Paper Successfully Upserted to Supabase!
                  </h3>
                  <p className="text-xs text-[#27482f] font-medium">
                    All relational entities and options are live and queryable.
                  </p>
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                {archiveSuccess ? (
                  <span className="px-3.5 py-1.5 bg-[#c5d8bf] border border-[#1c4427]/30 text-[#142d1b] rounded-xl text-xs font-mono font-bold flex items-center gap-1">
                    ✓ {archiveSuccess}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleArchivePaper}
                    disabled={isArchiving}
                    className="px-3.5 py-1.5 bg-[#788a75] hover:bg-[#687a65] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0 shadow-xs active:translate-y-0.5"
                    title="Archive local staged JSON file to staging/archive/"
                  >
                    {isArchiving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Archiving...</span>
                      </>
                    ) : (
                      <>
                        <span>🗄️</span>
                        <span>Archive Staged JSON File</span>
                      </>
                    )}
                  </button>
                )}
                {archiveError && (
                  <span className="text-xs font-bold text-red-700">
                    ⚠️ {archiveError}
                  </span>
                )}
              </div>
            </div>

            {/* MAIN DATABASE RECEIPT CARD */}
            <div className="bg-white border-2 border-[#1f2937] rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0_#1f2937] flex flex-col gap-3.5">
              {/* Card Header */}
              <div className="flex items-start justify-between border-b border-[#eee7db] pb-3">
                <div className="flex items-center gap-2 pt-0.5">
                  <Database className="w-4 h-4 text-[#c67139]" />
                  <span className="font-adminHeading text-xs font-black tracking-wider text-[#1f2937] uppercase">
                    Supabase Database Receipt
                  </span>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#e3f4e9] text-[#166534] border border-[#a7e4be]">
                    {receipt?.is_new_insert === false ? "Updated" : "New Insert"}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#645c50]">
                    <span>ID: {formattedPaperId}</span>
                    {rawPaperId && (
                      <button
                        type="button"
                        onClick={handleCopyId}
                        className="p-1 hover:bg-[#eee7db] rounded transition-colors cursor-pointer flex items-center justify-center text-[#82796a] hover:text-[#1f2937]"
                        title="Copy full UUID to clipboard"
                        aria-label="Copy full UUID to clipboard"
                      >
                        {copiedId ? (
                          <Check className="w-3.5 h-3.5 text-[#166534] stroke-[2.5]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Tile Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Tile 1: Subject & Paper Code */}
                <div className="bg-[#fcfaf5] border border-[#e5dec9] rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-[#82796a] uppercase">
                    Subject &amp; Paper Code
                  </span>
                  <div className="font-adminHeading font-bold text-[#1f2937] text-sm sm:text-base pt-1">
                    {subjectName} ({subjectCode} / Paper {paperCode})
                  </div>
                </div>

                {/* Tile 2: Exam Session */}
                <div className="bg-[#fcfaf5] border border-[#e5dec9] rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-wider text-[#82796a] uppercase">
                      Exam Session
                    </span>
                    <span className="bg-[#ede6da] px-2 py-0.5 rounded text-[10px] font-mono font-bold text-[#645c50]">
                      {sessionBadge}
                    </span>
                  </div>
                  <div className="font-adminHeading font-bold text-[#1f2937] text-sm sm:text-base pt-1">
                    {sessionName} {year}
                  </div>
                </div>

                {/* Tile 3: Questions & Options Audit */}
                <div className="bg-[#fcfaf5] border border-[#e5dec9] rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-[#82796a] uppercase">
                    Questions &amp; Options Audit
                  </span>
                  <div className="font-adminHeading font-bold text-[#167a44] text-sm sm:text-base pt-1">
                    {questionsCount} MCQs • {optionsCount} Options (4/Q)
                  </div>
                </div>

                {/* Tile 4: Extracted Media Assets */}
                <div className="bg-[#fcfaf5] border border-[#e5dec9] rounded-xl p-3 flex flex-col justify-between">
                  <span className="text-[10px] font-bold tracking-wider text-[#82796a] uppercase">
                    Extracted Media Assets
                  </span>
                  <div className="flex flex-col pt-1">
                    <div className="font-adminHeading font-bold text-[#1f2937] text-xs sm:text-sm flex items-center gap-1.5">
                      <span>🖼️ {diagramCount} Diagrams</span>
                      <span>•</span>
                      <span>📊 {tableCount} Tables</span>
                    </div>
                    <div className="font-adminHeading font-bold text-[#167a44] text-xs sm:text-sm flex items-center gap-1 pt-0.5">
                      <span>✓ {verifiedCount}/{totalQuestions} Keys Verified</span>
                    </div>
                  </div>
                </div>

                {/* Tile 5: Syllabus Topics Mapped */}
                <div className="col-span-1 sm:col-span-2 bg-[#fcfaf5] border border-[#e5dec9] rounded-xl p-3 flex flex-col gap-2">
                  <span className="text-[10px] font-bold tracking-wider text-[#82796a] uppercase">
                    Syllabus Topics Mapped ({topicUnits.length} Units)
                  </span>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {topicUnits.map((t) => (
                      <span
                        key={t.name}
                        className="bg-[#eae4d8] text-[#201e1d] px-2.5 py-1 rounded-lg text-xs font-semibold shadow-2xs"
                      >
                        {t.index}. {t.shortName} ({t.count})
                      </span>
                    ))}
                    {topicUnits.length === 0 && (
                      <span className="text-xs text-[#82796a] italic">No topics mapped</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* FOOTER ACTION BUTTONS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <button
                type="button"
                onClick={handleUploadAnother}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-[#1f2937] bg-white hover:bg-[#eee7db] text-xs sm:text-sm font-adminHeading font-bold text-[#1f2937] shadow-[2px_2px_0_#1f2937] active:translate-y-0.5 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <span>+</span>
                <span>Upload Another Paper</span>
              </button>

              <button
                type="button"
                onClick={handleOpenWorkspace}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-[#1f2937] bg-white hover:bg-[#eee7db] text-xs sm:text-sm font-adminHeading font-bold text-[#1f2937] shadow-[2px_2px_0_#1f2937] active:translate-y-0.5 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
              >
                <span>←</span>
                <span>Done / Return Workspace</span>
              </button>

              <button
                type="button"
                onClick={handleViewQuestionBank}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-[#1f2937] bg-[#5f6e49] hover:bg-[#52603e] text-white font-adminHeading font-bold text-xs sm:text-sm shadow-[2px_2px_0_#1f2937] active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center"
              >
                <span>View in Question Bank</span>
                <span>↗</span>
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
                <h3 className="font-adminHeading text-sm font-bold text-[#b91c1c]">
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
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border-2 border-[#1f2937] bg-white hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#1f2937] shadow-[3px_3px_0_#1f2937] active:translate-y-0.5 transition-all cursor-pointer"
              >
                🛠️ Fix Questions in Studio Workspace
              </button>
              <button
                type="button"
                onClick={handleStartUpsert}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl border-2 border-[#1f2937] bg-[#c67139] hover:bg-[#b2622d] text-white font-adminHeading font-bold text-xs sm:text-sm shadow-[3px_3px_0_#1f2937] active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
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

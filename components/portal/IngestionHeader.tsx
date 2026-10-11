"use client";

import React, { useMemo, useState } from "react";
import type { StagingPaper, PaperLifecycleState } from "@/types/ingestion";
import {
  UploadCloud,
  Loader2,
  BookOpen,
  Undo2,
  Redo2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  FileUp,
  BookmarkCheck,
  Edit2,
  Settings,
  ArrowLeft,
} from "lucide-react";

export interface IngestionHeaderProps {
  /** Mode: 'setup' (wizard / empty state) or 'workspace' (active curation studio) */
  mode?: "setup" | "workspace";
  paper: StagingPaper | null;
  onOpenSettings?: () => void;
  onPublish: () => void;
  publishStatus: "idle" | "validating" | "publishing" | "success" | "error";
  publishMessage?: string;

  // Setup mode controls
  onReturnToStudio?: () => void;
  hasActivePaper?: boolean;

  // Dual-Pane & Lifecycle controls
  lifecycleState?: PaperLifecycleState;
  showPdfViewer?: boolean;
  onTogglePdfViewer?: () => void;

  // Undo / Redo controls
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;

  // Workflow actions
  onSwitchPaper?: () => void;
  onSaveDraft?: () => void;
  isDraftSaved?: boolean;

  // Backwards compatibility props (optional)
  onUploadJson?: (file: File) => void;
  onOpenPayloads?: () => void;
  onOpenAudit?: () => void;
  showLivePreview?: boolean;
  onTogglePreview?: () => void;
}

export default function IngestionHeader({
  mode,
  paper,
  onOpenSettings,
  onPublish,
  publishStatus,
  publishMessage: _publishMessage,
  onReturnToStudio,
  hasActivePaper,
  lifecycleState: _lifecycleState = "draft",
  showPdfViewer = true,
  onTogglePdfViewer,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onSwitchPaper,
  onSaveDraft,
  isDraftSaved = false,
}: IngestionHeaderProps) {
  const [justSaved, setJustSaved] = useState(false);

  // Determine effective mode: explicit mode takes priority, otherwise check paper existence
  const currentMode =
    mode ?? (paper && paper.questions && paper.questions.length > 0 ? "workspace" : "setup");

  // Calculate paper validation counters
  const { totalCount, validCount, reviewCount } = useMemo(() => {
    if (!paper || !paper.questions || paper.questions.length === 0) {
      return { totalCount: 0, validCount: 0, reviewCount: 0 };
    }

    const total = paper.questions.length;
    let valid = 0;

    for (const q of paper.questions) {
      if (q.status === "withdrawn") continue;
      let isQValid = true;
      if (!q.stem_markdown || q.stem_markdown.trim().length === 0) {
        isQValid = false;
      } else if (!Array.isArray(q.options) || q.options.length !== 4) {
        isQValid = false;
      } else {
        const correctCount = q.options.filter((opt) => opt.is_correct).length;
        if (correctCount !== 1) {
          isQValid = false;
        } else {
          const blankOpt = q.options.some((opt) => !(opt.content_markdown || "").trim());
          if (blankOpt) isQValid = false;
        }
      }

      if (isQValid) valid++;
    }

    const review = total - valid;
    return {
      totalCount: total,
      validCount: valid,
      reviewCount: review,
    };
  }, [paper]);

  const isPublishing = publishStatus === "publishing" || publishStatus === "validating";

  // Subject label formatting
  const subjectCode = paper?.subject?.code || "Cambridge";
  const subjectName = paper?.subject?.name || "Exam Paper";
  const subjectIcon = paper?.subject?.icon || "📝";
  const paperCode = paper?.paper?.paper_code || "MCQ";

  // Formatted series and year: e.g. "Summer 2024"
  const seriesMap: Record<string, string> = {
    s: "Summer",
    m: "Spring",
    w: "Winter",
  };
  const seriesKey = (paper?.paper?.series || "").toLowerCase();
  const seriesName = seriesMap[seriesKey] || (seriesKey ? seriesKey.toUpperCase() : "");
  const fullYear = paper?.paper?.year ? String(paper.paper.year) : "";

  // Handle local save draft trigger with feedback
  const handleSaveDraft = () => {
    if (onSaveDraft) {
      onSaveDraft();
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2200);
    }
  };

  // -------------------------------------------------------------
  // MODE: SETUP (Wizard / Setup Mode)
  // Clean pipeline branding, sample loaders, active return, ZERO phantom controls
  // -------------------------------------------------------------
  if (currentMode === "setup") {
    const hasPaperInMemory = Boolean(
      hasActivePaper || (paper && paper.questions && paper.questions.length > 0)
    );

    return (
      <header className="w-full bg-[#f9f4ed] border-[1.5px] border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[2px_2px_0_#201e1d] flex flex-col md:flex-row md:items-center justify-between gap-4 font-body">
        {/* Left Section: Pipeline Tag & Title */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-[#ffe1d0] border-[1.5px] border-[#201e1d] text-[#c67139] text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[1.5px_1.5px_0_#201e1d]">
              <Sparkles className="w-3.5 h-3.5 text-[#c67139]" />
              Cambridge Multimodal Pipeline
            </span>
            <span className="text-xs text-[#645c50] font-semibold">
              Gemini Vision 2.5 Ingestion
            </span>
          </div>
          <h1 className="font-heading font-black text-lg sm:text-xl text-[#201e1d] tracking-tight">
            Digitize &amp; Upsert Past Exam Papers
          </h1>
        </div>

        {/* Right Section: Return to Studio if paper is in memory (No fake presets) */}
        {hasPaperInMemory && onReturnToStudio && (
          <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
            <button
              type="button"
              onClick={onReturnToStudio}
              className="px-4 py-2 rounded-full border-[1.5px] border-[#201e1d] bg-white hover:bg-[#eee7db] active:translate-y-0.5 active:shadow-none text-xs sm:text-sm font-black text-[#201e1d] flex items-center gap-1.5 shadow-[2px_2px_0_#201e1d] transition-all cursor-pointer"
              title="Return to the active paper curation workspace"
            >
              <ArrowLeft className="w-4 h-4 text-[#201e1d]" />
              <span>← Return to Studio</span>
            </button>
          </div>
        )}
      </header>
    );
  }

  // -------------------------------------------------------------
  // MODE: WORKSPACE (Active Curation Studio)
  // Paper identity badge, live counters, workspace tools, Neobrutalist Upsert CTA
  // -------------------------------------------------------------
  return (
    <header className="w-full bg-[#f9f4ed] border-[1.5px] border-[#201e1d] rounded-2xl p-3.5 sm:p-4 shadow-[2px_2px_0_#201e1d] flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 font-body">
      {/* Left Section: Subject & Paper Code Badge + Validation Indicators */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3.5 flex-wrap">
        {/* Paper Identity Badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white border-[1.5px] border-[#201e1d] rounded-full px-3.5 py-1.5 shadow-[2px_2px_0_#201e1d]">
            <span className="text-base select-none">{subjectIcon}</span>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#201e1d]">
              <span className="font-heading font-black text-sm">
                {subjectCode} / {paperCode}
              </span>
              <span className="text-[#82796a]">·</span>
              <span className="text-[#201e1d] font-bold">{subjectName}</span>
              <span className="text-[#645c50] font-semibold">
                {seriesName} {fullYear}
              </span>
            </div>

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                title="Edit paper subject, year, series, and code metadata"
                className="ml-1 p-1 rounded-full text-[#645c50] hover:text-[#201e1d] hover:bg-[#eee7db] transition-colors cursor-pointer"
                aria-label="Edit metadata"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Total Questions Badge */}
          <span className="px-3 py-1 rounded-full bg-white border-[1.5px] border-[#201e1d] text-[#201e1d] text-xs font-black shadow-[1.5px_1.5px_0_#201e1d]">
            {totalCount} Questions
          </span>

          {/* Validation Counters */}
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span
                className="px-2.5 py-1 rounded-full bg-[#f0fae1] border-[1.5px] border-[#201e1d] text-[#3d472b] text-xs font-black flex items-center gap-1 shadow-[1.5px_1.5px_0_#201e1d]"
                title={`${validCount} questions pass all validation checks`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#56633f]" />
                <span>{validCount}/{totalCount} Valid ✓</span>
              </span>

              {reviewCount > 0 && (
                <span
                  className="px-2.5 py-1 rounded-full bg-[#ffe1d0] border-[1.5px] border-[#201e1d] text-[#c67139] text-xs font-black flex items-center gap-1 shadow-[1.5px_1.5px_0_#201e1d]"
                  title={`${reviewCount} questions require curator review`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#c67139]" />
                  <span>{reviewCount} Review ⚠</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Section: Workspace Controls & Primary Upsert CTA */}
      <div className="flex items-center gap-2 sm:gap-2.5 self-end xl:self-auto flex-wrap">
        {/* Switch Paper / Upload New */}
        {onSwitchPaper && (
          <button
            type="button"
            onClick={onSwitchPaper}
            className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#201e1d] bg-white hover:bg-[#eee7db] active:translate-y-0.5 active:shadow-none text-xs font-bold text-[#201e1d] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d]"
            title="Switch paper or upload a new PDF"
          >
            <FileUp className="w-3.5 h-3.5 text-[#201e1d]" />
            <span className="hidden sm:inline">Switch Paper / Upload New</span>
            <span className="sm:hidden">New Paper</span>
          </button>
        )}

        {/* Undo / Redo Controls */}
        {onUndo && onRedo && (
          <div className="flex items-center border-[1.5px] border-[#201e1d] rounded-full bg-white overflow-hidden shadow-[2px_2px_0_#201e1d]">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo edit"
              title="Undo question edit (Ctrl+Z)"
              className="px-2.5 py-1.5 hover:bg-[#eee7db] disabled:opacity-30 disabled:cursor-not-allowed border-r border-[#201e1d] text-[#201e1d] transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo edit"
              title="Redo question edit (Ctrl+Y)"
              className="px-2.5 py-1.5 hover:bg-[#eee7db] disabled:opacity-30 disabled:cursor-not-allowed text-[#201e1d] transition-colors cursor-pointer"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Split View (PDF) Toggle */}
        {onTogglePdfViewer && (
          <button
            type="button"
            onClick={onTogglePdfViewer}
            className={`px-3.5 py-1.5 rounded-full border-[1.5px] border-[#201e1d] text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none ${
              showPdfViewer
                ? "bg-[#ffe1d0] text-[#c67139]"
                : "bg-white text-[#201e1d] hover:bg-[#eee7db]"
            }`}
            title={showPdfViewer ? "Hide PDF Source Pane" : "Show Dual-Pane PDF Source"}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{showPdfViewer ? "Hide PDF" : "Split View (PDF)"}</span>
          </button>
        )}

        {/* Save Draft Action */}
        {onSaveDraft && (
          <button
            type="button"
            onClick={handleSaveDraft}
            className={`px-3.5 py-1.5 rounded-full border-[1.5px] border-[#201e1d] text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none ${
              justSaved || isDraftSaved
                ? "bg-[#f0fae1] text-[#3d472b]"
                : "bg-white text-[#201e1d] hover:bg-[#eee7db]"
            }`}
            title="Save draft to local browser storage"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-[#56633f]" />
            <span>{justSaved ? "Draft Saved ✓" : "Save Draft"}</span>
          </button>
        )}

        {/* Paper Settings Button */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-full border-[1.5px] border-[#201e1d] bg-white hover:bg-[#eee7db] text-[#201e1d] transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
            title="Paper metadata and syllabus topics"
            aria-label="Paper settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Primary CTA: Neobrutalist Upsert to Supabase Button */}
        <button
          type="button"
          onClick={onPublish}
          disabled={isPublishing || !paper || totalCount === 0}
          title={
            reviewCount > 0
              ? `${reviewCount} questions require curator review before upsert`
              : "Upsert all verified questions to Supabase"
          }
          className={`px-5 py-2.5 rounded-full border-[1.5px] border-[#201e1d] font-heading font-black text-xs sm:text-sm flex items-center gap-2 transition-all shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
            publishStatus === "success"
              ? "bg-[#728157] text-[#f9f4ed]"
              : "bg-[#c67139] text-[#f9f4ed] hover:bg-[#b2622d]"
          }`}
        >
          {isPublishing ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#f9f4ed]" />
          ) : publishStatus === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-[#f9f4ed]" />
          ) : (
            <UploadCloud className="w-4 h-4 text-[#f9f4ed]" />
          )}
          <span>
            {publishStatus === "publishing"
              ? "Upserting..."
              : publishStatus === "validating"
              ? "Validating..."
              : publishStatus === "success"
              ? "Upserted to Supabase! ✓"
              : "Upsert to Supabase"}
          </span>
        </button>
      </div>
    </header>
  );
}

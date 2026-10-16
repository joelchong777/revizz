"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import type { StagingPaper, PaperLifecycleState } from "@/types/ingestion";
import {
  UploadCloud,
  Loader2,
  BookOpen,
  Undo2,
  Redo2,
  CheckCircle2,
  AlertTriangle,
  FileUp,
  Edit2,
  Settings,
  Archive,
  Trash2,
  TrendingUp,
  FlaskConical,
  Atom,
  Calculator,
  Globe,
  MoreHorizontal,
  FileCode,
  SlidersHorizontal,
  Check,
  Eye,
} from "lucide-react";

export interface IngestionHeaderProps {
  /** Mode: 'setup' (wizard / empty state) or 'workspace' (active curation studio) */
  mode?: "setup" | "workspace";
  paper: StagingPaper | null;
  onOpenSettings?: () => void;
  onPublish: () => void;
  publishStatus: "idle" | "validating" | "publishing" | "success" | "error";
  publishMessage?: string;
  onArchiveStagedPaper?: (paperId: string) => Promise<{ success: boolean; error?: string }>;
  onDeleteStagedPaper?: (paperId: string) => Promise<{ success: boolean; error?: string }>;

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

  // Mark scheme verification
  onOpenMarkSchemeModal?: () => void;
  markSchemeStatus?: "perfect_match" | "mismatches_found" | "incomplete" | "unverified";

  // Backwards compatibility props (optional)
  onUploadJson?: (file: File) => void;
  onOpenPayloads?: () => void;
  onOpenAudit?: () => void;
  showLivePreview?: boolean;
  onTogglePreview?: () => void;
}

/**
 * Intelligent icon renderer: maps icon slugs (e.g. "trending-up") to actual Lucide components,
 * cleanly renders Unicode emoji glyphs, and never displays raw string identifiers.
 */
function renderSubjectIcon(icon?: string) {
  if (!icon) return <span className="text-base select-none leading-none">📝</span>;
  const clean = icon.trim();
  const lower = clean.toLowerCase();

  // Lucide icon name mappings
  if (
    lower === "trending-up" ||
    lower === "trending_up" ||
    lower === "trendingup" ||
    lower.includes("trending") ||
    lower.includes("econ")
  ) {
    return <TrendingUp className="w-4 h-4 text-[#c67139]" />;
  }
  if (lower === "atom" || lower.includes("physics")) {
    return <Atom className="w-4 h-4 text-[#c67139]" />;
  }
  if (lower === "flask" || lower === "flask-conical" || lower.includes("chemistry")) {
    return <FlaskConical className="w-4 h-4 text-[#c67139]" />;
  }
  if (lower === "calculator" || lower.includes("math")) {
    return <Calculator className="w-4 h-4 text-[#c67139]" />;
  }
  if (lower === "globe" || lower.includes("geography")) {
    return <Globe className="w-4 h-4 text-[#c67139]" />;
  }
  if (lower === "book" || lower === "book-open") {
    return <BookOpen className="w-4 h-4 text-[#c67139]" />;
  }

  // If it's a Unicode emoji
  const isEmoji = /\p{Extended_Pictographic}/u.test(clean);
  if (isEmoji) {
    return <span className="text-base select-none leading-none">{clean}</span>;
  }

  // Safe fallback
  return <span className="text-base select-none leading-none">📝</span>;
}

export default function IngestionHeader({
  mode,
  paper,
  onOpenSettings,
  onPublish,
  publishStatus,
  publishMessage: _publishMessage,
  onReturnToStudio: _onReturnToStudio,
  hasActivePaper: _hasActivePaper,
  lifecycleState: _lifecycleState = "review",
  showPdfViewer = true,
  onTogglePdfViewer,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onSwitchPaper,
  onArchiveStagedPaper,
  onDeleteStagedPaper,
  onOpenPayloads,
  onOpenAudit,
  onOpenMarkSchemeModal,
  markSchemeStatus = "unverified",
  showLivePreview = false,
  onTogglePreview,
}: IngestionHeaderProps) {
  const [archiveState, setArchiveState] = useState<"idle" | "archiving" | "archived" | "error">("idle");
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [deleteState, setDeleteState] = useState<"idle" | "deleting" | "deleted" | "error">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu on click outside or Escape key
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsMoreMenuOpen(false);
      }
    }
    if (isMoreMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isMoreMenuOpen]);

  const performArchive = async () => {
    if (!paper?.id) return;
    setShowArchiveConfirm(false);
    setArchiveState("archiving");
    setArchiveError(null);
    try {
      if (onArchiveStagedPaper) {
        const res = await onArchiveStagedPaper(paper.id);
        if (!res.success) throw new Error(res.error || "Failed to archive staged paper");
      } else {
        const res = await fetch("/api/ingest/staged-paper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive", id: paper.id }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.success) {
          throw new Error(result.error || `Archive failed with status ${res.status}`);
        }
      }
      setArchiveState("archived");
    } catch (err: any) {
      setArchiveState("error");
      setArchiveError(err?.message || "Error archiving paper");
    }
  };

  const performDelete = async () => {
    if (!paper?.id) return;
    setShowDeleteConfirm(false);
    setDeleteState('deleting');
    setDeleteError(null);
    try {
      if (onDeleteStagedPaper) {
        const res = await onDeleteStagedPaper(paper.id);
        if (!res.success) throw new Error(res.error || 'Failed to delete staged paper');
      } else {
        const res = await fetch(`/api/ingest/staged-paper?id=${encodeURIComponent(paper.id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: paper.id }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.success) {
          throw new Error(result.error || `Delete failed with status ${res.status}`);
        }
      }
      setDeleteState('deleted');
      if (onSwitchPaper) {
        onSwitchPaper();
      }
    } catch (err: any) {
      setDeleteState('error');
      setDeleteError(err?.message || 'Error deleting paper');
    }
  };

  // Determine effective mode: explicit mode takes priority, otherwise check paper existence
  const currentMode =
    mode ?? (paper && paper.questions && paper.questions.length > 0 ? "workspace" : "setup");

  // Calculate paper validation counters defensively
  const { totalCount, validCount, reviewCount } = useMemo(() => {
    if (!paper || !paper.questions || !Array.isArray(paper.questions) || paper.questions.length === 0) {
      return { totalCount: 0, validCount: 0, reviewCount: 0 };
    }

    const total = paper.questions.length;
    let valid = 0;

    for (const q of paper.questions) {
      if (!q || q.status === "withdrawn") continue;
      let isQValid = true;
      if (!q.stem_markdown || typeof q.stem_markdown !== "string" || q.stem_markdown.trim().length === 0) {
        isQValid = false;
      } else if (!Array.isArray(q.options) || q.options.length !== 4) {
        isQValid = false;
      } else {
        const correctCount = q.options.filter((opt) => opt && opt.is_correct).length;
        if (correctCount !== 1) {
          isQValid = false;
        } else {
          const blankOpt = q.options.some((opt) => !opt || !(opt.content_markdown || "").trim());
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

  // Defensive Subject & Paper metadata formatting
  const subjectCode = paper?.subject?.code || (paper?.id ? paper.id.split("_")[0] : "Cambridge");
  const subjectName = paper?.subject?.name || "Exam Paper";
  const subjectIconRaw = paper?.subject?.icon;
  const paperCode = paper?.paper?.paper_code || (paper?.id ? paper.id.split("_")[2] : "MCQ");

  // Formatted series and year: e.g. "Summer 2024"
  const seriesMap: Record<string, string> = {
    s: "Summer",
    m: "Spring",
    w: "Winter",
  };
  const seriesKey = (paper?.paper?.series || "").toLowerCase();
  const seriesName = seriesMap[seriesKey] || (seriesKey ? seriesKey.toUpperCase() : "");
  const fullYear = paper?.paper?.year ? String(paper.paper.year) : "";


  // -------------------------------------------------------------
  // MODE: SETUP (Wizard / Setup Mode)
  // When in setup mode, the wizard renders its own hero / inputs. Return null.
  // -------------------------------------------------------------
  if (mode === "setup") return null;
  if (currentMode === "setup") {
    return null;
  }

  // -------------------------------------------------------------
  // MODE: WORKSPACE (Active Curation Studio)
  // Streamlined 2-cluster layout: Paper Identity (Left) | Controls & Primary CTA (Right)
  // -------------------------------------------------------------
  return (
    <>
      <header className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-3 sm:p-3.5 shadow-[2px_2px_0_#201e1d] flex flex-col xl:flex-row xl:items-center justify-between gap-3 font-body">
        {/* Left Section: Paper Identity Pill + Total Count + Validation Indicators */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Paper Identity Pill */}
          <div className="flex items-center gap-2 bg-white border-2 border-[#201e1d] rounded-full px-3.5 py-1.5 shadow-[2px_2px_0_#201e1d]">
            <span className="flex items-center justify-center shrink-0">
              {renderSubjectIcon(subjectIconRaw)}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-[#201e1d]">
              <span className="font-adminHeading font-bold text-sm text-[#201e1d]">
                {subjectCode} / {paperCode}
              </span>
              <span className="text-[#82796a]">·</span>
              <span className="text-[#201e1d] font-bold">{subjectName}</span>
              {(seriesName || fullYear) && (
                <span className="text-[#645c50] font-mono text-[11px] font-semibold">
                  {seriesName} {fullYear}
                </span>
              )}
            </div>

            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                title="Edit paper subject, year, series, and code metadata"
                className="ml-0.5 p-1 rounded-full text-[#645c50] hover:text-[#201e1d] hover:bg-[#eee7db] transition-colors cursor-pointer active:translate-y-0.5"
                aria-label="Edit metadata"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Total Questions Count Badge */}
          <span className="px-3 py-1 rounded-full bg-white border-2 border-[#201e1d] text-[#201e1d] text-xs font-mono font-bold shadow-[2px_2px_0_#201e1d]">
            {totalCount} Questions
          </span>

          {/* Validation Counters */}
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span
                className={`px-2.5 py-1 rounded-full border-2 border-[#201e1d] text-xs font-mono font-bold flex items-center gap-1 shadow-[2px_2px_0_#201e1d] ${
                  validCount === totalCount
                    ? "bg-[#d1fae5] text-[#065f46]"
                    : "bg-[#fef3c7] text-[#92400e]"
                }`}
                title={`${validCount} of ${totalCount} questions pass all validation checks`}
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    validCount === totalCount ? "text-[#065f46]" : "text-[#92400e]"
                  }`}
                />
                <span>
                  {validCount}/{totalCount} Valid {validCount === totalCount && "✓"}
                </span>
              </span>

              {reviewCount > 0 && (
                <span
                  className="px-2.5 py-1 rounded-full bg-[#fef3c7] border-2 border-[#201e1d] text-[#92400e] text-xs font-mono font-bold flex items-center gap-1 shadow-[2px_2px_0_#201e1d]"
                  title={`${reviewCount} questions require curator review before publishing`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#92400e]" />
                  <span>{reviewCount} Review ⚠</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right Section: Secondary Tools + Overflow Menu + Primary Live CTA */}
        <div className="flex items-center gap-2 self-end xl:self-auto flex-wrap">
          {/* Split View (PDF) Toggle */}
          {onTogglePdfViewer && (
            <button
              type="button"
              onClick={onTogglePdfViewer}
              className={`px-3 py-1.5 rounded-full border-2 border-[#201e1d] text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none ${
                showPdfViewer
                  ? "bg-[#ffe1d0] text-[#c67139]"
                  : "bg-white text-[#201e1d] hover:bg-[#eee7db]"
              }`}
              title={showPdfViewer ? "Hide PDF Source Pane" : "Show Dual-Pane PDF Source"}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{showPdfViewer ? "Hide PDF" : "Show PDF"}</span>
            </button>
          )}

          {/* Student Live Preview Simulator Toggle */}
          {onTogglePreview && (
            <button
              type="button"
              onClick={onTogglePreview}
              className={`px-3 py-1.5 rounded-full border-2 border-[#201e1d] text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none ${
                showLivePreview
                  ? "bg-[#0284c7] text-white"
                  : "bg-[#e0f2fe] text-[#0369a1] hover:bg-[#bae6fd]"
              }`}
              title={showLivePreview ? "Close Student Preview" : "Open Student Interactive Preview Simulator"}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          )}

          {/* 7-Point Quality Gate Audit Drawer Button */}
          {onOpenAudit && (
            <button
              type="button"
              onClick={onOpenAudit}
              className="px-3 py-1.5 rounded-full border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] active:translate-y-0.5 active:shadow-none text-xs font-bold text-[#201e1d] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d]"
              title="Open 7-Point Quality Gate Audit Drawer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#201e1d]" />
              <span>Audit</span>
            </button>
          )}

          {/* Cambridge Mark Scheme Verification Button */}
          {onOpenMarkSchemeModal && (
            <button
              type="button"
              onClick={onOpenMarkSchemeModal}
              className={`px-3 py-1.5 rounded-full border-2 border-[#201e1d] text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5 shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none ${
                markSchemeStatus === "perfect_match"
                  ? "bg-[#dcfce7] text-[#166534] hover:bg-[#bbf7d0]"
                  : markSchemeStatus === "mismatches_found"
                  ? "bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a]"
                  : "bg-white text-[#201e1d] hover:bg-[#eee7db]"
              }`}
              title="Verify paper against Cambridge Mark Scheme"
            >
              <CheckCircle2
                className={`w-3.5 h-3.5 ${
                  markSchemeStatus === "perfect_match"
                    ? "text-[#166534]"
                    : markSchemeStatus === "mismatches_found"
                    ? "text-[#92400e]"
                    : "text-[#201e1d]"
                }`}
              />
              <span>Verify MS</span>
              {markSchemeStatus === "perfect_match" && (
                <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
              )}
              {markSchemeStatus === "mismatches_found" && (
                <span className="w-2 h-2 rounded-full bg-[#d97706]" />
              )}
            </button>
          )}


          {/* Switch Paper / Upload New */}
          {onSwitchPaper && (
            <button
              type="button"
              onClick={onSwitchPaper}
              className="px-3 py-1.5 rounded-full border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] active:translate-y-0.5 active:shadow-none text-xs font-bold text-[#201e1d] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d]"
              title="Switch paper or upload a new PDF"
            >
              <FileUp className="w-3.5 h-3.5 text-[#201e1d]" />
              <span className="hidden sm:inline">Switch Paper</span>
              <span className="sm:hidden">Switch</span>
            </button>
          )}

          {/* More Actions Overflow Dropdown [···] */}
          <div className="relative" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              aria-label="More studio actions"
              title="More actions (Undo, Redo, Settings, Payloads, Audit, Delete)"
              className="p-1.5 rounded-full border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-[#201e1d] transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none flex items-center justify-center"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {isMoreMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl shadow-[4px_4px_0_#201e1d] z-50 py-1.5 animate-in fade-in zoom-in-95 font-body">
                {/* Undo / Redo Row */}
                {(onUndo || onRedo) && (
                  <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#dcd3c4]">
                    <span className="text-[11px] font-bold text-[#645c50] uppercase tracking-wider">
                      History
                    </span>
                    <div className="flex items-center gap-1">
                      {onUndo && (
                        <button
                          type="button"
                          onClick={() => {
                            onUndo();
                            setIsMoreMenuOpen(false);
                          }}
                          disabled={!canUndo}
                          title="Undo edit (Ctrl+Z)"
                          className="p-1 rounded-lg border border-[#dcd3c4] bg-white hover:bg-[#eee7db] disabled:opacity-30 disabled:cursor-not-allowed text-[#201e1d] cursor-pointer"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onRedo && (
                        <button
                          type="button"
                          onClick={() => {
                            onRedo();
                            setIsMoreMenuOpen(false);
                          }}
                          disabled={!canRedo}
                          title="Redo edit (Ctrl+Y)"
                          className="p-1 rounded-lg border border-[#dcd3c4] bg-white hover:bg-[#eee7db] disabled:opacity-30 disabled:cursor-not-allowed text-[#201e1d] cursor-pointer"
                        >
                          <Redo2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Settings Item */}
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSettings();
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#645c50]" />
                    <span>Paper Settings</span>
                  </button>
                )}

                {/* Payloads Inspector Item */}
                {onOpenPayloads && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenPayloads();
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <FileCode className="w-3.5 h-3.5 text-[#645c50]" />
                    <span>Inspect JSON</span>
                  </button>
                )}

                {/* Audit Drawer Item */}
                {onOpenAudit && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenAudit();
                      setIsMoreMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#645c50]" />
                    <span>Ingestion Audit</span>
                  </button>
                )}

                {/* Delete Staged Paper Item */}
                {paper && (
                  <>
                    <div className="my-1 border-t border-[#dcd3c4]" />
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        setShowDeleteConfirm(true);
                      }}
                      disabled={deleteState === "deleting"}
                      className="w-full px-3 py-2 text-left text-xs font-semibold text-[#b91c1c] hover:bg-[#fee2e2] flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-[#b91c1c]" />
                      <span>Delete Staged Paper</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Primary CTA / Supabase Live Status Cluster */}
          {publishStatus === "success" && paper ? (
            /* Sleek Live in Supabase Status Pill + Clean Archive Action */
            <div className="flex items-center gap-2 bg-[#d1fae5] border-2 border-[#201e1d] rounded-full px-3.5 py-1.5 shadow-[2px_2px_0_#201e1d]">
              <span className="text-xs font-adminHeading font-bold text-[#065f46] flex items-center gap-1.5">
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Live in Supabase</span>
              </span>

              <span className="text-[#065f46]/40">·</span>

              {archiveState === "archived" ? (
                <span className="text-xs font-bold text-[#065f46] flex items-center gap-1 font-mono">
                  ✓ Archived
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowArchiveConfirm(true)}
                  disabled={archiveState === "archiving"}
                  className="px-2.5 py-0.5 rounded-full bg-[#065f46] text-[#f9f4ed] hover:bg-[#044e39] text-xs font-adminHeading font-bold transition-all cursor-pointer shadow-[1px_1px_0_#201e1d] active:translate-y-0.5 active:shadow-none disabled:opacity-50 flex items-center gap-1.5"
                  title="Archive staged paper so it no longer appears in uncurated staging list"
                >
                  {archiveState === "archiving" ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Archiving...</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-3 h-3" />
                      <span>Archive Draft</span>
                    </>
                  )}
                </button>
              )}
              {archiveError && (
                <span className="text-xs font-bold text-red-600" title={archiveError}>
                  ⚠️
                </span>
              )}
            </div>
          ) : (
            /* Primary Neobrutalist [Upsert to Supabase] Action */
            <motion.button
              type="button"
              onClick={onPublish}
              disabled={isPublishing || !paper || totalCount === 0}
              whileHover={!isPublishing && paper && totalCount > 0 ? { scale: 1.01 } : undefined}
              whileTap={!isPublishing && paper && totalCount > 0 ? { scale: 0.98 } : undefined}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              title={
                reviewCount > 0
                  ? `${reviewCount} questions require curator review before upsert`
                  : "Upsert all verified questions to Supabase"
              }
              className={`px-4 py-2 rounded-full border-2 border-[#201e1d] font-adminHeading font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                publishStatus === "success"
                  ? "bg-[#065f46] text-[#f9f4ed]"
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
            </motion.button>
          )}
        </div>
      </header>

      {/* Defensive Archive Confirmation Dialog (§13 Resilience) */}
      {showArchiveConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-dialog-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-6 max-w-md w-full shadow-[4px_4px_0_#201e1d] flex flex-col gap-4 font-body animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#d1fae5] border-2 border-[#201e1d] text-[#065f46] flex items-center justify-center shrink-0 shadow-[2px_2px_0_#201e1d]">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 id="archive-dialog-title" className="font-adminHeading text-base font-bold text-[#201e1d]">
                  Archive Staged Paper?
                </h3>
                <p className="text-xs text-[#645c50] font-medium">
                  Safely archive this published staged paper so it no longer clutters active staging.
                </p>
              </div>
            </div>

            {/* Defensive Paper Preview Card */}
            <div className="p-3 bg-white border-2 border-[#201e1d] rounded-xl flex items-center justify-between text-xs font-mono shadow-[2px_2px_0_#201e1d]">
              <div className="flex items-center gap-2 truncate">
                <span>{renderSubjectIcon(subjectIconRaw)}</span>
                <span className="font-bold text-[#201e1d]">
                  {subjectCode}/{paperCode}
                </span>
                <span className="text-[#82796a] truncate">{subjectName}</span>
              </div>
              <span className="px-2 py-0.5 bg-[#d1fae5] text-[#065f46] border border-[#065f46]/40 rounded-full text-[10px] font-bold shrink-0">
                {totalCount} Questions
              </span>
            </div>

            <p className="text-[11px] text-[#645c50] font-medium leading-relaxed">
              Archiving moves this paper to archive storage while keeping a clean history on disk. It will not be lost.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#dcd3c4]">
              <button
                type="button"
                onClick={() => setShowArchiveConfirm(false)}
                className="px-4 py-2 rounded-full border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-bold text-[#201e1d] transition-colors cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={performArchive}
                className="px-4 py-2 rounded-full border-2 border-[#201e1d] bg-[#065f46] hover:bg-[#044e39] text-white text-xs font-adminHeading font-bold transition-colors cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
              >
                Confirm Archive
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Defensive Delete Confirmation Dialog (§13 Resilience) */}
      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="header-delete-dialog-title"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-6 max-w-md w-full shadow-[4px_4px_0_#201e1d] flex flex-col gap-4 font-body animate-in fade-in zoom-in-95 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#fee2e2] border-2 border-[#b91c1c] text-[#b91c1c] flex items-center justify-center shrink-0 shadow-[2px_2px_0_#201e1d]">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="header-delete-dialog-title" className="font-adminHeading text-base font-bold text-[#201e1d]">
                  Delete Staged Paper?
                </h3>
                <p className="text-xs text-[#645c50] font-mono">
                  {paper?.id || "paper"}.json
                </p>
              </div>
            </div>

            {/* Defensive Paper Preview Card */}
            <div className="p-3 bg-white border-2 border-[#201e1d] rounded-xl flex items-center justify-between text-xs font-mono shadow-[2px_2px_0_#201e1d]">
              <div className="flex items-center gap-2 truncate">
                <span>{renderSubjectIcon(subjectIconRaw)}</span>
                <span className="font-bold text-[#201e1d]">
                  {subjectCode}/{paperCode}
                </span>
                <span className="text-[#82796a] truncate">
                  {subjectName}
                </span>
              </div>
              <span className="px-2 py-0.5 bg-[#fef3c7] text-[#92400e] border border-[#d97706]/40 rounded-full text-[10px] font-bold shrink-0">
                {totalCount} Questions
              </span>
            </div>

            <p className="text-xs text-[#b91c1c] font-medium leading-relaxed">
              This will permanently delete this paper from your local staging environment. This action cannot be undone.
            </p>

            {deleteError && (
              <p className="text-xs text-[#b91c1c] bg-[#fee2e2] p-2 rounded-lg border border-[#b91c1c]">
                {deleteError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#dcd3c4]">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-full border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-bold text-[#201e1d] transition-colors cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteState === "deleting"}
                onClick={performDelete}
                className="px-4 py-2 rounded-full border-2 border-[#201e1d] bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-adminHeading font-bold transition-colors cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 disabled:opacity-50"
              >
                {deleteState === "deleting" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

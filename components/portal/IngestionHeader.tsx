"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { StagingPaper, StagingQuestion, PaperLifecycleState } from "@/types/ingestion";
import {
  UploadCloud,
  Loader2,
  Eye,
  ClipboardCheck,
  FileCode,
  Settings,
  Upload,
  Gamepad2,
  ExternalLink,
  MoreHorizontal,
  FolderDown,
  BookOpen,
  Undo2,
  Redo2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";

export interface IngestionHeaderProps {
  paper: StagingPaper | null;
  onLoadPreset: ((preset?: string) => void) | (() => void);
  onUploadJson: (file: File) => void;
  onOpenSettings: () => void;
  onOpenPayloads: () => void;
  onOpenAudit: () => void;
  onPublish: () => void;
  publishStatus: "idle" | "validating" | "publishing" | "success" | "error";
  publishMessage?: string;
  showLivePreview: boolean;
  onTogglePreview: () => void;

  // Dual-Pane & Lifecycle controls
  lifecycleState?: PaperLifecycleState;
  showPdfViewer?: boolean;
  onTogglePdfViewer?: () => void;

  // Undo / Redo controls
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export default function IngestionHeader({
  paper,
  onLoadPreset,
  onUploadJson,
  onOpenSettings,
  onOpenPayloads,
  onOpenAudit,
  onPublish,
  publishStatus,
  publishMessage: _publishMessage,
  showLivePreview,
  onTogglePreview,
  lifecycleState = "draft",
  showPdfViewer = true,
  onTogglePdfViewer,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: IngestionHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("0455_s24_12");
  const [availablePresets, setAvailablePresets] = useState<string[]>([
    "0455_s24_12",
    "0455_w23_11",
    "0455_m24_12",
    "0455_s23_12",
  ]);

  // Fetch available staging files on mount if available
  useEffect(() => {
    fetch("/api/ingest/staged-paper")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (data?.success && Array.isArray(data.papers) && data.papers.length > 0) {
          setAvailablePresets((prev) => {
            const set = new Set([...data.papers, ...prev]);
            return Array.from(set);
          });
        }
      })
      .catch(() => {
        // Fallback silently to preset list
      });
  }, []);

  // Close overflow menu on outside click or escape key
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  // Calculate paper validation counters
  const { totalCount, validCount, reviewCount, totalIssues } = useMemo(() => {
    if (!paper || !paper.questions || paper.questions.length === 0) {
      return { totalCount: 0, validCount: 0, reviewCount: 0, totalIssues: 0 };
    }

    const total = paper.questions.length;
    let valid = 0;
    let issues = 0;

    for (const q of paper.questions) {
      let isQValid = true;
      if (q.status === "withdrawn") {
        // Withdrawn questions do not block validity
        continue;
      }
      if (!q.stem_markdown || q.stem_markdown.trim().length === 0) {
        isQValid = false;
        issues++;
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        isQValid = false;
        issues++;
      } else {
        const correctCount = q.options.filter((opt) => opt.is_correct).length;
        if (correctCount !== 1) {
          isQValid = false;
          issues++;
        }
      }

      if (isQValid) {
        valid++;
      }
    }

    const review = total - valid;
    return {
      totalCount: total,
      validCount: valid,
      reviewCount: review,
      totalIssues: issues,
    };
  }, [paper]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadJson(file);
    }
    e.target.value = "";
  };

  const isPublishing = publishStatus === "publishing" || publishStatus === "validating";

  // Lifecycle Badge Configuration
  const effectiveLifecycle = paper?.lifecycle_state || paper?.state || lifecycleState;
  const lifecycleBadge = useMemo(() => {
    switch (effectiveLifecycle) {
      case "extracting":
        return {
          label: "Extracting...",
          className: "bg-[#e0e7ff] text-[#312e81] border-[#312e81] animate-pulse",
          dotColor: "#4f46e5",
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
        };
      case "review":
        return {
          label: "Ready for Review",
          className: "bg-[#ccfbf1] text-[#115e59] border-[#115e59]",
          dotColor: "#0d9488",
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
      case "published":
        return {
          label: "Published",
          className: "bg-[#dcfce7] text-[#14532d] border-[#14532d]",
          dotColor: "#16a34a",
          icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" />,
        };
      case "draft":
      default:
        return {
          label: "Draft",
          className: "bg-[#fef3c7] text-[#78350f] border-[#78350f]",
          dotColor: "#d97706",
          icon: null,
        };
    }
  }, [effectiveLifecycle]);

  return (
    <header className="w-full bg-[#FFFDF7] border-2 border-b-4 border-[#2b2b2b] rounded-2xl shadow-[4px_4px_0px_#2b2b2b] px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3 font-body">
      {/* Hidden File Input for JSON Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left Section: Studio Title, Lifecycle Badge & Quick-Edit Metadata Pills */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2">
          <span className="font-heading text-lg sm:text-xl font-black text-[#2b2b2b] tracking-tight flex items-center gap-1.5 select-none">
            <span className="bg-[#ffd166] border-2 border-[#2b2b2b] px-2 py-0.5 rounded-lg shadow-[2px_2px_0px_#2b2b2b]">
              Revizz
            </span>
            <span>Studio</span>
          </span>
        </div>

        {/* Paper Lifecycle Pill Badge */}
        <div
          className={`px-2.5 py-1 border-2 rounded-full text-xs font-black shadow-[2px_2px_0px_#2b2b2b] flex items-center gap-1.5 whitespace-nowrap ${lifecycleBadge.className}`}
        >
          {lifecycleBadge.icon ? (
            lifecycleBadge.icon
          ) : (
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: lifecycleBadge.dotColor }}
            />
          )}
          <span>{lifecycleBadge.label}</span>
        </div>

        {/* Metadata Quick-Edit Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Subject Pill */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Click to edit subject & paper settings"
            className="px-2.5 py-1 bg-[#ffe5d9] hover:bg-[#ffd7c4] border-2 border-[#2b2b2b] rounded-full text-xs font-bold text-[#2b2b2b] shadow-[2px_2px_0px_#2b2b2b] active:translate-y-0.5 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>{paper?.subject?.icon || "📈"}</span>
            <span>{paper?.subject?.code || "0455"}</span>
            <span className="text-[#2b2b2b]/70 font-semibold hidden sm:inline">
              {paper?.subject?.name || "Economics"}
            </span>
          </button>

          {/* Paper Series & Code Pill */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Click to edit series & paper code"
            className="px-2.5 py-1 bg-[#e0f2fe] hover:bg-[#bae6fd] border-2 border-[#2b2b2b] rounded-full text-xs font-bold text-[#0369a1] shadow-[2px_2px_0px_#2b2b2b] active:translate-y-0.5 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>Paper</span>
            <span className="font-black text-[#2b2b2b]">
              {paper?.paper?.paper_code || "12"}
            </span>
            <span className="text-xs uppercase bg-white border border-[#2b2b2b] rounded px-1 text-[#2b2b2b]">
              {paper?.paper?.series || "s"}
              {paper?.paper?.year ? String(paper.paper.year).slice(-2) : "24"}
            </span>
          </button>

          {/* Progress Counters */}
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span
                className="px-2.5 py-1 bg-[#d1fae5] border-2 border-[#065f46] text-[#065f46] rounded-full text-xs font-black shadow-[2px_2px_0px_#2b2b2b] flex items-center gap-1"
                title={`${validCount} questions fully valid`}
              >
                <CheckCircle2 className="w-3 h-3 text-[#059669]" />
                <span>
                  {validCount}/{totalCount} Valid
                </span>
              </span>

              {reviewCount > 0 && (
                <span
                  className="px-2.5 py-1 bg-[#ffe4e6] border-2 border-[#9f1239] text-[#9f1239] rounded-full text-xs font-black shadow-[2px_2px_0px_#2b2b2b] flex items-center gap-1"
                  title={`${reviewCount} questions require curator review`}
                >
                  <AlertTriangle className="w-3 h-3 text-[#e11d48]" />
                  <span>{reviewCount} Review</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Section: Tool Controls, Split Screen Toggle & Action CTAs */}
      <div className="flex items-center gap-2 sm:gap-2.5 self-end xl:self-auto flex-wrap">
        {/* Undo / Redo Quick Controls */}
        {onUndo && onRedo && (
          <div className="flex items-center border-2 border-[#2b2b2b] rounded-xl bg-white shadow-[2px_2px_0px_#2b2b2b] overflow-hidden">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo question edit"
              title="Undo question edit (Ctrl+Z)"
              className="p-1.5 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed border-r border-[#2b2b2b] text-[#2b2b2b] transition-colors cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo question edit"
              title="Redo question edit (Ctrl+Y)"
              className="p-1.5 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-[#2b2b2b] transition-colors cursor-pointer"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Dual-Pane Split Screen Toggle */}
        {onTogglePdfViewer && (
          <button
            type="button"
            onClick={onTogglePdfViewer}
            className={`px-3 py-1.5 border-2 border-b-4 border-[#2b2b2b] rounded-xl shadow-[2px_2px_0px_#2b2b2b] active:translate-y-0.5 active:border-b-2 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              showPdfViewer
                ? "bg-[#ffd166] text-[#2b2b2b]"
                : "bg-white text-[#2b2b2b] hover:bg-slate-50"
            }`}
            title={showPdfViewer ? "Hide PDF Source Pane" : "Show Dual-Pane PDF Source"}
          >
            <BookOpen className="w-4 h-4 text-[#2b2b2b]" />
            <span className="hidden sm:inline">
              {showPdfViewer ? "Hide PDF" : "Split View (PDF)"}
            </span>
            <span className="sm:hidden">PDF</span>
          </button>
        )}

        {/* Audit Drawer Trigger Button */}
        <button
          type="button"
          onClick={onOpenAudit}
          className="px-3 py-1.5 bg-white hover:bg-slate-50 border-2 border-b-4 border-[#2b2b2b] rounded-xl shadow-[2px_2px_0px_#2b2b2b] active:translate-y-0.5 active:border-b-2 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer text-[#2b2b2b]"
          title="Open Paper Batch Audit Drawer"
        >
          <ClipboardCheck className="w-4 h-4 text-[#4f46e5]" />
          <span>Audit</span>
          {totalIssues > 0 && (
            <span className="px-1.5 py-0.2 bg-[#ff6b6b] text-white text-[10px] font-black rounded-full border border-[#2b2b2b]">
              {totalIssues}
            </span>
          )}
        </button>

        {/* Live Simulator Preview Toggle */}
        <button
          type="button"
          onClick={onTogglePreview}
          className={`px-3.5 py-1.5 border-2 border-b-4 border-[#2b2b2b] rounded-xl shadow-[2px_2px_0px_#2b2b2b] active:translate-y-0.5 active:border-b-2 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
            showLivePreview
              ? "bg-[#06d6a0] text-[#2b2b2b]"
              : "bg-white text-[#2b2b2b] hover:bg-slate-50"
          }`}
          title={showLivePreview ? "Close Live Simulator Preview" : "Open Student Simulator"}
        >
          <Eye className="w-4 h-4 text-[#2b2b2b]" />
          <span>Preview</span>
        </button>

        {/* Tactile 1-Click Publish to Supabase */}
        <button
          type="button"
          onClick={onPublish}
          disabled={isPublishing || !paper}
          className="px-4 py-1.5 bg-[#06d6a0] hover:bg-[#05b385] text-[#2b2b2b] border-2 border-b-4 border-[#2b2b2b] rounded-xl shadow-[3px_3px_0px_#2b2b2b] active:translate-y-0.5 active:border-b-2 font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
        >
          {isPublishing ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#2b2b2b]" />
          ) : (
            <UploadCloud className="w-4 h-4 text-[#2b2b2b]" />
          )}
          <span>
            {publishStatus === "publishing"
              ? "Publishing..."
              : publishStatus === "validating"
              ? "Validating..."
              : publishStatus === "success"
              ? "Published! ✓"
              : "Publish to Supabase"}
          </span>
        </button>

        {/* Overflow Menu Button [···] */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="More options"
            aria-expanded={isMenuOpen}
            className={`p-1.5 sm:p-2 border-2 border-b-4 border-[#2b2b2b] rounded-xl shadow-[2px_2px_0px_#2b2b2b] active:translate-y-0.5 active:border-b-2 font-bold text-[#2b2b2b] transition-all flex items-center justify-center cursor-pointer ${
              isMenuOpen ? "bg-[#ffd166]" : "bg-white hover:bg-slate-50"
            }`}
          >
            <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-[#2b2b2b]" />
          </button>

          {/* Clean Neobrutalist Overflow Dropdown */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[#FFFDF7] border-2 border-b-4 border-[#2b2b2b] rounded-2xl shadow-[4px_4px_0px_#2b2b2b] p-1.5 z-50 flex flex-col font-body">
              {/* Preset Selector */}
              <div className="flex items-center justify-between px-3 py-2 hover:bg-[#ffe5d9] rounded-xl transition-colors">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (typeof onLoadPreset === "function") {
                      (onLoadPreset as (preset?: string) => void)(selectedPreset);
                    }
                  }}
                  className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#2b2b2b] flex-1 text-left cursor-pointer"
                  title="Load selected preset"
                >
                  <FolderDown className="w-4 h-4 text-[#2b2b2b]" />
                  <span>Preset: {selectedPreset.replace(/_/g, " ")}</span>
                </button>
                {availablePresets.length > 1 && (
                  <select
                    value={selectedPreset}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedPreset(val);
                      if (typeof onLoadPreset === "function") {
                        (onLoadPreset as (preset?: string) => void)(val);
                      }
                      setIsMenuOpen(false);
                    }}
                    aria-label="Select paper preset"
                    className="text-xs font-bold bg-white border border-[#2b2b2b] rounded px-1.5 py-0.5 text-[#2b2b2b] ml-1.5 cursor-pointer focus:outline-none"
                  >
                    {availablePresets.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Upload JSON File */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  fileInputRef.current?.click();
                }}
                className="w-full px-3 py-2 hover:bg-[#ffe5d9] rounded-xl text-left text-xs sm:text-sm font-bold text-[#2b2b2b] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#2b2b2b]" />
                <span>Upload JSON Staged File</span>
              </button>

              {/* Raw JSON & SQL Payloads */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenPayloads();
                }}
                className="w-full px-3 py-2 hover:bg-[#ffe5d9] rounded-xl text-left text-xs sm:text-sm font-bold text-[#2b2b2b] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-[#f59e0b]" />
                <span>Raw JSON & SQL Export</span>
              </button>

              {/* Paper Settings */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full px-3 py-2 hover:bg-[#ffe5d9] rounded-xl text-left text-xs sm:text-sm font-bold text-[#2b2b2b] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4 text-[#2b2b2b]" />
                <span>Paper Metadata Settings</span>
              </button>

              <div className="my-1 border-t-2 border-[#2b2b2b]/10" />

              {/* Test in Live Game */}
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="w-full px-3 py-2 hover:bg-[#ffd166] rounded-xl text-left text-xs sm:text-sm font-bold text-[#2b2b2b] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-[#2b2b2b]" />
                  <span>Test in Live Game</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-60 ml-0.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

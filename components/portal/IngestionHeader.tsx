"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { StagingPaper, PaperLifecycleState } from "@/types/ingestion";
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
  ChevronDown,
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
  showLivePreview: _showLivePreview,
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

  // Clean Lifecycle Badge Configuration matching Question Bank palette
  const effectiveLifecycle = paper?.lifecycle_state || paper?.state || lifecycleState;
  const lifecycleBadge = useMemo(() => {
    switch (effectiveLifecycle) {
      case "extracting":
        return {
          label: "Extracting...",
          className: "bg-[#e0e7ff] text-[#312e81]",
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
        };
      case "review":
        return {
          label: "Review",
          className: "bg-[#ffe1d0] text-[#c67139]",
          icon: <CheckCircle2 className="w-3 h-3 text-[#c67139]" />,
        };
      case "published":
        return {
          label: "Published",
          className: "bg-[#f0fae1] text-[#3d472b]",
          icon: <Sparkles className="w-3 h-3 text-[#728157]" />,
        };
      case "draft":
      default:
        return {
          label: "Draft",
          className: "bg-[#eee7db] text-[#474238]",
          icon: null,
        };
    }
  }, [effectiveLifecycle]);

  return (
    <header className="w-full bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] rounded-2xl p-4 shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4 font-body">
      {/* Hidden File Input for JSON Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left Section: Brand, Lifecycle, and Metadata Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
        <div>
          <span className="text-xs font-bold text-[#645c50]">Ingestion studio</span>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <h2 className="font-heading text-xl sm:text-2xl font-black text-[#201e1d]">
              {paper?.paper?.paper_code
                ? `${paper?.subject?.code || "0455"}/${paper.paper.paper_code}`
                : "Cambridge Ingestion"}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#eee7db] text-[#474238] text-xs font-bold">
              {totalCount} questions
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${lifecycleBadge.className}`}
            >
              {lifecycleBadge.icon}
              <span>{lifecycleBadge.label}</span>
            </span>
          </div>
        </div>

        {/* Paper Info Pills matching Question Bank dropdowns */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Subject Pill */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Edit subject settings"
            className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>{paper?.subject?.icon || "📈"}</span>
            <span>{paper?.subject?.code || "0455"}</span>
            <span className="text-[#645c50] hidden md:inline">
              {paper?.subject?.name || "Economics"}
            </span>
          </button>

          {/* Paper Series & Code Pill */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Edit paper code & series"
            className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>Paper {paper?.paper?.paper_code || "12"}</span>
            <span className="text-[#645c50]">
              ({paper?.paper?.series || "s"}
              {paper?.paper?.year ? String(paper.paper.year).slice(-2) : "24"})
            </span>
          </button>

          {/* Progress Validation Badges */}
          {totalCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span
                className="px-2.5 py-1 rounded-full bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-[#3d472b] text-xs font-bold flex items-center gap-1"
                title={`${validCount} questions fully valid`}
              >
                <CheckCircle2 className="w-3 h-3 text-[#56633f]" />
                <span>
                  {validCount}/{totalCount} Valid
                </span>
              </span>

              {reviewCount > 0 && (
                <span
                  className="px-2.5 py-1 rounded-full bg-[#ffe1d0] border-[1.5px] border-[#c67139] text-[#c67139] text-xs font-bold flex items-center gap-1"
                  title={`${reviewCount} questions require curator review`}
                >
                  <AlertTriangle className="w-3 h-3 text-[#c67139]" />
                  <span>{reviewCount} Review</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Section: Action Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 self-end xl:self-auto flex-wrap">
        {/* Undo / Redo Controls */}
        {onUndo && onRedo && (
          <div className="flex items-center border-[1.5px] border-[#dcd3c4] rounded-full bg-[#f9f4ed] overflow-hidden">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label="Undo question edit"
              title="Undo question edit (Ctrl+Z)"
              className="px-2.5 py-1.5 hover:bg-[#eee7db] disabled:opacity-30 disabled:cursor-not-allowed border-r border-[#dcd3c4] text-[#201e1d] transition-colors cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label="Redo question edit"
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
            className={`px-3.5 py-1.5 rounded-full border-[1.5px] text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5 ${
              showPdfViewer
                ? "bg-[#ffe1d0] border-[#c67139] text-[#c67139] font-bold"
                : "bg-[#f9f4ed] border-[#dcd3c4] text-[#474238] hover:bg-[#eee7db]"
            }`}
            title={showPdfViewer ? "Hide PDF Source Pane" : "Show Dual-Pane PDF Source"}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {showPdfViewer ? "Hide PDF" : "Split View (PDF)"}
            </span>
            <span className="sm:hidden">PDF</span>
          </button>
        )}

        {/* Audit Drawer Button */}
        <button
          type="button"
          onClick={onOpenAudit}
          className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] text-xs font-semibold text-[#201e1d] hover:bg-[#eee7db] active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer transition-colors"
          title="Open Paper Batch Audit Drawer"
        >
          <ClipboardCheck className="w-3.5 h-3.5 text-[#645c50]" />
          <span>Audit</span>
          {totalIssues > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#728157] text-[#f9f4ed] text-[10px] font-bold">
              {totalIssues}
            </span>
          )}
        </button>

        {/* Preview Questions Button (Opens Modal) */}
        <button
          type="button"
          onClick={onTogglePreview}
          className="px-4 py-2 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#201e1d] text-[#201e1d] font-bold text-xs hover:bg-[#eee7db] shadow-offset-2 active:translate-y-0.5 flex items-center gap-1.5 cursor-pointer transition-all"
          title="Preview questions modal"
        >
          <Eye className="w-3.5 h-3.5 text-[#201e1d]" />
          <span>Preview questions</span>
        </button>

        {/* Primary CTA: Publish to Supabase */}
        <button
          type="button"
          onClick={onPublish}
          disabled={isPublishing || !paper}
          className="px-4 py-2 rounded-full bg-[#c67139] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-heading font-black text-xs hover:bg-[#b2622d] active:translate-y-0.5 flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isPublishing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f9f4ed]" />
          ) : (
            <UploadCloud className="w-3.5 h-3.5 text-[#f9f4ed]" />
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
            className={`p-2 rounded-full border-[1.5px] text-xs font-semibold cursor-pointer transition-colors flex items-center justify-center ${
              isMenuOpen
                ? "bg-[#ffe1d0] border-[#c67139] text-[#c67139]"
                : "bg-[#f9f4ed] border-[#dcd3c4] text-[#201e1d] hover:bg-[#eee7db]"
            }`}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Clean Question Bank Style Overflow Dropdown */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[4px_4px_0_#201e1d] rounded-2xl p-1.5 z-50 flex flex-col font-body">
              {/* Preset Selector */}
              <div className="flex items-center justify-between px-3 py-2 hover:bg-[#ffe1d0] rounded-xl transition-colors">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (typeof onLoadPreset === "function") {
                      (onLoadPreset as (preset?: string) => void)(selectedPreset);
                    }
                  }}
                  className="flex items-center gap-2 text-xs font-bold text-[#201e1d] flex-1 text-left cursor-pointer"
                  title="Load selected preset"
                >
                  <FolderDown className="w-3.5 h-3.5 text-[#201e1d]" />
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
                    className="text-xs font-bold bg-[#f9f4ed] border border-[#dcd3c4] rounded-lg px-2 py-0.5 text-[#201e1d] ml-1.5 cursor-pointer focus:outline-none"
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
                className="w-full px-3 py-2 hover:bg-[#ffe1d0] rounded-xl text-left text-xs font-bold text-[#201e1d] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#201e1d]" />
                <span>Upload JSON Staged File</span>
              </button>

              {/* Raw JSON & SQL Payloads */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenPayloads();
                }}
                className="w-full px-3 py-2 hover:bg-[#ffe1d0] rounded-xl text-left text-xs font-bold text-[#201e1d] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FileCode className="w-3.5 h-3.5 text-[#c67139]" />
                <span>Raw JSON & SQL Export</span>
              </button>

              {/* Paper Settings */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full px-3 py-2 hover:bg-[#ffe1d0] rounded-xl text-left text-xs font-bold text-[#201e1d] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-[#201e1d]" />
                <span>Paper Metadata Settings</span>
              </button>

              <div className="my-1 border-t border-[#dcd3c4]" />

              {/* Test in Live Game */}
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="w-full px-3 py-2 hover:bg-[#ffe1d0] rounded-xl text-left text-xs font-bold text-[#201e1d] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-3.5 h-3.5 text-[#201e1d]" />
                  <span>Test in Live Game</span>
                </div>
                <ExternalLink className="w-3 h-3 text-[#645c50] ml-0.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

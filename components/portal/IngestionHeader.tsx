"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { StagingPaper, StagingQuestion } from "@/types/ingestion";
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
        // Fallback silently to presets
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

  // Calculate health score of paper
  const { percentage } = useMemo(() => {
    if (!paper || !paper.questions || paper.questions.length === 0) {
      return { percentage: 0 };
    }

    const total = paper.questions.length;
    const validated = paper.questions.filter((q: StagingQuestion) => {
      if (q.status === "withdrawn") return false;
      if (!q.stem_markdown || q.stem_markdown.trim().length === 0) return false;
      if (!Array.isArray(q.options) || q.options.length !== 4) return false;
      const correctCount = q.options.filter((opt) => opt.is_correct).length;
      return correctCount === 1;
    }).length;

    const pct = total > 0 ? Math.round((validated / total) * 100) : 0;
    return { percentage: pct };
  }, [paper]);

  // Calm Health Score dot color tokens:
  // Green (>=90%), Yellow (50-89%), Coral (<50%)
  const healthDotColor = useMemo(() => {
    if (percentage >= 90) return "#22C55E";
    if (percentage >= 50) return "#FACC15";
    return "#FB7185";
  }, [percentage]);

  const paperBadgeLabel = useMemo(() => {
    const series = paper?.paper?.series || "s";
    const yearShort = paper?.paper?.year ? String(paper.paper.year).slice(-2) : "24";
    const paperCode = paper?.paper?.paper_code || "12";
    return `${series}${yearShort} · ${paperCode}`;
  }, [paper]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadJson(file);
    }
    e.target.value = "";
  };

  const isPublishing = publishStatus === "publishing" || publishStatus === "validating";

  return (
    <header className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl shadow-offset-2 px-4 py-3 sm:px-6 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 font-body">
      {/* Hidden File Input for JSON Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left: Title & Key Badges */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5">
        <h1 className="font-heading text-xl sm:text-2xl text-[#201e1d] tracking-tight flex items-center gap-1.5 select-none">
          <span>Revizz Studio</span>
          <span className="text-amber-500">⚡</span>
        </h1>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Subject Badge */}
          <span className="px-2.5 py-1 bg-[#ffe1d0] border-2 border-[#201e1d] rounded-full text-xs font-black text-[#201e1d] shadow-offset-2 flex items-center gap-1.5 whitespace-nowrap">
            <span>{paper?.subject?.icon || "📈"}</span>
            <span>
              {paper?.subject
                ? `${paper.subject.code} ${paper.subject.name}`
                : "0455 Economics"}
            </span>
          </span>

          {/* Paper Badge */}
          <span className="px-2.5 py-1 bg-[#f0fae1] border-2 border-[#201e1d] rounded-full text-xs font-black text-[#201e1d] shadow-offset-2 whitespace-nowrap">
            {paperBadgeLabel}
          </span>

          {/* Calm Health Score Badge */}
          <span className="px-2.5 py-1 bg-white border-2 border-[#201e1d] rounded-full text-xs font-black text-[#201e1d] shadow-offset-2 flex items-center gap-1.5 whitespace-nowrap">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: healthDotColor }}
            />
            <span>Health: {percentage}%</span>
          </span>
        </div>
      </div>

      {/* Right: Only TWO Primary Actions + Clean Overflow Menu */}
      <div className="flex items-center gap-2 sm:gap-2.5 self-end md:self-auto flex-wrap">
        {/* Primary Action 1: [👁 Preview] */}
        <button
          type="button"
          onClick={onTogglePreview}
          className={`px-3.5 py-1.5 border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-xs sm:text-sm flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
            showLivePreview
              ? "bg-[#14B8A6] text-white"
              : "bg-white text-[#201e1d] hover:bg-slate-50"
          }`}
          title={showLivePreview ? "Close Live Preview" : "Open Live Preview"}
        >
          <Eye className={`w-4 h-4 ${showLivePreview ? "text-white" : "text-[#201e1d]"}`} />
          <span>Preview</span>
        </button>

        {/* Primary Action 2: [Push Live] */}
        <button
          type="button"
          onClick={onPublish}
          disabled={isPublishing || !paper}
          className="px-4 py-1.5 bg-[#22C55E] hover:bg-[#16a34a] text-[#201e1d] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-black text-xs sm:text-sm flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
        >
          {isPublishing ? (
            <Loader2 className="w-4 h-4 animate-spin text-[#201e1d]" />
          ) : (
            <UploadCloud className="w-4 h-4 text-[#201e1d]" />
          )}
          <span>
            {publishStatus === "publishing"
              ? "Publishing..."
              : publishStatus === "validating"
              ? "Validating..."
              : "Push Live"}
          </span>
        </button>

        {/* Overflow Menu Button [···] */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="More options"
            aria-expanded={isMenuOpen}
            className={`p-1.5 sm:p-2 border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-[#201e1d] transition-all flex items-center justify-center cursor-pointer ${
              isMenuOpen ? "bg-[#ffe1d0]" : "bg-white hover:bg-slate-50"
            }`}
          >
            <MoreHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-[#201e1d]" />
          </button>

          {/* Clean Overflow Dropdown */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl shadow-offset-4 p-1.5 z-50 flex flex-col font-body">
              {/* Preset Item */}
              <div className="flex items-center justify-between px-3 py-2 hover:bg-[#ffe1d0]/70 rounded-xl transition-colors">
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (typeof onLoadPreset === "function") {
                      (onLoadPreset as (preset?: string) => void)(selectedPreset);
                    }
                  }}
                  className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#201e1d] flex-1 text-left cursor-pointer"
                  title="Load preset"
                >
                  <FolderDown className="w-4 h-4 text-[#201e1d]" />
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
                    aria-label="Change preset"
                    className="text-xs font-bold bg-white border border-[#201e1d] rounded px-1.5 py-0.5 text-[#201e1d] ml-1.5 cursor-pointer focus:outline-none"
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
                className="w-full px-3 py-2 hover:bg-[#ffe1d0]/70 rounded-xl text-left text-xs sm:text-sm font-bold text-[#201e1d] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#201e1d]" />
                <span>Upload JSON File</span>
              </button>

              {/* Paper Settings */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenSettings();
                }}
                className="w-full px-3 py-2 hover:bg-[#ffe1d0]/70 rounded-xl text-left text-xs sm:text-sm font-bold text-[#201e1d] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Settings className="w-4 h-4 text-[#201e1d]" />
                <span>Paper Settings</span>
              </button>

              {/* View SQL & JSON */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenPayloads();
                }}
                className="w-full px-3 py-2 hover:bg-[#ffe1d0]/70 rounded-xl text-left text-xs sm:text-sm font-bold text-[#201e1d] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FileCode className="w-4 h-4 text-[#F59E0B]" />
                <span>View SQL & JSON</span>
              </button>

              {/* Full Audit Report */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenAudit();
                }}
                className="w-full px-3 py-2 hover:bg-[#ffe1d0]/70 rounded-xl text-left text-xs sm:text-sm font-bold text-[#201e1d] flex items-center gap-2 transition-colors cursor-pointer"
              >
                <ClipboardCheck className="w-4 h-4 text-[#6366F1]" />
                <span>Full Audit Report</span>
              </button>

              <div className="my-1 border-t-2 border-[#201e1d]/10" />

              {/* Test in Game */}
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsMenuOpen(false)}
                className="w-full px-3 py-2 hover:bg-[#ffc6a5] rounded-xl text-left text-xs sm:text-sm font-bold text-[#201e1d] flex items-center justify-between transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Gamepad2 className="w-4 h-4 text-[#201e1d]" />
                  <span>Test in Game</span>
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

"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { StagingPaper, StagingQuestion } from "@/types/ingestion";
import {
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ClipboardCheck,
  FileCode,
  Settings,
  Upload,
  Gamepad2,
  ExternalLink,
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
  publishMessage: string;
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
  publishMessage,
  showLivePreview,
  onTogglePreview,
}: IngestionHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Calculate health of paper
  const { totalCount, validatedCount, percentage } = useMemo(() => {
    if (!paper || !paper.questions || paper.questions.length === 0) {
      return { totalCount: 0, validatedCount: 0, percentage: 0 };
    }

    const total = paper.questions.length;
    const validated = paper.questions.filter((q: StagingQuestion) => {
      // Must not be withdrawn
      if (q.status === "withdrawn") return false;
      // Must have non-empty stem
      if (!q.stem_markdown || q.stem_markdown.trim().length === 0) return false;
      // Must have exactly 4 options
      if (!Array.isArray(q.options) || q.options.length !== 4) return false;
      // Must have exactly 1 correct option
      const correctCount = q.options.filter((opt) => opt.is_correct).length;
      return correctCount === 1;
    }).length;

    const pct = total > 0 ? Math.round((validated / total) * 100) : 0;
    return { totalCount: total, validatedCount: validated, percentage: pct };
  }, [paper]);

  // Color tokens according to specifications:
  // >90% brand.teal (#14B8A6), 50-90% brand.yellow (#FACC15), <50% brand.coral (#FB7185)
  const healthColorHex = useMemo(() => {
    if (percentage > 90) return "#14B8A6";
    if (percentage >= 50) return "#FACC15";
    return "#FB7185";
  }, [percentage]);

  const seriesBadgeLabel = useMemo(() => {
    if (!paper?.paper) return "s24";
    const series = paper.paper.series || "s";
    const yearShort = paper.paper.year ? String(paper.paper.year).slice(-2) : "24";
    return `${series}${yearShort}`;
  }, [paper]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadJson(file);
    }
    e.target.value = "";
  };

  const handleLoadClick = () => {
    if (typeof onLoadPreset === "function") {
      (onLoadPreset as (preset?: string) => void)(selectedPreset);
    }
  };

  const isPublishing = publishStatus === "publishing" || publishStatus === "validating";

  return (
    <header className="w-full bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[24px] shadow-offset-4 p-4 sm:p-6 flex flex-col gap-4 font-body">
      {/* Top Row: Title, Badges, and Health Ring/Chunky Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Branding & Subject Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
          <h1 className="font-heading text-2xl sm:text-3xl text-[#201e1d] tracking-tight flex items-center gap-2">
            <span>Revizz Ingestion Studio</span>
            <span className="text-amber-500 select-none">⚡</span>
          </h1>

          {/* Badges Container */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Subject Badge */}
            <span className="px-3 py-1 bg-[#ffe1d0] border-2 border-[#201e1d] rounded-full text-xs font-black text-[#201e1d] shadow-offset-2 flex items-center gap-1.5 whitespace-nowrap">
              <span>{paper?.subject?.icon || "📈"}</span>
              <span>
                {paper?.subject
                  ? `${paper.subject.code} ${paper.subject.name}`
                  : "0455 Economics"}
              </span>
            </span>

            {/* Series Badge */}
            <span className="px-3 py-1 bg-[#f0fae1] border-2 border-[#201e1d] rounded-full text-xs font-black text-[#201e1d] shadow-offset-2 whitespace-nowrap">
              {seriesBadgeLabel}
            </span>

            {/* Paper Code Badge */}
            <span className="px-3 py-1 bg-[#ffc6a5] border-2 border-[#201e1d] rounded-full text-xs font-black text-[#201e1d] shadow-offset-2 whitespace-nowrap">
              Paper {paper?.paper?.paper_code || "12"}
            </span>

            {/* Question Count Badge */}
            <span className="px-3 py-1 bg-white border-2 border-[#201e1d] rounded-full text-xs font-black text-[#201e1d] shadow-offset-2 whitespace-nowrap">
              {paper?.questions?.length ?? 0} Questions
            </span>
          </div>
        </div>

        {/* Right: Health Progress Ring & Chunky Bar */}
        <div className="flex items-center gap-3 bg-white border-2 border-[#201e1d] rounded-2xl px-3.5 py-2 shadow-offset-2 self-start lg:self-auto">
          {/* Circular Progress Ring */}
          <div className="relative flex items-center justify-center w-10 h-10 flex-shrink-0">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="14"
                className="text-slate-100"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
              />
              <circle
                cx="18"
                cy="18"
                r="14"
                stroke={healthColorHex}
                strokeWidth="3.5"
                strokeDasharray={2 * Math.PI * 14}
                strokeDashoffset={2 * Math.PI * 14 * (1 - percentage / 100)}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-500 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-black text-slate-800 tabular-nums">
                {percentage}%
              </span>
            </div>
          </div>

          {/* Chunky Bar & Label */}
          <div className="flex flex-col gap-1 min-w-[110px] sm:min-w-[130px]">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="uppercase tracking-wider text-[10px] text-slate-500 font-black">
                Health
              </span>
              <span className="tabular-nums font-black text-slate-800 text-[11px]">
                {validatedCount} / {totalCount} Valid
              </span>
            </div>
            {/* Chunky Bar with inset shadow */}
            <div className="w-full h-3 bg-slate-100 border-2 border-[#201e1d] rounded-full overflow-hidden p-0.5">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${percentage}%`,
                  backgroundColor: healthColorHex,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Controls, Presets & Command Buttons */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-2 border-t-2 border-[#201e1d]/10">
        {/* Left Subsection: Preset Selector, Upload JSON, Settings */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Preset Selector Dropdown */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 bg-white border-2 border-[#201e1d] rounded-xl text-xs sm:text-sm font-bold text-[#201e1d] shadow-offset-2 focus:outline-none focus:ring-2 focus:ring-[#201e1d] cursor-pointer"
                title="Select preset paper"
              >
                {availablePresets.map((preset) => (
                  <option key={preset} value={preset}>
                    {preset}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#201e1d] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={handleLoadClick}
              className="px-3.5 py-2 bg-[#ffe1d0] hover:bg-[#fed7aa] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-xs sm:text-sm text-[#201e1d] transition-all whitespace-nowrap"
            >
              Load Preset
            </button>
          </div>

          {/* Hidden File Input & Upload JSON Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3.5 py-2 bg-[#ccdbb2] hover:bg-[#b8cb99] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-xs sm:text-sm text-[#201e1d] flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <Upload className="w-4 h-4 text-[#201e1d]" />
            <span>Upload JSON</span>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            title="Settings"
            className="p-2 bg-white hover:bg-slate-100 border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-[#201e1d] transition-all flex items-center justify-center"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 text-[#201e1d]" />
          </button>
        </div>

        {/* Right Subsection: Command Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Audit Paper */}
          <button
            type="button"
            onClick={onOpenAudit}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-xs sm:text-sm text-[#201e1d] flex items-center gap-2 transition-all whitespace-nowrap"
          >
            <ClipboardCheck className="w-4 h-4 text-[#6366F1]" />
            <span>Audit Paper</span>
          </button>

          {/* View SQL / JSON */}
          <button
            type="button"
            onClick={onOpenPayloads}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-xs sm:text-sm text-[#201e1d] flex items-center gap-2 transition-all whitespace-nowrap"
          >
            <FileCode className="w-4 h-4 text-[#F59E0B]" />
            <span>View SQL / JSON</span>
          </button>

          {/* Toggle Preview */}
          <button
            type="button"
            onClick={onTogglePreview}
            className={`px-3.5 py-2 border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
              showLivePreview
                ? "bg-[#14B8A6] text-white"
                : "bg-white text-[#201e1d] hover:bg-slate-50"
            }`}
          >
            {showLivePreview ? (
              <Eye className="w-4 h-4 text-white" />
            ) : (
              <EyeOff className="w-4 h-4 text-slate-500" />
            )}
            <span>{showLivePreview ? "Preview ON" : "Preview OFF"}</span>
          </button>

          {/* Push Live to Supabase */}
          <button
            type="button"
            onClick={onPublish}
            disabled={isPublishing || !paper}
            className="px-4 py-2 bg-[#22C55E] hover:bg-[#16A34A] text-[#201e1d] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-black text-xs sm:text-sm flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
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
                : "Push Live to Supabase"}
            </span>
          </button>

          {/* Test in Game */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-[#ffc6a5] hover:bg-[#f6a06b] border-2 border-[#201e1d] rounded-xl shadow-offset-2 active:translate-y-0.5 active:shadow-none font-bold text-xs sm:text-sm text-[#201e1d] flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <Gamepad2 className="w-4 h-4 text-[#201e1d]" />
            <span>Test in Game</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-60 ml-0.5" />
          </a>
        </div>
      </div>

      {/* Publish Status Feedback Banner */}
      {publishStatus !== "idle" && (
        <div
          className={`w-full mt-1 px-4 py-2.5 border-2 border-[#201e1d] rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-offset-2 transition-all ${
            publishStatus === "validating" || publishStatus === "publishing"
              ? "bg-[#ffe1d0] text-[#c67139]"
              : publishStatus === "success"
              ? "bg-[#f0fae1] text-[#15803D]"
              : "bg-[#ffc6a5] text-[#E11D48]"
          }`}
        >
          <div className="flex items-center gap-2">
            {publishStatus === "publishing" || publishStatus === "validating" ? (
              <Loader2 className="w-4 h-4 animate-spin text-[#c67139]" />
            ) : publishStatus === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
            ) : (
              <AlertCircle className="w-4 h-4 text-[#E11D48]" />
            )}
            <span>
              {publishMessage ||
                (publishStatus === "success"
                  ? "Successfully published to Supabase live!"
                  : `Status: ${publishStatus}`)}
            </span>
          </div>
        </div>
      )}
    </header>
  );
}

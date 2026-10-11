"use client";

import React, { useState, useRef, useMemo } from "react";
import type { StagingPaper } from "@/types/ingestion";
import {
  Sparkles,
  Clock,
  AlertCircle,
  FileText,
  Upload,
  Plus,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Trash2,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";

export interface SubjectPreset {
  code: string;
  name: string;
  icon: string;
}

export const CAMBRIDGE_SUBJECT_PRESETS: SubjectPreset[] = [
  { code: "0455", name: "Economics", icon: "📈" },
  { code: "0478", name: "Computer Science", icon: "💻" },
  { code: "0620", name: "Chemistry", icon: "🧪" },
  { code: "0625", name: "Physics", icon: "⚡" },
  { code: "0610", name: "Biology", icon: "🧬" },
  { code: "0580", name: "Mathematics", icon: "📐" },
  { code: "0452", name: "Accounting", icon: "📊" },
  { code: "0450", name: "Business Studies", icon: "💼" },
  { code: "0460", name: "Geography", icon: "🌍" },
];

export interface IngestionSetupWizardProps {
  onStartExtraction: (params: {
    qpFile: File;
    msFile: File | null;
    subjectCode: string;
    subjectName: string;
    subjectIcon: string;
    year: number;
    series: string;
    paperCode: string;
    apiKey?: string;
  }) => void;
  onUploadJson: (file: File) => void;
  onStartBlank: (meta: {
    subjectCode: string;
    subjectName: string;
    subjectIcon: string;
    year: number;
    series: string;
    paperCode: string;
  }) => void;
  onResumeDraft?: () => void;
  onDiscardDraft?: () => void;
  onResetAll?: () => void;
  hasSavedDraft?: boolean;
  isExtracting: boolean;
  extractionError?: string | null;
  activePaper?: StagingPaper | null;
  onReturnToWorkspace?: () => void;
  className?: string;
}

/**
 * IngestionSetupWizard:
 * Intuitive Cambridge Paper Setup & PDF Ingestion Wizard.
 * Docks flush inside IngestionStudioFrame without redundant outer wrapper borders or shadows.
 */
export default function IngestionSetupWizard({
  onStartExtraction,
  onUploadJson,
  onStartBlank,
  onResumeDraft,
  onDiscardDraft,
  onResetAll,
  hasSavedDraft = false,
  isExtracting,
  extractionError = null,
  activePaper = null,
  onReturnToWorkspace,
  className = "",
}: IngestionSetupWizardProps) {
  // Scanned Files
  const [qpFile, setQpFile] = useState<File | null>(null);
  const [msFile, setMsFile] = useState<File | null>(null);
  const [isDraggingQp, setIsDraggingQp] = useState(false);
  const [isDraggingMs, setIsDraggingMs] = useState(false);

  const qpInputRef = useRef<HTMLInputElement>(null);
  const msInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Metadata form state
  const [selectedSubjectCode, setSelectedSubjectCode] = useState("");
  const [customSubjectCode, setCustomSubjectCode] = useState("");
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [year, setYear] = useState<number>(2024);
  const [series, setSeries] = useState("s");
  const [paperCode, setPaperCode] = useState("12");

  // Gemini API Key state (optional client override)
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const currentSubject = useMemo(() => {
    if (selectedSubjectCode === "custom") {
      return {
        code: customSubjectCode.trim(),
        name: customSubjectName.trim() || "Custom Subject",
        icon: "📚",
      };
    }
    const found = CAMBRIDGE_SUBJECT_PRESETS.find((s) => s.code === selectedSubjectCode);
    if (found) return found;
    return {
      code: selectedSubjectCode || customSubjectCode.trim() || "",
      name: customSubjectName.trim() || "",
      icon: "📚",
    };
  }, [selectedSubjectCode, customSubjectCode, customSubjectName]);

  const canExtract = Boolean(qpFile && !isExtracting);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, target: "qp" | "ms") => {
    e.preventDefault();
    if (target === "qp") setIsDraggingQp(false);
    else setIsDraggingMs(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        if (target === "qp") setQpFile(file);
        else setMsFile(file);
      }
    }
  };

  return (
    <div
      className={`w-full flex flex-col gap-6 font-body ${className}`}
      data-testid="ingestion-setup-wizard"
    >
      {/* Hidden File Inputs */}
      <input
        ref={qpInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) setQpFile(e.target.files[0]);
        }}
      />
      <input
        ref={msInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) setMsFile(e.target.files[0]);
        }}
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) onUploadJson(e.target.files[0]);
        }}
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#dcd3c4] pb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#ffe1d0] border border-[#c67139] text-[#c67139] rounded-full text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cambridge Multimodal Ingestion Pipeline</span>
            </div>

            {/* Informative chip when active paper session exists */}
            {activePaper && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-[#3d472b] rounded-full text-xs font-bold shadow-xs"
                title={`Active paper in memory: ${activePaper.id}`}
              >
                <span className="w-2 h-2 rounded-full bg-[#56633f] animate-pulse" />
                <span>
                  Session in progress: {activePaper.subject?.code || activePaper.paper?.paper_code || "Paper"} ({activePaper.paper?.year || "Active"})
                </span>
              </div>
            )}
          </div>

          <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d]">
            Digitize & Upsert Past Exam Papers
          </h2>
          <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-1 max-w-2xl">
            Upload your Cambridge Question Paper (QP) PDF to automatically extract stems, 4-option MCQs, math formulas, and official answer keys with Gemini Vision.
          </p>
        </div>

        {/* Quick helpers: Return to Active or Reset / Clear All */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {activePaper && onReturnToWorkspace && (
            <button
              type="button"
              onClick={onReturnToWorkspace}
              className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-bold text-[#201e1d] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:translate-y-0.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Current Paper</span>
            </button>
          )}

          {(hasSavedDraft || activePaper) && (onResetAll || onDiscardDraft) && (
            <button
              type="button"
              onClick={() => {
                setQpFile(null);
                setMsFile(null);
                if (onResetAll) onResetAll();
                else if (onDiscardDraft) onDiscardDraft();
              }}
              className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#b91c1c]/40 bg-[#fee2e2]/60 hover:bg-[#fee2e2] text-xs font-bold text-[#b91c1c] flex items-center gap-1.5 transition-colors cursor-pointer active:translate-y-0.5 shadow-xs"
              title="Clear all leftover draft data and start fresh in 1 click"
            >
              <Trash2 className="w-3.5 h-3.5 text-[#b91c1c]" />
              <span>Reset / Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Saved Draft Alert Banner if local draft exists */}
      {hasSavedDraft && (
        <div className="p-4 bg-[#f0fae1] border-[1.5px] border-[#8fa073] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-body shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#728157] text-[#f9f4ed] flex items-center justify-center shrink-0 shadow-xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-black text-[#201e1d]">
                Saved Paper Draft Found in Browser
              </h4>
              <p className="text-xs text-[#56633f] font-medium">
                You have an uncompleted draft saved locally. Would you like to resume your session?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            {onResumeDraft && (
              <button
                type="button"
                onClick={onResumeDraft}
                className="px-3.5 py-1.5 rounded-full bg-[#728157] text-[#f9f4ed] text-xs font-bold hover:bg-[#56633f] active:translate-y-0.5 transition-all cursor-pointer shadow-xs"
              >
                Resume Draft
              </button>
            )}
            {(onResetAll || onDiscardDraft) && (
              <button
                type="button"
                onClick={() => {
                  setQpFile(null);
                  setMsFile(null);
                  if (onResetAll) onResetAll();
                  else if (onDiscardDraft) onDiscardDraft();
                }}
                className="px-3 py-1.5 rounded-full border border-[#b91c1c] text-xs font-bold text-[#b91c1c] bg-[#fee2e2]/40 hover:bg-[#fee2e2] active:translate-y-0.5 transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                title="Discard leftover browser draft in 1 click"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#b91c1c]" />
                <span>Reset / Clear All</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Extraction Error Alert */}
      {extractionError && (
        <div className="p-3.5 bg-[#fee2e2] border-[1.5px] border-[#b91c1c] rounded-2xl flex items-center gap-3 text-xs font-bold text-[#b91c1c] shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{extractionError}</span>
        </div>
      )}

      {/* Step 1: Cambridge Paper Metadata Selectors */}
      <div className="bg-white/80 border-[1.5px] border-[#dcd3c4] rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-black flex items-center justify-center shadow-xs">
            1
          </span>
          <h3 className="font-heading text-sm font-black text-[#201e1d]">
            Select Cambridge Paper Metadata
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Subject Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[#645c50]">Subject</label>
            <select
              value={selectedSubjectCode}
              onChange={(e) => setSelectedSubjectCode(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] focus:border-[#c67139] outline-none cursor-pointer transition-colors"
            >
              <option value="">Select subject (or auto-infer from PDF)...</option>
              {CAMBRIDGE_SUBJECT_PRESETS.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.icon} {s.code} - {s.name}
                </option>
              ))}
              <option value="custom">Other / Custom Subject</option>
            </select>
          </div>

          {/* Exam Year */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[#645c50]">Exam Year</label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] focus:border-[#c67139] outline-none cursor-pointer transition-colors"
            >
              {[2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Exam Series */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[#645c50]">Exam Series</label>
            <select
              value={series}
              onChange={(e) => setSeries(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] focus:border-[#c67139] outline-none cursor-pointer transition-colors"
            >
              <option value="s">May / June (Summer - &apos;s&apos;)</option>
              <option value="w">Oct / Nov (Winter - &apos;w&apos;)</option>
              <option value="m">Feb / March (Spring - &apos;m&apos;)</option>
            </select>
          </div>

          {/* Paper Code */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[#645c50]">Paper Code</label>
            <select
              value={paperCode}
              onChange={(e) => setPaperCode(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] focus:border-[#c67139] outline-none cursor-pointer transition-colors"
            >
              <option value="11">Paper 11</option>
              <option value="12">Paper 12 (Standard)</option>
              <option value="13">Paper 13</option>
              <option value="21">Paper 21</option>
              <option value="22">Paper 22</option>
              <option value="23">Paper 23</option>
            </select>
          </div>
        </div>

        {/* Custom Subject Inputs if selected */}
        {selectedSubjectCode === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#dcd3c4]">
            <input
              type="text"
              placeholder="Subject Code (e.g. 0654)"
              value={customSubjectCode}
              onChange={(e) => setCustomSubjectCode(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus:border-[#c67139]"
            />
            <input
              type="text"
              placeholder="Subject Name (e.g. Co-ordinated Sciences)"
              value={customSubjectName}
              onChange={(e) => setCustomSubjectName(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] text-xs font-bold text-[#201e1d] outline-none focus:border-[#c67139]"
            />
          </div>
        )}
      </div>

      {/* Step 2: Dual PDF Dropzones (QP & MS) */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-black flex items-center justify-center shadow-xs">
            2
          </span>
          <h3 className="font-heading text-sm font-black text-[#201e1d]">
            Upload Scanned Exam Paper PDFs
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dropzone 1: Question Paper */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingQp(true);
            }}
            onDragLeave={() => setIsDraggingQp(false)}
            onDrop={(e) => handleDrop(e, "qp")}
            onClick={() => qpInputRef.current?.click()}
            className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all ${
              qpFile
                ? "bg-[#f0fae1] border-[#728157] shadow-xs"
                : isDraggingQp
                ? "bg-[#ffe1d0]/50 border-[#c67139] shadow-sm"
                : "bg-white/80 border-[#c0b6a5] hover:bg-white hover:border-[#82796a]"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-2xl border-[1.5px] flex items-center justify-center text-xl transition-colors ${
                qpFile
                  ? "bg-[#728157] text-[#f9f4ed] border-[#728157] shadow-xs"
                  : "bg-[#eee7db] text-[#201e1d] border-[#dcd3c4]"
              }`}
            >
              {qpFile ? <FileText className="w-5 h-5" /> : "📄"}
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5">
                <h4 className="font-heading text-sm font-black text-[#201e1d]">
                  Question Paper (QP) PDF
                </h4>
                <span className="px-2 py-0.5 bg-[#ffe1d0] text-[#c67139] border border-[#c67139]/40 text-[10px] font-black rounded-md">
                  Required
                </span>
              </div>
              <p className="text-xs font-medium text-[#645c50] mt-1">
                {qpFile ? (
                  <span className="text-[#3d472b] font-bold">
                    {qpFile.name} ({(qpFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                ) : (
                  "Drag & drop or browse Question Paper PDF (.pdf)"
                )}
              </p>
            </div>
            {qpFile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setQpFile(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#b91c1c] hover:opacity-80 transition-opacity mt-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove file</span>
              </button>
            )}
          </div>

          {/* Dropzone 2: Mark Scheme */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDraggingMs(true);
            }}
            onDragLeave={() => setIsDraggingMs(false)}
            onDrop={(e) => handleDrop(e, "ms")}
            onClick={() => msInputRef.current?.click()}
            className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all ${
              msFile
                ? "bg-[#f0fae1] border-[#728157] shadow-xs"
                : isDraggingMs
                ? "bg-[#ffe1d0]/50 border-[#c67139] shadow-sm"
                : "bg-white/80 border-[#c0b6a5] hover:bg-white hover:border-[#82796a]"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-2xl border-[1.5px] flex items-center justify-center text-xl transition-colors ${
                msFile
                  ? "bg-[#728157] text-[#f9f4ed] border-[#728157] shadow-xs"
                  : "bg-[#eee7db] text-[#201e1d] border-[#dcd3c4]"
              }`}
            >
              {msFile ? <FileText className="w-5 h-5" /> : "🎯"}
            </div>
            <div>
              <div className="flex items-center justify-center gap-1.5">
                <h4 className="font-heading text-sm font-black text-[#201e1d]">
                  Mark Scheme (MS) PDF
                </h4>
                <span className="px-2 py-0.5 bg-[#eee7db] text-[#645c50] border border-[#dcd3c4] text-[10px] font-black rounded-md">
                  Recommended
                </span>
              </div>
              <p className="text-xs font-medium text-[#645c50] mt-1">
                {msFile ? (
                  <span className="text-[#3d472b] font-bold">
                    {msFile.name} ({(msFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                ) : (
                  "Drag & drop or browse Mark Scheme PDF (.pdf)"
                )}
              </p>
            </div>
            {msFile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMsFile(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#b91c1c] hover:opacity-80 transition-opacity mt-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove file</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Step 3: Gemini Vision API Configuration (Optional) */}
      <div className="bg-white/80 border-[1.5px] border-[#dcd3c4] rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-black flex items-center justify-center shadow-xs">
              3
            </span>
            <h3 className="font-heading text-sm font-black text-[#201e1d]">
              Gemini API Key Configuration
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-[#82796a]">
            Optional client override
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="gemini-api-key-input"
            className="text-xs font-bold text-[#645c50] flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#c67139]" />
            <span>Gemini API Key (Optional if set in .env.local)</span>
          </label>
          <div className="relative flex items-center">
            <input
              id="gemini-api-key-input"
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste AIzaSy... key (optional - leave blank to use server .env.local)"
              className="w-full pl-3.5 pr-11 py-2.5 text-xs sm:text-sm font-mono rounded-xl border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] text-[#201e1d] placeholder:text-[#82796a] outline-none focus:border-[#c67139] transition-all"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => setShowApiKey((prev) => !prev)}
              className="absolute right-2.5 p-1 rounded-lg text-[#645c50] hover:text-[#201e1d] hover:bg-[#eee7db] transition-colors cursor-pointer"
              title={showApiKey ? "Mask API key" : "Show API key"}
              aria-label={showApiKey ? "Mask API key" : "Show API key"}
            >
              {showApiKey ? (
                <EyeOff className="w-4 h-4 text-[#201e1d]" />
              ) : (
                <Eye className="w-4 h-4 text-[#645c50]" />
              )}
            </button>
          </div>
          <p className="text-[11px] text-[#82796a]">
            If <code className="font-mono bg-[#eee7db] px-1 py-0.5 rounded text-[#201e1d]">GEMINI_API_KEY</code> is configured in <code className="font-mono bg-[#eee7db] px-1 py-0.5 rounded text-[#201e1d]">.env.local</code> on the server, this field can be left blank.
          </p>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#dcd3c4] pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="px-4 py-2 rounded-full border-[1.5px] border-[#dcd3c4] bg-white hover:bg-[#eee7db] text-xs font-bold text-[#201e1d] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:translate-y-0.5"
          >
            <Upload className="w-3.5 h-3.5 text-[#201e1d]" />
            <span>Upload Pre-staged JSON</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onStartBlank({
                subjectCode: currentSubject.code,
                subjectName: currentSubject.name,
                subjectIcon: currentSubject.icon,
                year,
                series,
                paperCode,
              })
            }
            className="px-4 py-2 rounded-full border-[1.5px] border-[#dcd3c4] bg-white hover:bg-[#eee7db] text-xs font-bold text-[#645c50] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs active:translate-y-0.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Start Blank Paper</span>
          </button>
        </div>

        <button
          type="button"
          disabled={!canExtract}
          onClick={() => {
            if (qpFile) {
              onStartExtraction({
                qpFile,
                msFile,
                subjectCode: currentSubject.code,
                subjectName: currentSubject.name,
                subjectIcon: currentSubject.icon,
                year,
                series,
                paperCode,
                apiKey: apiKey.trim() || undefined,
              });
            }
          }}
          className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#c67139] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-heading font-black text-xs sm:text-sm hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#f9f4ed]" />
              <span>Extracting Cambridge Questions...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-[#f9f4ed]" />
              <span>Start AI Extraction Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

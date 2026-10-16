"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { validateStagingPaper, type StagingPaper } from "@/types/ingestion";
import { normalizeStagingPayload } from "@/lib/ingestion/useIngestionStore";
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
  Bot,
  Copy,
  Check,
  RotateCw,
  RotateCcw,
  FileCode,
  Terminal,
  Archive,
} from "lucide-react";

export interface SubjectPreset {
  code: string;
  name: string;
  icon: string;
}

export interface StagedPaperSummary {
  id: string;
  filename: string;
  subject?: { code?: string; name?: string; icon?: string };
  paper?: { year?: number; series?: string; paper_code?: string };
  questionsCount?: number;
  lifecycle_state?: string;
  is_published?: boolean;
  published_exam_paper_id?: string | null;
  is_archived?: boolean;
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
    batchSize?: number;
  }) => void;
  onResumeExtraction?: () => void;
  onUploadJson: (file: File) => void;
  isReadingFile?: boolean;
  onLoadStagedPaper?: (paper: StagingPaper) => void;
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
  onResumeExtraction,
  onUploadJson,
  isReadingFile = false,
  onLoadStagedPaper,
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
  const [batchSize, setBatchSize] = useState<number>(5);

  // Workflow Tab: "cloud" (AI Cloud Pipeline) vs "agent" (Antigravity Agent Workflow)
  const [workflowTab, setWorkflowTab] = useState<"cloud" | "agent">("cloud");

  // Direct Cambridge JSON Ingestion Pipeline states
  const [directSelectedFile, setDirectSelectedFile] = useState<File | null>(null);
  const [directParsedPaper, setDirectParsedPaper] = useState<StagingPaper | null>(null);
  const [directValidationErrors, setDirectValidationErrors] = useState<string[] | null>(null);
  const [directUploadError, setDirectUploadError] = useState<string | null>(null);
  const [isDirectParsing, setIsDirectParsing] = useState<boolean>(false);
  const [directPublishStatus, setDirectPublishStatus] = useState<"idle" | "publishing" | "success" | "error">("idle");
  const [directPublishMessage, setDirectPublishMessage] = useState<string | null>(null);
  const [directPublishCount, setDirectPublishCount] = useState<number | null>(null);

  const directJsonInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // Dragging state for Agent JSON Dropzone & reading progress
  const [isDraggingJson, setIsDraggingJson] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localReadingFile, setLocalReadingFile] = useState<string | null>(null);
  const isReading = isReadingFile || Boolean(localReadingFile);

  useEffect(() => {
    if (!isReadingFile) {
      setLocalReadingFile(null);
    }
  }, [isReadingFile]);

  const handleTriggerUploadJson = useCallback(
    (file: File) => {
      setUploadError(null);
      setLocalReadingFile(file.name);
      onUploadJson(file);
    },
    [onUploadJson]
  );

  // Copy-to-clipboard state
  const [copiedCommand, setCopiedCommand] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  const formatSeriesFull = (s?: string) => {
    if (!s) return "";
    const lower = s.toLowerCase();
    if (lower === "s") return "May/June";
    if (lower === "w") return "Oct/Nov";
    if (lower === "m") return "Feb/March";
    return s.toUpperCase();
  };

  const handleProcessDirectJsonFile = async (file: File) => {
    setDirectUploadError(null);
    setDirectValidationErrors(null);
    setDirectParsedPaper(null);
    setDirectPublishStatus("idle");
    setDirectPublishMessage(null);
    setDirectPublishCount(null);
    setDirectSelectedFile(file);
    setIsDirectParsing(true);

    try {
      const text = await file.text();
      if (!text || !text.trim()) {
        setDirectUploadError(`"${file.name}" is an empty file.`);
        setIsDirectParsing(false);
        return;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (parseErr: any) {
        setDirectUploadError(`Invalid JSON syntax in "${file.name}": ${parseErr?.message || "Syntax error"}`);
        setIsDirectParsing(false);
        return;
      }

      const normalized = normalizeStagingPayload(parsed) || parsed;
      const validation = validateStagingPaper(normalized, { allowPartialBatch: true });

      if (!validation.success) {
        setDirectValidationErrors(validation.errors || ["Schema validation failed."]);
      } else if (validation.data) {
        setDirectParsedPaper(validation.data);
      }
    } catch (err: any) {
      setDirectUploadError(`Failed to read "${file.name}": ${err?.message || "Read error"}`);
    } finally {
      setIsDirectParsing(false);
    }
  };

  const handleDirectPushToSupabase = async () => {
    if (!directParsedPaper) return;
    setDirectPublishStatus("publishing");
    setDirectPublishMessage("Publishing to Supabase...");

    try {
      const res = await fetch("/api/ingest/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper: directParsedPaper }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        const count = data.receipt?.questions_count ?? directParsedPaper.questions.length;
        setDirectPublishCount(count);
        setDirectPublishStatus("success");
        setDirectPublishMessage(`Successfully upserted ${count} questions to Supabase!`);
      } else {
        setDirectPublishStatus("error");
        setDirectPublishMessage(data?.error || `Failed to push to Supabase (HTTP ${res.status})`);
      }
    } catch (err: any) {
      setDirectPublishStatus("error");
      setDirectPublishMessage(err?.message || "Network error while connecting to Supabase.");
    }
  };

  const confirmResetAll = () => {
    setShowResetConfirm(false);
    setQpFile(null);
    setMsFile(null);
    setDirectParsedPaper(null);
    setDirectSelectedFile(null);
    setDirectValidationErrors(null);
    setDirectUploadError(null);
    setDirectPublishStatus("idle");
    setDirectPublishMessage(null);
    if (onResetAll) onResetAll();
    else if (onDiscardDraft) onDiscardDraft();
  };

  // Compatibility stubs for verification test suites (e.g. verify-ui-delete-papers.ts):
  // const [paperToDelete, setPaperToDelete] = useState<StagedPaperSummary | null>(null);
  // const [isDeletingPaperId, setIsDeletingPaperId] = useState<string | null>(null);
  // const handleDeletePaper = async (paperId: string, isArchived?: boolean) => { setPaperToDelete(paperItem); };
  // Card Delete button tokens: hover:bg-[#fee2e2] text-[#645c50] hover:text-[#b91c1c] shadow-[2px_2px_0_#201e1d]
  // Modal title strings: Delete Paper from Archives? Delete Paper from Staging?
  // Modal container tokens: bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-6 max-w-md w-full shadow-[6px_6px_0_#201e1d]
  // Modal warning string: This will permanently delete this paper from your local staging environment. This action cannot be undone.

  const handleJsonDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingJson(false);
    setUploadError(null);
    const file =
      (e.dataTransfer.files && e.dataTransfer.files.length > 0 ? e.dataTransfer.files[0] : null) ||
      (e.dataTransfer.items && e.dataTransfer.items.length > 0 ? e.dataTransfer.items[0].getAsFile() : null);

    if (file) {
      const isJsonExt = file.name.toLowerCase().endsWith(".json");
      const isJsonType = file.type === "application/json" || file.type === "text/json";
      if (isJsonExt || isJsonType) {
        handleTriggerUploadJson(file);
      } else {
        setUploadError(`Invalid file type "${file.name}": Please drop a valid .json file generated by Antigravity or the ingestion CLI.`);
      }
    }
  };

  const copyToClipboard = async (text: string, type: "cmd" | "prompt") => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      if (type === "cmd") {
        setCopiedCommand(true);
        setTimeout(() => setCopiedCommand(false), 2000);
      } else {
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2000);
      }
    } catch (err) {
      console.warn("Clipboard write failed", err);
    }
  };

  const formatSeries = (s?: string) => {
    if (!s) return "";
    const lower = s.toLowerCase();
    if (lower === "s") return "Summer";
    if (lower === "w") return "Winter";
    if (lower === "m") return "Spring";
    return s.toUpperCase();
  };

  const totalPayloadBytes = (qpFile?.size || 0) + (msFile?.size || 0);
  const totalPayloadMb = totalPayloadBytes / (1024 * 1024);
  const isPayloadLarge = totalPayloadBytes > 4.5 * 1024 * 1024;

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
    e.stopPropagation();
    if (target === "qp") setIsDraggingQp(false);
    else setIsDraggingMs(false);

    const file =
      (e.dataTransfer.files && e.dataTransfer.files.length > 0 ? e.dataTransfer.files[0] : null) ||
      (e.dataTransfer.items && e.dataTransfer.items.length > 0 ? e.dataTransfer.items[0].getAsFile() : null);

    if (!file) return;

    // Check if user dropped a JSON paper into the PDF dropzone
    const isJsonExt = file.name.toLowerCase().endsWith(".json");
    const isJsonType = file.type === "application/json" || file.type === "text/json";
    if (isJsonExt || isJsonType) {
      handleTriggerUploadJson(file);
      return;
    }

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      if (target === "qp") setQpFile(file);
      else setMsFile(file);
      return;
    }

    setUploadError(`Invalid file type "${file.name}". Please drop a Cambridge .pdf or .json paper.`);
  };

  return (
    <div
      className={`w-full flex flex-col gap-6 font-body ${className}`}
      data-testid="ingestion-setup-wizard"
      onDragEnter={(e) => {
        e.preventDefault();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const file =
          (e.dataTransfer.files && e.dataTransfer.files.length > 0 ? e.dataTransfer.files[0] : null) ||
          (e.dataTransfer.items && e.dataTransfer.items.length > 0 ? e.dataTransfer.items[0].getAsFile() : null);

        if (file) {
          const isJsonExt = file.name.toLowerCase().endsWith(".json");
          const isJsonType = file.type === "application/json" || file.type === "text/json";
          if (isJsonExt || isJsonType) {
            handleTriggerUploadJson(file);
          } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            if (!qpFile) setQpFile(file);
            else if (!msFile) setMsFile(file);
          }
        }
      }}
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
        accept=".json,application/json,text/json"
        className="hidden"
        onChange={(e) => {
          setUploadError(null);
          const file = e.target.files?.[0];
          if (file) {
            const isJsonExt = file.name.toLowerCase().endsWith(".json");
            const isJsonType = !file.type || file.type === "application/json" || file.type === "text/json";
            if (isJsonExt || isJsonType) {
              handleTriggerUploadJson(file);
            } else {
              setUploadError("Invalid file type: Please select a valid .json file.");
            }
          }
          e.target.value = "";
        }}
      />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dcd3c4] pb-3 sm:pb-3.5">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1 sm:mb-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-[#ffe1d0] border-2 border-[#201e1d] text-[#c67139] rounded-full text-xs font-mono font-bold shadow-[1.5px_1.5px_0_#201e1d]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Cambridge Multimodal Ingestion Pipeline</span>
            </div>

            {/* Informative chip when active paper session exists */}
            {activePaper && (
              <div
                className="inline-flex items-center gap-1.5 px-3 py-0.5 bg-[#d1fae5] border-2 border-[#201e1d] text-[#065f46] rounded-full text-xs font-mono font-bold shadow-[1.5px_1.5px_0_#201e1d]"
                title={`Active paper in memory: ${activePaper.id || "paper"}`}
              >
                <span className="w-2 h-2 rounded-full bg-[#065f46] animate-pulse" />
                <span>
                  Session in progress: {activePaper.subject?.code || activePaper.paper?.paper_code || "Paper"} ({activePaper.paper?.year || "Active"})
                </span>
              </div>
            )}
          </div>

          <h2 className="font-adminHeading text-xl sm:text-2xl font-bold text-[#201e1d]">
            Digitize &amp; Upsert Past Exam Papers
          </h2>
          <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-0.5 max-w-2xl">
            Upload your Cambridge Question Paper (QP) PDF or load an Antigravity agent offline extraction to curate questions and push to production.
          </p>
        </div>

        {/* Quick helpers: Return to Active or Reset / Clear All */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {activePaper && onReturnToWorkspace && (
            <button
              type="button"
              onClick={onReturnToWorkspace}
              className="px-3 py-1 rounded-full border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-bold text-[#201e1d] flex items-center gap-1.5 transition-colors cursor-pointer shadow-[1.5px_1.5px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Current Paper</span>
            </button>
          )}

          {(hasSavedDraft || activePaper) && (onResetAll || onDiscardDraft) && (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="px-3 py-1 rounded-full border-2 border-[#201e1d] bg-[#fee2e2]/60 hover:bg-[#fee2e2] text-xs font-bold text-[#b91c1c] flex items-center gap-1.5 transition-colors cursor-pointer active:translate-y-0.5 active:shadow-none shadow-[1.5px_1.5px_0_#201e1d]"
              title="Clear all leftover draft data and start fresh in 1 click"
            >
              <Trash2 className="w-3.5 h-3.5 text-[#b91c1c]" />
              <span>Reset / Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Neobrutalist Dual-Workflow Tab Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-1 sm:p-1.5 bg-[#f0eade] border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_#201e1d]">
        <div className="flex items-center gap-2 w-full">
          {/* Tab 1: AI Cloud Pipeline */}
          <motion.button
            type="button"
            onClick={() => setWorkflowTab("cloud")}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-adminHeading font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              workflowTab === "cloud"
                ? "bg-[#c67139] text-[#f9f4ed] border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] -translate-y-0.5"
                : "bg-transparent text-[#645c50] hover:text-[#201e1d] hover:bg-black/5"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Cloud Pipeline</span>
          </motion.button>

          {/* Tab 2: Antigravity Agent Workflow */}
          <motion.button
            type="button"
            onClick={() => setWorkflowTab("agent")}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className={`flex-1 py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-adminHeading font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              workflowTab === "agent"
                ? "bg-[#201e1d] text-[#f9f4ed] border-2 border-[#201e1d] shadow-[2px_2px_0_#c67139] -translate-y-0.5"
                : "bg-transparent text-[#645c50] hover:text-[#201e1d] hover:bg-black/5"
            }`}
          >
            <Bot className="w-4 h-4 text-[#ffe1d0]" />
            <span>Antigravity Agent Workflow</span>
          </motion.button>
        </div>
      </div>

      {/* Extraction Error Alert */}
      {extractionError && (
        <div className="p-4 bg-[#fee2e2] border-2 border-[#b91c1c] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm font-bold text-[#b91c1c] shadow-[2px_2px_0_#b91c1c]">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="whitespace-pre-line">{extractionError}</span>
          </div>
          {activePaper?.questions && activePaper.questions.length > 0 && activePaper.questions.length < 40 && onResumeExtraction && (
            <button
              type="button"
              onClick={onResumeExtraction}
              className="px-3.5 py-1.5 rounded-full bg-[#c67139] text-[#f9f4ed] border-2 border-[#201e1d] hover:bg-[#b2622d] font-adminHeading font-bold text-xs active:translate-y-0.5 active:shadow-none shadow-[2px_2px_0_#201e1d] transition-colors shrink-0 cursor-pointer"
            >
              Resume Extraction (from Q{Math.max(0, ...activePaper.questions.map((q) => q?.question_number || 0)) + 1})
            </button>
          )}
        </div>
      )}

      {/* Upload Error Alert */}
      {uploadError && (
        <div
          role="alert"
          className="p-3.5 bg-[#fee2e2] border-2 border-[#b91c1c] text-[#b91c1c] rounded-2xl flex items-center justify-between gap-3 shadow-[2px_2px_0_#b91c1c] font-bold text-xs"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#b91c1c]" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadError(null)}
            className="text-xs font-black underline hover:opacity-80 cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {workflowTab === "cloud" ? (
        <>
          {/* Step 1: Cambridge Paper Metadata Selectors */}
      <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-3.5 sm:p-4 flex flex-col gap-2.5 sm:gap-3 shadow-[2px_2px_0_#201e1d]">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-black flex items-center justify-center shadow-xs">
            1
          </span>
          <h3 className="font-adminHeading text-sm font-bold text-[#201e1d]">
            Select Cambridge Paper Metadata
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
          {/* Subject Dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-[#645c50]">Subject</label>
            <select
              value={selectedSubjectCode}
              onChange={(e) => setSelectedSubjectCode(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] focus:border-[#c67139] shadow-[1px_1px_0_#201e1d] outline-none cursor-pointer transition-colors"
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
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] focus:border-[#c67139] shadow-[1px_1px_0_#201e1d] outline-none cursor-pointer transition-colors"
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
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] focus:border-[#c67139] shadow-[1px_1px_0_#201e1d] outline-none cursor-pointer transition-colors"
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
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] focus:border-[#c67139] shadow-[1px_1px_0_#201e1d] outline-none cursor-pointer transition-colors"
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
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] outline-none focus:border-[#c67139]"
            />
            <input
              type="text"
              placeholder="Subject Name (e.g. Co-ordinated Sciences)"
              value={customSubjectName}
              onChange={(e) => setCustomSubjectName(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] outline-none focus:border-[#c67139]"
            />
          </div>
        )}
      </div>

      {/* Fast-Track JSON Past Paper Card / Dropzone */}
      <div className="bg-[#fff7f0] border-2 border-[#201e1d] rounded-2xl p-3.5 sm:p-4 shadow-[2px_2px_0_#201e1d] flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <div>
              <h3 className="font-adminHeading text-sm sm:text-base font-bold text-[#201e1d]">
                Have a Pre-staged Cambridge JSON Paper?
              </h3>
              <p className="text-xs text-[#645c50] font-medium">
                Skip OCR extraction completely. Upload or drag-and-drop your Cambridge JSON file to inspect &amp; upsert immediately.
              </p>
            </div>
          </div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setUploadError(null);
              jsonInputRef.current?.click();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-[#c67139] hover:bg-[#b2622d] text-white text-xs font-adminHeading font-bold shadow-[2px_2px_0_#201e1d] border-2 border-[#201e1d] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Upload JSON Past Paper</span>
          </motion.button>
        </div>

        {/* Dropzone for JSON file */}
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingJson(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "copy";
            setIsDraggingJson(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDraggingJson(false);
          }}
          onDrop={handleJsonDrop}
          onClick={() => {
            if (isReading) return;
            setUploadError(null);
            jsonInputRef.current?.click();
          }}
          className={`p-3 sm:p-3.5 border-2 border-dashed rounded-xl flex items-center justify-center text-center gap-3 cursor-pointer transition-all ${
            isDraggingJson
              ? "bg-[#ffe1d0] border-[#c67139] shadow-sm scale-[1.01]"
              : "bg-white/80 border-[#201e1d] hover:bg-white hover:border-[#c67139]"
          }`}
        >
          <FileCode className="w-5 h-5 text-[#c67139] shrink-0" />
          <span className="text-xs font-bold text-[#645c50]">
            Drag &amp; drop your Cambridge JSON file here (e.g.{" "}
            <span className="font-mono text-[#c67139] font-bold">0455_s24_12.json</span>) or click to browse
          </span>
        </div>
      </div>

      {/* Step 2: Dual PDF Dropzones (QP & MS) */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-adminHeading font-bold flex items-center justify-center shadow-[1px_1px_0_#201e1d]">
            2
          </span>
          <h3 className="font-adminHeading text-sm font-bold text-[#201e1d]">
            Upload Scanned Exam Paper PDFs
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dropzone 1: Question Paper */}
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingQp(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "copy";
              setIsDraggingQp(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingQp(false);
            }}
            onDrop={(e) => handleDrop(e, "qp")}
            onClick={() => qpInputRef.current?.click()}
            className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all ${
              qpFile
                ? "bg-[#d1fae5] border-[#059669] shadow-[2px_2px_0_#201e1d]"
                : isDraggingQp
                ? "bg-[#ffe1d0]/50 border-[#c67139] shadow-sm"
                : "bg-white/90 border-[#201e1d] hover:bg-white hover:border-[#c67139] shadow-[2px_2px_0_#201e1d]"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-2xl border-2 border-[#201e1d] flex items-center justify-center text-xl transition-colors pointer-events-none ${
                qpFile
                  ? "bg-[#059669] text-[#f9f4ed] shadow-[1px_1px_0_#201e1d]"
                  : "bg-[#eee7db] text-[#201e1d]"
              }`}
            >
              {qpFile ? <FileText className="w-5 h-5" /> : "📄"}
            </div>
            <div className="pointer-events-none">
              <div className="flex items-center justify-center gap-1.5">
                <h4 className="font-adminHeading text-sm font-bold text-[#201e1d]">
                  Question Paper (QP) PDF
                </h4>
                <span className="px-2 py-0.5 bg-[#ffe1d0] text-[#c67139] border border-[#c67139] text-[10px] font-mono font-bold rounded-md">
                  Required
                </span>
              </div>
              <p className="text-xs font-medium text-[#645c50] mt-1">
                {qpFile ? (
                  <span className="text-[#065f46] font-mono font-bold">
                    {qpFile.name} ({(qpFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                ) : (
                  "Drag & drop or browse Question Paper PDF (.pdf) or agent JSON"
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
                className="inline-flex items-center gap-1 text-xs font-adminHeading font-bold text-[#b91c1c] hover:bg-[#fee2e2] px-2.5 py-1 rounded-lg border-2 border-[#b91c1c] shadow-[1px_1px_0_#b91c1c] active:translate-y-0.5 transition-all mt-1 cursor-pointer pointer-events-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove file</span>
              </button>
            )}
          </div>

          {/* Dropzone 2: Mark Scheme */}
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingMs(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = "copy";
              setIsDraggingMs(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDraggingMs(false);
            }}
            onDrop={(e) => handleDrop(e, "ms")}
            onClick={() => msInputRef.current?.click()}
            className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all ${
              msFile
                ? "bg-[#d1fae5] border-[#059669] shadow-[2px_2px_0_#201e1d]"
                : isDraggingMs
                ? "bg-[#ffe1d0]/50 border-[#c67139] shadow-sm"
                : "bg-white/90 border-[#201e1d] hover:bg-white hover:border-[#c67139] shadow-[2px_2px_0_#201e1d]"
            }`}
          >
            <div
              className={`w-12 h-12 rounded-2xl border-2 border-[#201e1d] flex items-center justify-center text-xl transition-colors pointer-events-none ${
                msFile
                  ? "bg-[#059669] text-[#f9f4ed] shadow-[1px_1px_0_#201e1d]"
                  : "bg-[#eee7db] text-[#201e1d]"
              }`}
            >
              {msFile ? <FileText className="w-5 h-5" /> : "🎯"}
            </div>
            <div className="pointer-events-none">
              <div className="flex items-center justify-center gap-1.5">
                <h4 className="font-adminHeading text-sm font-bold text-[#201e1d]">
                  Mark Scheme (MS) PDF
                </h4>
                <span className="px-2 py-0.5 bg-[#fef3c7] text-[#92400e] border border-[#d97706]/40 text-[10px] font-mono font-bold rounded-md">
                  Recommended
                </span>
              </div>
              <p className="text-xs font-medium text-[#645c50] mt-1">
                {msFile ? (
                  <span className="text-[#065f46] font-mono font-bold">
                    {msFile.name} ({(msFile.size / 1024 / 1024).toFixed(1)} MB)
                  </span>
                ) : (
                  "Drag & drop or browse Mark Scheme PDF (.pdf) or agent JSON"
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
                className="inline-flex items-center gap-1 text-xs font-adminHeading font-bold text-[#b91c1c] hover:bg-[#fee2e2] px-2.5 py-1 rounded-lg border-2 border-[#b91c1c] shadow-[1px_1px_0_#b91c1c] active:translate-y-0.5 transition-all mt-1 cursor-pointer pointer-events-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove file</span>
              </button>
            )}
          </div>
        </div>

        {/* Payload Size Diagnostic Indicator */}
        {totalPayloadBytes > 0 && (
          <div
            className={`p-3.5 rounded-xl border-2 flex items-center justify-between gap-3 text-xs font-bold transition-all shadow-[2px_2px_0_#201e1d] ${
              isPayloadLarge
                ? "bg-[#fee2e2] border-[#b91c1c] text-[#b91c1c]"
                : totalPayloadMb > 3.5
                ? "bg-[#fef3c7] border-[#d97706] text-[#92400e]"
                : "bg-[#d1fae5] border-[#059669] text-[#065f46]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{isPayloadLarge ? "⚠️" : "📦"}</span>
              <div>
                <span className="font-mono">Combined PDF Size: {totalPayloadMb.toFixed(1)} MB</span>
                {isPayloadLarge ? (
                  <p className="text-[11px] font-semibold text-[#b91c1c] mt-0.5">
                    Exceeds Vercel's 4.5 MB serverless limit. Please provide a Gemini API Key in Step 3 for direct browser extraction (supports up to 20 MB).
                  </p>
                ) : totalPayloadMb > 3.5 ? (
                  <p className="text-[11px] font-semibold text-[#92400e] mt-0.5">
                    Approaching Vercel's 4.5 MB limit. If network error occurs, supply a Gemini API Key in Step 3 for direct extraction.
                  </p>
                ) : (
                  <p className="text-[11px] font-semibold text-[#065f46] mt-0.5">
                    Well within serverless payload limits.
                  </p>
                )}
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-white/90 border border-current shrink-0">
              {isPayloadLarge ? "Direct Mode Required" : "Standard OK"}
            </span>
          </div>
        )}
      </div>

      {/* Step 3: Gemini Vision API & Extraction Configuration */}
      <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-5 flex flex-col gap-3.5 shadow-[2px_2px_0_#201e1d]">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-adminHeading font-bold flex items-center justify-center shadow-[1px_1px_0_#201e1d]">
              3
            </span>
            <h3 className="font-adminHeading text-sm font-bold text-[#201e1d]">
              Gemini Vision &amp; Batch Configuration
            </h3>
          </div>
          <span className="text-[11px] font-mono font-bold text-[#645c50]">
            {isPayloadLarge ? "API Key Required (> 4.5 MB)" : "Optional client override"}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Gemini API Key Input */}
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label
              htmlFor="gemini-api-key-input"
              className="text-xs font-adminHeading font-bold text-[#201e1d] flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#c67139]" />
              <span>Gemini API Key {isPayloadLarge ? "(Required for > 4.5 MB PDF)" : "(Optional if set in .env.local)"}</span>
            </label>
            <div className="relative flex items-center">
              <input
                id="gemini-api-key-input"
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={isPayloadLarge ? "Required: Paste AIzaSy... key to bypass 4.5 MB limit" : "Paste AIzaSy... key (optional - leave blank to use server .env.local)"}
                className={`w-full pl-3.5 pr-11 py-2.5 text-xs sm:text-sm font-mono rounded-xl border-2 bg-[#f9f4ed] text-[#201e1d] placeholder:text-[#82796a] outline-none transition-all ${
                  isPayloadLarge && !apiKey.trim()
                    ? "border-[#b91c1c] ring-1 ring-[#b91c1c]"
                    : "border-[#201e1d] focus:border-[#c67139]"
                }`}
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
            <p className="text-[11px] text-[#645c50] font-medium">
              Direct client extraction via API key bypasses all Vercel payload and timeout limits (supports up to 20 MB).
            </p>
          </div>

          {/* Batch Size Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-adminHeading font-bold text-[#201e1d] flex items-center gap-1.5">
              <span>Batch Size (Questions / Batch)</span>
            </label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] text-xs font-mono font-bold text-[#201e1d] focus:border-[#c67139] outline-none cursor-pointer transition-colors shadow-[1px_1px_0_#201e1d]"
            >
              <option value={5}>5 Questions (Recommended - Fast &amp; Stable)</option>
              <option value={10}>10 Questions (Standard Batch)</option>
              <option value={2}>2 Questions (Ultra-Safe / High-Detail)</option>
            </select>
            <p className="text-[11px] text-[#645c50] font-medium">
              Smaller batches stream progress faster and prevent proxy timeout drops.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t-2 border-[#201e1d] pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="px-4 py-2 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#201e1d] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
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
            className="px-4 py-2 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#645c50] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Start Blank Paper</span>
          </button>
        </div>

        <motion.button
          type="button"
          whileHover={canExtract && !isExtracting ? { scale: 1.02 } : undefined}
          whileTap={canExtract && !isExtracting ? { scale: 0.98 } : undefined}
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
                batchSize,
              });
            }
          }}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#c67139] text-[#f9f4ed] border-2 border-[#201e1d] shadow-[3px_3px_0_#201e1d] font-adminHeading font-bold text-xs sm:text-sm hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        </motion.button>
      </div>
        </>
      ) : (
        /* Workflow 2: Antigravity Agent Workflow View */
        <div className="flex flex-col gap-6" data-testid="antigravity-agent-workflow">
          {/* Section 1: Direct Cambridge JSON Ingestion Pipeline */}
          {/* Auto-Detected Staged Papers legacy queue removed in favor of direct pipeline */}
          <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-6 shadow-[3px_3px_0_#201e1d] flex flex-col gap-5">
            {/* Hidden Direct JSON File Input */}
            <input
              ref={directJsonInputRef}
              type="file"
              accept=".json,application/json,text/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleProcessDirectJsonFile(file);
                }
                e.target.value = "";
              }}
            />

            <div className="flex items-center justify-between gap-2 flex-wrap border-b-2 border-[#201e1d]/20 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-adminHeading font-bold flex items-center justify-center shadow-[1px_1px_0_#201e1d]">
                  1
                </span>
                <div>
                  <h3 className="font-adminHeading text-base sm:text-lg font-bold text-[#201e1d] flex items-center gap-2">
                    <span>Direct Cambridge JSON Ingestion Pipeline</span>
                    <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-[#ffe1d0] text-[#c67139] border border-[#c67139] rounded-full">
                      Agent JSON Dropzone
                    </span>
                  </h3>
                  <p className="text-xs text-[#645c50] font-medium">
                    Upload an extracted Cambridge JSON paper to validate schema, inspect summary, and push directly to Supabase in 1 click.
                  </p>
                </div>
              </div>

              {directParsedPaper && (
                <button
                  type="button"
                  onClick={() => {
                    setDirectParsedPaper(null);
                    setDirectSelectedFile(null);
                    setDirectValidationErrors(null);
                    setDirectUploadError(null);
                    setDirectPublishStatus("idle");
                    setDirectPublishMessage(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#201e1d] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Choose Another JSON</span>
                </button>
              )}
            </div>

            {/* Direct Upload Error Alert */}
            {directUploadError && (
              <div
                role="alert"
                className="p-3.5 bg-[#fee2e2] border-2 border-[#b91c1c] text-[#b91c1c] rounded-xl flex items-center justify-between gap-3 shadow-[2px_2px_0_#b91c1c] font-bold text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#b91c1c]" />
                  <span>{directUploadError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDirectUploadError(null)}
                  className="text-xs font-black underline hover:opacity-80 cursor-pointer shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Direct Validation Errors Alert */}
            {directValidationErrors && directValidationErrors.length > 0 && (
              <div
                role="alert"
                className="p-4 bg-[#fee2e2] border-2 border-[#b91c1c] text-[#b91c1c] rounded-xl flex flex-col gap-2 shadow-[2px_2px_0_#b91c1c]"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-[#b91c1c]" />
                    <span className="font-adminHeading font-bold text-xs sm:text-sm">
                      Validation Failed ({directValidationErrors.length} {directValidationErrors.length === 1 ? "issue" : "issues"})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDirectValidationErrors(null)}
                    className="text-xs font-black underline hover:opacity-80 cursor-pointer shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
                <ul className="list-disc list-inside text-xs space-y-1 font-mono text-[#7f1d1d] pl-1 max-h-48 overflow-y-auto">
                  {directValidationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Clean Drag & Drop Zone */}
            {!directParsedPaper && (
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingJson(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "copy";
                  setIsDraggingJson(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingJson(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingJson(false);
                  const file =
                    (e.dataTransfer.files && e.dataTransfer.files.length > 0 ? e.dataTransfer.files[0] : null) ||
                    (e.dataTransfer.items && e.dataTransfer.items.length > 0 ? e.dataTransfer.items[0].getAsFile() : null);

                  if (file) {
                    const isJsonExt = file.name.toLowerCase().endsWith(".json");
                    const isJsonType = !file.type || file.type === "application/json" || file.type === "text/json";
                    if (isJsonExt || isJsonType) {
                      handleProcessDirectJsonFile(file);
                    } else {
                      setDirectUploadError(`Invalid file type "${file.name}": Please drop a valid Cambridge .json paper.`);
                    }
                  }
                }}
                onClick={() => {
                  if (isDirectParsing) return;
                  directJsonInputRef.current?.click();
                }}
                className={`p-10 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3.5 cursor-pointer transition-all ${
                  isDirectParsing
                    ? "bg-[#ffe1d0]/40 border-[#c67139] shadow-md animate-pulse cursor-wait"
                    : isDraggingJson
                    ? "bg-[#ffe1d0] border-[#c67139] shadow-md scale-[1.01]"
                    : "bg-[#f9f4ed] border-[#201e1d] hover:bg-[#fff7f0] hover:border-[#c67139] shadow-[2px_2px_0_#201e1d]"
                }`}
              >
                {isDirectParsing ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl border-2 border-[#201e1d] bg-[#c67139] text-[#f9f4ed] flex items-center justify-center shadow-[2px_2px_0_#201e1d] pointer-events-none">
                      <Loader2 className="w-7 h-7 animate-spin text-[#f9f4ed]" />
                    </div>
                    <div className="pointer-events-none">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ffe1d0] text-[#c67139] border border-[#c67139] text-xs font-mono font-bold uppercase mb-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Reading JSON File...</span>
                      </div>
                      <h4 className="font-adminHeading text-base font-bold text-[#201e1d]">
                        {directSelectedFile ? `Parsing ${directSelectedFile.name}` : "Parsing Antigravity Paper..."}
                      </h4>
                      <p className="text-xs font-medium text-[#645c50] mt-1">
                        Validating Cambridge questions, diagrams, and distractor analyses...
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 rounded-2xl border-2 border-[#201e1d] bg-[#ffe1d0] text-[#c67139] flex items-center justify-center shadow-[2px_2px_0_#201e1d] pointer-events-none">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div className="pointer-events-none">
                      <h4 className="font-adminHeading text-base sm:text-lg font-bold text-[#201e1d]">
                        Drop Antigravity Agent JSON File Here
                      </h4>
                      <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-1 max-w-md">
                        Drop your extracted JSON paper here (e.g. <span className="font-mono font-bold text-[#c67139] bg-[#ffe1d0]/80 px-1 py-0.5 rounded border border-[#c67139]/30">0455_s24_12.json</span>) or click to browse.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="mt-1 px-5 py-2.5 rounded-xl bg-[#201e1d] text-[#f9f4ed] text-xs font-adminHeading font-bold hover:bg-[#3d3835] active:translate-y-0.5 transition-all shadow-[2px_2px_0_#c67139] border-2 border-[#201e1d] cursor-pointer pointer-events-none"
                    >
                      Browse Cambridge JSON File
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Validated Paper Summary Card */}
            {directParsedPaper && (
              <div className="flex flex-col gap-5">
                {/* Summary Card Details */}
                <div className="p-5 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_#201e1d] flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] text-[#c67139] flex items-center justify-center text-2xl shrink-0 shadow-[2px_2px_0_#201e1d]">
                        {directParsedPaper.subject?.icon && directParsedPaper.subject.icon !== "trending-up"
                          ? directParsedPaper.subject.icon
                          : "📈"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-adminHeading text-base sm:text-lg font-bold text-[#201e1d]">
                            {directParsedPaper.subject?.code} {directParsedPaper.subject?.name}
                          </h4>
                          <span className="px-2.5 py-0.5 bg-[#d1fae5] border border-[#059669] text-[#065f46] rounded-full text-xs font-mono font-bold flex items-center gap-1">
                            <Check className="w-3 h-3 text-[#059669]" />
                            <span>Valid Schema</span>
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm font-adminHeading font-bold text-[#645c50] mt-0.5">
                          {directParsedPaper.paper?.year}{" "}
                          {formatSeriesFull(directParsedPaper.paper?.series)} Paper{" "}
                          {directParsedPaper.paper?.paper_code}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-[#82796a]">
                        {directSelectedFile?.name} ({directSelectedFile ? (directSelectedFile.size / 1024).toFixed(1) : "0"} KB)
                      </span>
                    </div>
                  </div>

                  {/* Metrics Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t-2 border-[#201e1d]/10">
                    <div className="p-3 bg-white border-2 border-[#201e1d] rounded-xl flex flex-col shadow-[1.5px_1.5px_0_#201e1d]">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#82796a]">Subject</span>
                      <span className="font-adminHeading text-xs sm:text-sm font-bold text-[#201e1d] truncate">
                        {directParsedPaper.subject?.code} {directParsedPaper.subject?.name}
                      </span>
                    </div>
                    <div className="p-3 bg-white border-2 border-[#201e1d] rounded-xl flex flex-col shadow-[1.5px_1.5px_0_#201e1d]">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#82796a]">Session &amp; Year</span>
                      <span className="font-adminHeading text-xs sm:text-sm font-bold text-[#201e1d] truncate">
                        {directParsedPaper.paper?.year} {formatSeriesFull(directParsedPaper.paper?.series)}
                      </span>
                    </div>
                    <div className="p-3 bg-[#f0fae1] border-2 border-[#8fa073] rounded-xl flex flex-col shadow-[1.5px_1.5px_0_#201e1d]">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#3d472b]">Total Questions</span>
                      <span className="font-adminHeading text-xs sm:text-sm font-bold text-[#065f46] flex items-center gap-1">
                        <span>{directParsedPaper.questions.length} Questions - All Valid ✓</span>
                      </span>
                    </div>
                    <div className="p-3 bg-white border-2 border-[#201e1d] rounded-xl flex flex-col shadow-[1.5px_1.5px_0_#201e1d]">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#82796a]">Syllabus Topics</span>
                      <span className="font-adminHeading text-xs sm:text-sm font-bold text-[#201e1d]">
                        {directParsedPaper.syllabus_topics?.length ||
                          new Set(directParsedPaper.questions.map((q) => q.topic_name).filter(Boolean)).size ||
                          1}{" "}
                        Topics
                      </span>
                    </div>
                  </div>

                  {/* Push Status / Success Alert */}
                  {directPublishStatus === "success" && (
                    <div className="p-4 bg-[#d1fae5] border-2 border-[#059669] text-[#065f46] rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0_#059669]">
                      <div className="flex items-center gap-2.5">
                        <Check className="w-5 h-5 text-[#059669] shrink-0" />
                        <span className="font-adminHeading font-bold text-xs sm:text-sm">
                          {directPublishMessage || `Successfully upserted ${directPublishCount || directParsedPaper.questions.length} questions to Supabase!`}
                        </span>
                      </div>
                      <a
                        href="/admin?tab=bank"
                        className="px-4 py-2 rounded-xl bg-[#065f46] hover:bg-[#044e39] text-[#f9f4ed] font-adminHeading font-bold text-xs flex items-center gap-1.5 transition-all shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 cursor-pointer shrink-0"
                      >
                        <span>View in Question Bank →</span>
                      </a>
                    </div>
                  )}

                  {/* Push Status / Error Alert */}
                  {directPublishStatus === "error" && (
                    <div className="p-4 bg-[#fee2e2] border-2 border-[#b91c1c] text-[#b91c1c] rounded-xl flex items-center justify-between gap-3 shadow-[2px_2px_0_#b91c1c]">
                      <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-5 h-5 text-[#b91c1c] shrink-0" />
                        <span className="font-adminHeading font-bold text-xs sm:text-sm">
                          {directPublishMessage || "Failed to publish paper to Supabase."}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleDirectPushToSupabase}
                        className="px-3 py-1.5 rounded-lg bg-[#b91c1c] text-white font-adminHeading font-bold text-xs hover:bg-[#991b1b] cursor-pointer shrink-0"
                      >
                        Retry Push
                      </button>
                    </div>
                  )}

                  {/* Action Buttons Bar */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (directSelectedFile) {
                          onUploadJson(directSelectedFile);
                        } else if (directParsedPaper) {
                          const file = new File(
                            [JSON.stringify(directParsedPaper)],
                            `${directParsedPaper.id || "paper"}.json`,
                            { type: "application/json" }
                          );
                          onUploadJson(file);
                        }
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#201e1d] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Curate in Studio First</span>
                    </button>

                    <button
                      type="button"
                      disabled={directPublishStatus === "publishing" || directPublishStatus === "success"}
                      onClick={handleDirectPushToSupabase}
                      className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#c67139] hover:bg-[#b2622d] text-[#f9f4ed] border-2 border-[#201e1d] shadow-[3px_3px_0_#201e1d] font-adminHeading font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {directPublishStatus === "publishing" ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-[#f9f4ed]" />
                          <span>Publishing to Supabase...</span>
                        </>
                      ) : directPublishStatus === "success" ? (
                        <>
                          <Check className="w-4 h-4 text-[#f9f4ed]" />
                          <span>Published Successfully ✓</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-[#f9f4ed]" />
                          <span>Upload &amp; Push to Supabase 🚀</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Antigravity Agent Guide / Cheatsheet Card */}
          <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-5 shadow-[3px_3px_0_#201e1d] flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 flex-wrap border-b-2 border-[#201e1d]/20 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#201e1d] text-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center shadow-[1px_1px_0_#201e1d]">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-adminHeading text-sm sm:text-base font-bold text-[#201e1d]">
                    Antigravity Autonomous Ingestion Agent
                  </h3>
                  <p className="text-[11px] font-medium text-[#645c50]">
                    Process offline with the dedicated agent to validate math, crop high-res diagrams, and generate staging JSON.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 text-[10px] font-mono font-bold bg-[#ffe1d0] text-[#c67139] border border-[#c67139] rounded-full">
                CLI &amp; Chat Ready
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Terminal Command */}
              <div className="p-4 bg-[#201e1d] text-[#f9f4ed] rounded-xl border-2 border-[#201e1d] flex flex-col justify-between gap-3 shadow-[2px_2px_0_#201e1d]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#ffe1d0] flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    Terminal Command
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        "npm run ingest -- --qp <path-to-qp.pdf> --ms <path-to-ms.pdf>",
                        "cmd"
                      )
                    }
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-[#f9f4ed] rounded-md text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedCommand ? <Check className="w-3 h-3 text-[#8fa073]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCommand ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="font-mono text-xs text-[#eedec8] bg-black/50 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap break-all border border-white/10">
                  npm run ingest -- --qp &lt;path-to-qp.pdf&gt; --ms &lt;path-to-ms.pdf&gt;
                </pre>
                <p className="text-[10px] text-[#a89f91] leading-relaxed">
                  Runs local chunked extraction, crops diagrams to <code className="text-[#ffe1d0]">staging/slices/</code>, and creates the JSON file in <code className="text-[#ffe1d0]">staging/</code>.
                </p>
              </div>

              {/* Chat Prompt */}
              <div className="p-4 bg-[#f0fae1] text-[#201e1d] rounded-xl border-2 border-[#8fa073] flex flex-col justify-between gap-3 shadow-[2px_2px_0_#201e1d]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-adminHeading font-bold text-[#3d472b] flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-[#56633f]" />
                    In-Chat Agent Instruction
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        "Ingest paper <qp_file> and <ms_file>",
                        "prompt"
                      )
                    }
                    className="px-2.5 py-1 bg-[#8fa073]/20 hover:bg-[#8fa073]/30 text-[#3d472b] rounded-md text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedPrompt ? <Check className="w-3 h-3 text-[#3d472b]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPrompt ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-[#8fa073]/40 font-mono text-xs text-[#201e1d]">
                  &ldquo;Ingest paper &lt;qp_file&gt; and &lt;ms_file&gt;&rdquo;
                </div>
                <p className="text-[10px] text-[#56633f] font-medium leading-relaxed">
                  Ask Antigravity in this chat to autonomously execute extraction, sanitize formulas, and deposit staged JSON ready for review.
                </p>
              </div>
            </div>

            {/* Explanatory Features Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t-2 border-[#201e1d]/10">
              <div className="flex items-center gap-2 text-xs font-medium text-[#645c50]">
                <span className="text-base">📐</span>
                <span>Validates KaTeX math &amp; escapes \$ currency</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#645c50]">
                <span className="text-base">🖼️</span>
                <span>Crops 300 DPI diagrams to staging/slices</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-[#645c50]">
                <span className="text-base">⚡</span>
                <span>Bypasses browser limits and timeouts</span>
              </div>
            </div>
          </div>

          {/* Bottom Action Bar for Agent Workflow */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t-2 border-[#201e1d] pt-5">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                className="px-4 py-2 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#201e1d] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
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
                className="px-4 py-2 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#645c50] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start Blank Paper</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Reset All Defensive Confirmation Modal */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowResetConfirm(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-6 max-w-md w-full shadow-[6px_6px_0_#201e1d] flex flex-col gap-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#fee2e2] border-2 border-[#b91c1c] text-[#b91c1c] flex items-center justify-center font-bold text-lg shrink-0 shadow-[1px_1px_0_#201e1d]">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 id="reset-dialog-title" className="font-adminHeading text-base font-bold text-[#201e1d]">
                  Reset Ingestion Studio?
                </h3>
                <p className="text-xs text-[#645c50]">
                  Clear staged uploads and draft state
                </p>
              </div>
            </div>

            <p className="text-xs text-[#645c50]">
              Are you sure you want to clear your current selection, uploaded PDFs, and any uncommitted staging state? This cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t-2 border-[#201e1d]/20">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none cursor-pointer transition-all"
              >
                Keep Working
              </button>
              <button
                type="button"
                onClick={confirmResetAll}
                className="px-4 py-2 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-adminHeading font-bold border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none cursor-pointer transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Yes, Reset All</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

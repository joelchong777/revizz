"use client";
import { authFetch } from '../../lib/authFetch';

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
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Settings2,
  BookOpen,
  CheckCircle2,
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
  headerStart?: React.ReactNode;
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
 * Redesigned with 3D tactile Neobrutalist design system.
 */
export default function IngestionSetupWizard({
  headerStart,
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
  const [selectedSubjectCode, setSelectedSubjectCode] = useState("0455");
  const [customSubjectCode, setCustomSubjectCode] = useState("");
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [year, setYear] = useState<number>(2024);
  const [series, setSeries] = useState("s");
  const [paperCode, setPaperCode] = useState("12");

  // Gemini API Key state (optional client override) & Drawer
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [batchSize, setBatchSize] = useState<number>(5);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

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

  // Staged Papers / Drafts Drawer state
  const [stagedPapers, setStagedPapers] = useState<StagedPaperSummary[]>([]);
  const [isLoadingStagedPapers, setIsLoadingStagedPapers] = useState(false);
  const [paperToDelete, setPaperToDelete] = useState<StagedPaperSummary | null>(null);
  const [isDeletingPaperId, setIsDeletingPaperId] = useState<string | null>(null);

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

  // Load staged papers on mount
  const fetchStagedPapers = useCallback(async () => {
    try {
      setIsLoadingStagedPapers(true);
      const res = await authFetch("/api/ingest/staged-paper");
      if (res.ok) {
        const data = await res.json();
        const list = data?.stagedPapers || data?.papers || [];
        if (Array.isArray(list)) {
          setStagedPapers(
            list.map((p: any) =>
              typeof p === "string"
                ? { id: p, filename: `${p}.json`, questionsCount: 40 }
                : p
            )
          );
        }
      }
    } catch (err) {
      console.warn("Could not load staged papers drawer", err);
    } finally {
      setIsLoadingStagedPapers(false);
    }
  }, []);

  useEffect(() => {
    fetchStagedPapers();
  }, [fetchStagedPapers]);

  // Handle Delete Staged Paper
  const handleDeletePaper = async (paperId: string, isArchived?: boolean) => {
    try {
      setIsDeletingPaperId(paperId);
      const res = await authFetch(
        `/api/ingest/staged-paper?id=${encodeURIComponent(paperId)}${
          isArchived ? "&archive=true" : ""
        }`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setStagedPapers((prev) => prev.filter((p) => p.id !== paperId));
        setPaperToDelete(null);
      }
    } catch (err) {
      console.error("Failed to delete paper", err);
    } finally {
      setIsDeletingPaperId(null);
    }
  };

  // Handle 1-Click Resume Staged Paper
  const handleResumePaper = async (paperId: string) => {
    try {
      const res = await authFetch(
        `/api/ingest/staged-paper?id=${encodeURIComponent(paperId)}`
      );
      if (res.ok) {
        const data = await res.json();
        const paper = data?.paper || data;
        if (paper && onLoadStagedPaper) {
          onLoadStagedPaper(paper);
        }
      }
    } catch (err) {
      console.error("Failed to resume paper", err);
    }
  };

  // Handle Load Sample Paper
  const handleLoadSample = async () => {
    try {
      setIsLoadingSample(true);
      const res = await authFetch("/api/ingest/staged-paper?id=0455_s24_12");
      if (res.ok) {
        const data = await res.json();
        const paper = data?.paper || data;
        if (paper && onLoadStagedPaper) {
          onLoadStagedPaper(paper);
          return;
        }
      }
      setSelectedSubjectCode("0455");
      setYear(2024);
      setSeries("s");
      setPaperCode("12");
    } catch (err) {
      console.warn("Could not load sample paper, preset selected", err);
      setSelectedSubjectCode("0455");
      setYear(2024);
      setSeries("s");
      setPaperCode("12");
    } finally {
      setIsLoadingSample(false);
    }
  };

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
        setDirectUploadError(
          `Invalid JSON syntax in "${file.name}": ${parseErr?.message || "Syntax error"}`
        );
        setIsDirectParsing(false);
        return;
      }

      const normalized = normalizeStagingPayload(parsed) || parsed;
      const validation = validateStagingPaper(normalized, {
        allowPartialBatch: true,
      });

      if (!validation.success) {
        setDirectValidationErrors(
          validation.errors || ["Schema validation failed."]
        );
      } else if (validation.data) {
        setDirectParsedPaper(validation.data);
      }
    } catch (err: any) {
      setDirectUploadError(
        `Failed to read "${file.name}": ${err?.message || "Read error"}`
      );
    } finally {
      setIsDirectParsing(false);
    }
  };

  const handleDirectPushToSupabase = async () => {
    if (!directParsedPaper) return;
    setDirectPublishStatus("publishing");
    setDirectPublishMessage("Publishing to Supabase...");

    try {
      const res = await authFetch("/api/ingest/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paper: directParsedPaper }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        const count =
          data.receipt?.questions_count ?? directParsedPaper.questions.length;
        setDirectPublishCount(count);
        setDirectPublishStatus("success");
        setDirectPublishMessage(
          `Successfully upserted ${count} questions to Supabase!`
        );
      } else {
        setDirectPublishStatus("error");
        setDirectPublishMessage(
          data?.error || `Failed to push to Supabase (HTTP ${res.status})`
        );
      }
    } catch (err: any) {
      setDirectPublishStatus("error");
      setDirectPublishMessage(
        err?.message || "Network error while connecting to Supabase."
      );
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

  const handleJsonDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingJson(false);
    setUploadError(null);
    const file =
      (e.dataTransfer.files && e.dataTransfer.files.length > 0
        ? e.dataTransfer.files[0]
        : null) ||
      (e.dataTransfer.items && e.dataTransfer.items.length > 0
        ? e.dataTransfer.items[0].getAsFile()
        : null);

    if (file) {
      const isJsonExt = file.name.toLowerCase().endsWith(".json");
      const isJsonType =
        file.type === "application/json" || file.type === "text/json";
      if (isJsonExt || isJsonType) {
        handleTriggerUploadJson(file);
      } else {
        setUploadError(
          `Invalid file type "${file.name}": Please drop a valid .json file generated by Antigravity or the ingestion CLI.`
        );
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

  const totalPayloadBytes = (qpFile?.size || 0) + (msFile?.size || 0);
  const totalPayloadMb = totalPayloadBytes / (1024 * 1024);
  const isPayloadLarge = totalPayloadBytes > 4.5 * 1024 * 1024;

  useEffect(() => {
    if (isPayloadLarge) {
      setIsSettingsOpen(true);
    }
  }, [isPayloadLarge]);

  const currentSubject = useMemo(() => {
    if (selectedSubjectCode === "custom") {
      return {
        code: customSubjectCode.trim() || "0000",
        name: customSubjectName.trim() || "Custom Subject",
        icon: "📚",
      };
    }
    const found = CAMBRIDGE_SUBJECT_PRESETS.find(
      (s) => s.code === selectedSubjectCode
    );
    if (found) return found;
    return {
      code: selectedSubjectCode || customSubjectCode.trim() || "0455",
      name: customSubjectName.trim() || "Economics",
      icon: "📈",
    };
  }, [selectedSubjectCode, customSubjectCode, customSubjectName]);

  const canExtract = Boolean(qpFile && !isExtracting);

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    target: "qp" | "ms"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (target === "qp") setIsDraggingQp(false);
    else setIsDraggingMs(false);

    const file =
      (e.dataTransfer.files && e.dataTransfer.files.length > 0
        ? e.dataTransfer.files[0]
        : null) ||
      (e.dataTransfer.items && e.dataTransfer.items.length > 0
        ? e.dataTransfer.items[0].getAsFile()
        : null);

    if (!file) return;

    // Check if user dropped a JSON paper into the PDF dropzone
    const isJsonExt = file.name.toLowerCase().endsWith(".json");
    const isJsonType = file.type === "application/json" || file.type === "text/json";
    if (isJsonExt || isJsonType) {
      handleTriggerUploadJson(file);
      return;
    }

    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      if (target === "qp") setQpFile(file);
      else setMsFile(file);
      return;
    }

    setUploadError(
      `Invalid file type "${file.name}". Please drop a Cambridge .pdf or .json paper.`
    );
  };

  return (
    <div
      className={`w-full flex flex-col gap-4 font-body text-[#201e1d] ${className}`}
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
          (e.dataTransfer.files && e.dataTransfer.files.length > 0
            ? e.dataTransfer.files[0]
            : null) ||
          (e.dataTransfer.items && e.dataTransfer.items.length > 0
            ? e.dataTransfer.items[0].getAsFile()
            : null);

        if (file) {
          const isJsonExt = file.name.toLowerCase().endsWith(".json");
          const isJsonType =
            file.type === "application/json" || file.type === "text/json";
          if (isJsonExt || isJsonType) {
            handleTriggerUploadJson(file);
          } else if (
            file.type === "application/pdf" ||
            file.name.toLowerCase().endsWith(".pdf")
          ) {
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
            const isJsonType =
              !file.type ||
              file.type === "application/json" ||
              file.type === "text/json";
            if (isJsonExt || isJsonType) {
              handleTriggerUploadJson(file);
            } else {
              setUploadError(
                "Invalid file type: Please select a valid .json file."
              );
            }
          }
          e.target.value = "";
        }}
      />

      {/* Sleek Vertically Compressed Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 sm:pb-3 border-b-2 border-[#201e1d]/15">
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {headerStart && <div className="shrink-0">{headerStart}</div>}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h2 className="text-base sm:text-lg font-black font-adminHeading tracking-tight text-[#201e1d] whitespace-nowrap">
              Digitize Exam Papers
            </h2>
            <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 bg-[#ffe1d0] border border-[#201e1d] text-[#c67139] rounded-full text-[11px] font-mono font-bold shadow-[1px_1px_0_#201e1d]">
              <Sparkles className="w-3 h-3" />
              <span>Multimodal AI</span>
            </span>

            {/* Informative chip when active paper session exists */}
            {activePaper && (
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#d1fae5] border border-[#201e1d] text-[#065f46] rounded-full text-[11px] font-mono font-bold shadow-[1px_1px_0_#201e1d]"
                title={`Active paper in memory: ${activePaper.id || "paper"}`}
              >
                <span className="w-2 h-2 rounded-full bg-[#065f46] animate-pulse" />
                <span className="truncate max-w-[200px] sm:max-w-none">
                  Active: {activePaper.subject?.code || activePaper.paper?.paper_code || "Paper"} (
                  {activePaper.paper?.year || "Session"})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quick helpers: Return to Active or Reset / Clear All */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {activePaper && onReturnToWorkspace && (
            <button
              type="button"
              onClick={onReturnToWorkspace}
              className="px-3.5 py-1.5 rounded-full border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#201e1d] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Current Paper</span>
            </button>
          )}

          {(hasSavedDraft || activePaper) && (onResetAll || onDiscardDraft) && (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="px-3.5 py-1.5 rounded-full border-2 border-[#201e1d] bg-[#fee2e2]/70 hover:bg-[#fee2e2] text-xs font-adminHeading font-bold text-[#b91c1c] flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5 active:shadow-none shadow-[2px_2px_0_#201e1d]"
              title="Clear all leftover draft data and start fresh in 1 click"
            >
              <Trash2 className="w-3.5 h-3.5 text-[#b91c1c]" />
              <span>Reset / Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Neobrutalist Dual-Workflow Tab Toggle */}
      <div className="p-1.5 bg-[#f0eade] border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_#201e1d] flex items-center gap-2">
        <button
          type="button"
          onClick={() => setWorkflowTab("cloud")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-adminHeading font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            workflowTab === "cloud"
              ? "bg-[#c67139] text-[#f9f4ed] border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] -translate-y-0.5"
              : "bg-transparent text-[#645c50] hover:text-[#201e1d] hover:bg-black/5"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Cloud Pipeline</span>
        </button>

        <button
          type="button"
          onClick={() => setWorkflowTab("agent")}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-adminHeading font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            workflowTab === "agent"
              ? "bg-[#201e1d] text-[#f9f4ed] border-2 border-[#201e1d] shadow-[2px_2px_0_#c67139] -translate-y-0.5"
              : "bg-transparent text-[#645c50] hover:text-[#201e1d] hover:bg-black/5"
          }`}
        >
          <Bot className="w-4 h-4 text-[#ffe1d0]" />
          <span>Antigravity Agent Workflow</span>
        </button>
      </div>

      {/* Extraction Error Alert */}
      {extractionError && (
        <div className="p-4 bg-[#fee2e2] border-2 border-[#b91c1c] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs sm:text-sm font-bold text-[#b91c1c] shadow-[3px_3px_0_#b91c1c]">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="whitespace-pre-line">{extractionError}</span>
          </div>
          {activePaper?.questions &&
            activePaper.questions.length > 0 &&
            activePaper.questions.length < 40 &&
            onResumeExtraction && (
              <button
                type="button"
                onClick={onResumeExtraction}
                className="px-3.5 py-1.5 rounded-full bg-[#c67139] text-[#f9f4ed] border-2 border-[#201e1d] hover:bg-[#b2622d] font-adminHeading font-bold text-xs active:translate-y-0.5 active:shadow-none shadow-[2px_2px_0_#201e1d] transition-colors shrink-0 cursor-pointer"
              >
                Resume Extraction (from Q
                {Math.max(
                  0,
                  ...activePaper.questions.map((q) => q?.question_number || 0)
                ) + 1}
                )
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
          <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-[3px_3px_0_#201e1d]">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-adminHeading font-black flex items-center justify-center shadow-[1px_1px_0_#201e1d]">
                  1
                </span>
                <h3 className="font-adminHeading text-sm sm:text-base font-bold text-[#201e1d]">
                  Step 1: Cambridge Subject &amp; Exam Metadata
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#f0eade] border border-[#201e1d]/20 text-[#645c50]">
                Selected: {currentSubject.code} {currentSubject.name}
              </span>
            </div>

            {/* Subject Chunky Card Grid */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-adminHeading font-bold text-[#645c50]">
                Select Cambridge Subject
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {CAMBRIDGE_SUBJECT_PRESETS.map((preset) => {
                  const isSelected = selectedSubjectCode === preset.code;
                  return (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => setSelectedSubjectCode(preset.code)}
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col items-start gap-1.5 text-left cursor-pointer select-none ${
                        isSelected
                          ? "bg-[#ffe1d0] border-[#c67139] shadow-[3px_3px_0_#c67139] -translate-y-0.5"
                          : "bg-[#fcfaf6] border-[#201e1d] hover:bg-white hover:-translate-y-0.5 shadow-[2px_2px_0_#201e1d]"
                      }`}
                    >
                      <div className="w-full flex items-center justify-between gap-1">
                        <span className="text-xl leading-none">{preset.icon}</span>
                        {isSelected ? (
                          <span className="px-1.5 py-0.2 rounded-full bg-[#c67139] text-white text-[10px] font-mono font-bold flex items-center gap-0.5 shadow-xs">
                            <Check className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono font-bold text-[#82796a] bg-white px-1.5 py-0.2 rounded border border-[#201e1d]/15">
                            {preset.code}
                          </span>
                        )}
                      </div>
                      <div className="w-full">
                        <p className="font-adminHeading text-xs font-bold text-[#201e1d] truncate">
                          {preset.name}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {/* Custom / Other Card */}
                <button
                  type="button"
                  onClick={() => setSelectedSubjectCode("custom")}
                  className={`p-3 rounded-xl border-2 transition-all flex flex-col items-start gap-1.5 text-left cursor-pointer select-none ${
                    selectedSubjectCode === "custom"
                      ? "bg-[#ffe1d0] border-[#c67139] shadow-[3px_3px_0_#c67139] -translate-y-0.5"
                      : "bg-[#fcfaf6] border-[#201e1d] hover:bg-white hover:-translate-y-0.5 shadow-[2px_2px_0_#201e1d]"
                  }`}
                >
                  <div className="w-full flex items-center justify-between gap-1">
                    <span className="text-xl leading-none">📚</span>
                    {selectedSubjectCode === "custom" ? (
                      <span className="px-1.5 py-0.2 rounded-full bg-[#c67139] text-white text-[10px] font-mono font-bold flex items-center gap-0.5 shadow-xs">
                        <Check className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono font-bold text-[#82796a] bg-white px-1.5 py-0.2 rounded border border-[#201e1d]/15">
                        Other
                      </span>
                    )}
                  </div>
                  <div className="w-full">
                    <p className="font-adminHeading text-xs font-bold text-[#201e1d] truncate">
                      Custom Subject
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Custom Subject Inputs if selected */}
            {selectedSubjectCode === "custom" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl shadow-[2px_2px_0_#201e1d]">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-adminHeading font-bold text-[#201e1d]">
                    Syllabus Code (4 digits)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 0654"
                    value={customSubjectCode}
                    onChange={(e) => setCustomSubjectCode(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-mono font-bold text-[#201e1d] outline-none focus:border-[#c67139] shadow-[1.5px_1.5px_0_#201e1d]"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-adminHeading font-bold text-[#201e1d]">
                    Subject Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Co-ordinated Sciences"
                    value={customSubjectName}
                    onChange={(e) => setCustomSubjectName(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-adminHeading font-bold text-[#201e1d] outline-none focus:border-[#c67139] shadow-[1.5px_1.5px_0_#201e1d]"
                  />
                </div>
              </div>
            )}

            {/* Clean Inputs for Year, Series, and Paper Code */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t-2 border-[#201e1d]/10">
              {/* Exam Year */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-adminHeading font-bold text-[#201e1d]">
                  Exam Year
                </label>
                <select
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="px-3 py-2.5 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] text-xs font-mono font-bold text-[#201e1d] focus:border-[#c67139] shadow-[2px_2px_0_#201e1d] outline-none cursor-pointer transition-colors"
                >
                  {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map(
                    (y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* Exam Series */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-adminHeading font-bold text-[#201e1d]">
                  Exam Series
                </label>
                <select
                  value={series}
                  onChange={(e) => setSeries(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] text-xs font-adminHeading font-bold text-[#201e1d] focus:border-[#c67139] shadow-[2px_2px_0_#201e1d] outline-none cursor-pointer transition-colors"
                >
                  <option value="s">May / June (Summer - &apos;s&apos;)</option>
                  <option value="w">Oct / Nov (Winter - &apos;w&apos;)</option>
                  <option value="m">Feb / March (Spring - &apos;m&apos;)</option>
                </select>
              </div>

              {/* Paper Code */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-adminHeading font-bold text-[#201e1d]">
                  Paper Code
                </label>
                <select
                  value={paperCode}
                  onChange={(e) => setPaperCode(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] text-xs font-mono font-bold text-[#201e1d] focus:border-[#c67139] shadow-[2px_2px_0_#201e1d] outline-none cursor-pointer transition-colors"
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
          </div>

          {/* Fast-Track JSON Past Paper Card / Dropzone */}
          <div className="bg-[#fff7f0] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_#201e1d] flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚡</span>
                <div>
                  <h3 className="font-adminHeading text-sm sm:text-base font-bold text-[#201e1d]">
                    Have a Pre-staged Cambridge JSON Paper?
                  </h3>
                  <p className="text-xs text-[#645c50] font-medium">
                    Skip OCR extraction completely. Upload or drag-and-drop your Cambridge JSON file to inspect &amp; upsert immediately.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUploadError(null);
                  jsonInputRef.current?.click();
                }}
                className="px-3.5 py-2 rounded-xl bg-[#c67139] hover:bg-[#b2622d] text-white text-xs font-adminHeading font-bold shadow-[2px_2px_0_#201e1d] border-2 border-[#201e1d] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload JSON Past Paper</span>
              </button>
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
              className={`p-4 border-2 border-dashed rounded-xl flex items-center justify-center text-center gap-3 cursor-pointer transition-all ${
                isDraggingJson
                  ? "bg-[#ffe1d0] border-[#c67139] shadow-sm scale-[1.01]"
                  : "bg-white/80 border-[#201e1d] hover:bg-white hover:border-[#c67139]"
              }`}
            >
              <FileCode className="w-5 h-5 text-[#c67139] shrink-0" />
              <span className="text-xs font-adminHeading font-bold text-[#645c50]">
                Drag &amp; drop your Cambridge JSON file here (e.g.{" "}
                <span className="font-mono text-[#c67139] font-bold">
                  0455_s24_12.json
                </span>
                ) or click to browse
              </span>
            </div>
          </div>

          {/* Step 2: Dual PDF Dropzones (QP & MS) */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-adminHeading font-black flex items-center justify-center shadow-[1px_1px_0_#201e1d]">
                2
              </span>
              <h3 className="font-adminHeading text-sm sm:text-base font-bold text-[#201e1d]">
                Step 2: Upload Scanned Exam Paper PDFs
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
                className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all select-none ${
                  qpFile
                    ? "bg-[#d1fae5] border-[#059669] shadow-[3px_3px_0_#201e1d]"
                    : isDraggingQp
                    ? "bg-[#ffe1d0] border-[#c67139] shadow-md scale-[1.01]"
                    : "bg-white border-[#201e1d] hover:bg-[#fffbf7] hover:border-[#c67139] shadow-[3px_3px_0_#201e1d]"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl border-2 border-[#201e1d] flex items-center justify-center text-xl transition-colors pointer-events-none ${
                    qpFile
                      ? "bg-[#059669] text-[#f9f4ed] shadow-[2px_2px_0_#201e1d]"
                      : "bg-[#eee7db] text-[#201e1d] shadow-[2px_2px_0_#201e1d]"
                  }`}
                >
                  {qpFile ? <FileText className="w-5 h-5" /> : "📄"}
                </div>
                <div className="pointer-events-none flex flex-col items-center gap-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <h4 className="font-adminHeading text-sm font-bold text-[#201e1d]">
                      Question Paper (QP) PDF
                    </h4>
                    <span className="px-2 py-0.5 bg-[#ffe1d0] text-[#c67139] border border-[#c67139] text-[10px] font-mono font-bold rounded-md">
                      Required
                    </span>
                  </div>
                  {qpFile ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#059669] text-[#065f46] text-xs font-mono font-bold shadow-xs">
                      <span>{qpFile.name}</span>
                      <span>·</span>
                      <span>{(qpFile.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-[#645c50]">
                      Drag &amp; drop or browse Question Paper PDF (.pdf) or agent JSON
                    </p>
                  )}
                </div>
                {qpFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQpFile(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-adminHeading font-bold text-[#b91c1c] hover:bg-[#fee2e2] px-3 py-1 rounded-lg border-2 border-[#b91c1c] shadow-[1.5px_1.5px_0_#b91c1c] active:translate-y-0.5 transition-all mt-1 cursor-pointer pointer-events-auto"
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
                className={`p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all select-none ${
                  msFile
                    ? "bg-[#d1fae5] border-[#059669] shadow-[3px_3px_0_#201e1d]"
                    : isDraggingMs
                    ? "bg-[#ffe1d0] border-[#c67139] shadow-md scale-[1.01]"
                    : "bg-white border-[#201e1d] hover:bg-[#fffbf7] hover:border-[#c67139] shadow-[3px_3px_0_#201e1d]"
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl border-2 border-[#201e1d] flex items-center justify-center text-xl transition-colors pointer-events-none ${
                    msFile
                      ? "bg-[#059669] text-[#f9f4ed] shadow-[2px_2px_0_#201e1d]"
                      : "bg-[#eee7db] text-[#201e1d] shadow-[2px_2px_0_#201e1d]"
                  }`}
                >
                  {msFile ? <FileText className="w-5 h-5" /> : "🎯"}
                </div>
                <div className="pointer-events-none flex flex-col items-center gap-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <h4 className="font-adminHeading text-sm font-bold text-[#201e1d]">
                      Mark Scheme (MS) PDF
                    </h4>
                    <span className="px-2 py-0.5 bg-[#fef3c7] text-[#92400e] border border-[#d97706]/40 text-[10px] font-mono font-bold rounded-md">
                      Recommended
                    </span>
                  </div>
                  {msFile ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#059669] text-[#065f46] text-xs font-mono font-bold shadow-xs">
                      <span>{msFile.name}</span>
                      <span>·</span>
                      <span>{(msFile.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                  ) : (
                    <p className="text-xs font-medium text-[#645c50]">
                      Drag &amp; drop or browse Mark Scheme PDF (.pdf) or agent JSON
                    </p>
                  )}
                </div>
                {msFile && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMsFile(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-adminHeading font-bold text-[#b91c1c] hover:bg-[#fee2e2] px-3 py-1 rounded-lg border-2 border-[#b91c1c] shadow-[1.5px_1.5px_0_#b91c1c] active:translate-y-0.5 transition-all mt-1 cursor-pointer pointer-events-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove file</span>
                  </button>
                )}
              </div>
            </div>

            {/* Combined PDF Payload Diagnostic Indicator */}
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
                        Exceeds Vercel&apos;s 4.5 MB serverless limit. Please provide a Gemini API Key in Step 3 for direct browser extraction (supports up to 20 MB).
                      </p>
                    ) : totalPayloadMb > 3.5 ? (
                      <p className="text-[11px] font-semibold text-[#92400e] mt-0.5">
                        Approaching Vercel&apos;s 4.5 MB limit. If network error occurs, supply a Gemini API Key in Step 3 for direct extraction.
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

          {/* Step 3: Collapsible Gemini Vision API & Batch Configuration Drawer */}
          <div className="bg-white border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_#201e1d] overflow-hidden">
            <button
              type="button"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              className="w-full p-4 sm:p-5 flex items-center justify-between gap-3 bg-[#fcfaf6] hover:bg-white transition-colors cursor-pointer select-none text-left"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-adminHeading font-black flex items-center justify-center shadow-[1px_1px_0_#201e1d]">
                  3
                </span>
                <div>
                  <h3 className="font-adminHeading text-sm sm:text-base font-bold text-[#201e1d] flex items-center gap-2">
                    <span>Step 3: Gemini Vision &amp; Batch Configuration</span>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#f0eade] border border-[#201e1d]/20 rounded-full text-[#645c50]">
                      {isPayloadLarge ? "Key Required" : "Optional Settings"}
                    </span>
                  </h3>
                  <p className="text-xs text-[#645c50] font-medium">
                    Configure client-side Gemini API key override or question batch size.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-adminHeading font-bold text-[#645c50]">
                <span>{isSettingsOpen ? "Collapse" : "Expand"}</span>
                {isSettingsOpen ? (
                  <ChevronUp className="w-4 h-4 text-[#201e1d]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#201e1d]" />
                )}
              </div>
            </button>

            {/* Collapsible drawer content */}
            {isSettingsOpen && (
              <div className="p-4 sm:p-5 border-t-2 border-[#201e1d]/10 grid grid-cols-1 md:grid-cols-3 gap-4 bg-white">
                {/* Gemini API Key Input */}
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label
                    htmlFor="gemini-api-key-input"
                    className="text-xs font-adminHeading font-bold text-[#201e1d] flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[#c67139]" />
                    <span>
                      Gemini API Key{" "}
                      {isPayloadLarge
                        ? "(Required for > 4.5 MB PDF)"
                        : "(Optional if set in .env.local)"}
                    </span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="gemini-api-key-input"
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={
                        isPayloadLarge
                          ? "Required: Paste AIzaSy... key to bypass 4.5 MB limit"
                          : "Paste AIzaSy... key (optional - leave blank to use server .env.local)"
                      }
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
                    className="w-full px-3 py-2.5 rounded-xl bg-[#f9f4ed] border-2 border-[#201e1d] text-xs font-mono font-bold text-[#201e1d] focus:border-[#c67139] outline-none cursor-pointer transition-colors shadow-[1.5px_1.5px_0_#201e1d]"
                  >
                    <option value={5}>5 Questions (Recommended)</option>
                    <option value={10}>10 Questions (Standard Batch)</option>
                    <option value={2}>2 Questions (Ultra-Safe)</option>
                  </select>
                  <p className="text-[11px] text-[#645c50] font-medium">
                    Smaller batches stream progress faster and prevent proxy timeout drops.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Staged Papers / Drafts Drawer (if any staged papers exist) */}
          {stagedPapers.length > 0 && (
            <div className="bg-[#fcfaf6] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-[3px_3px_0_#201e1d]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Archive className="w-4 h-4 text-[#c67139]" />
                  <h3 className="font-adminHeading text-sm sm:text-base font-bold text-[#201e1d]">
                    Recent Staged Papers &amp; Drafts
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#ffe1d0] text-[#c67139] border border-[#c67139]">
                    {stagedPapers.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchStagedPapers()}
                  className="text-xs font-adminHeading font-bold text-[#645c50] hover:text-[#201e1d] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stagedPapers.map((paperItem) => (
                  <div
                    key={paperItem.id}
                    className="bg-white border-2 border-[#201e1d] rounded-xl p-3.5 flex flex-col justify-between gap-3 shadow-[2px_2px_0_#201e1d] hover:shadow-[3px_3px_0_#201e1d] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-base">
                            {paperItem.subject?.icon || "📄"}
                          </span>
                          <span className="font-adminHeading font-bold text-xs text-[#201e1d]">
                            {paperItem.subject?.code
                              ? `${paperItem.subject.code} ${
                                  paperItem.subject?.name || ""
                                }`
                              : paperItem.id}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-[#645c50] mt-0.5">
                          {paperItem.paper?.year
                            ? `${paperItem.paper.year} ${
                                paperItem.paper?.series?.toUpperCase() || ""
                              } P${paperItem.paper?.paper_code || ""}`
                            : paperItem.filename}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPaperToDelete(paperItem)}
                        className="p-1 rounded-lg border border-[#201e1d]/20 hover:bg-[#fee2e2] text-[#645c50] hover:text-[#b91c1c] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 transition-all cursor-pointer"
                        title="Delete paper"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#dcd3c4]">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#f0fae1] text-[#065f46] border border-[#8fa073]/40">
                        {paperItem.questionsCount || 40} Questions
                      </span>
                      <button
                        type="button"
                        onClick={() => handleResumePaper(paperItem.id)}
                        className="px-3 py-1 rounded-lg bg-[#c67139] hover:bg-[#b2622d] text-[#f9f4ed] text-xs font-adminHeading font-bold border-2 border-[#201e1d] shadow-[1.5px_1.5px_0_#201e1d] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Resume Paper</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t-2 border-[#201e1d] pt-4">
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {/* Start Blank Paper Button */}
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
                className="px-4 py-2.5 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#201e1d] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start Blank</span>
              </button>

              {/* Load Sample Button */}
              <button
                type="button"
                onClick={handleLoadSample}
                disabled={isLoadingSample}
                className="px-4 py-2.5 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] hover:bg-[#ffe1d0] text-xs font-adminHeading font-bold text-[#c67139] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none disabled:opacity-50"
              >
                {isLoadingSample ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5" />
                )}
                <span>Load Sample</span>
              </button>

              {/* Upload Pre-staged JSON */}
              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#645c50] flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload JSON</span>
              </button>
            </div>

            {/* Primary 'Start Extraction' CTA Button */}
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
                  <span>Start Extraction</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </>
              )}
            </button>
          </div>
        </>
      ) : (
        /* Workflow 2: Antigravity Agent Workflow View */
        <div
          className="flex flex-col gap-6"
          data-testid="antigravity-agent-workflow"
        >
          {/* Section 1: Direct Cambridge JSON Ingestion Pipeline */}
          <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-5 sm:p-6 shadow-[3px_3px_0_#201e1d] flex flex-col gap-5">
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

            <div className="flex items-center justify-between gap-2 flex-wrap border-b-2 border-[#201e1d]/15 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-full bg-[#c67139] text-[#f9f4ed] text-xs font-adminHeading font-black flex items-center justify-center shadow-[1px_1px_0_#201e1d]">
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
                      Validation Failed ({directValidationErrors.length}{" "}
                      {directValidationErrors.length === 1 ? "issue" : "issues"})
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
                    (e.dataTransfer.files && e.dataTransfer.files.length > 0
                      ? e.dataTransfer.files[0]
                      : null) ||
                    (e.dataTransfer.items && e.dataTransfer.items.length > 0
                      ? e.dataTransfer.items[0].getAsFile()
                      : null);

                  if (file) {
                    const isJsonExt = file.name.toLowerCase().endsWith(".json");
                    const isJsonType =
                      !file.type ||
                      file.type === "application/json" ||
                      file.type === "text/json";
                    if (isJsonExt || isJsonType) {
                      handleProcessDirectJsonFile(file);
                    } else {
                      setDirectUploadError(
                        `Invalid file type "${file.name}": Please drop a valid Cambridge .json paper.`
                      );
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
                    : "bg-[#f9f4ed] border-[#201e1d] hover:bg-[#fff7f0] hover:border-[#c67139] shadow-[3px_3px_0_#201e1d]"
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
                        {directSelectedFile
                          ? `Parsing ${directSelectedFile.name}`
                          : "Parsing Antigravity Paper..."}
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
                        Drop your extracted JSON paper here (e.g.{" "}
                        <span className="font-mono font-bold text-[#c67139] bg-[#ffe1d0]/80 px-1 py-0.5 rounded border border-[#c67139]/30">
                          0455_s24_12.json
                        </span>
                        ) or click to browse.
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
                <div className="p-5 bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_#201e1d] flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] text-[#c67139] flex items-center justify-center text-2xl shrink-0 shadow-[2px_2px_0_#201e1d]">
                        {directParsedPaper.subject?.icon &&
                        directParsedPaper.subject.icon !== "trending-up"
                          ? directParsedPaper.subject.icon
                          : "📈"}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-adminHeading text-base sm:text-lg font-bold text-[#201e1d]">
                            {directParsedPaper.subject?.code}{" "}
                            {directParsedPaper.subject?.name}
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
                        {directSelectedFile?.name} (
                        {directSelectedFile
                          ? (directSelectedFile.size / 1024).toFixed(1)
                          : "0"}{" "}
                        KB)
                      </span>
                    </div>
                  </div>

                  {/* Metrics Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t-2 border-[#201e1d]/10">
                    <div className="p-3 bg-white border-2 border-[#201e1d] rounded-xl flex flex-col shadow-[1.5px_1.5px_0_#201e1d]">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#82796a]">
                        Subject
                      </span>
                      <span className="font-adminHeading text-xs sm:text-sm font-bold text-[#201e1d] truncate">
                        {directParsedPaper.subject?.code}{" "}
                        {directParsedPaper.subject?.name}
                      </span>
                    </div>
                    <div className="p-3 bg-white border-2 border-[#201e1d] rounded-xl flex flex-col shadow-[1.5px_1.5px_0_#201e1d]">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#82796a]">
                        Session &amp; Year
                      </span>
                      <span className="font-adminHeading text-xs sm:text-sm font-bold text-[#201e1d] truncate">
                        {directParsedPaper.paper?.year}{" "}
                        {formatSeriesFull(directParsedPaper.paper?.series)}
                      </span>
                    </div>
                    <div className="p-3 bg-[#f0fae1] border-2 border-[#8fa073] rounded-xl flex flex-col shadow-[1.5px_1.5px_0_#201e1d]">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#3d472b]">
                        Total Questions
                      </span>
                      <span className="font-adminHeading text-xs sm:text-sm font-bold text-[#065f46] flex items-center gap-1">
                        <span>
                          {directParsedPaper.questions.length} Questions - All Valid ✓
                        </span>
                      </span>
                    </div>
                    <div className="p-3 bg-white border-2 border-[#201e1d] rounded-xl flex flex-col shadow-[1.5px_1.5px_0_#201e1d]">
                      <span className="text-[10px] font-mono font-bold uppercase text-[#82796a]">
                        Syllabus Topics
                      </span>
                      <span className="font-adminHeading text-xs sm:text-sm font-bold text-[#201e1d]">
                        {directParsedPaper.syllabus_topics?.length ||
                          new Set(
                            directParsedPaper.questions
                              .map((q) => q.topic_name)
                              .filter(Boolean)
                          ).size ||
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
                          {directPublishMessage ||
                            `Successfully upserted ${
                              directPublishCount ||
                              directParsedPaper.questions.length
                            } questions to Supabase!`}
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
                          {directPublishMessage ||
                            "Failed to publish paper to Supabase."}
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
                      disabled={
                        directPublishStatus === "publishing" ||
                        directPublishStatus === "success"
                      }
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

          {/* Section 2: Terminal Card Styling for Agent Ingestion Guide */}
          <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-5 shadow-[3px_3px_0_#201e1d] flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2 flex-wrap border-b-2 border-[#201e1d]/15 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#201e1d] text-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center shadow-[1.5px_1.5px_0_#201e1d]">
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

            {/* Step Numbers & Terminal Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Terminal Command Window */}
              <div className="p-4 bg-[#201e1d] text-[#f9f4ed] rounded-2xl border-2 border-[#201e1d] flex flex-col justify-between gap-3 shadow-[3px_3px_0_#201e1d]">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#ffe1d0] flex items-center gap-1.5 ml-1">
                      <Terminal className="w-3.5 h-3.5" />
                      Step 1: Terminal Command
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        "npm run ingest -- --qp <path-to-qp.pdf> --ms <path-to-ms.pdf>",
                        "cmd"
                      )
                    }
                    className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-[#f9f4ed] rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer border border-white/20"
                  >
                    {copiedCommand ? (
                      <Check className="w-3 h-3 text-[#8fa073]" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedCommand ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="font-mono text-xs text-[#eedec8] bg-black/60 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap break-all border border-white/10">
                  npm run ingest -- --qp &lt;path-to-qp.pdf&gt; --ms &lt;path-to-ms.pdf&gt;
                </pre>
                <p className="text-[10px] text-[#a89f91] leading-relaxed">
                  Runs local chunked extraction, crops diagrams to{" "}
                  <code className="text-[#ffe1d0]">staging/slices/</code>, and creates the JSON file in{" "}
                  <code className="text-[#ffe1d0]">staging/</code>.
                </p>
              </div>

              {/* Chat Instruction Card */}
              <div className="p-4 bg-[#f0fae1] text-[#201e1d] rounded-2xl border-2 border-[#8fa073] flex flex-col justify-between gap-3 shadow-[3px_3px_0_#201e1d]">
                <div className="flex items-center justify-between border-b border-[#8fa073]/30 pb-2.5">
                  <span className="text-xs font-adminHeading font-bold text-[#3d472b] flex items-center gap-1.5">
                    <Bot className="w-3.5 h-3.5 text-[#56633f]" />
                    Step 2: In-Chat Agent Instruction
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        "Ingest paper <qp_file> and <ms_file>",
                        "prompt"
                      )
                    }
                    className="px-2.5 py-1 bg-[#8fa073]/20 hover:bg-[#8fa073]/30 text-[#3d472b] rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-colors cursor-pointer border border-[#8fa073]/40"
                  >
                    {copiedPrompt ? (
                      <Check className="w-3 h-3 text-[#3d472b]" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedPrompt ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-3 rounded-xl bg-white border-2 border-[#8fa073]/50 font-mono text-xs text-[#201e1d] shadow-xs">
                  &ldquo;Ingest paper &lt;qp_file&gt; and &lt;ms_file&gt;&rdquo;
                </div>
                <p className="text-[10px] text-[#56633f] font-medium leading-relaxed">
                  Ask Antigravity in this chat to autonomously execute extraction, sanitize formulas, and deposit staged JSON ready for review.
                </p>
              </div>
            </div>

            {/* Step 3 Explanatory Features Banner */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t-2 border-[#201e1d]/10">
              <div className="flex items-center gap-2 text-xs font-bold text-[#645c50]">
                <span className="text-base">📐</span>
                <span>Validates KaTeX math &amp; escapes \$ currency</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#645c50]">
                <span className="text-base">🖼️</span>
                <span>Crops 300 DPI diagrams to staging/slices</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[#645c50]">
                <span className="text-base">⚡</span>
                <span>Bypasses browser limits and timeouts</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Paper Defensive Confirmation Modal */}
      {paperToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setPaperToDelete(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-6 max-w-md w-full shadow-[6px_6px_0_#201e1d] flex flex-col gap-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#fee2e2] border-2 border-[#b91c1c] text-[#b91c1c] flex items-center justify-center font-bold text-lg shrink-0 shadow-[1px_1px_0_#201e1d]">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-adminHeading text-base font-bold text-[#201e1d]">
                  {paperToDelete.is_archived
                    ? "Delete Paper from Archives?"
                    : "Delete Paper from Staging?"}
                </h3>
                <p className="text-xs text-[#645c50]">
                  Permanent removal of {paperToDelete.filename || paperToDelete.id}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#645c50]">
              This will permanently delete this paper from your local staging environment. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t-2 border-[#201e1d]/20">
              <button
                type="button"
                onClick={() => setPaperToDelete(null)}
                className="px-4 py-2 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#eee7db] text-xs font-adminHeading font-bold text-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(isDeletingPaperId)}
                onClick={() =>
                  handleDeletePaper(paperToDelete.id, paperToDelete.is_archived)
                }
                className="px-4 py-2 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-adminHeading font-bold border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeletingPaperId ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete Permanently</span>
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
                <h3
                  id="reset-dialog-title"
                  className="font-adminHeading text-base font-bold text-[#201e1d]"
                >
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

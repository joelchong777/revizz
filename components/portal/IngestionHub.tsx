"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useIngestionStore } from "@/lib/ingestion/useIngestionStore";
import IngestionHeader from "./IngestionHeader";
import IngestionStudioFrame from "./IngestionStudioFrame";
import IngestionWorkspace from "./IngestionWorkspace";
import { IngestionSettingsModal, IngestionPayloadModal } from "./IngestionModals";
import IngestionPipelineModal from "./IngestionPipelineModal";
import IngestionMarkSchemeModal from "./IngestionMarkSchemeModal";
import IngestionPreviewModal from "./IngestionPreviewModal";
import IngestionAuditDrawer from "./IngestionAuditDrawer";
import type { MarkSchemeVerificationReport } from "@/lib/ingestion/markSchemeChecker";
import type { StagingPaper, StagingQuestion } from "@/types/ingestion";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  History,
  Activity,
  RotateCcw,
} from "lucide-react";

import IngestionSetupWizard from "./IngestionSetupWizard";
import dynamic from "next/dynamic";

const IngestionHistoryHub = dynamic(() => import("@/components/admin/IngestionHistoryHub"), {
  ssr: false,
  loading: () => (
    <div className="py-10 text-center text-xs font-mono font-bold text-[#645c50]">Loading history…</div>
  ),
});

const IngestionDiagnosticsLab = dynamic(() => import("@/components/admin/IngestionDiagnosticsLab"), {
  ssr: false,
  loading: () => (
    <div className="py-10 text-center text-xs font-mono font-bold text-[#645c50]">Loading diagnostics…</div>
  ),
});

export type StudioSetupView = "new" | "history" | "diagnostics";

export interface IngestionHubProps {
  initialView?: StudioSetupView;
  onViewChange?: (view: StudioSetupView) => void;
  onOpenEditor?: (questionId: string) => void;
}

const STUDIO_TABS: { id: StudioSetupView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "new", label: "New paper", icon: Sparkles },
  { id: "history", label: "History", icon: History },
  { id: "diagnostics", label: "Diagnostics", icon: Activity },
];

export default function IngestionHub({
  initialView = "new",
  onViewChange,
  onOpenEditor,
}: IngestionHubProps = {}) {
  const {
    paper,
    selectedIdx,
    showLivePreview,
    setShowLivePreview,
    isSettingsModalOpen,
    isPayloadModalOpen,
    setIsPayloadModalOpen,
    isAuditDrawerOpen,
    setIsAuditDrawerOpen,
    publishStatus,
    publishMessage,
    selectedQuestion,
    isExtracting,
    extractionProgress,
    error: extractionError,
    qpPdfUrl,
    totalPdfPages,
    activePdfPage,
    showPdfViewer,
    lifecycleState,
    isPipelineModalOpen,
    setIsPipelineModalOpen,
    pipelineStep,
    setPipelineStep,
    lastPublishReceipt,
    canUndo,
    canRedo,
    loadJson,
    updatePaperMetadata,
    setSelectedIdx,
    addQuestion,
    deleteQuestion,
    duplicateQuestion,
    moveQuestion,
    updateQuestion,
    setCorrectOption,
    publishToSupabase,
    archiveStagedPaper,
    deleteStagedPaper,
    setIsSettingsModalOpen,
    setPublishStatus,
    setPublishMessage,
    clearDraft,
    setShowPdfViewer,
    setActivePdfPage,
    startExtraction,
    resumeExtraction,
    cancelExtraction,
    undo,
    redo,
    setPaper,
    setError,
    resetStore,
  } = useIngestionStore();

  // Local switch to toggle setup wizard screen even when paper is active
  const [isSetupOpen, setIsSetupOpen] = useState(initialView === "history" || initialView === "diagnostics");
  const [setupView, setSetupView] = useState<StudioSetupView>(initialView);
  const tabRefs = useRef<Record<StudioSetupView, HTMLButtonElement | null>>({ new: null, history: null, diagnostics: null });

  // URL-driven view changes
  useEffect(() => {
    setSetupView(initialView);
    if (initialView === "history" || initialView === "diagnostics") setIsSetupOpen(true);
  }, [initialView]);

  // Warm the History and Diagnostics chunks after first paint so switching tabs never shows the bare placeholder
  useEffect(() => {
    const t = setTimeout(() => {
      void import("@/components/admin/IngestionHistoryHub");
      void import("@/components/admin/IngestionDiagnosticsLab");
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  const pendingTabFocus = useRef<StudioSetupView | null>(null);
  // The tablist re-mounts when the view changes; restore focus after keyboard switches
  useEffect(() => {
    if (pendingTabFocus.current) {
      tabRefs.current[pendingTabFocus.current]?.focus();
      pendingTabFocus.current = null;
    }
  }, [setupView]);

  const changeSetupView = (v: StudioSetupView) => {
    setSetupView(v);
    onViewChange?.(v);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = STUDIO_TABS[(idx + (e.key === "ArrowRight" ? 1 : STUDIO_TABS.length - 1)) % STUDIO_TABS.length];
    pendingTabFocus.current = next.id;
    changeSetupView(next.id);
  };
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isMarkSchemeModalOpen, setIsMarkSchemeModalOpen] = useState(false);
  const [markSchemeReport, setMarkSchemeReport] = useState<MarkSchemeVerificationReport | null>(null);

  const questions = paper?.questions || [];
  const currentQuestion: StagingQuestion | null =
    selectedQuestion || questions[selectedIdx] || null;

  // Handler for uploading JSON file via Wizard
  const handleFileUpload = (file: File) => {
    setIsReadingFile(true);
    setPublishStatus("idle");
    setPublishMessage(`Reading and parsing "${file.name}"...`);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || !text.trim()) {
          setPublishStatus("error");
          setPublishMessage(`Upload error: "${file.name}" is an empty file.`);
          setIsReadingFile(false);
          return;
        }

        const json = JSON.parse(text);
        const res = loadJson(json, { name: file.name, size: file.size });
        if (res.success) {
          setIsSetupOpen(false);
          setIsPipelineModalOpen(true);
          setPipelineStep("preview");
          const qCount = Array.isArray(json)
            ? json.length
            : (json?.questions?.length || json?.paper?.questions?.length || "all");
          setPublishMessage(`Loaded "${file.name}" successfully (${qCount} questions).`);
        } else {
          setPublishStatus("error");
          setPublishMessage(
            `Validation failed for "${file.name}":\n${(res.errors || []).join("\n")}`
          );
        }
      } catch (err: any) {
        console.error("Failed to parse uploaded JSON file", err);
        setPublishStatus("error");
        setPublishMessage(`Invalid JSON in "${file.name}": ${err?.message || "Syntax error"}`);
      } finally {
        setIsReadingFile(false);
      }
    };
    reader.onerror = (err) => {
      console.error("FileReader error while reading JSON file", err);
      setPublishStatus("error");
      setPublishMessage(`Failed to read file "${file.name}".`);
      setIsReadingFile(false);
    };
    reader.onabort = () => {
      console.warn("FileReader read aborted for", file.name);
      setIsReadingFile(false);
    };
    reader.readAsText(file);
  };

  // Primary Upsert with client-side validation check
  const handleUpsertToSupabase = async () => {
    if (!paper || !paper.questions || paper.questions.length === 0) {
      setPublishStatus("error");
      setPublishMessage("No questions in paper to upsert.");
      return;
    }

    // Client-side verification pass: locate first broken question
    let firstBrokenIdx = -1;
    let firstBrokenReason = "";

    for (let i = 0; i < paper.questions.length; i++) {
      const q = paper.questions[i];
      if (q.status === "withdrawn") continue;

      const stem = (q.stem_markdown || "").trim();
      if (!stem) {
        firstBrokenIdx = i;
        firstBrokenReason = `Question ${q.question_number || i + 1} stem text is empty.`;
        break;
      }

      if (!Array.isArray(q.options) || q.options.length !== 4) {
        firstBrokenIdx = i;
        firstBrokenReason = `Question ${q.question_number || i + 1} requires 4 options (found ${q.options?.length || 0}).`;
        break;
      }

      const correctCount = q.options.filter((o) => o.is_correct).length;
      if (correctCount === 0) {
        firstBrokenIdx = i;
        firstBrokenReason = `Question ${q.question_number || i + 1} has no correct answer marked.`;
        break;
      }
      if (correctCount > 1) {
        firstBrokenIdx = i;
        firstBrokenReason = `Question ${q.question_number || i + 1} has multiple answers marked correct (${correctCount}).`;
        break;
      }

      const emptyOpts = q.options.filter((o) => !(o.content_markdown || "").trim());
      if (emptyOpts.length > 0) {
        firstBrokenIdx = i;
        firstBrokenReason = `Question ${q.question_number || i + 1} has ${emptyOpts.length} blank option(s).`;
        break;
      }
    }

    if (firstBrokenIdx !== -1) {
      setSelectedIdx(firstBrokenIdx);
      setPublishStatus("error");
      setPublishMessage(`Cannot upsert - ${firstBrokenReason} Jumped to Question ${firstBrokenIdx + 1} to fix.`);
      return;
    }

    // Open pipeline modal and trigger upsert
    setIsPipelineModalOpen(true);
    await publishToSupabase();
  };

  // Start AI extraction and apply selected metadata
  const handleStartExtraction = async (params: {
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
  }) => {
    setIsSetupOpen(false);
    await startExtraction({
      qpFile: params.qpFile,
      msFile: params.msFile || undefined,
      apiKey: params.apiKey,
      batchSize: params.batchSize,
    });
    // Update metadata if specified
    if (params.subjectCode) {
      updatePaperMetadata({
        subject: {
          code: params.subjectCode,
          name: params.subjectName,
          icon: params.subjectIcon,
        },
        paper: {
          series: params.series,
          paper_code: params.paperCode,
          year: params.year,
        },
      });
    }
  };

  // Reset all session drafts and return to clean setup slate
  const handleResetAll = () => {
    clearDraft();
    resetStore();
    setIsSetupOpen(true);
  };

  // Start blank paper with selected metadata
  const handleStartBlank = (meta: {
    subjectCode: string;
    subjectName: string;
    subjectIcon: string;
    year: number;
    series: string;
    paperCode: string;
  }) => {
    const blankQuestion: StagingQuestion = {
      question_number: 1,
      cambridge_source_ref: `${meta.subjectCode}/${meta.paperCode}/${meta.series.toUpperCase()}/${String(meta.year).slice(-2)} Q1`,
      topic_name: "General",
      stem_markdown: "Enter your question stem here...",
      options: [
        { label: "A", content_markdown: "Option A", is_correct: true },
        { label: "B", content_markdown: "Option B", is_correct: false },
        { label: "C", content_markdown: "Option C", is_correct: false },
        { label: "D", content_markdown: "Option D", is_correct: false },
      ],
      explanation_markdown: "Step-by-step derivation or official mark scheme guidance.",
      status: "active",
    };

    setPaper({
      id: `${meta.subjectCode}_${meta.series}${String(meta.year).slice(-2)}_${meta.paperCode}`,
      lifecycle_state: "draft",
      state: "draft",
      subject: {
        code: meta.subjectCode,
        name: meta.subjectName,
        icon: meta.subjectIcon,
      },
      paper: {
        series: meta.series,
        paper_code: meta.paperCode,
        year: meta.year,
      },
      syllabus_topics: [{ name: "General", order_index: 1 }],
      questions: [blankQuestion],
    });

    setSelectedIdx(0);
    setIsSetupOpen(false);
  };

  // Studio mode management: 'setup' | 'workspace'
  // Mode starts purely in 'setup' when paper is null or has no questions loaded
  const studioTabs = (
    <div
      role="tablist"
      aria-label="Ingestion Studio"
      className="inline-flex items-center gap-1.5 p-1 bg-[#fbf7ee] border-2 border-[#201e1d] rounded-xl shadow-[2px_2px_0_#201e1d]"
    >
      {STUDIO_TABS.map((t, idx) => {
        const selected = setupView === t.id;
        const IconComponent = t.icon;
        return (
          <button
            key={t.id}
            ref={(el) => { tabRefs.current[t.id] = el; }}
            type="button"
            role="tab"
            id={`studio-tab-${t.id}`}
            data-testid={`studio-tab-${t.id}`}
            aria-selected={selected}
            aria-controls="studio-tabpanel"
            tabIndex={selected ? 0 : -1}
            onClick={() => changeSetupView(t.id)}
            onKeyDown={(e) => handleTabKeyDown(e, idx)}
            className={`px-3 py-1 rounded-lg text-xs font-adminHeading font-bold flex items-center gap-1.5 transition-all cursor-pointer relative ${
              selected
                ? "bg-white text-[#201e1d] border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5"
                : "text-[#645c50] hover:text-[#201e1d] hover:bg-[#eee7db] border-2 border-transparent"
            }`}
          >
            <IconComponent className={`w-3.5 h-3.5 ${selected ? "text-[#c67139]" : "text-[#82796a]"}`} />
            <span>{t.label}</span>
            {selected && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#c67139] inline-block ml-0.5" />
            )}
          </button>
        );
      })}
    </div>
  );

  const mode: "setup" | "workspace" =
    !paper || !paper.questions || paper.questions.length === 0 || isSetupOpen
      ? "setup"
      : "workspace";

  return (
    <div className="w-full font-body relative overflow-x-hidden">
      <IngestionStudioFrame
        mode={mode}
        header={
          mode === "workspace" ? (
            <IngestionHeader
              mode={mode}
              paper={paper}
              onOpenSettings={() => setIsSettingsModalOpen(true)}
              onPublish={handleUpsertToSupabase}
              publishStatus={publishStatus}
              publishMessage={publishMessage}
              lifecycleState={lifecycleState}
              showPdfViewer={showPdfViewer}
              onTogglePdfViewer={() => setShowPdfViewer((prev) => !prev)}
              showLivePreview={showLivePreview}
              onTogglePreview={() => setShowLivePreview((prev) => !prev)}
              onOpenAudit={() => setIsAuditDrawerOpen(true)}
              onOpenPayloads={() => setIsPayloadModalOpen(true)}
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              onSwitchPaper={() => setIsSetupOpen(true)}
              onReturnToStudio={() => setIsSetupOpen(false)}
              onArchiveStagedPaper={archiveStagedPaper}
              onDeleteStagedPaper={deleteStagedPaper}
              onOpenMarkSchemeModal={() => setIsMarkSchemeModalOpen(true)}
              markSchemeStatus={markSchemeReport?.status || "unverified"}
              activePdfPage={activePdfPage}
            />
          ) : null
        }
        progressShelf={
          isExtracting ? (
            (() => {
              const isRetrying = extractionProgress.stage === "retrying";
              return (
                <div
                  className={`p-3.5 sm:p-4.5 border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_#201e1d] flex flex-col md:flex-row items-center justify-between gap-4 font-body transition-all duration-300 ${
                    isRetrying
                      ? "bg-[#fffbeb] text-[#78350f]"
                      : "bg-[#f0f4ff] text-[#1e1b4b]"
                  }`}
                >
                  <div className="flex items-center gap-3.5 w-full md:w-auto">
                    <div
                      className={`w-11 h-11 rounded-xl text-white flex items-center justify-center shrink-0 border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] ${
                        isRetrying ? "bg-[#d97706]" : "bg-[#4f46e5]"
                      }`}
                    >
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[11px] font-mono font-black uppercase tracking-wider flex items-center gap-1.5 ${
                            isRetrying ? "text-[#b45309]" : "text-[#4f46e5]"
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping inline-block" />
                          {isRetrying
                            ? "API Capacity Spike (Auto-Retrying)"
                            : "Cambridge Digitizing Console"}
                        </span>
                        <span className="px-2 py-0.5 bg-white border-2 border-[#201e1d] rounded-full text-[11px] font-mono font-black shadow-[1.5px_1.5px_0_#201e1d] text-[#201e1d]">
                          {extractionProgress.percent}%
                        </span>
                      </div>
                      <h4 className="font-adminHeading text-sm sm:text-base font-bold text-[#201e1d] truncate mt-0.5">
                        {extractionProgress.currentBatch || "Streaming Cambridge questions..."}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <div className="flex-1 md:w-56 bg-white border-2 border-[#201e1d] rounded-full h-4 overflow-hidden p-0.5 shadow-inner">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isRetrying
                            ? "bg-gradient-to-r from-[#d97706] to-[#f59e0b]"
                            : "bg-gradient-to-r from-[#4f46e5] to-[#c67139]"
                        }`}
                        style={{ width: `${Math.max(extractionProgress.percent, 3)}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={cancelExtraction}
                      className="px-3.5 py-1.5 bg-white hover:bg-[#fee2e2] border-2 border-[#201e1d] rounded-full text-xs font-adminHeading font-bold text-[#b91c1c] active:translate-y-0.5 active:shadow-none cursor-pointer shadow-[2px_2px_0_#201e1d] transition-colors flex items-center gap-1 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              );
            })()
          ) : null
        }
        statusShelf={
          <AnimatePresence>
            {extractionError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "tween", duration: 0.2 }}
                className="py-3 px-4 border-2 border-[#b91c1c] rounded-2xl font-body font-semibold text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[3px_3px_0_#201e1d] bg-[#fff5f5] text-[#b91c1c]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-[#fee2e2] border border-[#b91c1c] flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4 text-[#b91c1c]" />
                  </div>
                  <span className="whitespace-pre-line text-[#991b1b] font-medium leading-relaxed">{extractionError}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {questions.length > 0 && questions.length < 40 && (
                    <button
                      type="button"
                      onClick={() => resumeExtraction()}
                      className="px-3.5 py-1.5 rounded-full bg-[#c67139] hover:bg-[#b2622d] text-[#f9f4ed] border-2 border-[#201e1d] font-adminHeading font-bold text-xs active:translate-y-0.5 active:shadow-none shadow-[2px_2px_0_#201e1d] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Resume Extraction (from Q{Math.max(...questions.map((q) => q.question_number || 0)) + 1})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="p-1 rounded-full border border-[#b91c1c] hover:bg-[#fee2e2] transition-colors cursor-pointer text-[#b91c1c]"
                    title="Dismiss error"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            )}
            {publishStatus !== "idle" && publishMessage && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ type: "tween", duration: 0.2 }}
                className={`py-2 px-3.5 border-2 border-[#201e1d] rounded-full font-body font-semibold text-xs flex items-center justify-between gap-3 shadow-[2px_2px_0_#201e1d] self-start max-w-full ${
                  publishStatus === "validating" || publishStatus === "publishing"
                    ? "bg-[#ffe1d0] text-[#c67139]"
                    : publishStatus === "success"
                    ? "bg-[#d1fae5] text-[#065f46]"
                    : "bg-[#fee2e2] text-[#b91c1c]"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {publishStatus === "validating" || publishStatus === "publishing" ? (
                    <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
                  ) : publishStatus === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-[#065f46] shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#b91c1c] shrink-0" />
                  )}
                  <span className="truncate">{publishMessage}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {publishStatus === "success" && (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          window.location.href = "/admin?tab=bank";
                        }
                      }}
                      className="px-3 py-1 rounded-full bg-[#065f46] hover:bg-[#044e39] text-[#f9f4ed] border-2 border-[#201e1d] font-adminHeading font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-[1.5px_1.5px_0_#201e1d] active:translate-y-0.5 active:shadow-none"
                    >
                      <span>View in Question Bank →</span>
                    </button>
                  )}
                  {publishStatus !== "publishing" && publishStatus !== "validating" && (
                    <button
                      type="button"
                      onClick={() => setPublishStatus("idle")}
                      className="p-0.5 rounded-full hover:bg-black/10 transition-colors cursor-pointer shrink-0"
                      title="Dismiss notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        }
      >
        {mode === "setup" ? (
          <div>
            <div role="tabpanel" id="studio-tabpanel" aria-labelledby={`studio-tab-${setupView}`}>
            {setupView === "history" ? (
              <IngestionHistoryHub
                headerStart={studioTabs}
                onOpenEditor={onOpenEditor}
                onOpenInStudio={() => {
                  setSetupView("new");
                  setIsSetupOpen(false);
                  onViewChange?.("new");
                }}
              />
            ) : setupView === "diagnostics" ? (
              <IngestionDiagnosticsLab headerStart={studioTabs} />
            ) : (
          /* Step 1: Cambridge Paper Setup & PDF Ingestion Wizard */
          <IngestionSetupWizard
            headerStart={studioTabs}
            onStartExtraction={handleStartExtraction}
            onResumeExtraction={resumeExtraction}
            onUploadJson={handleFileUpload}
            isReadingFile={isReadingFile}
            onLoadStagedPaper={(loadedPaper) => {
              const res = loadJson(loadedPaper, {
                name: `${loadedPaper.id || "staged_paper"}.json`,
              });
              if (res.success) {
                setIsSetupOpen(false);
                setIsPipelineModalOpen(true);
                setPipelineStep("preview");
                setPublishStatus("success");
                setPublishMessage("Staged paper loaded and validated successfully.");
              } else {
                setPublishStatus("error");
                setPublishMessage(
                  `Failed to load staged paper:\n${(res.errors || []).join("\n")}`
                );
              }
            }}
            onStartBlank={handleStartBlank}
            onResetAll={handleResetAll}
            isExtracting={isExtracting}
            extractionError={extractionError}
            activePaper={paper}
            onReturnToWorkspace={() => setIsSetupOpen(false)}
          />
            )}
            </div>
          </div>
        ) : (
          /* Step 2: Focused Dual-Pane Verification Workspace */
          <IngestionWorkspace
            paper={paper}
            questions={questions}
            selectedIdx={selectedIdx}
            currentQuestion={currentQuestion}
            showPdfViewer={showPdfViewer}
            onTogglePdfViewer={() => setShowPdfViewer((prev) => !prev)}
            qpPdfUrl={qpPdfUrl}
            activePdfPage={activePdfPage}
            setActivePdfPage={setActivePdfPage}
            totalPdfPages={totalPdfPages}
            onSelectQuestion={(idx) => setSelectedIdx(idx)}
            onUpdateQuestion={updateQuestion}
            onAddQuestion={addQuestion}
            onDuplicateQuestion={duplicateQuestion}
            onDeleteQuestion={deleteQuestion}
            onMoveQuestion={moveQuestion}
            onSetCorrectOption={setCorrectOption}
          />
        )}
      </IngestionStudioFrame>

      {/* Overlays: Paper Metadata Settings Modal */}
      <IngestionSettingsModal
        paper={paper}
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={(meta) => updatePaperMetadata(meta)}
      />

      {/* Overlays: Paper Ingestion Pipeline & Supabase Upsert Modal */}
      <IngestionPipelineModal
        isOpen={isPipelineModalOpen}
        onClose={() => setIsPipelineModalOpen(false)}
        onOpenWorkspace={() => {
          setIsPipelineModalOpen(false);
          setIsSetupOpen(false);
        }}
        onUploadAnother={() => {
          setIsPipelineModalOpen(false);
          setIsSetupOpen(true);
        }}
        onViewQuestionBank={() => {
          setIsPipelineModalOpen(false);
          if (typeof window !== "undefined") {
            window.location.href = "/admin?tab=bank";
          }
        }}
      />

      {/* Overlays: Cambridge Mark Scheme Verification Modal */}
      <IngestionMarkSchemeModal
        isOpen={isMarkSchemeModalOpen}
        onClose={() => setIsMarkSchemeModalOpen(false)}
        paper={paper}
        onApplyFix={(fixedPaper) => {
          setPaper(fixedPaper);
          setPublishStatus("success");
          setPublishMessage("Mark scheme auto-remediations successfully applied to paper.");
        }}
        onVerificationSuccess={(rep) => {
          setMarkSchemeReport(rep);
        }}
      />

      {/* Overlays: Student Live Preview Modal */}
      <IngestionPreviewModal
        isOpen={showLivePreview}
        onClose={() => setShowLivePreview(false)}
        questions={questions}
        selectedIdx={selectedIdx}
        onSelectIdx={(idx) => setSelectedIdx(idx)}
        paperCode={
          paper
            ? `${paper.subject?.code || "0455"}/${paper.paper?.paper_code || "12"}`
            : undefined
        }
      />

      {/* Overlays: Cambridge Quality Gate Audit Drawer */}
      <IngestionAuditDrawer
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        paper={paper}
        onSelectQuestion={(idx) => {
          setSelectedIdx(idx);
          setIsAuditDrawerOpen(false);
        }}
      />

      {/* Overlays: Direct JSON Payload Modal */}
      <IngestionPayloadModal
        paper={paper}
        isOpen={isPayloadModalOpen}
        onClose={() => setIsPayloadModalOpen(false)}
        onUploadJson={handleFileUpload}
        onPasteJson={(rawJson) => {
          try {
            const parsed = JSON.parse(rawJson);
            const res = loadJson(parsed, {
              name: "pasted_payload.json",
              size: rawJson.length,
            });
            if (res.success) {
              setIsPayloadModalOpen(false);
              setIsSetupOpen(false);
              setPublishStatus("success");
              setPublishMessage("JSON payload loaded and validated.");
            } else {
              setPublishStatus("error");
              setPublishMessage(
                "Validation failed for pasted JSON:\n" +
                  (res.errors || []).join("\n")
              );
            }
          } catch (e: any) {
            setPublishStatus("error");
            setPublishMessage(
              "Invalid JSON syntax: " + (e?.message || "Parse error")
            );
          }
        }}
      />
    </div>
  );
}

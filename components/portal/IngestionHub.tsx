"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useIngestionStore } from "@/lib/ingestion/useIngestionStore";
import IngestionHeader from "./IngestionHeader";
import IngestionStudioFrame from "./IngestionStudioFrame";
import IngestionWorkspace from "./IngestionWorkspace";
import { IngestionSettingsModal } from "./IngestionModals";
import type { StagingPaper, StagingQuestion } from "@/types/ingestion";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

import IngestionSetupWizard from "./IngestionSetupWizard";

export default function IngestionHub() {
  const {
    paper,
    selectedIdx,
    isSettingsModalOpen,
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
    setIsSettingsModalOpen,
    setPublishStatus,
    setPublishMessage,
    saveDraftToLocalStorage,
    loadDraftFromLocalStorage,
    clearDraft,
    hasDraft,
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
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [hasSavedDraftState, setHasSavedDraftState] = useState(false);

  // Check draft existence on mount without force-loading sample preset!
  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasSavedDraftState(hasDraft());
    }
  }, [hasDraft]);

  // Persist draft to localStorage whenever paper data changes
  useEffect(() => {
    if (paper) {
      saveDraftToLocalStorage();
    }
  }, [paper, saveDraftToLocalStorage]);

  const questions = paper?.questions || [];
  const currentQuestion: StagingQuestion | null =
    selectedQuestion || questions[selectedIdx] || null;

  // Handler for uploading JSON file via Wizard
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        const res = loadJson(json);
        if (res.success) {
          setIsSetupOpen(false);
        }
      } catch (err) {
        console.error("Failed to parse uploaded JSON file", err);
      }
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

    // Call store publishing action
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
    setHasSavedDraftState(false);
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
  const mode: "setup" | "workspace" =
    !paper || !paper.questions || paper.questions.length === 0 || isSetupOpen
      ? "setup"
      : "workspace";

  return (
    <div className="min-h-screen bg-[#f5ead8] font-body p-4 sm:p-6 lg:p-8 relative overflow-x-hidden">
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
              onUndo={undo}
              onRedo={redo}
              canUndo={canUndo}
              canRedo={canRedo}
              onSwitchPaper={() => setIsSetupOpen(true)}
              onSaveDraft={() => saveDraftToLocalStorage()}
              onReturnToStudio={() => setIsSetupOpen(false)}
            />
          ) : null
        }
        progressShelf={
          isExtracting ? (
            (() => {
              const isRetrying = extractionProgress.stage === "retrying";
              return (
                <div
                  className={`p-4 sm:p-5 border-[1.5px] rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 font-body animate-pulse ${
                    isRetrying
                      ? "bg-[#fef3c7] border-[#d97706] text-[#78350f]"
                      : "bg-[#e0e7ff] border-[#312e81] text-[#1e1b4b]"
                  }`}
                >
                  <div className="flex items-center gap-3.5 w-full md:w-auto">
                    <div
                      className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 border shadow-xs ${
                        isRetrying
                          ? "bg-[#d97706] border-[#b45309]"
                          : "bg-[#4f46e5] border-[#312e81]"
                      }`}
                    >
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-black uppercase tracking-wider ${
                            isRetrying ? "text-[#b45309]" : "text-[#4f46e5]"
                          }`}
                        >
                          {isRetrying
                            ? "Google API Capacity Spike (Auto-Retrying)"
                            : "Gemini Live Extraction"}
                        </span>
                        <span className="px-2 py-0.2 bg-white border border-current rounded-full text-[10px] font-black">
                          {extractionProgress.percent}%
                        </span>
                      </div>
                      <h4 className="font-heading text-sm sm:text-base font-black">
                        {extractionProgress.currentBatch || "Streaming Cambridge questions..."}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                    <div className="w-48 bg-white border border-current rounded-full h-3 overflow-hidden hidden sm:block">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isRetrying ? "bg-[#d97706]" : "bg-[#4f46e5]"
                        }`}
                        style={{ width: `${extractionProgress.percent}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={cancelExtraction}
                      className="px-3 py-1.5 bg-white hover:bg-rose-100 border border-current rounded-full text-xs font-bold text-[#b91c1c] active:translate-y-0.5 cursor-pointer shadow-xs transition-colors"
                    >
                      Cancel Extraction
                    </button>
                  </div>
                </div>
              );
            })()
          ) : null
        }
        statusShelf={
          <>
            {extractionError && (
              <div className="p-4 border-[1.5px] rounded-2xl font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm bg-[#fee2e2] text-[#b91c1c] border-[#b91c1c]">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-[#b91c1c] shrink-0" />
                  <span className="text-xs sm:text-sm whitespace-pre-line">{extractionError}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  {questions.length > 0 && questions.length < 40 && (
                    <button
                      type="button"
                      onClick={() => resumeExtraction()}
                      className="px-3.5 py-1.5 rounded-full bg-[#c67139] text-[#f9f4ed] border border-[#201e1d] hover:bg-[#b2622d] font-heading font-black text-xs active:translate-y-0.5 shadow-xs transition-colors cursor-pointer"
                    >
                      Resume Extraction (from Q{Math.max(...questions.map((q) => q.question_number || 0)) + 1})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    className="text-xs font-bold underline hover:opacity-80 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {publishStatus !== "idle" && publishMessage && (
              <div
                className={`p-4 border-[1.5px] rounded-2xl font-bold flex items-center justify-between gap-4 shadow-sm ${
                  publishStatus === "validating" || publishStatus === "publishing"
                    ? "bg-[#ffe1d0] text-[#c67139] border-[#c67139]"
                    : publishStatus === "success"
                    ? "bg-[#f0fae1] text-[#3d472b] border-[#8fa073]"
                    : "bg-[#fee2e2] text-[#b91c1c] border-[#b91c1c]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {publishStatus === "validating" || publishStatus === "publishing" ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : publishStatus === "success" ? (
                    <CheckCircle2 className="w-5 h-5 text-[#3d472b]" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-[#b91c1c]" />
                  )}
                  <span className="text-xs sm:text-sm whitespace-pre-line">{publishMessage}</span>
                </div>
                {publishStatus !== "publishing" && publishStatus !== "validating" && (
                  <button
                    type="button"
                    onClick={() => setPublishStatus("idle")}
                    className="text-xs font-bold underline hover:opacity-80 cursor-pointer shrink-0"
                  >
                    Dismiss
                  </button>
                )}
              </div>
            )}
          </>
        }
      >
        {mode === "setup" ? (
          /* Step 1: Cambridge Paper Setup & PDF Ingestion Wizard */
          <IngestionSetupWizard
            onStartExtraction={handleStartExtraction}
            onResumeExtraction={resumeExtraction}
            onUploadJson={handleFileUpload}
            onLoadStagedPaper={(loadedPaper) => {
              const res = loadJson(loadedPaper);
              if (res.success) {
                setIsSetupOpen(false);
              }
            }}
            onStartBlank={handleStartBlank}
            onResumeDraft={() => {
              loadDraftFromLocalStorage();
              setIsSetupOpen(false);
            }}
            onDiscardDraft={handleResetAll}
            onResetAll={handleResetAll}
            hasSavedDraft={hasSavedDraftState}
            isExtracting={isExtracting}
            extractionError={extractionError}
            activePaper={paper}
            onReturnToWorkspace={() => setIsSetupOpen(false)}
          />
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
    </div>
  );
}

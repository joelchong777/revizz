"use client";

import React, { useEffect, useState, useRef } from "react";
import { useIngestionStore } from "@/lib/ingestion/useIngestionStore";
import IngestionHeader from "./IngestionHeader";
import IngestionQuestionNav from "./IngestionQuestionNav";
import { IngestionStemEditor } from "./IngestionStemEditor";
import IngestionOptionsEditor from "./IngestionOptionsEditor";
import IngestionMediaPanel from "./IngestionMediaPanel";
import IngestionPreviewModal from "./IngestionPreviewModal";
import { IngestionSettingsModal, IngestionPayloadModal } from "./IngestionModals";
import IngestionAuditDrawer from "./IngestionAuditDrawer";
import IngestionPdfViewer from "./IngestionPdfViewer";
import type { StagingQuestion } from "@/types/ingestion";
import {
  Plus,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText,
  Sparkles,
  BookOpen,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowRight,
  FolderDown,
} from "lucide-react";

/**
 * Stage 1: Document Dropzone & Cambridge Ingestion Wizard
 * Restyled to match Question Bank calm organic aesthetic
 */
interface IngestionWizardProps {
  onStartExtraction: (qp: File, ms: File) => void;
  onLoadPreset: (id?: string) => void;
  onUploadJson: (file: File) => void;
  onStartBlank: () => void;
  isExtracting: boolean;
  extractionError: string | null;
}

function IngestionWizard({
  onStartExtraction,
  onLoadPreset,
  onUploadJson,
  onStartBlank,
  isExtracting,
  extractionError,
}: IngestionWizardProps) {
  const [qpFile, setQpFile] = useState<File | null>(null);
  const [msFile, setMsFile] = useState<File | null>(null);
  const qpInputRef = useRef<HTMLInputElement>(null);
  const msInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const canExtract = Boolean(qpFile && msFile && !isExtracting);

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    target: "qp" | "ms"
  ) => {
    e.preventDefault();
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
    <div className="w-full max-w-4xl mx-auto my-6 bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col gap-6 font-body">
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#ffe1d0] border border-[#c67139] text-[#c67139] rounded-full text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Cambridge Multimodal Ingestion Pipeline</span>
          </div>
          <h2 className="font-heading text-2xl sm:text-3xl font-black text-[#201e1d]">
            Digitize Past Exam Papers
          </h2>
          <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-1 max-w-xl">
            Drop your Cambridge Question Paper (QP) and Mark Scheme (MS) PDFs to automatically
            extract stems, 4-option MCQs, math formulas, and official answer keys with Gemini Vision.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onLoadPreset("0455_s24_12")}
            className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] text-xs font-semibold text-[#201e1d] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FolderDown className="w-3.5 h-3.5 text-[#201e1d]" />
            <span>Load Sample Preset</span>
          </button>
        </div>
      </div>

      {/* Error alert if extraction failed */}
      {extractionError && (
        <div className="p-3.5 bg-[#fee2e2] border-[1.5px] border-[#b91c1c] rounded-2xl flex items-center gap-3 text-xs font-bold text-[#b91c1c]">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{extractionError}</span>
        </div>
      )}

      {/* Dual File Dropzones (QP & MS) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Dropzone 1: Question Paper */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, "qp")}
          onClick={() => qpInputRef.current?.click()}
          className={`p-6 border-[1.5px] border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all ${
            qpFile
              ? "bg-[#f0fae1] border-[#728157] shadow-xs"
              : "bg-white border-[#c0b6a5] hover:bg-[#eee7db]/40"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl border-[1.5px] flex items-center justify-center text-xl transition-colors ${
              qpFile
                ? "bg-[#728157] text-[#f9f4ed] border-[#728157]"
                : "bg-[#eee7db] text-[#201e1d] border-[#dcd3c4]"
            }`}
          >
            {qpFile ? <FileText className="w-5 h-5" /> : "📄"}
          </div>
          <div>
            <h4 className="font-heading text-sm font-black text-[#201e1d]">
              {qpFile ? "Question Paper Selected" : "1. Question Paper (QP) PDF"}
            </h4>
            <p className="text-xs font-medium text-[#645c50] mt-0.5">
              {qpFile ? (
                <span className="text-[#3d472b] font-bold">{qpFile.name}</span>
              ) : (
                "Drag & drop or browse .pdf (e.g. 0455_s24_qp_12.pdf)"
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
              className="text-xs font-bold underline text-[#b91c1c] hover:opacity-80"
            >
              Remove
            </button>
          )}
        </div>

        {/* Dropzone 2: Mark Scheme */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, "ms")}
          onClick={() => msInputRef.current?.click()}
          className={`p-6 border-[1.5px] border-dashed rounded-2xl flex flex-col items-center justify-center text-center gap-3 cursor-pointer transition-all ${
            msFile
              ? "bg-[#f0fae1] border-[#728157] shadow-xs"
              : "bg-white border-[#c0b6a5] hover:bg-[#eee7db]/40"
          }`}
        >
          <div
            className={`w-12 h-12 rounded-2xl border-[1.5px] flex items-center justify-center text-xl transition-colors ${
              msFile
                ? "bg-[#728157] text-[#f9f4ed] border-[#728157]"
                : "bg-[#eee7db] text-[#201e1d] border-[#dcd3c4]"
            }`}
          >
            {msFile ? <FileText className="w-5 h-5" /> : "🎯"}
          </div>
          <div>
            <h4 className="font-heading text-sm font-black text-[#201e1d]">
              {msFile ? "Mark Scheme Selected" : "2. Mark Scheme (MS) PDF"}
            </h4>
            <p className="text-xs font-medium text-[#645c50] mt-0.5">
              {msFile ? (
                <span className="text-[#3d472b] font-bold">{msFile.name}</span>
              ) : (
                "Drag & drop or browse .pdf (e.g. 0455_s24_ms_12.pdf)"
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
              className="text-xs font-bold underline text-[#b91c1c] hover:opacity-80"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#dcd3c4] pt-5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] text-xs font-semibold text-[#201e1d] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#201e1d]" />
            <span>Upload Pre-staged JSON</span>
          </button>
          <button
            type="button"
            onClick={onStartBlank}
            className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] text-xs font-semibold text-[#645c50] flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Start Blank Draft</span>
          </button>
        </div>

        <button
          type="button"
          disabled={!canExtract}
          onClick={() => {
            if (qpFile && msFile) {
              onStartExtraction(qpFile, msFile);
            }
          }}
          className="w-full sm:w-auto px-5 py-2.5 rounded-full bg-[#c67139] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-heading font-black text-xs sm:text-sm hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-[#f9f4ed]" />
              <span>Extracting Cambridge Questions...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-[#f9f4ed]" />
              <span>Start Live Extraction Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function IngestionHub() {
  const {
    paper,
    selectedIdx,
    showLivePreview,
    isSettingsModalOpen,
    isPayloadModalOpen,
    isAuditDrawerOpen,
    publishStatus,
    publishMessage,
    selectedQuestion,
    isExtracting,
    extractionProgress,
    error: extractionError,
    qpPdfFile: _qpPdfFile,
    qpPdfUrl,
    totalPdfPages,
    activePdfPage,
    showPdfViewer,
    lifecycleState,
    canUndo,
    canRedo,
    loadPreset,
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
    setShowLivePreview,
    setIsSettingsModalOpen,
    setIsPayloadModalOpen,
    setIsAuditDrawerOpen,
    setPublishStatus,
    saveDraftToLocalStorage,
    loadDraftFromLocalStorage,
    setShowPdfViewer,
    setActivePdfPage,
    startExtraction,
    cancelExtraction,
    undo,
    redo,
  } = useIngestionStore();

  const questions = paper?.questions || [];
  const currentQuestion: StagingQuestion | null =
    selectedQuestion || questions[selectedIdx] || null;

  // Initial fetch: Restore draft from localStorage if present; otherwise fallback to default preset
  useEffect(() => {
    if (!paper) {
      const restored = loadDraftFromLocalStorage();
      if (!restored) {
        loadPreset("0455_s24_12");
      }
    }
  }, [paper, loadPreset, loadDraftFromLocalStorage]);

  // Persist draft to localStorage whenever paper data changes
  useEffect(() => {
    if (paper) {
      saveDraftToLocalStorage();
    }
  }, [paper, saveDraftToLocalStorage]);

  // Handler for uploading JSON file via Header / Modals
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        loadJson(json);
      } catch (err) {
        console.error("Failed to parse uploaded JSON file", err);
      }
    };
    reader.readAsText(file);
  };

  // Handler for pasting JSON string directly
  const handlePasteJson = (jsonString: string) => {
    try {
      const json = JSON.parse(jsonString);
      loadJson(json);
    } catch (err) {
      console.error("Failed to parse pasted JSON", err);
    }
  };

  const isBlankState = !paper || (!questions.length && !isExtracting);

  return (
    <div className="min-h-screen bg-[#f5ead8] font-body p-4 sm:p-6 lg:p-8 relative overflow-x-hidden">
      {/* Container: Full-width and clean layout without arbitrary margin shifts */}
      <div className="max-w-[1720px] mx-auto flex flex-col gap-6">
        {/* Top Header: Streamlined matching Question Bank design */}
        <IngestionHeader
          paper={paper}
          onLoadPreset={(presetId) => loadPreset(presetId || "0455_s24_12")}
          onUploadJson={handleFileUpload}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          onOpenPayloads={() => setIsPayloadModalOpen(true)}
          onOpenAudit={() => setIsAuditDrawerOpen(true)}
          onPublish={publishToSupabase}
          publishStatus={publishStatus}
          publishMessage={publishMessage}
          showLivePreview={showLivePreview}
          onTogglePreview={() => setShowLivePreview(true)}
          lifecycleState={lifecycleState}
          showPdfViewer={showPdfViewer}
          onTogglePdfViewer={() => setShowPdfViewer((prev) => !prev)}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
        />

        {/* Live Extraction Progress Banner */}
        {isExtracting && (
          <div className="p-4 sm:p-5 bg-[#e0e7ff] border-[1.5px] border-[#312e81] text-[#1e1b4b] rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4 font-body animate-pulse">
            <div className="flex items-center gap-3.5 w-full md:w-auto">
              <div className="w-10 h-10 rounded-xl bg-[#4f46e5] text-white flex items-center justify-center shrink-0 border border-[#312e81] shadow-xs">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-[#4f46e5]">
                    Gemini Live Extraction
                  </span>
                  <span className="px-2 py-0.2 bg-white border border-[#312e81] rounded-full text-[10px] font-black">
                    {extractionProgress.percent}%
                  </span>
                </div>
                <h4 className="font-heading text-sm sm:text-base font-black text-[#1e1b4b]">
                  {extractionProgress.currentBatch || "Streaming Cambridge questions..."}
                </h4>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
              <div className="w-48 bg-white border border-[#312e81] rounded-full h-3 overflow-hidden hidden sm:block">
                <div
                  className="bg-[#4f46e5] h-full transition-all duration-300"
                  style={{ width: `${extractionProgress.percent}%` }}
                />
              </div>
              <button
                type="button"
                onClick={cancelExtraction}
                className="px-3 py-1.5 bg-white hover:bg-rose-100 border border-[#312e81] rounded-full text-xs font-bold text-[#b91c1c] active:translate-y-0.5 cursor-pointer shadow-xs transition-colors"
              >
                Cancel Extraction
              </button>
            </div>
          </div>
        )}

        {/* Publish / Validate Status Feedback Banner */}
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
              <span className="text-sm">{publishMessage}</span>
            </div>
            {publishStatus !== "publishing" && publishStatus !== "validating" && (
              <button
                onClick={() => setPublishStatus("idle")}
                className="text-xs font-bold underline hover:opacity-80 cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* WORKSPACE CONTENT */}
        {isBlankState ? (
          /* Stage 1: Document Dropzone / Ingestion Wizard */
          <IngestionWizard
            onStartExtraction={(qp, ms) => startExtraction({ qpFile: qp, msFile: ms })}
            onLoadPreset={(id) => loadPreset(id || "0455_s24_12")}
            onUploadJson={handleFileUpload}
            onStartBlank={addQuestion}
            isExtracting={isExtracting}
            extractionError={extractionError}
          />
        ) : (
          /* Stage 2: Dual-Pane Studio Workspace */
          <div className="flex flex-col xl:flex-row items-start gap-6 w-full">
            {/* Left Pane: Interactive PDF Viewer Component with Collapse/Expand */}
            {showPdfViewer ? (
              <div className="w-full xl:w-[46%] 2xl:w-[48%] h-[820px] bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] rounded-2xl shadow-sm flex flex-col shrink-0 overflow-hidden font-body transition-all relative">
                {/* PDF Header bar with collapse toggle */}
                <div className="bg-[#f9f4ed] px-3.5 py-2 border-b-[1.5px] border-[#dcd3c4] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#201e1d]">
                    <BookOpen className="w-3.5 h-3.5 text-[#645c50]" />
                    <span>Cambridge PDF Reference</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPdfViewer(false)}
                    className="p-1 bg-[#f9f4ed] hover:bg-[#eee7db] border border-[#dcd3c4] rounded-full text-[#201e1d] cursor-pointer transition-colors"
                    title="Collapse PDF Pane"
                    aria-label="Collapse PDF Pane"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <IngestionPdfViewer
                    pdfUrl={qpPdfUrl || undefined}
                    currentPage={activePdfPage}
                    totalPages={totalPdfPages}
                    onPageChange={(page) => setActivePdfPage(page)}
                    questionNumber={currentQuestion?.question_number}
                    paperCode={paper?.paper?.paper_code || "12"}
                    boundingBox={currentQuestion?.diagram?.bounding_box || null}
                    onBoundingBoxChange={(bbox) => {
                      if (currentQuestion) {
                        updateQuestion(selectedIdx, {
                          ...currentQuestion,
                          diagram: {
                            ...currentQuestion.diagram,
                            has_diagram: Boolean(bbox),
                            bounding_box: bbox || undefined,
                          },
                        });
                      }
                    }}
                    className="w-full h-full"
                  />
                </div>
              </div>
            ) : (
              /* Collapsed Left Pane Vertical Rail */
              <div className="w-12 bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] rounded-2xl shadow-sm flex flex-col items-center py-4 gap-4 shrink-0 transition-all">
                <button
                  type="button"
                  onClick={() => setShowPdfViewer(true)}
                  className="p-2 bg-[#f9f4ed] hover:bg-[#eee7db] border-[1.5px] border-[#dcd3c4] rounded-full cursor-pointer text-[#201e1d] transition-colors"
                  title="Expand PDF Source Pane"
                  aria-label="Expand PDF Source Pane"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
                <div className="rotate-90 text-xs font-bold text-[#645c50] tracking-wider uppercase whitespace-nowrap mt-12 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 -rotate-90" />
                  <span>PDF Source</span>
                </div>
              </div>
            )}

            {/* Right Pane: Question Nav Matrix & Authoring Suite */}
            <div className="flex-1 min-w-0 w-full flex flex-col lg:flex-row items-start gap-6">
              {/* Question Navigation Matrix */}
              <div
                className={`w-full shrink-0 ${
                  showPdfViewer
                    ? "lg:w-[260px] 2xl:w-[280px]"
                    : "lg:w-[22%] min-w-[240px] max-w-full lg:max-w-[320px]"
                }`}
              >
                <IngestionQuestionNav
                  questions={questions}
                  selectedIdx={selectedIdx}
                  onSelect={setSelectedIdx}
                  onAddQuestion={addQuestion}
                  onDuplicateQuestion={duplicateQuestion}
                  onDeleteQuestion={deleteQuestion}
                  onMoveQuestion={moveQuestion}
                  syllabusTopics={paper?.syllabus_topics || []}
                  paper={paper || undefined}
                />
              </div>

              {/* Main Question Authoring Canvas */}
              <div className="flex-1 min-w-0 flex flex-col gap-6 w-full">
                {currentQuestion ? (
                  <>
                    {/* Stem Markdown & KaTeX Formula Editor */}
                    <IngestionStemEditor
                      questionNumber={currentQuestion.question_number || selectedIdx + 1}
                      stemMarkdown={currentQuestion.stem_markdown || ""}
                      citation={currentQuestion.cambridge_source_ref || ""}
                      onChangeStem={(newStem) => {
                        updateQuestion(selectedIdx, {
                          ...currentQuestion,
                          stem_markdown: newStem,
                        });
                      }}
                      onChangeCitation={(newCitation) => {
                        updateQuestion(selectedIdx, {
                          ...currentQuestion,
                          cambridge_source_ref: newCitation,
                        });
                      }}
                      onMoveUp={() => {
                        if (selectedIdx > 0) moveQuestion(selectedIdx, selectedIdx - 1);
                      }}
                      onMoveDown={() => {
                        if (selectedIdx < questions.length - 1)
                          moveQuestion(selectedIdx, selectedIdx + 1);
                      }}
                      onDuplicate={() => duplicateQuestion(selectedIdx)}
                      onDelete={() => deleteQuestion(selectedIdx)}
                    />

                    {/* 4 Stacked MCQ Options Editor */}
                    <IngestionOptionsEditor
                      options={currentQuestion.options || []}
                      onChangeOption={(label, content) => {
                        const nextOptions = (currentQuestion.options || []).map((opt) =>
                          opt.label === label ? { ...opt, content_markdown: content } : opt
                        );
                        updateQuestion(selectedIdx, {
                          ...currentQuestion,
                          options: nextOptions,
                        });
                      }}
                      onSetCorrect={(label) => {
                        setCorrectOption(label);
                      }}
                    />

                    {/* Diagram Lightbox, Syllabus Topic & Derivation Panel */}
                    <IngestionMediaPanel
                      diagram={currentQuestion.diagram}
                      topicName={currentQuestion.topic_name || ""}
                      syllabusTopics={paper?.syllabus_topics || []}
                      explanationMarkdown={currentQuestion.explanation_markdown || ""}
                      onUpdateDiagram={(diag) => {
                        updateQuestion(selectedIdx, {
                          ...currentQuestion,
                          diagram: {
                            ...currentQuestion.diagram,
                            has_diagram: diag.has_diagram,
                            image_url: diag.image_url,
                            alt_description: diag.alt_description,
                          },
                        });
                      }}
                      onUpdateTopic={(topicName) => {
                        updateQuestion(selectedIdx, {
                          ...currentQuestion,
                          topic_name: topicName,
                        });
                      }}
                      onUpdateExplanation={(explanation) => {
                        updateQuestion(selectedIdx, {
                          ...currentQuestion,
                          explanation_markdown: explanation,
                        });
                      }}
                    />
                  </>
                ) : (
                  <div className="flex-1 bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center gap-4 min-h-[420px]">
                    <div className="w-16 h-16 rounded-full bg-[#eee7db] border-[1.5px] border-[#dcd3c4] flex items-center justify-center text-3xl">
                      📝
                    </div>
                    <div>
                      <h3 className="font-heading text-2xl font-black text-[#201e1d]">
                        No Question Selected
                      </h3>
                      <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-1 max-w-md">
                        Select a question from the navigation panel or create a new question to start editing.
                      </p>
                    </div>
                    <button
                      onClick={addQuestion}
                      className="px-4 py-2 rounded-full bg-[#c67139] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-heading font-black text-xs hover:bg-[#b2622d] active:translate-y-0.5 flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add First Question</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Questions Preview Modal Popup (Replaces old slide-over drawer) */}
      <IngestionPreviewModal
        isOpen={showLivePreview}
        onClose={() => setShowLivePreview(false)}
        questions={questions}
        selectedIdx={selectedIdx}
        onSelectIdx={(idx) => setSelectedIdx(idx)}
        paperCode={paper?.paper?.paper_code}
      />

      {/* Overlays: Paper Settings Modal */}
      <IngestionSettingsModal
        paper={paper}
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSave={(meta) => updatePaperMetadata(meta)}
      />

      {/* Overlays: Raw Payloads Modal (SQL / JSON) */}
      <IngestionPayloadModal
        paper={paper}
        isOpen={isPayloadModalOpen}
        onClose={() => setIsPayloadModalOpen(false)}
        onUploadJson={handleFileUpload}
        onPasteJson={handlePasteJson}
      />

      {/* Overlays: Bulk Quality Assurance Audit Drawer */}
      <IngestionAuditDrawer
        isOpen={isAuditDrawerOpen}
        onClose={() => setIsAuditDrawerOpen(false)}
        paper={paper}
        onSelectQuestion={(idx) => setSelectedIdx(idx)}
      />
    </div>
  );
}

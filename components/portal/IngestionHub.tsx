"use client";

import React, { useEffect } from "react";
import { useIngestionStore } from "@/lib/ingestion/useIngestionStore";
import IngestionHeader from "./IngestionHeader";
import IngestionQuestionNav from "./IngestionQuestionNav";
import { IngestionStemEditor } from "./IngestionStemEditor";
import IngestionOptionsEditor from "./IngestionOptionsEditor";
import IngestionMediaPanel from "./IngestionMediaPanel";
import IngestionLivePreview from "./IngestionLivePreview";
import IngestionDiagnostics from "./IngestionDiagnostics";
import IngestionModals from "./IngestionModals";
import IngestionAuditDrawer from "./IngestionAuditDrawer";
import type { StagingQuestion } from "@/types/ingestion";
import { Plus, CheckCircle2, AlertCircle } from "lucide-react";

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
  } = useIngestionStore();

  const questions = paper?.questions || [];
  const currentQuestion: StagingQuestion | null =
    selectedQuestion || questions[selectedIdx] || null;

  // Initial fetch: Load default preset paper
  useEffect(() => {
    if (!paper) {
      loadPreset("0455_s24_12");
    }
  }, [paper, loadPreset]);

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

  return (
    <div className="min-h-screen bg-[#f5ead8] font-body p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto flex flex-col gap-6">
        {/* Top Header */}
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
          onTogglePreview={() => setShowLivePreview((prev) => !prev)}
        />

        {/* Publish / Validate Status Feedback Banner */}
        {publishStatus !== "idle" && publishMessage && (
          <div
            className={`p-4 border-2 border-[#201e1d] rounded-2xl font-bold flex items-center justify-between gap-4 shadow-offset-2 ${
              publishStatus === "validating" || publishStatus === "publishing"
                ? "bg-[#ffe1d0] text-[#c67139]"
                : publishStatus === "success"
                ? "bg-[#f0fae1] text-[#15803d]"
                : "bg-[#fee2e2] text-[#b91c1c]"
            }`}
          >
            <div className="flex items-center gap-3">
              {publishStatus === "validating" || publishStatus === "publishing" ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : publishStatus === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-[#15803d]" />
              ) : (
                <AlertCircle className="w-5 h-5 text-[#b91c1c]" />
              )}
              <span className="text-sm">{publishMessage}</span>
            </div>
            {publishStatus !== "publishing" && publishStatus !== "validating" && (
              <button
                onClick={() => setPublishStatus("idle")}
                className="text-xs font-black uppercase underline hover:opacity-80 cursor-pointer"
              >
                Dismiss
              </button>
            )}
          </div>
        )}

        {/* Main 3-Column Studio Layout */}
        <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* Column 1 (Left ~25%): Question Navigation Matrix */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0">
            <IngestionQuestionNav
              questions={questions}
              selectedIdx={selectedIdx}
              onSelectIdx={setSelectedIdx}
              onAddQuestion={addQuestion}
              onDuplicateQuestion={duplicateQuestion}
              onDeleteQuestion={deleteQuestion}
              onMoveQuestion={moveQuestion}
              syllabusTopics={paper?.syllabus_topics || []}
              paper={paper || undefined}
            />
          </div>

          {/* Column 2 (Center ~45%): Core Question Editors */}
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
              <div className="flex-1 bg-white border-2 border-[#201e1d] rounded-2xl p-8 shadow-offset-4 flex flex-col items-center justify-center text-center gap-4 min-h-[420px]">
                <div className="w-16 h-16 rounded-3xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center text-3xl shadow-offset-2">
                  📝
                </div>
                <div>
                  <h3 className="font-heading text-2xl text-[#201e1d]">No Question Selected</h3>
                  <p className="text-sm font-bold text-[#645c50] mt-1 max-w-md">
                    Select a question from the navigation panel or create a new question to start editing.
                  </p>
                </div>
                <button
                  onClick={addQuestion}
                  className="px-5 py-2.5 bg-[#facc15] hover:bg-[#fde047] border-2 border-[#201e1d] rounded-xl font-bold text-sm text-[#201e1d] shadow-offset-2 active:translate-y-0.5 active:shadow-none flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Question</span>
                </button>
              </div>
            )}
          </div>

          {/* Column 3 (Right ~30%, Toggleable via Header Button): Live Simulator & Real-time Diagnostics */}
          {showLivePreview && (
            <div className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col gap-6">
              {currentQuestion ? (
                <>
                  {/* Interactive Student Gameboy Simulator */}
                  <IngestionLivePreview
                    question={currentQuestion}
                    questionIndex={selectedIdx}
                    totalQuestions={questions.length}
                    onNext={() => {
                      if (selectedIdx < questions.length - 1) {
                        setSelectedIdx(selectedIdx + 1);
                      }
                    }}
                  />

                  {/* Real-time Diagnostics & KaTeX Linter Panel */}
                  <IngestionDiagnostics
                    question={currentQuestion}
                    onUpdateQuestion={(updated) => updateQuestion(selectedIdx, updated)}
                    onFixKaTeX={(fixed) => updateQuestion(selectedIdx, fixed)}
                  />
                </>
              ) : (
                <div className="p-6 bg-white border-2 border-[#201e1d] rounded-2xl text-center text-xs font-bold text-[#645c50]">
                  Select a question to inspect live simulation and real-time QA diagnostics.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Overlays: Paper Settings & Raw Payloads (SQL/JSON) */}
      <IngestionModals
        paper={paper}
        isSettingsOpen={isSettingsModalOpen}
        onCloseSettings={() => setIsSettingsModalOpen(false)}
        onSaveSettings={(meta) => updatePaperMetadata(meta)}
        isPayloadOpen={isPayloadModalOpen}
        onClosePayload={() => setIsPayloadModalOpen(false)}
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

"use client";

import React from "react";
import type { StagingPaper, StagingQuestion } from "@/types/ingestion";
import IngestionPdfViewer from "./IngestionPdfViewer";
import IngestionQuestionNav from "./IngestionQuestionNav";
import { IngestionStemEditor } from "./IngestionStemEditor";
import IngestionOptionsEditor from "./IngestionOptionsEditor";
import IngestionMediaPanel from "./IngestionMediaPanel";
import {
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
} from "lucide-react";

export interface IngestionWorkspaceProps {
  paper: StagingPaper | null;
  questions: StagingQuestion[];
  selectedIdx: number;
  currentQuestion: StagingQuestion | null;

  // PDF Viewer controls & state
  showPdfViewer: boolean;
  onTogglePdfViewer: () => void;
  qpPdfUrl?: string | null;
  activePdfPage: number;
  setActivePdfPage: (page: number) => void;
  totalPdfPages: number;

  // Question manipulation handlers
  onSelectQuestion: (idx: number) => void;
  onUpdateQuestion: (idx: number, updated: StagingQuestion) => void;
  onAddQuestion: () => void;
  onDuplicateQuestion: (idx: number) => void;
  onDeleteQuestion: (idx: number) => void;
  onMoveQuestion: (fromIdx: number, toIdx: number) => void;
  onSetCorrectOption: (label: "A" | "B" | "C" | "D") => void;

  className?: string;
}

/**
 * IngestionWorkspace:
 * Dual-Pane Active Verification & Authoring Workspace docked inside IngestionStudioFrame.
 *
 * - Left Pane: Cambridge PDF Viewer with smooth collapse/expand rail, page navigation,
 *   zoom controls, and diagram bounding box selector. Proportioned at 42-44% for desktop balance.
 * - Right Pane:
 *   * Horizontally docked IngestionQuestionNav strip at top.
 *   * Active Question Authoring Canvas (Stem, Options, Media/Explanation) below.
 */
export function IngestionWorkspace({
  paper,
  questions,
  selectedIdx,
  currentQuestion,
  showPdfViewer,
  onTogglePdfViewer,
  qpPdfUrl,
  activePdfPage,
  setActivePdfPage,
  totalPdfPages,
  onSelectQuestion,
  onUpdateQuestion,
  onAddQuestion,
  onDuplicateQuestion,
  onDeleteQuestion,
  onMoveQuestion,
  onSetCorrectOption,
  className = "",
}: IngestionWorkspaceProps) {
  return (
    <div
      className={`flex flex-col xl:flex-row items-stretch gap-5 w-full ${className}`}
      data-testid="ingestion-dual-pane-workspace"
    >
      {/* =========================================================================
          LEFT PANE: Interactive PDF Source Viewer or Collapsed Rail
         ========================================================================= */}
      {showPdfViewer ? (
        <div
          className="w-full xl:w-[42%] 2xl:w-[44%] min-h-[720px] xl:h-[calc(100vh-180px)] sticky top-4 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_#201e1d] flex flex-col shrink-0 overflow-hidden font-body transition-all duration-300"
          data-testid="ingestion-pdf-pane-expanded"
        >
          {/* PDF Header bar with collapse toggle */}
          <div className="bg-[#fbf7ee] px-3.5 py-2.5 border-b-2 border-[#201e1d] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs text-[#201e1d]">
              <div className="w-6 h-6 rounded-lg bg-[#ffe1d0] border border-[#201e1d] flex items-center justify-center shrink-0">
                <BookOpen className="w-3.5 h-3.5 text-[#c67139]" />
              </div>
              <span className="font-adminHeading font-bold text-xs sm:text-sm tracking-tight text-[#201e1d]">
                Cambridge PDF Source
              </span>
              {paper?.paper?.paper_code && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-[#ffe1d0] text-[#201e1d] border-2 border-[#201e1d] shadow-[1px_1px_0_#201e1d]">
                  Paper {paper.paper.paper_code}
                </span>
              )}
              {totalPdfPages > 0 && (
                <span className="text-[11px] font-mono text-[#82796a] font-semibold hidden sm:inline">
                  P.{activePdfPage}/{totalPdfPages}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onTogglePdfViewer}
              className="px-2.5 py-1 bg-white hover:bg-[#ffe1d0] hover:text-[#c67139] border-2 border-[#201e1d] rounded-full text-xs font-adminHeading font-bold text-[#201e1d] cursor-pointer transition-colors shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none flex items-center gap-1"
              title="Collapse PDF Pane (Expand Authoring Canvas)"
              aria-label="Collapse PDF Pane"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
              <span className="text-[11px] hidden sm:inline">Collapse PDF</span>
            </button>
          </div>

          {/* Embedded PDF Viewer with seamless edge-to-edge docking */}
          <div className="flex-1 overflow-hidden min-h-0">
            <IngestionPdfViewer
              pdfUrl={qpPdfUrl || undefined}
              currentPage={activePdfPage}
              totalPages={totalPdfPages}
              onPageChange={setActivePdfPage}
              questionNumber={currentQuestion?.question_number || selectedIdx + 1}
              paperCode={paper?.paper?.paper_code || "12"}
              boundingBox={currentQuestion?.diagram?.bounding_box || null}
              onBoundingBoxChange={(bbox) => {
                if (currentQuestion) {
                  onUpdateQuestion(selectedIdx, {
                    ...currentQuestion,
                    diagram: {
                      ...currentQuestion.diagram,
                      has_diagram: Boolean(bbox),
                      bounding_box: bbox || undefined,
                    },
                  });
                }
              }}
              className="w-full h-full border-0 shadow-none rounded-none"
            />
          </div>
        </div>
      ) : (
        /* Collapsed Left Pane Vertical Rail */
        <div
          className="w-14 bg-[#fbf7ee] border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_#201e1d] flex flex-col items-center py-4 gap-3.5 shrink-0 transition-all duration-300 sticky top-4 hover:border-[#c67139]"
          data-testid="ingestion-pdf-pane-collapsed"
        >
          <button
            type="button"
            onClick={onTogglePdfViewer}
            className="w-9 h-9 bg-white hover:bg-[#ffe1d0] hover:text-[#c67139] border-2 border-[#201e1d] rounded-xl cursor-pointer text-[#201e1d] transition-colors shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none flex items-center justify-center"
            title="Expand PDF Source Pane"
            aria-label="Expand PDF Source Pane"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>

          {/* Quick-action button on collapsed rail with page badge */}
          <button
            type="button"
            onClick={onTogglePdfViewer}
            className="px-2 py-1 bg-white hover:bg-[#c67139] hover:text-white text-[#201e1d] border-2 border-[#201e1d] rounded-xl text-[10px] font-mono font-bold transition-all shadow-[2px_2px_0_#201e1d] cursor-pointer active:scale-95"
            title={`Expand PDF Viewer (Current Page: P.${activePdfPage})`}
            aria-label={`Open PDF at Page ${activePdfPage}`}
          >
            P.{activePdfPage}
          </button>

          <div
            onClick={onTogglePdfViewer}
            className="rotate-90 text-xs font-adminHeading font-bold text-[#645c50] hover:text-[#c67139] tracking-wider uppercase whitespace-nowrap mt-12 flex items-center gap-1.5 select-none cursor-pointer"
            title="Click to expand PDF viewer"
          >
            <BookOpen className="w-3.5 h-3.5 -rotate-90 text-[#c67139]" />
            <span>PDF Source</span>
          </div>
        </div>
      )}

      {/* =========================================================================
          RIGHT PANE: Question Navigation Strip (Top) + Active Authoring Canvas
         ========================================================================= */}
      <div className="flex-1 min-w-0 w-full flex flex-col gap-4 sm:gap-5">
        {/* Top: Docked Horizontally Scrollable Question Navigation Strip */}
        <IngestionQuestionNav
          questions={questions}
          selectedIdx={selectedIdx}
          onSelect={(idx) => {
            onSelectQuestion(idx);
            // Sync PDF page if question metadata contains page_number
            const targetQ = questions[idx];
            if (targetQ?.page_number) {
              setActivePdfPage(targetQ.page_number);
            }
          }}
          onAddQuestion={onAddQuestion}
          onDuplicateQuestion={onDuplicateQuestion}
          onDeleteQuestion={onDeleteQuestion}
          onMoveQuestion={onMoveQuestion}
          syllabusTopics={paper?.syllabus_topics || []}
          paper={paper || undefined}
        />

        {/* Active Question Verification & Authoring Card */}
        {currentQuestion ? (
          <div className="flex flex-col gap-4 w-full">
            {/* Stem Markdown & KaTeX Formula Editor */}
            <IngestionStemEditor
              questionNumber={currentQuestion.question_number || selectedIdx + 1}
              stemMarkdown={currentQuestion.stem_markdown || ""}
              citation={currentQuestion.cambridge_source_ref || ""}
              topicName={currentQuestion.topic_name || ""}
              syllabusTopics={paper?.syllabus_topics || []}
              onChangeStem={(newStem) => {
                onUpdateQuestion(selectedIdx, {
                  ...currentQuestion,
                  stem_markdown: newStem,
                });
              }}
              onChangeCitation={(newCitation) => {
                onUpdateQuestion(selectedIdx, {
                  ...currentQuestion,
                  cambridge_source_ref: newCitation,
                });
              }}
              onChangeTopic={(newTopic) => {
                onUpdateQuestion(selectedIdx, {
                  ...currentQuestion,
                  topic_name: newTopic,
                });
              }}
              onMoveUp={() => {
                if (selectedIdx > 0) onMoveQuestion(selectedIdx, selectedIdx - 1);
              }}
              onMoveDown={() => {
                if (selectedIdx < questions.length - 1)
                  onMoveQuestion(selectedIdx, selectedIdx + 1);
              }}
              onDuplicate={() => onDuplicateQuestion(selectedIdx)}
              onDelete={() => onDeleteQuestion(selectedIdx)}
            />

            {/* 4 Stacked MCQ Options Editor */}
            <IngestionOptionsEditor
              options={currentQuestion.options || []}
              stemMarkdown={currentQuestion.stem_markdown || ""}
              topicName={currentQuestion.topic_name || ""}
              distractorAnalysis={currentQuestion.distractor_analysis}
              onChangeOption={(label, content) => {
                const nextOptions = (currentQuestion.options || []).map((opt) =>
                  opt.label === label ? { ...opt, content_markdown: content } : opt
                );
                onUpdateQuestion(selectedIdx, {
                  ...currentQuestion,
                  options: nextOptions,
                });
              }}
              onSetCorrect={(label) => {
                onSetCorrectOption(label as "A" | "B" | "C" | "D");
              }}
              onChangeDistractor={(label, rationale) => {
                onUpdateQuestion(selectedIdx, {
                  ...currentQuestion,
                  distractor_analysis: {
                    ...(currentQuestion.distractor_analysis || {}),
                    [label]: rationale,
                  },
                });
              }}
            />

            {/* Diagram Lightbox, Syllabus Topic & Derivation Panel */}
            <IngestionMediaPanel
              diagram={currentQuestion.diagram}
              topicName={currentQuestion.topic_name || ""}
              syllabusTopics={paper?.syllabus_topics || []}
              explanationMarkdown={currentQuestion.explanation_markdown || ""}
              paperCode={paper?.paper?.paper_code || "12"}
              questionNumber={currentQuestion.question_number || selectedIdx + 1}
              pdfUrl={qpPdfUrl || undefined}
              activePdfPage={activePdfPage}
              onRequestRecrop={() => {
                if (!showPdfViewer) {
                  onTogglePdfViewer();
                }
              }}
              onOpenPdfCropper={() => {
                if (!showPdfViewer) {
                  onTogglePdfViewer();
                }
              }}
              onUpdateDiagram={(diag) => {
                onUpdateQuestion(selectedIdx, {
                  ...currentQuestion,
                  diagram: {
                    ...currentQuestion.diagram,
                    has_diagram: diag.has_diagram,
                    image_url: diag.image_url,
                    alt_description: diag.alt_description,
                    storage_path: diag.storage_path,
                    bounding_box: diag.bounding_box,
                  },
                });
              }}
              onUpdateTopic={(topicName) => {
                onUpdateQuestion(selectedIdx, {
                  ...currentQuestion,
                  topic_name: topicName,
                });
              }}
              onUpdateExplanation={(explanation) => {
                onUpdateQuestion(selectedIdx, {
                  ...currentQuestion,
                  explanation_markdown: explanation,
                });
              }}
            />
          </div>
        ) : (
          /* Empty State when no question selected */
          <div className="flex-1 bg-white border-2 border-[#201e1d] rounded-2xl p-8 sm:p-12 shadow-[3px_3px_0_#201e1d] flex flex-col items-center justify-center text-center gap-4 min-h-[420px]">
            <div className="w-16 h-16 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center text-3xl shadow-[2px_2px_0_#201e1d]">
              📝
            </div>
            <div>
              <h3 className="font-adminHeading text-xl font-bold text-[#201e1d]">
                No Question Selected
              </h3>
              <p className="text-xs sm:text-sm font-medium text-[#645c50] mt-1 max-w-md">
                Select a question from the navigation strip above or create a new question to start editing.
              </p>
            </div>
            <button
              type="button"
              onClick={onAddQuestion}
              className="px-5 py-2.5 rounded-full bg-[#c67139] text-[#f9f4ed] border-2 border-[#201e1d] shadow-[2px_2px_0_#201e1d] font-adminHeading font-bold text-xs hover:bg-[#b2622d] active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Question</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default IngestionWorkspace;

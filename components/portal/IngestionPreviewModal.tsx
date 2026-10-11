"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Gamepad2,
  ChevronDown,
  ChevronUp,
  FileText,
  Lightbulb,
  Check,
  Eye,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

import type { StagingQuestion } from "@/types/ingestion";
import { sanitizeKaTeX } from "@/lib/ingestion/katexSanitizer";
import { IngestionLivePreview } from "./IngestionLivePreview";

export interface IngestionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: StagingQuestion[];
  selectedIdx: number;
  onSelectIdx: (idx: number) => void;
  paperCode?: string;
}

export default function IngestionPreviewModal({
  isOpen,
  onClose,
  questions,
  selectedIdx,
  onSelectIdx,
  paperCode,
}: IngestionPreviewModalProps) {
  const [viewMode, setViewMode] = useState<"card" | "interactive">("card");
  const [isExplanationOpen, setIsExplanationOpen] = useState(false);

  const total = questions.length;
  const currentQuestion: StagingQuestion | null = questions[selectedIdx] || null;

  // Keyboard Navigation: Left (prev), Right (next), Escape (close)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input or textarea
      if (
        document.activeElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
      ) {
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (selectedIdx > 0) {
          onSelectIdx(selectedIdx - 1);
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (selectedIdx < total - 1) {
          onSelectIdx(selectedIdx + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIdx, total, onClose, onSelectIdx]);

  // Reset explanation expansion when question changes
  useEffect(() => {
    setIsExplanationOpen(false);
  }, [selectedIdx]);

  // Clean sanitized markdown for current question
  const sanitizedStem = useMemo(() => {
    if (!currentQuestion?.stem_markdown) return "";
    return sanitizeKaTeX(currentQuestion.stem_markdown);
  }, [currentQuestion?.stem_markdown]);

  const sanitizedExplanation = useMemo(() => {
    if (!currentQuestion?.explanation_markdown) return "";
    return sanitizeKaTeX(currentQuestion.explanation_markdown);
  }, [currentQuestion?.explanation_markdown]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 bg-[#201e1d]/50 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6"
    >
      <div
        className="bg-[#f9f4ed] border-2 border-[#201e1d] rounded-[28px] shadow-offset-4 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden font-body animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#f9f4ed] border-b-[1.5px] border-[#dcd3c4] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#645c50]">
                  Questions Preview
                </span>
                {paperCode && (
                  <span className="px-2 py-0.5 rounded-full bg-[#eee7db] text-[#474238] text-[10px] font-bold">
                    Paper {paperCode}
                  </span>
                )}
              </div>
              <h2
                id="preview-modal-title"
                className="font-heading text-lg sm:text-xl font-black text-[#201e1d] mt-0.5 truncate"
              >
                Question {selectedIdx + 1} of {Math.max(total, 1)}
              </h2>
            </div>
          </div>

          {/* Mode switch & Actions */}
          <div className="flex items-center gap-2">
            {/* View Mode Toggle Pill */}
            <div className="bg-[#eee7db] p-1 rounded-full flex items-center gap-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode("card")}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "card"
                    ? "bg-[#f9f4ed] text-[#201e1d] shadow-sm font-black"
                    : "text-[#645c50] hover:text-[#201e1d]"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Card view</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("interactive")}
                className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
                  viewMode === "interactive"
                    ? "bg-[#ffe1d0] text-[#c67139] shadow-sm font-black"
                    : "text-[#645c50] hover:text-[#201e1d]"
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Interactive test</span>
              </button>
            </div>

            {/* Step Navigation Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelectIdx(Math.max(0, selectedIdx - 1))}
                disabled={selectedIdx <= 0}
                title="Previous question (← Left Arrow)"
                className="p-1.5 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] disabled:opacity-30 disabled:cursor-not-allowed text-[#201e1d] transition-colors cursor-pointer"
                aria-label="Previous question"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onSelectIdx(Math.min(total - 1, selectedIdx + 1))}
                disabled={selectedIdx >= total - 1}
                title="Next question (→ Right Arrow)"
                className="p-1.5 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] disabled:opacity-30 disabled:cursor-not-allowed text-[#201e1d] transition-colors cursor-pointer"
                aria-label="Next question"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              title="Close Preview (Esc)"
              className="p-1.5 rounded-full border-[1.5px] border-[#dcd3c4] hover:border-[#201e1d] hover:bg-[#eee7db] text-[#201e1d] transition-colors cursor-pointer ml-1"
              aria-label="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {!currentQuestion ? (
            <div className="py-12 text-center text-xs font-bold text-[#645c50]">
              No question selected or available.
            </div>
          ) : viewMode === "interactive" ? (
            <div className="max-w-2xl mx-auto">
              <IngestionLivePreview
                question={currentQuestion}
                questionIndex={selectedIdx}
                totalQuestions={total}
                onNext={() => {
                  if (selectedIdx < total - 1) {
                    onSelectIdx(selectedIdx + 1);
                  }
                }}
              />
            </div>
          ) : (
            /* Card View (Clean Reading Layout) */
            <div className="flex flex-col gap-5 max-w-2xl mx-auto">
              {/* Question Metadata Pills */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="px-3 py-1 rounded-full bg-[#201e1d] text-[#f9f4ed] font-bold">
                  Q{currentQuestion.question_number || selectedIdx + 1}
                </span>

                {currentQuestion.topic_name && (
                  <span className="px-3 py-1 rounded-full bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-[#3d472b] font-bold">
                    {currentQuestion.topic_name}
                  </span>
                )}

                {currentQuestion.cambridge_source_ref && (
                  <span className="px-3 py-1 rounded-full bg-[#eee7db] text-[#645c50] font-semibold">
                    {currentQuestion.cambridge_source_ref}
                  </span>
                )}

                {currentQuestion.status === "withdrawn" && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fee2e2] text-[#b91c1c]">
                    Withdrawn
                  </span>
                )}
              </div>

              {/* Question Stem */}
              <div className="p-4 sm:p-5 rounded-2xl bg-white border-[1.5px] border-[#dcd3c4] shadow-xs">
                <div className="prose prose-sm max-w-none text-[#201e1d] font-medium leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {sanitizedStem || "_No question stem text provided._"}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Diagram / Graphic if present */}
              {currentQuestion.diagram?.has_diagram && (
                <div className="rounded-2xl border-[1.5px] border-[#dcd3c4] bg-white p-3 flex flex-col items-center justify-center text-center gap-2">
                  {currentQuestion.diagram.image_url ? (
                    <img
                      src={currentQuestion.diagram.image_url}
                      alt={`Diagram for Question ${currentQuestion.question_number || selectedIdx + 1}`}
                      className="max-h-64 object-contain rounded-xl"
                    />
                  ) : (
                    <div className="py-6 px-4 flex flex-col items-center gap-2 text-xs font-bold text-[#645c50]">
                      <FileText className="w-8 h-8 text-[#a19786]" />
                      <span>Diagram referenced from Cambridge Question Paper</span>
                      {currentQuestion.diagram.bounding_box && (
                        <span className="text-[11px] font-mono text-[#82796a]">
                          Page {currentQuestion.diagram.bounding_box.page_number} [
                          {currentQuestion.diagram.bounding_box.xmin.toFixed(1)},{" "}
                          {currentQuestion.diagram.bounding_box.ymin.toFixed(1)},{" "}
                          {currentQuestion.diagram.bounding_box.xmax.toFixed(1)},{" "}
                          {currentQuestion.diagram.bounding_box.ymax.toFixed(1)}]
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 4 MCQ Options */}
              <div className="flex flex-col gap-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#645c50] px-1">
                  Options & Mark Scheme Key
                </span>
                <div className="grid grid-cols-1 gap-2.5">
                  {(currentQuestion.options || []).map((opt) => {
                    const isCorrect = Boolean(opt.is_correct);
                    const optSanitized = sanitizeKaTeX(opt.content_markdown || "");

                    return (
                      <div
                        key={opt.label}
                        className={`p-3.5 sm:p-4 rounded-2xl border-[1.5px] transition-colors flex items-start gap-3.5 ${
                          isCorrect
                            ? "bg-[#f0fae1] border-[#728157] text-[#201e1d]"
                            : "bg-white border-[#dcd3c4] text-[#201e1d]"
                        }`}
                      >
                        {/* Option Letter Badge */}
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-heading font-black text-xs shrink-0 mt-0.5 ${
                            isCorrect
                              ? "bg-[#728157] text-[#f9f4ed]"
                              : "bg-[#eee7db] text-[#201e1d]"
                          }`}
                        >
                          {opt.label}
                        </div>

                        {/* Option Markdown Content */}
                        <div className="flex-1 min-w-0 prose prose-sm max-w-none text-xs sm:text-sm font-medium leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {optSanitized || "_Empty option_"}
                          </ReactMarkdown>
                        </div>

                        {/* Official Correct Key Tag */}
                        {isCorrect && (
                          <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#e1eecc] border border-[#8fa073] text-[11px] font-bold text-[#3d472b]">
                            <Check className="w-3 h-3 text-[#56633f]" />
                            <span>Correct</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Collapsible Mark Scheme Explanation */}
              <div className="rounded-2xl border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsExplanationOpen((prev) => !prev)}
                  className="w-full px-4 py-3 bg-[#eee7db]/60 hover:bg-[#eee7db] transition-colors flex items-center justify-between text-xs font-bold text-[#474238] cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-[#c67139]" />
                    <span>Official Mark Scheme Explanation & Derivation</span>
                  </div>
                  {isExplanationOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#645c50]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#645c50]" />
                  )}
                </button>

                {isExplanationOpen && (
                  <div className="p-4 bg-white border-t border-[#dcd3c4]">
                    {sanitizedExplanation ? (
                      <div className="prose prose-sm max-w-none text-xs sm:text-sm text-[#201e1d] leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                          {sanitizedExplanation}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-xs text-[#82796a] italic">
                        No official explanation or derivation provided for this question.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Question Jump Pills */}
        <div className="px-5 py-3 bg-[#f9f4ed] border-t-[1.5px] border-[#dcd3c4] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 max-w-full">
            {questions.map((q, idx) => {
              const isSelected = idx === selectedIdx;
              const hasIssues =
                !q.stem_markdown ||
                !q.options ||
                q.options.length !== 4 ||
                q.options.filter((o) => o.is_correct).length !== 1;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectIdx(idx)}
                  className={`w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center justify-center ${
                    isSelected
                      ? "bg-[#c67139] text-[#f9f4ed] shadow-sm font-black"
                      : hasIssues
                      ? "bg-[#ffe1d0] text-[#8c491a] hover:bg-[#ffc6a5]"
                      : "bg-[#eee7db] text-[#474238] hover:bg-[#dcd3c4]"
                  }`}
                  title={`Jump to Question ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] hover:bg-[#eee7db] text-[#201e1d] font-bold text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

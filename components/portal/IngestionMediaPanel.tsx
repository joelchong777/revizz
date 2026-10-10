"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Image as ImageIcon, ZoomIn, X, BookOpen, FileText, Sparkles, Eye, Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface IngestionMediaPanelProps {
  diagram?: {
    has_diagram: boolean;
    image_url?: string;
    alt_description?: string;
    storage_path?: string;
  };
  topicName?: string;
  syllabusTopics?: { name: string; order_index: number }[];
  explanationMarkdown?: string;
  onUpdateDiagram: (diagram: {
    has_diagram: boolean;
    image_url?: string;
    alt_description?: string;
  }) => void;
  onUpdateTopic: (topicName: string) => void;
  onUpdateExplanation: (explanation: string) => void;
  className?: string;
}

export function IngestionMediaPanel({
  diagram,
  topicName = "",
  syllabusTopics = [],
  explanationMarkdown = "",
  onUpdateDiagram,
  onUpdateTopic,
  onUpdateExplanation,
  className,
}: IngestionMediaPanelProps) {
  const hasDiagram = Boolean(diagram?.has_diagram);
  const imageUrl = diagram?.image_url || "";
  const altDescription = diagram?.alt_description || "";

  // Lightbox Modal State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Syllabus Topic State
  const isExistingTopic = syllabusTopics.some((t) => t.name === topicName);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(
    !isExistingTopic && Boolean(topicName)
  );

  // Derivation Tab View State: 'split' | 'edit' | 'preview'
  const [explanationTab, setExplanationTab] = useState<"split" | "edit" | "preview">("split");

  // Keep custom topic mode in sync when topicName changes externally
  useEffect(() => {
    const exists = syllabusTopics.some((t) => t.name === topicName);
    if (!exists && Boolean(topicName)) {
      setIsCustomMode(true);
    } else if (exists) {
      setIsCustomMode(false);
    }
  }, [topicName, syllabusTopics]);

  // Handle ESC key for Lightbox Modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isLightboxOpen) {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen]);

  // Diagram update handlers
  const handleToggleDiagram = (enabled: boolean) => {
    onUpdateDiagram({
      has_diagram: enabled,
      image_url: imageUrl,
      alt_description: altDescription,
    });
  };

  const handleImageUrlChange = (url: string) => {
    onUpdateDiagram({
      has_diagram: true,
      image_url: url,
      alt_description: altDescription,
    });
  };

  const handleAltDescriptionChange = (alt: string) => {
    onUpdateDiagram({
      has_diagram: true,
      image_url: imageUrl,
      alt_description: alt,
    });
  };

  // Syllabus topic selection handler
  const handleTopicSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "__custom__") {
      setIsCustomMode(true);
    } else {
      setIsCustomMode(false);
      onUpdateTopic(val);
    }
  };

  // Sorted syllabus topics by order_index
  const sortedTopics = [...syllabusTopics].sort((a, b) => a.order_index - b.order_index);

  return (
    <div
      className={cn(
        "bg-[#f9f4ed] border-2 border-[#201e1d] rounded-2xl p-5 shadow-offset-2 flex flex-col gap-6 text-[#201e1d]",
        className
      )}
    >
      {/* ========================================================= */}
      {/* SECTION 1: Diagram Management Section                      */}
      {/* ========================================================= */}
      <section className="flex flex-col gap-4">
        {/* Header & Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-[#eee7db]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#ffe1d0] text-[#c67139] border border-[#c67139]/40 rounded-lg">
              <ImageIcon className="w-4 h-4" />
            </span>
            <h3 className="font-heading text-base uppercase tracking-wider font-bold">
              Diagram & Media
            </h3>
          </div>

          {/* Toggle Switch */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <span className="text-xs font-bold uppercase tracking-wider text-[#645c50]">
              Question contains diagram/graph
            </span>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={hasDiagram}
                onChange={(e) => handleToggleDiagram(e.target.checked)}
                className="sr-only peer"
                aria-label="Toggle Question contains diagram/graph"
              />
              <div className="w-11 h-6 bg-[#eee7db] border-2 border-[#201e1d] rounded-full peer peer-checked:bg-[#c67139] transition-colors peer-focus:ring-2 peer-focus:ring-[#c67139]/40">
                <div
                  className={cn(
                    "w-4 h-4 bg-white border border-[#201e1d] rounded-full shadow-sm transform transition-transform mt-[2px] ml-[2px]",
                    hasDiagram && "translate-x-5 bg-[#f9f4ed]"
                  )}
                />
              </div>
            </div>
          </label>
        </div>

        {/* Expanded Diagram Controls */}
        {hasDiagram ? (
          <div className="flex flex-col gap-4 bg-white border-2 border-[#201e1d] rounded-xl p-4 shadow-offset-2">
            {/* Image URL Input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="diagram-image-url"
                className="text-xs font-black uppercase tracking-wider text-[#645c50] flex items-center justify-between"
              >
                <span>Image URL / Asset Path</span>
                <span className="text-[10px] font-medium text-neutral-500 font-mono">
                  SVG, PNG, WebP or JPEG
                </span>
              </label>
              <input
                id="diagram-image-url"
                type="text"
                placeholder="e.g. /questions/0455_s24_12_q03.png or https://..."
                value={imageUrl}
                onChange={(e) => handleImageUrlChange(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono rounded-xl border-2 border-[#201e1d] bg-[#fdfbf7] outline-none focus:border-[#c67139] shadow-offset-2 transition-all"
              />
            </div>

            {/* Thumbnail Preview Card */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-[#645c50]">
                Thumbnail Preview
              </span>

              {imageUrl ? (
                <div className="flex flex-col items-center">
                  <div className="relative group w-full flex justify-center p-3 bg-[#fdfbf7] rounded-xl border-2 border-[#201e1d] shadow-offset-2 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={altDescription || "Question diagram thumbnail"}
                      className="max-h-48 object-contain rounded-xl border-2 border-[#201e1d] cursor-zoom-in transition-transform duration-150 group-hover:scale-[1.02]"
                      onClick={() => setIsLightboxOpen(true)}
                    />
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(true)}
                      className="absolute bottom-4 right-4 bg-[#201e1d] text-[#f9f4ed] hover:bg-[#c67139] px-3 py-1.5 rounded-lg text-xs font-bold border border-[#201e1d] shadow-offset-2 flex items-center gap-1.5 transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Zoom Lightbox</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-[#fdfbf7] border-2 border-dashed border-[#dcd3c4] rounded-xl flex flex-col items-center justify-center text-center gap-1 text-[#82796a]">
                  <ImageIcon className="w-8 h-8 opacity-40 mb-1" />
                  <p className="text-xs font-bold">No image specified</p>
                  <p className="text-[11px] text-[#a19786]">
                    Provide a valid image URL above to preview diagram thumbnail
                  </p>
                </div>
              )}
            </div>

            {/* Alt Description Input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="diagram-alt-description"
                className="text-xs font-black uppercase tracking-wider text-[#645c50] flex items-center justify-between"
              >
                <span>Alt Description</span>
                <span className="text-[10px] font-medium text-neutral-500">
                  Screen readers & Mark Scheme
                </span>
              </label>
              <input
                id="diagram-alt-description"
                type="text"
                placeholder="e.g. Supply and demand diagram showing shift of supply curve from S1 to S2"
                value={altDescription}
                onChange={(e) => handleAltDescriptionChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border-2 border-[#201e1d] bg-[#fdfbf7] outline-none focus:border-[#c67139] shadow-offset-2 transition-all font-medium"
              />
            </div>
          </div>
        ) : (
          <div className="p-3 bg-white/60 border border-dashed border-[#dcd3c4] rounded-xl text-xs text-[#82796a] italic">
            Diagram is disabled for this question. Toggle the switch above to attach an image or chart.
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* SECTION 2: Syllabus Topic Selection Section                */}
      {/* ========================================================= */}
      <section className="flex flex-col gap-3 pt-4 border-t-2 border-[#eee7db]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-[#f0fae1] text-[#7a8a5e] border border-[#7a8a5e]/40 rounded-lg">
            <BookOpen className="w-4 h-4" />
          </span>
          <h3 className="font-heading text-base uppercase tracking-wider font-bold">
            Syllabus Topic
          </h3>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* Topic Dropdown */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="syllabus-topic-select"
              className="text-xs font-black uppercase tracking-wider text-[#645c50]"
            >
              Paper Syllabus Topic
            </label>
            <select
              id="syllabus-topic-select"
              value={isCustomMode ? "__custom__" : topicName}
              onChange={handleTopicSelectChange}
              className="w-full p-2.5 rounded-xl border-2 border-[#201e1d] bg-white text-sm font-bold shadow-offset-2 outline-none focus:border-[#c67139] transition-all cursor-pointer"
            >
              <option value="" disabled>
                -- Select Syllabus Topic --
              </option>
              {sortedTopics.map((topic) => (
                <option key={topic.name} value={topic.name}>
                  {topic.order_index ? `${topic.order_index}. ` : ""}
                  {topic.name}
                </option>
              ))}
              <option value="__custom__">✏️ Custom Topic (Manual Input)...</option>
            </select>
          </div>

          {/* Custom Topic Input if not in list or custom selected */}
          {isCustomMode && (
            <div className="flex flex-col gap-1 mt-1 p-3 bg-white border-2 border-[#201e1d] rounded-xl shadow-offset-2 animate-in fade-in">
              <label
                htmlFor="custom-topic-input"
                className="text-xs font-black uppercase tracking-wider text-[#c67139] flex items-center gap-1.5"
              >
                <span>Custom Topic Name</span>
                <span className="text-[10px] font-normal text-[#645c50]">(Non-syllabus)</span>
              </label>
              <input
                id="custom-topic-input"
                type="text"
                placeholder="Enter custom topic name..."
                value={topicName}
                onChange={(e) => onUpdateTopic(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border-2 border-[#201e1d] bg-[#fdfbf7] outline-none focus:border-[#c67139] font-bold"
                autoFocus
              />
            </div>
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* SECTION 3: Derivation & Explanation Section                */}
      {/* ========================================================= */}
      <section className="flex flex-col gap-3 pt-4 border-t-2 border-[#eee7db]">
        {/* Header & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#ffe1d0] text-[#c67139] border border-[#c67139]/40 rounded-lg">
              <FileText className="w-4 h-4" />
            </span>
            <h3 className="font-heading text-base uppercase tracking-wider font-bold">
              Derivation & Explanation
            </h3>
          </div>

          {/* View mode buttons */}
          <div className="inline-flex rounded-xl border-2 border-[#201e1d] bg-white p-0.5 shadow-offset-2">
            <button
              type="button"
              onClick={() => setExplanationTab("split")}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1",
                explanationTab === "split"
                  ? "bg-[#201e1d] text-[#f9f4ed]"
                  : "text-[#645c50] hover:text-[#201e1d]"
              )}
            >
              <Sparkles className="w-3 h-3" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setExplanationTab("edit")}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1",
                explanationTab === "edit"
                  ? "bg-[#201e1d] text-[#f9f4ed]"
                  : "text-[#645c50] hover:text-[#201e1d]"
              )}
            >
              <Edit3 className="w-3 h-3" />
              <span>Write</span>
            </button>
            <button
              type="button"
              onClick={() => setExplanationTab("preview")}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1",
                explanationTab === "preview"
                  ? "bg-[#201e1d] text-[#f9f4ed]"
                  : "text-[#645c50] hover:text-[#201e1d]"
              )}
            >
              <Eye className="w-3 h-3" />
              <span>Preview</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex flex-col gap-3">
          {/* Textarea Editor */}
          {(explanationTab === "split" || explanationTab === "edit") && (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="explanation-textarea"
                className="text-xs font-black uppercase tracking-wider text-[#645c50] flex items-center justify-between"
              >
                <span>Step-by-step Derivation / Mark Scheme Notes</span>
                <span className="text-[10px] font-mono text-neutral-500">
                  Markdown + KaTeX ($..$)
                </span>
              </label>
              <textarea
                id="explanation-textarea"
                rows={explanationTab === "edit" ? 8 : 4}
                value={explanationMarkdown}
                onChange={(e) => onUpdateExplanation(e.target.value)}
                placeholder="Enter step-by-step derivation, formula notes, or reasoning (e.g. Price Elasticity of Demand is given by $PED = \frac{\% \Delta Q_d}{\% \Delta P}$)..."
                className="w-full p-3 font-mono text-xs md:text-sm rounded-xl border-2 border-[#201e1d] bg-white outline-none focus:border-[#c67139] shadow-offset-2 transition-all leading-relaxed resize-y text-[#201e1d]"
              />
            </div>
          )}

          {/* Live KaTeX & Markdown Preview */}
          {(explanationTab === "split" || explanationTab === "preview") && (
            <div className="p-4 bg-white border-2 border-[#201e1d] rounded-xl shadow-offset-2 flex flex-col gap-2">
              <div className="flex items-center justify-between pb-2 border-b border-[#eee7db]">
                <span className="text-xs font-black uppercase tracking-wider text-[#645c50] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#c67139]" />
                  <span>Live KaTeX Preview</span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#ffe1d0] text-[#c67139] px-2 py-0.5 rounded border border-[#c67139]/30">
                  Rendered
                </span>
              </div>

              <div className="min-h-[48px] text-sm leading-relaxed text-[#201e1d] overflow-x-auto">
                {explanationMarkdown?.trim() ? (
                  <div className="prose prose-sm max-w-none break-words">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {explanationMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs italic text-[#a19786]">
                    KaTeX preview will appear here in real-time as you type formulas and derivation notes above.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* Zoom Lightbox Modal (High-Resolution Preview)               */}
      {/* ========================================================= */}
      {isLightboxOpen && imageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Diagram Lightbox Preview"
          className="fixed inset-0 z-50 bg-[#201e1d]/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] w-full bg-[#f9f4ed] rounded-2xl md:rounded-3xl border-4 border-[#201e1d] shadow-[0_16px_0_0_rgba(32,30,29,1)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 md:p-5 border-b-4 border-[#201e1d] bg-white">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-[#ffe1d0] text-[#c67139] border-2 border-[#201e1d] rounded-xl shadow-offset-2">
                  <ZoomIn className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="font-heading text-lg font-bold text-[#201e1d]">
                    Diagram Inspector (High Resolution)
                  </h4>
                  <p className="text-xs text-[#645c50] truncate max-w-md font-mono">
                    {imageUrl}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsLightboxOpen(false)}
                aria-label="Close Lightbox"
                className="w-10 h-10 rounded-full border-2 border-[#201e1d] bg-[#c67139] text-[#f9f4ed] flex items-center justify-center font-bold hover:bg-[#b2622d] shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image Body */}
            <div className="flex-1 overflow-auto p-4 md:p-6 bg-[#fdfbf7] flex items-center justify-center min-h-[300px]">
              <img
                src={imageUrl}
                alt={altDescription || "High resolution diagram inspector"}
                className="max-w-full max-h-[68vh] object-contain rounded-xl border-2 border-[#201e1d] shadow-offset-4 bg-white"
              />
            </div>

            {/* Modal Footer */}
            {altDescription && (
              <div className="p-4 border-t-2 border-[#201e1d] bg-white flex flex-col gap-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#645c50]">
                  Alt Description
                </span>
                <p className="text-xs text-[#201e1d] font-medium leading-relaxed">
                  {altDescription}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default IngestionMediaPanel;

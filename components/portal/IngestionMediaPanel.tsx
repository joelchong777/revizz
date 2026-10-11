"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  Image as ImageIcon,
  Upload,
  ZoomIn,
  X,
  BookOpen,
  ChevronDown,
  Sparkles,
  Eye,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeKaTeX } from "@/lib/ingestion/katexSanitizer";

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

  // Hidden File Input Ref for Direct Upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collapsible Accordion 1: Diagram & Figures (Default collapsed if no diagram, expanded if diagram exists)
  const [isDiagramOpen, setIsDiagramOpen] = useState<boolean>(() =>
    Boolean(hasDiagram && (imageUrl || hasDiagram))
  );

  useEffect(() => {
    setIsDiagramOpen(Boolean(hasDiagram && (imageUrl || hasDiagram)));
  }, [hasDiagram, imageUrl]);

  // Collapsible Accordion 2: Syllabus Topic & Derivation (Default expanded)
  const [isTopicOpen, setIsTopicOpen] = useState<boolean>(true);

  // Syllabus Topic State
  const isExistingTopic = syllabusTopics.some((t) => t.name === topicName);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(
    !isExistingTopic && Boolean(topicName)
  );

  // Derivation View Tab State: 'split' | 'edit' | 'preview'
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
      image_url: enabled ? imageUrl : "",
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onUpdateDiagram({
          has_diagram: true,
          image_url: result,
          alt_description: altDescription || file.name,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
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
    <div className={cn("flex flex-col gap-3 text-[#201e1d]", className)}>
      {/* Hidden File Input for Direct Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ========================================================= */}
      {/* ACCORDION SECTION 1: [📷 Diagram & Figures]                 */}
      {/* ========================================================= */}
      <div className="border-2 border-[#201e1d] rounded-xl shadow-offset-2 bg-white overflow-hidden transition-all">
        {/* Collapsible Header */}
        <button
          type="button"
          onClick={() => setIsDiagramOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-white hover:bg-neutral-50/80 transition-colors cursor-pointer select-none text-left"
          aria-expanded={isDiagramOpen}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 bg-[#ffe1d0] text-[#c67139] border border-[#c67139]/40 rounded-lg shrink-0">
              <ImageIcon className="w-4 h-4" />
            </span>
            <span className="font-heading text-sm sm:text-base font-bold text-[#201e1d]">
              📷 Diagram &amp; Figures
            </span>

            {/* Status Badge */}
            {hasDiagram && imageUrl ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#f0fae1] text-[#22C55E] border border-[#22C55E]/40 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                Diagram Attached
              </span>
            ) : hasDiagram ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fff8eb] text-[#c67139] border border-[#c67139]/30 shrink-0">
                Enabled (No Image)
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-500 border border-neutral-300 shrink-0">
                None
              </span>
            )}
          </div>

          <ChevronDown
            className={cn(
              "w-5 h-5 text-[#201e1d] transition-transform duration-200 shrink-0",
              isDiagramOpen && "rotate-180"
            )}
          />
        </button>

        {/* Accordion Body */}
        {isDiagramOpen && (
          <div className="p-4 border-t-2 border-[#201e1d] bg-[#fdfbf7] flex flex-col gap-4">
            {/* Toggle Row */}
            <div className="flex items-center justify-between pb-2 border-b border-[#eee7db]">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasDiagram}
                  onChange={(e) => handleToggleDiagram(e.target.checked)}
                  className="w-4 h-4 rounded border-2 border-[#201e1d] text-[#c67139] focus:ring-0 cursor-pointer"
                />
                <span className="text-xs font-bold uppercase tracking-wider text-[#645c50]">
                  Question contains diagram/graph
                </span>
              </label>

              {imageUrl && (
                <button
                  type="button"
                  onClick={() => handleToggleDiagram(false)}
                  className="text-xs font-bold text-neutral-500 hover:text-red-600 transition-colors"
                >
                  Clear diagram
                </button>
              )}
            </div>

            {/* Image URL & Direct Upload Button */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="diagram-image-url"
                className="text-xs font-bold uppercase tracking-wider text-[#645c50] flex items-center justify-between"
              >
                <span>Image URL / Asset Path</span>
                <span className="text-[10px] font-mono text-neutral-500">
                  PNG, SVG, WebP, JPEG
                </span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch">
                <input
                  id="diagram-image-url"
                  type="text"
                  placeholder="e.g. /questions/0455_s24_12_q03.png or https://..."
                  value={imageUrl}
                  onChange={(e) => handleImageUrlChange(e.target.value)}
                  className="flex-1 min-w-0 px-3 py-2 text-sm font-mono rounded-xl border-2 border-[#201e1d] bg-white outline-none focus:border-[#c67139] shadow-offset-2 transition-all text-[#201e1d]"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-[#201e1d] text-[#f9f4ed] hover:bg-[#c67139] text-xs font-bold rounded-xl border-2 border-[#201e1d] flex items-center justify-center gap-1.5 shadow-offset-2 shrink-0 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Direct Upload</span>
                </button>
              </div>
            </div>

            {/* Thumbnail Preview Card with Click-to-Zoom Lightbox */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#645c50]">
                Thumbnail Preview
              </span>

              {imageUrl ? (
                <div className="flex items-center gap-4 p-3 bg-white rounded-xl border-2 border-[#201e1d] shadow-offset-2">
                  <div
                    className="relative group shrink-0 cursor-zoom-in"
                    onClick={() => setIsLightboxOpen(true)}
                  >
                    <img
                      src={imageUrl}
                      alt={altDescription || "Question diagram thumbnail"}
                      className="h-24 w-28 object-contain rounded-lg border-2 border-[#201e1d] bg-[#fdfbf7] transition-transform duration-150 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                      <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-neutral-500 truncate max-w-xs" title={imageUrl}>
                        {imageUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsLightboxOpen(true)}
                        className="text-xs font-bold text-[#c67139] hover:underline flex items-center gap-1 shrink-0"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Zoom Lightbox</span>
                      </button>
                    </div>
                    <p className="text-xs text-neutral-600 line-clamp-2">
                      {altDescription || "No alt description provided yet."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-white border-2 border-dashed border-[#dcd3c4] rounded-xl flex items-center justify-center text-center gap-2 text-[#82796a]">
                  <ImageIcon className="w-5 h-5 opacity-40 shrink-0" />
                  <span className="text-xs font-medium">
                    No image specified yet. Enter an image URL or click &quot;Direct Upload&quot; above.
                  </span>
                </div>
              )}
            </div>

            {/* Alt Description Input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="diagram-alt-description"
                className="text-xs font-bold uppercase tracking-wider text-[#645c50] flex items-center justify-between"
              >
                <span>Alt Description</span>
                <span className="text-[10px] font-medium text-neutral-500">
                  Screen readers &amp; Mark Scheme
                </span>
              </label>
              <input
                id="diagram-alt-description"
                type="text"
                placeholder="e.g. Demand and supply diagram showing leftward shift of supply curve from S1 to S2"
                value={altDescription}
                onChange={(e) => handleAltDescriptionChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border-2 border-[#201e1d] bg-white outline-none focus:border-[#c67139] shadow-offset-2 transition-all font-medium text-[#201e1d]"
              />
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* ACCORDION SECTION 2: [📚 Syllabus Topic & Derivation]        */}
      {/* ========================================================= */}
      <div className="border-2 border-[#201e1d] rounded-xl shadow-offset-2 bg-white overflow-hidden transition-all">
        {/* Collapsible Header */}
        <button
          type="button"
          onClick={() => setIsTopicOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-white hover:bg-neutral-50/80 transition-colors cursor-pointer select-none text-left"
          aria-expanded={isTopicOpen}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 bg-[#f0fae1] text-[#7a8a5e] border border-[#7a8a5e]/40 rounded-lg shrink-0">
              <BookOpen className="w-4 h-4" />
            </span>
            <span className="font-heading text-sm sm:text-base font-bold text-[#201e1d]">
              📚 Syllabus Topic &amp; Derivation
            </span>

            {/* Topic Name Badge in Header */}
            {topicName ? (
              <span
                className="max-w-[180px] sm:max-w-xs truncate px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ffe1d0] text-[#c67139] border border-[#c67139]/30 shrink-0"
                title={topicName}
              >
                {topicName}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-500 border border-neutral-300 shrink-0">
                No Topic
              </span>
            )}
          </div>

          <ChevronDown
            className={cn(
              "w-5 h-5 text-[#201e1d] transition-transform duration-200 shrink-0",
              isTopicOpen && "rotate-180"
            )}
          />
        </button>

        {/* Accordion Body */}
        {isTopicOpen && (
          <div className="p-4 border-t-2 border-[#201e1d] bg-[#fdfbf7] flex flex-col gap-4">
            {/* Topic Dropdown Selector */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="syllabus-topic-select"
                className="text-xs font-bold uppercase tracking-wider text-[#645c50]"
              >
                Paper Syllabus Topic
              </label>
              <select
                id="syllabus-topic-select"
                value={isCustomMode ? "__custom__" : topicName}
                onChange={handleTopicSelectChange}
                className="w-full p-2.5 rounded-xl border-2 border-[#201e1d] bg-white text-sm font-bold shadow-offset-2 outline-none focus:border-[#c67139] transition-all cursor-pointer text-[#201e1d]"
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

              {/* Custom Topic Input if selected */}
              {isCustomMode && (
                <div className="flex flex-col gap-1 mt-1 p-3 bg-white border-2 border-[#201e1d] rounded-xl shadow-offset-2 animate-in fade-in">
                  <label
                    htmlFor="custom-topic-input"
                    className="text-xs font-bold uppercase tracking-wider text-[#c67139] flex items-center gap-1.5"
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
                    className="w-full px-3 py-2 text-sm rounded-lg border-2 border-[#201e1d] bg-[#fdfbf7] outline-none focus:border-[#c67139] font-bold text-[#201e1d]"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Derivation Textarea with Live Math Rendering */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#eee7db]">
              {/* Derivation Header & Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#645c50] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#c67139]" />
                  <span>Derivation / Mark Scheme Notes</span>
                </span>

                {/* View Mode Buttons */}
                <div className="inline-flex rounded-xl border-2 border-[#201e1d] bg-white p-0.5 shadow-offset-2">
                  <button
                    type="button"
                    onClick={() => setExplanationTab("split")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer",
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
                      "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer",
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
                      "px-2.5 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer",
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

              {/* Textarea Editor */}
              {(explanationTab === "split" || explanationTab === "edit") && (
                <textarea
                  id="explanation-textarea"
                  rows={explanationTab === "edit" ? 6 : 3}
                  value={explanationMarkdown}
                  onChange={(e) => onUpdateExplanation(e.target.value)}
                  placeholder="Enter step-by-step derivation, formula notes, or reasoning (e.g. Price Elasticity of Demand is $PED = \frac{\% \Delta Q_d}{\% \Delta P}$)..."
                  className="w-full p-3 font-mono text-xs md:text-sm rounded-xl border-2 border-[#201e1d] bg-white outline-none focus:border-[#c67139] shadow-offset-2 transition-all leading-relaxed resize-y text-[#201e1d]"
                />
              )}

              {/* Live KaTeX Rendered Math Preview */}
              {(explanationTab === "split" || explanationTab === "preview") && (
                <div className="p-3 bg-white border-2 border-[#201e1d] rounded-xl shadow-offset-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between pb-1 border-b border-[#eee7db]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#645c50] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#c67139]" />
                      <span>Live KaTeX Preview</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#ffe1d0] text-[#c67139] px-1.5 py-0.5 rounded border border-[#c67139]/30">
                      Rendered
                    </span>
                  </div>

                  <div className="min-h-[36px] text-xs sm:text-sm leading-relaxed text-[#201e1d] overflow-x-auto">
                    {explanationMarkdown?.trim() ? (
                      <div className="prose prose-sm max-w-none break-words text-[#201e1d]">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {sanitizeKaTeX(explanationMarkdown)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-xs italic text-[#a19786]">
                        KaTeX preview will render here in real-time as formulas and derivation notes are typed.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* Zoom Lightbox Modal (High-Resolution Diagram Preview)       */}
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
                className="w-10 h-10 rounded-full border-2 border-[#201e1d] bg-[#c67139] text-[#f9f4ed] flex items-center justify-center font-bold hover:bg-[#b2622d] shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all cursor-pointer"
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

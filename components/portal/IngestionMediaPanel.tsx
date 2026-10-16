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
  Scissors,
  RotateCcw,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Cloud,
  HardDrive,
  AlertCircle,
  CheckCircle2,
  Crop,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeKaTeX } from "@/lib/ingestion/katexSanitizer";
import type { BoundingBox } from "@/types/ingestion";

export interface IngestionMediaPanelProps {
  diagram?: {
    has_diagram: boolean;
    image_url?: string;
    alt_description?: string;
    storage_path?: string;
    bounding_box?: BoundingBox;
  };
  topicName?: string;
  syllabusTopics?: { name: string; order_index: number }[];
  explanationMarkdown?: string;
  onUpdateDiagram: (diagram: {
    has_diagram: boolean;
    image_url?: string;
    alt_description?: string;
    storage_path?: string;
    bounding_box?: BoundingBox;
  }) => void;
  onUpdateTopic: (topicName: string) => void;
  onUpdateExplanation: (explanation: string) => void;
  className?: string;

  /** Cambridge Paper Code (e.g. '0455_s24_12') */
  paperCode?: string;
  /** Active Question Number */
  questionNumber?: number;
  /** Active PDF source URL */
  pdfUrl?: string;
  /** Active PDF page number */
  activePdfPage?: number;
  /** Action to focus or open the PDF cropper canvas */
  onOpenPdfCropper?: () => void;
  /** Action to request PDF re-crop / expansion of PDF viewer */
  onRequestRecrop?: () => void;
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
  paperCode = "",
  questionNumber = 1,
  pdfUrl,
  onOpenPdfCropper,
  onRequestRecrop,
}: IngestionMediaPanelProps) {
  const hasDiagram = Boolean(diagram?.has_diagram);
  const imageUrl = diagram?.image_url || "";
  const altDescription = diagram?.alt_description || "";
  const storagePath = diagram?.storage_path || "";
  const boundingBox = diagram?.bounding_box;

  // Determine Diagram Status
  type DiagramStatus = "Cropped & Uploaded" | "Needs re-crop" | "No diagram detected";
  let diagramStatus: DiagramStatus = "No diagram detected";
  if (hasDiagram) {
    if (imageUrl && (storagePath || imageUrl.includes("supabase") || imageUrl.includes("/questions/"))) {
      diagramStatus = "Cropped & Uploaded";
    } else if (!imageUrl || (boundingBox && !imageUrl)) {
      diagramStatus = "Needs re-crop";
    } else {
      diagramStatus = "Cropped & Uploaded";
    }
  }

  // Lightbox Modal State
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Re-crop execution states
  const [isRecropping, setIsRecropping] = useState(false);
  const [isRecropMode, setIsRecropMode] = useState(false);
  const [recropFeedback, setRecropFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Copy URL state
  const [copiedUrl, setCopiedUrl] = useState(false);

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
      storage_path: enabled ? storagePath : undefined,
      bounding_box: enabled ? boundingBox : undefined,
    });
  };

  const handleImageUrlChange = (url: string) => {
    onUpdateDiagram({
      has_diagram: true,
      image_url: url,
      alt_description: altDescription,
      storage_path: storagePath,
      bounding_box: boundingBox,
    });
  };

  const handleAltDescriptionChange = (alt: string) => {
    onUpdateDiagram({
      has_diagram: true,
      image_url: imageUrl,
      alt_description: alt,
      storage_path: storagePath,
      bounding_box: boundingBox,
    });
  };

  const handleRemoveDiagram = () => {
    onUpdateDiagram({
      has_diagram: false,
      image_url: "",
      alt_description: "",
      storage_path: undefined,
      bounding_box: undefined,
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
          storage_path: undefined,
          bounding_box: boundingBox,
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Re-crop Current BBox via /api/ingest/crop
  const handleReCropCurrentBBox = async () => {
    if (!boundingBox) {
      setRecropFeedback({
        type: "error",
        message: "No bounding box found. Please adjust crop on PDF first.",
      });
      setTimeout(() => setRecropFeedback(null), 4000);
      return;
    }

    setIsRecropping(true);
    setRecropFeedback(null);

    try {
      const res = await fetch("/api/ingest/crop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paperCode,
          questionNumber,
          bbox: boundingBox,
          imageUrl: imageUrl || pdfUrl || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Crop failed (HTTP ${res.status})`);
      }

      onUpdateDiagram({
        has_diagram: true,
        image_url: data.url,
        storage_path: data.storage_path,
        alt_description: altDescription,
        bounding_box: data.bbox || boundingBox,
      });

      setRecropFeedback({
        type: "success",
        message: "Diagram re-cropped and uploaded successfully!",
      });
    } catch (err: any) {
      console.error("[IngestionMediaPanel] Re-crop failed:", err);
      setRecropFeedback({
        type: "error",
        message: err.message || "Failed to re-crop bounding box.",
      });
    } finally {
      setIsRecropping(false);
      setTimeout(() => setRecropFeedback(null), 4000);
    }
  };

  // Trigger Re-crop & Auto-expand PDF Viewer (even if isRecropMode is already active)
  const handleTriggerRecrop = () => {
    setIsRecropMode(true);
    if (onRequestRecrop) {
      onRequestRecrop();
    }
    if (onOpenPdfCropper) {
      onOpenPdfCropper();
    } else {
      document.getElementById("pdf-canvas-container")?.scrollIntoView({ behavior: "smooth" });
    }
  };

  // Copy storage / image URL
  const handleCopyUrl = () => {
    if (!imageUrl) return;
    navigator.clipboard.writeText(imageUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
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
      <div className="bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] rounded-2xl overflow-hidden font-body text-[#201e1d] shadow-sm transition-all">
        {/* Collapsible Header */}
        <button
          type="button"
          onClick={() => setIsDiagramOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-[#f9f4ed] hover:bg-[#eee7db]/50 transition-colors cursor-pointer select-none text-left"
          aria-expanded={isDiagramOpen}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <span className="p-1.5 bg-[#ffe1d0] text-[#c67139] border border-[#c67139]/30 rounded-full shrink-0">
              <ImageIcon className="w-4 h-4" />
            </span>
            <span className="font-heading text-sm sm:text-base font-bold text-[#201e1d]">
              📷 Diagram &amp; Visual Figures
            </span>

            {/* Tri-state Diagram Status Badge */}
            {diagramStatus === "Cropped & Uploaded" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#f0fae1] text-[#3d472b] border border-[#8fa073] shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#728157]" />
                Cropped &amp; Uploaded
              </span>
            ) : diagramStatus === "Needs re-crop" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#ffe1d0] text-[#c67139] border border-[#c67139]/40 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c67139] animate-pulse" />
                Needs re-crop
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#eee7db] text-[#645c50] border border-[#dcd3c4] shrink-0">
                No diagram detected
              </span>
            )}
          </div>

          <ChevronDown
            className={cn(
              "w-4 h-4 text-[#645c50] transition-transform duration-200 shrink-0",
              isDiagramOpen && "rotate-180"
            )}
          />
        </button>

        {/* Accordion Body */}
        {isDiagramOpen && (
          <div className="p-4 border-t border-[#dcd3c4] bg-[#f9f4ed] flex flex-col gap-4">
            {/* Toggle Row & Crop Coordinates */}
            <div className="flex items-center justify-between pb-2 border-b border-[#dcd3c4]/70 flex-wrap gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hasDiagram}
                  onChange={(e) => handleToggleDiagram(e.target.checked)}
                  className="w-4 h-4 rounded border-[#dcd3c4] text-[#c67139] focus:ring-0 cursor-pointer accent-[#c67139]"
                />
                <span className="text-xs font-bold uppercase tracking-wider text-[#645c50]">
                  Question contains diagram/graph
                </span>
              </label>

              {boundingBox && (
                <span className="text-[11px] font-mono font-bold bg-[#ffe1d0] text-[#c67139] border border-[#c67139]/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Crop className="w-3 h-3 text-[#c67139]" />
                  <span>
                    BBox: [{boundingBox.ymin}, {boundingBox.xmin}, {boundingBox.ymax}, {boundingBox.xmax}] (Pg {boundingBox.page_number})
                  </span>
                </span>
              )}
            </div>

            {/* Interactive Action Controls Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* 1. Re-crop from PDF / Adjust Crop on PDF */}
              <button
                type="button"
                onClick={handleTriggerRecrop}
                className="px-3.5 py-2 bg-white hover:bg-[#eee7db] text-[#201e1d] rounded-full border-[1.5px] border-[#dcd3c4] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                title="Re-crop from PDF / Open interactive cropper on PDF canvas"
              >
                <Scissors className="w-3.5 h-3.5 text-[#c67139]" />
                <span>Re-crop from PDF</span>
              </button>

              {/* 2. Re-crop Current BBox */}
              <button
                type="button"
                onClick={handleReCropCurrentBBox}
                disabled={isRecropping || !boundingBox}
                className={cn(
                  "px-3.5 py-2 rounded-full font-semibold text-xs transition-all flex items-center justify-center gap-1.5",
                  isRecropping
                    ? "bg-[#ffe1d0] text-[#c67139] border-[1.5px] border-[#c67139] cursor-wait opacity-80"
                    : boundingBox
                    ? "bg-[#c67139] hover:bg-[#b2622d] text-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none cursor-pointer"
                    : "bg-[#eee7db] text-[#82796a] border-[1.5px] border-[#dcd3c4] opacity-60 cursor-not-allowed"
                )}
                title="Re-execute crop using current bounding box coordinates"
              >
                <RotateCcw className={cn("w-3.5 h-3.5", isRecropping && "animate-spin")} />
                <span>{isRecropping ? "Cropping..." : "Re-crop BBox"}</span>
              </button>

              {/* 3. Upload Custom Image */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-2 bg-white hover:bg-[#eee7db] text-[#201e1d] rounded-full border-[1.5px] border-[#dcd3c4] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-[#728157]" />
                <span>Upload Image</span>
              </button>

              {/* 4. Remove Diagram */}
              <button
                type="button"
                onClick={handleRemoveDiagram}
                disabled={!hasDiagram && !imageUrl}
                className={cn(
                  "px-3.5 py-2 rounded-full border-[1.5px] border-[#dcd3c4] font-semibold text-xs transition-colors flex items-center justify-center gap-1.5",
                  hasDiagram || imageUrl
                    ? "bg-white hover:bg-rose-50 text-rose-700 active:translate-y-0.5 cursor-pointer"
                    : "bg-[#eee7db] text-[#82796a] opacity-60 cursor-not-allowed"
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            </div>

            {/* In-flight feedback alert */}
            {recropFeedback && (
              <div
                className={cn(
                  "p-2.5 rounded-xl border-[1.5px] font-bold text-xs flex items-center gap-2",
                  recropFeedback.type === "success"
                    ? "bg-[#f0fae1] border-[#8fa073] text-[#3d472b]"
                    : "bg-[#ffe1d0] border-[#c67139] text-[#c67139]"
                )}
              >
                {recropFeedback.type === "success" ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#728157]" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-[#c67139]" />
                )}
                <span>{recropFeedback.message}</span>
              </div>
            )}

            {/* Thumbnail Preview Card with Zoom Lightbox */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#645c50]">
                Cropped Diagram Preview
              </span>

              {imageUrl ? (
                <div className="flex items-center gap-4 p-3 bg-white rounded-xl border-[1.5px] border-[#dcd3c4] shadow-sm">
                  <div
                    className="relative group shrink-0 cursor-zoom-in"
                    onClick={() => setIsLightboxOpen(true)}
                  >
                    <img
                      src={imageUrl}
                      alt={altDescription || "Question diagram thumbnail"}
                      className="h-24 w-28 object-contain rounded-lg border border-[#dcd3c4] bg-[#f9f4ed] transition-transform duration-150 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg pointer-events-none">
                      <ZoomIn className="w-5 h-5 text-white drop-shadow" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-[#82796a] truncate max-w-[200px] sm:max-w-xs" title={imageUrl}>
                        {imageUrl}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsLightboxOpen(true)}
                        className="text-xs font-bold text-[#c67139] hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Zoom Modal</span>
                      </button>
                    </div>

                    {/* Storage Badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {storagePath || imageUrl.includes("supabase.co") ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#f0fae1] text-[#3d472b] border border-[#8fa073]">
                          <Cloud className="w-3 h-3 text-[#728157]" />
                          <span>Bucket: question-diagrams</span>
                        </span>
                      ) : imageUrl.startsWith("/questions/") ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#ffe1d0] text-[#c67139] border border-[#c67139]/30">
                          <HardDrive className="w-3 h-3 text-[#c67139]" />
                          <span>Local Public Asset</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#eee7db] text-[#474238] border border-[#dcd3c4]">
                          <span>External / In-Memory Asset</span>
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={handleCopyUrl}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-[#645c50] hover:text-[#201e1d] bg-[#eee7db] hover:bg-[#e4dcce] px-2.5 py-0.5 rounded-full border border-[#dcd3c4] transition-colors cursor-pointer"
                        title="Copy image URL to clipboard"
                      >
                        {copiedUrl ? (
                          <>
                            <Check className="w-3 h-3 text-[#728157]" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy URL</span>
                          </>
                        )}
                      </button>
                    </div>

                    <p className="text-xs text-[#645c50] line-clamp-2">
                      {altDescription || "No alt description provided yet."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-white border-[1.5px] border-dashed border-[#dcd3c4] rounded-xl flex flex-col sm:flex-row items-center justify-center text-center gap-3 text-[#82796a]">
                  <div className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 opacity-40 shrink-0" />
                    <span className="text-xs font-medium">
                      No image cropped yet.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleTriggerRecrop}
                    className="px-3.5 py-1.5 rounded-full bg-[#ffe1d0] hover:bg-[#c67139] hover:text-white text-[#c67139] border border-[#c67139] text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                    title="Open PDF viewer and cropper to crop diagram"
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    <span>Re-crop from PDF</span>
                  </button>
                </div>
              )}
            </div>

            {/* Direct Image URL input */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="diagram-image-url"
                className="text-xs font-bold uppercase tracking-wider text-[#645c50] flex items-center justify-between"
              >
                <span>Image URL / Asset Path</span>
                <span className="text-[10px] font-mono text-[#82796a]">
                  PNG, SVG, WebP, JPEG
                </span>
              </label>
              <input
                id="diagram-image-url"
                type="text"
                placeholder={
                  paperCode
                    ? `e.g. /questions/${paperCode}_q${questionNumber}.png or https://...`
                    : "e.g. /questions/paper_q01.png or https://..."
                }
                value={imageUrl}
                onChange={(e) => handleImageUrlChange(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm font-mono rounded-xl border-[1.5px] border-[#dcd3c4] bg-white outline-none focus:border-[#c67139] transition-all text-[#201e1d] placeholder:text-[#82796a]"
              />
            </div>

            {/* Alt Description Input for Screen Readers & Mark Schemes */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="diagram-alt-description"
                  className="text-xs font-bold uppercase tracking-wider text-[#645c50]"
                >
                  Alt Description (Accessibility &amp; Mark Scheme)
                </label>
                <span className="text-[10px] font-mono text-[#82796a]">
                  {altDescription.length} chars
                </span>
              </div>
              <input
                id="diagram-alt-description"
                type="text"
                placeholder="e.g. Supply and demand diagram showing leftward shift of supply curve from S1 to S2 with higher equilibrium price"
                value={altDescription}
                onChange={(e) => handleAltDescriptionChange(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border-[1.5px] border-[#dcd3c4] bg-white outline-none focus:border-[#c67139] transition-all font-medium text-[#201e1d] placeholder:text-[#82796a]"
              />
              <span className="text-[11px] text-[#82796a]">
                Required for screen readers, Cambridge examiner cross-referencing, and multimodal QA.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* ACCORDION SECTION 2: [📚 Syllabus Topic & Derivation]        */}
      {/* ========================================================= */}
      <div className="bg-[#f9f4ed] border-[1.5px] border-[#dcd3c4] rounded-2xl overflow-hidden font-body text-[#201e1d] shadow-sm transition-all">
        {/* Collapsible Header */}
        <button
          type="button"
          onClick={() => setIsTopicOpen((prev) => !prev)}
          className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-[#f9f4ed] hover:bg-[#eee7db]/50 transition-colors cursor-pointer select-none text-left"
          aria-expanded={isTopicOpen}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-1.5 bg-[#f0fae1] text-[#728157] border border-[#8fa073]/40 rounded-full shrink-0">
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
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#eee7db] text-[#645c50] border border-[#dcd3c4] shrink-0">
                No Topic
              </span>
            )}
          </div>

          <ChevronDown
            className={cn(
              "w-4 h-4 text-[#645c50] transition-transform duration-200 shrink-0",
              isTopicOpen && "rotate-180"
            )}
          />
        </button>

        {/* Accordion Body */}
        {isTopicOpen && (
          <div className="p-4 border-t border-[#dcd3c4] bg-[#f9f4ed] flex flex-col gap-4">
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
                className="w-full p-2.5 rounded-full bg-white border-[1.5px] border-[#dcd3c4] text-xs sm:text-sm font-semibold text-[#201e1d] outline-none focus:border-[#c67139] transition-all cursor-pointer"
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
                <div className="flex flex-col gap-1 mt-1 p-3 bg-white border-[1.5px] border-[#dcd3c4] rounded-xl shadow-sm animate-in fade-in">
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
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-full border-[1.5px] border-[#dcd3c4] bg-[#f9f4ed] outline-none focus:border-[#c67139] font-semibold text-[#201e1d]"
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Derivation Textarea with Live Math Rendering */}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#dcd3c4]/70">
              {/* Derivation Header & Tabs */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#645c50] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#c67139]" />
                  <span>Derivation / Mark Scheme Notes</span>
                </span>

                {/* View Mode Buttons */}
                <div className="inline-flex rounded-full border border-[#dcd3c4] bg-[#eee7db] p-1 select-none">
                  <button
                    type="button"
                    onClick={() => setExplanationTab("split")}
                    className={cn(
                      "px-3 py-1 text-xs font-bold rounded-full transition-colors flex items-center gap-1 cursor-pointer",
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
                      "px-3 py-1 text-xs font-bold rounded-full transition-colors flex items-center gap-1 cursor-pointer",
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
                      "px-3 py-1 text-xs font-bold rounded-full transition-colors flex items-center gap-1 cursor-pointer",
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
                  className="w-full p-3 font-mono text-xs md:text-sm rounded-xl border-[1.5px] border-[#dcd3c4] bg-white outline-none focus:border-[#c67139] transition-all leading-relaxed resize-y text-[#201e1d] placeholder:text-[#82796a]"
                />
              )}

              {/* Live KaTeX Rendered Math Preview */}
              {(explanationTab === "split" || explanationTab === "preview") && (
                <div className="p-4 bg-white border-[1.5px] border-[#dcd3c4] rounded-xl shadow-sm flex flex-col gap-1.5">
                  <div className="flex items-center justify-between pb-1.5 border-b border-[#eee7db]">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#645c50] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#c67139]" />
                      <span>Live KaTeX Preview</span>
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#f0fae1] text-[#3d472b] px-2 py-0.5 rounded-full border border-[#8fa073]">
                      Rendered
                    </span>
                  </div>

                  <div className="min-h-[36px] text-xs sm:text-sm leading-relaxed text-[#201e1d] overflow-x-auto">
                    {explanationMarkdown?.trim() ? (
                      <div className="prose prose-sm max-w-none break-words text-[#201e1d]">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#c67139' }]]}
                        >
                          {sanitizeKaTeX(explanationMarkdown)}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-xs italic text-[#82796a]">
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
          className="fixed inset-0 z-50 bg-[#201e1d]/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 animate-in fade-in"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            className="relative max-w-5xl max-h-[92vh] w-full bg-[#f9f4ed] rounded-2xl md:rounded-3xl border-[1.5px] border-[#dcd3c4] shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center p-4 md:p-5 border-b border-[#dcd3c4] bg-[#f9f4ed]">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-[#ffe1d0] text-[#c67139] border border-[#c67139]/30 rounded-xl">
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
                className="w-9 h-9 rounded-full bg-[#201e1d] text-[#f9f4ed] hover:bg-[#474238] flex items-center justify-center font-bold transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Image Body */}
            <div className="flex-1 overflow-auto p-4 md:p-6 bg-white border border-[#dcd3c4] m-4 rounded-xl flex items-center justify-center min-h-[300px]">
              <img
                src={imageUrl}
                alt={altDescription || "High resolution diagram inspector"}
                className="max-w-full max-h-[68vh] object-contain rounded-lg"
              />
            </div>

            {/* Modal Footer */}
            {altDescription && (
              <div className="p-4 border-t border-[#dcd3c4] bg-[#f9f4ed] flex flex-col gap-1">
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

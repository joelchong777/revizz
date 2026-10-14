"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Crop,
  Move,
  FileText,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Layers,
  Eye,
  Sliders,
  Scissors,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoundingBox } from "@/types/ingestion";

export interface IngestionPdfViewerProps {
  /** Source PDF URL (e.g. /papers/0455_s24_12_qp.pdf or blob/data URL) */
  pdfUrl?: string;
  /** High-resolution raster page image fallback */
  pageImageUrl?: string;
  /** Base64 page image data */
  pageImageBase64?: string;
  /** Total pages in question paper */
  totalPages?: number;
  /** Currently active page (1-indexed) */
  currentPage?: number;
  /** Callback when page is switched */
  onPageChange?: (page: number) => void;
  /** Bounding box of the diagram on the active page (0-1000 scale) */
  boundingBox?: BoundingBox | null;
  /** Callback when bounding box is drawn or modified */
  onBoundingBoxChange?: (bbox: BoundingBox | null) => void;
  /** Current question number (1-based) */
  questionNumber?: number;
  /** Cambridge paper code (e.g. '0455_s24_12') */
  paperCode?: string;
  /** Callback triggered when user clicks 'Crop Diagram' */
  onCropDiagram?: (bbox: BoundingBox) => Promise<void> | void;
  /** Status indicating whether a crop operation is in progress */
  isCropping?: boolean;
  /** Additional wrapper CSS classes */
  className?: string;
}

type DragAction =
  | "move"
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "n"
  | "s"
  | "w"
  | "e"
  | "create"
  | null;

function clamp(val: number, min = 0, max = 1000): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function IngestionPdfViewer({
  pdfUrl: initialPdfUrl,
  pageImageUrl: initialPageImageUrl,
  pageImageBase64,
  totalPages = 16,
  currentPage = 1,
  onPageChange,
  boundingBox,
  onBoundingBoxChange,
  questionNumber = 1,
  paperCode = "",
  onCropDiagram,
  isCropping = false,
  className,
}: IngestionPdfViewerProps) {
  // Local file / preview overrides
  const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(initialPdfUrl || null);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(initialPageImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync props when changed
  useEffect(() => {
    if (initialPdfUrl) setLocalPdfUrl(initialPdfUrl);
  }, [initialPdfUrl]);

  useEffect(() => {
    if (initialPageImageUrl) setLocalImageUrl(initialPageImageUrl);
  }, [initialPageImageUrl]);

  // Page Navigation State
  const [page, setPage] = useState<number>(currentPage);
  useEffect(() => {
    setPage(currentPage);
  }, [currentPage]);

  const handlePageSelect = (newPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, newPage));
    setPage(clamped);
    onPageChange?.(clamped);
  };

  // Zoom & Pan State
  const [zoom, setZoom] = useState<number>(1); // 1 = 100%
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState<boolean>(false);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Viewport & Canvas container refs
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  // Local Bounding Box Draft state
  const [activeBBox, setActiveBBox] = useState<BoundingBox | null>(boundingBox || null);
  const [cropStatusMessage, setCropStatusMessage] = useState<string | null>(null);
  const [localIsCropping, setLocalIsCropping] = useState<boolean>(false);

  // Sync bounding box when active question changes
  useEffect(() => {
    setActiveBBox(boundingBox || null);
  }, [boundingBox]);

  // Interactive Dragging State
  const [dragAction, setDragAction] = useState<DragAction>(null);
  const dragStartRef = useRef<{
    clientX: number;
    clientY: number;
    bbox: BoundingBox;
    containerRect: DOMRect;
  } | null>(null);

  // Handle Zoom operations
  const handleZoomIn = () => setZoom((prev) => Math.min(2.5, Number((prev + 0.2).toFixed(1))));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.5, Number((prev - 0.2).toFixed(1))));
  const handleZoomReset = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Direct PDF / Image Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      const url = URL.createObjectURL(file);
      setLocalPdfUrl(url);
      setLocalImageUrl(null);
    } else if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setLocalImageUrl(url);
    }
  };

  // Drag and drop file loader
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      const url = URL.createObjectURL(file);
      setLocalPdfUrl(url);
      setLocalImageUrl(null);
    } else if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setLocalImageUrl(url);
    }
  };

  // Convert client pointer coordinates to normalized 0-1000 space
  const clientToNormalized = useCallback(
    (clientX: number, clientY: number): { xNorm: number; yNorm: number } | null => {
      if (!pageContainerRef.current) return null;
      const rect = pageContainerRef.current.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      const xNorm = clamp((relX / rect.width) * 1000);
      const yNorm = clamp((relY / rect.height) * 1000);
      return { xNorm, yNorm };
    },
    []
  );

  // Pointer Down on Drag Handles or Bounding Box Body
  const handleHandlePointerDown = (
    action: DragAction,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (isPanMode) return;
    e.stopPropagation();
    e.preventDefault();

    if (!pageContainerRef.current || !activeBBox) return;
    const containerRect = pageContainerRef.current.getBoundingClientRect();

    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      bbox: { ...activeBBox },
      containerRect,
    };
    setDragAction(action);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Pointer Down on Canvas Overlay to Draw New Box
  const handleOverlayPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanMode) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      return;
    }

    if (!pageContainerRef.current) return;
    const norm = clientToNormalized(e.clientX, e.clientY);
    if (!norm) return;

    const initialBox: BoundingBox = {
      ymin: norm.yNorm,
      xmin: norm.xNorm,
      ymax: clamp(norm.yNorm + 5),
      xmax: clamp(norm.xNorm + 5),
      page_number: page,
    };

    const containerRect = pageContainerRef.current.getBoundingClientRect();
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      bbox: initialBox,
      containerRect,
    };

    setActiveBBox(initialBox);
    setDragAction("create");
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Pointer Move for Handles, Box Movement, and Drawing
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // 1. Pan Mode Movement
    if (isPanMode && isPanning) {
      setPanOffset({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
      return;
    }

    // 2. Bounding Box Transformations
    if (!dragAction || !dragStartRef.current || !pageContainerRef.current) return;

    const { bbox: startBox, containerRect } = dragStartRef.current;
    const dxNorm = ((e.clientX - dragStartRef.current.clientX) / containerRect.width) * 1000;
    const dyNorm = ((e.clientY - dragStartRef.current.clientY) / containerRect.height) * 1000;

    const minDimension = 15; // Minimum 1.5% size to avoid degenerate box
    let updated: BoundingBox = { ...startBox, page_number: page };

    switch (dragAction) {
      case "move": {
        const boxWidth = startBox.xmax - startBox.xmin;
        const boxHeight = startBox.ymax - startBox.ymin;

        let newXmin = clamp(startBox.xmin + dxNorm, 0, 1000 - boxWidth);
        let newYmin = clamp(startBox.ymin + dyNorm, 0, 1000 - boxHeight);

        updated = {
          ...updated,
          xmin: newXmin,
          ymin: newYmin,
          xmax: newXmin + boxWidth,
          ymax: newYmin + boxHeight,
        };
        break;
      }
      case "nw": {
        const newXmin = clamp(startBox.xmin + dxNorm, 0, startBox.xmax - minDimension);
        const newYmin = clamp(startBox.ymin + dyNorm, 0, startBox.ymax - minDimension);
        updated = { ...updated, xmin: newXmin, ymin: newYmin };
        break;
      }
      case "ne": {
        const newXmax = clamp(startBox.xmax + dxNorm, startBox.xmin + minDimension, 1000);
        const newYmin = clamp(startBox.ymin + dyNorm, 0, startBox.ymax - minDimension);
        updated = { ...updated, xmax: newXmax, ymin: newYmin };
        break;
      }
      case "sw": {
        const newXmin = clamp(startBox.xmin + dxNorm, 0, startBox.xmax - minDimension);
        const newYmax = clamp(startBox.ymax + dyNorm, startBox.ymin + minDimension, 1000);
        updated = { ...updated, xmin: newXmin, ymax: newYmax };
        break;
      }
      case "se": {
        const newXmax = clamp(startBox.xmax + dxNorm, startBox.xmin + minDimension, 1000);
        const newYmax = clamp(startBox.ymax + dyNorm, startBox.ymin + minDimension, 1000);
        updated = { ...updated, xmax: newXmax, ymax: newYmax };
        break;
      }
      case "n": {
        const newYmin = clamp(startBox.ymin + dyNorm, 0, startBox.ymax - minDimension);
        updated = { ...updated, ymin: newYmin };
        break;
      }
      case "s": {
        const newYmax = clamp(startBox.ymax + dyNorm, startBox.ymin + minDimension, 1000);
        updated = { ...updated, ymax: newYmax };
        break;
      }
      case "w": {
        const newXmin = clamp(startBox.xmin + dxNorm, 0, startBox.xmax - minDimension);
        updated = { ...updated, xmin: newXmin };
        break;
      }
      case "e": {
        const newXmax = clamp(startBox.xmax + dxNorm, startBox.xmin + minDimension, 1000);
        updated = { ...updated, xmax: newXmax };
        break;
      }
      case "create": {
        const norm = clientToNormalized(e.clientX, e.clientY);
        if (norm) {
          updated = {
            page_number: page,
            ymin: Math.min(startBox.ymin, norm.yNorm),
            xmin: Math.min(startBox.xmin, norm.xNorm),
            ymax: Math.max(startBox.ymin, norm.yNorm),
            xmax: Math.max(startBox.xmin, norm.xNorm),
          };
        }
        break;
      }
    }

    setActiveBBox(updated);
  };

  // Pointer Up Handler
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanMode && isPanning) {
      setIsPanning(false);
      return;
    }

    if (dragAction) {
      setDragAction(null);
      dragStartRef.current = null;
      if (activeBBox) {
        onBoundingBoxChange?.(activeBBox);
      }
    }
  };

  // Crop Action Handler
  const handleExecuteCrop = async () => {
    if (!activeBBox) {
      setCropStatusMessage("Please highlight or draw a diagram bounding box first.");
      return;
    }

    setLocalIsCropping(true);
    setCropStatusMessage(null);

    try {
      if (onCropDiagram) {
        await onCropDiagram(activeBBox);
        setCropStatusMessage("Diagram cropped successfully!");
      } else {
        // Fallback: direct API call to /api/ingest/crop
        const payload = {
          paperCode,
          questionNumber,
          bbox: activeBBox,
          imageUrl: localImageUrl || undefined,
          imageBase64: pageImageBase64 || undefined,
        };

        const res = await fetch("/api/ingest/crop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        setCropStatusMessage("Crop processed & uploaded to storage!");
        onBoundingBoxChange?.(data.bbox || activeBBox);
      }
    } catch (err: any) {
      console.error("[IngestionPdfViewer] Crop error:", err);
      setCropStatusMessage(err.message || "Failed to crop diagram.");
    } finally {
      setLocalIsCropping(false);
      setTimeout(() => setCropStatusMessage(null), 4000);
    }
  };

  // Clear Bounding Box
  const handleClearBBox = () => {
    setActiveBBox(null);
    onBoundingBoxChange?.(null);
  };

  const isBBoxActiveOnCurrentPage = activeBBox && activeBBox.page_number === page;

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-white rounded-2xl border-[1.5px] border-[#dcd3c4] shadow-sm overflow-hidden font-body text-[#201e1d] transition-all select-none",
        className
      )}
    >
      {/* Hidden File Input for PDF or Page Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* ========================================================= */}
      {/* 1. TOP HEADER & NAVIGATION TOOLBAR                        */}
      {/* ========================================================= */}
      <div className="bg-[#fcfaf6] border-b-2 border-[#201e1d] p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Left: Paper info & Page Controls */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-[#ffe1d0] text-[#c67139] border-2 border-[#201e1d] rounded-lg shadow-[1px_1px_0_#201e1d] shrink-0">
              <FileText className="w-4 h-4" />
            </span>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <span className="font-adminHeading font-bold text-xs sm:text-sm text-[#201e1d] tracking-tight">
                  PDF Canvas &amp; Cropper
                </span>
                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#eee7db] border border-[#dcd3c4] text-[#474238]">
                  {paperCode}
                </span>
              </div>
              <p className="text-[11px] font-mono font-semibold text-[#645c50]">
                Q{questionNumber} Target Canvas
              </p>
            </div>
          </div>

          <div className="h-6 w-[2px] bg-[#dcd3c4] hidden sm:block" />

          {/* Page Stepper Buttons & Numeric Input */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border-2 border-[#201e1d] shadow-[1.5px_1.5px_0_#201e1d]">
            <button
              type="button"
              onClick={() => handlePageSelect(page - 1)}
              disabled={page <= 1}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-[#eee7db] disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer text-[#201e1d]"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4 text-[#201e1d]" />
            </button>

            <div className="flex items-center gap-1 px-1 font-mono text-xs font-bold text-[#201e1d]">
              <span>Page</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={page}
                onChange={(e) => handlePageSelect(Number(e.target.value))}
                className="w-9 text-center py-0.5 rounded border border-[#dcd3c4] bg-[#fcfaf6] outline-none focus:border-[#c67139] font-bold text-[#201e1d] font-mono"
              />
              <span className="text-[#82796a]">/ {totalPages}</span>
            </div>

            <button
              type="button"
              onClick={() => handlePageSelect(page + 1)}
              disabled={page >= totalPages}
              className="p-1 sm:p-1.5 rounded-lg hover:bg-[#eee7db] disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer text-[#201e1d]"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4 text-[#201e1d]" />
            </button>
          </div>
        </div>

        {/* Right: Zoom, Pan & Crop Primary Action */}
        <div className="flex items-center gap-2 flex-wrap ml-auto">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border-2 border-[#201e1d] shadow-[1.5px_1.5px_0_#201e1d]">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 rounded-lg hover:bg-[#eee7db] transition-colors cursor-pointer text-[#201e1d]"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>

            <span className="w-11 text-center font-mono text-[11px] font-bold text-[#201e1d]">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 rounded-lg hover:bg-[#eee7db] transition-colors cursor-pointer text-[#201e1d]"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleZoomReset}
              className="px-2 py-0.5 rounded-md hover:bg-[#eee7db] text-[10px] font-adminHeading font-bold text-[#474238] border border-[#dcd3c4] transition-colors cursor-pointer"
              title="Reset Zoom to Fit"
            >
              Fit
            </button>
          </div>

          {/* Pan Toggle Button */}
          <button
            type="button"
            onClick={() => setIsPanMode(!isPanMode)}
            className={cn(
              "px-3 py-1.5 rounded-xl border-2 border-[#201e1d] font-adminHeading font-bold text-xs shadow-[1.5px_1.5px_0_#201e1d] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer",
              isPanMode
                ? "bg-[#ffe1d0] text-[#c67139]"
                : "bg-white hover:bg-[#eee7db] text-[#474238]"
            )}
            title={isPanMode ? "Pan Mode Active (Drag to Pan)" : "Switch to Pan Mode"}
          >
            <Move className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">{isPanMode ? "Panning" : "Pan"}</span>
          </button>

          {/* Direct Upload PDF / Image Source */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 bg-white hover:bg-[#eee7db] rounded-xl border-2 border-[#201e1d] text-xs font-adminHeading font-bold text-[#201e1d] shadow-[1.5px_1.5px_0_#201e1d] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5 cursor-pointer"
            title="Load PDF or Page Image"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Load PDF</span>
          </button>

          {/* Primary Action: Crop Diagram */}
          <button
            type="button"
            onClick={handleExecuteCrop}
            disabled={isCropping || localIsCropping || !isBBoxActiveOnCurrentPage}
            className={cn(
              "px-3.5 py-1.5 rounded-xl border-2 border-[#201e1d] text-xs sm:text-sm font-adminHeading font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-[2px_2px_0_#201e1d]",
              isCropping || localIsCropping
                ? "bg-[#ffe1d0] text-[#c67139] opacity-70 cursor-wait"
                : isBBoxActiveOnCurrentPage
                ? "bg-[#c67139] hover:bg-[#b2622d] text-[#f9f4ed] active:translate-y-0.5 active:shadow-none"
                : "bg-[#eee7db] text-[#82796a] opacity-60 cursor-not-allowed"
            )}
          >
            <Scissors className="w-4 h-4" />
            <span>
              {isCropping || localIsCropping ? "Cropping..." : "Crop Diagram"}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. SUB-BAR: COORDINATE STATUS & NOTIFICATIONS             */}
      {/* ========================================================= */}
      <div className="px-4 py-2 bg-[#fcfaf6] border-b border-[#dcd3c4] flex items-center justify-between text-xs font-mono shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {activeBBox ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-[#ffe1d0] text-[#c67139] border border-[#c67139]/30">
                <Crop className="w-3 h-3" />
                <span>
                  [{activeBBox.ymin}, {activeBBox.xmin}, {activeBBox.ymax}, {activeBBox.xmax}]
                </span>
              </span>
              <span className="text-[11px] text-[#645c50] font-sans">
                (Scale 0–1000 · Pg {activeBBox.page_number})
              </span>
              {activeBBox.page_number !== page && (
                <button
                  type="button"
                  onClick={() => handlePageSelect(activeBBox.page_number)}
                  className="text-[10px] font-sans font-bold text-[#c67139] underline hover:text-[#b2622d] ml-1 cursor-pointer"
                >
                  Jump to Page {activeBBox.page_number}
                </button>
              )}
            </div>
          ) : (
            <span className="text-[#82796a] font-sans italic text-[11px] flex items-center gap-1.5">
              <span>Click &amp; drag on canvas to outline diagram</span>
            </span>
          )}
        </div>

        {/* Status toast / reset bbox button */}
        <div className="flex items-center gap-2">
          {cropStatusMessage && (
            <span className="text-xs font-sans font-bold text-[#3d472b] bg-[#f0fae1] border border-[#8fa073] px-2 py-0.5 rounded-full flex items-center gap-1 animate-fadeIn">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#728157]" />
              {cropStatusMessage}
            </span>
          )}

          {activeBBox && (
            <button
              type="button"
              onClick={handleClearBBox}
              className="text-[11px] font-sans font-bold text-[#645c50] hover:text-[#b91c1c] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Clear Crop</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. INTERACTIVE PDF / IMAGE VIEWPORT & CROP CANVAS         */}
      {/* ========================================================= */}
      <div
        ref={viewportRef}
        className={cn(
          "relative flex-1 bg-[#f9f4ed] overflow-auto p-4 flex items-center justify-center min-h-[460px]",
          isPanMode ? (isPanning ? "cursor-grabbing" : "cursor-grab") : "cursor-crosshair"
        )}
      >
        {/* Render Canvas Wrapper with Zoom & Pan transform */}
        <div
          ref={pageContainerRef}
          onPointerDown={handleOverlayPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
            transformOrigin: "center center",
            transition: isPanning ? "none" : "transform 75ms ease-out",
          }}
          className="relative bg-white border-[1.5px] border-[#dcd3c4] rounded-xl shadow-md aspect-[1/1.414] w-[min(100%,560px)] min-h-[720px] overflow-hidden select-none"
        >
          {/* A. PDF / Page Rendering Layer */}
          {localImageUrl ? (
            <img
              src={localImageUrl}
              alt={`Cambridge Page ${page}`}
              className="w-full h-full object-contain pointer-events-none select-none"
              draggable={false}
            />
          ) : localPdfUrl ? (
            <object
              data={`${localPdfUrl}#page=${page}&toolbar=0&navpanes=0`}
              type="application/pdf"
              className="w-full h-full pointer-events-none select-none"
            >
              {/* Fallback iframe */}
              <iframe
                src={`${localPdfUrl}#page=${page}&toolbar=0&navpanes=0`}
                title={`PDF Page ${page}`}
                className="w-full h-full pointer-events-none border-none"
              />
            </object>
          ) : (
            /* Empty State: Neobrutalist dropzone to load Cambridge QP */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                "absolute inset-0 flex flex-col items-center justify-center p-8 text-center transition-all select-none",
                isDragOver
                  ? "bg-[#ffe1d0]/70 border-4 border-dashed border-[#c67139]"
                  : "bg-[#fffdf7]"
              )}
            >
              <div className="w-16 h-16 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center text-3xl shadow-[2px_2px_0_#201e1d] mb-3 text-[#c67139]">
                📄
              </div>
              <h4 className="font-adminHeading font-bold text-base sm:text-lg text-[#201e1d] mb-1">
                Cambridge PDF Source Canvas
              </h4>
              <p className="text-xs text-[#645c50] max-w-sm mb-5 font-medium leading-relaxed">
                Drop Cambridge Past Paper PDF here, or click to browse. Enables side-by-side verification and bounding-box diagram cropper.
              </p>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-[#201e1d] text-[#f9f4ed] rounded-full border-2 border-[#201e1d] font-adminHeading font-bold text-xs hover:bg-[#383431] shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none cursor-pointer transition-all flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Browse Past Paper PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Load sample mock page
                    setLocalImageUrl(`/questions/0455_2024_s_12_q3.png`);
                    setActiveBBox({
                      ymin: 150,
                      xmin: 120,
                      ymax: 850,
                      xmax: 880,
                      page_number: page,
                    });
                  }}
                  className="px-4 py-2 bg-[#f9f4ed] hover:bg-[#eee7db] text-[#201e1d] rounded-full border-2 border-[#201e1d] font-adminHeading font-bold text-xs shadow-[2px_2px_0_#201e1d] active:translate-y-0.5 active:shadow-none cursor-pointer transition-all"
                >
                  Load Sample Diagram
                </button>
              </div>
            </div>
          )}

          {/* B. Visual Bounding Box Overlay Layer (Active Question) */}
          {isBBoxActiveOnCurrentPage && (
            <div
              style={{
                top: `${(activeBBox.ymin / 1000) * 100}%`,
                left: `${(activeBBox.xmin / 1000) * 100}%`,
                width: `${((activeBBox.xmax - activeBBox.xmin) / 1000) * 100}%`,
                height: `${((activeBBox.ymax - activeBBox.ymin) / 1000) * 100}%`,
              }}
              className="absolute border-2 border-amber-500 bg-amber-400/20 shadow-sm z-10 transition-shadow select-none group"
            >
              {/* Draggable Interior Body */}
              <div
                onPointerDown={(e) => handleHandlePointerDown("move", e)}
                className="absolute inset-0 cursor-move flex items-center justify-center"
                title="Drag to reposition crop box"
              >
                {/* Normalized Coordinate Floating Badge */}
                <div className="px-2 py-0.5 rounded-md bg-slate-900/90 text-amber-300 border border-slate-800 text-[10px] font-mono font-bold shadow-md pointer-events-none select-none flex items-center gap-1.5 backdrop-blur-xs">
                  <span>Q{questionNumber}</span>
                  <span>
                    [{activeBBox.ymin}, {activeBBox.xmin}, {activeBBox.ymax}, {activeBBox.xmax}]
                  </span>
                </div>
              </div>

              {/* 4 Corner Drag Handles (3D Neobrutalist Pips) */}
              {/* Top-Left (NW) */}
              <div
                onPointerDown={(e) => handleHandlePointerDown("nw", e)}
                className="absolute -top-2 -left-2 w-4 h-4 bg-[#facc15] border-2 border-slate-900 rounded-sm shadow-xs cursor-nwse-resize z-20 hover:scale-125 transition-transform"
                title="Resize top-left"
              />
              {/* Top-Right (NE) */}
              <div
                onPointerDown={(e) => handleHandlePointerDown("ne", e)}
                className="absolute -top-2 -right-2 w-4 h-4 bg-[#facc15] border-2 border-slate-900 rounded-sm shadow-xs cursor-nesw-resize z-20 hover:scale-125 transition-transform"
                title="Resize top-right"
              />
              {/* Bottom-Left (SW) */}
              <div
                onPointerDown={(e) => handleHandlePointerDown("sw", e)}
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-[#facc15] border-2 border-slate-900 rounded-sm shadow-xs cursor-nesw-resize z-20 hover:scale-125 transition-transform"
                title="Resize bottom-left"
              />
              {/* Bottom-Right (SE) */}
              <div
                onPointerDown={(e) => handleHandlePointerDown("se", e)}
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#facc15] border-2 border-slate-900 rounded-sm shadow-xs cursor-nwse-resize z-20 hover:scale-125 transition-transform"
                title="Resize bottom-right"
              />

              {/* 4 Edge Drag Handles (Tactile Pills) */}
              {/* Top (N) */}
              <div
                onPointerDown={(e) => handleHandlePointerDown("n", e)}
                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-slate-900 border border-amber-400 rounded-full cursor-ns-resize z-20 hover:scale-110 transition-transform"
                title="Resize top edge"
              />
              {/* Bottom (S) */}
              <div
                onPointerDown={(e) => handleHandlePointerDown("s", e)}
                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-2.5 bg-slate-900 border border-amber-400 rounded-full cursor-ns-resize z-20 hover:scale-110 transition-transform"
                title="Resize bottom edge"
              />
              {/* Left (W) */}
              <div
                onPointerDown={(e) => handleHandlePointerDown("w", e)}
                className="absolute top-1/2 -left-1.5 -translate-y-1/2 w-2.5 h-6 bg-slate-900 border border-amber-400 rounded-full cursor-ew-resize z-20 hover:scale-110 transition-transform"
                title="Resize left edge"
              />
              {/* Right (E) */}
              <div
                onPointerDown={(e) => handleHandlePointerDown("e", e)}
                className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-6 bg-slate-900 border border-amber-400 rounded-full cursor-ew-resize z-20 hover:scale-110 transition-transform"
                title="Resize right edge"
              />
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. FOOTER: RAPID PAGE SLIDER SCRUBBER                    */}
      {/* ========================================================= */}
      <div className="bg-[#fcfaf6] border-t-[1.5px] border-[#dcd3c4] p-2.5 px-4 flex items-center justify-between gap-4 text-xs shrink-0">
        <span className="font-bold text-[#645c50] shrink-0">
          Page Scrubber
        </span>
        <input
          type="range"
          min={1}
          max={totalPages}
          value={page}
          onChange={(e) => handlePageSelect(Number(e.target.value))}
          className="flex-1 accent-[#c67139] cursor-pointer h-2 bg-[#eee7db] rounded-lg"
        />
        <span className="font-mono font-bold text-[#201e1d] shrink-0">
          {page} / {totalPages}
        </span>
      </div>
    </div>
  );
}

export default IngestionPdfViewer;

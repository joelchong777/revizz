"use client";

import React from "react";

export interface IngestionStudioFrameProps {
  children?: React.ReactNode;
  header?: React.ReactNode;
  progressShelf?: React.ReactNode;
  statusShelf?: React.ReactNode;
  mode?: "setup" | "workspace";
  className?: string;
}

/**
 * IngestionStudioFrame:
 * Master bounding container for the Live Ingestion Studio.
 * Unifies the floating header, extraction progress shelf, status shelf,
 * and workspace/wizard into a single cohesive neobrutalist element.
 */
export function IngestionStudioFrame({
  children,
  header,
  progressShelf,
  statusShelf,
  mode: _mode,
  className = "",
}: IngestionStudioFrameProps) {
  const hasShelf = Boolean(progressShelf || statusShelf);

  return (
    <main
      className={`bg-[#fbf7ee] border-2 border-[#201e1d] shadow-[4px_4px_0_#201e1d] rounded-3xl p-3 sm:p-5 md:p-6 flex flex-col gap-3.5 sm:gap-4 md:gap-5 font-body w-full max-w-[1720px] mx-auto relative transition-all duration-200 ${className}`}
      data-testid="ingestion-studio-frame"
    >
      {/* Docked Header Shelf */}
      {header && <div className="w-full shrink-0">{header}</div>}

      {/* Internal Notification / Extraction Shelf (Prevents Layout Shift) */}
      {hasShelf && (
        <section
          aria-label="Extraction & Status Shelf"
          className="w-full flex flex-col gap-2.5 sm:gap-3 transition-all duration-300"
        >
          {progressShelf}
          {statusShelf}
        </section>
      )}

      {/* Main Studio Viewport (Setup Wizard or Dual-Pane Workspace) */}
      <div className="w-full flex-1 flex flex-col min-h-0">{children}</div>
    </main>
  );
}

export default IngestionStudioFrame;

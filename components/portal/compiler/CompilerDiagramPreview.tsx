'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  RotateCcw,
  ZoomIn,
  X,
  ExternalLink,
  Image as ImageIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { resolveDiagramUrl } from '@/lib/resolveDiagramUrl';
import { cn } from '@/lib/utils';

export { resolveDiagramUrl };

export interface CompilerDiagramPreviewProps {
  imageUrl?: string | null;
  altText?: string;
  citation?: string;
  className?: string;
  maxThumbnailHeight?: string;
}

/**
 * Defensive, tactile neobrutalist diagram preview component for Revizz Test Compiler.
 * - Guarantees canonical resolution via resolveDiagramUrl.
 * - Handles image loading errors gracefully with warning badge & retry CTA.
 * - Provides full-screen lightbox zoom with Esc key and backdrop click-to-close.
 * - Respects §12 motion rules with snappy tween transitions.
 */
export function CompilerDiagramPreview({
  imageUrl,
  altText,
  citation,
  className,
  maxThumbnailHeight,
}: CompilerDiagramPreviewProps) {
  const [mounted, setMounted] = useState(false);
  const [attemptSource, setAttemptSource] = useState<'primary' | 'fallback-local' | 'failed'>('primary');
  const [retryCount, setRetryCount] = useState(0);
  const [isZoomOpen, setIsZoomOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute canonical Supabase CDN resolved URL
  const resolvedUrl = useMemo(() => {
    return resolveDiagramUrl(imageUrl) || (imageUrl?.trim() || undefined);
  }, [imageUrl]);

  // Reset state when incoming image prop changes
  useEffect(() => {
    setAttemptSource('primary');
    setRetryCount(0);
    setIsZoomOpen(false);
  }, [imageUrl]);

  // Keyboard shortcut listener: close zoom lightbox on Escape
  useEffect(() => {
    if (!isZoomOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsZoomOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isZoomOpen]);

  // Derive the active source URL based on the current attempt
  const activeSrc = useMemo(() => {
    if (attemptSource === 'failed') return null;
    let base: string | undefined;
    if (attemptSource === 'fallback-local') {
      base = imageUrl && imageUrl.trim().startsWith('/') ? imageUrl.trim() : resolvedUrl;
    } else {
      base = resolvedUrl || imageUrl?.trim() || undefined;
    }
    if (!base) return null;
    return retryCount > 0 ? `${base}${base.includes('?') ? '&' : '?'}retry=${retryCount}` : base;
  }, [attemptSource, resolvedUrl, imageUrl, retryCount]);

  const handleImageError = () => {
    if (
      attemptSource === 'primary' &&
      imageUrl &&
      imageUrl.trim().startsWith('/') &&
      imageUrl.trim() !== resolvedUrl
    ) {
      // Try local relative path as fallback attempt before marking completely failed
      setAttemptSource('fallback-local');
    } else {
      setAttemptSource('failed');
    }
  };

  const handleRetry = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAttemptSource('primary');
    setRetryCount((c) => c + 1);
  };

  // If no imageUrl was supplied at all, render nothing
  if (!imageUrl || !imageUrl.trim()) {
    return null;
  }

  // Fallback card when image fails to load
  if (attemptSource === 'failed' || !activeSrc) {
    return (
      <div
        className={cn(
          'rounded-xl border-2 border-dashed border-[#dcd3c4] bg-[#fbf9f5] p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left',
          className
        )}
      >
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#ffe1d0] border border-[#c67139] text-[#c67139] font-mono text-[11px] font-bold tracking-wide uppercase">
              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" /> Diagram unavailable
            </span>
            {citation && (
              <span className="font-mono text-xs text-[#201e1d] font-bold bg-[#eee7db] px-2 py-0.5 rounded truncate max-w-[200px]">
                {citation}
              </span>
            )}
          </div>
          <p className="text-xs text-[#645c50] mt-0.5 leading-relaxed font-sans">
            Unable to load diagram asset from storage or local source.
            {altText && altText !== 'Question diagram' && (
              <span className="block italic text-[11px] text-[#8c8273] mt-0.5 truncate max-w-md">
                Alt: {altText}
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRetry}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-[#201e1d] bg-white text-[#201e1d] text-xs font-bold font-mono shadow-[2px_2px_0px_#201e1d] hover:bg-[#ffe1d0] hover:text-[#c67139] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Retry
        </button>
      </div>
    );
  }

  // Lightbox Modal JSX
  const modalContent = (
    <AnimatePresence>
      {isZoomOpen && (
        <motion.div
          key="diagram-lightbox-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setIsZoomOpen(false)}
        >
          <motion.div
            key="diagram-lightbox-dialog"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Diagram lightbox${citation ? ` - ${citation}` : ''}`}
            className="relative max-w-4xl w-full max-h-[90vh] bg-[#f7f4ee] rounded-2xl border-2 border-[#201e1d] shadow-[6px_6px_0px_#201e1d] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-[#eee7db] border-b-2 border-[#201e1d] px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <ImageIcon className="w-4 h-4 text-[#c67139] shrink-0" aria-hidden="true" />
                <span className="font-bold text-sm text-[#201e1d] truncate">
                  Diagram Inspector
                </span>
                {citation && (
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[#201e1d] text-white uppercase truncate max-w-[240px]">
                    {citation}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsZoomOpen(false)}
                aria-label="Close diagram lightbox"
                className="w-8 h-8 rounded-lg border-2 border-[#201e1d] bg-white text-[#201e1d] hover:bg-[#ffe1d0] hover:text-[#c67139] flex items-center justify-center font-bold text-sm shadow-[2px_2px_0px_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer transition-all shrink-0"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* High-Resolution Diagram Preview */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-white flex items-center justify-center min-h-[280px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeSrc}
                alt={altText || (citation ? `Diagram for ${citation}` : 'Question diagram full view')}
                className="max-w-full max-h-[70vh] object-contain select-none rounded-lg"
              />
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-[#eee7db] border-t-2 border-[#201e1d] flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#645c50]">
              <span className="flex items-center gap-1.5">
                Press <kbd className="px-1.5 py-0.5 bg-white border border-[#dcd3c4] rounded font-bold text-[#201e1d]">Esc</kbd> or click backdrop to close
              </span>
              {activeSrc && (
                <a
                  href={activeSrc}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-[#201e1d] text-[#c67139] font-bold underline transition-colors"
                >
                  Open raw asset <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </a>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={cn('inline-block', className)}>
      <div className="group/diagram relative inline-block rounded-xl border-2 border-[#dcd3c4] hover:border-[#201e1d] bg-white p-1.5 transition-all shadow-[2px_2px_0px_rgba(0,0,0,0.04)] hover:shadow-[3px_3px_0px_#201e1d]">
        <button
          type="button"
          onClick={() => setIsZoomOpen(true)}
          className="relative block cursor-zoom-in text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c67139] rounded-lg overflow-hidden"
          aria-label={`Enlarge diagram${citation ? ` for ${citation}` : ''}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeSrc}
            alt={altText || (citation ? `Diagram for ${citation}` : 'Question diagram')}
            onError={handleImageError}
            className={cn(
              'w-auto object-contain rounded-md bg-white transition-transform duration-150 group-hover/diagram:scale-[1.01]',
              maxThumbnailHeight || 'max-h-36 sm:max-h-40'
            )}
          />
          <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/diagram:opacity-100 transition-opacity rounded-md flex items-end justify-end p-2 pointer-events-none">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#201e1d] text-white text-[10px] font-mono font-bold shadow-sm">
              <ZoomIn className="w-3 h-3" aria-hidden="true" /> Zoom
            </span>
          </div>
        </button>

        <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-[#645c50] px-1 gap-2">
          <span className="flex items-center gap-1">
            <ZoomIn className="w-2.5 h-2.5 opacity-60" aria-hidden="true" /> Click to enlarge
          </span>
          {citation && <span className="opacity-70 truncate max-w-[120px]">{citation}</span>}
        </div>
      </div>

      {mounted && typeof document !== 'undefined' && createPortal(modalContent, document.body)}
    </div>
  );
}

'use client';

import React, { useEffect } from 'react';
import { Check } from 'lucide-react';
import { IngestedPaperSummary } from '@/lib/questions';
import { playPop } from '@/lib/audio';
import { cn } from '@/lib/utils';

export interface PaperPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  papers: IngestedPaperSummary[];
  selectedPaperId: string | null;
  onSelectPaper: (paper: IngestedPaperSummary) => void;
  subjectName: string;
  loading?: boolean;
}

export function PaperPickerModal({
  isOpen,
  onClose,
  papers,
  selectedPaperId,
  onSelectPaper,
  subjectName,
  loading = false,
}: PaperPickerModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="paper-picker-modal"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[500px] max-h-[85vh] overflow-y-auto p-5 sm:p-6 pb-6 rounded-3xl bg-bg border-2 border-text shadow-offset-6 flex flex-col gap-4 animate-in fade-in-50 zoom-in-95 duration-200 select-none"
      >
        {/* Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">📑</span>
              <div>
                <h3 className="font-heading text-xl sm:text-2xl text-text m-0 leading-tight">
                  Choose Past Paper
                </h3>
                <span className="text-xs font-semibold text-neutral-700">
                  {subjectName} · Cambridge Official Exams
                </span>
              </div>
            </div>
            <button
              type="button"
              data-testid="paper-modal-close"
              onClick={() => {
                playPop();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-neutral-100 border-2 border-text shadow-offset-2 flex items-center justify-center cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none text-text hover:bg-neutral-200"
              aria-label="Close paper selector"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-text/10">
            <span className="text-xs font-semibold text-neutral-700">
              {loading
                ? 'Loading papers...'
                : `${papers.length} paper${papers.length === 1 ? '' : 's'} available`}
            </span>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <span className="text-3xl animate-bounce">⏳</span>
            <span className="font-heading text-base text-text">Loading past papers...</span>
          </div>
        ) : papers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-text/30 rounded-2xl bg-neutral-100/50 gap-2">
            <span className="text-3xl">📭</span>
            <span className="font-heading text-base sm:text-lg text-text">
              No ingested papers available yet for this subject.
            </span>
            <p className="text-xs text-neutral-600 max-w-xs m-0">
              Try selecting another subject or check back soon as more Cambridge papers are staged.
            </p>
          </div>
        ) : (
          <div
            role="listbox"
            data-testid="paper-picker-menu"
            className="flex flex-col gap-2.5 max-h-[48vh] overflow-y-auto pr-1"
          >
            {papers.map((paper) => {
              const isSelected =
                selectedPaperId === paper.id || selectedPaperId === paper.cleanId;

              return (
                <div
                  key={paper.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    playPop();
                    onSelectPaper(paper);
                    onClose();
                  }}
                  className={cn(
                    'w-full p-3.5 sm:p-4 rounded-2xl border-2 text-left cursor-pointer transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none',
                    isSelected
                      ? 'bg-accent-2-300 border-text shadow-none translate-x-[2px] translate-y-[2px]'
                      : 'bg-white/90 border-text shadow-offset-2 hover:bg-white hover:border-text active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
                  )}
                >
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading text-base sm:text-lg text-text leading-snug">
                        {paper.title || `${paper.seriesLabel} ${paper.year} · Paper ${paper.paperCode}`}
                      </span>
                      {paper.isPublished && (
                        <span className="px-2 py-0.5 rounded-full bg-accent-300 border border-text/30 text-[10px] font-bold text-text uppercase tracking-wider">
                          Official
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full bg-neutral-200/90 border border-text/30 text-xs font-bold text-text flex items-center gap-1">
                        <span>📄</span>
                        <span>{paper.questionsCount} Qs</span>
                      </span>
                      {paper.diagramsCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-accent-300/60 border border-text/30 text-xs font-bold text-text flex items-center gap-1">
                          <span>📊</span>
                          <span>{paper.diagramsCount} Diagrams</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      playPop();
                      onSelectPaper(paper);
                      onClose();
                    }}
                    className={cn(
                      'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer',
                      isSelected
                        ? 'bg-text text-neutral-100 shadow-none'
                        : 'bg-accent hover:bg-accent-600 text-neutral-100 border border-text shadow-offset-2 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
                    )}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Selected</span>
                      </>
                    ) : (
                      'Select Paper'
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-text/10 flex flex-col gap-1.5">
          <button
            type="button"
            data-testid="paper-modal-done"
            onClick={() => {
              playPop();
              onClose();
            }}
            className="w-full py-3.5 rounded-2xl bg-accent text-neutral-100 font-heading text-lg border-2 border-text shadow-offset-3 hover:bg-accent-600 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer flex items-center justify-center gap-2 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaperPickerModal;

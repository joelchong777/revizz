'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Check, SlidersHorizontal, ChevronDown } from 'lucide-react';
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
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [selectedPaperCode, setSelectedPaperCode] = useState<string>('all');
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const filterPopupRef = useRef<HTMLDivElement>(null);

  const availableYears = useMemo(() => {
    const years = Array.from(
      new Set(
        papers
          .map((p) => p.year)
          .filter((y): y is number => typeof y === 'number' && !isNaN(y))
      )
    );
    return years.sort((a, b) => b - a);
  }, [papers]);

  const availablePaperCodes = useMemo(() => {
    const codes = Array.from(
      new Set(
        papers
          .map((p) => p.paperCode)
          .filter((c): c is string => Boolean(c))
      )
    );
    return codes.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [papers]);

  const filteredPapers = useMemo(() => {
    return papers.filter((paper) => {
      if (selectedYear !== 'all' && paper.year !== selectedYear) return false;
      if (selectedPaperCode !== 'all' && paper.paperCode !== selectedPaperCode) return false;
      return true;
    });
  }, [papers, selectedYear, selectedPaperCode]);

  const isFiltering = selectedYear !== 'all' || selectedPaperCode !== 'all';
  const activeFilterCount = (selectedYear !== 'all' ? 1 : 0) + (selectedPaperCode !== 'all' ? 1 : 0);

  const filterSummary = useMemo(() => {
    if (!isFiltering) return 'Filter Papers by Year & Paper Number';
    const parts: string[] = [];
    if (selectedYear !== 'all') parts.push(`Year ${selectedYear}`);
    if (selectedPaperCode !== 'all') parts.push(`Paper ${selectedPaperCode}`);
    return parts.join(' · ');
  }, [isFiltering, selectedYear, selectedPaperCode]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isFilterPopupOpen) {
          setIsFilterPopupOpen(false);
          return;
        }
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isFilterPopupOpen]);

  useEffect(() => {
    if (!isFilterPopupOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        filterPopupRef.current &&
        !filterPopupRef.current.contains(event.target as Node)
      ) {
        setIsFilterPopupOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterPopupOpen]);

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
                : isFiltering
                ? `${filteredPapers.length} of ${papers.length} papers`
                : `${papers.length} paper${papers.length === 1 ? '' : 's'} available`}
            </span>
            {isFiltering && (
              <button
                type="button"
                data-testid="paper-clear-filters"
                onClick={() => {
                  playPop();
                  setSelectedYear('all');
                  setSelectedPaperCode('all');
                }}
                className="text-xs font-bold text-accent hover:underline cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {!loading && papers.length > 0 && (
            <div className="relative w-full" ref={filterPopupRef}>
              <button
                type="button"
                data-testid="paper-filters-button"
                aria-expanded={isFilterPopupOpen}
                onClick={() => {
                  playPop();
                  setIsFilterPopupOpen((prev) => !prev);
                }}
                className={cn(
                  'w-full py-2.5 px-3.5 rounded-2xl border-2 border-text text-xs sm:text-sm font-bold flex items-center justify-between cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
                  isFilterPopupOpen || isFiltering
                    ? 'bg-accent text-neutral-100 shadow-offset-2'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-text shadow-offset-2'
                )}
              >
                <div className="flex items-center gap-2 truncate">
                  <SlidersHorizontal className="w-4 h-4 shrink-0" />
                  <span className="truncate">{filterSummary}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isFiltering && (
                    <span className="w-5 h-5 rounded-full bg-neutral-100 text-text border border-text text-[10px] font-black flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 transition-transform duration-200',
                      isFilterPopupOpen && 'rotate-180'
                    )}
                  />
                </div>
              </button>

              {isFilterPopupOpen && (
                <div
                  role="dialog"
                  aria-label="Filter Papers"
                  data-testid="paper-filter-popup"
                  className="absolute left-0 right-0 top-full mt-2 z-30 w-full p-4 rounded-2xl bg-[#f9f4ed] border-2 border-text shadow-offset-4 flex flex-col gap-3.5"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-sm text-text">Filter Papers</span>
                    {isFiltering && (
                      <button
                        type="button"
                        data-testid="paper-popup-reset-filters"
                        onClick={() => {
                          playPop();
                          setSelectedYear('all');
                          setSelectedPaperCode('all');
                        }}
                        className="text-xs font-bold text-accent hover:underline cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Year */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-heading font-black text-neutral-700">
                      Year
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto pr-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedYear !== 'all') {
                            playPop();
                            setSelectedYear('all');
                          }
                        }}
                        className={cn(
                          'px-2.5 py-1 transition-all cursor-pointer',
                          selectedYear === 'all'
                            ? 'bg-accent text-neutral-100 border border-text shadow-offset-1 text-xs font-bold rounded-xl'
                            : 'border border-text/40 bg-white/90 text-xs font-bold rounded-xl text-text hover:bg-white'
                        )}
                      >
                        All
                      </button>
                      {availableYears.map((year) => (
                        <button
                          key={year}
                          type="button"
                          onClick={() => {
                            if (selectedYear !== year) {
                              playPop();
                              setSelectedYear(year);
                            }
                          }}
                          className={cn(
                            'px-2.5 py-1 transition-all cursor-pointer',
                            selectedYear === year
                              ? 'bg-accent text-neutral-100 border border-text shadow-offset-1 text-xs font-bold rounded-xl'
                              : 'border border-text/40 bg-white/90 text-xs font-bold rounded-xl text-text hover:bg-white'
                          )}
                        >
                          {year}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Paper Variant */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-heading font-black text-neutral-700">
                      Paper Variant
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto pr-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedPaperCode !== 'all') {
                            playPop();
                          }
                          setSelectedPaperCode('all');
                        }}
                        className={cn(
                          'px-2.5 py-1 transition-all cursor-pointer',
                          selectedPaperCode === 'all'
                            ? 'bg-accent text-neutral-100 border border-text shadow-offset-1 text-xs font-bold rounded-xl'
                            : 'border border-text/40 bg-white/90 text-xs font-bold rounded-xl text-text hover:bg-white'
                        )}
                      >
                        All
                      </button>
                      {availablePaperCodes.map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            if (selectedPaperCode !== code) {
                              playPop();
                              setSelectedPaperCode(code);
                            }
                          }}
                          className={cn(
                            'px-2.5 py-1 transition-all cursor-pointer',
                            selectedPaperCode === code
                              ? 'bg-accent text-neutral-100 border border-text shadow-offset-1 text-xs font-bold rounded-xl'
                              : 'border border-text/40 bg-white/90 text-xs font-bold rounded-xl text-text hover:bg-white'
                          )}
                        >
                          Paper {code}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Done Button */}
                  <button
                    type="button"
                    data-testid="paper-popup-done"
                    onClick={() => {
                      playPop();
                      setIsFilterPopupOpen(false);
                    }}
                    className="w-full py-2 rounded-xl bg-accent text-neutral-100 font-heading text-sm border-2 border-text shadow-offset-2 hover:bg-accent-600 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer flex items-center justify-center transition-all"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          )}
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
        ) : filteredPapers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-text/30 rounded-2xl bg-neutral-100/50 gap-3">
            <span className="text-3xl">🔍</span>
            <span className="font-heading text-base sm:text-lg text-text">
              No papers match the selected filters
            </span>
            <button
              type="button"
              onClick={() => {
                playPop();
                setSelectedYear('all');
                setSelectedPaperCode('all');
              }}
              className="px-4 py-2 rounded-xl bg-accent text-neutral-100 border-2 border-text font-bold text-xs shadow-offset-2 hover:bg-accent-600 active:translate-y-0.5 cursor-pointer"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div
            role="listbox"
            data-testid="paper-picker-menu"
            className="flex flex-col gap-2.5 max-h-[48vh] overflow-y-auto pr-1"
          >
            {filteredPapers.map((paper) => {
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

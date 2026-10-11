'use client';

import React, { useEffect, useMemo } from 'react';
import type { StagingOption } from '@/types/ingestion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';

export interface IngestionOptionsEditorProps {
  options: StagingOption[];
  onChangeOption: (label: 'A' | 'B' | 'C' | 'D', content: string) => void;
  onSetCorrect: (label: 'A' | 'B' | 'C' | 'D') => void;
  className?: string;
}

const OPTION_LABELS: readonly ['A', 'B', 'C', 'D'] = ['A', 'B', 'C', 'D'] as const;

export function IngestionOptionsEditor({
  options,
  onChangeOption,
  onSetCorrect,
  className,
}: IngestionOptionsEditorProps) {
  // Build a lookup map of options by label
  const optionMap = useMemo(() => {
    const map = new Map<'A' | 'B' | 'C' | 'D', StagingOption>();
    for (const opt of options || []) {
      if (opt && opt.label) {
        map.set(opt.label, opt);
      }
    }
    return map;
  }, [options]);

  // Global hotkeys (1/A -> A, 2/B -> B, 3/C -> C, 4/D -> D) when focus is not inside an input/textarea
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isInput) return;

      const key = e.key.toUpperCase();
      if (key === '1' || key === 'A') {
        e.preventDefault();
        onSetCorrect('A');
      } else if (key === '2' || key === 'B') {
        e.preventDefault();
        onSetCorrect('B');
      } else if (key === '3' || key === 'C') {
        e.preventDefault();
        onSetCorrect('C');
      } else if (key === '4' || key === 'D') {
        e.preventDefault();
        onSetCorrect('D');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSetCorrect]);

  return (
    <div
      role="radiogroup"
      aria-label="4-Option MCQ Matrix"
      className={cn('flex flex-col gap-2.5', className)}
    >
      {OPTION_LABELS.map((label) => {
        const opt = optionMap.get(label) || {
          label,
          content_markdown: '',
          is_correct: false,
        };
        const isCorrect = Boolean(opt.is_correct);

        return (
          <div
            key={label}
            className={cn(
              'group flex items-start gap-3 p-2.5 sm:p-3 rounded-xl border-2 border-[#201e1d] shadow-offset-2 transition-all duration-150',
              isCorrect
                ? 'bg-[#f0fae1] ring-2 ring-[#22C55E]/40 border-[#201e1d]'
                : 'bg-white hover:bg-neutral-50/80'
            )}
          >
            {/* Left: Option label badge + clickable radio circle */}
            <button
              type="button"
              role="radio"
              aria-checked={isCorrect}
              aria-label={`Option ${label}: Click to set as correct answer`}
              onClick={() => onSetCorrect(label)}
              title={`Set Option ${label} as correct answer (Press ${label} or ${
                label === 'A' ? 1 : label === 'B' ? 2 : label === 'C' ? 3 : 4
              })`}
              className={cn(
                'flex items-center gap-2 p-1 rounded-lg transition-all cursor-pointer select-none shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]',
                isCorrect ? 'text-[#22C55E]' : 'text-neutral-500 hover:text-[#201e1d]'
              )}
            >
              {/* Option label badge */}
              <div
                className={cn(
                  'w-8 h-8 rounded-lg border-2 border-[#201e1d] font-heading font-black text-sm sm:text-base flex items-center justify-center transition-all select-none',
                  isCorrect
                    ? 'bg-[#22C55E] text-white shadow-sm'
                    : 'bg-brand-yellow text-[#201e1d]'
                )}
              >
                {label}
              </div>

              {/* Clickable radio circle */}
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
                  isCorrect
                    ? 'border-[#22C55E] bg-[#22C55E] text-white'
                    : 'border-neutral-400 bg-white group-hover:border-[#201e1d]'
                )}
              >
                {isCorrect ? (
                  <span className="w-2 h-2 rounded-full bg-white block" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-transparent group-hover:bg-neutral-300 block" />
                )}
              </div>
            </button>

            {/* Center / Content: Clean input & subtle inline KaTeX math preview */}
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <textarea
                id={`option-${label}-content`}
                value={opt.content_markdown}
                onChange={(e) => onChangeOption(label, e.target.value)}
                rows={1}
                placeholder={`Option ${label} content (e.g. $P \\times Q$ or Opportunity Cost)...`}
                className={cn(
                  'w-full px-3 py-1.5 text-sm font-mono rounded-lg border-2 border-[#201e1d] bg-white text-[#201e1d] outline-none transition-colors resize-y min-h-[38px] placeholder:text-neutral-400 leading-normal',
                  isCorrect
                    ? 'focus:border-[#22C55E] focus:ring-1 focus:ring-[#22C55E]'
                    : 'focus:border-[#201e1d] focus:ring-1 focus:ring-[#201e1d]'
                )}
              />

              {/* Subtle inline rendered math preview directly below when content is typed */}
              {opt.content_markdown && opt.content_markdown.trim() ? (
                <div className="px-2.5 py-1 rounded-md bg-[#f9f4ed] border border-[#201e1d]/30 text-xs text-[#201e1d] break-words flex items-center gap-2 overflow-x-auto">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 shrink-0 font-mono select-none">
                    Preview:
                  </span>
                  <div className="prose prose-xs max-w-none text-[#201e1d] inline-block font-sans">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {sanitizeKaTeX(opt.content_markdown)}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}

      {/* Subtle keyboard hint at the bottom */}
      <div className="flex items-center justify-between text-xs text-neutral-500 pt-1 px-1 select-none">
        <span className="flex items-center gap-1.5 font-medium">
          <kbd className="px-1.5 py-0.5 rounded bg-neutral-200 border border-[#201e1d] font-mono text-[11px] font-bold text-neutral-700">
            1-4
          </kbd>
          <span>or</span>
          <kbd className="px-1.5 py-0.5 rounded bg-neutral-200 border border-[#201e1d] font-mono text-[11px] font-bold text-neutral-700">
            A-D
          </kbd>
          <span className="text-neutral-600">Tip: Press keys 1-4 or A-D to set correct answer</span>
        </span>
      </div>
    </div>
  );
}

export default IngestionOptionsEditor;

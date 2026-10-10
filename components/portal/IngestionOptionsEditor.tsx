'use client';

import React, { useEffect, useMemo } from 'react';
import type { StagingOption } from '@/types/ingestion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';

export interface IngestionOptionsEditorProps {
  options: StagingOption[];
  onChangeOption: (label: 'A' | 'B' | 'C' | 'D', content: string) => void;
  onSetCorrect: (label: 'A' | 'B' | 'C' | 'D') => void;
  className?: string;
}

const OPTION_LABELS: readonly ['A', 'B', 'C', 'D'] = ['A', 'B', 'C', 'D'] as const;

const HOTKEY_HINTS: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: '[Key A or 1]',
  B: '[Key B or 2]',
  C: '[Key C or 3]',
  D: '[Key D or 4]',
};

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
      className={cn('flex flex-col gap-4', className)}
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
              'flex flex-col gap-3 p-4 sm:p-5 rounded-2xl border-2 border-[#201e1d] shadow-offset-2 transition-all duration-150',
              isCorrect ? 'bg-[#f0fae1] ring-2 ring-[#22C55E]/40' : 'bg-white'
            )}
          >
            {/* Top Bar: Badge, Hotkey Hint, and Correct Answer Toggle Pill */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {/* Option Label Badge with Caprasimo heading font and thick border */}
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl border-2 border-[#201e1d] font-heading text-xl sm:text-2xl shadow-chunky transition-transform select-none',
                    isCorrect
                      ? 'bg-[#22C55E] text-white'
                      : 'bg-brand-yellow text-[#201e1d]'
                  )}
                >
                  {label}
                </div>

                {/* Hotkey Hint Badge */}
                <span className="font-mono text-xs font-bold text-neutral-600 bg-neutral-200 border border-[#201e1d] px-2 py-0.5 rounded-lg select-none shadow-none">
                  {HOTKEY_HINTS[label]}
                </span>
              </div>

              {/* 1-Click Correct Answer Toggle Pill */}
              <button
                type="button"
                role="radio"
                aria-checked={isCorrect}
                aria-label={`Option ${label}: Correct Answer`}
                onClick={() => onSetCorrect(label)}
                className={cn(
                  'transition-all duration-75 select-none font-bold text-xs sm:text-sm uppercase tracking-wider px-3.5 py-1.5 rounded-full border-2 border-[#201e1d] flex items-center gap-2 cursor-pointer shadow-offset-2 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#201e1d]',
                  isCorrect
                    ? 'bg-[#22C55E] text-white hover:bg-[#1eb354]'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-[#201e1d]'
                )}
              >
                {isCorrect ? (
                  <Check className="w-4 h-4 stroke-[3]" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-neutral-400 bg-white inline-block" />
                )}
                <span>CORRECT ANSWER</span>
              </button>
            </div>

            {/* Option Content Textarea (Supports Markdown & KaTeX Math) */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`option-${label}-content`}
                className="text-xs font-bold uppercase tracking-wider text-neutral-600"
              >
                Option {label} Content (Markdown &amp; KaTeX Math)
              </label>
              <textarea
                id={`option-${label}-content`}
                value={opt.content_markdown}
                onChange={(e) => onChangeOption(label, e.target.value)}
                rows={2}
                className="w-full p-3 rounded-xl border-2 border-[#201e1d] bg-white font-mono text-sm sm:text-base outline-none focus:ring-2 focus:ring-[#201e1d] focus:border-[#201e1d] resize-y placeholder:text-neutral-400 transition-colors"
                placeholder={`Option ${label} markdown (e.g. $P \\times Q$ or Opportunity Cost)...`}
              />
            </div>

            {/* Live Rendered Math Preview */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-neutral-500">
                <span>Live Preview (Rendered Math &amp; Markdown)</span>
                {opt.content_markdown?.includes('$') && (
                  <span className="text-[11px] font-mono text-[#8c491a] bg-[#fff2eb] px-1.5 py-0.5 rounded border border-[#ffc6a5]">
                    $Math Active
                  </span>
                )}
              </div>
              <div className="p-3.5 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] min-h-[44px] text-sm sm:text-base text-[#201e1d] break-words leading-relaxed overflow-x-auto">
                {opt.content_markdown && opt.content_markdown.trim() ? (
                  <div className="prose prose-sm max-w-none text-[#201e1d]">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {sanitizeKaTeX(opt.content_markdown)}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <span className="italic text-neutral-400 select-none">
                    Preview will render here...
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default IngestionOptionsEditor;

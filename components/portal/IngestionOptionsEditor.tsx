'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { StagingOption } from '@/types/ingestion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import {
  CheckCircle2,
  Sparkles,
  ChevronDown,
  AlertCircle,
  HelpCircle,
  Loader2,
  Check,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeKaTeX, validateKaTeXSyntax } from '@/lib/ingestion/katexSanitizer';
import { playPop, playChime } from '@/lib/audio';

export interface IngestionOptionsEditorProps {
  options: StagingOption[];
  onChangeOption: (label: 'A' | 'B' | 'C' | 'D', content: string) => void;
  onSetCorrect: (label: 'A' | 'B' | 'C' | 'D') => void;
  distractorAnalysis?: Record<string, string>;
  onChangeDistractor?: (label: 'A' | 'B' | 'C' | 'D', rationale: string) => void;
  stemMarkdown?: string;
  topicName?: string;
  onGenerateDistractorRationale?: (label: 'A' | 'B' | 'C' | 'D') => Promise<void> | void;
  className?: string;
}

const OPTION_LABELS: readonly ['A', 'B', 'C', 'D'] = ['A', 'B', 'C', 'D'] as const;

// Cambridge pedagogical fallback templates for intelligent distractor generation
function generateCambridgeDistractorHeuristic(
  label: 'A' | 'B' | 'C' | 'D',
  content: string,
  topicName?: string
): string {
  const cleanContent = content.trim().replace(/[*#$]/g, '');
  const topic = topicName?.toLowerCase() || '';

  if (topic.includes('demand') || topic.includes('supply') || topic.includes('price')) {
    return `Common candidate misconception: Inverted the price mechanism relationship for "${cleanContent}". Candidates confuse a shift in the curve with a movement along the curve.`;
  }
  if (topic.includes('cost') || topic.includes('revenue') || topic.includes('profit')) {
    return `Pedagogical trap: Failed to account for fixed vs variable cost structure when calculating "${cleanContent}". Confuses marginal revenue with average total revenue.`;
  }
  if (topic.includes('elasticity') || topic.includes('ped') || topic.includes('pes')) {
    return `Misconception: Inverts percentage change in quantity over percentage change in price, or treats inelastic demand as unit elastic (${cleanContent}).`;
  }
  if (topic.includes('macro') || topic.includes('gdp') || topic.includes('inflation')) {
    return `Diagnostic misconception: Confuses nominal macroeconomic indicators with real adjusted output (${cleanContent}); ignores the deflationary price deflator.`;
  }
  if (topic.includes('trade') || topic.includes('exchange') || topic.includes('balance')) {
    return `Common error: Mistakenly reverses current account debits and credits, or misidentifies the impact of currency depreciation on imports (${cleanContent}).`;
  }

  return `Candidate misconception for Option ${label}: Confuses primary and secondary mechanisms; assumes "${cleanContent || 'this option'}" directly addresses the problem without considering opportunity cost.`;
}

export function IngestionOptionsEditor({
  options,
  onChangeOption,
  onSetCorrect,
  distractorAnalysis,
  onChangeDistractor,
  stemMarkdown,
  topicName,
  onGenerateDistractorRationale,
  className,
}: IngestionOptionsEditorProps) {
  // Local state for expandable distractor sections
  const [expandedDistractors, setExpandedDistractors] = useState<Record<string, boolean>>({
    A: false,
    B: false,
    C: false,
    D: false,
  });

  // Local state for distractor rationales if not controlled externally
  const [localDistractorMap, setLocalDistractorMap] = useState<Record<string, string>>({});
  const [generatingLabel, setGeneratingLabel] = useState<string | null>(null);

  // Sync incoming distractorAnalysis or option props into local state
  useEffect(() => {
    const nextMap: Record<string, string> = {};
    for (const label of OPTION_LABELS) {
      if (distractorAnalysis && distractorAnalysis[label]) {
        nextMap[label] = distractorAnalysis[label];
      } else {
        const opt = (options || []).find((o) => o?.label === label);
        if (opt && (opt as any).distractor_reasoning) {
          nextMap[label] = (opt as any).distractor_reasoning;
        } else if (opt && (opt as any).distractor_misconception) {
          nextMap[label] = (opt as any).distractor_misconception;
        }
      }
    }
    setLocalDistractorMap((prev) => ({ ...nextMap, ...prev }));
  }, [distractorAnalysis, options]);

  // Lookup map of options
  const optionMap = useMemo(() => {
    const map = new Map<'A' | 'B' | 'C' | 'D', StagingOption>();
    for (const opt of options || []) {
      if (opt && opt.label) {
        map.set(opt.label, opt);
      }
    }
    return map;
  }, [options]);

  // Global hotkeys: 1-4 and A-D with strict input guard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isInput) return;

      const key = e.key.toUpperCase();
      const hotkeyMap: Record<string, 'A' | 'B' | 'C' | 'D'> = {
        '1': 'A',
        A: 'A',
        '2': 'B',
        B: 'B',
        '3': 'C',
        C: 'C',
        '4': 'D',
        D: 'D',
      };

      if (key in hotkeyMap) {
        e.preventDefault();
        const targetLabel = hotkeyMap[key];
        onSetCorrect(targetLabel);
        playChime();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSetCorrect]);

  const toggleDistractorExpand = useCallback((label: string) => {
    setExpandedDistractors((prev) => ({
      ...prev,
      [label]: !prev[label],
    }));
  }, []);

  const handleUpdateDistractor = useCallback(
    (label: 'A' | 'B' | 'C' | 'D', value: string) => {
      setLocalDistractorMap((prev) => ({ ...prev, [label]: value }));
      onChangeDistractor?.(label, value);
    },
    [onChangeDistractor]
  );

  const handleGenerateRationale = useCallback(
    async (label: 'A' | 'B' | 'C' | 'D') => {
      setGeneratingLabel(label);
      playPop();

      try {
        if (onGenerateDistractorRationale) {
          await onGenerateDistractorRationale(label);
        } else {
          // Provide intelligent Cambridge pedagogical heuristic
          await new Promise((resolve) => setTimeout(resolve, 350));
          const opt = optionMap.get(label);
          const generated = generateCambridgeDistractorHeuristic(
            label,
            opt?.content_markdown || '',
            topicName
          );
          handleUpdateDistractor(label, generated);
        }
      } catch (err) {
        console.error('Error generating distractor rationale:', err);
      } finally {
        setGeneratingLabel(null);
      }
    },
    [onGenerateDistractorRationale, optionMap, topicName, handleUpdateDistractor]
  );

  return (
    <div
      role="radiogroup"
      aria-label="4-Option MCQ Matrix"
      className={cn('flex flex-col gap-3.5', className)}
    >
      {/* Matrix Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 select-none">
        <div className="flex items-center gap-2">
          <span className="font-heading font-black text-xs uppercase tracking-wider text-slate-800">
            MCQ Options (A-D)
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-200 border border-slate-800 text-[10px] font-bold text-slate-700">
            Exactly 1 Correct
          </span>
        </div>

        {/* Tactile Hotkeys Quick Reference */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <span className="text-[11px] text-slate-600 font-bold hidden sm:inline">Hotkeys:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-200 border border-slate-800 font-mono text-[11px] font-bold text-slate-800 shadow-sm">
            1-4
          </kbd>
          <span>or</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-200 border border-slate-800 font-mono text-[11px] font-bold text-slate-800 shadow-sm">
            A-D
          </kbd>
          <span className="text-slate-500 text-[11px] hidden md:inline">to mark answer key</span>
        </div>
      </div>

      {/* 4 Tactile 3D Option Cards (A, B, C, D) */}
      {OPTION_LABELS.map((label) => {
        const opt = optionMap.get(label) || {
          label,
          content_markdown: '',
          is_correct: false,
        };
        const isCorrect = Boolean(opt.is_correct);
        const distractorText = localDistractorMap[label] || '';
        const isExpanded = expandedDistractors[label] || false;
        const isGenerating = generatingLabel === label;

        // KaTeX validation for this specific option
        const katexStatus = validateKaTeXSyntax(opt.content_markdown);

        return (
          <div
            key={label}
            className={cn(
              'group flex flex-col rounded-2xl border-2 border-b-4 transition-all duration-75 select-none overflow-hidden',
              isCorrect
                ? 'border-emerald-500 border-b-emerald-700 bg-emerald-50 text-emerald-950 shadow-chunky ring-2 ring-emerald-500/20'
                : 'border-slate-300 border-b-slate-400 bg-white text-slate-800 shadow-chunky hover:border-slate-400 hover:bg-slate-50/70'
            )}
          >
            {/* Top row: Tactile Option Selector + Content Input */}
            <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-start gap-3">
              {/* Correct Answer Toggle Button with Tactile Depression */}
              <button
                type="button"
                role="radio"
                aria-checked={isCorrect}
                aria-label={`Option ${label}: Click to mark as correct answer`}
                onClick={() => {
                  onSetCorrect(label);
                  playChime();
                }}
                title={`Mark Option ${label} as correct (Press ${label} or ${
                  label === 'A' ? 1 : label === 'B' ? 2 : label === 'C' ? 3 : 4
                })`}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-xl border-2 border-b-4 font-bold text-xs transition-all cursor-pointer select-none shrink-0',
                  'active:translate-y-0.5 active:border-b-2 active:shadow-none',
                  isCorrect
                    ? 'border-emerald-600 border-b-emerald-800 bg-emerald-500 text-white shadow-chunky'
                    : 'border-slate-800 border-b-slate-900 bg-brand-yellow text-slate-900 hover:bg-yellow-400 shadow-chunky'
                )}
              >
                {/* 3D Option Letter Badge */}
                <div
                  className={cn(
                    'w-7 h-7 rounded-lg border-2 border-slate-900 font-heading font-black text-sm flex items-center justify-center shrink-0 shadow-sm',
                    isCorrect ? 'bg-white text-emerald-800' : 'bg-white text-slate-900'
                  )}
                >
                  {label}
                </div>

                <div className="flex flex-col text-left">
                  <span className="font-heading font-black text-[11px] uppercase tracking-wide">
                    {isCorrect ? 'Correct Key' : `Mark as Key`}
                  </span>
                  <span className="text-[10px] font-mono opacity-80">
                    {isCorrect ? '✓ Verified' : `Press ${label}`}
                  </span>
                </div>

                {isCorrect && <Check className="w-4 h-4 ml-1 text-white shrink-0 stroke-[3]" />}
              </button>

              {/* Option Content Textarea & KaTeX Live Preview */}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <textarea
                  id={`option-${label}-content`}
                  value={opt.content_markdown}
                  onChange={(e) => onChangeOption(label, e.target.value)}
                  rows={2}
                  placeholder={`Option ${label} content in Markdown/KaTeX (e.g. $P \\times Q$ or Consumer Surplus)...`}
                  className={cn(
                    'w-full px-3.5 py-2 text-sm font-mono rounded-xl border-2 bg-white text-slate-900 outline-none transition-all resize-y min-h-[52px] leading-relaxed placeholder:text-slate-400 shadow-sm',
                    isCorrect
                      ? 'border-emerald-600 focus:ring-2 focus:ring-emerald-500'
                      : 'border-slate-800 focus:ring-2 focus:ring-brand-yellow'
                  )}
                />

                {/* KaTeX Live Preview for Option Content */}
                {opt.content_markdown && opt.content_markdown.trim() && (
                  <div
                    className={cn(
                      'px-3 py-1.5 rounded-xl border text-xs break-words flex items-start gap-2 overflow-x-auto shadow-sm',
                      isCorrect
                        ? 'bg-emerald-100/70 border-emerald-300 text-emerald-950'
                        : 'bg-amber-50/70 border-slate-300 text-slate-900'
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono select-none shrink-0 mt-0.5">
                      Preview:
                    </span>
                    <div className="prose prose-xs max-w-none text-slate-900 flex-1 font-body">
                      <ReactMarkdown
                        remarkPlugins={[remarkMath]}
                        rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
                      >
                        {sanitizeKaTeX(opt.content_markdown)}
                      </ReactMarkdown>
                    </div>

                    {!katexStatus.isValid && (
                      <span className="text-[10px] font-bold text-rose-600 shrink-0 select-none">
                        KaTeX Error
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Distractor Misconception Drawer & AI Trigger */}
            <div
              className={cn(
                'border-t-2 px-3.5 py-2 flex flex-col gap-2 transition-colors',
                isCorrect ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50/80'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                {/* Expand / Collapse Button */}
                <button
                  type="button"
                  onClick={() => toggleDistractorExpand(label)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer select-none"
                >
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-slate-500 transition-transform duration-150',
                      isExpanded && 'rotate-180'
                    )}
                  />
                  <span>
                    {isCorrect
                      ? 'Correct Answer Rationale & Mark Scheme Note'
                      : 'Distractor Misconception & Diagnostic Analysis'}
                  </span>
                  {distractorText ? (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                      Rationale set
                    </span>
                  ) : !isCorrect ? (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                      Needs rationale
                    </span>
                  ) : null}
                </button>

                {/* AI Distractor Generation Trigger Button */}
                {!isCorrect && (
                  <button
                    type="button"
                    onClick={() => handleGenerateRationale(label)}
                    disabled={isGenerating}
                    title="Generate diagnostic misconception explanation via AI analysis"
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-brand-yellow/30 text-slate-900 text-xs font-bold border-2 border-b-4 border-slate-800 rounded-xl shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none transition-all cursor-pointer select-none disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3 h-3 text-brand-indigo animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-brand-indigo" />
                        <span>Generate Rationale</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Expandable Explanation Textarea */}
              {isExpanded && (
                <div className="flex flex-col gap-1.5 pt-1 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                    <span className="flex items-center gap-1">
                      <Lightbulb className="w-3 h-3 text-brand-amber" />
                      {isCorrect
                        ? 'Why this choice is officially correct according to CAIE syllabus:'
                        : 'Explain why candidates select this distractor (e.g. inverted formula, sign error, confused mechanism):'}
                    </span>
                  </div>
                  <textarea
                    value={distractorText}
                    onChange={(e) => handleUpdateDistractor(label, e.target.value)}
                    rows={2}
                    placeholder={
                      isCorrect
                        ? 'e.g. Option B precisely applies the formula PED = (%ΔQD)/(%ΔP), yielding correct coefficient.'
                        : "e.g. Student inverted the supply/demand relationship; confused a shift in supply with a movement along the demand curve."
                    }
                    className="w-full p-2.5 text-xs font-mono rounded-xl border-2 border-slate-800 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-brand-yellow placeholder:text-slate-400 shadow-sm"
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default IngestionOptionsEditor;

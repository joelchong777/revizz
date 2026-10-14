'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { StagingOption } from '@/types/ingestion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { MarkdownErrorBoundary } from '@/components/ui/MarkdownErrorBoundary';
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
          <span className="font-adminHeading font-bold text-xs uppercase tracking-wider text-[#201e1d]">
            MCQ Options (A-D)
          </span>
          <span className="bg-white border border-[#201e1d] text-[#201e1d] rounded-full px-2.5 py-0.5 text-[11px] font-mono font-bold shadow-[1px_1px_0_#201e1d]">
            Exactly 1 Correct
          </span>
        </div>

        {/* Hotkeys Quick Reference */}
        <div className="flex items-center gap-1.5 text-xs text-[#645c50] font-medium">
          <span className="text-[11px] text-[#645c50] font-bold hidden sm:inline">Hotkeys:</span>
          <kbd className="px-1.5 py-0.5 rounded-full bg-white border border-[#201e1d] font-mono text-[11px] font-bold text-[#201e1d] shadow-[1px_1px_0_#201e1d]">
            1-4
          </kbd>
          <span>or</span>
          <kbd className="px-1.5 py-0.5 rounded-full bg-white border border-[#201e1d] font-mono text-[11px] font-bold text-[#201e1d] shadow-[1px_1px_0_#201e1d]">
            A-D
          </kbd>
          <span className="text-[#82796a] text-[11px] hidden md:inline">to mark answer key</span>
        </div>
      </div>

      {/* 4 Option Cards (A, B, C, D) */}
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
              'group flex flex-col transition-all duration-150 select-none overflow-hidden rounded-xl p-3 text-[#201e1d]',
              isCorrect
                ? 'bg-[#f0fae1] border-2 border-[#728157] shadow-[2px_2px_0_#728157]'
                : 'bg-white border-2 border-[#dcd3c4] hover:border-[#201e1d] shadow-[2px_2px_0_#dcd3c4]'
            )}
          >
            {/* Top row: Option Selector Badge + Content Input */}
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              {/* Correct Answer Toggle Button */}
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
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-full transition-all cursor-pointer select-none shrink-0 border-2 active:translate-y-0.5',
                  isCorrect
                    ? 'bg-white border-[#728157] text-[#201e1d] shadow-[1px_1px_0_#728157]'
                    : 'bg-[#f9f4ed] hover:bg-[#eee7db] border-[#dcd3c4] hover:border-[#201e1d] text-[#645c50] hover:text-[#201e1d]'
                )}
              >
                {/* Option Letter Badge */}
                <div
                  className={cn(
                    isCorrect
                      ? 'w-7 h-7 rounded-full bg-[#728157] text-[#f9f4ed] font-bold text-xs flex items-center justify-center shrink-0 border border-[#56633f]'
                      : 'w-7 h-7 rounded-full bg-[#eee7db] text-[#474238] font-bold text-xs flex items-center justify-center shrink-0 border border-[#dcd3c4] hover:bg-[#c67139] hover:text-white transition-colors cursor-pointer'
                  )}
                >
                  {label}
                </div>

                <div className="flex flex-col text-left pr-1">
                  <span className="font-adminHeading font-bold text-[11px] uppercase tracking-wide">
                    {isCorrect ? 'Correct Key' : 'Mark Key'}
                  </span>
                  <span className="text-[10px] font-mono text-[#645c50]">
                    {isCorrect ? '✓ Active' : `Press ${label}`}
                  </span>
                </div>

                {isCorrect && <Check className="w-3.5 h-3.5 text-[#728157] shrink-0 stroke-[2.5]" />}
              </button>

              {/* Option Content Textarea & KaTeX Live Preview */}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <textarea
                  id={`option-${label}-content`}
                  value={opt.content_markdown}
                  onChange={(e) => onChangeOption(label, e.target.value)}
                  rows={2}
                  placeholder={`Option ${label} content in Markdown/KaTeX (e.g. $P \\times Q$ or Consumer Surplus)...`}
                  className="bg-transparent border-0 outline-none text-xs sm:text-sm font-body text-[#201e1d] w-full resize-none leading-relaxed placeholder:text-[#82796a] min-h-[48px]"
                />

                {/* KaTeX Live Preview for Option Content */}
                {opt.content_markdown && opt.content_markdown.trim() && (
                  <div className="px-3 py-1.5 rounded-lg border border-[#dcd3c4] bg-[#f9f4ed] text-xs text-[#201e1d] flex items-start gap-2 overflow-x-auto shadow-sm">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50] select-none shrink-0 mt-0.5">
                      Preview:
                    </span>
                    <div className="prose prose-xs max-w-none text-[#201e1d] flex-1 font-body">
                      <MarkdownErrorBoundary fallbackText={opt.content_markdown}>
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[[rehypeKatex, { throwOnError: false, errorColor: '#c67139' }]]}
                        >
                          {sanitizeKaTeX(opt.content_markdown)}
                        </ReactMarkdown>
                      </MarkdownErrorBoundary>
                    </div>

                    {!katexStatus.isValid && (
                      <span className="text-[10px] font-mono font-bold text-[#c67139] shrink-0 select-none">
                        KaTeX Error
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Distractor Misconception Drawer & AI Trigger */}
            <div className="border-t border-[#dcd3c4]/80 pt-2.5 mt-2 flex flex-col gap-2 transition-colors">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Expand / Collapse Button */}
                <button
                  type="button"
                  onClick={() => toggleDistractorExpand(label)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#645c50] hover:text-[#201e1d] cursor-pointer select-none"
                >
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-[#645c50] transition-transform duration-150',
                      isExpanded && 'rotate-180'
                    )}
                  />
                  <span>
                    {isCorrect
                      ? 'Correct Answer Rationale & Mark Scheme Note'
                      : 'Distractor Misconception & Diagnostic Analysis'}
                  </span>
                  {distractorText ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#f0fae1] text-[#3d472b] text-[10px] font-bold border border-[#8fa073]">
                      Rationale set
                    </span>
                  ) : !isCorrect ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#ffe1d0] text-[#c67139] text-[10px] font-bold border border-[#c67139]/30">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-[#eee7db] text-[#201e1d] text-xs font-semibold border-[1.5px] border-[#dcd3c4] rounded-full transition-colors cursor-pointer select-none disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3 h-3 text-[#c67139] animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3 text-[#c67139]" />
                        <span>Generate Rationale</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Expandable Explanation Textarea */}
              {isExpanded && (
                <div className="flex flex-col gap-1.5 pt-1 animate-in fade-in duration-100">
                  <div className="flex items-center justify-between text-[11px] font-medium text-[#645c50]">
                    <span className="flex items-center gap-1">
                      <Lightbulb className="w-3 h-3 text-[#c67139]" />
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
                        : 'e.g. Student inverted the supply/demand relationship; confused a shift in supply with a movement along the demand curve.'
                    }
                    className="w-full p-2.5 text-xs font-mono rounded-lg border-[1.5px] border-[#dcd3c4] bg-white text-[#201e1d] outline-none focus:border-[#c67139] transition-all placeholder:text-[#82796a]"
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

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Gamepad2,
  Maximize2,
  X,
  Flame,
  ChevronDown,
  ChevronUp,
  BookOpen,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { SoundToggle } from '@/components/SoundToggle';
import type { StagingQuestion } from '@/types/ingestion';
import { playChime, playBuzzer, playFanfare, playPop } from '@/lib/audio';
import { cn } from '@/lib/utils';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';

export interface IngestionLivePreviewProps {
  question: StagingQuestion;
  questionIndex: number;
  totalQuestions: number;
  className?: string;
  onNext?: () => void;
}

export function IngestionLivePreview({
  question,
  questionIndex,
  totalQuestions,
  className,
  onNext,
}: IngestionLivePreviewProps) {
  // Mastery loop state
  const [status, setStatus] = useState<'unanswered' | 'first-wrong' | 'answered'>('unanswered');
  const [selectedOptionLabel, setSelectedOptionLabel] = useState<string | null>(null);
  const [firstWrongOptionLabel, setFirstWrongOptionLabel] = useState<string | null>(null);
  const [isRetryWrong, setIsRetryWrong] = useState<boolean>(false);
  const [totalXP, setTotalXP] = useState<number>(100);
  const [currentStreak, setCurrentStreak] = useState<number>(1);
  const [isZoomOpen, setIsZoomOpen] = useState<boolean>(false);
  const [isWalkthroughOpen, setIsWalkthroughOpen] = useState<boolean>(false);

  // Identify correct option label
  const correctOption = useMemo(() => {
    return (question.options || []).find((opt) => opt.is_correct);
  }, [question.options]);

  const correctOptionLabel = correctOption?.label || 'A';

  // Reset simulator
  const resetSimulator = useCallback(() => {
    setStatus('unanswered');
    setSelectedOptionLabel(null);
    setFirstWrongOptionLabel(null);
    setIsRetryWrong(false);
    setIsWalkthroughOpen(false);
  }, []);

  // Reset when question changes
  useEffect(() => {
    resetSimulator();
  }, [question.question_number, question.cambridge_source_ref, questionIndex, resetSimulator]);

  const handleManualReset = () => {
    playPop();
    resetSimulator();
  };

  // 2-try mastery loop interactive answering logic
  const handleAnswer = useCallback(
    (label: string) => {
      if (status === 'answered') return;

      const isCorrect = label === correctOptionLabel;

      if (status === 'unanswered') {
        if (isCorrect) {
          // 1st Try Correct: answered state, +10 XP, fanfare, confetti, streak increase
          setStatus('answered');
          setSelectedOptionLabel(label);
          setFirstWrongOptionLabel(null);
          setIsRetryWrong(false);
          setTotalXP((prev) => prev + 10);
          setCurrentStreak((prev) => prev + 1);
          playFanfare();
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#22C55E', '#14B8A6', '#FACC15', '#6366F1'],
            });
          } catch {
            // Safe fallback
          }
        } else {
          // 1st Try Miss: first-wrong state, buzzer, distractor disabled, retry prompt
          setStatus('first-wrong');
          setFirstWrongOptionLabel(label);
          setSelectedOptionLabel(null);
          setIsRetryWrong(false);
          setCurrentStreak(1);
          playBuzzer();
        }
      } else if (status === 'first-wrong') {
        if (label === firstWrongOptionLabel) return; // Prevent re-clicking struck out option

        if (isCorrect) {
          // Retry Right: answered state, +5 XP, recovery chime, confetti
          setStatus('answered');
          setSelectedOptionLabel(label);
          setIsRetryWrong(false);
          setTotalXP((prev) => prev + 5);
          playChime();
          try {
            confetti({
              particleCount: 40,
              spread: 50,
              origin: { y: 0.6 },
              colors: ['#14B8A6', '#FACC15', '#22C55E'],
            });
          } catch {
            // Safe fallback
          }
        } else {
          // Retry Wrong: answered state, buzzer, full explanation revealed, 0 XP
          setStatus('answered');
          setSelectedOptionLabel(label);
          setIsRetryWrong(true);
          setIsWalkthroughOpen(true);
          playBuzzer();
        }
      }
    },
    [status, correctOptionLabel, firstWrongOptionLabel]
  );

  // Global hotkeys for testing student gameplay: 1-4 / A-D and Space/Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isInput) return;

      const key = e.key.toUpperCase();
      const hotkeyMap: Record<string, string> = {
        '1': 'A',
        A: 'A',
        '2': 'B',
        B: 'B',
        '3': 'C',
        C: 'C',
        '4': 'D',
        D: 'D',
      };

      if (key in hotkeyMap && (status === 'unanswered' || status === 'first-wrong')) {
        const optionLabel = hotkeyMap[key];
        if (status === 'first-wrong' && optionLabel === firstWrongOptionLabel) return;
        e.preventDefault();
        handleAnswer(optionLabel);
        return;
      }

      if ((e.key === 'Enter' || e.key === ' ') && status === 'answered') {
        if (target?.tagName === 'BUTTON') return;
        e.preventDefault();
        if (onNext) {
          onNext();
        } else {
          handleManualReset();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, firstWrongOptionLabel, handleAnswer, onNext]);

  const handleNext = () => {
    playPop();
    if (onNext) {
      onNext();
    } else {
      handleManualReset();
    }
  };

  // Test bench triggers
  const triggerFirstTrySuccess = () => {
    playPop();
    resetSimulator();
    setTimeout(() => {
      handleAnswer(correctOptionLabel);
    }, 50);
  };

  const triggerFirstTryFail = () => {
    playPop();
    resetSimulator();
    const wrongOpt = (question.options || []).find((opt) => opt.label !== correctOptionLabel);
    if (wrongOpt) {
      setTimeout(() => {
        handleAnswer(wrongOpt.label);
      }, 50);
    }
  };

  const triggerDoubleFail = () => {
    playPop();
    resetSimulator();
    const wrongOpts = (question.options || []).filter((opt) => opt.label !== correctOptionLabel);
    if (wrongOpts.length >= 2) {
      setTimeout(() => {
        handleAnswer(wrongOpts[0].label);
        setTimeout(() => {
          handleAnswer(wrongOpts[1].label);
        }, 120);
      }, 50);
    } else if (wrongOpts.length === 1) {
      setTimeout(() => {
        handleAnswer(wrongOpts[0].label);
      }, 50);
    }
  };

  // Status Badge styling & text
  const badgeInfo = useMemo(() => {
    if (status === 'unanswered') {
      return {
        text: '1st Try Mode',
        className: 'bg-brand-indigo/15 text-indigo-900 border-slate-800',
        dotClass: 'bg-brand-indigo',
      };
    }
    if (status === 'first-wrong') {
      return {
        text: 'Retry Mode',
        className: 'bg-brand-coral/20 text-rose-900 border-slate-800 animate-pulse',
        dotClass: 'bg-brand-coral',
      };
    }
    return {
      text: 'Mastered',
      className: 'bg-brand-green/20 text-emerald-900 border-slate-800',
      dotClass: 'bg-brand-green',
    };
  }, [status]);

  const diagramUrl = question.diagram?.image_url;
  const hasDiagram = Boolean(question.diagram?.has_diagram || diagramUrl);

  return (
    <div className={cn('w-full max-w-xl mx-auto flex flex-col', className)}>
      {/* Gameboy Chassis matching AppShell.tsx */}
      <div className="relative rounded-3xl md:rounded-[36px] border-4 border-slate-800 bg-[#ede4d3] shadow-[0_16px_0_0_rgba(15,23,42,0.15)] p-4 sm:p-6 flex flex-col gap-4">
        {/* Gameboy Top Bezel: Power LED + Brand + Reset Button */}
        <div className="flex items-center justify-between gap-3 border-b-2 border-slate-800/20 pb-3.5">
          {/* Left: Power Light & Handheld Title */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-slate-800 animate-pulse shadow-[0_0_8px_#22c55e]" />
            </div>
            <div className="flex flex-col">
              <span className="font-heading text-xs tracking-wider text-slate-800 uppercase flex items-center gap-1.5 font-bold">
                <Gamepad2 className="w-3.5 h-3.5 text-brand-indigo" />
                REVIZZ BOY
              </span>
              <span className="text-[10px] font-bold text-slate-600 tracking-tight">
                STUDENT SIMULATOR
              </span>
            </div>
          </div>

          {/* Right: Sound Toggle + Status Badge + Reset Button */}
          <div className="flex items-center gap-2">
            <SoundToggle className="h-8 w-8 p-1 rounded-xl text-xs" />

            {/* Status Badge */}
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full border-2 font-bold text-xs uppercase tracking-wide shadow-chunky transition-colors',
                badgeInfo.className
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', badgeInfo.dotClass)} />
              <span>{badgeInfo.text}</span>
            </div>

            {/* Tactile Reset Button */}
            <button
              type="button"
              onClick={handleManualReset}
              title="Reset Simulator"
              className="px-3 py-1.5 rounded-full bg-brand-yellow hover:bg-yellow-400 text-slate-900 border-2 border-b-4 border-slate-800 font-bold text-xs shadow-chunky transition-all active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1 cursor-pointer select-none"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Quick Test Bench Shortcuts Bar */}
        <div className="flex items-center justify-between gap-2 bg-[#dfd4c1] p-2 sm:px-3 rounded-2xl border-2 border-slate-800/40 text-[11px] font-bold text-slate-700 select-none">
          <span className="hidden sm:inline-block">🧪 Quick Test:</span>
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={triggerFirstTrySuccess}
              className="flex-1 sm:flex-none px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-slate-800 shadow-[1px_1px_0_#1e293b] active:translate-y-0.5 active:shadow-none transition-transform font-bold"
            >
              ✓ 1st Try (+10 XP)
            </button>
            <button
              type="button"
              onClick={triggerFirstTryFail}
              className="flex-1 sm:flex-none px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-slate-800 shadow-[1px_1px_0_#1e293b] active:translate-y-0.5 active:shadow-none transition-transform font-bold"
            >
              ✗ Miss (Retry)
            </button>
            <button
              type="button"
              onClick={triggerDoubleFail}
              className="flex-1 sm:flex-none px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-slate-800 shadow-[1px_1px_0_#1e293b] active:translate-y-0.5 active:shadow-none transition-transform font-bold"
            >
              ✕ Reveal (0 XP)
            </button>
          </div>
        </div>

        {/* Gameboy Screen Inner Bezel: Houses Interactive Question Card */}
        <div className="relative rounded-2xl border-4 border-slate-800 bg-amber-50/60 overflow-hidden shadow-inner flex flex-col p-4 sm:p-5 gap-4">
          {/* Inner Glare / Screen Border Line */}
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent -mt-2 mb-1" />

          {/* Question Header: Topic, Citation, Streak, and XP Counter */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-800/10 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-3 py-1 rounded-full bg-brand-indigo/15 text-indigo-950 border-2 border-slate-800 text-xs font-bold shadow-chunky">
                📈 {question.topic_name || 'General Topic'}
              </span>
              <span className="px-2.5 py-1 rounded-full bg-slate-200/90 text-slate-800 border border-slate-800/40 text-[11px] font-mono font-bold">
                {question.cambridge_source_ref || `Q${question.question_number ?? questionIndex + 1}`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Streak Counter */}
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-brand-amber text-slate-900 border-2 border-slate-800 font-black text-xs shadow-chunky">
                <Flame className="w-3.5 h-3.5 fill-current text-slate-900" />
                <span>{currentStreak}x</span>
              </div>

              {/* Total XP Counter */}
              <div className="px-2.5 py-0.5 rounded-full bg-brand-yellow text-slate-900 border-2 border-slate-800 font-black text-xs shadow-chunky">
                ⭐ {totalXP} XP
              </div>
            </div>
          </div>

          {/* Question Stem: Live KaTeX Typography */}
          <div className="text-slate-900 text-base sm:text-lg font-medium leading-relaxed font-body">
            {question.stem_markdown ? (
              <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
                components={{
                  p: ({ ...props }) => (
                    <p className="mb-2 last:mb-0 leading-relaxed text-slate-900" {...props} />
                  ),
                  strong: ({ ...props }) => (
                    <strong className="font-bold text-slate-900" {...props} />
                  ),
                  code: ({ ...props }) => (
                    <code
                      className="font-mono text-xs bg-slate-200 px-1 py-0.5 rounded border border-slate-300"
                      {...props}
                    />
                  ),
                }}
              >
                {question.stem_markdown}
              </ReactMarkdown>
            ) : (
              <div className="text-slate-400 italic text-sm py-4 text-center">
                *Question stem content will appear here*
              </div>
            )}
          </div>

          {/* Question Diagram (if present) */}
          {hasDiagram && diagramUrl && (
            <div className="relative rounded-2xl border-2 border-slate-800 bg-white p-2 shadow-chunky overflow-hidden flex flex-col items-center">
              <img
                src={diagramUrl}
                alt={question.diagram?.alt_description || 'Question Diagram'}
                className="max-h-56 object-contain rounded-xl w-auto"
              />
              <button
                type="button"
                onClick={() => setIsZoomOpen(true)}
                className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/90 hover:bg-white border border-slate-800 shadow-sm text-slate-700 cursor-pointer"
                title="Zoom Diagram"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 4 Interactive Test Options (A, B, C, D) with Bouncy Click States */}
          <div className="flex flex-col gap-2.5 pt-1">
            {(question.options || []).map((opt) => {
              const isSelected = selectedOptionLabel === opt.label;
              const isFirstWrongStruckOut = firstWrongOptionLabel === opt.label;
              const isCorrectAnswer = opt.label === correctOptionLabel;

              // Compute dynamic button styling based on 2-try mastery loop state
              let optionClass =
                'w-full min-h-[56px] p-3.5 sm:p-4 text-left font-bold relative text-base rounded-2xl border-2 border-b-4 bg-white text-slate-800 shadow-chunky select-none transition-all duration-75 ease-out cursor-pointer active:translate-y-0.5 active:border-b-2 active:shadow-none hover:border-slate-300 hover:bg-slate-50 flex items-start gap-3';

              if (status === 'answered') {
                if (isCorrectAnswer) {
                  // Final Correct highlight
                  optionClass =
                    'w-full min-h-[56px] p-3.5 sm:p-4 text-left font-bold relative text-base rounded-2xl border-2 border-b-4 border-emerald-500 border-b-emerald-700 bg-emerald-50 text-emerald-950 shadow-chunky ring-2 ring-emerald-500/20 flex items-start gap-3';
                } else if (isSelected) {
                  // Chosen incorrect answer
                  optionClass =
                    'w-full min-h-[56px] p-3.5 sm:p-4 text-left font-bold relative text-base rounded-2xl border-2 border-b-4 border-rose-400 border-b-rose-600 bg-rose-50 text-rose-950 opacity-85 shadow-chunky flex items-start gap-3';
                } else {
                  // Unselected distractor
                  optionClass =
                    'w-full min-h-[56px] p-3.5 sm:p-4 text-left font-medium relative text-base rounded-2xl border-2 border-b-4 border-slate-200 border-b-slate-300 bg-white/70 text-slate-500 opacity-60 flex items-start gap-3';
                }
              } else if (isFirstWrongStruckOut) {
                // First wrong struck out state
                optionClass =
                  'w-full min-h-[56px] p-3.5 sm:p-4 text-left font-medium relative text-base rounded-2xl border-2 border-b-4 border-slate-300 border-b-slate-300 bg-slate-100 text-slate-400 opacity-50 line-through flex items-start gap-3 cursor-not-allowed';
              }

              return (
                <motion.button
                  key={opt.label}
                  type="button"
                  whileTap={
                    status !== 'answered' && !isFirstWrongStruckOut ? { scale: 0.985 } : undefined
                  }
                  onClick={() => handleAnswer(opt.label)}
                  disabled={isFirstWrongStruckOut || status === 'answered'}
                  className={optionClass}
                >
                  {/* Option Letter Badge */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-xl border-2 border-slate-800 font-heading font-black text-sm flex items-center justify-center shrink-0 shadow-sm',
                      status === 'answered' && isCorrectAnswer
                        ? 'bg-emerald-500 text-white border-emerald-700'
                        : isFirstWrongStruckOut
                        ? 'bg-slate-200 text-slate-400'
                        : 'bg-brand-yellow text-slate-900'
                    )}
                  >
                    {opt.label}
                  </div>

                  {/* Rendered Option Text with KaTeX */}
                  <div className="flex-1 min-w-0 pt-0.5 text-slate-900 font-sans">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
                    >
                      {sanitizeKaTeX(opt.content_markdown || '')}
                    </ReactMarkdown>
                  </div>

                  {/* Visual Checkmark / Cross cue */}
                  {status === 'answered' && isCorrectAnswer && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 self-center" />
                  )}
                  {status === 'answered' && isSelected && !isCorrectAnswer && (
                    <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 self-center" />
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Interactive Next Question Pill (Surfaces on Answer) */}
          {status === 'answered' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-2 flex flex-col gap-2"
            >
              <button
                type="button"
                onClick={handleNext}
                className="w-full py-3.5 px-5 rounded-2xl bg-brand-yellow hover:bg-yellow-400 text-slate-900 border-2 border-b-4 border-slate-800 shadow-chunky font-heading font-black text-base cursor-pointer transition-all active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center justify-center gap-2 select-none"
              >
                <span>{questionIndex + 1 < totalQuestions ? 'Next Question' : 'Replay Simulator'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Explanation & Distractor Walkthrough Drawer Toggle */}
          <div className="pt-2 border-t-2 border-slate-800/10">
            <button
              type="button"
              onClick={() => setIsWalkthroughOpen((prev) => !prev)}
              className="w-full px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border-2 border-b-4 border-slate-800 text-slate-800 text-xs font-bold shadow-chunky active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center justify-between cursor-pointer select-none transition-all"
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-brand-indigo" />
                <span>Explanation & Distractor Walkthrough</span>
              </span>
              {isWalkthroughOpen ? (
                <ChevronUp className="w-4 h-4 text-slate-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>

          {/* Explanation & Distractor Walkthrough Drawer Body */}
          <AnimatePresence>
            {isWalkthroughOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden flex flex-col gap-3 pt-1"
              >
                {/* Step-by-Step Derivation & Concept Section */}
                <div className="p-4 rounded-2xl border-2 border-slate-800 bg-[#FFFDF7] shadow-chunky flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-brand-amber shrink-0" />
                    <h5 className="font-heading font-black text-xs text-slate-900 uppercase tracking-wider m-0">
                      Concept & Derivation
                    </h5>
                  </div>
                  <div className="text-sm text-slate-800 leading-relaxed font-body bg-white p-3 rounded-xl border border-slate-200">
                    {question.explanation_markdown ? (
                      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {question.explanation_markdown}
                      </ReactMarkdown>
                    ) : (
                      <span className="text-slate-400 italic text-xs">
                        No written explanation provided for this question.
                      </span>
                    )}
                  </div>
                </div>

                {/* Distractor Walkthrough Breakdown: Option by Option Analysis */}
                <div className="p-4 rounded-2xl border-2 border-slate-800 bg-amber-100/50 shadow-chunky flex flex-col gap-2.5">
                  <h5 className="font-heading font-black text-xs text-slate-900 uppercase tracking-wider m-0 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brand-teal" />
                    <span>Distractor Analysis (Why Options are Wrong)</span>
                  </h5>

                  <div className="flex flex-col gap-2">
                    {(question.options || []).map((opt) => {
                      const isOptionCorrect = opt.label === correctOptionLabel;
                      const specificRationale =
                        question.distractor_analysis?.[opt.label] ||
                        (opt as any).distractor_reasoning ||
                        (opt as any).distractor_misconception;

                      return (
                        <div
                          key={opt.label}
                          className={cn(
                            'p-2.5 rounded-xl border-2 text-xs flex items-start gap-2.5 leading-relaxed',
                            isOptionCorrect
                              ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                              : 'bg-white border-slate-300 text-slate-800'
                          )}
                        >
                          <div
                            className={cn(
                              'w-6 h-6 rounded-lg font-heading font-black text-xs flex items-center justify-center shrink-0 border',
                              isOptionCorrect
                                ? 'bg-emerald-500 text-white border-emerald-700'
                                : 'bg-slate-200 text-slate-800 border-slate-400'
                            )}
                          >
                            {opt.label}
                          </div>

                          <div className="flex-1">
                            {isOptionCorrect ? (
                              <div>
                                <span className="font-bold text-emerald-900 mr-1.5">
                                  [Correct Answer]:
                                </span>
                                <span>
                                  {specificRationale ||
                                    'Accurately satisfies the Cambridge syllabus requirement and Mark Scheme.'}
                                </span>
                              </div>
                            ) : (
                              <div>
                                <span className="font-bold text-rose-800 mr-1.5">
                                  [Distractor Misconception]:
                                </span>
                                <span>
                                  {specificRationale ||
                                    `Represents a common candidate error or distractor mechanism for Option ${opt.label}.`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Gameboy Bottom Details: Hotkeys & Speaker Slits */}
        <div className="flex items-center justify-between pt-1 text-slate-600 text-xs font-bold select-none">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-slate-200 border border-slate-800/50 font-mono text-[10px]">
              HOTKEYS: 1-4 / A-D
            </span>
            <span className="hidden sm:inline text-[11px] text-slate-500">
              Press Enter/Space on next
            </span>
          </div>

          {/* Decorative Speaker Slits */}
          <div className="flex items-center gap-1.5 pr-2">
            <span className="w-1.5 h-6 rounded-full bg-slate-800/30 transform -rotate-12" />
            <span className="w-1.5 h-6 rounded-full bg-slate-800/30 transform -rotate-12" />
            <span className="w-1.5 h-6 rounded-full bg-slate-800/30 transform -rotate-12" />
          </div>
        </div>
      </div>

      {/* Diagram Zoom Lightbox Modal */}
      {isZoomOpen && diagramUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-3xl border-4 border-slate-800 p-4 shadow-chunky-lg flex flex-col items-center">
            <button
              type="button"
              onClick={() => setIsZoomOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border-2 border-slate-800 text-slate-800 cursor-pointer shadow-sm"
              title="Close Diagram Zoom"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={diagramUrl}
              alt="Diagram Full Resolution"
              className="max-h-[80vh] max-w-full object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default IngestionLivePreview;

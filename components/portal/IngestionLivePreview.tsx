'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { RotateCcw, Sparkles, CheckCircle2, AlertCircle, Gamepad2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

import { QuestionCard } from '@/components/QuestionCard';
import { SoundToggle } from '@/components/SoundToggle';
import type { Question } from '@/hooks/useQuizGame';
import type { StagingQuestion } from '@/types/ingestion';
import { playChime, playBuzzer, playFanfare, playPop } from '@/lib/audio';
import { cn } from '@/lib/utils';

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
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [firstWrongOptionId, setFirstWrongOptionId] = useState<string | null>(null);
  const [isRetryWrong, setIsRetryWrong] = useState<boolean>(false);
  const [totalXP, setTotalXP] = useState<number>(100);

  // Convert StagingQuestion into QuestionCard's Question format
  const convertedQuestion: Question = useMemo(() => {
    const options = (question.options || []).map((opt) => ({
      id: opt.label,
      text_markdown: opt.content_markdown || '',
    }));

    const correctOption = (question.options || []).find((opt) => opt.is_correct);
    const correctOptionId = correctOption ? correctOption.label : (options[0]?.id || 'A');

    return {
      id: `preview-${question.question_number ?? questionIndex + 1}`,
      stem_markdown: question.stem_markdown || '',
      options,
      correct_option_id: correctOptionId,
      citation: question.cambridge_source_ref || `Question ${questionIndex + 1}`,
      topic: question.topic_name || 'General Economics',
      has_diagram: question.diagram?.has_diagram ?? false,
      image_url: question.diagram?.image_url,
      diagram: question.diagram
        ? {
            has_diagram: question.diagram.has_diagram,
            image_url: question.diagram.image_url,
            alt_description: question.diagram.alt_description,
          }
        : undefined,
    };
  }, [question, questionIndex]);

  // Reset simulator when switching questions
  const resetSimulator = useCallback(() => {
    setStatus('unanswered');
    setSelectedOptionId(null);
    setFirstWrongOptionId(null);
    setIsRetryWrong(false);
  }, []);

  useEffect(() => {
    resetSimulator();
  }, [question.question_number, question.cambridge_source_ref, questionIndex, resetSimulator]);

  const handleManualReset = () => {
    playPop();
    resetSimulator();
  };

  // Interactive 2-try mastery loop logic
  const handleAnswer = (optionId: string) => {
    if (status === 'answered') return;

    const isCorrect = optionId === convertedQuestion.correct_option_id;

    if (status === 'unanswered') {
      if (isCorrect) {
        // First try right: answered with 10 XP green fanfare
        setStatus('answered');
        setSelectedOptionId(optionId);
        setFirstWrongOptionId(null);
        setIsRetryWrong(false);
        setTotalXP((prev) => prev + 10);
        playFanfare();
        try {
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#22C55E', '#14B8A6', '#FACC15', '#6366F1'],
          });
        } catch {
          // Ignore in non-DOM test envs
        }
      } else {
        // First try wrong: first-wrong with distractor strikeout, 0 XP buzzer, and retry prompt
        setStatus('first-wrong');
        setFirstWrongOptionId(optionId);
        setSelectedOptionId(null);
        setIsRetryWrong(false);
        playBuzzer();
      }
    } else if (status === 'first-wrong') {
      // Disallow re-selecting already struck-out distractor
      if (optionId === firstWrongOptionId) return;

      if (isCorrect) {
        // Retry right: answered with 5 XP recovery
        setStatus('answered');
        setSelectedOptionId(optionId);
        setIsRetryWrong(false);
        setTotalXP((prev) => prev + 5);
        playChime();
        try {
          confetti({
            particleCount: 50,
            spread: 50,
            origin: { y: 0.6 },
            colors: ['#14B8A6', '#FACC15', '#22C55E'],
          });
        } catch {
          // Ignore
        }
      } else {
        // Retry wrong: answered with full explanation derivation revealed
        setStatus('answered');
        setSelectedOptionId(optionId);
        setIsRetryWrong(true);
        playBuzzer();
      }
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else {
      handleManualReset();
    }
  };

  // Test bench shortcut triggers
  const triggerFirstTrySuccess = () => {
    playPop();
    resetSimulator();
    setTimeout(() => {
      handleAnswer(convertedQuestion.correct_option_id);
    }, 50);
  };

  const triggerFirstTryFail = () => {
    playPop();
    resetSimulator();
    const wrongOpt = convertedQuestion.options.find(
      (opt) => opt.id !== convertedQuestion.correct_option_id
    );
    if (wrongOpt) {
      setTimeout(() => {
        handleAnswer(wrongOpt.id);
      }, 50);
    }
  };

  const triggerDoubleFail = () => {
    playPop();
    resetSimulator();
    const wrongOpts = convertedQuestion.options.filter(
      (opt) => opt.id !== convertedQuestion.correct_option_id
    );
    if (wrongOpts.length >= 2) {
      setTimeout(() => {
        handleAnswer(wrongOpts[0].id);
        setTimeout(() => {
          handleAnswer(wrongOpts[1].id);
        }, 120);
      }, 50);
    } else if (wrongOpts.length === 1) {
      setTimeout(() => {
        handleAnswer(wrongOpts[0].id);
      }, 50);
    }
  };

  // Status Badge styling & text
  const badgeInfo = useMemo(() => {
    if (status === 'unanswered') {
      return {
        text: '1st Try Mode',
        className: 'bg-brand-indigo/15 text-indigo-800 border-slate-800',
        dotClass: 'bg-brand-indigo',
      };
    }
    if (status === 'first-wrong') {
      return {
        text: 'Retry Mode',
        className: 'bg-brand-coral/20 text-rose-800 border-slate-800 animate-pulse',
        dotClass: 'bg-brand-coral',
      };
    }
    return {
      text: 'Mastered',
      className: 'bg-brand-green/20 text-emerald-800 border-slate-800',
      dotClass: 'bg-brand-green',
    };
  }, [status]);

  return (
    <div
      className={cn(
        'w-full max-w-xl mx-auto flex flex-col',
        className
      )}
    >
      {/* Gameboy / Revizz Chassis Container matching AppShell.tsx */}
      <div className="relative rounded-3xl md:rounded-[36px] border-4 border-slate-800 bg-[#ede4d3] shadow-[0_16px_0_0_rgba(15,23,42,0.15)] p-4 sm:p-6 flex flex-col gap-4">
        {/* Gameboy Top Bezel Header: Power LED + Brand + Reset Button */}
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

          {/* Right: Sound Toggle + Status Badge + Tactile Reset Button */}
          <div className="flex items-center gap-2">
            <SoundToggle className="h-8 w-8 p-1 rounded-xl text-xs" />

            {/* Simulator Status Badge */}
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full border-2 font-bold text-xs uppercase tracking-wide shadow-chunky transition-colors',
                badgeInfo.className
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', badgeInfo.dotClass)} />
              <span>{badgeInfo.text}</span>
            </div>

            {/* Tactile Reset Simulator Button */}
            <button
              type="button"
              onClick={handleManualReset}
              title="Reset Simulator (Replay Test Bench)"
              className="px-3 py-1.5 rounded-full bg-brand-yellow hover:bg-yellow-400 text-slate-900 border-2 border-b-4 border-slate-800 font-bold text-xs shadow-chunky transition-all active:translate-y-0.5 active:border-b-2 active:shadow-none flex items-center gap-1 cursor-pointer select-none"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Quick Test Bench Shortcuts Bar */}
        <div className="flex items-center justify-between gap-2 bg-[#dfd4c1] p-2 sm:px-3 rounded-2xl border-2 border-slate-800/40 text-[11px] font-bold text-slate-700">
          <span className="hidden sm:inline-block">🧪 Quick Test:</span>
          <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={triggerFirstTrySuccess}
              className="flex-1 sm:flex-none px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-slate-800 shadow-[1px_1px_0_#1e293b] active:translate-y-0.5 active:shadow-none transition-transform"
            >
              ✓ 1st Try (+10 XP)
            </button>
            <button
              type="button"
              onClick={triggerFirstTryFail}
              className="flex-1 sm:flex-none px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-slate-800 shadow-[1px_1px_0_#1e293b] active:translate-y-0.5 active:shadow-none transition-transform"
            >
              ✗ Miss (Retry)
            </button>
            <button
              type="button"
              onClick={triggerDoubleFail}
              className="flex-1 sm:flex-none px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 border border-slate-800 shadow-[1px_1px_0_#1e293b] active:translate-y-0.5 active:shadow-none transition-transform"
            >
              ✕ Reveal (0 XP)
            </button>
          </div>
        </div>

        {/* Gameboy Screen Inner Bezel: Houses QuestionCard */}
        <div className="relative rounded-2xl border-4 border-slate-800 bg-amber-50/60 overflow-hidden shadow-inner flex flex-col">
          {/* Inner Glare / Screen Border Line */}
          <div className="w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent" />

          {/* Genuine QuestionCard Component */}
          <div className="flex-1 overflow-y-auto">
            <QuestionCard
              question={convertedQuestion}
              questionNumber={question.question_number ?? questionIndex + 1}
              totalQuestions={totalQuestions}
              status={status}
              timeLeft={90}
              isTimed={false}
              onAnswer={handleAnswer}
              onNext={handleNext}
              selectedOptionId={selectedOptionId}
              firstWrongOptionId={firstWrongOptionId}
              currentStreak={status === 'answered' && !firstWrongOptionId ? 4 : 1}
              isEndless={false}
              onFinish={handleManualReset}
              totalXP={totalXP}
            />
          </div>
        </div>

        {/* Full Explanation Derivation Revealed on Retry Wrong (or whenever resolved) */}
        {isRetryWrong && question.explanation_markdown && (
          <div className="p-4 rounded-2xl border-2 border-slate-800 bg-[#ffe1d0] shadow-offset-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-accent-700 flex-shrink-0" />
              <h4 className="font-heading text-sm text-slate-800 uppercase tracking-wider m-0">
                Full Explanation & Derivation Revealed
              </h4>
              <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-accent-600 text-white font-bold">
                0 XP Buzzer
              </span>
            </div>
            <div className="text-sm text-slate-800 leading-relaxed font-body bg-neutral-100/90 p-3 rounded-xl border border-slate-800/20">
              <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                {question.explanation_markdown}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Gameboy Bottom Details: Hotkey notice & Speaker Slits */}
        <div className="flex items-center justify-between pt-1 text-slate-600 text-xs font-bold">
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
    </div>
  );
}

export default IngestionLivePreview;

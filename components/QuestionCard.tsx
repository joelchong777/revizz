'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Question } from '../hooks/useQuizGame';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  status: 'unanswered' | 'first-wrong' | 'answered' | 'timeout';
  timeLeft: number;
  isTimed: boolean;
  onAnswer: (optionId: string) => void;
  onNext: () => void;
  selectedOptionId: string | null;
  firstWrongOptionId: string | null;
  currentStreak: number;
  isEndless: boolean;
  onFinish: () => void;
  totalXP: number;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  status,
  timeLeft,
  isTimed,
  onAnswer,
  onNext,
  selectedOptionId,
  firstWrongOptionId,
  currentStreak,
  isEndless,
  onFinish,
  totalXP
}: QuestionCardProps) {
  const shouldReduceMotion = useReducedMotion();

  const [liveAnnouncement, setLiveAnnouncement] = React.useState('');
  const lowTimeAnnouncedRef = React.useRef(false);

  // Reset low-time announced flag when question changes and announce question header
  React.useEffect(() => {
    lowTimeAnnouncedRef.current = false;
    setLiveAnnouncement(`Question ${questionNumber} of ${totalQuestions}.`);
  }, [question.id, questionNumber, totalQuestions]);

  // Low time warning (< 10s)
  React.useEffect(() => {
    if (
      isTimed &&
      timeLeft < 10 &&
      timeLeft > 0 &&
      status !== 'answered' &&
      status !== 'timeout' &&
      !lowTimeAnnouncedRef.current
    ) {
      lowTimeAnnouncedRef.current = true;
      setLiveAnnouncement(`Warning: ${timeLeft} seconds remaining.`);
    }
  }, [isTimed, timeLeft, status]);

  // Answer state changes announcement
  React.useEffect(() => {
    if (status === 'first-wrong') {
      setLiveAnnouncement('Incorrect option selected. You have one retry remaining.');
    } else if (status === 'answered') {
      if (firstWrongOptionId) {
        setLiveAnnouncement('Correct on retry! You earned 5 XP.');
      } else {
        setLiveAnnouncement('Correct answer! You earned 10 XP.');
      }
    } else if (status === 'timeout') {
      setLiveAnnouncement("Time's up for this question.");
    }
  }, [status, firstWrongOptionId]);

  // Keyboard Hotkeys:
  // - 1 / A / a -> Option A (index 0)
  // - 2 / B / b -> Option B (index 1)
  // - 3 / C / c -> Option C (index 2)
  // - 4 / D / d -> Option D (index 3)
  // - Enter / Space -> Next question when answered/timeout
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard against typing in form inputs, textareas, etc.
      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isInput) return;

      // When answered or timeout: Enter or Space calls onNext()
      if (status === 'answered' || status === 'timeout') {
        if (e.key === 'Enter' || e.key === ' ') {
          // If the user is specifically focusing an element marked with data-no-hotkey, let it handle naturally
          if (target?.closest('button[data-no-hotkey="true"]')) {
            return;
          }
          e.preventDefault();
          onNext();
          return;
        }
      }

      // During active question round: 1-4, A-D select options
      if (status === 'unanswered' || status === 'first-wrong') {
        const key = e.key.toUpperCase();
        const keyIndexMap: Record<string, number> = {
          '1': 0, 'A': 0,
          '2': 1, 'B': 1,
          '3': 2, 'C': 2,
          '4': 3, 'D': 3,
        };

        if (key in keyIndexMap) {
          const idx = keyIndexMap[key];
          const option = question.options[idx];
          if (option) {
            // Prevent selecting the disabled firstWrongOptionId in retry mode
            if (status === 'first-wrong' && option.id === firstWrongOptionId) {
              return;
            }
            e.preventDefault();
            onAnswer(option.id);
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [status, question.options, firstWrongOptionId, onAnswer, onNext]);

  const getOptionStyle = (optId: string) => {
    let base = "w-full min-h-[56px] p-3.5 sm:p-4 text-left rounded-2xl border-2 border-b-4 font-bold relative text-base sm:text-lg mb-3 sm:mb-3.5 transition-all select-none focus-visible:ring-4 focus-visible:ring-indigo-400 focus-visible:outline-none ";
    
    // Default style (unanswered)
    if (status === 'unanswered') {
      return base + "border-slate-800 border-b-slate-800 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800 shadow-chunky cursor-pointer active:translate-y-0.5 active:border-b-2";
    }

    if (status === 'first-wrong') {
      if (optId === firstWrongOptionId) {
        // Disabled, grey
        return base + "border-slate-300 border-b-slate-300 bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed shadow-none";
      }
      return base + "border-slate-800 border-b-slate-800 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800 shadow-chunky cursor-pointer active:translate-y-0.5 active:border-b-2";
    }

    // answered or timeout
    if (status === 'answered' || status === 'timeout') {
      if (optId === question.correct_option_id) {
        // Correct option
        return base + "border-emerald-500 border-b-emerald-700 bg-emerald-50 text-emerald-950 shadow-none";
      }
      
      if (optId === selectedOptionId && optId !== question.correct_option_id) {
        // The wrong one picked
        return base + "border-rose-400 border-b-rose-600 bg-rose-50 text-rose-950 shadow-none opacity-85";
      }

      if (optId === firstWrongOptionId) {
        return base + "border-slate-300 border-b-slate-300 bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed shadow-none";
      }

      // Other non-picked, non-correct options
      return base + "border-slate-200 border-b-slate-200 bg-slate-50 text-slate-400 opacity-50 cursor-not-allowed shadow-none";
    }

    return base + "border-slate-800 border-b-slate-800 bg-white text-slate-800 shadow-chunky";
  };

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <div className="flex flex-col h-full w-full max-w-lg mx-auto pb-28 sm:pb-6">
      {/* Screen Reader Live Announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Top Bar */}
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="bg-white px-2.5 sm:px-3 py-1.5 rounded-full font-black text-slate-700 shadow-xs text-xs sm:text-sm border border-slate-200">
            {isEndless ? `Q${questionNumber}` : `Q${questionNumber} / ${totalQuestions}`}
          </div>
          {currentStreak >= 3 && (
            <motion.div
              initial={shouldReduceMotion ? { scale: 1 } : { scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 450, damping: 15 }}
              className="bg-amber-100 text-amber-900 px-2.5 sm:px-3 py-1.5 rounded-full font-black shadow-xs text-xs sm:text-sm border border-amber-300 flex items-center gap-1 animate-bounce"
            >
              🔥 {currentStreak}
            </motion.div>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <motion.div
            key={`xp-${totalXP}`}
            initial={shouldReduceMotion ? false : { scale: 1.15 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="bg-brand-indigo text-white px-2.5 sm:px-3 py-1.5 rounded-full font-black shadow-xs text-xs sm:text-sm"
          >
            {totalXP} XP
          </motion.div>
          <button 
            type="button"
            onClick={onFinish}
            data-no-hotkey="true"
            title="Finish round early"
            className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-full font-bold hover:bg-slate-300 transition-colors cursor-pointer active:translate-y-0.5 focus-visible:ring-4 focus-visible:ring-indigo-400 focus-visible:outline-none"
          >
            Finish
          </button>
        </div>
      </div>

      {/* Timer Bar */}
      {isTimed && (
        <div className="w-full bg-slate-200 rounded-full h-2 sm:h-2.5 mb-4 sm:mb-6 overflow-hidden border border-slate-200">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ease-linear ${timeLeft <= 15 ? 'bg-brand-coral' : 'bg-brand-teal'}`}
            style={{ width: `${Math.min(100, Math.max(0, (timeLeft / 90) * 100))}%` }}
          />
        </div>
      )}

      {/* Question Content: Bouncy Spring Card Entry with KaTeX overflow protection & CLS containment */}
      <motion.div
        key={`card-${question.id}`}
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={
          shouldReduceMotion
            ? { duration: 0.1 }
            : { type: "spring" as const, stiffness: 350, damping: 22 }
        }
        className="card-playful p-4 sm:p-6 mb-4 sm:mb-6 border-2 border-b-4 border-slate-800 bg-white shadow-chunky rounded-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
          <span className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
            {question.citation || 'Practice Question'}
          </span>
          {question.topic_id && (
            <span className="text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600">
              {question.topic_id.replace('topic_', 'Topic ')}
            </span>
          )}
        </div>
        <div className="prose text-base sm:text-lg max-w-none text-slate-800 break-words overflow-x-auto leading-relaxed min-h-[72px] contain-content">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {question.stem_markdown}
          </ReactMarkdown>
        </div>
      </motion.div>

      {/* Options with Stagger/Spring and Gestures */}
      <motion.div
        key={`options-${question.id}`}
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0.1 }
            : { type: "spring" as const, stiffness: 320, damping: 24, delay: 0.05 }
        }
        role="radiogroup"
        aria-label="Answer options"
        className="flex-1"
      >
        {question.options.map((opt, i) => {
          const isDisabled =
            status === 'answered' ||
            status === 'timeout' ||
            (status === 'first-wrong' && opt.id === firstWrongOptionId);
          const isFirstWrong =
            status === 'first-wrong' && opt.id === firstWrongOptionId;
          const isRevealedCorrect =
            (status === 'answered' || status === 'timeout') &&
            opt.id === question.correct_option_id;

          let optionAnimate: Record<string, any> = { x: 0, scale: 1 };
          let optionTransition: any = {
            type: "spring" as const,
            stiffness: 400,
            damping: 25,
          };

          if (!shouldReduceMotion) {
            if (isFirstWrong) {
              // Realistic shake physics on 1st wrong attempt
              optionAnimate = { x: [-10, 10, -8, 8, -4, 4, 0] };
              optionTransition = { duration: 0.45, ease: "easeInOut" as const };
            } else if (isRevealedCorrect) {
              // Pop bounce on correct answer
              optionAnimate = { scale: [1, 1.08, 1] };
              optionTransition = {
                duration: 0.4,
                type: "spring" as const,
                stiffness: 500,
                damping: 15,
              };
            }
          }

          return (
            <motion.button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selectedOptionId === opt.id}
              aria-disabled={isDisabled}
              onClick={() => onAnswer(opt.id)}
              disabled={isDisabled}
              className={getOptionStyle(opt.id)}
              animate={optionAnimate}
              transition={optionTransition}
              whileHover={
                !isDisabled && !shouldReduceMotion ? { scale: 1.015 } : undefined
              }
              whileTap={
                !isDisabled && !shouldReduceMotion ? { scale: 0.97 } : undefined
              }
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span
                    className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs sm:text-sm font-black flex-shrink-0 transition-colors ${
                      (status === 'answered' || status === 'timeout') && opt.id === question.correct_option_id
                        ? 'bg-emerald-200 text-emerald-950'
                        : (status === 'answered' || status === 'timeout') && opt.id === selectedOptionId
                        ? 'bg-rose-200 text-rose-950'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {letters[i]}
                  </span>
                  <div className="flex-1 leading-snug text-left break-words overflow-x-auto min-w-0">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {opt.text_markdown}
                    </ReactMarkdown>
                  </div>
                </div>
                <span
                  className="hidden md:inline-flex items-center text-[11px] font-black px-1.5 py-0.5 rounded-lg bg-slate-100 border border-slate-300 text-slate-500 ml-2 flex-shrink-0"
                  aria-hidden="true"
                >
                  [{letters[i]} / {i + 1}]
                </span>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Sticky Bottom Action Bar on Mobile / Inline on Tablet+Desktop */}
      {(status === 'answered' || status === 'timeout') && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 380, damping: 24 }}
          className="fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-sm border-t border-slate-200 sm:relative sm:border-0 sm:bg-transparent sm:p-0 sm:mt-4 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:shadow-none sm:z-auto"
        >
          <div className="max-w-lg mx-auto w-full">
            {status === 'timeout' && (
              <p className="text-brand-coral font-black text-center mb-2 text-sm sm:text-base">Time&apos;s up!</p>
            )}
            {status === 'answered' && firstWrongOptionId && (
              <p className="text-brand-amber font-black text-center mb-2 text-sm sm:text-base">Correct on retry! (+5 XP)</p>
            )}
            <motion.button
              whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
              onClick={onNext}
              className="btn-chunky-indigo w-full py-3.5 sm:py-4 px-6 text-base sm:text-lg font-black tracking-wide shadow-chunky cursor-pointer min-h-[52px] focus-visible:ring-4 focus-visible:ring-indigo-400 focus-visible:outline-none"
            >
              Next Question ➔
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default QuestionCard;

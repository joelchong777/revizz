'use client';

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import confetti from 'canvas-confetti';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { ChevronDown, ChevronUp, Sparkles, Flame, CheckCircle2, RotateCcw, XCircle, Trophy } from 'lucide-react';
import { MissedQuestionItem } from '../hooks/useQuizGame';
import { playFanfare, playPop } from '../lib/audio';
import { Badge } from './ui/badge';

interface RoundSummaryProps {
  totalXP: number;
  peakStreak: number;
  correctFirstTryCount: number;
  correctRetryCount: number;
  wrongCount: number;
  missedQuestions: MissedQuestionItem[];
  onReviewMissed: () => void;
  onPlayAgain: () => void;
  onHome: () => void;
}

export function RoundSummary({
  totalXP,
  peakStreak,
  correctFirstTryCount,
  correctRetryCount,
  wrongCount,
  missedQuestions,
  onReviewMissed,
  onPlayAgain,
  onHome,
}: RoundSummaryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const totalAnswered = correctFirstTryCount + correctRetryCount + wrongCount;
  const accuracy = totalAnswered > 0
    ? Math.round((correctFirstTryCount / totalAnswered) * 100)
    : 0;

  useEffect(() => {
    // Audio celebration
    playFanfare();

    // Visual confetti celebration
    if (typeof window !== 'undefined') {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion) {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#FACC15', '#14B8A6', '#6366F1', '#FB7185', '#22C55E'],
        });
      }
    }
  }, []);

  const toggleExpand = (id: string) => {
    playPop();
    setExpandedId(prev => (prev === id ? null : id));
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: shouldReduceMotion
        ? { duration: 0.1 }
        : {
            staggerChildren: 0.12,
            delayChildren: 0.05,
          },
    },
  };

  const itemVariants: Variants = {
    hidden: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: shouldReduceMotion
        ? { duration: 0.1 }
        : {
            type: 'spring' as const,
            stiffness: 320,
            damping: 24,
          },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full max-w-lg mx-auto py-4 sm:py-6 px-1 sm:px-4 flex flex-col gap-4 sm:gap-6"
    >
      {/* 1. Header Banner & XP Card (Staggered spring entrance) */}
      <motion.div
        variants={itemVariants}
        className="card-playful border-2 border-b-4 border-slate-800 text-center relative overflow-hidden bg-gradient-to-b from-white to-amber-50/60 p-5 sm:p-6"
      >
        {/* Decorative Badge */}
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-3xl bg-brand-yellow border-b-4 border-amber-500 shadow-playful mb-3 animate-bounce">
          <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-amber-950" />
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-1">
          Round Complete!
        </h1>
        <p className="text-slate-500 font-bold text-xs sm:text-sm max-w-xs mx-auto">
          Sensational revision workout! Here is your performance breakdown:
        </p>

        {/* Flying XP Highlight with spring pop */}
        <motion.div
          initial={shouldReduceMotion ? { scale: 1 } : { scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 450, damping: 16, delay: 0.2 }}
          className="mt-4 sm:mt-5 inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 border-b-4 border-amber-600 shadow-chunky text-amber-950 font-black text-lg sm:text-2xl tracking-wide select-none"
        >
          <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-amber-900" style={{ animationDuration: '4s' }} />
          <span>+{totalXP} XP EARNED</span>
        </motion.div>
      </motion.div>

      {/* 2. Performance Stats Cards (Staggered spring entrance) */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Accuracy Stat */}
        <div className="card-playful p-3.5 sm:p-4 flex flex-col justify-between border-teal-200 bg-teal-50/40">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-teal-700 truncate">
            Accuracy (1st Try)
          </span>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-teal-800">{accuracy}%</span>
          </div>
          <div className="w-full bg-teal-200/60 rounded-full h-1.5 sm:h-2 mt-2 overflow-hidden">
            <div
              className="bg-brand-teal h-full rounded-full transition-all duration-1000"
              style={{ width: `${accuracy}%` }}
            />
          </div>
        </div>

        {/* Peak Streak */}
        <div className="card-playful p-3.5 sm:p-4 flex flex-col justify-between border-orange-200 bg-orange-50/40">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1 truncate">
            <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500 flex-shrink-0" /> Peak Streak
          </span>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black text-orange-800">{peakStreak}</span>
            <span className="text-xs sm:text-sm font-bold text-orange-600">in a row</span>
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-orange-500 mt-1 truncate">
            {peakStreak >= 5 ? 'Unstoppable! 🔥' : peakStreak >= 3 ? 'On fire! ⚡' : 'Keep building! 🌱'}
          </span>
        </div>
      </motion.div>

      {/* 3. Answer Breakdown Details */}
      <motion.div variants={itemVariants} className="card-playful border-2 border-b-4 border-slate-800 p-4 sm:p-5 space-y-2.5 sm:space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Round Breakdown</h3>

        <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand-green flex-shrink-0" />
            <span className="font-bold text-slate-700 text-xs sm:text-sm">First-Try Correct</span>
          </div>
          <span className="font-black text-base sm:text-lg text-brand-green-dark">
            {correctFirstTryCount}
          </span>
        </div>

        <div className="flex items-center justify-between py-1.5 sm:py-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 flex-shrink-0" />
            <span className="font-bold text-slate-700 text-xs sm:text-sm">Retry Correct (+5 XP)</span>
          </div>
          <span className="font-black text-base sm:text-lg text-amber-700">
            {correctRetryCount}
          </span>
        </div>

        <div className="flex items-center justify-between py-1.5 sm:py-2">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-brand-coral flex-shrink-0" />
            <span className="font-bold text-slate-700 text-xs sm:text-sm">Incorrect / Timeout</span>
          </div>
          <span className="font-black text-base sm:text-lg text-brand-coral-dark">
            {wrongCount}
          </span>
        </div>
      </motion.div>

      {/* 4. List of Missed Questions */}
      <motion.div variants={itemVariants} className="card-playful border-2 border-b-4 border-slate-800 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-base sm:text-lg text-slate-900 tracking-tight">
              Missed Questions
            </h3>
            <Badge variant="coral">
              {missedQuestions.length}
            </Badge>
          </div>
          <span className="text-[11px] sm:text-xs font-bold text-slate-400">
            Tap card to inspect
          </span>
        </div>

        {missedQuestions.length === 0 ? (
          <div className="text-center py-5 sm:py-6 px-4 bg-emerald-50 rounded-2xl border-2 border-dashed border-emerald-200">
            <span className="text-3xl block mb-2">🌟</span>
            <p className="font-black text-emerald-900 text-base">Flawless Round!</p>
            <p className="text-emerald-700 font-semibold text-xs mt-1">
              You answered all questions correctly on your first try!
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-3">
            {missedQuestions.map((item) => {
              const isExpanded = expandedId === item.question.id;
              const correctOption = item.question.options.find(
                (opt) => opt.id === item.question.correct_option_id
              );

              return (
                <div
                  key={item.question.id}
                  className="rounded-2xl border-2 border-b-4 border-slate-800 overflow-hidden bg-white transition-all shadow-xs"
                >
                  {/* Card Header Preview */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.question.id)}
                    className="w-full p-3 sm:p-4 flex items-start justify-between gap-2.5 sm:gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-300 font-black text-xs text-slate-700">
                          Q{item.questionNumber}
                        </span>

                        {/* Status Badge */}
                        {item.outcome === 'retry-correct' ? (
                          <Badge variant="amber">
                            Correct on retry (+5 XP)
                          </Badge>
                        ) : (
                          <Badge variant="coral">
                            Needs review (0 XP)
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm font-semibold text-slate-800 line-clamp-2 break-words">
                        {item.question.stem_markdown.replace(/[*#$]/g, '')}
                      </p>
                    </div>

                    <div className="text-slate-400 mt-0.5 flex-shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-600" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Detail View with KaTeX overflow protection */}
                  {isExpanded && (
                    <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 text-xs sm:text-sm space-y-2.5 sm:space-y-3">
                      <div>
                        <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1">
                          Full Question Stem
                        </span>
                        <div className="prose text-xs sm:text-sm max-w-none text-slate-900 font-medium bg-white p-3 rounded-xl border border-slate-200 break-words overflow-x-auto leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                          >
                            {item.question.stem_markdown}
                          </ReactMarkdown>
                        </div>
                      </div>

                      {correctOption && (
                        <div>
                          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                            Correct Answer
                          </span>
                          <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-300 font-bold text-emerald-950 flex items-start gap-2 break-words overflow-x-auto">
                            <span className="text-emerald-600 flex-shrink-0 font-black">✓</span>
                            <div className="flex-1 min-w-0">
                              <ReactMarkdown
                                remarkPlugins={[remarkMath]}
                                rehypePlugins={[rehypeKatex]}
                              >
                                {correctOption.text_markdown}
                              </ReactMarkdown>
                            </div>
                          </div>
                        </div>
                      )}

                      {item.question.citation && (
                        <p className="text-[11px] sm:text-xs font-semibold text-slate-400 italic">
                          Source: {item.question.citation}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* 5. Chunky 3D Action Buttons */}
      <motion.div variants={itemVariants} className="flex flex-col gap-2.5 sm:gap-3 pt-2">
        {missedQuestions.length > 0 && (
          <motion.button
            whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
            whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
            type="button"
            onClick={onReviewMissed}
            className="btn-chunky-coral w-full py-3.5 sm:py-4 px-4 sm:px-6 text-base sm:text-lg font-black tracking-wide shadow-chunky cursor-pointer min-h-[52px]"
          >
            Review Missed Questions ({missedQuestions.length})
          </motion.button>
        )}

        <motion.button
          whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          type="button"
          onClick={onPlayAgain}
          className="btn-chunky-indigo w-full py-3.5 sm:py-4 px-4 sm:px-6 text-base sm:text-lg font-black tracking-wide shadow-chunky cursor-pointer min-h-[52px]"
        >
          Play Again
        </motion.button>

        <motion.button
          whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }}
          whileTap={shouldReduceMotion ? undefined : { scale: 0.97 }}
          type="button"
          onClick={onHome}
          className="btn-chunky-slate w-full py-3 sm:py-3.5 px-4 sm:px-6 text-sm sm:text-base font-bold text-slate-700 shadow-chunky cursor-pointer min-h-[48px]"
        >
          Home
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

export default RoundSummary;

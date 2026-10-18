'use client';

import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import confetti from 'canvas-confetti';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { MissedQuestionItem } from '../hooks/useQuizGame';
import { playFanfare, playPop } from '../lib/audio';
import { cn } from '@/lib/utils';
import { AdSlotBanner } from '@/components/ads/AdSlotBanner';

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
  const [openMissedIndex, setOpenMissedIndex] = useState<number | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const totalAnswered = correctFirstTryCount + correctRetryCount + wrongCount;
  const accuracy = totalAnswered > 0
    ? Math.round((correctFirstTryCount / totalAnswered) * 100)
    : 0;

  useEffect(() => {
    playFanfare();

    if (typeof window !== 'undefined') {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReducedMotion) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#c67139', '#7a8a5e', '#ffc6a5', '#ccdbb2', '#201e1d'],
        });
      }
    }
  }, []);

  const toggleMissed = (index: number) => {
    playPop();
    setOpenMissedIndex((prev) => (prev === index ? null : index));
  };

  const title =
    accuracy >= 80
      ? 'Brilliant round!'
      : accuracy >= 50
      ? 'Solid round!'
      : 'Round complete';

  const subtitle = `Cambridge Economics 0455 · ${totalAnswered} Questions Answered`;

  const stats = [
    {
      icon: '⚡',
      label: 'XP Earned',
      value: `+${totalXP}`,
      bg: 'bg-accent-300',
    },
    {
      icon: '🔥',
      label: 'Peak Streak',
      value: `${peakStreak}×`,
      bg: 'bg-accent-200',
    },
    {
      icon: '🎯',
      label: 'Accuracy',
      value: `${accuracy}%`,
      bg: 'bg-accent-2-300',
    },
    {
      icon: '📋',
      label: 'Mastered',
      value: `${correctFirstTryCount}/${totalAnswered}`,
      bg: 'bg-neutral-100',
    },
  ];

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="w-full max-w-[480px] mx-auto py-8 sm:py-10 px-4 sm:px-6 pb-16 flex flex-col gap-6 sm:gap-7 select-none"
    >
      {/* 1. Score Crest & Header Hero */}
      <div className="flex items-center gap-4">
        {/* Proportional Score Badge */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-accent-300 border-[3px] border-text shadow-offset-4 flex flex-col items-center justify-center -rotate-3 flex-none">
          <span className="font-heading text-3xl sm:text-4xl text-text leading-none">
            {correctFirstTryCount}/{totalAnswered}
          </span>
          <span className="text-[10px] sm:text-xs font-bold tracking-wider uppercase text-text mt-1">
            correct
          </span>
        </div>

        {/* Title and Subtitle */}
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-2xl sm:text-3xl leading-tight text-text mb-1">
            {title}
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-neutral-700 m-0 leading-snug">
            {subtitle}
          </p>
        </div>
      </div>

      {/* 2. Visual Stat Cards (2x2 Grid with icons) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
        {stats.map((s, idx) => (
          <div
            key={idx}
            className={cn(
              'flex flex-col gap-1 p-3.5 sm:p-4 rounded-2xl border-2 border-text shadow-offset-3',
              s.bg
            )}
          >
            <span className="text-xs font-bold tracking-wider uppercase text-neutral-800 flex items-center gap-1.5">
              <span>{s.icon}</span> {s.label}
            </span>
            <span className="font-heading text-2xl sm:text-3xl leading-tight text-text truncate">
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* 3. Clean Sweep Banner vs Missed Questions */}
      <div className="flex flex-col gap-3">
        {missedQuestions.length === 0 ? (
          /* Celebratory Gold Trophy Card */
          <div className="rounded-3xl bg-accent-2-200 border-2 border-text shadow-offset-3 p-5 sm:p-6 text-center flex flex-col items-center gap-2">
            <span className="text-4xl sm:text-5xl" role="img" aria-label="Trophy">
              🏆
            </span>
            <h3 className="font-heading text-xl sm:text-2xl text-text m-0">Clean Sweep!</h3>
            <p className="text-xs sm:text-sm font-semibold text-neutral-700 m-0 max-w-xs">
              Flawless round! Every single question answered correctly on your first attempt.
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
              Missed questions · {missedQuestions.length}
            </h2>

            <div className="flex flex-col gap-3">
              {missedQuestions.map((item, idx) => {
                const isOpen = openMissedIndex === idx;
                const correctIdx = item.question.options.findIndex(
                  (opt) => opt.id === item.question.correct_option_id
                );
                const correctLetter = correctIdx >= 0 ? letters[correctIdx] : 'A';
                const correctOption = item.question.options[correctIdx];

                const steps = [
                  `Review concept: ${item.question.stem_markdown.replace(/[*#$]/g, '').slice(0, 90)}...`,
                  `Correct answer is Option ${correctLetter}: "${correctOption?.text_markdown.replace(/[*#$]/g, '') || ''}".`,
                  `This question has been queued to your Review Pile for spaced repetition practice.`,
                ];

                return (
                  <div
                    key={item.question.id}
                    className="rounded-2xl bg-neutral-100 border-2 border-text shadow-offset-3 overflow-hidden"
                  >
                    {/* Accordion Trigger */}
                    <button
                      type="button"
                      onClick={() => toggleMissed(idx)}
                      className="w-full flex items-center gap-2.5 p-3 px-3.5 bg-transparent border-0 cursor-pointer text-left transition-colors hover:bg-neutral-200/50"
                    >
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="text-[11px] font-bold text-neutral-700">
                          {item.question.citation?.replace('Cambridge IGCSE ', '') || `Question ${item.questionNumber}`}
                        </span>
                        <span className="text-sm font-semibold text-text leading-snug line-clamp-2">
                          {item.question.stem_markdown.replace(/[*#$]/g, '')}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'inline-flex transition-transform duration-200 text-text flex-shrink-0',
                          isOpen && 'rotate-180'
                        )}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.75"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </span>
                    </button>

                    {/* Expanded Content */}
                    {isOpen && (
                      <div className="flex flex-col gap-2 p-3.5 sm:p-4 border-t-2 border-neutral-300">
                        <span className="self-start px-3 py-1 rounded-xl bg-accent-2-300 border-[1.5px] border-text font-bold text-xs sm:text-sm text-text">
                          Answer {correctLetter} · {correctOption?.text_markdown.replace(/[*#$]/g, '')}
                        </span>
                        <div className="flex flex-col gap-1.5 mt-1">
                          {steps.map((st, stepIdx) => (
                            <span
                              key={stepIdx}
                              className="text-xs sm:text-sm leading-relaxed text-text font-medium"
                            >
                              {stepIdx + 1}. {st}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      <AdSlotBanner
        slotId="round_summary_card"
        className="my-1"
      />

      {/* 4. Action Buttons Hierarchy */}
      <div className="flex flex-col gap-3 pt-2">
        {missedQuestions.length > 0 ? (
          <>
            {/* Primary Hero CTA */}
            <button
              type="button"
              onClick={() => {
                playPop();
                onReviewMissed();
              }}
              className="w-full py-3.5 px-5 rounded-2xl bg-accent hover:bg-accent-600 text-neutral-100 border-2 border-text shadow-offset-4 font-heading text-lg sm:text-xl active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center"
            >
              Review missed questions 🧠
            </button>

            {/* Secondary Grid */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  playPop();
                  onPlayAgain();
                }}
                className="py-3 px-4 rounded-2xl bg-accent-2-300 hover:bg-accent-2-400 text-text border-2 border-text shadow-offset-3 font-heading text-base cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none select-none text-center"
              >
                Play Again 🔄
              </button>
              <button
                type="button"
                onClick={() => {
                  playPop();
                  onHome();
                }}
                className="py-3 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-text border-2 border-text shadow-offset-3 font-heading text-base cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none select-none text-center"
              >
                Home 🏠
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Primary Hero CTA */}
            <button
              type="button"
              onClick={() => {
                playPop();
                onPlayAgain();
              }}
              className="w-full py-3.5 px-5 rounded-2xl bg-accent hover:bg-accent-600 text-neutral-100 border-2 border-text shadow-offset-4 font-heading text-lg sm:text-xl active:translate-x-1 active:translate-y-1 active:shadow-none transition-all cursor-pointer text-center"
            >
              Play Again 🔄
            </button>

            {/* Secondary Button */}
            <button
              type="button"
              onClick={() => {
                playPop();
                onHome();
              }}
              className="w-full py-3 px-4 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-text border-2 border-text shadow-offset-3 font-heading text-base cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none select-none text-center"
            >
              Home 🏠
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default RoundSummary;

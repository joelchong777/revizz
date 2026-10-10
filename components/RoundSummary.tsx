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
      label: 'XP earned',
      value: `+${totalXP}`,
      bg: 'bg-accent-300',
    },
    {
      label: 'Peak streak',
      value: `🔥 ${peakStreak}×`,
      bg: 'bg-accent-200',
    },
    {
      label: '1st-try accuracy',
      value: `${accuracy}%`,
      bg: 'bg-accent-2-300',
    },
    {
      label: 'Questions',
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
      className="w-full max-w-[480px] mx-auto py-8 sm:py-10 px-4 sm:px-6 pb-16 flex flex-col gap-7 sm:gap-8 select-none"
    >
      {/* 1. Giant Circular Score Badge + Title */}
      <div className="flex items-center gap-4">
        {/* Giant Circular Score Badge */}
        <div className="w-[104px] h-[104px] flex-none rounded-full bg-accent-300 border-[3px] border-text shadow-[5px_5px_0_#201e1d] flex flex-col items-center justify-center -rotate-6">
          <span className="font-heading text-4xl leading-none text-text">
            {correctFirstTryCount}/{totalAnswered}
          </span>
          <span className="text-[11px] font-bold tracking-[0.08em] uppercase text-text mt-0.5">
            correct
          </span>
        </div>

        {/* Title and Subtitle */}
        <div className="flex-1 min-w-0">
          <h1 className="font-heading text-[32px] sm:text-[34px] leading-tight text-text mb-1">
            {title}
          </h1>
          <p className="text-sm font-semibold text-neutral-700 m-0 leading-snug">
            {subtitle}
          </p>
        </div>
      </div>

      {/* 2. 4-Card Stats Grid */}
      <div className="grid grid-cols-2 gap-3.5 sm:gap-4">
        {stats.map((s, idx) => (
          <div
            key={idx}
            className={cn(
              'flex flex-col gap-1.5 p-4 sm:p-5 rounded-[22px] border-2 border-text shadow-offset-3',
              s.bg
            )}
          >
            <span className="text-xs font-bold tracking-[0.04em] uppercase text-neutral-800">
              {s.label}
            </span>
            <span className="font-heading text-[28px] leading-tight text-text truncate">
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* 3. Missed Questions Accordion */}
      <div className="flex flex-col gap-3.5">
        <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0 mb-1">
          Missed questions · {missedQuestions.length}
        </h2>

        {missedQuestions.length === 0 ? (
          <div className="p-3.5 sm:px-4 rounded-[22px] bg-accent-2-200 border-2 border-text font-bold text-sm text-text">
            Clean sweep — nothing to review. 👑
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {missedQuestions.map((item, idx) => {
              const isOpen = openMissedIndex === idx;
              const correctIdx = item.question.options.findIndex(
                (opt) => opt.id === item.question.correct_option_id
              );
              const correctLetter = correctIdx >= 0 ? letters[correctIdx] : 'A';
              const correctOption = item.question.options[correctIdx];

              const steps = [
                `Review syllabus concept: ${item.question.stem_markdown.replace(/[*#$]/g, '').slice(0, 90)}...`,
                `Correct answer is Option ${correctLetter}: "${correctOption?.text_markdown.replace(/[*#$]/g, '') || ''}".`,
                `This question has been queued to your Review Pile for spaced repetition practice.`,
              ];

              return (
                <div
                  key={item.question.id}
                  className="rounded-[22px] bg-neutral-100 border-2 border-text shadow-offset-3 overflow-hidden"
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
                    <div className="flex flex-col gap-2 p-4 pb-4 pt-3.5 border-t border-neutral-300/80">
                      <span className="self-start px-3 py-1 rounded-full bg-accent-2-300 border-[1.5px] border-text font-bold text-[13px] text-text">
                        Answer {correctLetter} · {correctOption?.text_markdown.replace(/[*#$]/g, '')}
                      </span>
                      <div className="flex flex-col gap-1.5 mt-1">
                        {steps.map((st, stepIdx) => (
                          <span
                            key={stepIdx}
                            className="text-[13px] leading-relaxed text-text font-medium"
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
        )}
      </div>

      {/* 4. Action Pills */}
      <div className="flex flex-col gap-3.5 pt-2 sm:pt-4">
        {missedQuestions.length > 0 && (
          <button
            type="button"
            onClick={() => {
              playPop();
              onReviewMissed();
            }}
            className="w-full py-[15px] px-5 rounded-full bg-accent hover:bg-accent-600 text-neutral-100 border-2 border-text shadow-offset-4 font-heading text-[19px] cursor-pointer transition-all active:translate-x-1 active:translate-y-1 active:shadow-none select-none text-center"
          >
            Review missed questions 🧠
          </button>
        )}

        <div className="grid grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={() => {
              playPop();
              onPlayAgain();
            }}
            className="py-[13px] px-4 rounded-full bg-accent-2-300 hover:bg-accent-2-400 text-text border-2 border-text shadow-offset-4 font-heading text-base cursor-pointer transition-all active:translate-x-1 active:translate-y-1 active:shadow-none select-none text-center"
          >
            Play again 🔄
          </button>
          <button
            type="button"
            onClick={() => {
              playPop();
              onHome();
            }}
            className="py-[13px] px-4 rounded-full bg-neutral-100 hover:bg-neutral-200 text-text border-2 border-text shadow-offset-4 font-heading text-base cursor-pointer transition-all active:translate-x-1 active:translate-y-1 active:shadow-none select-none text-center"
          >
            Home 🏠
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default RoundSummary;

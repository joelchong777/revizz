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
      ? 'Exceptional Performance'
      : accuracy >= 50
      ? 'Target Benchmark Achieved'
      : 'Diagnostic Completed';

  const subtitle = `Cambridge Economics 0455 · ${totalAnswered} Questions Evaluated`;

  const stats = [
    {
      label: 'XP Earned',
      value: `+${totalXP} XP`,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50/80 border-emerald-200',
    },
    {
      label: 'Peak Streak',
      value: `${peakStreak} 🔥`,
      color: 'text-[#c67139]',
      bg: 'bg-amber-50/80 border-amber-200',
    },
    {
      label: 'First-Try Rate',
      value: `${correctFirstTryCount}/${totalAnswered}`,
      color: 'text-[#201e1d]',
      bg: 'bg-white border-[#201e1d]/15',
    },
    {
      label: 'Retry Resolved',
      value: `${correctRetryCount}`,
      color: 'text-blue-700',
      bg: 'bg-blue-50/80 border-blue-200',
    },
  ];

  const letters = ['A', 'B', 'C', 'D'];

  // SVG circular gauge calculation
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (accuracy / 100) * circumference;

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.98, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="w-full max-w-[500px] mx-auto py-6 sm:py-8 px-4 sm:px-6 pb-16 flex flex-col gap-6 select-none"
    >
      {/* 1. Header & Prominent Accuracy Telemetry Gauge */}
      <div className="p-5 rounded-3xl bg-white/95 border-[1.5px] border-[#201e1d]/20 shadow-sm flex flex-col sm:flex-row items-center gap-5">
        {/* Circular Telemetry Meter */}
        <div className="relative w-28 h-28 flex items-center justify-center flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#eee7db"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke={accuracy >= 80 ? '#7a8a5e' : accuracy >= 50 ? '#c67139' : '#e06d53'}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-heading font-black text-2xl text-text leading-none">
              {accuracy}%
            </span>
            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-500 mt-1">
              ACCURACY
            </span>
          </div>
        </div>

        {/* Title and Subtitle */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              SESSION TELEMETRY DEBRIEF
            </span>
          </div>
          <h1 className="font-heading font-black text-2xl sm:text-3xl leading-tight text-text">
            {title}
          </h1>
          <p className="text-xs font-mono font-medium text-neutral-600 m-0 mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, idx) => (
          <div
            key={idx}
            className={cn(
              'flex flex-col gap-1 p-3.5 rounded-2xl border shadow-xs',
              s.bg
            )}
          >
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-600">
              {s.label}
            </span>
            <span className={cn('font-heading font-bold text-2xl sm:text-[26px] leading-tight truncate', s.color)}>
              {s.value}
            </span>
          </div>
        ))}
      </div>

      {/* 3. Missed Questions Accordion */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-bold tracking-wider uppercase text-neutral-700 m-0">
            ERRORS &amp; DISTRACTORS ({missedQuestions.length})
          </h2>
          <span className="font-mono text-[10px] text-neutral-500 font-bold">
            LEITNER QUEUE
          </span>
        </div>

        {missedQuestions.length === 0 ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 font-mono text-xs font-bold text-emerald-900 flex items-center gap-2">
            <span>👑</span>
            <span>Clean execution! Zero errors recorded. Mastery logged to profile.</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                playPop();
                onReviewMissed();
              }}
              className="w-full py-3.5 px-5 rounded-2xl bg-[#c67139] hover:bg-[#b05f2b] text-[#f9f4ed] border-2 border-[#201e1d] shadow-[0_4px_0_0_#201e1d] font-heading font-bold text-base tracking-wide cursor-pointer transition-all active:translate-y-1 active:shadow-none select-none text-center flex items-center justify-center gap-2"
            >
              <span>REVIEW MISSED ITEMS</span>
              <span className="text-lg">🧠</span>
            </button>

            <div className="flex flex-col gap-2.5">
              {missedQuestions.map((item, idx) => {
                const isOpen = openMissedIndex === idx;
                const correctIdx = item.question.options.findIndex(
                  (opt) => opt.id === item.question.correct_option_id
                );
                const correctLetter = correctIdx >= 0 ? letters[correctIdx] : 'A';
                const correctOption = item.question.options[correctIdx];

                const steps = [
                  `Examine syllabus proposition: "${item.question.stem_markdown.replace(/\$(?!\d)/g, '').replace(/[*#]/g, '').slice(0, 90)}..."`,
                  `Verify Option ${correctLetter}: "${correctOption?.text_markdown.replace(/\$(?!\d)/g, '').replace(/[*#]/g, '') || ''}".`,
                  `Queued to your active Spaced Repetition pile for subsequent verification.`,
                ];

                return (
                  <div
                    key={item.question.id}
                    className="rounded-2xl bg-white/95 border-[1.5px] border-[#201e1d]/20 shadow-xs overflow-hidden"
                  >
                    {/* Accordion Trigger */}
                    <button
                      type="button"
                      onClick={() => toggleMissed(idx)}
                      className="w-full flex items-center gap-3 p-3.5 bg-transparent border-0 cursor-pointer text-left transition-colors hover:bg-neutral-50"
                    >
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                          {item.question.citation?.replace('Cambridge IGCSE ', '') || `ITEM ${item.questionNumber}`}
                        </span>
                        <span className="text-xs sm:text-[13px] font-medium text-text leading-snug line-clamp-2">
                          {item.question.stem_markdown.replace(/\$(?!\d)/g, '').replace(/[*#]/g, '')}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'inline-flex transition-transform duration-200 text-text flex-shrink-0 font-mono text-xs font-bold px-1.5 py-0.5 rounded border border-[#201e1d]/20',
                          isOpen && 'rotate-180 bg-neutral-100'
                        )}
                      >
                        ▼
                      </span>
                    </button>

                    {/* Expanded Content */}
                    {isOpen && (
                      <div className="flex flex-col gap-2.5 p-4 border-t border-[#201e1d]/10 bg-[#faf6f0]">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono font-bold text-xs">
                            CORRECT: [{correctLetter}]
                          </span>
                          <span className="text-xs font-medium text-[#201e1d] truncate">
                            {correctOption?.text_markdown.replace(/\$(?!\d)/g, '').replace(/[*#]/g, '')}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1.5 mt-1 font-mono text-xs">
                          {steps.map((st, stepIdx) => (
                            <div key={stepIdx} className="flex gap-2 items-start text-neutral-700">
                              <span className="text-[#c67139] font-bold">0{stepIdx + 1}.</span>
                              <span className="font-sans text-xs leading-relaxed text-[#201e1d]">
                                {st}
                              </span>
                            </div>
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

      {/* 4. Action CTAs */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            playPop();
            onPlayAgain();
          }}
          className="py-3.5 px-4 rounded-2xl bg-[#201e1d] hover:bg-[#34302d] text-[#f9f4ed] border-2 border-[#201e1d] shadow-[0_4px_0_0_#201e1d] font-heading font-bold text-sm sm:text-base tracking-wide cursor-pointer transition-all active:translate-y-1 active:shadow-none select-none text-center"
        >
          START NEXT SESSION 🔄
        </button>
        <button
          type="button"
          onClick={() => {
            playPop();
            onHome();
          }}
          className="py-3.5 px-4 rounded-2xl bg-white hover:bg-neutral-100 text-text border-2 border-[#201e1d] shadow-[0_4px_0_0_#201e1d] font-heading font-bold text-sm sm:text-base tracking-wide cursor-pointer transition-all active:translate-y-1 active:shadow-none select-none text-center"
        >
          RETURN TO HUB 🏠
        </button>
      </div>
    </motion.div>
  );
}

export default RoundSummary;

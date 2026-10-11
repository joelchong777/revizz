'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { Question } from '../hooks/useQuizGame';
import { cn } from '@/lib/utils';

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
  subject?: string;
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
  totalXP,
  subject,
}: QuestionCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const lowTimeAnnouncedRef = useRef(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const rawDiagramUrl = question.image_url || question.diagram?.image_url;
  const diagramUrl = question.has_diagram === false ? undefined : rawDiagramUrl;
  const altDescription =
    question.diagram?.alt_description ||
    (status === 'unanswered' ? 'Question diagram' : question.citation) ||
    'Cambridge economics question diagram';

  // Reset zoom & image error when question or diagram changes
  useEffect(() => {
    setImageError(false);
    setIsZoomOpen(false);
  }, [question.id, diagramUrl]);

  // Screen reader announcements
  useEffect(() => {
    lowTimeAnnouncedRef.current = false;
    setLiveAnnouncement(`Question ${questionNumber} of ${totalQuestions}.`);
  }, [question.id, questionNumber, totalQuestions]);

  // Scroll to top on question load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [question.id, questionNumber]);

  useEffect(() => {
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

  useEffect(() => {
    if (status === 'first-wrong') {
      setLiveAnnouncement('Incorrect option selected. You have one retry remaining.');
    } else if (status === 'answered') {
      if (firstWrongOptionId) {
        setLiveAnnouncement('Correct on retry! You earned 5 XP.');
      } else {
        setLiveAnnouncement('Correct answer! You earned XP.');
      }
    } else if (status === 'timeout') {
      setLiveAnnouncement("Time's up for this question.");
    }
  }, [status, firstWrongOptionId]);

  // Keyboard Hotkeys: 1-4, A-D, Enter / Space, Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isZoomOpen) {
        e.preventDefault();
        setIsZoomOpen(false);
        return;
      }

      if (isZoomOpen) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if (isInput) return;

      if (status === 'answered' || status === 'timeout') {
        if (e.key === 'Enter' || e.key === ' ') {
          if (target?.closest('button[data-no-hotkey="true"]')) return;
          e.preventDefault();
          onNext();
          return;
        }
      }

      if (status === 'unanswered' || status === 'first-wrong') {
        const key = e.key.toUpperCase();
        const keyIndexMap: Record<string, number> = {
          '1': 0,
          A: 0,
          '2': 1,
          B: 1,
          '3': 2,
          C: 2,
          '4': 3,
          D: 3,
        };

        if (key in keyIndexMap) {
          const idx = keyIndexMap[key];
          const option = question.options[idx];
          if (option) {
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
  }, [status, question.options, firstWrongOptionId, onAnswer, onNext, isZoomOpen]);

  const letters = ['A', 'B', 'C', 'D'];
  const correctOptionIndex = question.options.findIndex(
    (o) => o.id === question.correct_option_id
  );
  const correctLetter = correctOptionIndex >= 0 ? letters[correctOptionIndex] : 'A';
  const correctOption = question.options[correctOptionIndex];

  const isResolved = status === 'answered' || status === 'timeout';
  const isRetry = status === 'first-wrong';

  // Multiplier logic
  const streakMultiplier = currentStreak >= 5 ? 1.5 : currentStreak >= 3 ? 1.2 : 1.0;
  const potentialGain = Math.round(10 * streakMultiplier);

  // Solved feedback gain
  let gainedXP = 0;
  if (status === 'answered') {
    if (firstWrongOptionId) {
      gainedXP = 5;
    } else if (selectedOptionId === question.correct_option_id) {
      gainedXP = potentialGain;
    }
  }

  // Timer metrics
  const urgent = timeLeft <= 15;
  const timeLabel = `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}`;
  const timePct = `${Math.min(100, Math.max(0, (timeLeft / 90) * 100))}%`;
  const timerBg = urgent ? 'bg-accent-200' : 'bg-neutral-100';
  const timerFill = urgent ? 'bg-accent-600' : 'bg-accent-2-500';

  // Streak badge color
  const streakBg =
    currentStreak >= 5
      ? 'bg-accent-300'
      : currentStreak >= 3
      ? 'bg-accent-200'
      : 'bg-neutral-100';

  // Progress percentage
  const progressPct = isEndless
    ? `${((questionNumber % 10) * 10) + (isResolved ? 10 : 0)}%`
    : `${((questionNumber - (isResolved ? 0 : 1)) / totalQuestions) * 100}%`;

  // Feedback details
  const isFirstTryCorrect =
    status === 'answered' &&
    !firstWrongOptionId &&
    selectedOptionId === question.correct_option_id;
  const isRetryCorrect =
    status === 'answered' &&
    firstWrongOptionId &&
    selectedOptionId === question.correct_option_id;
  const isFailed = status === 'timeout' || (status === 'answered' && !isFirstTryCorrect && !isRetryCorrect);

  const fbEmoji = isFirstTryCorrect ? '🎉' : isRetryCorrect ? '👍' : status === 'timeout' ? '⏰' : '🧩';
  const fbTitle = isFirstTryCorrect
    ? 'Nailed it!'
    : isRetryCorrect
    ? 'Got there on retry'
    : status === 'timeout'
    ? 'Time’s up'
    : 'Not this time';
  const fbSub = isFirstTryCorrect
    ? `First try · ${streakMultiplier.toFixed(1)}× streak bonus`
    : isRetryCorrect
    ? 'Half XP · added to your Review Pile'
    : `Answer ${correctLetter} · queued to your Review Pile`;
  const fbBg = isFirstTryCorrect
    ? 'bg-accent-2-300'
    : isRetryCorrect
    ? 'bg-accent-300'
    : 'bg-accent-200';

  // Generated step by step explanations
  const explanationSteps = [
    `Carefully examine the syllabus core statement: "${question.stem_markdown.replace(/[*#$]/g, '').slice(0, 95)}..."`,
    `Identify key requirement: Option ${correctLetter} ("${correctOption?.text_markdown.replace(/[*#$]/g, '') || ''}") provides the precise, direct definition/relationship.`,
    `Verify against alternatives to ensure distractors are eliminated.`,
  ];

  // Distractor breakdown
  const distractorBreakdown = question.options
    .filter((opt) => opt.id !== question.correct_option_id)
    .map((opt) => {
      const idx = question.options.findIndex((o) => o.id === opt.id);
      return {
        letter: letters[idx],
        text: `"${opt.text_markdown.replace(/\$(?!\d)/g, '').replace(/[*#]/g, '')}" represents a common distractor or addresses an unrelated syllabus mechanism.`,
      };
    });

  // KaTeX currency defense for rendering
  const sanitizeStem = (text: string) => {
    if (!text) return '';
    return text.replace(/(?<!\\)\$(\d+(?:,\d{3})*(?:\.\d+)?)/g, '\\$$$1');
  };

  return (
    <div className="w-full max-w-[500px] mx-auto py-3 px-4 pb-14 flex flex-col gap-3 select-none">
      {/* Screen reader live region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Top HUD Telemetry Bar */}
      <div className="p-3 rounded-2xl bg-white/80 border border-[#201e1d]/15 backdrop-blur-md shadow-xs flex flex-col gap-2.5">
        {/* Row 1: Quit Button + Cambridge Citation + Syllabus Topic + Question Counter */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFinish}
            data-no-hotkey="true"
            title="Quit round"
            className="w-7 h-7 flex-none rounded-md bg-[#201e1d]/5 hover:bg-[#201e1d]/10 border border-[#201e1d]/20 flex items-center justify-center cursor-pointer transition-colors text-text active:scale-95"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          {/* Cambridge Paper Citation */}
          <span className="font-mono text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md bg-[#201e1d] text-[#f9f4ed] shadow-xs">
            {question.citation?.replace('Cambridge IGCSE ', '') || 'CAMBRIDGE 0455'}
          </span>

          {/* Syllabus Topic Pill */}
          <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-md border border-[#201e1d]/20 bg-[#eee7db] text-[#474238] truncate max-w-[140px] sm:max-w-[180px]">
            {question.topic || question.topic_id?.replace('topic_', 'Topic ') || 'Syllabus Core'}
          </span>

          {/* Question Counter Telemetry */}
          <span className="font-mono text-xs font-bold text-[#201e1d] ml-auto whitespace-nowrap pl-1">
            {isEndless
              ? `Q${questionNumber} · ∞`
              : `Q${questionNumber}/${totalQuestions}`}
          </span>
        </div>

        {/* Row 2: Crisp High-Tech Progress Track */}
        <div className="h-1.5 w-full rounded-full bg-[#201e1d]/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#c67139] to-[#7a8a5e] transition-all duration-500 ease-out"
            style={{ width: progressPct }}
          />
        </div>

        {/* Row 3: Digital Countdown Timer + Streak Multiplier Telemetry */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {isTimed ? (
            <div
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-[#201e1d]/15 bg-white shadow-xs font-mono font-bold text-xs tracking-wider text-[#201e1d]',
                urgent && !isResolved && 'border-rose-400 bg-rose-50 text-rose-700 animate-pulse'
              )}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span className="tracking-widest">{timeLabel}</span>
              <span className="w-10 h-1.5 rounded-full bg-neutral-200 overflow-hidden ml-1">
                <span
                  className={cn(
                    'block h-full transition-all duration-1000 ease-linear',
                    urgent ? 'bg-rose-500' : 'bg-[#7a8a5e]'
                  )}
                  style={{ width: timePct }}
                />
              </span>
            </div>
          ) : (
            <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md border border-[#201e1d]/15 bg-white text-neutral-600">
              UNTMD · MODE
            </span>
          )}

          {/* Multiplier telemetry chip */}
          <div className="flex items-center gap-1.5 font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-white border border-[#201e1d]/15 shadow-xs text-text">
            <span>🔥 {currentStreak}</span>
            <span className="text-[#c67139]">{streakMultiplier.toFixed(1)}×</span>
            <span className="text-neutral-400">·</span>
            <span className="text-emerald-700">+{potentialGain} XP</span>
          </div>
        </div>
      </div>

      {/* Question Stem Card */}
      <div className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-white/95 border-[1.5px] border-[#201e1d]/20 shadow-sm">
        <div className="text-[16px] sm:text-[17px] leading-relaxed font-medium text-[#201e1d] break-words overflow-x-auto min-h-[44px]">
          <ReactMarkdown
            remarkPlugins={[remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {sanitizeStem(question.stem_markdown)}
          </ReactMarkdown>
        </div>

        {/* Diagram Inspection Frame with Technical Crosshair Accents */}
        {diagramUrl && (
          <div className="relative my-2 rounded-xl border-[1.5px] border-[#201e1d]/20 bg-[#faf6f0] p-3 shadow-inner flex flex-col items-center group overflow-hidden">
            {/* Technical Crosshairs */}
            <span className="absolute top-1.5 left-2 text-[#201e1d]/30 text-[10px] font-mono select-none pointer-events-none">+</span>
            <span className="absolute top-1.5 right-2 text-[#201e1d]/30 text-[10px] font-mono select-none pointer-events-none">+</span>
            <span className="absolute bottom-1.5 left-2 text-[#201e1d]/30 text-[10px] font-mono select-none pointer-events-none">+</span>
            <span className="absolute bottom-1.5 right-2 text-[#201e1d]/30 text-[10px] font-mono select-none pointer-events-none">+</span>

            {imageError ? (
              <div className="flex flex-col items-center justify-center py-6 px-4 text-center gap-2">
                <span className="text-2xl" role="img" aria-label="Warning">
                  ⚠️
                </span>
                <span className="px-3 py-1 rounded-md bg-amber-50 border border-amber-300 text-xs font-mono font-bold text-amber-900">
                  DIAGRAM PREVIEW UNAVAILABLE
                </span>
                <span className="text-xs text-text/70 italic max-w-xs font-mono">
                  {altDescription}
                </span>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(true)}
                  className="w-full flex justify-center focus:outline-none cursor-zoom-in bg-transparent border-0 p-0"
                  aria-label="Enlarge diagram"
                >
                  <img
                    src={diagramUrl}
                    alt={altDescription}
                    onError={() => setImageError(true)}
                    className="max-h-[280px] sm:max-h-[340px] w-auto max-w-full object-contain cursor-zoom-in rounded-lg transition-transform duration-150 hover:scale-[1.01]"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setIsZoomOpen(true)}
                  className="mt-2.5 px-3 py-1 rounded-md border border-[#201e1d]/20 bg-white hover:bg-[#f5ead8] font-mono text-[11px] font-bold text-[#201e1d] flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  <span>INSPECT HIGH-RES DIAGRAM</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Retry Alert on First Wrong Attempt */}
      {isRetry && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className="flex items-center gap-2.5 p-3 px-3.5 rounded-xl bg-amber-50 border-[1.5px] border-amber-400 text-amber-950 shadow-xs"
        >
          <div className="w-7 h-7 rounded-md bg-amber-400/30 flex items-center justify-center font-mono font-bold text-xs flex-shrink-0">
            ↺
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-mono font-bold text-xs tracking-wider uppercase text-amber-900">
              1 Retry Remaining · 50% XP
            </span>
            <span className="text-xs text-amber-800 font-medium mt-0.5">
              Streak multiplier paused. Select your secondary hypothesis.
            </span>
          </div>
        </motion.div>
      )}

      {/* Option Cards */}
      <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Answer options">
        {question.options.map((opt, i) => {
          const isCorrect = opt.id === question.correct_option_id;
          const isPicked = selectedOptionId === opt.id;
          const isFirstWrongPick = firstWrongOptionId === opt.id;

          const showCheck = isResolved && isCorrect;
          const showX = (isRetry && isFirstWrongPick) || (isResolved && isPicked && !isCorrect);
          const isDisabled = isResolved || (isRetry && isFirstWrongPick);

          let cardStyle =
            'border-[1.5px] border-[#201e1d]/20 bg-white/90 shadow-sm hover:border-[#c67139] hover:bg-[#fff7f2] text-[#201e1d]';
          let capsuleStyle = 'bg-[#f5ead8]/80 text-[#201e1d] border border-[#201e1d]/20';

          if (showCheck) {
            cardStyle = 'border-emerald-600 bg-emerald-50/95 text-emerald-950 shadow-sm ring-1 ring-emerald-500/30';
            capsuleStyle = 'bg-emerald-600 text-white border-emerald-700';
          } else if (showX) {
            cardStyle = 'border-rose-300 bg-rose-50/90 text-rose-950 line-through/strike-through opacity-85';
            capsuleStyle = 'bg-rose-500 text-white border-rose-600';
          } else if (isResolved) {
            cardStyle = 'border-[#201e1d]/10 bg-white/60 text-[#201e1d]/60 opacity-60';
            capsuleStyle = 'bg-neutral-100 text-neutral-400 border-neutral-300';
          } else if (isRetry && isFirstWrongPick) {
            cardStyle = 'border-neutral-300 bg-neutral-100 text-neutral-400 opacity-50 line-through';
            capsuleStyle = 'bg-neutral-200 text-neutral-500 border-neutral-300';
          }

          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selectedOptionId === opt.id}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              onClick={() => onAnswer(opt.id)}
              className={cn(
                'group flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl text-left transition-all',
                cardStyle,
                !isDisabled
                  ? 'cursor-pointer active:scale-[0.99]'
                  : 'cursor-default'
              )}
            >
              {/* Monospace capsule [ A ] */}
              <span
                className={cn(
                  'w-9 h-9 flex-none rounded-lg flex items-center justify-center font-mono font-bold text-xs tracking-wider transition-colors',
                  capsuleStyle
                )}
              >
                [ {letters[i]} ]
              </span>

              {/* Option Text with LaTeX support */}
              <span className={cn(
                'flex-1 text-[15px] font-medium leading-snug break-words min-w-0',
                showX && 'line-through text-rose-900/80'
              )}>
                <ReactMarkdown
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                >
                  {sanitizeStem(opt.text_markdown)}
                </ReactMarkdown>
              </span>

              {/* Telemetry Status Indicator */}
              {showCheck ? (
                <div className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-mono font-bold text-xs shadow-xs flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : showX ? (
                <div className="w-6 h-6 rounded-md bg-rose-500 text-white flex items-center justify-center font-mono font-bold text-xs shadow-xs flex-shrink-0">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
              ) : !isResolved ? (
                <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded font-mono text-[10px] font-bold text-neutral-400 border border-neutral-200">
                  KEY {i + 1}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Explanation Panel on Answer / Timeout */}
      {isResolved && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="flex flex-col gap-3 p-4 sm:p-5 rounded-2xl bg-white/95 border-[1.5px] border-[#201e1d]/20 shadow-sm"
        >
          {/* Telemetry Debrief Header */}
          <div className="flex items-center gap-3 pb-3 border-b border-[#201e1d]/10">
            <span className="text-2xl leading-none">{fbEmoji}</span>
            <div className="flex flex-col leading-tight flex-1 min-w-0">
              <span className="font-heading font-bold text-lg text-text truncate">
                {fbTitle}
              </span>
              <span className="text-xs text-neutral-600 font-mono mt-0.5">
                {fbSub}
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-[#201e1d] font-mono font-bold text-xs text-[#f9f4ed] shadow-xs">
              +{gainedXP} XP
            </span>
          </div>

          {/* Step by Step Breakdown Card with Numbered Telemetry Chips */}
          <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-[#faf6f0] border border-[#201e1d]/15">
            <div className="flex items-center justify-between">
              <h6 className="font-mono font-bold text-[11px] tracking-wider uppercase text-neutral-700 m-0">
                METHODOLOGY &amp; DEDUCTION
              </h6>
              <span className="font-mono text-[10px] text-neutral-500 font-bold">
                CAMBRIDGE CRITERIA
              </span>
            </div>
            {explanationSteps.map((step, idx) => (
              <div key={idx} className="flex gap-2.5 items-start">
                <span className="w-5 h-5 flex-none rounded bg-[#201e1d] font-mono text-[10px] font-bold text-[#f9f4ed] flex items-center justify-center mt-0.5">
                  0{idx + 1}
                </span>
                <span className="text-[13px] leading-relaxed text-[#201e1d] font-medium">
                  {step}
                </span>
              </div>
            ))}
          </div>

          {/* Distractor Breakdown */}
          {distractorBreakdown.length > 0 && (
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-white border border-[#201e1d]/15">
              <div className="flex items-center justify-between">
                <h6 className="font-mono font-bold text-[11px] tracking-wider uppercase text-neutral-700 m-0">
                  DISTRACTOR ELIMINATION
                </h6>
                <span className="font-mono text-[10px] text-rose-600 font-bold">
                  COMMON PITFALLS
                </span>
              </div>
              {distractorBreakdown.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="px-1.5 py-0.5 rounded bg-rose-50 border border-rose-300 font-mono text-[10px] font-bold text-rose-800 flex-shrink-0 mt-0.5">
                    [{item.letter}]
                  </span>
                  <span className="text-[12px] leading-relaxed text-neutral-700">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Decoupled Action Rail: Primary Next Question CTA */}
      {isResolved && (
        <div className="pt-1">
          <button
            type="button"
            onClick={onNext}
            className="w-full py-4 px-6 rounded-2xl bg-[#201e1d] hover:bg-[#34302d] text-[#f9f4ed] border-2 border-[#201e1d] shadow-[0_4px_0_0_#201e1d] font-heading font-bold text-base sm:text-lg tracking-wider cursor-pointer transition-all active:translate-y-1 active:shadow-none select-none text-center flex items-center justify-center gap-2"
          >
            <span>
              {questionNumber >= totalQuestions && !isEndless
                ? 'COMPLETE ROUND · VIEW PERFORMANCE'
                : 'CONTINUE TO NEXT ITEM'}
            </span>
            <span className="font-mono text-sm">→</span>
          </button>
        </div>
      )}

      {/* Endless round end button */}
      {isEndless && (
        <button
          type="button"
          onClick={onFinish}
          className="self-center bg-transparent border-0 font-mono font-bold text-xs uppercase tracking-wider cursor-pointer text-neutral-600 hover:text-text transition-colors mt-2"
        >
          [ End Endless Session ]
        </button>
      )}

      {/* Diagram Zoom Lightbox Modal */}
      {isZoomOpen && diagramUrl && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
              onClick={() => setIsZoomOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Diagram Inspector"
            >
              <div
                className="max-w-4xl max-h-[90vh] w-full bg-[#f9f4ed] rounded-3xl border-2 border-[#201e1d] shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b border-[#201e1d]/20 bg-white">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono font-bold text-xs uppercase tracking-wider text-text">
                      {status === 'unanswered'
                        ? 'High-Resolution Diagram Telemetry'
                        : `Cambridge Telemetry · ${question.citation || 'Question Graphic'}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsZoomOpen(false)}
                    className="w-8 h-8 rounded-lg border border-[#201e1d]/20 bg-[#201e1d] text-[#f9f4ed] flex items-center justify-center font-mono font-bold text-xs hover:bg-[#34302d] cursor-pointer"
                    aria-label="Close modal"
                  >
                    ESC
                  </button>
                </div>

                {/* Modal Full-Resolution Image View */}
                <div className="flex-1 overflow-auto p-4 sm:p-8 bg-[#faf6f0] flex items-center justify-center min-h-[300px]">
                  <img
                    src={diagramUrl}
                    alt={altDescription}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export default QuestionCard;

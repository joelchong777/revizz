'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import { safeRehypePlugins } from '@/lib/markdownSanitize';
import 'katex/dist/katex.min.css';
import { Question, resolveDiagramUrl } from '@/lib/questions';
import { formatTableOptionText } from '../lib/compilerFilters';
import { cn } from '@/lib/utils';
import { sanitizeKaTeX } from '@/lib/ingestion/katexSanitizer';
import { MarkdownErrorBoundary } from '@/components/ui/MarkdownErrorBoundary';
import { cambridgeTableComponents } from '@/components/ui/RichMarkdown';
import { AdSlotBanner } from '@/components/ads/AdSlotBanner';
import { isQuestionBookmarked, toggleQuestionBookmark } from '@/lib/studentProfile';

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
  isChecking?: boolean;
  pendingOptionId?: string | null;
}

// Memoised so the 1s timer tick and status changes don't re-run ReactMarkdown/KaTeX.
const MemoMarkdown = React.memo(function MemoMarkdown({
  text,
  withTableComponents = false,
}: {
  text: string;
  withTableComponents?: boolean;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath, remarkGfm]}
      rehypePlugins={safeRehypePlugins}
      components={withTableComponents ? cambridgeTableComponents : undefined}
    >
      {text}
    </ReactMarkdown>
  );
});

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
  isChecking = false,
  pendingOptionId = null,
}: QuestionCardProps) {
  const shouldReduceMotion = useReducedMotion();
  const sanitizedStem = useMemo(() => sanitizeKaTeX(question.stem_markdown || ''), [question.stem_markdown]);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const lowTimeAnnouncedRef = useRef(false);
  const isCheckingRef = useRef(isChecking);
  isCheckingRef.current = isChecking;
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    setIsBookmarked(isQuestionBookmarked(question.id));
  }, [question.id]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const rawDiagramUrl = question.image_url || question.diagram?.image_url;
  const resolvedUrl = resolveDiagramUrl(rawDiagramUrl);
  const diagramUrl = question.has_diagram === false ? undefined : resolvedUrl;
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;

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
            if (isCheckingRef.current) return;
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
  // The correct answer is only known after the server reveals it.
  const isRevealed = correctOptionIndex >= 0;
  const correctLetter = isRevealed ? letters[correctOptionIndex] : '';
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
      gainedXP = selectedOptionId === question.correct_option_id ? 5 : 0;
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
    isRevealed &&
    selectedOptionId === question.correct_option_id;
  const isRetryCorrect =
    status === 'answered' &&
    firstWrongOptionId &&
    isRevealed &&
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
    ? `Option ${correctLetter} · first try · ${streakMultiplier.toFixed(1)}× streak bonus`
    : isRetryCorrect
    ? `Option ${correctLetter} · half XP · added to your Review Pile`
    : isRevealed
    ? `Answer ${correctLetter} · queued to your Review Pile`
    : 'Queued to your Review Pile';
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
  const distractorBreakdown = !isRevealed ? [] : question.options
    .filter((opt) => opt.id !== question.correct_option_id)
    .map((opt) => {
      const idx = question.options.findIndex((o) => o.id === opt.id);
      return {
        letter: letters[idx],
        text: `"${opt.text_markdown.replace(/[*#$]/g, '')}" represents a common distractor or addresses an unrelated syllabus mechanism.`,
      };
    });

  return (
    <div className="w-full max-w-[480px] mx-auto py-4 px-4 pb-12 flex flex-col gap-5 select-none">
      {/* Screen reader live region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {liveAnnouncement}
      </div>

      {/* Top Bar: Circular Quit Button + Progress Bar + Question Counter */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onFinish}
          data-no-hotkey="true"
          title="Quit round"
          className="w-9 h-9 flex-none rounded-full bg-neutral-100 border-2 border-text shadow-offset-2 flex items-center justify-center cursor-pointer transition-all duration-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-text"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>

        <div className="flex-1 h-3 rounded-full bg-neutral-100 border-2 border-text overflow-hidden">
          <div
            className="h-full bg-accent-2-500 transition-all duration-300 ease-out"
            style={{ width: progressPct }}
          />
        </div>

        <span className="font-bold text-sm text-text tabular-nums whitespace-nowrap">
          {isEndless
            ? `Q${questionNumber} · ∞`
            : `${questionNumber} / ${totalQuestions}`}
        </span>

        <button
          type="button"
          onClick={() => {
            const next = toggleQuestionBookmark(question.id, {
              subject,
              topicId: question.topic_id,
            });
            setIsBookmarked(next);
          }}
          data-testid="bookmark-question-btn"
          data-no-hotkey="true"
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
          className={cn(
            'w-9 h-9 flex-none rounded-full border-2 border-text shadow-offset-2 flex items-center justify-center cursor-pointer transition-all duration-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none text-text text-sm sm:text-base',
            isBookmarked ? 'bg-accent-300' : 'bg-neutral-100'
          )}
        >
          {isBookmarked ? '⭐' : '☆'}
        </button>
      </div>

      {/* Second Row: Timer Pill + Streak Multiplier Chip */}
      <div className="flex items-center gap-2 flex-wrap">
        {isTimed ? (
          <div
            className={cn(
              'px-3 py-1 rounded-full border-2 border-text shadow-offset-2 flex items-center gap-2 font-bold text-xs tabular-nums text-text',
              urgent ? 'bg-accent-200 animate-pulse' : 'bg-neutral-100'
            )}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text flex-shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{timeLabel}</span>
            <span className="w-12 h-1.5 rounded-full bg-neutral-100 border border-text overflow-hidden block ml-0.5">
              <span
                className={cn('block h-full transition-all duration-1000 ease-linear', urgent ? 'bg-accent-600' : 'bg-accent-2-500')}
                style={{ width: timePct }}
              />
            </span>
          </div>
        ) : (
          <span className="px-3 py-1 rounded-full bg-accent-2-200 border-2 border-text font-bold text-xs text-text shadow-offset-2">
            Chill · untimed
          </span>
        )}

        <span
          className={cn(
            'ml-auto px-3 py-1 rounded-full border-2 border-text shadow-offset-2 font-bold text-xs text-text whitespace-nowrap',
            streakBg
          )}
        >
          🔥 {currentStreak} · {streakMultiplier.toFixed(1)}× · +{potentialGain} XP
        </span>
      </div>

      {/* Third Row: Question Card */}
      <div className="rounded-3xl bg-white border-2 border-text p-4 sm:p-5 shadow-offset-4 flex flex-col gap-3">
        {/* Meta: source caption + subject/topic tags (zero layout shift) */}
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-600 leading-snug">
            {question.citation || 'Cambridge IGCSE'}
          </span>
          <div className="flex flex-wrap gap-2">
            {subject && (
              <span className="px-2.5 py-0.5 rounded-full bg-accent-300 text-text border-2 border-text text-[11px] font-bold">
                {subject}
              </span>
            )}
            <span className="px-2.5 py-0.5 rounded-full bg-accent-2-200 text-accent-2-900 border-2 border-text text-[11px] font-bold">
              {question.topic || question.topic_id?.replace('topic_', 'Topic ') || 'Syllabus Topic'}
            </span>
          </div>
        </div>

        <div className="text-[17px] leading-relaxed font-semibold text-text break-words overflow-hidden min-h-[48px]">
          <MarkdownErrorBoundary fallbackText={question.stem_markdown}>
            <MemoMarkdown text={sanitizedStem} withTableComponents />
          </MarkdownErrorBoundary>
        </div>

        {/* Diagram asset */}
        {diagramUrl && (
          <div className="relative my-2 rounded-2xl border-2 border-text bg-white p-3 flex flex-col items-center group">
            {imageError ? (
              <div className="flex flex-col items-center justify-center py-6 px-4 text-center gap-2">
                <span className="text-2xl" role="img" aria-label="Warning">
                  ⚠️
                </span>
                <span className="px-3 py-1 rounded-full bg-accent-200 border-2 border-text text-xs font-bold text-text">
                  Diagram preview unavailable
                </span>
                <span className="text-xs text-text/70 italic max-w-xs">
                  {altDescription}
                </span>
              </div>
            ) : (
              <div className="w-full flex flex-col items-center">
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
                    className="max-h-[280px] sm:max-h-[340px] w-auto max-w-full object-contain cursor-zoom-in rounded-xl transition-transform duration-150 group-hover:scale-[1.01]"
                  />
                </button>
                <div className="w-full flex items-center justify-between pt-2 px-1">
                  <span className="text-[11px] font-bold text-text/60 select-none hidden sm:inline">
                    Click diagram to enlarge
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="text-[11px] font-bold text-text/60 select-none flex items-center gap-1">
                      <span className="text-accent">📐</span> Fit to screen
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsZoomOpen(true)}
                      className="px-3 py-1 rounded-full bg-neutral-100 hover:bg-neutral-200 border-2 border-text shadow-offset-2 text-xs font-bold text-text flex items-center gap-1 transition-all cursor-pointer active:translate-x-[2px] active:translate-y-[2px] active:shadow-none select-none"
                      aria-label="Enlarge diagram"
                    >
                      <span>🔍</span> Zoom
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fifth Row: Options List (Tactile Rounded-2xl Cards) */}
      <div className="flex flex-col gap-3" role="radiogroup" aria-label="Answer options" aria-busy={isChecking}>
        {question.options.map((opt, i) => {
          const isCorrect = isRevealed && opt.id === question.correct_option_id;
          const isPicked = selectedOptionId === opt.id;
          const isFirstWrongPick = firstWrongOptionId === opt.id;
          const isCorrectPick = isResolved && isCorrect && isPicked;

          const showCheck = isResolved && isCorrect;
          const showX = (isRetry && isFirstWrongPick) || (isResolved && isPicked && !isCorrect);
          const isDisabled = isChecking || isResolved || (isRetry && isFirstWrongPick);

          let cardStyles = 'bg-neutral-100 shadow-offset-3 hover:bg-neutral-50 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer';
          let chipBg = 'bg-white text-text';

          const isPending = isChecking && pendingOptionId === opt.id && !isResolved;

          if (isPending) {
            cardStyles = 'bg-neutral-200 shadow-none translate-x-[2px] translate-y-[2px] cursor-wait';
          } else if (showCheck) {
            if (isCorrectPick) {
              cardStyles = 'bg-accent-2-300 ring-4 ring-accent-2-500/40 shadow-none translate-x-[2px] translate-y-[2px] font-black text-text cursor-default';
            } else {
              cardStyles = 'bg-accent-2-300 shadow-none translate-x-[2px] translate-y-[2px] font-black text-text cursor-default';
            }
            chipBg = 'bg-accent-2-600 text-neutral-100';
          } else if (showX) {
            cardStyles = 'bg-accent-200 shadow-none border-dashed opacity-70 cursor-default';
            chipBg = 'bg-accent-600 text-neutral-100';
          } else if (isRetry && isFirstWrongPick) {
            cardStyles = 'bg-accent-200 shadow-none border-dashed opacity-80 cursor-not-allowed';
            chipBg = 'bg-accent-600 text-neutral-100';
          } else if (isResolved) {
            cardStyles = 'bg-neutral-100 shadow-none border-dashed opacity-50 cursor-default';
            chipBg = 'bg-neutral-200 text-text/70';
          }

          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-label={`Option ${letters[i]}: ${opt.text_markdown.replace(/\$+/g, '').replace(/[*_`#>|~\\]/g, '').replace(/\s+/g, ' ').trim()}`}
              aria-checked={selectedOptionId === opt.id}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              onClick={() => onAnswer(opt.id)}
              className={cn(
                'w-full rounded-2xl border-2 border-text p-4 text-left font-bold flex items-start gap-3 transition-all',
                cardStyles
              )}
            >
              {/* Letter Chip */}
              <span
                className={cn(
                  'w-8 h-8 rounded-xl border-2 border-text flex-none flex items-center justify-center font-heading text-base transition-colors',
                  chipBg
                )}
              >
                {letters[i]}
              </span>

              {/* Option Text Markdown */}
              <span className="flex-1 text-sm sm:text-base font-semibold text-text break-words min-w-0 pt-0.5 leading-snug">
                <MarkdownErrorBoundary fallbackText={opt.text_markdown}>
                  <MemoMarkdown text={sanitizeKaTeX(formatTableOptionText(opt.text_markdown))} />
                </MarkdownErrorBoundary>
              </span>

              {/* Status Stamp / Hotkey Tag */}
              <div className="flex-none flex items-center gap-2 pt-0.5">
                {showCheck ? (
                  <motion.div
                    initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                    className="flex items-center gap-2"
                  >
                    {isCorrectPick ? (
                      <span
                        data-testid="correct-option-pill"
                        className="px-2.5 py-0.5 rounded-full bg-accent-2-600 text-neutral-100 border-2 border-text font-heading text-[11px] sm:text-xs tracking-wide uppercase shadow-offset-2 whitespace-nowrap"
                      >
                        ✓ Correct · +{gainedXP} XP
                      </span>
                    ) : (
                      <span
                        className="px-2 py-0.5 rounded-full bg-neutral-100 text-text border-2 border-text font-heading text-[11px] uppercase whitespace-nowrap"
                      >
                        Correct Answer
                      </span>
                    )}
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="#728157"
                      stroke="#f9f4ed"
                      strokeWidth="2.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" stroke="#201e1d" strokeWidth="2" />
                      <path d="m8 12 3 3 5-6" />
                    </svg>
                  </motion.div>
                ) : showX ? (
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="#b2622d"
                    stroke="#f9f4ed"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                  >
                    <circle cx="12" cy="12" r="10" stroke="#201e1d" strokeWidth="2" />
                    <path d="m15 9-6 6" />
                    <path d="m9 9 6 6" />
                  </svg>
                ) : isPending ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-text/70" data-testid="checking-indicator">
                    <span aria-hidden="true" className="w-4 h-4 rounded-full border-2 border-text border-t-transparent animate-spin motion-reduce:animate-none" />
                    <span className="hidden sm:inline">Checking…</span>
                  </span>
                ) : !isResolved ? (
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded-lg border-[1.5px] border-neutral-400 text-neutral-600 text-xs font-bold font-mono">
                    {i + 1}
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {/* Feedback below the options so they never jump */}
      {isRetry && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          className="flex items-center gap-3 p-4 rounded-2xl bg-accent-300 border-2 border-text shadow-offset-4"
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
            className="text-text flex-shrink-0"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <div className="flex flex-col gap-1 leading-tight">
            <span className="font-heading text-base text-text">
              1 retry left · 50% XP
            </span>
            <span className="text-xs font-semibold text-text">
              Streak reset. Pick another option or skip to next question.
            </span>
          </div>
        </motion.div>
      )}

      {/* Feedback Panel on Answer / Timeout */}
      {isResolved && (
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className={cn(
            'flex flex-col gap-3 p-4 sm:p-5 rounded-3xl border-2 border-text shadow-offset-4',
            fbBg
          )}
        >
          {/* Feedback Header */}
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">{fbEmoji}</span>
            <div className="flex flex-col leading-[1.15] flex-1 min-w-0">
              <span className="font-heading text-xl text-text leading-tight">
                {fbTitle}
              </span>
              <span className="text-[13px] font-semibold text-text">
                {fbSub}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isFirstTryCorrect && currentStreak > 0 && (
                <span className="px-3 py-1 rounded-full bg-accent-300 border-2 border-text font-bold text-sm text-text whitespace-nowrap shadow-offset-2">
                  🔥 {currentStreak}
                </span>
              )}
              <span
                data-testid={isFirstTryCorrect ? 'correct-answer-banner' : isRetryCorrect ? 'retry-correct-banner' : undefined}
                className="px-3 py-1 rounded-full bg-neutral-100 border-2 border-text font-bold text-sm text-text whitespace-nowrap shadow-offset-2"
              >
                +{gainedXP} XP
              </span>
            </div>
          </div>

          {/* Step by Step Explanation: Why Option X is Correct */}
          {isRevealed && (
          <div className="p-4 rounded-2xl bg-accent-2-100 border-2 border-text flex flex-col gap-2">
            <h6 className="font-bold text-xs uppercase tracking-wider text-accent-2-900 m-0">
              Why Option {correctLetter} is Correct
            </h6>
            {explanationSteps.map((step, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <span className="w-5 h-5 flex-none rounded-full bg-accent-2-300 border-[1.5px] border-text flex items-center justify-center text-xs font-bold text-text">
                  {idx + 1}
                </span>
                <span className="text-xs sm:text-sm leading-relaxed text-text">
                  {step}
                </span>
              </div>
            ))}
          </div>
          )}

          {/* Distractor Breakdown: Distractor Traps */}
          {distractorBreakdown.length > 0 && (
            <div className="p-4 rounded-2xl bg-accent-100 border-2 border-text flex flex-col gap-2">
              <h6 className="font-bold text-xs uppercase tracking-wider text-accent-900 m-0">
                Distractor Traps
              </h6>
              {distractorBreakdown.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="w-5 h-5 flex-none rounded-full bg-accent-200 border-[1.5px] border-text flex items-center justify-center text-xs font-heading text-text">
                    {item.letter}
                  </span>
                  <span className="text-xs sm:text-sm leading-relaxed text-text">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Single Next CTA: sticky so it is reachable without scrolling */}
      {(isRetry || isResolved) && (
        <div className="sticky bottom-4 z-10 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            data-testid={isRetry ? 'retry-next-button' : undefined}
            onClick={onNext}
            className="group w-full py-3 px-5 rounded-2xl bg-accent hover:bg-accent-600 text-neutral-100 border-2 border-text shadow-offset-4 font-heading text-lg sm:text-xl cursor-pointer transition-all duration-100 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none select-none text-center flex items-center justify-center gap-2"
          >
            <span>{questionNumber >= totalQuestions && !isEndless ? 'See results' : 'Next question'}</span>
            <span className="text-2xl font-black leading-none transition-transform group-hover:translate-x-1">→</span>
          </button>
        </div>
      )}

      {/* Endless round end button */}
      {isEndless && (
        <button
          type="button"
          onClick={onFinish}
          className="self-center bg-transparent border-0 font-bold text-sm underline underline-offset-4 cursor-pointer text-accent-700 hover:text-accent-800 transition-colors mt-2"
        >
          End endless round
        </button>
      )}

      <AdSlotBanner
        slotId="question_card_footer"
        subjectCode={subject}
        isTimedMode={isTimed}
        questionIndex={questionNumber - 1}
        className="mt-0"
      />

      {/* Diagram Zoom Lightbox Modal */}
      {isZoomOpen && diagramUrl && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setIsZoomOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Diagram Inspector"
            >
              <div
                className="max-w-4xl max-h-[90vh] w-full bg-white rounded-3xl border-4 border-text shadow-offset-6 flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b-4 border-text bg-[#f9f4ed]">
                  <span className="font-heading font-bold text-base sm:text-lg text-text truncate pr-2">
                    {status === 'unanswered'
                      ? 'Diagram Inspector'
                      : `Diagram Inspector · ${question.citation || 'Cambridge Question'}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsZoomOpen(false)}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-text bg-accent text-neutral-100 flex items-center justify-center font-bold text-base hover:bg-accent-600 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex-shrink-0 cursor-pointer shadow-offset-2"
                    aria-label="Close modal"
                  >
                    ✕
                  </button>
                </div>

                {/* Modal Full-Resolution Image View */}
                <div className="flex-1 overflow-auto p-4 sm:p-6 bg-neutral-200 flex items-center justify-center min-h-[250px]">
                  <img
                    src={diagramUrl}
                    alt={altDescription}
                    className="max-w-full max-h-full object-contain rounded-lg"
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

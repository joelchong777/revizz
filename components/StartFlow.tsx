'use client';

import React, { useState, useEffect } from 'react';
import { QuizRoundConfig } from '../hooks/useQuizGame';
import { getReviewPileCount, subscribeMasteryChanges, getFirstTryCorrectIds } from '@/lib/mastery';
import { playPop } from '@/lib/audio';
import { TopicMasteryList } from './TopicMasteryList';
import { CAMBRIDGE_TOPICS, CAMBRIDGE_QUESTIONS } from '@/lib/questions';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

interface StartFlowProps {
  onStart: (config: QuizRoundConfig) => void;
  onStartReview: () => void;
  onPracticeTopic: (topicId: string, topicName: string) => void;
}

interface SubjectItem {
  key: string;
  name: string;
  code: string;
  emoji: string;
}

const SUBJECTS: SubjectItem[] = [
  { key: 'phy', name: 'Physics', code: '0625', emoji: '⚛️' },
  { key: 'econ', name: 'Economics', code: '0455', emoji: '📊' },
  { key: 'chem', name: 'Chemistry', code: '0620', emoji: '🧪' },
  { key: 'bio', name: 'Biology', code: '0610', emoji: '🧬' },
];

export function StartFlow({ onStart, onStartReview, onPracticeTopic }: StartFlowProps) {
  const { userProfile } = useAuth();
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>('econ');
  const [selectedMode, setSelectedMode] = useState<'standard' | 'topic' | 'review'>('standard');
  const [roundLength, setRoundLength] = useState<3 | 5 | 10 | 'endless'>(5);
  const [isTimed, setIsTimed] = useState<boolean>(true);
  const [reviewCount, setReviewCount] = useState<number>(0);
  const [isMasteryOpen, setIsMasteryOpen] = useState<boolean>(false);
  const [tierCounts, setTierCounts] = useState({ master: 0, proficient: 0, novice: 0 });

  useEffect(() => {
    const updateStats = () => {
      setReviewCount(getReviewPileCount());
      const masteredSet = new Set(getFirstTryCorrectIds());
      let master = 0;
      let proficient = 0;
      let novice = 0;

      CAMBRIDGE_TOPICS.forEach((topic) => {
        const qCount = CAMBRIDGE_QUESTIONS.filter((q) => q.topic_id === topic.id).length;
        const mCount = CAMBRIDGE_QUESTIONS.filter(
          (q) => q.topic_id === topic.id && masteredSet.has(q.id)
        ).length;
        const pct = qCount > 0 ? Math.round((mCount / qCount) * 100) : 0;
        if (pct > 80) master++;
        else if (pct >= 50) proficient++;
        else novice++;
      });

      setTierCounts({ master, proficient, novice });
    };

    updateStats();
    const unsubscribe = subscribeMasteryChanges(updateStats);

    const saved = localStorage.getItem('revizz_last_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.roundLength) setRoundLength(parsed.roundLength);
        if (typeof parsed.isTimed === 'boolean') setIsTimed(parsed.isTimed);
        if (parsed.sourceType === 'review') setSelectedMode('review');
        else if (parsed.sourceType === 'topic') setSelectedMode('topic');
        else setSelectedMode('standard');
      } catch {
        // ignore
      }
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const currentSubject = SUBJECTS.find((s) => s.key === selectedSubjectKey) || SUBJECTS[1];
  const firstName = userProfile?.display_name ? userProfile.display_name.split(' ')[0] : 'Alex';

  const handleStart = () => {
    playPop();

    if (selectedMode === 'review') {
      onStartReview();
      return;
    }

    const fullSubjectName = `${currentSubject.name} ${currentSubject.code}`;
    const roundConfig: QuizRoundConfig = {
      subject: fullSubjectName,
      sourceType: selectedMode === 'topic' ? 'topic' : 'random',
      sourceValue: selectedMode === 'topic' ? 'all' : 'random',
      roundLength,
      isTimed,
    };

    localStorage.setItem('revizz_last_config', JSON.stringify(roundConfig));
    onStart(roundConfig);
  };

  const handleSubjectSelect = (key: string) => {
    playPop();
    setSelectedSubjectKey(key);
  };

  const handleModeSelect = (mode: 'standard' | 'topic' | 'review') => {
    playPop();
    setSelectedMode(mode);
  };

  const handleLengthSelect = (len: 3 | 5 | 10 | 'endless') => {
    playPop();
    setRoundLength(len);
  };

  const handleTimerSelect = (timed: boolean) => {
    playPop();
    setIsTimed(timed);
  };

  return (
    <div className="w-full max-w-[480px] mx-auto py-5 px-4 pb-12 flex flex-col gap-5 select-none">
      {/* Title Header */}
      <div>
        <h1 className="font-heading text-4xl text-text leading-tight mb-1">
          Ready, {firstName}?
        </h1>
        <p className="text-[15px] text-neutral-700 font-semibold m-0">
          Pick a subject, set the rules, go.
        </p>
      </div>

      {/* 1. Subject Selection */}
      <div className="flex flex-col gap-2.5">
        <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
          Subject
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {SUBJECTS.map((s) => {
            const isSelected = selectedSubjectKey === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => handleSubjectSelect(s.key)}
                className={cn(
                  'flex items-center gap-2.5 p-3 sm:px-3.5 rounded-[20px] border-2 border-text text-left cursor-pointer transition-all',
                  isSelected
                    ? 'bg-accent-2-300 shadow-none translate-x-[3px] translate-y-[3px]'
                    : 'bg-neutral-100 shadow-offset-3 hover:bg-neutral-200/50 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
                )}
              >
                <span className="text-[22px] leading-none">{s.emoji}</span>
                <span className="flex flex-col leading-[1.15] min-w-0">
                  <span className="font-heading text-base text-text truncate">{s.name}</span>
                  <span className="text-xs font-bold opacity-75 text-text">{s.code}</span>
                </span>
              </button>
            );
          })}
        </div>
        {selectedSubjectKey !== 'econ' && (
          <p className="text-xs text-neutral-700 font-semibold m-0">
            Preview bank: rounds use Cambridge Economics 0455 questions for every subject.
          </p>
        )}
      </div>

      {/* 2. Mode Selection */}
      <div className="flex flex-col gap-2.5">
        <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
          Mode
        </h2>
        <div className="flex flex-col gap-2.5">
          {/* Mode 1: Standard Exam Round */}
          <button
            type="button"
            onClick={() => handleModeSelect('standard')}
            className={cn(
              'flex items-center gap-3 p-3 sm:px-3.5 rounded-[22px] border-2 border-text text-left cursor-pointer transition-all',
              selectedMode === 'standard'
                ? 'bg-accent-2-300 shadow-none translate-x-[3px] translate-y-[3px]'
                : 'bg-neutral-100 shadow-offset-3 hover:bg-neutral-200/50 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
            )}
          >
            <span className="w-[42px] h-[42px] flex-none rounded-full bg-neutral-100 border-2 border-text flex items-center justify-center text-xl">
              🎲
            </span>
            <span className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="font-heading text-[17px] text-text leading-tight">
                Standard exam round
              </span>
              <span className="text-[13px] text-neutral-800 font-medium leading-snug">
                Randomised pool across the syllabus
              </span>
            </span>
          </button>

          {/* Mode 2: Topic Practice */}
          <button
            type="button"
            onClick={() => handleModeSelect('topic')}
            className={cn(
              'flex items-center gap-3 p-3 sm:px-3.5 rounded-[22px] border-2 border-text text-left cursor-pointer transition-all',
              selectedMode === 'topic'
                ? 'bg-accent-2-300 shadow-none translate-x-[3px] translate-y-[3px]'
                : 'bg-neutral-100 shadow-offset-3 hover:bg-neutral-200/50 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
            )}
          >
            <span className="w-[42px] h-[42px] flex-none rounded-full bg-neutral-100 border-2 border-text flex items-center justify-center text-xl">
              📚
            </span>
            <span className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="font-heading text-[17px] text-text leading-tight">
                Topic practice
              </span>
              <span className="text-[13px] text-neutral-800 font-medium leading-snug">
                Drill chapter by chapter, in syllabus order
              </span>
            </span>
          </button>

          {/* Mode 3: Review Pile */}
          <button
            type="button"
            onClick={() => handleModeSelect('review')}
            className={cn(
              'flex items-center gap-3 p-3 sm:px-3.5 rounded-[22px] border-2 border-text text-left cursor-pointer transition-all',
              selectedMode === 'review'
                ? 'bg-accent-2-300 shadow-none translate-x-[3px] translate-y-[3px]'
                : 'bg-neutral-100 shadow-offset-3 hover:bg-neutral-200/50 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
            )}
          >
            <span className="w-[42px] h-[42px] flex-none rounded-full bg-neutral-100 border-2 border-text flex items-center justify-center text-xl">
              🧠
            </span>
            <span className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="font-heading text-[17px] text-text leading-tight">
                Review pile
              </span>
              <span className="text-[13px] text-neutral-800 font-medium leading-snug">
                Spaced repetition of questions you missed
              </span>
            </span>
            {reviewCount > 0 && (
              <span className="min-w-[28px] h-7 px-2 rounded-full bg-accent-600 text-neutral-100 border-2 border-text flex items-center justify-center font-bold text-[13px]">
                {reviewCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3. Round Length */}
      <div className="flex flex-col gap-2.5">
        <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
          Round length
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { val: 3 as const, label: '3 Qs' },
            { val: 5 as const, label: '5 Qs' },
            { val: 10 as const, label: '10 Qs' },
            { val: 'endless' as const, label: 'Endless ∞' },
          ].map((item) => {
            const isSelected = roundLength === item.val;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleLengthSelect(item.val)}
                className={cn(
                  'px-4 py-2 rounded-full border-2 border-text font-bold text-sm cursor-pointer transition-all select-none',
                  isSelected
                    ? 'bg-text text-neutral-100 shadow-none translate-x-[2px] translate-y-[2px]'
                    : 'bg-neutral-100 text-text shadow-offset-3 hover:bg-neutral-200/50 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Timer Selection */}
      <div className="flex flex-col gap-2.5">
        <h2 className="font-bold text-xs uppercase tracking-wider text-neutral-700 m-0">
          Timer
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {/* Chill / Untimed */}
          <button
            type="button"
            onClick={() => handleTimerSelect(false)}
            className={cn(
              'flex flex-col items-start gap-0.5 px-4 py-2.5 rounded-[20px] border-2 border-text text-left cursor-pointer transition-all',
              !isTimed
                ? 'bg-accent-2-300 shadow-none translate-x-[3px] translate-y-[3px]'
                : 'bg-neutral-100 shadow-offset-3 hover:bg-neutral-200/50 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
            )}
          >
            <span className="font-heading text-base text-text">Chill</span>
            <span className="text-xs font-semibold opacity-85 text-text">Untimed</span>
          </button>

          {/* Exam / Timed */}
          <button
            type="button"
            onClick={() => handleTimerSelect(true)}
            className={cn(
              'flex flex-col items-start gap-0.5 px-4 py-2.5 rounded-[20px] border-2 border-text text-left cursor-pointer transition-all',
              isTimed
                ? 'bg-accent-300 shadow-none translate-x-[3px] translate-y-[3px]'
                : 'bg-neutral-100 shadow-offset-3 hover:bg-neutral-200/50 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none'
            )}
          >
            <span className="font-heading text-base text-text">Exam</span>
            <span className="text-xs font-semibold opacity-85 text-text">90 s per question</span>
          </button>
        </div>
      </div>

      {/* 5. Topic Mastery Card Trigger */}
      <button
        type="button"
        onClick={() => {
          playPop();
          setIsMasteryOpen(true);
        }}
        className="flex items-center gap-3 p-3.5 sm:p-4 rounded-[24px] bg-surface border-2 border-text shadow-offset-4 cursor-pointer text-left transition-all active:translate-x-1 active:translate-y-1 active:shadow-none hover:brightness-[0.98]"
      >
        <span className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="font-heading text-[17px] text-text leading-tight truncate">
            Topic mastery · {currentSubject.name}
          </span>
          <span className="flex gap-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-accent-2-300 border-[1.5px] border-text font-bold text-xs text-text">
              👑 {tierCounts.master} Master
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-accent-300 border-[1.5px] border-text font-bold text-xs text-text">
              ⚡ {tierCounts.proficient} Proficient
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-neutral-200 border-[1.5px] border-text font-bold text-xs text-text">
              🌱 {tierCounts.novice} Novice
            </span>
          </span>
        </span>
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
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </button>

      {/* 6. Hero CTA: START ROUND 🚀 */}
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-[18px] px-5 rounded-full bg-accent hover:bg-accent-600 text-neutral-100 border-2 border-text shadow-offset-6 font-heading text-2xl tracking-[0.03em] cursor-pointer transition-all active:translate-x-[6px] active:translate-y-[6px] active:shadow-none select-none flex items-center justify-center gap-2"
      >
        START ROUND 🚀
      </button>

      {/* Topic Mastery Drawer Modal */}
      {isMasteryOpen && (
        <div
          onClick={() => setIsMasteryOpen(false)}
          className="fixed inset-0 z-40 bg-neutral-900/50 backdrop-blur-xs flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] max-h-[86vh] overflow-y-auto p-5 sm:p-6 pb-8 rounded-t-[32px] bg-bg border-2 border-b-0 border-text flex flex-col gap-3.5 animate-in slide-in-from-bottom duration-300"
          >
            <div className="flex items-center gap-2.5">
              <h3 className="font-heading text-2xl text-text m-0 flex-1">
                Topic mastery
              </h3>
              <button
                type="button"
                onClick={() => setIsMasteryOpen(false)}
                className="w-9 h-9 rounded-full bg-neutral-100 border-2 border-text shadow-offset-2 flex items-center justify-center cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none text-text"
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
            </div>
            <p className="text-[13px] text-neutral-700 font-semibold m-0">
              {currentSubject.name} {currentSubject.code} · first-try accuracy per syllabus chapter. 🌱 under 50% · ⚡ 50–80% · 👑 over 80%
            </p>

            <TopicMasteryList
              subject={`${currentSubject.name} ${currentSubject.code}`}
              onPracticeTopic={(topicId, topicName) => {
                setIsMasteryOpen(false);
                onPracticeTopic(topicId, topicName);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default StartFlow;

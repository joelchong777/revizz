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
    <div className="w-full max-w-[500px] mx-auto py-5 px-4 pb-14 flex flex-col gap-5 select-none">
      {/* Telemetry Header */}
      <div className="flex flex-col gap-1 border-b border-[#201e1d]/15 pb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-mono text-xs font-bold tracking-widest uppercase text-neutral-600">
            SESSION INITIALIZER · CAMBRIDGE SUITE
          </span>
        </div>
        <h1 className="font-heading font-black text-3xl sm:text-4xl text-text leading-tight tracking-tight">
          Ready, {firstName}?
        </h1>
        <p className="text-xs sm:text-sm text-neutral-600 font-mono m-0">
          Select target syllabus specification and execution parameters.
        </p>
      </div>

      {/* 1. Subject Grid */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-bold tracking-wider uppercase text-neutral-700 m-0">
            TARGET SYLLABUS
          </h2>
          <span className="font-mono text-[10px] text-neutral-500 font-bold">
            2024–2026 SPEC
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {SUBJECTS.map((s) => {
            const isSelected = selectedSubjectKey === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => handleSubjectSelect(s.key)}
                className={cn(
                  'flex flex-col gap-2 p-3.5 rounded-2xl border-[1.5px] text-left cursor-pointer transition-all',
                  isSelected
                    ? 'border-[#201e1d] bg-white ring-2 ring-[#c67139]/40 shadow-sm'
                    : 'border-[#201e1d]/20 bg-white/70 hover:bg-white hover:border-[#201e1d]/40 shadow-xs'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl leading-none">{s.emoji}</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded font-mono text-[10px] font-bold tracking-wider',
                      s.key === 'econ'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-neutral-100 text-neutral-600 border border-neutral-300'
                    )}
                  >
                    {s.key === 'econ' ? 'LIVE BANK' : 'ACCELERATOR'}
                  </span>
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-heading font-bold text-base text-text">
                    {s.name}
                  </span>
                  <span className="font-mono text-xs font-bold text-neutral-500 mt-0.5">
                    SYLLABUS {s.code}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {selectedSubjectKey !== 'econ' && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 font-mono text-xs text-amber-900 leading-snug">
            ⚡ Cross-Discipline Engine: Evaluation questions active via Cambridge Economics 0455 core telemetry.
          </div>
        )}
      </div>

      {/* 2. Mode Selector */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-mono text-xs font-bold tracking-wider uppercase text-neutral-700 m-0">
            PRACTICE ENGINE MODE
          </h2>
          <span className="font-mono text-[10px] text-neutral-500 font-bold">
            ADAPTIVE
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {/* Mode 1: Standard Exam Round */}
          <button
            type="button"
            onClick={() => handleModeSelect('standard')}
            className={cn(
              'flex items-center gap-3.5 p-3.5 rounded-2xl border-[1.5px] text-left cursor-pointer transition-all',
              selectedMode === 'standard'
                ? 'border-[#201e1d] bg-white ring-2 ring-[#c67139]/40 shadow-sm'
                : 'border-[#201e1d]/20 bg-white/70 hover:bg-white hover:border-[#201e1d]/40 shadow-xs'
            )}
          >
            <div className="w-10 h-10 flex-none rounded-xl bg-[#201e1d] text-[#f9f4ed] flex items-center justify-center font-mono font-bold text-base shadow-xs">
              🎯
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="font-heading font-bold text-[16px] text-text">
                Standard Round
              </span>
              <span className="font-mono text-xs text-neutral-600">
                Randomized pool calibrated across the entire syllabus
              </span>
            </div>
          </button>

          {/* Mode 2: Topic Mastery Drill */}
          <button
            type="button"
            onClick={() => handleModeSelect('topic')}
            className={cn(
              'flex items-center gap-3.5 p-3.5 rounded-2xl border-[1.5px] text-left cursor-pointer transition-all',
              selectedMode === 'topic'
                ? 'border-[#201e1d] bg-white ring-2 ring-[#c67139]/40 shadow-sm'
                : 'border-[#201e1d]/20 bg-white/70 hover:bg-white hover:border-[#201e1d]/40 shadow-xs'
            )}
          >
            <div className="w-10 h-10 flex-none rounded-xl bg-[#7a8a5e] text-[#f9f4ed] flex items-center justify-center font-mono font-bold text-base shadow-xs">
              🧬
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="font-heading font-bold text-[16px] text-text">
                Topic Mastery Drill
              </span>
              <span className="font-mono text-xs text-neutral-600">
                Chapter-by-chapter progression in syllabus chronological order
              </span>
            </div>
          </button>

          {/* Mode 3: Spaced Repetition Review Pile */}
          <button
            type="button"
            onClick={() => handleModeSelect('review')}
            className={cn(
              'flex items-center gap-3.5 p-3.5 rounded-2xl border-[1.5px] text-left cursor-pointer transition-all',
              selectedMode === 'review'
                ? 'border-[#201e1d] bg-white ring-2 ring-[#c67139]/40 shadow-sm'
                : 'border-[#201e1d]/20 bg-white/70 hover:bg-white hover:border-[#201e1d]/40 shadow-xs'
            )}
          >
            <div className="w-10 h-10 flex-none rounded-xl bg-[#c67139] text-[#f9f4ed] flex items-center justify-center font-mono font-bold text-base shadow-xs">
              🧠
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className="font-heading font-bold text-[16px] text-text">
                Spaced Repetition Review Pile
              </span>
              <span className="font-mono text-xs text-neutral-600">
                Leitner recall system targeting your historically missed items
              </span>
            </div>
            {reviewCount > 0 ? (
              <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-mono font-bold text-xs shadow-xs">
                {reviewCount} DUE
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-300">
                CLEARED
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3. Round Configuration & Length */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Question Count Pills */}
        <div className="flex flex-col gap-2">
          <h2 className="font-mono text-xs font-bold tracking-wider uppercase text-neutral-700 m-0">
            ITEM COUNT
          </h2>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { val: 3 as const, label: '3' },
              { val: 5 as const, label: '5' },
              { val: 10 as const, label: '10' },
              { val: 'endless' as const, label: '∞' },
            ].map((item) => {
              const isSelected = roundLength === item.val;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleLengthSelect(item.val)}
                  className={cn(
                    'py-2 px-1 rounded-xl border font-mono font-bold text-xs cursor-pointer transition-all select-none text-center',
                    isSelected
                      ? 'border-[#201e1d] bg-[#201e1d] text-[#f9f4ed] shadow-xs'
                      : 'border-[#201e1d]/20 bg-white/80 text-text hover:bg-white'
                  )}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Timer Mode Switch */}
        <div className="flex flex-col gap-2">
          <h2 className="font-mono text-xs font-bold tracking-wider uppercase text-neutral-700 m-0">
            TIMER PROTOCOL
          </h2>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => handleTimerSelect(false)}
              className={cn(
                'py-2 px-2.5 rounded-xl border font-mono font-bold text-xs cursor-pointer transition-all text-left flex flex-col',
                !isTimed
                  ? 'border-[#201e1d] bg-[#201e1d] text-[#f9f4ed] shadow-xs'
                  : 'border-[#201e1d]/20 bg-white/80 text-text hover:bg-white'
              )}
            >
              <span>UNTIMED</span>
              <span className="text-[10px] opacity-75 font-normal">DEEP FOCUS</span>
            </button>
            <button
              type="button"
              onClick={() => handleTimerSelect(true)}
              className={cn(
                'py-2 px-2.5 rounded-xl border font-mono font-bold text-xs cursor-pointer transition-all text-left flex flex-col',
                isTimed
                  ? 'border-[#201e1d] bg-[#201e1d] text-[#f9f4ed] shadow-xs'
                  : 'border-[#201e1d]/20 bg-white/80 text-text hover:bg-white'
              )}
            >
              <span>EXAM MODE</span>
              <span className="text-[10px] opacity-75 font-normal">90s / ITEM</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Topic Mastery Card Trigger */}
      <button
        type="button"
        onClick={() => {
          playPop();
          setIsMasteryOpen(true);
        }}
        className="flex items-center gap-3 p-3.5 rounded-2xl bg-white/90 border-[1.5px] border-[#201e1d]/20 shadow-xs cursor-pointer text-left transition-all hover:bg-white hover:border-[#201e1d]/40"
      >
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-[15px] text-text">
              Topic Mastery Telemetry · {currentSubject.name}
            </span>
          </div>
          <div className="flex gap-1.5 flex-wrap font-mono text-[11px] font-bold">
            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-300 text-amber-900">
              👑 {tierCounts.master} Master
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-300 text-blue-900">
              ⚡ {tierCounts.proficient} Proficient
            </span>
            <span className="px-2 py-0.5 rounded bg-neutral-100 border border-neutral-300 text-neutral-700">
              🌱 {tierCounts.novice} Novice
            </span>
          </div>
        </div>
        <span className="font-mono text-xs font-bold text-neutral-500">
          VIEW RADAR →
        </span>
      </button>

      {/* 5. Primary Launch CTA: INITIALIZE PRACTICE ROUND 🚀 */}
      <button
        type="button"
        onClick={handleStart}
        className="w-full py-4 px-6 rounded-2xl bg-[#201e1d] hover:bg-[#34302d] text-[#f9f4ed] border-2 border-[#201e1d] shadow-[0_5px_0_0_#201e1d] font-heading font-black text-lg sm:text-xl tracking-wider uppercase cursor-pointer transition-all active:translate-y-1.5 active:shadow-none select-none flex items-center justify-center gap-2.5"
      >
        <span>INITIALIZE PRACTICE ROUND</span>
        <span className="text-xl">🚀</span>
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

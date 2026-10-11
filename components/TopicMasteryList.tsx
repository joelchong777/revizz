'use client';

import React, { useEffect, useState } from 'react';
import {
  CAMBRIDGE_TOPICS,
  CAMBRIDGE_QUESTIONS,
  SyllabusTopic,
} from '@/lib/questions';
import {
  calculateMasteryPercentage,
  getFirstTryCorrectIds,
  subscribeMasteryChanges,
} from '@/lib/mastery';
import { playPop } from '@/lib/audio';
import { cn } from '@/lib/utils';

interface TopicMasteryListProps {
  subject?: string;
  onPracticeTopic: (topicId: string, topicName: string) => void;
}

interface ChapterMastery {
  topic: SyllabusTopic;
  totalQuestions: number;
  masteredCount: number;
  percentage: number;
  tierLabel: string;
  tierBg: string;
  barColor: string;
}

export function TopicMasteryList({
  subject = 'Economics 0455',
  onPracticeTopic,
}: TopicMasteryListProps) {
  const [firstTryIds, setFirstTryIds] = useState<string[]>([]);

  useEffect(() => {
    setFirstTryIds(getFirstTryCorrectIds());

    const unsubscribe = subscribeMasteryChanges(() => {
      setFirstTryIds(getFirstTryCorrectIds());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const masteredSet = new Set(firstTryIds);

  const getTier = (p: number) => {
    if (p > 80) {
      return {
        label: '👑 Master (>80%)',
        shortLabel: '👑 Master',
        bg: 'bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
        bar: 'bg-emerald-600',
      };
    }
    if (p >= 50) {
      return {
        label: '⚡ Proficient (50–80%)',
        shortLabel: '⚡ Proficient',
        bg: 'bg-blue-50 text-blue-900 border border-blue-300 shadow-[0_0_10px_rgba(59,130,246,0.15)]',
        bar: 'bg-blue-600',
      };
    }
    return {
      label: '🌱 Novice (<50%)',
      shortLabel: '🌱 Novice',
      bg: 'bg-neutral-100 text-neutral-700 border border-neutral-300',
      bar: 'bg-neutral-400',
    };
  };

  const chapters: ChapterMastery[] = CAMBRIDGE_TOPICS.map((topic) => {
    const topicQuestions = CAMBRIDGE_QUESTIONS.filter(
      (q) => q.topic_id === topic.id
    );
    const totalQuestions = topicQuestions.length;
    const masteredCount = topicQuestions.filter((q) =>
      masteredSet.has(q.id)
    ).length;
    const percentage = calculateMasteryPercentage(
      masteredCount,
      totalQuestions
    );
    const tier = getTier(percentage);

    return {
      topic,
      totalQuestions,
      masteredCount,
      percentage,
      tierLabel: tier.shortLabel,
      tierBg: tier.bg,
      barColor: tier.bar,
    };
  });

  const totalQuestionsAll = CAMBRIDGE_QUESTIONS.length;
  const totalMasteredAll = CAMBRIDGE_QUESTIONS.filter((q) =>
    masteredSet.has(q.id)
  ).length;
  const overallPercentage = calculateMasteryPercentage(
    totalMasteredAll,
    totalQuestionsAll
  );
  const overallTier = getTier(overallPercentage);

  const handlePractice = (topicId: string, topicName: string) => {
    playPop();
    onPracticeTopic(topicId, topicName);
  };

  return (
    <div className="w-full flex flex-col gap-3.5 select-none">
      {/* Subject Overall Mastery Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white/95 border-[1.5px] border-[#201e1d]/20 shadow-sm flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                SYLLABUS COVERAGE RADAR
              </span>
            </div>
            <h2 className="font-heading font-black text-lg sm:text-xl text-text leading-tight truncate">
              {subject} Telemetry
            </h2>
            <span className="font-mono text-xs font-semibold text-neutral-600 mt-0.5">
              {totalMasteredAll} of {totalQuestionsAll} specification items mastered
            </span>
          </div>

          <span
            className={cn(
              'px-2.5 py-1 rounded-md font-mono text-xs font-bold whitespace-nowrap flex-shrink-0',
              overallTier.bg
            )}
          >
            {overallTier.shortLabel}
          </span>
        </div>

        {/* Overall Progress Bar */}
        <div className="flex items-center gap-3 mt-1">
          <div className="flex-1 h-2 rounded-full bg-[#201e1d]/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                overallTier.bar
              )}
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
          <span className="font-mono font-bold text-xs text-text w-10 text-right tabular-nums">
            {overallPercentage}%
          </span>
        </div>

        {/* Badges Legend */}
        <div className="pt-2 border-t border-[#201e1d]/10 flex items-center justify-between font-mono text-[10px] sm:text-[11px] font-bold text-neutral-600">
          <span>🌱 Novice (&lt;50%)</span>
          <span>⚡ Proficient (50–80%)</span>
          <span>👑 Master (&gt;80%)</span>
        </div>
      </div>

      {/* Chapters Precision Radar List */}
      <div className="flex flex-col gap-2.5">
        {chapters.map((c) => (
          <div
            key={c.topic.id}
            className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-white/90 border border-[#201e1d]/15 shadow-xs hover:border-[#201e1d]/30 transition-all"
          >
            {/* Header row: Topic Code + Topic Name + Tier Badge + Practice Button */}
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-[#201e1d] font-mono text-[10px] font-bold text-[#f9f4ed] flex-shrink-0">
                0{c.topic.orderIndex}
              </span>
              <span className="flex-1 font-heading font-bold text-sm text-text truncate">
                {c.topic.name}
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded font-mono text-[10px] font-bold whitespace-nowrap flex-shrink-0',
                  c.tierBg
                )}
              >
                {c.tierLabel}
              </span>
              <button
                type="button"
                onClick={() => handlePractice(c.topic.id, c.topic.name)}
                title={`Practice questions for ${c.topic.name}`}
                className="px-2.5 py-1 rounded-lg bg-[#201e1d] hover:bg-[#34302d] text-[#f9f4ed] font-mono text-xs font-bold transition-transform active:scale-95 cursor-pointer flex-shrink-0"
              >
                DRILL →
              </button>
            </div>

            {/* Precision Progress Bar Row */}
            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-1.5 rounded-full bg-[#201e1d]/10 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-700 ease-out',
                    c.barColor
                  )}
                  style={{ width: `${c.percentage}%` }}
                />
              </div>
              <span className="font-mono font-bold text-xs text-text w-9 text-right tabular-nums">
                {c.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TopicMasteryList;

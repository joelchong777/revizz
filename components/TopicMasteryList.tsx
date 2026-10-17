'use client';

import React, { useEffect, useState } from 'react';
import {
  SyllabusTopic,
  Question,
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
  questions?: Question[];
  topics?: SyllabusTopic[];
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
  questions,
  topics,
}: TopicMasteryListProps) {
  const [firstTryIds, setFirstTryIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setFirstTryIds(getFirstTryCorrectIds());

    const unsubscribe = subscribeMasteryChanges(() => {
      setFirstTryIds(getFirstTryCorrectIds());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const effectiveTopics = topics !== undefined ? topics : [];
  const effectiveQuestions = questions !== undefined ? questions : [];

  if (effectiveTopics.length === 0 || effectiveQuestions.length === 0) {
    return (
      <div className="w-full p-6 rounded-[24px] bg-surface border-2 border-text shadow-offset-4 text-center space-y-2 select-none">
        <div className="text-3xl">📚</div>
        <h3 className="font-heading text-lg font-black text-text">No Topics Available</h3>
        <p className="text-xs font-semibold text-neutral-600 max-w-sm mx-auto">
          Syllabus topics and mastery data will populate once exam questions are published.
        </p>
      </div>
    );
  }

  const masteredSet = new Set(firstTryIds);

  const getTier = (p: number) => {
    if (p > 80) {
      return {
        label: '👑 Master',
        bg: 'bg-accent-2-300',
        bar: 'bg-accent-2-500',
      };
    }
    if (p >= 50) {
      return {
        label: '⚡ Proficient',
        bg: 'bg-accent-300',
        bar: 'bg-accent-400',
      };
    }
    return {
      label: '🌱 Novice',
      bg: 'bg-neutral-200',
      bar: 'bg-neutral-400',
    };
  };

  const chapters: ChapterMastery[] = effectiveTopics.map((topic) => {
    const topicQuestions = effectiveQuestions.filter(
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
      tierLabel: tier.label,
      tierBg: tier.bg,
      barColor: tier.bar,
    };
  });

  const totalQuestionsAll = effectiveQuestions.length;
  const totalMasteredAll = effectiveQuestions.filter((q) =>
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

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredChapters = chapters.filter((c) => {
    if (!normalizedQuery) return true;
    const nameMatch = c.topic.name.toLowerCase().includes(normalizedQuery);
    const orderMatch =
      c.topic.orderIndex !== undefined &&
      (String(c.topic.orderIndex).includes(normalizedQuery) ||
        `topic ${c.topic.orderIndex}`.includes(normalizedQuery));
    return nameMatch || Boolean(orderMatch);
  });

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      {/* Subject Overall Mastery Card */}
      <div className="p-4 sm:p-5 rounded-[24px] bg-surface border-2 border-text shadow-offset-4 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col min-w-0">
            <h2 className="font-heading text-lg text-text leading-tight truncate">
              {subject} Mastery
            </h2>
            <span className="text-xs font-semibold text-neutral-700">
              {totalMasteredAll} of {totalQuestionsAll} syllabus questions mastered
            </span>
          </div>

          <span
            className={cn(
              'px-3 py-1 rounded-full border-[1.5px] border-text text-xs font-bold whitespace-nowrap text-text flex-shrink-0',
              overallTier.bg
            )}
          >
            {overallTier.label}
          </span>
        </div>

        {/* Overall Progress Bar */}
        <div className="flex items-center gap-2.5 mt-1">
          <div className="flex-1 h-3.5 rounded-full bg-bg border-2 border-text overflow-hidden">
            <div
              className={cn(
                'h-full border-r-2 border-text transition-all duration-700 ease-out',
                overallTier.bar
              )}
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
          <span className="font-bold text-xs text-text w-9 text-right tabular-nums">
            {overallPercentage}%
          </span>
        </div>

        {/* Badges Legend */}
        <div className="pt-2 border-t border-text/15 flex items-center justify-between text-[11px] font-bold text-neutral-700">
          <span>🌱 Novice (&lt;50%)</span>
          <span>⚡ Proficient (50–80%)</span>
          <span>👑 Master (&gt;80%)</span>
        </div>
      </div>

      {/* Topic Search Bar */}
      <div className="border-2 border-text rounded-2xl bg-surface shadow-offset-2 px-3 py-2 flex items-center gap-2 focus-within:ring-2 focus-within:ring-accent">
        <svg
          className="w-4 h-4 text-neutral-500 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSearchQuery('');
            }
          }}
          placeholder="Search topics by name..."
          aria-label="Search syllabus topics"
          className="w-full bg-transparent text-sm font-semibold text-text placeholder:text-neutral-500 outline-none"
        />
        {searchQuery.length > 0 && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-neutral-600 hover:text-text hover:bg-neutral-200 transition-colors flex-shrink-0 cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Chapters List Matching Mockup */}
      {filteredChapters.length === 0 ? (
        <div className="w-full p-6 rounded-[22px] bg-neutral-100 border-2 border-text shadow-offset-3 text-center space-y-3">
          <div className="text-3xl">🔍</div>
          <div className="space-y-1">
            <h3 className="font-heading text-base font-black text-text">No topics found</h3>
            <p className="text-xs font-semibold text-neutral-600 max-w-sm mx-auto">
              No topics matched &ldquo;{searchQuery}&rdquo;. Try another keyword or clear your search.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="px-3.5 py-1.5 rounded-full bg-accent hover:bg-accent-600 text-neutral-100 text-xs font-bold border-[1.5px] border-text shadow-xs active:scale-95 transition-transform cursor-pointer inline-flex items-center gap-1.5"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filteredChapters.map((c) => (
            <div
              key={c.topic.id}
              className="flex flex-col gap-2 p-3 sm:px-3.5 rounded-[22px] bg-neutral-100 border-2 border-text shadow-offset-3"
            >
              {/* Header row: Topic Name + Tier Badge + Practice Button */}
              <div className="flex items-center gap-2">
                <span className="flex-1 font-bold text-sm text-text truncate">
                  {c.topic.name}
                </span>
                <span
                  className={cn(
                    'px-2.5 py-0.5 rounded-full border-[1.5px] border-text text-xs font-bold whitespace-nowrap text-text flex-shrink-0',
                    c.tierBg
                  )}
                >
                  {c.tierLabel}
                </span>
                <button
                  type="button"
                  onClick={() => handlePractice(c.topic.id, c.topic.name)}
                  title={`Practice questions for ${c.topic.name}`}
                  className="px-2.5 py-1 rounded-full bg-accent hover:bg-accent-600 text-neutral-100 text-xs font-bold border-[1.5px] border-text shadow-xs active:scale-95 transition-transform cursor-pointer flex-shrink-0"
                >
                  Practice
                </button>
              </div>

              {/* Progress bar row */}
              <div className="flex items-center gap-2.5">
                <div className="flex-1 h-3.5 rounded-full bg-bg border-2 border-text overflow-hidden">
                  <div
                    className={cn(
                      'h-full border-r-2 border-text transition-all duration-700 ease-out',
                      c.barColor
                    )}
                    style={{ width: `${c.percentage}%` }}
                  />
                </div>
                <span className="font-bold text-xs text-text w-9 text-right tabular-nums">
                  {c.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TopicMasteryList;

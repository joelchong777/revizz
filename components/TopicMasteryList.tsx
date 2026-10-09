'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Sparkles, ChevronRight } from 'lucide-react';
import {
  CAMBRIDGE_TOPICS,
  CAMBRIDGE_QUESTIONS,
  SyllabusTopic,
} from '@/lib/questions';
import {
  calculateMasteryPercentage,
  getMasteryBadge,
  getFirstTryCorrectIds,
  subscribeMasteryChanges,
  MasteryBadge,
} from '@/lib/mastery';
import { playPop } from '@/lib/audio';

interface TopicMasteryListProps {
  subject?: string;
  onPracticeTopic: (topicId: string, topicName: string) => void;
}

interface TopicStat {
  topic: SyllabusTopic;
  totalQuestions: number;
  masteredCount: number;
  percentage: number;
  badge: MasteryBadge;
}

export function TopicMasteryList({
  subject = 'Economics 0455',
  onPracticeTopic,
}: TopicMasteryListProps) {
  const [firstTryIds, setFirstTryIds] = useState<string[]>([]);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    setFirstTryIds(getFirstTryCorrectIds());

    const unsubscribe = subscribeMasteryChanges(() => {
      setFirstTryIds(getFirstTryCorrectIds());
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const masteredSet = new Set(firstTryIds);

  const topicStats: TopicStat[] = CAMBRIDGE_TOPICS.map((topic) => {
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
    const badge = getMasteryBadge(percentage);

    return {
      topic,
      totalQuestions,
      masteredCount,
      percentage,
      badge,
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
  const overallBadge = getMasteryBadge(overallPercentage);

  const handlePractice = (topicId: string, topicName: string) => {
    playPop();
    onPracticeTopic(topicId, topicName);
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Subject Overall Mastery Card */}
      <div className="card-playful p-5 bg-gradient-to-br from-white via-indigo-50/30 to-purple-50/40 border-indigo-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-indigo/10 flex items-center justify-center text-brand-indigo font-black">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-lg tracking-tight">
                {subject} Mastery
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Cambridge IGCSE Syllabus Topics
              </p>
            </div>
          </div>

          {/* Overall Badge */}
          <div
            className={`px-3 py-1 rounded-xl text-xs font-black inline-flex items-center gap-1.5 ${overallBadge.chipClass}`}
          >
            <span>{overallBadge.icon}</span>
            <span>{overallBadge.label}</span>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs font-bold text-slate-600 mb-1.5">
            <span>Overall Syllabus Progress</span>
            <span className="text-brand-indigo font-black">
              {overallPercentage}% ({totalMasteredAll}/{totalQuestionsAll})
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${overallBadge.progressColorClass}`}
              style={{ width: `${overallPercentage}%` }}
            />
          </div>
        </div>

        {/* Badges Legend */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-500">
          <span className="flex items-center gap-1">
            <span>🌱</span> Novice (&lt;50%)
          </span>
          <span className="flex items-center gap-1">
            <span>⚡</span> Proficient (50-80%)
          </span>
          <span className="flex items-center gap-1">
            <span>👑</span> Master (&gt;80%)
          </span>
        </div>
      </div>

      {/* Itemized Topics List */}
      <div className="space-y-3">
        {topicStats.map((stat) => (
          <div
            key={stat.topic.id}
            className="card-playful p-4 hover:border-slate-300 transition-all bg-white"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-xs font-black text-slate-400">
                    Topic {stat.topic.orderIndex}
                  </span>
                  <div
                    className={`px-2 py-0.5 rounded-lg text-xs font-black inline-flex items-center gap-1 ${stat.badge.chipClass}`}
                  >
                    <span>{stat.badge.icon}</span>
                    <span>{stat.badge.label}</span>
                  </div>
                </div>

                <h3 className="font-black text-slate-900 text-sm tracking-tight leading-snug">
                  {stat.topic.name}
                </h3>
              </div>

              {/* Quick Practice Topic Button */}
              <button
                type="button"
                onClick={() => handlePractice(stat.topic.id, stat.topic.name)}
                className="btn-chunky-teal text-xs py-2 px-3 font-black shadow-xs flex-shrink-0 flex items-center gap-1"
                title={`Practice questions for ${stat.topic.name}`}
              >
                <span>Practice</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Topic Progress Bar & Count */}
            <div className="mt-3">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-500 mb-1">
                <span>{stat.masteredCount} of {stat.totalQuestions} questions mastered</span>
                <span className="font-black text-slate-700">{stat.percentage}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${stat.badge.progressColorClass}`}
                  style={{ width: `${stat.percentage}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TopicMasteryList;

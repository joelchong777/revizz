'use client';

import React, { useState, useMemo } from 'react';
import { StudentStatsSummary, TopicStatItem } from '@/lib/studentProfile';
import { getMasteryBadge, MasteryTier } from '@/lib/mastery';

export interface StudentStatsPanelProps {
  statsSummary: StudentStatsSummary;
  userXp: number;
  currentStreak: number;
  onDrillTopic: (topicId: string) => void;
  onOpenReviewTab: () => void;
}

export function StudentStatsPanel({
  statsSummary,
  userXp,
  currentStreak,
  onDrillTopic,
  onOpenReviewTab,
}: StudentStatsPanelProps): React.ReactElement {
  // Unconditional React state hooks (Error #310 Defense)
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | MasteryTier>('all');
  const [sortBy, setSortBy] = useState<'mastery-asc' | 'mastery-desc' | 'name' | 'mistakes'>('mastery-asc');

  // Filter & sort topic list
  const filteredTopics = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = (statsSummary.topicStats || []).filter((item) => {
      // Tier filter
      if (tierFilter !== 'all' && item.tier !== tierFilter) {
        return false;
      }
      // Text search
      if (query && !item.topicName.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      switch (sortBy) {
        case 'mastery-asc':
          if (a.masteryPct !== b.masteryPct) return a.masteryPct - b.masteryPct;
          return b.reviewMistakeCount - a.reviewMistakeCount;
        case 'mastery-desc':
          if (a.masteryPct !== b.masteryPct) return b.masteryPct - a.masteryPct;
          return a.reviewMistakeCount - b.reviewMistakeCount;
        case 'mistakes':
          if (b.reviewMistakeCount !== a.reviewMistakeCount) {
            return b.reviewMistakeCount - a.reviewMistakeCount;
          }
          return a.masteryPct - b.masteryPct;
        case 'name':
        default:
          return a.topicName.localeCompare(b.topicName);
      }
    });
  }, [statsSummary.topicStats, tierFilter, searchQuery, sortBy]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. TOP 6-CARD KPI BENTO GRID */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black uppercase tracking-wider text-neutral-500">
            Performance Overview
          </h2>
          <span className="text-xs font-bold text-neutral-600 bg-neutral-100 border border-neutral-300 rounded-md px-2 py-0.5">
            Real-time Metrics
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Card 1: Overall Syllabus Mastery */}
          <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Syllabus Mastery
                </p>
                <div className="text-2xl sm:text-3xl font-black text-[#201e1d] mt-1">
                  {statsSummary.overallMasteryPct}%
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-100 border-2 border-[#201e1d] flex items-center justify-center text-lg shadow-[1px_1px_0_0_#201e1d]">
                🎯
              </div>
            </div>

            <div className="mt-3">
              <div className="w-full bg-neutral-100 h-2.5 rounded-full border border-[#201e1d] overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, statsSummary.overallMasteryPct))}%` }}
                />
              </div>
              <p className="text-[11px] font-bold text-neutral-600 mt-1.5 truncate">
                {statsSummary.totalFirstTryCorrect} of {statsSummary.totalQuestionsInBank} 1st-try correct
              </p>
            </div>
          </div>

          {/* Card 2: Total XP Earned */}
          <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Total XP Earned
                </p>
                <div className="text-2xl sm:text-3xl font-black text-[#201e1d] mt-1 text-indigo-600">
                  +{userXp.toLocaleString()}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-indigo-100 border-2 border-[#201e1d] flex items-center justify-center text-lg shadow-[1px_1px_0_0_#201e1d]">
                ⚡
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-neutral-200">
              <p className="text-[11px] font-bold text-neutral-600 flex items-center gap-1 truncate">
                <span>Earned from revision & drills</span>
              </p>
            </div>
          </div>

          {/* Card 3: Current & Best Streak */}
          <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Current & Best Streak
                </p>
                <div className="text-2xl sm:text-3xl font-black text-[#201e1d] mt-1 flex items-center gap-1.5">
                  <span className="text-amber-500">🔥</span> {currentStreak}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-100 border-2 border-[#201e1d] flex items-center justify-center text-lg shadow-[1px_1px_0_0_#201e1d]">
                🏆
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-neutral-200">
              <p className="text-[11px] font-bold text-neutral-600 truncate">
                Best round peak: <span className="text-amber-600 font-black">{statsSummary.bestRoundStreak} in a row</span>
              </p>
            </div>
          </div>

          {/* Card 4: Average Round Accuracy */}
          <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Round Accuracy
                </p>
                <div className="text-2xl sm:text-3xl font-black text-[#201e1d] mt-1">
                  {statsSummary.averageRoundAccuracyPct}%
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-teal-100 border-2 border-[#201e1d] flex items-center justify-center text-lg shadow-[1px_1px_0_0_#201e1d]">
                📊
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-neutral-200">
              <p className="text-[11px] font-bold text-neutral-600 truncate">
                Across {statsSummary.roundsCompleted} completed round{statsSummary.roundsCompleted === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {/* Card 5: Mistake Review Queue (Clickable) */}
          <button
            type="button"
            onClick={onOpenReviewTab}
            className="text-left bg-rose-50 hover:bg-rose-100/80 border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_0_#201e1d] cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-rose-700">
                  Review Queue
                </p>
                <div className="text-2xl sm:text-3xl font-black text-rose-950 mt-1 flex items-center gap-1.5">
                  <span>🧠</span> {statsSummary.reviewPileQuestionCount}
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-rose-200 border-2 border-[#201e1d] flex items-center justify-center text-lg shadow-[1px_1px_0_0_#201e1d] group-hover:scale-105 transition-transform">
                🔥
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-rose-200 flex items-center justify-between">
              <span className="text-[11px] font-black text-rose-800">
                {statsSummary.reviewPileQuestionCount > 0 ? 'Questions need revision' : 'Pile is clean!'}
              </span>
              <span className="text-xs font-black text-rose-800 group-hover:translate-x-0.5 transition-transform">
                Open →
              </span>
            </div>
          </button>

          {/* Card 6: Topics Mastered Breakdown */}
          <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Topic Progression
                </p>
                <div className="text-2xl sm:text-3xl font-black text-[#201e1d] mt-1">
                  {statsSummary.masteredTopicsCount}{' '}
                  <span className="text-sm font-bold text-neutral-500">Mastered</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-amber-100 border-2 border-[#201e1d] flex items-center justify-center text-lg shadow-[1px_1px_0_0_#201e1d]">
                👑
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-neutral-200 flex items-center gap-1.5 text-[11px] font-bold text-neutral-600 flex-wrap">
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300">
                👑 {statsSummary.masteredTopicsCount}
              </span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-teal-50 text-teal-900 border border-teal-300">
                ⚡ {statsSummary.proficientTopicsCount}
              </span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-50 text-orange-900 border border-orange-300">
                🌱 {statsSummary.noviceTopicsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. STRENGTHS VS FOCUS AREAS SPLIT ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Top Strengths */}
        <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-neutral-100">
            <div className="flex items-center gap-2">
              <span className="text-xl">👑</span>
              <h3 className="font-black text-sm sm:text-base text-[#201e1d]">Strongest Topics</h3>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-md px-2 py-0.5">
              High Mastery
            </span>
          </div>

          {statsSummary.strongestTopics && statsSummary.strongestTopics.length > 0 ? (
            <div className="space-y-3">
              {statsSummary.strongestTopics.map((topic) => {
                const badge = getMasteryBadge(topic.masteryPct);
                return (
                  <div
                    key={topic.topicId}
                    className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/70 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-xs sm:text-sm text-[#201e1d] line-clamp-1">
                        {topic.topicName}
                      </span>
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 border ${badge.chipClass}`}
                      >
                        {badge.icon} {topic.masteryPct}%
                      </span>
                    </div>

                    <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${topic.masteryPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-500 font-bold mt-1">
                      <span>
                        {topic.firstTryCorrectCount} / {topic.totalQuestions} first-try correct
                      </span>
                      {topic.reviewMistakeCount > 0 && (
                        <span className="text-rose-600">🔥 {topic.reviewMistakeCount} mistakes</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-bold text-neutral-500">
              Complete quiz rounds to identify your strongest topics.
            </div>
          )}
        </div>

        {/* Right: Priority Focus / Needs Practice */}
        <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d]">
          <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-neutral-100">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <h3 className="font-black text-sm sm:text-base text-[#201e1d]">Priority Focus</h3>
            </div>
            <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded-md px-2 py-0.5">
              Needs Practice
            </span>
          </div>

          {statsSummary.weakestTopics && statsSummary.weakestTopics.length > 0 ? (
            <div className="space-y-3">
              {statsSummary.weakestTopics.map((topic) => {
                const badge = getMasteryBadge(topic.masteryPct);
                return (
                  <div
                    key={topic.topicId}
                    className="p-3 rounded-xl border border-neutral-200 bg-neutral-50/70 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-bold text-xs sm:text-sm text-[#201e1d] line-clamp-1">
                        {topic.topicName}
                      </span>
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 border ${badge.chipClass}`}
                      >
                        {badge.icon} {topic.masteryPct}%
                      </span>
                    </div>

                    <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${topic.masteryPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1">
                      <div className="text-[11px] font-bold text-neutral-600">
                        {topic.reviewMistakeCount > 0 ? (
                          <span className="text-rose-600">🔥 {topic.reviewMistakeCount} in review pile</span>
                        ) : (
                          <span>{topic.firstTryCorrectCount} / {topic.totalQuestions} mastered</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onDrillTopic(topic.topicId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-black rounded-lg bg-accent-300 hover:bg-amber-300 border border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] text-[#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                      >
                        <span>Drill Now</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-xs font-bold text-neutral-500">
              All topics are currently at high mastery!
            </div>
          )}
        </div>
      </div>

      {/* 3. INTERACTIVE SYLLABUS TOPIC MASTERY EXPLORER */}
      <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-6 shadow-[3px_3px_0_0_#201e1d]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-neutral-100">
          <div>
            <h3 className="text-base sm:text-lg font-black text-[#201e1d] flex items-center gap-2">
              <span>📚</span> Syllabus Topic Mastery Explorer
            </h3>
            <p className="text-xs font-bold text-neutral-500 mt-0.5">
              Filter topics by retention tier, search by name, or launch target revision rounds.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="topic-sort" className="text-xs font-bold text-neutral-500 shrink-0">
              Sort:
            </label>
            <select
              id="topic-sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs font-bold bg-neutral-100 border-2 border-[#201e1d] rounded-xl px-2.5 py-1.5 text-[#201e1d] cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-300"
            >
              <option value="mastery-asc">Lowest Mastery First</option>
              <option value="mastery-desc">Highest Mastery First</option>
              <option value="mistakes">Most Mistakes First</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-3 flex items-center text-neutral-400 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchQuery('');
              }}
              placeholder="Search syllabus topics... (Esc to clear)"
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-bold bg-neutral-50 border-2 border-[#201e1d] rounded-xl text-[#201e1d] placeholder:text-neutral-400 placeholder:font-normal focus:outline-none focus:bg-white focus:ring-2 focus:ring-accent-300 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-2.5 flex items-center text-xs font-black text-neutral-400 hover:text-neutral-800"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Tier Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setTierFilter('all')}
              className={`px-2.5 py-1.5 rounded-xl border-2 text-xs font-black transition-all ${
                tierFilter === 'all'
                  ? 'bg-[#201e1d] text-white border-[#201e1d] shadow-[1px_1px_0_0_#201e1d]'
                  : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#201e1d]'
              }`}
            >
              All ({statsSummary.topicStats?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setTierFilter('master')}
              className={`px-2.5 py-1.5 rounded-xl border-2 text-xs font-black transition-all ${
                tierFilter === 'master'
                  ? 'bg-amber-400 text-amber-950 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d]'
                  : 'bg-amber-50 text-amber-900 border-amber-300 hover:border-[#201e1d]'
              }`}
            >
              👑 Master ({statsSummary.masteredTopicsCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setTierFilter('proficient')}
              className={`px-2.5 py-1.5 rounded-xl border-2 text-xs font-black transition-all ${
                tierFilter === 'proficient'
                  ? 'bg-teal-400 text-teal-950 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d]'
                  : 'bg-teal-50 text-teal-900 border-teal-300 hover:border-[#201e1d]'
              }`}
            >
              ⚡ Proficient ({statsSummary.proficientTopicsCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setTierFilter('novice')}
              className={`px-2.5 py-1.5 rounded-xl border-2 text-xs font-black transition-all ${
                tierFilter === 'novice'
                  ? 'bg-orange-400 text-orange-950 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d]'
                  : 'bg-orange-50 text-orange-900 border-orange-300 hover:border-[#201e1d]'
              }`}
            >
              🌱 Novice ({statsSummary.noviceTopicsCount || 0})
            </button>
          </div>
        </div>

        {/* Topics List Grid */}
        <div className="mt-5">
          {filteredTopics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {filteredTopics.map((topic) => {
                const badge = getMasteryBadge(topic.masteryPct);
                return (
                  <div
                    key={topic.topicId}
                    className="bg-neutral-50/70 hover:bg-neutral-50 border-2 border-[#201e1d] rounded-xl p-4 shadow-[2px_2px_0_0_#201e1d] flex flex-col justify-between transition-all"
                  >
                    <div>
                      {/* Topic Header Row */}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-black text-sm sm:text-base text-[#201e1d] leading-snug">
                          {topic.topicName}
                        </h4>
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded-full shrink-0 border ${badge.chipClass}`}
                        >
                          {badge.icon} {badge.label} · {topic.masteryPct}%
                        </span>
                      </div>

                      {/* Tactile Progress Bar */}
                      <div className="mt-3">
                        <div className="w-full bg-white h-3 rounded-full border border-[#201e1d] overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              topic.tier === 'master'
                                ? 'bg-amber-400'
                                : topic.tier === 'proficient'
                                  ? 'bg-teal-500'
                                  : 'bg-orange-400'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, topic.masteryPct))}%` }}
                          />
                        </div>
                      </div>

                      {/* Detail Metrics Chips */}
                      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-xs font-bold text-neutral-600">
                        <span className="bg-white border border-neutral-300 rounded-md px-2 py-0.5">
                          {topic.firstTryCorrectCount} / {topic.totalQuestions} 1st-try correct
                        </span>
                        {topic.reviewMistakeCount > 0 && (
                          <span className="bg-rose-100 text-rose-800 border border-rose-300 rounded-md px-2 py-0.5">
                            🔥 {topic.reviewMistakeCount} to review
                          </span>
                        )}
                        {topic.bookmarkedCount > 0 && (
                          <span className="bg-amber-100 text-amber-900 border border-amber-300 rounded-md px-2 py-0.5">
                            ⭐ {topic.bookmarkedCount} saved
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Practice Topic CTA Button */}
                    <div className="mt-4 pt-3 border-t border-neutral-200 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => onDrillTopic(topic.topicId)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-accent-300 hover:bg-amber-300 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-[#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                      >
                        <span>Practice Topic</span>
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-300 p-6">
              <span className="text-3xl">🔍</span>
              <p className="font-black text-sm text-[#201e1d] mt-2">No topics match your filters</p>
              <p className="text-xs font-bold text-neutral-500 mt-1">
                Try searching for another keyword or reset your tier filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTierFilter('all');
                }}
                className="mt-3 px-3 py-1.5 text-xs font-black rounded-lg bg-neutral-200 hover:bg-neutral-300 text-neutral-800 border border-[#201e1d] cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

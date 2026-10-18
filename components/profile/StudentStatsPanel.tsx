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
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-xs font-black uppercase tracking-wider text-neutral-500">
            Performance Overview
          </h2>
          <span className="text-xs font-bold text-[#201e1d] bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-2.5 py-0.5 shadow-[1px_1px_0_0_#201e1d]">
            Real-time Metrics
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {/* Card 1: Overall Syllabus Mastery */}
          <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Syllabus Mastery
                </p>
                <div className="text-3xl sm:text-4xl font-heading text-[#201e1d] mt-1">
                  {statsSummary.overallMasteryPct}%
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#FEF08A] border-2 border-[#201e1d] flex items-center justify-center text-xl shadow-[1.5px_1.5px_0_0_#201e1d]">
                🎯
              </div>
            </div>

            <div className="mt-3">
              <div className="w-full bg-neutral-100 h-3 rounded-full border border-[#201e1d] overflow-hidden p-0.5">
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
          <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Total XP Earned
                </p>
                <div className="text-3xl sm:text-4xl font-heading text-indigo-700 mt-1">
                  +{userXp.toLocaleString()}
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#C7D2FE] border-2 border-[#201e1d] flex items-center justify-center text-xl shadow-[1.5px_1.5px_0_0_#201e1d]">
                ⚡
              </div>
            </div>

            <div className="mt-3 pt-2 border-t-2 border-neutral-100">
              <p className="text-[11px] font-bold text-neutral-600 flex items-center gap-1 truncate">
                <span>Earned from revision & drills</span>
              </p>
            </div>
          </div>

          {/* Card 3: Current & Best Streak */}
          <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Current & Best Streak
                </p>
                <div className="text-3xl sm:text-4xl font-heading text-[#201e1d] mt-1 flex items-center gap-1.5">
                  <span className="text-amber-500">🔥</span> {currentStreak}
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#FDE68A] border-2 border-[#201e1d] flex items-center justify-center text-xl shadow-[1.5px_1.5px_0_0_#201e1d]">
                🏆
              </div>
            </div>

            <div className="mt-3 pt-2 border-t-2 border-neutral-100">
              <p className="text-[11px] font-bold text-neutral-600 truncate">
                Best round peak: <span className="text-amber-700 font-heading">{statsSummary.bestRoundStreak} in a row</span>
              </p>
            </div>
          </div>

          {/* Card 4: Average Round Accuracy */}
          <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Round Accuracy
                </p>
                <div className="text-3xl sm:text-4xl font-heading text-[#201e1d] mt-1">
                  {statsSummary.averageRoundAccuracyPct}%
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#99F6E4] border-2 border-[#201e1d] flex items-center justify-center text-xl shadow-[1.5px_1.5px_0_0_#201e1d]">
                📊
              </div>
            </div>

            <div className="mt-3 pt-2 border-t-2 border-neutral-100">
              <p className="text-[11px] font-bold text-neutral-600 truncate">
                Across {statsSummary.roundsCompleted} completed round{statsSummary.roundsCompleted === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {/* Card 5: Mistake Review Queue (Clickable) */}
          <button
            type="button"
            onClick={onOpenReviewTab}
            className="text-left bg-[#FFFDF7] hover:bg-rose-50/50 border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_0_#201e1d] cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-rose-700">
                  Review Queue
                </p>
                <div className="text-3xl sm:text-4xl font-heading text-rose-950 mt-1 flex items-center gap-1.5">
                  <span>🧠</span> {statsSummary.reviewPileQuestionCount}
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#FECDD3] border-2 border-[#201e1d] flex items-center justify-center text-xl shadow-[1.5px_1.5px_0_0_#201e1d] group-hover:scale-105 transition-transform">
                🔥
              </div>
            </div>

            <div className="mt-3 pt-2 border-t-2 border-rose-100 flex items-center justify-between">
              <span className="text-[11px] font-black text-rose-800">
                {statsSummary.reviewPileQuestionCount > 0 ? 'Questions need revision' : 'Pile is clean!'}
              </span>
              <span className="text-xs font-heading text-rose-800 group-hover:translate-x-0.5 transition-transform">
                Open →
              </span>
            </div>
          </button>

          {/* Card 6: Topics Mastered Breakdown */}
          <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500">
                  Topic Progression
                </p>
                <div className="text-3xl sm:text-4xl font-heading text-[#201e1d] mt-1">
                  {statsSummary.masteredTopicsCount}{' '}
                  <span className="text-sm font-bold text-neutral-500 font-sans">Mastered</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[#BBF7D0] border-2 border-[#201e1d] flex items-center justify-center text-xl shadow-[1.5px_1.5px_0_0_#201e1d]">
                👑
              </div>
            </div>

            <div className="mt-3 pt-2 border-t-2 border-neutral-100 flex items-center gap-1.5 text-[11px] font-bold text-neutral-600 flex-wrap">
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-[#201e1d] font-bold">
                👑 {statsSummary.masteredTopicsCount}
              </span>
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-teal-50 text-teal-900 border border-[#201e1d] font-bold">
                ⚡ {statsSummary.proficientTopicsCount}
              </span>
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg bg-orange-50 text-orange-900 border border-[#201e1d] font-bold">
                🌱 {statsSummary.noviceTopicsCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. STRENGTHS VS FOCUS AREAS SPLIT ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Top Strengths */}
        <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-5 shadow-[3px_3px_0_0_#201e1d]">
          <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b-2 border-neutral-100">
            <div className="flex items-center gap-2">
              <span className="text-xl">👑</span>
              <h3 className="font-heading text-base sm:text-lg text-[#201e1d]">Strongest Topics</h3>
            </div>
            <span className="text-xs font-bold text-emerald-900 bg-emerald-100 border border-emerald-400 rounded-xl px-2.5 py-0.5">
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
                    className="p-3.5 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] shadow-[1.5px_1.5px_0_0_#201e1d]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-heading text-xs sm:text-sm text-[#201e1d] line-clamp-1">
                        {topic.topicName}
                      </span>
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 border border-[#201e1d] ${badge.chipClass}`}
                      >
                        {badge.icon} {topic.masteryPct}%
                      </span>
                    </div>

                    <div className="w-full bg-white h-2.5 rounded-full border border-[#201e1d] overflow-hidden p-0.5">
                      <div
                        className="bg-emerald-500 h-full rounded-full"
                        style={{ width: `${topic.masteryPct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-neutral-600 font-bold mt-1.5">
                      <span>
                        {topic.firstTryCorrectCount} / {topic.totalQuestions} first-try correct
                      </span>
                      {topic.reviewMistakeCount > 0 && (
                        <span className="text-rose-700 font-black">🔥 {topic.reviewMistakeCount} mistakes</span>
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
        <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-5 shadow-[3px_3px_0_0_#201e1d]">
          <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b-2 border-neutral-100">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <h3 className="font-heading text-base sm:text-lg text-[#201e1d]">Priority Focus</h3>
            </div>
            <span className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-400 rounded-xl px-2.5 py-0.5">
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
                    className="p-3.5 rounded-xl border-2 border-[#201e1d] bg-[#f9f4ed] shadow-[1.5px_1.5px_0_0_#201e1d]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="font-heading text-xs sm:text-sm text-[#201e1d] line-clamp-1">
                        {topic.topicName}
                      </span>
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-full shrink-0 border border-[#201e1d] ${badge.chipClass}`}
                      >
                        {badge.icon} {topic.masteryPct}%
                      </span>
                    </div>

                    <div className="w-full bg-white h-2.5 rounded-full border border-[#201e1d] overflow-hidden p-0.5">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${topic.masteryPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-neutral-200">
                      <div className="text-[11px] font-bold text-neutral-600">
                        {topic.reviewMistakeCount > 0 ? (
                          <span className="text-rose-700 font-black">🔥 {topic.reviewMistakeCount} in review pile</span>
                        ) : (
                          <span>{topic.firstTryCorrectCount} / {topic.totalQuestions} mastered</span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onDrillTopic(topic.topicId)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-heading rounded-xl bg-[#FFDE59] hover:bg-[#FACC15] border-2 border-[#201e1d] shadow-[1.5px_1.5px_0_0_#201e1d] text-[#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
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
      <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-3xl p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-neutral-100">
          <div>
            <h3 className="text-lg sm:text-xl font-heading text-[#201e1d] flex items-center gap-2">
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
              className="text-xs font-bold bg-[#f9f4ed] border-2 border-[#201e1d] rounded-xl px-3 py-1.5 text-[#201e1d] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#FFDE59]"
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
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm font-bold bg-neutral-50 border-2 border-[#201e1d] rounded-xl text-[#201e1d] placeholder:text-neutral-400 placeholder:font-normal focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#FFDE59] transition-colors"
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setTierFilter('all')}
              className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] text-xs font-bold transition-all cursor-pointer ${
                tierFilter === 'all'
                  ? 'bg-[#201e1d] text-white shadow-[2px_2px_0_0_#201e1d]'
                  : 'bg-white text-neutral-700 hover:bg-neutral-100 shadow-[1px_1px_0_0_#201e1d]'
              }`}
            >
              All ({statsSummary.topicStats?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setTierFilter('master')}
              className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] text-xs font-bold transition-all cursor-pointer ${
                tierFilter === 'master'
                  ? 'bg-[#FFDE59] text-[#201e1d] font-heading shadow-[2px_2px_0_0_#201e1d]'
                  : 'bg-[#fff8db] text-amber-900 hover:bg-[#FEF08A] shadow-[1px_1px_0_0_#201e1d]'
              }`}
            >
              👑 Master ({statsSummary.masteredTopicsCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setTierFilter('proficient')}
              className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] text-xs font-bold transition-all cursor-pointer ${
                tierFilter === 'proficient'
                  ? 'bg-[#14B8A6] text-white font-heading shadow-[2px_2px_0_0_#201e1d]'
                  : 'bg-[#f0fae1] text-teal-900 hover:bg-[#99F6E4] shadow-[1px_1px_0_0_#201e1d]'
              }`}
            >
              ⚡ Proficient ({statsSummary.proficientTopicsCount || 0})
            </button>
            <button
              type="button"
              onClick={() => setTierFilter('novice')}
              className={`px-3 py-1.5 rounded-xl border-2 border-[#201e1d] text-xs font-bold transition-all cursor-pointer ${
                tierFilter === 'novice'
                  ? 'bg-[#FB7185] text-white font-heading shadow-[2px_2px_0_0_#201e1d]'
                  : 'bg-[#fff2eb] text-orange-950 hover:bg-[#FECDD3] shadow-[1px_1px_0_0_#201e1d]'
              }`}
            >
              🌱 Novice ({statsSummary.noviceTopicsCount || 0})
            </button>
          </div>
        </div>

        {/* Topics List Grid */}
        <div className="mt-5">
          {filteredTopics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTopics.map((topic) => {
                const badge = getMasteryBadge(topic.masteryPct);
                return (
                  <div
                    key={topic.topicId}
                    className="bg-[#f9f4ed] hover:bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between transition-all"
                  >
                    <div>
                      {/* Topic Header Row */}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-heading text-base sm:text-lg text-[#201e1d] leading-snug">
                          {topic.topicName}
                        </h4>
                        <span
                          className={`text-xs font-black px-2.5 py-0.5 rounded-full shrink-0 border border-[#201e1d] ${badge.chipClass}`}
                        >
                          {badge.icon} {badge.label} · {topic.masteryPct}%
                        </span>
                      </div>

                      {/* Tactile Progress Bar */}
                      <div className="mt-3">
                        <div className="w-full bg-white h-3.5 rounded-full border-2 border-[#201e1d] overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              topic.tier === 'master'
                                ? 'bg-amber-400'
                                : topic.tier === 'proficient'
                                  ? 'bg-[#14B8A6]'
                                  : 'bg-[#FB7185]'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, topic.masteryPct))}%` }}
                          />
                        </div>
                      </div>

                      {/* Detail Metrics Chips */}
                      <div className="mt-3 flex items-center gap-1.5 flex-wrap text-xs font-bold text-neutral-600">
                        <span className="bg-white border border-[#201e1d] rounded-lg px-2 py-0.5 text-[#201e1d]">
                          {topic.firstTryCorrectCount} / {topic.totalQuestions} 1st-try correct
                        </span>
                        {topic.reviewMistakeCount > 0 && (
                          <span className="bg-[#FECDD3] text-rose-950 border border-[#201e1d] rounded-lg px-2 py-0.5 font-bold">
                            🔥 {topic.reviewMistakeCount} to review
                          </span>
                        )}
                        {topic.bookmarkedCount > 0 && (
                          <span className="bg-[#FEF08A] text-amber-950 border border-[#201e1d] rounded-lg px-2 py-0.5 font-bold">
                            ⭐ {topic.bookmarkedCount} saved
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Practice Topic CTA Button */}
                    <div className="mt-4 pt-3.5 border-t-2 border-neutral-200/80 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => onDrillTopic(topic.topicId)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-heading rounded-xl bg-[#FFDE59] hover:bg-[#FACC15] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-[#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
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
            <div className="text-center py-10 bg-[#f9f4ed] rounded-2xl border-2 border-dashed border-[#201e1d] p-6 shadow-[2px_2px_0_0_#201e1d]">
              <span className="text-3xl">🔍</span>
              <p className="font-heading text-base text-[#201e1d] mt-2">No topics match your filters</p>
              <p className="text-xs font-bold text-neutral-500 mt-1">
                Try searching for another keyword or reset your tier filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setTierFilter('all');
                }}
                className="mt-3 px-3.5 py-1.5 text-xs font-heading rounded-xl bg-[#FFFDF7] hover:bg-neutral-100 text-[#201e1d] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] cursor-pointer"
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

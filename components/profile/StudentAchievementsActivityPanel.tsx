'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  StudentStatsSummary,
  CompletedRoundRecord,
  calculateStudentRank,
  evaluateStudentAchievements,
} from '@/lib/studentProfile';
import { listOnlineAssignments } from '@/lib/testCompiler';
import { OnlineQuizAssignment } from '@/types/testCompiler';

export interface StudentAchievementsActivityPanelProps {
  userXp: number;
  currentStreak: number;
  statsSummary: StudentStatsSummary;
  roundHistory: CompletedRoundRecord[];
  onStartPractice: () => void;
}

export function StudentAchievementsActivityPanel({
  userXp,
  currentStreak,
  statsSummary,
  roundHistory,
  onStartPractice,
}: StudentAchievementsActivityPanelProps): React.ReactElement {
  // 1. Declare ALL React hooks unconditionally at the top (React Error #310 Defense)
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAllRounds, setShowAllRounds] = useState<boolean>(false);
  const [onlineAssignments, setOnlineAssignments] = useState<OnlineQuizAssignment[]>([]);

  // Load online assignments safely on client
  useEffect(() => {
    try {
      setOnlineAssignments(listOnlineAssignments());
    } catch (err) {
      console.warn('Failed to load online assignments:', err);
    }
  }, []);

  // Compute student rank progression
  const rankInfo = useMemo(() => {
    return calculateStudentRank(userXp);
  }, [userXp]);

  // Compute achievements
  const achievements = useMemo(() => {
    const perfectRoundsCount = (roundHistory || []).filter(
      (r) => r.totalQuestions > 0 && r.accuracyPct === 100
    ).length;

    return evaluateStudentAchievements({
      totalXp: userXp,
      currentStreak,
      firstTryCorrectCount: statsSummary.totalFirstTryCorrect,
      reviewPileCount: statsSummary.reviewPileQuestionCount,
      bookmarkedCount: statsSummary.bookmarkedQuestionCount,
      roundsCompleted: statsSummary.roundsCompleted,
      perfectRoundsCount,
      masteredTopicsCount: statsSummary.masteredTopicsCount,
    });
  }, [userXp, currentStreak, statsSummary, roundHistory]);

  // Filter achievements by category
  const filteredAchievements = useMemo(() => {
    if (selectedCategory === 'all') return achievements;
    return achievements.filter((a) => a.category === selectedCategory);
  }, [achievements, selectedCategory]);

  const unlockedCount = useMemo(() => {
    return achievements.filter((a) => a.unlocked).length;
  }, [achievements]);

  // Sliced round history
  const displayedRounds = useMemo(() => {
    if (showAllRounds) return roundHistory || [];
    return (roundHistory || []).slice(0, 5);
  }, [roundHistory, showAllRounds]);

  // 7-Rank milestone ladder metadata
  const RANK_LADDER = [
    { level: 1, title: 'Revision Rookie', badge: '🌱', minXp: 0 },
    { level: 2, title: 'Syllabus Explorer', badge: '🧭', minXp: 250 },
    { level: 3, title: 'Concept Builder', badge: '🧱', minXp: 600 },
    { level: 4, title: 'Distractor Hunter', badge: '🎯', minXp: 1200 },
    { level: 5, title: 'Exam Strategist', badge: '⚡', minXp: 2200 },
    { level: 6, title: 'Cambridge Scholar', badge: '📜', minXp: 3500 },
    { level: 7, title: 'Master of Revision', badge: '👑', minXp: 5000 },
  ];

  const formatTimestamp = (timestamp: number): string => {
    if (!timestamp) return 'Recent';
    const date = new Date(timestamp);
    const now = Date.now();
    const diffHours = Math.floor((now - timestamp) / (1000 * 60 * 60));

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. XP LEVEL & RANK PROGRESSION BANNER */}
      <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b-2 border-[#201e1d]/10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#FEF08A] border-2 border-[#201e1d] flex items-center justify-center text-3xl shadow-[3px_3px_0_0_#201e1d] shrink-0">
              {rankInfo.badgeEmoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-[#201e1d] text-white rounded-lg px-2.5 py-0.5 shadow-[1px_1px_0_0_#201e1d]">
                  Level {rankInfo.level}
                </span>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-wide">Rank Progression</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-heading font-black text-[#201e1d] mt-1 tracking-tight">
                {rankInfo.title}
              </h2>
            </div>
          </div>

          <div className="text-left md:text-right bg-[#EEF2FF] border-2 border-[#201e1d] rounded-2xl px-4 py-2.5 shadow-[2px_2px_0_0_#201e1d] self-start md:self-auto">
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900/70 block">
              Total Experience
            </span>
            <div className="text-2xl sm:text-3xl font-heading font-black text-indigo-700 tracking-tight">
              +{userXp.toLocaleString()} XP
            </div>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-black text-neutral-700 mb-2">
            <span>
              {rankInfo.level < 7 ? (
                <>
                  <span className="font-heading text-sm text-[#201e1d]">
                    {(userXp - rankInfo.currentLevelMinXp).toLocaleString()}
                  </span>{' '}
                  / {(rankInfo.nextLevelXp - rankInfo.currentLevelMinXp).toLocaleString()} XP to Level {rankInfo.level + 1}
                </>
              ) : (
                <span className="font-heading text-sm text-amber-800">👑 Maximum Master Rank Achieved!</span>
              )}
            </span>
            <span className="font-heading text-sm text-[#201e1d] bg-[#FEF08A] border border-[#201e1d] rounded-md px-2 py-0.5 shadow-[1px_1px_0_0_#201e1d]">
              {rankInfo.progressPct}%
            </span>
          </div>

          <div className="w-full bg-[#E5E7EB] h-4 rounded-full border-2 border-[#201e1d] overflow-hidden p-0.5 shadow-[2px_2px_0_0_#201e1d]">
            <div
              className="bg-gradient-to-r from-indigo-500 via-amber-400 to-[#FEF08A] h-full rounded-full border-r border-[#201e1d] transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, rankInfo.progressPct))}%` }}
            />
          </div>
        </div>

        {/* Visual Milestone Strip: 7 Rank Ladder */}
        <div className="mt-6 pt-5 border-t-2 border-[#201e1d]/10">
          <div className="flex items-center justify-between mb-3.5">
            <p className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
              <span>🏅</span> 7-Tier Rank Ladder
            </p>
            <span className="text-[11px] font-bold text-neutral-400">Continuous Revision Progression</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {RANK_LADDER.map((step) => {
              const isCurrent = step.level === rankInfo.level;
              const isAchieved = step.level <= rankInfo.level;

              return (
                <div
                  key={step.level}
                  className={`p-3 rounded-2xl border-2 flex flex-col items-center text-center transition-all overflow-hidden ${
                    isCurrent
                      ? 'bg-[#FEF08A] border-[#201e1d] shadow-[3px_3px_0_0_#201e1d] -translate-y-0.5 ring-2 ring-[#201e1d]/20'
                      : isAchieved
                        ? 'bg-[#F0FDF4] border-[#201e1d] text-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                        : 'bg-[#F3F4F6]/70 border-dashed border-neutral-300 text-neutral-400 opacity-60'
                  }`}
                >
                  <span className="text-2xl mb-1 filter drop-shadow-sm">{step.badge}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                    Lvl {step.level}
                  </span>
                  <span className="text-xs font-black leading-tight mt-0.5 line-clamp-1 text-[#201e1d]">
                    {step.title}
                  </span>
                  <span className="text-[10px] font-bold mt-1 text-neutral-500">
                    {step.minXp.toLocaleString()} XP
                  </span>
                  {isCurrent && (
                    <span className="mt-1.5 text-[9px] font-black uppercase tracking-wider bg-[#201e1d] text-white rounded-md px-1.5 py-0.5 shadow-[1px_1px_0_0_#201e1d] shrink-0 whitespace-nowrap">
                      Current
                    </span>
                  )}
                  {!isCurrent && isAchieved && (
                    <span className="mt-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100 rounded-md px-1.5 py-0.5 shrink-0 whitespace-nowrap">
                      ✓ Done
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. UNLOCKABLE CAMBRIDGE ACHIEVEMENTS GRID */}
      <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-[#201e1d]/10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🏅</span>
              <h3 className="text-xl sm:text-2xl font-heading font-black text-[#201e1d]">
                Revision Achievements
              </h3>
            </div>
            <p className="text-xs sm:text-sm font-bold text-neutral-500 mt-1">
              Unlock badges as you master syllabus topics, build streaks, and maintain accuracy.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#FEF08A] border-2 border-[#201e1d] rounded-2xl px-4 py-1.5 font-heading font-black text-xs sm:text-sm text-[#201e1d] shadow-[2px_2px_0_0_#201e1d] shrink-0 whitespace-nowrap self-start sm:self-auto">
            <span>Unlocked:</span>
            <span className="text-amber-900">{unlockedCount}</span>
            <span className="text-[#201e1d]/40">/</span>
            <span>{achievements.length}</span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-black border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#201e1d] text-white border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                : 'bg-white hover:bg-[#FEF08A] text-[#201e1d] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
            }`}
          >
            All ({achievements.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('streak')}
            className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-black border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ${
              selectedCategory === 'streak'
                ? 'bg-[#FEF08A] text-[#201e1d] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                : 'bg-white hover:bg-[#FEF08A] text-[#201e1d] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
            }`}
          >
            🔥 Streaks
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('mastery')}
            className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-black border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ${
              selectedCategory === 'mastery'
                ? 'bg-[#FEF08A] text-[#201e1d] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                : 'bg-white hover:bg-[#FEF08A] text-[#201e1d] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
            }`}
          >
            👑 Mastery
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('precision')}
            className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-black border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ${
              selectedCategory === 'precision'
                ? 'bg-[#BBF7D0] text-[#166534] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                : 'bg-white hover:bg-[#BBF7D0] text-[#201e1d] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
            }`}
          >
            🎯 Precision
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('volume')}
            className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-black border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ${
              selectedCategory === 'volume'
                ? 'bg-[#C7D2FE] text-[#3730A3] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                : 'bg-white hover:bg-[#C7D2FE] text-[#201e1d] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
            }`}
          >
            🚀 Volume
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('review')}
            className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-black border-2 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ${
              selectedCategory === 'review'
                ? 'bg-[#FECDD3] text-[#9F1239] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                : 'bg-white hover:bg-[#FECDD3] text-[#201e1d] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
            }`}
          >
            📌 Review
          </button>
        </div>

        {/* Achievements Cards Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredAchievements.map((item) => {
            return (
              <div
                key={item.id}
                className={`rounded-2xl p-4 sm:p-5 border-2 flex flex-col justify-between transition-all overflow-hidden ${
                  item.unlocked
                    ? 'bg-[#FFFDF7] border-[#201e1d] shadow-[3px_3px_0_0_#201e1d] hover:-translate-y-0.5'
                    : 'bg-[#F9FAFB] border-dashed border-neutral-300 text-neutral-500 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-2xl shrink-0 ${
                        item.unlocked
                          ? 'bg-[#FEF08A] border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                          : 'bg-neutral-200 border-neutral-300 grayscale opacity-60'
                      }`}
                    >
                      {item.icon}
                    </div>

                    {item.unlocked ? (
                      <span className="shrink-0 whitespace-nowrap text-[10px] font-black uppercase tracking-wider bg-[#DCFCE7] text-[#166534] border-2 border-[#201e1d] rounded-full px-2.5 py-0.5 shadow-[1px_1px_0_0_#201e1d]">
                        ✓ Unlocked
                      </span>
                    ) : (
                      <span className="shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider bg-neutral-200 text-neutral-600 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <span>🔒</span> Locked
                      </span>
                    )}
                  </div>

                  <h4 className="font-heading font-black text-base text-[#201e1d] mt-3">
                    {item.title}
                  </h4>
                  <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-[#201e1d]/10">
                  <div className="flex items-center justify-between text-xs font-bold text-neutral-600 mb-1.5">
                    <span>Progress</span>
                    <span className="font-mono font-bold">
                      {item.progressCurrent} / {item.progressTarget}
                    </span>
                  </div>

                  <div className="w-full bg-[#E5E7EB] border border-[#201e1d] h-2.5 rounded-full overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.unlocked ? 'bg-[#22C55E]' : 'bg-neutral-400'
                      }`}
                      style={{ width: `${item.progressPct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. ASSIGNED ONLINE PAPERS SECTION */}
      <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d]">
        <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-[#201e1d]/10">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📋</span>
            <h3 className="text-xl sm:text-2xl font-heading font-black text-[#201e1d]">
              Assigned Online Papers
            </h3>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs font-black text-neutral-600 bg-[#F9F4ED] border border-[#201e1d]/20 rounded-lg px-2.5 py-1">
            Teacher Homework & Mocks
          </span>
        </div>

        {onlineAssignments && onlineAssignments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {onlineAssignments.map((assignment) => {
              return (
                <div
                  key={assignment.id}
                  className="bg-[#F9F4ED] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0_0_#201e1d] flex flex-col justify-between hover:shadow-[4px_4px_0_0_#201e1d] transition-all overflow-hidden"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="shrink-0 whitespace-nowrap text-xs font-black bg-[#201e1d] text-white px-2.5 py-0.5 rounded-lg shadow-[1px_1px_0_0_#201e1d]">
                        {assignment.subjectCode} · {assignment.subjectName}
                      </span>
                      {assignment.dueDate && (
                        <span className="shrink-0 whitespace-nowrap text-[11px] font-black text-amber-950 bg-[#FEF08A] border border-[#201e1d] px-2 py-0.5 rounded-md shadow-[1px_1px_0_0_#201e1d]">
                          Due {assignment.dueDate}
                        </span>
                      )}
                    </div>

                    <h4 className="font-heading font-black text-base text-[#201e1d] mt-1">
                      {assignment.title}
                    </h4>

                    {assignment.cohortName && (
                      <p className="text-xs font-bold text-neutral-500 mt-1">
                        Class / Cohort: {assignment.cohortName}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2.5 text-xs font-bold text-neutral-600">
                      <span>📝 {assignment.questionIds.length} Questions</span>
                      <span>·</span>
                      <span>⏱️ {assignment.durationMinutes} Minutes</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t-2 border-[#201e1d]/10">
                    <Link
                      href={`/?assignmentId=${assignment.id}`}
                      className="w-full shrink-0 whitespace-nowrap inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-black rounded-xl bg-[#FEF08A] hover:bg-[#FDE047] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-[#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                    >
                      <span>Start Assigned Paper</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#F9F4ED] rounded-2xl border-2 border-dashed border-[#201e1d]/30 p-8 text-center">
            <span className="text-3xl">📋</span>
            <p className="font-heading font-black text-base text-[#201e1d] mt-2">
              No teacher-assigned papers pending
            </p>
            <p className="text-xs sm:text-sm font-bold text-neutral-500 max-w-md mx-auto mt-1 leading-relaxed">
              When an educator publishes an online assignment or homework quiz for your class, it will appear here for you to complete.
            </p>
          </div>
        )}
      </div>

      {/* 4. RECENT QUIZ ROUND HISTORY LOG */}
      <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d]">
        <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-[#201e1d]/10">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📜</span>
            <h3 className="text-xl sm:text-2xl font-heading font-black text-[#201e1d]">
              Recent Quiz Round History
            </h3>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs font-black text-neutral-600 bg-[#F9F4ED] border border-[#201e1d]/20 rounded-lg px-2.5 py-1">
            Round Telemetry
          </span>
        </div>

        {displayedRounds && displayedRounds.length > 0 ? (
          <div className="space-y-3.5">
            {displayedRounds.map((round) => {
              const isHighScore = round.accuracyPct >= 80;
              const isMidScore = round.accuracyPct >= 50 && round.accuracyPct < 80;

              return (
                <div
                  key={round.id}
                  className="bg-[#F9F4ED] border-2 border-[#201e1d] rounded-2xl p-4 sm:p-5 shadow-[2px_2px_0_0_#201e1d] hover:shadow-[3px_3px_0_0_#201e1d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all overflow-hidden"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="shrink-0 whitespace-nowrap text-xs font-black bg-[#201e1d] text-white px-2.5 py-0.5 rounded-lg shadow-[1px_1px_0_0_#201e1d]">
                        {round.subject || 'Economics 0455'}
                      </span>
                      <span className="shrink-0 whitespace-nowrap text-xs font-black bg-[#E5E7EB] text-neutral-800 border border-[#201e1d]/30 px-2 py-0.5 rounded-lg">
                        {round.sourceLabel || round.sourceType}
                      </span>
                      {round.isTimed && (
                        <span className="shrink-0 whitespace-nowrap text-xs font-bold text-neutral-700 bg-white border border-[#201e1d]/30 px-2 py-0.5 rounded-lg">
                          ⏱️ Timed
                        </span>
                      )}
                      <span className="shrink-0 whitespace-nowrap text-xs font-bold text-neutral-400">
                        {formatTimestamp(round.completedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold text-neutral-600 mt-1.5 flex-wrap">
                      <span>{round.totalQuestions} questions</span>
                      <span>·</span>
                      <span className="text-emerald-700 font-black">{round.correctFirstTry} first-try</span>
                      {round.correctRetry > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-700 font-black">{round.correctRetry} retry</span>
                        </>
                      )}
                      {round.wrongCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-rose-700 font-black">{round.wrongCount} mistakes</span>
                        </>
                      )}
                      {round.peakStreak > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-700 font-black">🔥 Peak: {round.peakStreak}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                    <span
                      className={`shrink-0 whitespace-nowrap text-xs sm:text-sm font-heading font-black px-3 py-1.5 rounded-xl border-2 shadow-[2px_2px_0_0_#201e1d] ${
                        isHighScore
                          ? 'bg-[#BBF7D0] text-[#166534] border-[#201e1d]'
                          : isMidScore
                            ? 'bg-[#FEF08A] text-[#854D0E] border-[#201e1d]'
                            : 'bg-[#FECDD3] text-[#9F1239] border-[#201e1d]'
                      }`}
                    >
                      {round.accuracyPct}% accuracy
                    </span>

                    {round.xpEarned > 0 && (
                      <span className="shrink-0 whitespace-nowrap text-xs sm:text-sm font-heading font-black bg-[#EEF2FF] text-indigo-950 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] px-3 py-1.5 rounded-xl">
                        +{round.xpEarned} XP
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {roundHistory.length > 5 && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllRounds(!showAllRounds)}
                  className="shrink-0 whitespace-nowrap px-5 py-2.5 text-xs font-black rounded-xl bg-white hover:bg-[#FEF08A] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none text-[#201e1d] transition-all cursor-pointer"
                >
                  {showAllRounds
                    ? 'Show Fewer Rounds ▴'
                    : `Show All Completed Rounds (${roundHistory.length}) ▾`}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#F9F4ED] rounded-2xl border-2 border-dashed border-[#201e1d]/30 p-8 sm:p-10 text-center">
            <span className="text-3xl">🎯</span>
            <p className="font-heading font-black text-base text-[#201e1d] mt-2">No Completed Quiz Rounds Yet</p>
            <p className="text-xs sm:text-sm font-bold text-neutral-500 max-w-md mx-auto mt-1 leading-relaxed">
              Complete your first revision round to start logging accuracy telemetry, XP milestones, and personal streaks!
            </p>
            <button
              type="button"
              onClick={onStartPractice}
              className="shrink-0 whitespace-nowrap mt-4 px-6 py-2.5 text-xs font-heading font-black rounded-xl bg-[#FEF08A] hover:bg-[#FDE047] border-2 border-[#201e1d] shadow-[3px_3px_0_0_#201e1d] text-[#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer inline-flex items-center gap-2"
            >
              <span>Start a Quiz Round</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
      <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-6 shadow-[3px_3px_0_0_#201e1d]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b-2 border-neutral-100">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-amber-300 border-2 border-[#201e1d] flex items-center justify-center text-3xl shadow-[2px_2px_0_0_#201e1d]">
              {rankInfo.badgeEmoji}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider bg-neutral-900 text-white rounded-md px-2 py-0.5">
                  Level {rankInfo.level}
                </span>
                <span className="text-xs font-bold text-neutral-500">Rank Progression</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#201e1d] mt-1">
                {rankInfo.title}
              </h2>
            </div>
          </div>

          <div className="text-left md:text-right">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Total Experience
            </span>
            <div className="text-2xl sm:text-3xl font-black text-indigo-600">
              +{userXp.toLocaleString()} XP
            </div>
          </div>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-600 mb-1.5">
            <span>
              {rankInfo.level < 7 ? (
                <>
                  <span className="font-black text-[#201e1d]">
                    {(userXp - rankInfo.currentLevelMinXp).toLocaleString()}
                  </span>{' '}
                  / {(rankInfo.nextLevelXp - rankInfo.currentLevelMinXp).toLocaleString()} XP to Level {rankInfo.level + 1}
                </>
              ) : (
                <span className="font-black text-amber-700">👑 Max Level Reached!</span>
              )}
            </span>
            <span className="font-black text-[#201e1d]">{rankInfo.progressPct}%</span>
          </div>

          <div className="w-full bg-neutral-100 h-3.5 rounded-full border border-[#201e1d] overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-r from-indigo-500 to-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, rankInfo.progressPct))}%` }}
            />
          </div>
        </div>

        {/* Visual Milestone Strip: 7 Rank Ladder */}
        <div className="mt-6 pt-5 border-t border-neutral-200">
          <p className="text-[11px] font-black uppercase tracking-wider text-neutral-400 mb-3">
            Rank Ladder Milestones
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {RANK_LADDER.map((step) => {
              const isCurrent = step.level === rankInfo.level;
              const isAchieved = step.level <= rankInfo.level;

              return (
                <div
                  key={step.level}
                  className={`p-2.5 rounded-xl border-2 flex flex-col items-center text-center transition-all ${
                    isCurrent
                      ? 'bg-amber-300 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                      : isAchieved
                        ? 'bg-neutral-50 border-neutral-300 text-neutral-800'
                        : 'bg-neutral-100/60 border-dashed border-neutral-300 text-neutral-400 opacity-60'
                  }`}
                >
                  <span className="text-xl mb-1">{step.badge}</span>
                  <span className="text-[10px] font-black uppercase tracking-wider">
                    Lvl {step.level}
                  </span>
                  <span className="text-xs font-black leading-tight mt-0.5 line-clamp-1">
                    {step.title}
                  </span>
                  <span className="text-[10px] font-bold mt-1 text-neutral-500">
                    {step.minXp.toLocaleString()} XP
                  </span>
                  {isCurrent && (
                    <span className="mt-1 text-[9px] font-black uppercase tracking-wider bg-[#201e1d] text-white rounded px-1.5 py-0.2">
                      Current
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. UNLOCKABLE CAMBRIDGE ACHIEVEMENTS GRID */}
      <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-6 shadow-[3px_3px_0_0_#201e1d]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-neutral-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🏅</span>
              <h3 className="text-base sm:text-lg font-black text-[#201e1d]">
                Revision Achievements
              </h3>
            </div>
            <p className="text-xs font-bold text-neutral-500 mt-0.5">
              Unlock badges as you master syllabus topics, build streaks, and maintain accuracy.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-neutral-100 border border-neutral-300 rounded-xl px-3 py-1 font-black text-xs text-[#201e1d]">
            <span>Unlocked:</span>
            <span className="text-amber-600">{unlockedCount}</span>
            <span className="text-neutral-400">/</span>
            <span>{achievements.length}</span>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="mt-4 flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-xl text-xs font-black border transition-all ${
              selectedCategory === 'all'
                ? 'bg-[#201e1d] text-white border-[#201e1d]'
                : 'bg-neutral-50 text-neutral-700 border-neutral-300 hover:border-[#201e1d]'
            }`}
          >
            All ({achievements.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('streak')}
            className={`px-3 py-1 rounded-xl text-xs font-black border transition-all ${
              selectedCategory === 'streak'
                ? 'bg-amber-400 text-amber-950 border-[#201e1d]'
                : 'bg-amber-50 text-amber-900 border-amber-300 hover:border-[#201e1d]'
            }`}
          >
            🔥 Streaks
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('mastery')}
            className={`px-3 py-1 rounded-xl text-xs font-black border transition-all ${
              selectedCategory === 'mastery'
                ? 'bg-yellow-400 text-yellow-950 border-[#201e1d]'
                : 'bg-yellow-50 text-yellow-900 border-yellow-300 hover:border-[#201e1d]'
            }`}
          >
            👑 Mastery
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('precision')}
            className={`px-3 py-1 rounded-xl text-xs font-black border transition-all ${
              selectedCategory === 'precision'
                ? 'bg-emerald-500 text-white border-[#201e1d]'
                : 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:border-[#201e1d]'
            }`}
          >
            🎯 Precision
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('volume')}
            className={`px-3 py-1 rounded-xl text-xs font-black border transition-all ${
              selectedCategory === 'volume'
                ? 'bg-indigo-500 text-white border-[#201e1d]'
                : 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:border-[#201e1d]'
            }`}
          >
            🚀 Volume
          </button>
          <button
            type="button"
            onClick={() => setSelectedCategory('review')}
            className={`px-3 py-1 rounded-xl text-xs font-black border transition-all ${
              selectedCategory === 'review'
                ? 'bg-rose-500 text-white border-[#201e1d]'
                : 'bg-rose-50 text-rose-900 border-rose-300 hover:border-[#201e1d]'
            }`}
          >
            📌 Review
          </button>
        </div>

        {/* Achievements Cards Grid */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredAchievements.map((item) => {
            return (
              <div
                key={item.id}
                className={`rounded-2xl p-4 border-2 flex flex-col justify-between transition-all ${
                  item.unlocked
                    ? 'bg-amber-50/70 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                    : 'bg-neutral-50/60 border-neutral-300 text-neutral-500'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center text-2xl ${
                        item.unlocked
                          ? 'bg-amber-300 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d]'
                          : 'bg-neutral-200 border-neutral-300 grayscale opacity-70'
                      }`}
                    >
                      {item.icon}
                    </div>

                    {item.unlocked ? (
                      <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full px-2 py-0.5">
                        ✓ Unlocked
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-neutral-200 text-neutral-600 rounded-full px-2 py-0.5 flex items-center gap-1">
                        <span>🔒</span> Locked
                      </span>
                    )}
                  </div>

                  <h4 className="font-black text-sm text-[#201e1d] mt-3">{item.title}</h4>
                  <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-neutral-200/60">
                  <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500 mb-1">
                    <span>Progress</span>
                    <span>
                      {item.progressCurrent} / {item.progressTarget}
                    </span>
                  </div>

                  <div className="w-full bg-neutral-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.unlocked ? 'bg-emerald-500' : 'bg-neutral-400'
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
      <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-6 shadow-[3px_3px_0_0_#201e1d]">
        <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-neutral-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">📋</span>
            <h3 className="text-base sm:text-lg font-black text-[#201e1d]">
              Assigned Online Papers
            </h3>
          </div>
          <span className="text-xs font-bold text-neutral-500 bg-neutral-100 border border-neutral-300 rounded-md px-2 py-0.5">
            Teacher Homework & Mocks
          </span>
        </div>

        {onlineAssignments && onlineAssignments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {onlineAssignments.map((assignment) => {
              return (
                <div
                  key={assignment.id}
                  className="bg-neutral-50 border-2 border-[#201e1d] rounded-xl p-4 shadow-[2px_2px_0_0_#201e1d] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-black bg-neutral-900 text-white px-2 py-0.5 rounded-md">
                        {assignment.subjectCode} · {assignment.subjectName}
                      </span>
                      {assignment.dueDate && (
                        <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                          Due {assignment.dueDate}
                        </span>
                      )}
                    </div>

                    <h4 className="font-black text-sm sm:text-base text-[#201e1d] mt-1">
                      {assignment.title}
                    </h4>

                    {assignment.cohortName && (
                      <p className="text-xs font-bold text-neutral-500 mt-0.5">
                        Class / Cohort: {assignment.cohortName}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2 text-xs font-bold text-neutral-600">
                      <span>📝 {assignment.questionIds.length} Questions</span>
                      <span>·</span>
                      <span>⏱️ {assignment.durationMinutes} Minutes</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-200">
                    <Link
                      href={`/?assignmentId=${assignment.id}`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-black rounded-xl bg-accent-300 hover:bg-amber-300 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-[#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
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
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-6 text-center">
            <span className="text-3xl">📋</span>
            <p className="font-black text-sm text-[#201e1d] mt-2">
              No teacher-assigned papers pending
            </p>
            <p className="text-xs font-bold text-neutral-500 max-w-md mx-auto mt-1 leading-relaxed">
              When an educator publishes an online assignment or homework quiz for your class, it will appear here for you to complete.
            </p>
          </div>
        )}
      </div>

      {/* 4. RECENT QUIZ ROUND HISTORY LOG */}
      <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-4 sm:p-6 shadow-[3px_3px_0_0_#201e1d]">
        <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-neutral-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">📜</span>
            <h3 className="text-base sm:text-lg font-black text-[#201e1d]">
              Recent Quiz Round History
            </h3>
          </div>
          <span className="text-xs font-bold text-neutral-500 bg-neutral-100 border border-neutral-300 rounded-md px-2 py-0.5">
            Round Telemetry
          </span>
        </div>

        {displayedRounds && displayedRounds.length > 0 ? (
          <div className="space-y-3">
            {displayedRounds.map((round) => {
              const isHighScore = round.accuracyPct >= 80;
              const isMidScore = round.accuracyPct >= 50 && round.accuracyPct < 80;

              return (
                <div
                  key={round.id}
                  className="bg-neutral-50 border-2 border-[#201e1d] rounded-xl p-3.5 sm:p-4 shadow-[2px_2px_0_0_#201e1d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-black bg-neutral-900 text-white px-2 py-0.5 rounded-md">
                        {round.subject || 'Economics 0455'}
                      </span>
                      <span className="text-xs font-bold bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded-md">
                        {round.sourceLabel || round.sourceType}
                      </span>
                      {round.isTimed && (
                        <span className="text-xs font-bold text-neutral-600 bg-white border border-neutral-300 px-1.5 py-0.5 rounded-md">
                          ⏱️ Timed
                        </span>
                      )}
                      <span className="text-xs font-bold text-neutral-400">
                        {formatTimestamp(round.completedAt)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold text-neutral-600 mt-1 flex-wrap">
                      <span>{round.totalQuestions} questions</span>
                      <span>·</span>
                      <span className="text-emerald-700">{round.correctFirstTry} first-try</span>
                      {round.correctRetry > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-700">{round.correctRetry} retry</span>
                        </>
                      )}
                      {round.wrongCount > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-rose-700">{round.wrongCount} mistakes</span>
                        </>
                      )}
                      {round.peakStreak > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-600">🔥 Peak: {round.peakStreak}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                    <span
                      className={`text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl border ${
                        isHighScore
                          ? 'bg-emerald-100 text-emerald-950 border-emerald-400'
                          : isMidScore
                            ? 'bg-amber-100 text-amber-950 border-amber-400'
                            : 'bg-orange-100 text-orange-950 border-orange-400'
                      }`}
                    >
                      {round.accuracyPct}% accuracy
                    </span>

                    {round.xpEarned > 0 && (
                      <span className="text-xs sm:text-sm font-black bg-indigo-100 text-indigo-900 border border-indigo-300 px-2.5 py-1 rounded-xl">
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
                  className="px-4 py-1.5 text-xs font-black rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-[#201e1d] text-neutral-800 cursor-pointer"
                >
                  {showAllRounds
                    ? 'Show Fewer Rounds ▴'
                    : `Show All Completed Rounds (${roundHistory.length}) ▾`}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-8 text-center">
            <span className="text-3xl">🎯</span>
            <p className="font-black text-sm text-[#201e1d] mt-2">No Completed Quiz Rounds Yet</p>
            <p className="text-xs font-bold text-neutral-500 max-w-md mx-auto mt-1 leading-relaxed">
              Complete your first revision round to start logging accuracy telemetry, XP milestones, and personal streaks!
            </p>
            <button
              type="button"
              onClick={onStartPractice}
              className="mt-4 px-4 py-2 text-xs font-black rounded-xl bg-accent-300 hover:bg-amber-300 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-[#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
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

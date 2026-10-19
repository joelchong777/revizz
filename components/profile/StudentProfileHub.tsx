'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Question, SyllabusTopic } from '@/lib/questions';
import { fetchQuestionsFromDb, fetchTopicsFromDb } from '@/lib/questions';
import { useAuth, setDemoStudentSession } from '@/lib/auth';
import type { UserProfile } from '@/types';
import { StudentAuthGate } from '@/components/StudentAuthGate';
import { AuthModal } from '@/components/AuthModal';
import {
  StudentProfileTab,
  StudentPreferences,
  BookmarkEntry,
  CompletedRoundRecord,
  StudentStatsSummary,
  getStudentPreferences,
  saveStudentPreferences,
  getExamCountdown,
  getBookmarkedQuestions,
  getRoundHistory,
  clearRoundHistory,
  clearBookmarkedQuestions,
  getDailyGoalProgress,
  calculateStudentRank,
  evaluateStudentAchievements,
  computeStudentStatsSummary,
  subscribeStudentProfileChanges,
} from '@/lib/studentProfile';
import { StudentSettingsPanel } from './StudentSettingsPanel';
import { StudentStatsPanel } from './StudentStatsPanel';
import { StudentReviewPanel } from './StudentReviewPanel';
import { StudentAchievementsActivityPanel } from './StudentAchievementsActivityPanel';
import { StudentHomeworkPanel } from './StudentHomeworkPanel';
import { getHomeworkAssignments, subscribeHomeworkChanges } from '@/lib/homework';
import {
  ArrowLeft,
  Zap,
  Home,
  BarChart3,
  Brain,
  Award,
  Settings,
  Sparkles,
  Flame,
  Calendar,
  Clock,
  Target,
  Bookmark,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  ChevronRight,
  BookOpen,
  Lock,
  Layers,
  ClipboardCheck,
} from 'lucide-react';

export interface StudentProfileHubProps {
  initialTab?: StudentProfileTab;
}

const TAB_CONFIG: Array<{
  key: StudentProfileTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'overview', label: 'Profile Home', shortLabel: 'Home', icon: Home },
  { key: 'homework', label: 'Assigned Homework', shortLabel: 'Homework', icon: ClipboardCheck },
  { key: 'stats', label: 'Stats & Mastery', shortLabel: 'Stats', icon: BarChart3 },
  { key: 'review', label: 'Questions to Review', shortLabel: 'Review', icon: Brain },
  { key: 'achievements', label: 'Badges & Activity', shortLabel: 'Badges', icon: Award },
  { key: 'settings', label: 'Profile Settings', shortLabel: 'Settings', icon: Settings },
];

export function StudentProfileHub({ initialTab }: StudentProfileHubProps): React.ReactElement {
  // =========================================================================
  // Unconditional React hook declarations (React Error #310 Defense)
  // Never place early returns before these hooks!
  // =========================================================================
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    userProfile,
    loading: authLoading,
    setUserProfile,
    isDemo: isDemoSession,
  } = useAuth();

  // Tab State
  const tabFromQuery = searchParams?.get('tab') as StudentProfileTab | null;
  const validTab: StudentProfileTab =
    tabFromQuery && ['overview', 'homework', 'stats', 'review', 'achievements', 'settings'].includes(tabFromQuery)
      ? tabFromQuery
      : initialTab || 'overview';

  const [activeTab, setActiveTab] = useState<StudentProfileTab>(validTab);
  const [preferences, setPreferences] = useState<StudentPreferences>(() => getStudentPreferences());
  const [roundHistory, setRoundHistory] = useState<CompletedRoundRecord[]>(() => getRoundHistory());
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(true);
  const [isAuthModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [pendingHomeworkCount, setPendingHomeworkCount] = useState<number>(0);

  // Sync tab with URL search parameter or initialTab prop changes
  useEffect(() => {
    if (tabFromQuery && ['overview', 'homework', 'stats', 'review', 'achievements', 'settings'].includes(tabFromQuery)) {
      setActiveTab(tabFromQuery);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [tabFromQuery, initialTab]);

  // Reactive subscription to homework assignments count
  useEffect(() => {
    const updateHomeworkCount = () => {
      const items = getHomeworkAssignments();
      const pending = items.filter((item) => item.status === 'pending' || item.status === 'overdue').length;
      setPendingHomeworkCount(pending);
    };
    updateHomeworkCount();
    return subscribeHomeworkChanges(updateHomeworkCount);
  }, []);

  // Reactive subscription to student profile updates across tabs and windows
  useEffect(() => {
    const unsubscribe = subscribeStudentProfileChanges(() => {
      setPreferences(getStudentPreferences());
      setRoundHistory(getRoundHistory());
    });
    return () => unsubscribe();
  }, []);

  // Fetch questions & topics from database
  useEffect(() => {
    let mounted = true;
    const loadContent = async () => {
      try {
        setLoadingQuestions(true);
        const [fetchedQuestions, fetchedTopics] = await Promise.all([
          fetchQuestionsFromDb(),
          fetchTopicsFromDb(),
        ]);
        if (mounted) {
          setQuestions(fetchedQuestions);
          setTopics(fetchedTopics);
        }
      } catch (err) {
        console.warn('Failed to fetch questions/topics for student profile:', err);
      } finally {
        if (mounted) setLoadingQuestions(false);
      }
    };

    loadContent();
    return () => {
      mounted = false;
    };
  }, [preferences.primarySubject]);

  // Compute student stats summary reactively
  const statsSummary: StudentStatsSummary = useMemo(() => {
    return computeStudentStatsSummary({
      questions: questions || [],
      topics: topics || [],
      roundHistory,
    });
  }, [questions, topics, roundHistory]);

  // Tab change handler
  const handleTabChange = (newTab: StudentProfileTab) => {
    setActiveTab(newTab);
    try {
      const params = new URLSearchParams(searchParams?.toString() || '');
      if (newTab === 'overview') {
        params.delete('tab');
      } else {
        params.set('tab', newTab);
      }
      const query = params.toString();
      const targetUrl = query ? `/profile?${query}` : '/profile';
      router.replace(targetUrl, { scroll: false });
    } catch {
      // Fallback if router replace fails
    }
  };

  // Preference update handler
  const handleUpdatePreferences = (partial: Partial<StudentPreferences>) => {
    const updated = saveStudentPreferences(partial);
    setPreferences(updated);
  };

  // Profile update handler
  const handleProfileUpdate = (partial: Partial<UserProfile>) => {
    if (!userProfile) return;
    const updated: UserProfile = { ...userProfile, ...partial };
    setUserProfile(updated);
    if (isDemoSession) {
      setDemoStudentSession(updated);
    }
  };

  // Start custom drill from review panel
  const handleStartCustomDrill = (questionIds: string[], modeLabel: string) => {
    if (!questionIds || questionIds.length === 0) return;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('revizz_custom_drill_ids', JSON.stringify(questionIds));
        window.sessionStorage.setItem('revizz_custom_drill_label', modeLabel);
      }
    } catch (e) {
      console.warn('Failed to save custom drill to sessionStorage:', e);
    }
    router.push('/?drill=custom');
  };

  const handleDataReset = () => {
    setRoundHistory(getRoundHistory());
    setPreferences(getStudentPreferences());
  };

  // =========================================================================
  // Early renders (strictly after all hooks)
  // =========================================================================
  if (authLoading) {
    return (
      <main className="w-full py-12 px-4 flex items-center justify-center select-none">
        <div className="w-full max-w-md p-8 rounded-3xl bg-[#FFFDF7] border-2 border-[#201e1d] shadow-[4px_4px_0_0_#201e1d] text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FFDE59] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-3xl animate-bounce">
            🎓
          </div>
          <h2 className="text-xl font-heading text-[#201e1d]">Loading Student Profile...</h2>
          <p className="text-xs font-bold text-neutral-600">
            Gathering Cambridge syllabus progress & mastery stats
          </p>
        </div>
      </main>
    );
  }

  if (!userProfile) {
    return (
      <main className="w-full py-12 px-4 flex items-center justify-center select-none">
        <StudentAuthGate onSuccess={() => router.refresh()} />
      </main>
    );
  }

  // =========================================================================
  // Computed Data for Overview Tab
  // =========================================================================
  const userXp = userProfile.total_xp || 0;
  const currentStreak = userProfile.current_streak || 0;
  const rank = calculateStudentRank(userXp);
  const dailyGoal = getDailyGoalProgress(roundHistory, preferences.dailyQuestionGoal);
  const examCountdown = getExamCountdown(preferences.targetExamSeries, preferences.targetExamYear);
  const reviewQueueTotal = statsSummary.reviewPileQuestionCount + statsSummary.bookmarkedQuestionCount;

  const achievements = evaluateStudentAchievements({
    totalXp: userXp,
    currentStreak: currentStreak,
    firstTryCorrectCount: statsSummary.totalFirstTryCorrect,
    reviewPileCount: statsSummary.reviewPileQuestionCount,
    bookmarkedCount: statsSummary.bookmarkedQuestionCount,
    roundsCompleted: statsSummary.roundsCompleted,
    perfectRoundsCount: roundHistory.filter((r) => r.accuracyPct === 100).length,
    masteredTopicsCount: statsSummary.masteredTopicsCount,
  });

  const previewAchievements = achievements.slice(0, 3);
  const recentRounds = roundHistory.slice(0, 3);
  const recommendedTopic = statsSummary.weakestTopics?.[0] || statsSummary.topicStats?.[0];

  return (
    <main className={`w-full ${activeTab === 'homework' ? 'max-w-4xl' : 'max-w-[560px]'} mx-auto py-3 pb-16 flex flex-col gap-4 sm:gap-5 select-none px-3 sm:px-4 transition-all duration-150`}>
      {/* Top Bar: Back to Quiz Arena + Page Title + Quick Start Practice */}
      <header className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#FFFDF7] border-2 border-[#201e1d] text-[#201e1d] hover:bg-neutral-100 font-bold text-xs shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75 shrink-0 whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 text-[#201e1d]" />
            <span>Quiz Arena</span>
          </Link>

          <h1 className="text-xl sm:text-2xl font-heading text-[#201e1d] tracking-tight flex items-center gap-2 truncate">
            <span className="w-8 h-8 rounded-xl bg-[#FFDE59] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] inline-flex items-center justify-center text-base shrink-0">
              🎓
            </span>
            <span className="truncate">Student Profile Hub</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={() => router.push('/')}
          className="w-full sm:w-auto px-4 py-2 rounded-2xl bg-[#FFDE59] hover:bg-[#FACC15] text-[#201e1d] font-heading text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
        >
          <Zap className="w-4 h-4 fill-[#201e1d] text-[#201e1d]" />
          <span>Start Practice</span>
        </button>
      </header>

      {/* Tactile 6-Tab Navigation Dock */}
      <nav
        data-testid="student-profile-tabs"
        className="grid grid-cols-3 sm:grid-cols-6 gap-1 sm:gap-1.5 p-1.5 rounded-2xl bg-[#FFFDF7] border-2 border-[#201e1d] shadow-[3px_3px_0_0_#201e1d]"
        aria-label="Student profile sections"
      >
        {TAB_CONFIG.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`relative flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl text-[11px] sm:text-xs leading-tight transition-all duration-75 cursor-pointer min-h-[48px] ${
                isActive
                  ? 'bg-[#FFDE59] text-[#201e1d] font-heading border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                  : 'bg-transparent hover:bg-neutral-200/60 text-[#201e1d] font-bold border-2 border-transparent hover:border-[#201e1d]/20 active:translate-x-0.5 active:translate-y-0.5'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#201e1d] stroke-[2.5]' : 'text-neutral-700'}`} />
              <span className="truncate max-w-full text-center">{tab.shortLabel}</span>

              {/* Badge count for Homework tab */}
              {tab.key === 'homework' && pendingHomeworkCount > 0 && (
                <span
                  className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-black border leading-tight ${
                    isActive
                      ? 'bg-[#201e1d] text-[#FFDE59] border-[#201e1d]'
                      : 'bg-[#FB7185] text-white border-[#201e1d] shadow-[1px_1px_0_0_#201e1d]'
                  }`}
                >
                  {pendingHomeworkCount}
                </span>
              )}

              {/* Badge count for Review tab */}
              {tab.key === 'review' && reviewQueueTotal > 0 && (
                <span
                  className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-black border leading-tight ${
                    isActive
                      ? 'bg-[#201e1d] text-[#FFDE59] border-[#201e1d]'
                      : 'bg-[#FB7185] text-white border-[#201e1d] shadow-[1px_1px_0_0_#201e1d]'
                  }`}
                >
                  {reviewQueueTotal}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ===================================================================
          TAB 1: Overview (Profile Home)
         =================================================================== */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-4 sm:gap-5 animate-fadeIn">
          {/* Hero Identity & XP Rank Card */}
          <section className="bg-[#FFFDF7] rounded-3xl border-2 border-[#201e1d] p-4 sm:p-5 shadow-[4px_4px_0_0_#201e1d] relative overflow-hidden">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="relative shrink-0">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#FFDE59] border-2 border-[#201e1d] flex items-center justify-center text-2xl sm:text-3xl shadow-[2px_2px_0_0_#201e1d]">
                  {preferences.avatarEmoji || '🎓'}
                </div>
                <span className="absolute -bottom-1.5 -right-1 px-1.5 py-0.2 rounded-full bg-[#201e1d] text-[#FFDE59] text-[9px] font-black tracking-wider uppercase border border-white shadow-xs">
                  Lvl {rank.level}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <h2 className="text-lg sm:text-xl font-heading text-[#201e1d] truncate">
                    {preferences.displayNameOverride || userProfile.display_name || 'Cambridge Scholar'}
                  </h2>
                  {userProfile.is_school_account ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-400 shrink-0 whitespace-nowrap">
                      🎓 School Account
                    </span>
                  ) : !isDemoSession ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 flex items-center gap-1 shrink-0 whitespace-nowrap">
                      <Sparkles className="w-3 h-3 text-indigo-600" /> Verified Student
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0 whitespace-nowrap">
                      ⚡ Guest Session
                    </span>
                  )}
                </div>

                <p className="text-xs font-bold text-neutral-600 flex items-center gap-1.5 truncate">
                  <span>{rank.badgeEmoji}</span>
                  <span className="font-heading text-[#201e1d] truncate">{rank.title}</span>
                  <span className="text-neutral-400">•</span>
                  <span className="shrink-0 whitespace-nowrap">Level {rank.level} of 7</span>
                </p>
              </div>
            </div>

            {/* Compact 3-Column Stats Strip */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="px-2 py-2 rounded-xl bg-[#fff2eb] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex flex-col items-center justify-center text-center overflow-hidden">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-950/70 truncate">Total XP</span>
                <span className="font-heading text-xs sm:text-sm text-[#201e1d] truncate mt-0.5">
                  +{userXp.toLocaleString()}
                </span>
              </div>
              <div className="px-2 py-2 rounded-xl bg-[#fff8db] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex flex-col items-center justify-center text-center overflow-hidden">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-950/70 truncate">Streak</span>
                <span className="font-heading text-xs sm:text-sm text-[#201e1d] truncate mt-0.5">
                  🔥 {currentStreak}d
                </span>
              </div>
              <div className="px-2 py-2 rounded-xl bg-[#f0fae1] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex flex-col items-center justify-center text-center overflow-hidden">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-950/70 truncate">Mastery</span>
                <span className="font-heading text-xs sm:text-sm text-[#201e1d] truncate mt-0.5">
                  {statsSummary.overallMasteryPct}%
                </span>
              </div>
            </div>

            {/* Level XP Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-600">
                <span className="font-heading text-[#201e1d]">Level {rank.level} Progress</span>
                <span className="font-bold text-[11px] sm:text-xs truncate ml-2">
                  {rank.level === 7
                    ? 'Max Level Reached! 👑'
                    : `${rank.currentXp - rank.currentLevelMinXp} / ${
                        rank.nextLevelXp - rank.currentLevelMinXp
                      } XP`}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-neutral-100 border-2 border-[#201e1d] overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-[#FFDE59] via-amber-400 to-[#F59E0B] rounded-full transition-all duration-500 shadow-inner"
                  style={{ width: `${rank.progressPct}%` }}
                />
              </div>
            </div>

            {/* Guest Session Save Progress Banner */}
            {isDemoSession && (
              <div className="mt-4 p-3.5 rounded-2xl bg-[#fff8db] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 overflow-hidden">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span className="text-xl shrink-0">⚡</span>
                  <div className="min-w-0 flex-1">
                    <span className="font-heading text-xs text-[#201e1d] block">
                      Guest Session Active
                    </span>
                    <span className="text-[11px] text-neutral-700 font-medium block leading-snug">
                      Sign in to save your XP, streaks, and mistake review pile permanently.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="w-full sm:w-auto px-3.5 py-1.5 rounded-xl bg-[#201e1d] hover:bg-neutral-800 text-white font-heading text-xs border border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FFDE59]" />
                  <span>Sign In to Save</span>
                </button>
              </div>
            )}
          </section>

          {/* Daily Goal & 7-Day Consistency Card (Full-Width Vertical Stack) */}
          <section className="bg-[#FFFDF7] rounded-3xl border-2 border-[#201e1d] p-4 sm:p-5 shadow-[4px_4px_0_0_#201e1d] overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-2xl bg-[#99F6E4] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-[#0F766E] shrink-0">
                  <Target className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-sm sm:text-base text-[#201e1d] truncate">Daily Question Target</h3>
                  <p className="text-[11px] text-neutral-500 font-medium truncate">Paced daily revision habit</p>
                </div>
              </div>
              <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] shrink-0 whitespace-nowrap">
                {dailyGoal.questionsAnsweredToday} / {dailyGoal.dailyGoal} Qs
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1 mb-4">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-600">
                <span>Today's Progress</span>
                <span className="font-heading text-[#201e1d]">{dailyGoal.progressPct}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-neutral-100 border-2 border-[#201e1d] overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${dailyGoal.progressPct}%` }}
                />
              </div>
            </div>

            {/* 7-Day Consistency Strip */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-black uppercase tracking-wider text-neutral-500">
                7-Day Consistency Strip
              </span>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {dailyGoal.activeDaysLast7.map((day) => {
                  const isToday =
                    new Date().toISOString().slice(0, 10) === day.dateStr;
                  return (
                    <div
                      key={day.dateStr}
                      title={`${day.count} questions on ${day.dayShort}`}
                      className={`py-2 px-1 rounded-xl text-center border-2 transition-all overflow-hidden ${
                        day.active
                          ? 'bg-[#BBF7D0] border-[#201e1d] text-[#15803D] font-black shadow-[2px_2px_0_0_#201e1d]'
                          : 'bg-neutral-100 border-neutral-300 text-neutral-400 font-bold'
                      } ${isToday ? 'ring-2 ring-[#201e1d] ring-offset-1' : ''}`}
                    >
                      <span className="block text-[10px] uppercase font-black tracking-tight leading-none">{day.dayShort}</span>
                      <span className="block text-[11px] font-extrabold mt-1 leading-none truncate">
                        {day.active ? '🔥' : day.count > 0 ? day.count : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {dailyGoal.isGoalMet && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-emerald-900 font-bold text-xs flex items-center gap-2 shadow-[1px_1px_0_0_#201e1d]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Daily target reached! Keep up the momentum.</span>
              </div>
            )}
          </section>

          {/* Cambridge Exam Countdown Card (Full-Width Vertical Stack) */}
          <section className="bg-[#FFFDF7] rounded-3xl border-2 border-[#201e1d] p-4 sm:p-5 shadow-[4px_4px_0_0_#201e1d] overflow-hidden">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-2xl bg-[#FECDD3] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-[#E11D48] shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-sm sm:text-base text-[#201e1d] truncate">Cambridge Countdown</h3>
                  <p className="text-[11px] text-neutral-500 font-medium truncate">Target exam pacing</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleTabChange('settings')}
                className="shrink-0 whitespace-nowrap px-2.5 py-1 rounded-xl bg-[#FFFDF7] hover:bg-neutral-100 text-[#201e1d] font-bold text-xs border-2 border-[#201e1d] shadow-[1.5px_1.5px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>Edit ✎</span>
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] mb-3 flex items-center justify-between gap-3 overflow-hidden">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">Primary Target</span>
                <span className="font-heading text-[#201e1d] text-sm sm:text-base block truncate">
                  {preferences.primarySubject}
                </span>
                <span className="text-xs font-bold text-neutral-600 block mt-0.5 truncate">
                  {examCountdown.seriesLabel}
                </span>
              </div>

              <div className="shrink-0 text-right pl-3 border-l-2 border-[#201e1d]/15">
                <span className="text-2xl sm:text-3xl font-heading text-[#201e1d] tracking-tight block leading-none">
                  {examCountdown.daysRemaining}
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block whitespace-nowrap mt-1">
                  Days to Paper 1
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-200 flex-wrap">
              <span className="text-xs font-bold text-neutral-500 shrink-0 whitespace-nowrap">Pacing Urgency</span>
              {examCountdown.urgencyTier === 'sprint' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-100 text-rose-900 border border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] shrink-0 whitespace-nowrap">
                  🚨 Final Sprint Mode
                </span>
              ) : examCountdown.urgencyTier === 'focused' ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-900 border border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] shrink-0 whitespace-nowrap">
                  ⚡ Revision Surge
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-teal-100 text-teal-900 border border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] shrink-0 whitespace-nowrap">
                  🌱 Steady Momentum
                </span>
              )}
            </div>
          </section>

          {/* Quick Action Launchpad (Tactile Horizontal Cards Stack) */}
          <div className="flex flex-col gap-3">
            {/* Mistake Review Pile Card */}
            <div className="bg-[#FFFDF7] rounded-2xl border-2 border-[#201e1d] p-4 shadow-[3px_3px_0_0_#201e1d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-hidden">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-2xl bg-[#FECDD3] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-xl shrink-0">
                  🧠
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-heading text-sm sm:text-base text-[#201e1d] truncate">Mistake Review Pile</h4>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 border border-[#201e1d] shrink-0">
                      {statsSummary.reviewPileQuestionCount} due
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 font-medium mt-0.5 line-clamp-1">
                    Questions where you made prior errors, scheduled via Leitner SRS.
                  </p>
                </div>
              </div>

              <div className="shrink-0 sm:self-center">
                {isDemoSession ? (
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Log In to Unlock</span>
                  </button>
                ) : statsSummary.reviewPileQuestionCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => router.push('/?drill=review')}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#FFDE59] hover:bg-[#FACC15] text-[#201e1d] font-heading text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75 flex items-center justify-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <span>Drill Mistakes Now →</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTabChange('review')}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs border-2 border-[#201e1d] shadow-[1.5px_1.5px_0_0_#201e1d] transition-all cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    Review Queue Clean ✓
                  </button>
                )}
              </div>
            </div>

            {/* Bookmarked Questions Card */}
            <div className="bg-[#FFFDF7] rounded-2xl border-2 border-[#201e1d] p-4 shadow-[3px_3px_0_0_#201e1d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-hidden">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-2xl bg-[#FEF08A] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-xl shrink-0">
                  ⭐
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-heading text-sm sm:text-base text-[#201e1d] truncate">Bookmarked Questions</h4>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-[#201e1d] shrink-0">
                      {statsSummary.bookmarkedQuestionCount} saved
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 font-medium mt-0.5 line-clamp-1">
                    Hand-picked questions with your personal study notes.
                  </p>
                </div>
              </div>

              <div className="shrink-0 sm:self-center">
                <button
                  type="button"
                  onClick={() => handleTabChange('review')}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#14B8A6] hover:bg-[#0F766E] text-white font-heading text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75 flex items-center justify-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <span>Open Saved Deck →</span>
                </button>
              </div>
            </div>

            {/* Recommended Topic Focus Card */}
            <div className="bg-[#FFFDF7] rounded-2xl border-2 border-[#201e1d] p-4 shadow-[3px_3px_0_0_#201e1d] flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-hidden">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-11 h-11 rounded-2xl bg-[#C7D2FE] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-xl shrink-0">
                  🎯
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-heading text-sm sm:text-base text-[#201e1d] truncate">Recommended Topic Focus</h4>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900 border border-[#201e1d] shrink-0">
                      {recommendedTopic ? `${recommendedTopic.masteryPct}%` : 'Pending'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-neutral-700 mt-0.5 truncate">
                    {recommendedTopic?.topicName || 'Syllabus Fundamentals'}
                  </p>
                </div>
              </div>

              <div className="shrink-0 sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    if (recommendedTopic?.topicId) {
                      router.push(`/?drill=topic&topicId=${encodeURIComponent(recommendedTopic.topicId)}`);
                    } else {
                      router.push('/');
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#FFDE59] hover:bg-[#FACC15] text-[#201e1d] font-heading text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75 flex items-center justify-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <span>Practice Topic →</span>
                </button>
              </div>
            </div>
          </div>

            {/* Recent Milestones & Activity Preview */}
            <section className="bg-[#FFFDF7] rounded-3xl border-2 border-[#201e1d] p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d]">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-[#FEF08A] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-xl shrink-0">
                    <Award className="w-5 h-5 text-amber-800" />
                  </div>
                  <h3 className="font-heading text-lg sm:text-xl text-[#201e1d] truncate">Milestones & Recent Activity</h3>
                </div>

                <button
                  type="button"
                  onClick={() => handleTabChange('achievements')}
                  className="text-xs font-heading text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <span>View All Badges →</span>
                </button>
              </div>

              {/* Achievements row preview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {previewAchievements.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border-2 border-[#201e1d] flex items-center gap-3 transition-all ${
                      item.unlocked
                        ? 'bg-[#fff8db] shadow-[2px_2px_0_0_#201e1d]'
                        : 'bg-neutral-100/70 opacity-80'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#201e1d] flex items-center justify-center text-xl flex-shrink-0 shadow-[1px_1px_0_0_#201e1d]">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-heading text-xs text-[#201e1d] truncate">
                          {item.title}
                        </span>
                        {item.unlocked && (
                          <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 border border-emerald-400 px-1.5 py-0.2 rounded-full">
                            ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-600 font-medium truncate">
                        {item.description}
                      </p>
                      {!item.unlocked && (
                        <div className="w-full h-1.5 rounded-full bg-neutral-200 border border-[#201e1d]/40 mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-[#14B8A6] rounded-full"
                            style={{ width: `${item.progressPct}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent rounds mini list */}
              {recentRounds.length > 0 ? (
                <div className="space-y-2 border-t-2 border-neutral-100 pt-4">
                  <span className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-2">
                    Recent Practice Rounds
                  </span>
                  {recentRounds.map((round) => (
                    <div
                      key={round.id}
                      className="p-3 rounded-2xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-between text-xs font-bold"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-white border border-[#201e1d] text-[#201e1d] font-heading text-[11px]">
                          {round.sourceLabel || round.sourceType}
                        </span>
                        <span className="text-neutral-500 font-medium">
                          {new Date(round.completedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[#201e1d]">
                          {round.correctFirstTry}/{round.totalQuestions} ({round.accuracyPct}%)
                        </span>
                        <span className="text-indigo-700 font-heading">+{round.xpEarned} XP</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 border-t-2 border-neutral-100">
                  <p className="text-xs font-semibold text-neutral-500">
                    No completed practice rounds yet. Take your first quiz to begin tracking analytics!
                  </p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ===================================================================
            TAB: Assigned Homework
           =================================================================== */}
        {activeTab === 'homework' && (
          <div className="animate-fadeIn">
            <StudentHomeworkPanel questions={questions} />
          </div>
        )}

        {/* ===================================================================
            TAB 2: Stats & Mastery
           =================================================================== */}
        {activeTab === 'stats' && (
          <div className="animate-fadeIn">
            <StudentStatsPanel
              statsSummary={statsSummary}
              userXp={userXp}
              currentStreak={currentStreak}
              onDrillTopic={(topicId: string) => {
                router.push(`/?drill=topic&topicId=${encodeURIComponent(topicId)}`);
              }}
              onOpenReviewTab={() => handleTabChange('review')}
            />
          </div>
        )}

        {/* ===================================================================
            TAB 3: Questions to Review
           =================================================================== */}
        {activeTab === 'review' && (
          <div className="animate-fadeIn">
            <StudentReviewPanel
              questions={questions}
              topics={topics}
              isDemoSession={isDemoSession}
              onOpenAuthModal={() => setAuthModalOpen(true)}
              onStartCustomDrill={handleStartCustomDrill}
            />
          </div>
        )}

        {/* ===================================================================
            TAB 4: Badges & Activity History
           =================================================================== */}
        {activeTab === 'achievements' && (
          <div className="animate-fadeIn">
            <StudentAchievementsActivityPanel
              userXp={userXp}
              currentStreak={currentStreak}
              statsSummary={statsSummary}
              roundHistory={roundHistory}
              onStartPractice={() => router.push('/')}
            />
          </div>
        )}

        {/* ===================================================================
            TAB 5: Profile Settings
           =================================================================== */}
        {activeTab === 'settings' && (
          <div className="animate-fadeIn">
            <StudentSettingsPanel
              userProfile={userProfile}
              isDemoSession={isDemoSession}
              preferences={preferences}
              onUpdatePreferences={handleUpdatePreferences}
              onProfileUpdate={handleProfileUpdate}
              onOpenAuthModal={() => setAuthModalOpen(true)}
              onDataReset={handleDataReset}
            />
          </div>
        )}

      {/* Global Auth Modal for Guest Conversion */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode="signin"
        onSuccess={() => {
          setAuthModalOpen(false);
          router.refresh();
        }}
      />
    </main>
  );
}

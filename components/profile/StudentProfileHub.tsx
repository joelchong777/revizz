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
    tabFromQuery && ['overview', 'stats', 'review', 'achievements', 'settings'].includes(tabFromQuery)
      ? tabFromQuery
      : initialTab || 'overview';

  const [activeTab, setActiveTab] = useState<StudentProfileTab>(validTab);
  const [preferences, setPreferences] = useState<StudentPreferences>(() => getStudentPreferences());
  const [roundHistory, setRoundHistory] = useState<CompletedRoundRecord[]>(() => getRoundHistory());
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(true);
  const [isAuthModalOpen, setAuthModalOpen] = useState<boolean>(false);

  // Sync tab with URL search parameter or initialTab prop changes
  useEffect(() => {
    if (tabFromQuery && ['overview', 'stats', 'review', 'achievements', 'settings'].includes(tabFromQuery)) {
      setActiveTab(tabFromQuery);
    } else if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [tabFromQuery, initialTab]);

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
      <main className="min-h-screen bg-[#f5ead8] py-12 px-4 flex items-center justify-center select-none">
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
      <main className="min-h-screen bg-[#f5ead8] py-12 px-4 flex items-center justify-center select-none">
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
    <main className="min-h-screen bg-[#f5ead8] py-6 sm:py-10 px-3 sm:px-6 select-none">
      <div className="w-full max-w-5xl mx-auto space-y-6 sm:space-y-8">
        {/* Top Bar: Back to Quiz Arena + Page Title + Quick Start Practice */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#FFFDF7] border-2 border-[#201e1d] text-[#201e1d] hover:bg-neutral-100 font-bold text-xs sm:text-sm shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75"
            >
              <ArrowLeft className="w-4 h-4 text-[#201e1d]" />
              <span>Quiz Arena</span>
            </Link>

            <h1 className="text-2xl sm:text-3xl font-heading text-[#201e1d] tracking-tight flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-[#FFDE59] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] inline-flex items-center justify-center text-lg shrink-0">
                🎓
              </span>
              <span>Student Profile Hub</span>
            </h1>
          </div>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-[#FFDE59] hover:bg-[#FACC15] text-[#201e1d] font-heading text-xs sm:text-sm border-2 border-[#201e1d] shadow-[3px_3px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-[#201e1d] text-[#201e1d]" />
            <span>Start Practice</span>
          </button>
        </header>

        {/* Tactile 5-Tab Navigation Bar */}
        <nav
          data-testid="student-profile-tabs"
          className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-2.5 p-2 rounded-3xl bg-[#FFFDF7] border-2 border-[#201e1d] shadow-[4px_4px_0_0_#201e1d]"
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
                className={`p-3 sm:py-3.5 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-75 cursor-pointer ${
                  isActive
                    ? 'bg-[#FFDE59] text-[#201e1d] font-heading border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] scale-[1.01]'
                    : 'bg-transparent hover:bg-neutral-200/60 text-[#201e1d] font-bold border-2 border-transparent hover:border-[#201e1d]/20 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none'
                } ${tab.key === 'settings' ? 'col-span-2 sm:col-span-1' : ''}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#201e1d] stroke-[2.5]' : 'text-neutral-700'}`} />
                <span className="hidden md:inline">{tab.label}</span>
                <span className="inline md:hidden">{tab.shortLabel}</span>

                {/* Badge count for Review tab */}
                {tab.key === 'review' && reviewQueueTotal > 0 && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
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
          <div className="space-y-6 sm:space-y-8 animate-fadeIn">
            {/* Hero Identity & XP Rank Card */}
            <section className="bg-[#FFFDF7] rounded-3xl border-2 border-[#201e1d] p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d] relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[#FFDE59] border-2 border-[#201e1d] flex items-center justify-center text-3xl sm:text-4xl shadow-[3px_3px_0_0_#201e1d] flex-shrink-0">
                      {preferences.avatarEmoji || '🎓'}
                    </div>
                    <span className="absolute -bottom-2 -right-1 px-2 py-0.5 rounded-full bg-[#201e1d] text-[#FFDE59] text-[10px] font-black tracking-wider uppercase border border-white shadow-xs">
                      Lvl {rank.level}
                    </span>
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-xl sm:text-2xl font-heading text-[#201e1d]">
                        {preferences.displayNameOverride || userProfile.display_name || 'Cambridge Scholar'}
                      </h2>
                      {userProfile.is_school_account ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-400">
                          🎓 School Account
                        </span>
                      ) : !isDemoSession ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-900 border border-indigo-300 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-600" /> Verified Student
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          ⚡ Guest Session
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm font-bold text-neutral-600 flex items-center gap-1.5">
                      <span>{rank.badgeEmoji}</span>
                      <span className="font-heading text-[#201e1d]">{rank.title}</span>
                      <span className="text-neutral-400">•</span>
                      <span>Level {rank.level} of 7</span>
                    </p>
                  </div>
                </div>

                {/* Quick Stats Chips */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  <div className="px-3.5 py-2 rounded-2xl bg-[#fff2eb] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center gap-2 flex-1 md:flex-none justify-center">
                    <Zap className="w-4 h-4 text-indigo-600 fill-indigo-500" />
                    <span className="font-heading text-xs sm:text-sm text-[#201e1d]">
                      {userXp.toLocaleString()} XP
                    </span>
                  </div>
                  <div className="px-3.5 py-2 rounded-2xl bg-[#fff8db] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center gap-2 flex-1 md:flex-none justify-center">
                    <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-heading text-xs sm:text-sm text-[#201e1d]">
                      {currentStreak} Day Streak
                    </span>
                  </div>
                  <div className="px-3.5 py-2 rounded-2xl bg-[#f0fae1] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center gap-2 flex-1 md:flex-none justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-heading text-xs sm:text-sm text-[#201e1d]">
                      {statsSummary.overallMasteryPct}% Mastery
                    </span>
                  </div>
                </div>
              </div>

              {/* Level XP Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-600">
                  <span className="font-heading text-[#201e1d]">Level {rank.level} Progress</span>
                  <span className="font-bold">
                    {rank.level === 7
                      ? 'Max Level Reached! 👑'
                      : `${rank.currentXp - rank.currentLevelMinXp} / ${
                          rank.nextLevelXp - rank.currentLevelMinXp
                        } XP to Level ${rank.level + 1}`}
                  </span>
                </div>
                <div className="w-full h-4 rounded-full bg-neutral-100 border-2 border-[#201e1d] overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-[#FFDE59] via-amber-400 to-[#F59E0B] rounded-full transition-all duration-500 shadow-inner"
                    style={{ width: `${rank.progressPct}%` }}
                  />
                </div>
              </div>

              {/* Guest Session Save Progress Banner */}
              {isDemoSession && (
                <div className="mt-6 p-4 rounded-2xl bg-[#fff8db] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <span className="font-heading text-sm text-[#201e1d] block">
                        Guest Session Active
                      </span>
                      <span className="text-xs text-neutral-700 font-medium">
                        Create a free student account to sync XP, streaks, and mistake piles across devices.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#201e1d] hover:bg-neutral-800 text-white font-heading text-xs border border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#FFDE59]" />
                    <span>Sign In to Save Progress</span>
                  </button>
                </div>
              )}
            </section>

            {/* 2-Column Bento Row: Daily Goal & Consistency + Exam Countdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {/* Daily Goal & 7-Day Consistency Card */}
              <section className="bg-[#FFFDF7] rounded-3xl border-2 border-[#201e1d] p-5 sm:p-6 shadow-[4px_4px_0_0_#201e1d] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-[#99F6E4] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-[#0F766E]">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-heading text-base text-[#201e1d]">Daily Question Target</h3>
                        <p className="text-xs text-neutral-500 font-medium">Consistent daily revision habit</p>
                      </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-teal-100 text-teal-900 border border-[#201e1d] shadow-[1px_1px_0_0_#201e1d]">
                      {dailyGoal.questionsAnsweredToday} / {dailyGoal.dailyGoal} Qs
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 mb-5">
                    <div className="flex items-center justify-between text-xs font-bold text-neutral-600">
                      <span>Today's Progress</span>
                      <span className="font-heading text-[#201e1d]">{dailyGoal.progressPct}%</span>
                    </div>
                    <div className="w-full h-3.5 rounded-full bg-neutral-100 border-2 border-[#201e1d] overflow-hidden p-0.5">
                      <div
                        className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${dailyGoal.progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* 7-Day Consistency Strip */}
                  <div className="space-y-2">
                    <span className="block text-xs font-black uppercase tracking-wider text-neutral-500">
                      7-Day Consistency Strip
                    </span>
                    <div className="grid grid-cols-7 gap-1.5">
                      {dailyGoal.activeDaysLast7.map((day) => {
                        const isToday =
                          new Date().toISOString().slice(0, 10) === day.dateStr;
                        return (
                          <div
                            key={day.dateStr}
                            className={`p-2 rounded-xl text-center border-2 transition-all ${
                              day.active
                                ? 'bg-[#BBF7D0] border-[#201e1d] text-[#15803D] font-black shadow-[2px_2px_0_0_#201e1d]'
                                : 'bg-neutral-100 border-neutral-300 text-neutral-400 font-bold'
                            } ${isToday ? 'ring-2 ring-[#14B8A6] ring-offset-1' : ''}`}
                          >
                            <span className="block text-[10px] uppercase font-black">{day.dayShort}</span>
                            <span className="block text-xs font-extrabold mt-0.5">
                              {day.count > 0 ? (day.active ? `🔥 ${day.count}` : day.count) : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {dailyGoal.isGoalMet && (
                  <div className="mt-4 p-2.5 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-emerald-900 font-bold text-xs flex items-center gap-2 shadow-[1px_1px_0_0_#201e1d]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Daily target reached! Keep up the great revision habit.</span>
                  </div>
                )}
              </section>

              {/* Cambridge Exam Countdown Card */}
              <section className="bg-[#FFFDF7] rounded-3xl border-2 border-[#201e1d] p-5 sm:p-6 shadow-[4px_4px_0_0_#201e1d] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-2xl bg-[#FECDD3] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-[#E11D48]">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-heading text-base text-[#201e1d]">Cambridge Countdown</h3>
                        <p className="text-xs text-neutral-500 font-medium">Target exam series</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTabChange('settings')}
                      className="px-2.5 py-1 rounded-xl bg-[#FFFDF7] hover:bg-neutral-100 text-[#201e1d] font-bold text-xs border-2 border-[#201e1d] shadow-[1.5px_1.5px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <span>Edit ✎</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#f9f4ed] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] mb-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-neutral-500 block">Primary Target</span>
                      <span className="font-heading text-[#201e1d] text-base block">
                        {preferences.primarySubject}
                      </span>
                      <span className="text-xs font-bold text-neutral-600 block mt-0.5">
                        {examCountdown.seriesLabel}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-4xl sm:text-5xl font-heading text-[#201e1d] tracking-tight block">
                        {examCountdown.daysRemaining}
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 block">
                        Days to Paper 1
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t-2 border-neutral-100">
                  <span className="text-xs font-bold text-neutral-500">Pacing Urgency</span>
                  {examCountdown.urgencyTier === 'sprint' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-900 border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] flex items-center gap-1">
                      🚨 Final Sprint Mode
                    </span>
                  ) : examCountdown.urgencyTier === 'focused' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] flex items-center gap-1">
                      ⚡ Revision Surge
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-900 border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] flex items-center gap-1">
                      🌱 Steady Momentum
                    </span>
                  )}
                </div>
              </section>
            </div>

            {/* Quick Action Launchpad Grid (3 cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Mistake Review Pile Card */}
              <div className="bg-[#FFFDF7] rounded-3xl border-2 border-[#201e1d] p-5 sm:p-6 shadow-[4px_4px_0_0_#201e1d] flex flex-col justify-between">
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-[#FECDD3] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-xl mb-3">
                    🧠
                  </div>
                  <h4 className="font-heading text-base text-[#201e1d] mb-1">Mistake Review Pile</h4>
                  <p className="text-xs text-neutral-600 font-medium mb-3">
                    Questions where you made prior mistakes, scheduled via Leitner spaced repetition.
                  </p>
                  <div className="text-2xl font-heading text-[#201e1d] mb-4">
                    {statsSummary.reviewPileQuestionCount}{' '}
                    <span className="text-xs font-bold text-neutral-500">Questions Due</span>
                  </div>
                </div>

                {isDemoSession ? (
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="w-full py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Log In to Unlock</span>
                  </button>
                ) : statsSummary.reviewPileQuestionCount > 0 ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => router.push('/?drill=review')}
                      className="w-full py-2.5 rounded-2xl bg-[#FFDE59] hover:bg-[#FACC15] text-[#201e1d] font-heading text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>Drill Mistakes Now →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabChange('review')}
                      className="w-full py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-[#201e1d] font-bold text-xs border border-[#201e1d] transition-all cursor-pointer"
                    >
                      Inspect Queue
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTabChange('review')}
                    className="w-full py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all cursor-pointer"
                  >
                    Review Queue Clean ✓
                  </button>
                )}
              </div>

              {/* Bookmarked Questions Card */}
              <div className="bg-[#FFFDF7] rounded-3xl border-2 border-[#201e1d] p-5 sm:p-6 shadow-[4px_4px_0_0_#201e1d] flex flex-col justify-between">
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-[#FEF08A] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-xl mb-3">
                    ⭐
                  </div>
                  <h4 className="font-heading text-base text-[#201e1d] mb-1">Bookmarked Questions</h4>
                  <p className="text-xs text-neutral-600 font-medium mb-3">
                    Hand-picked questions with your personal memory notes for last-minute review.
                  </p>
                  <div className="text-2xl font-heading text-[#201e1d] mb-4">
                    {statsSummary.bookmarkedQuestionCount}{' '}
                    <span className="text-xs font-bold text-neutral-500">Starred</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTabChange('review')}
                  className="w-full py-2.5 rounded-2xl bg-[#14B8A6] hover:bg-[#0F766E] text-white font-heading text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Open Saved Deck →</span>
                </button>
              </div>

              {/* Recommended Topic Focus Card */}
              <div className="bg-[#FFFDF7] rounded-3xl border-2 border-[#201e1d] p-5 sm:p-6 shadow-[4px_4px_0_0_#201e1d] flex flex-col justify-between">
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-[#C7D2FE] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-xl mb-3">
                    🎯
                  </div>
                  <h4 className="font-heading text-base text-[#201e1d] mb-1">Recommended Topic Focus</h4>
                  <p className="text-xs text-neutral-600 font-medium mb-3">
                    Syllabus area with greatest opportunity for score improvement.
                  </p>
                  <div className="mb-4">
                    <span className="font-bold text-[#201e1d] text-sm block line-clamp-1">
                      {recommendedTopic?.topicName || 'Syllabus Fundamentals'}
                    </span>
                    <span className="text-xs font-black text-indigo-700 block mt-0.5">
                      {recommendedTopic ? `${recommendedTopic.masteryPct}% Mastery` : 'Not Started'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (recommendedTopic?.topicId) {
                      router.push(`/?drill=topic&topicId=${encodeURIComponent(recommendedTopic.topicId)}`);
                    } else {
                      router.push('/');
                    }
                  }}
                  className="w-full py-2.5 rounded-2xl bg-[#FFDE59] hover:bg-[#FACC15] text-[#201e1d] font-heading text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none duration-75 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Practice Topic →</span>
                </button>
              </div>
            </div>

            {/* Recent Milestones & Activity Preview */}
            <section className="bg-[#FFFDF7] rounded-3xl border-2 border-[#201e1d] p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d]">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#FEF08A] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-xl">
                    <Award className="w-5 h-5 text-amber-800" />
                  </div>
                  <h3 className="font-heading text-lg sm:text-xl text-[#201e1d]">Milestones & Recent Activity</h3>
                </div>

                <button
                  type="button"
                  onClick={() => handleTabChange('achievements')}
                  className="text-xs font-heading text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
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
      </div>

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

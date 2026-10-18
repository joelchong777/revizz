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
      <main className="min-h-screen bg-amber-50/60 py-12 px-4 flex items-center justify-center select-none">
        <div className="w-full max-w-md p-8 rounded-3xl bg-white border-2 border-b-4 border-slate-200 shadow-chunky text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 border-2 border-slate-800 flex items-center justify-center text-2xl animate-bounce">
            🎓
          </div>
          <h2 className="text-xl font-black text-slate-900">Loading Student Profile...</h2>
          <p className="text-xs font-semibold text-slate-500">
            Gathering Cambridge syllabus progress & mastery stats
          </p>
        </div>
      </main>
    );
  }

  if (!userProfile) {
    return (
      <main className="min-h-screen bg-amber-50/60 py-12 px-4 flex items-center justify-center select-none">
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
    <main className="min-h-screen bg-amber-50/60 py-6 sm:py-10 px-3 sm:px-6 select-none">
      <div className="w-full max-w-5xl mx-auto space-y-6 sm:space-y-8">
        {/* Top Bar: Back to Quiz Arena + Page Title + Quick Start Practice */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border-2 border-b-4 border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 font-extrabold text-xs sm:text-sm shadow-xs transition-all active:translate-y-0.5 active:border-b-2 duration-75"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
              <span>Quiz Arena</span>
            </Link>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>🎓</span>
              <span>Student Profile Hub</span>
            </h1>
          </div>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-brand-yellow hover:bg-yellow-400 text-slate-900 font-black text-xs sm:text-sm border-2 border-b-4 border-slate-900 shadow-chunky transition-all active:translate-y-0.5 active:border-b-2 active:shadow-none duration-75 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4 fill-slate-900" />
            <span>Start Practice</span>
          </button>
        </header>

        {/* Tactile 5-Tab Navigation Bar */}
        <nav
          data-testid="student-profile-tabs"
          className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 p-1.5 rounded-3xl bg-slate-200/60 border-2 border-slate-300 shadow-inner"
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
                className={`p-3 sm:py-3.5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-75 active:translate-y-0.5 active:border-b-2 active:shadow-none ${
                  isActive
                    ? 'bg-brand-yellow text-slate-900 border-2 border-b-4 border-slate-900 shadow-chunky scale-[1.02]'
                    : 'bg-white/80 hover:bg-white text-slate-700 border-2 border-b-4 border-slate-200 hover:border-slate-300'
                } ${tab.key === 'settings' ? 'col-span-2 sm:col-span-1' : ''}`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-900 stroke-[2.5]' : 'text-slate-600'}`} />
                <span className="hidden md:inline">{tab.label}</span>
                <span className="inline md:hidden">{tab.shortLabel}</span>

                {/* Badge count for Review tab */}
                {tab.key === 'review' && reviewQueueTotal > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black border ${
                      isActive
                        ? 'bg-slate-900 text-brand-yellow border-slate-900'
                        : 'bg-brand-coral text-white border-rose-700'
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
            <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 sm:p-7 shadow-chunky relative overflow-hidden">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
                <div className="flex items-center gap-4 sm:gap-5">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-amber-100 border-2 border-b-4 border-slate-800 flex items-center justify-center text-3xl sm:text-4xl shadow-chunky flex-shrink-0">
                    {preferences.avatarEmoji || '🎓'}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                        {preferences.displayNameOverride || userProfile.display_name || 'Cambridge Scholar'}
                      </h2>
                      {userProfile.is_school_account ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                          🎓 School Account
                        </span>
                      ) : !isDemoSession ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-brand-indigo/15 text-indigo-900 border border-indigo-200 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-indigo-600" /> Verified Student
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                          ⚡ Guest Session
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm font-extrabold text-slate-600 flex items-center gap-1.5">
                      <span>{rank.badgeEmoji}</span>
                      <span>Level {rank.level}</span>
                      <span className="text-slate-400">•</span>
                      <span>{rank.title}</span>
                    </p>
                  </div>
                </div>

                {/* Quick Stats Chips */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                  <div className="px-3.5 py-2 rounded-2xl bg-indigo-50 border-2 border-indigo-200 flex items-center gap-2 flex-1 md:flex-none justify-center">
                    <Zap className="w-4 h-4 text-indigo-600 fill-indigo-500" />
                    <span className="font-black text-xs sm:text-sm text-indigo-950">
                      {userXp.toLocaleString()} XP
                    </span>
                  </div>
                  <div className="px-3.5 py-2 rounded-2xl bg-amber-50 border-2 border-amber-300 flex items-center gap-2 flex-1 md:flex-none justify-center">
                    <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span className="font-black text-xs sm:text-sm text-amber-950">
                      {currentStreak} Day Streak
                    </span>
                  </div>
                  <div className="px-3.5 py-2 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex items-center gap-2 flex-1 md:flex-none justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="font-black text-xs sm:text-sm text-emerald-950">
                      {statsSummary.overallMasteryPct}% Mastery
                    </span>
                  </div>
                </div>
              </div>

              {/* Level XP Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-black text-slate-600">
                  <span>Level {rank.level} Progress</span>
                  <span>
                    {rank.level === 7
                      ? 'Max Level Reached! 👑'
                      : `${rank.currentXp - rank.currentLevelMinXp} / ${
                          rank.nextLevelXp - rank.currentLevelMinXp
                        } XP to Level ${rank.level + 1}`}
                  </span>
                </div>
                <div className="w-full h-3.5 rounded-full bg-slate-100 border-2 border-slate-300 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-brand-yellow via-amber-400 to-yellow-500 rounded-full transition-all duration-300"
                    style={{ width: `${rank.progressPct}%` }}
                  />
                </div>
              </div>

              {/* Guest Session Save Progress Banner */}
              {isDemoSession && (
                <div className="mt-6 p-4 rounded-2xl bg-amber-100/70 border-2 border-amber-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚡</span>
                    <div>
                      <span className="font-black text-sm text-amber-950 block">
                        Guest Session Active
                      </span>
                      <span className="text-xs text-amber-900 font-semibold">
                        Create a free student account to sync XP, streaks, and mistake piles across devices.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs border border-slate-950 shadow-xs transition-all active:translate-y-0.5 duration-75 flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-brand-yellow" />
                    <span>Sign In to Save Progress</span>
                  </button>
                </div>
              )}
            </section>

            {/* 2-Column Bento Row: Daily Goal & Consistency + Exam Countdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
              {/* Daily Goal & 7-Day Consistency Card */}
              <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 sm:p-6 shadow-chunky flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-teal-100 border-2 border-slate-800 flex items-center justify-center text-teal-800">
                        <Target className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">Daily Question Target</h3>
                        <p className="text-xs text-slate-500 font-semibold">Consistent daily revision</p>
                      </div>
                    </div>
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-teal-50 text-teal-900 border border-teal-200">
                      {dailyGoal.questionsAnsweredToday} / {dailyGoal.dailyGoal} Qs
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 mb-5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                      <span>Today's Progress</span>
                      <span className="font-extrabold">{dailyGoal.progressPct}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-100 border-2 border-slate-300 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${dailyGoal.progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* 7-Day Consistency Strip */}
                  <div className="space-y-2">
                    <span className="block text-xs font-black uppercase tracking-wider text-slate-500">
                      7-Day Consistency
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
                                ? 'bg-emerald-100 border-emerald-400 text-emerald-950 font-black shadow-xs'
                                : 'bg-slate-50 border-slate-200 text-slate-400 font-semibold'
                            } ${isToday ? 'ring-2 ring-brand-teal' : ''}`}
                          >
                            <span className="block text-[10px] uppercase font-black">{day.dayShort}</span>
                            <span className="block text-xs font-extrabold mt-0.5">
                              {day.count > 0 ? day.count : '—'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {dailyGoal.isGoalMet && (
                  <div className="mt-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Daily target reached! Keep up the great revision habit.</span>
                  </div>
                )}
              </section>

              {/* Cambridge Exam Countdown Card */}
              <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 sm:p-6 shadow-chunky flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-brand-coral/20 border-2 border-slate-800 flex items-center justify-center text-rose-700">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-slate-900">Cambridge Countdown</h3>
                        <p className="text-xs text-slate-500 font-semibold">Target exam series</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTabChange('settings')}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs border border-slate-300 transition-all flex items-center gap-1"
                    >
                      <span>Edit ✎</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/70 border-2 border-amber-200 mb-4 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-500 block">Primary Target</span>
                      <span className="font-extrabold text-slate-900 text-sm block">
                        {preferences.primarySubject}
                      </span>
                      <span className="text-xs font-semibold text-slate-600 block mt-0.5">
                        {examCountdown.seriesLabel}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight block">
                        {examCountdown.daysRemaining}
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                        Days to Paper 1
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <span className="text-xs font-semibold text-slate-500">Pacing Urgency</span>
                  {examCountdown.urgencyTier === 'sprint' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1">
                      🚨 Final Sprint Mode
                    </span>
                  ) : examCountdown.urgencyTier === 'focused' ? (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                      ⚡ Revision Surge
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-teal-100 text-teal-900 border border-teal-300 flex items-center gap-1">
                      🌱 Steady Momentum
                    </span>
                  )}
                </div>
              </section>
            </div>

            {/* Quick Action Launchpad Grid (3 cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Mistake Review Pile Card */}
              <div className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 shadow-chunky flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 border-2 border-slate-800 flex items-center justify-center text-xl mb-3">
                    🧠
                  </div>
                  <h4 className="font-black text-base text-slate-900 mb-1">Mistake Review Pile</h4>
                  <p className="text-xs text-slate-500 font-medium mb-3">
                    Questions where you made prior mistakes, scheduled via Leitner spaced repetition.
                  </p>
                  <div className="text-2xl font-black text-slate-900 mb-4">
                    {statsSummary.reviewPileQuestionCount}{' '}
                    <span className="text-xs font-extrabold text-slate-500">Questions Due</span>
                  </div>
                </div>

                {isDemoSession ? (
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs border-2 border-b-3 border-slate-300 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Log In to Unlock</span>
                  </button>
                ) : statsSummary.reviewPileQuestionCount > 0 ? (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => router.push('/?drill=review')}
                      className="w-full py-2.5 rounded-2xl bg-brand-yellow hover:bg-yellow-400 text-slate-900 font-black text-xs border-2 border-b-3 border-slate-900 shadow-xs transition-all active:translate-y-0.5 duration-75 flex items-center justify-center gap-1"
                    >
                      <span>Drill Mistakes Now →</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTabChange('review')}
                      className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs border border-slate-300 transition-all"
                    >
                      Inspect Queue
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleTabChange('review')}
                    className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs border-2 border-b-3 border-slate-300 transition-all"
                  >
                    Review Queue Clean ✓
                  </button>
                )}
              </div>

              {/* Bookmarked Questions Card */}
              <div className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 shadow-chunky flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 border-2 border-slate-800 flex items-center justify-center text-xl mb-3">
                    ⭐
                  </div>
                  <h4 className="font-black text-base text-slate-900 mb-1">Bookmarked Questions</h4>
                  <p className="text-xs text-slate-500 font-medium mb-3">
                    Hand-picked questions with your personal memory notes for last-minute review.
                  </p>
                  <div className="text-2xl font-black text-slate-900 mb-4">
                    {statsSummary.bookmarkedQuestionCount}{' '}
                    <span className="text-xs font-extrabold text-slate-500">Starred</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleTabChange('review')}
                  className="w-full py-2.5 rounded-2xl bg-brand-teal hover:bg-teal-600 text-white font-black text-xs border-2 border-b-3 border-teal-900 shadow-xs transition-all active:translate-y-0.5 duration-75 flex items-center justify-center gap-1"
                >
                  <span>Open Saved Deck →</span>
                </button>
              </div>

              {/* Recommended Topic Focus Card */}
              <div className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 shadow-chunky flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 border-2 border-slate-800 flex items-center justify-center text-xl mb-3">
                    🎯
                  </div>
                  <h4 className="font-black text-base text-slate-900 mb-1">Recommended Topic Focus</h4>
                  <p className="text-xs text-slate-500 font-medium mb-3">
                    Syllabus area with greatest opportunity for score improvement.
                  </p>
                  <div className="mb-4">
                    <span className="font-extrabold text-slate-900 text-sm block line-clamp-1">
                      {recommendedTopic?.topicName || 'Syllabus Fundamentals'}
                    </span>
                    <span className="text-xs font-black text-brand-indigo block mt-0.5">
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
                  className="w-full py-2.5 rounded-2xl bg-brand-yellow hover:bg-yellow-400 text-slate-900 font-black text-xs border-2 border-b-3 border-slate-900 shadow-xs transition-all active:translate-y-0.5 duration-75 flex items-center justify-center gap-1"
                >
                  <span>Practice Topic →</span>
                </button>
              </div>
            </div>

            {/* Recent Milestones & Activity Preview */}
            <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 sm:p-7 shadow-chunky">
              <div className="flex items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 border-2 border-slate-800 flex items-center justify-center text-amber-800">
                    <Award className="w-5 h-5" />
                  </div>
                  <h3 className="font-black text-lg text-slate-900">Milestones & Recent Activity</h3>
                </div>

                <button
                  type="button"
                  onClick={() => handleTabChange('achievements')}
                  className="text-xs font-black text-brand-indigo hover:text-indigo-800 flex items-center gap-1"
                >
                  <span>View All Badges →</span>
                </button>
              </div>

              {/* Achievements row preview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {previewAchievements.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border-2 flex items-center gap-3 ${
                      item.unlocked
                        ? 'bg-amber-50/70 border-amber-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200 opacity-80'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-300 flex items-center justify-center text-xl flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-black text-xs text-slate-900 truncate">
                          {item.title}
                        </span>
                        {item.unlocked && (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                            ✓ Unlocked
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium truncate">
                        {item.description}
                      </p>
                      {!item.unlocked && (
                        <div className="w-full h-1.5 rounded-full bg-slate-200 mt-1.5 overflow-hidden">
                          <div
                            className="h-full bg-brand-teal rounded-full"
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
                <div className="space-y-2 border-t border-slate-200 pt-4">
                  <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Recent Practice Rounds
                  </span>
                  {recentRounds.map((round) => (
                    <div
                      key={round.id}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-bold"
                    >
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-300 text-slate-700 font-black text-[11px]">
                          {round.sourceLabel || round.sourceType}
                        </span>
                        <span className="text-slate-500">
                          {new Date(round.completedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-800">
                          {round.correctFirstTry}/{round.totalQuestions} ({round.accuracyPct}%)
                        </span>
                        <span className="text-indigo-600 font-black">+{round.xpEarned} XP</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-500">
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

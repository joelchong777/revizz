'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useAuth, signInWithGoogle } from '@/lib/auth';
import { useSearchParams } from 'next/navigation';
import { Menu, ArrowRightLeft, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import AdminNav from '@/components/portal/AdminNav';
import AdminCMS from '@/components/portal/AdminCMS';
import AdminTools from '@/components/portal/AdminTools';
import TeacherAnalytics from '@/components/portal/TeacherAnalytics';
import TestCompilerHub from '@/components/portal/compiler/TestCompilerHub';
import { fetchWeeklyLeaderboard, LeaderboardEntry } from '@/lib/leaderboard';

const NAV_LABELS: Record<string, string> = {
  overview: 'Overview',
  roster: 'Classes & students',
  assign: 'Assign rounds',
  compiler: 'Test compiler',
  mastery: 'Mastery analytics',
  xp: 'Leaderboard & XP',
  bank: 'Question bank',
  ingestion: 'Ingestion studio (App Admin)',
  flagged: 'Flagged questions',
  editor: 'Question editor',
  school: 'School & licence',
};

const getInitials = (name?: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getTier = (xp: number) => {
  if (xp >= 1000) return '👑 Master';
  if (xp >= 300) return '⚡ Proficient';
  return '🌱 Novice';
};

function PortalContent() {
  const { userProfile, loading } = useAuth();
  const searchParams = useSearchParams();

  // Navigation & Role states
  const [role, setRole] = useState<'teacher' | 'content'>('teacher');
  const [activeNav, setActiveNav] = useState<string>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>(undefined);

  // Auth & error states
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showOAuthGuide, setShowOAuthGuide] = useState(false);
  const [copiedCallback, setCopiedCallback] = useState(false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  useEffect(() => {
    if (activeNav === 'xp') {
      let mounted = true;
      setLeaderboardLoading(true);
      fetchWeeklyLeaderboard()
        .then((entries) => {
          if (mounted) {
            setLeaderboard(entries);
            setLeaderboardLoading(false);
          }
        })
        .catch((err) => {
          console.error('Error fetching leaderboard in portal:', err);
          if (mounted) {
            setLeaderboard([]);
            setLeaderboardLoading(false);
          }
        });
      return () => {
        mounted = false;
      };
    }
  }, [activeNav]);

  // Dev override to quickly preview UI in development
  const isDev = process.env.NODE_ENV === 'development';
  const [devOverride, setDevOverride] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  // Sync with searchParams
  useEffect(() => {
    const guestParam = searchParams?.get('guest');
    const demoParam = searchParams?.get('demo');
    const modeParam = searchParams?.get('mode');
    const devParam = searchParams?.get('dev');
    if (guestParam === 'true' || demoParam === 'true' || modeParam === 'guest') {
      setGuestMode(true);
    }
    if (isDev && devParam === 'true') {
      setDevOverride(true);
    }

    const tab = searchParams?.get('tab') || searchParams?.get('nav');
    if (!tab) return;

    const normalized = tab.toLowerCase();
    if (normalized === 'admin') {
      setActiveNav('assign');
      setRole('teacher');
    } else if (normalized === 'content') {
      setActiveNav('bank');
      setRole('teacher');
    } else if (normalized === 'analytics') {
      setActiveNav('roster');
      setRole('teacher');
    } else if (['roster', 'mastery', 'overview', 'assign', 'compiler', 'xp', 'school'].includes(normalized)) {
      setActiveNav(normalized);
      setRole('teacher');
    } else if (normalized === 'ingestion' || normalized === 'importer') {
      setActiveNav('ingestion');
      setRole('teacher');
    } else if (['bank', 'flagged', 'editor'].includes(normalized)) {
      setActiveNav(normalized);
      setRole('teacher');
    }
  }, [searchParams, isDev]);

  const handleToggleRole = () => {
    // Teacher portal is dedicated to teacher workflows
    setRole('teacher');
  };

  const handleSelectNav = (tab: string) => {
    setActiveNav(tab);
    setMobileNavOpen(false);
  };

  const handleGoogleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      const rawMsg =
        err?.msg ||
        err?.message ||
        (typeof err === 'string' ? err : 'Google OAuth is not configured in Supabase');
      setAuthError(rawMsg);
    } finally {
      setIsSigningIn(false);
    }
  };

  // Auth gate
  if (loading && !(isDev && devOverride) && !guestMode) {
    return (
      <div className="min-h-screen bg-[#f5ead8] flex items-center justify-center p-6 font-body">
        <div className="max-w-md w-full bg-[#f9f4ed] rounded-[28px] p-8 border-2 border-[#201e1d] shadow-offset-4 text-center space-y-6 animate-pulse">
          <div className="text-6xl">⏳</div>
          <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight">Loading Portal</h1>
          <div className="h-3 bg-[#eee7db] rounded-full w-3/4 mx-auto"></div>
          <div className="h-3 bg-[#eee7db] rounded-full w-1/2 mx-auto"></div>
        </div>
      </div>
    );
  }

  const isEducator = guestMode || (isDev && devOverride) || (userProfile && (userProfile.role === 'teacher' || userProfile.role === 'admin'));
  const isAdmin = guestMode || (isDev && devOverride) || (userProfile?.role === 'admin');

  if (!isEducator) {
    return (
      <div className="min-h-screen bg-[#f5ead8] p-4 sm:p-6 flex flex-col items-center justify-center font-body text-[#201e1d]">
        <div className={`w-full ${authError ? 'max-w-xl' : 'max-w-lg'} bg-[#f9f4ed] rounded-[28px] p-6 sm:p-8 border-2 border-[#201e1d] shadow-offset-4 space-y-6 transition-all duration-150`}>
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
            <div className="w-14 h-14 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] shadow-offset-2 flex items-center justify-center text-2xl shrink-0">
              🎓
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#ffe1d0] border border-[#201e1d] font-mono text-[10px] font-bold uppercase tracking-wider text-[#8c491a]">
                  EDUCATOR CREDENTIAL REQUIRED
                </span>
              </div>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight mt-1">
                Cambridge Educator Command Portal
              </h1>
              <p className="text-[#645c50] font-medium text-xs sm:text-sm leading-relaxed">
                Dedicated interface for classroom analytics, assignment orchestration, and test compilation. Sign in with your institutional credentials or enter immediately in demonstration mode.
              </p>
            </div>
          </div>

          {authError && (
            <div className="w-full bg-[#fff2eb] border-2 border-[#201e1d] rounded-2xl p-5 shadow-offset-3 text-left space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] shadow-offset-2 flex items-center justify-center text-xl shrink-0">
                  ⚠️
                </div>
                <div className="space-y-1">
                  <h2 className="text-base sm:text-lg font-black text-[#201e1d] font-heading leading-snug">
                    Google Sign-In is not configured in Supabase
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-[#645c50] leading-relaxed">
                    Google OAuth credentials have not been enabled in the project dashboard yet, and you can enter immediately using Guest / Demo mode.
                  </p>
                  {typeof authError === 'string' && (
                    <div className="mt-1.5 p-1.5 px-2 bg-[#eee7db] rounded-lg border border-[#dcd3c4] font-mono text-[11px] text-[#8c491a] break-words">
                      Error: {authError}
                    </div>
                  )}
                </div>
              </div>

              {/* Big primary CTA button */}
              <button
                type="button"
                onClick={() => {
                  setGuestMode(true);
                  setDevOverride(true);
                  setAuthError(null);
                }}
                className="w-full py-3.5 px-4 bg-[#ffe1d0] text-[#201e1d] font-heading font-black text-sm sm:text-base rounded-2xl border-2 border-[#201e1d] shadow-offset-3 hover:bg-[#ffc6a5] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🎓</span> Enter as Demo Educator / Admin
              </button>

              {/* Collapsible guide */}
              <div className="pt-2 border-t-[1.5px] border-[#dcd3c4]">
                <button
                  type="button"
                  onClick={() => setShowOAuthGuide(!showOAuthGuide)}
                  className="w-full py-2 px-3 text-xs font-bold text-[#645c50] hover:text-[#201e1d] bg-[#f9f4ed] border-[1.5px] border-[#201e1d] rounded-xl flex items-center justify-between transition-colors cursor-pointer shadow-offset-2 active:translate-y-0.5"
                >
                  <span className="flex items-center gap-1.5">
                    <span>🛠️</span>
                    <span>How to enable Google OAuth</span>
                  </span>
                  {showOAuthGuide ? (
                    <ChevronUp className="w-4 h-4 text-[#201e1d]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#201e1d]" />
                  )}
                </button>

                {showOAuthGuide && (
                  <div className="mt-3 p-3.5 bg-[#f9f4ed] rounded-xl border-2 border-[#201e1d] space-y-3 font-body">
                    <div>
                      <div className="text-[11px] font-black text-[#645c50] uppercase tracking-wider mb-1">
                        Callback URL
                      </div>
                      <div className="flex items-center gap-2 p-2 rounded-xl bg-[#eee7db] border border-[#201e1d] font-mono text-[11px] text-[#201e1d]">
                        <span className="flex-1 select-all break-all">
                          https://dmvahcaxixvhgxidmkqs.supabase.co/auth/v1/callback
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof navigator !== 'undefined' && navigator.clipboard) {
                              navigator.clipboard.writeText('https://dmvahcaxixvhgxidmkqs.supabase.co/auth/v1/callback');
                              setCopiedCallback(true);
                              setTimeout(() => setCopiedCallback(false), 2000);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-[#ffe1d0] border border-[#201e1d] hover:bg-[#ffc6a5] text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer shadow-offset-2 active:translate-y-0.5"
                          title="Copy callback URL"
                        >
                          {copiedCallback ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 text-xs text-[#474238]">
                      <div className="font-bold text-[#201e1d]">Setup instructions:</div>
                      <ol className="list-decimal list-inside space-y-1 font-medium pl-1 text-[12px] leading-relaxed">
                        <li>Create Web OAuth client in Google Cloud Console</li>
                        <li>Enable Google provider in Supabase Dashboard (Authentication &gt; Providers &gt; Google)</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t-2 border-[#dcd3c4]">
            {!authError && (
              <button
                type="button"
                onClick={() => setGuestMode(true)}
                className="w-full py-3.5 bg-[#ffe1d0] text-[#201e1d] font-heading font-black text-sm rounded-2xl border-2 border-[#201e1d] shadow-offset-3 hover:bg-[#ffc6a5] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🎓</span> Enter as Guest Educator / Admin (Demo)
              </button>
            )}

            {!userProfile ? (
              <button
                type="button"
                disabled={isSigningIn}
                onClick={handleGoogleSignIn}
                className="w-full py-3 bg-[#eee7db] text-[#201e1d] font-bold text-sm rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#dcd3c4] transition-all active:translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {isSigningIn ? (
                  <>
                    <span className="inline-block animate-spin">⏳</span>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In with School Google Account</span>
                )}
              </button>
            ) : (
              <div className="p-3 bg-[#eee7db] text-[#474238] font-bold text-xs rounded-2xl border-2 border-[#201e1d] leading-relaxed text-center">
                Signed in as {userProfile.display_name} (Student account) · Contact your school administrator for educator access.
              </div>
            )}

            {isDev && (
              <button
                type="button"
                onClick={() => setDevOverride(true)}
                className="w-full py-2.5 bg-[#f0fae1] text-[#272e1b] font-bold text-xs rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#e1eecc] transition-all active:translate-y-0.5"
              >
                Preview as Teacher / Admin (Dev)
              </button>
            )}

            <Link
              href="/"
              className="block w-full py-2.5 bg-[#eee7db] text-[#474238] font-bold text-xs rounded-xl border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#dcd3c4] transition-all active:translate-y-0.5 text-center"
            >
              Return to Student Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeNav) {
      case 'overview':
      case 'roster':
        return (
          <TeacherAnalytics
            key={activeNav}
            initialView="roster"
            onNavigateToAssign={() => setActiveNav('assign')}
          />
        );
      case 'assign':
        return (
          <AdminTools
            key="assign"
            initialView="assign"
            onOpenEditor={(qid) => {
              setSelectedQuestionId(qid);
              setActiveNav('editor');
            }}
          />
        );
      case 'compiler':
        return <TestCompilerHub key="compiler" />;
      case 'mastery':
        return (
          <TeacherAnalytics
            key="mastery"
            initialView="mastery"
            onNavigateToAssign={() => setActiveNav('assign')}
          />
        );
      case 'xp':
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-[1.5px] border-[#dcd3c4]">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#201e1d] font-heading tracking-tight">
                  Leaderboard & XP Milestones 🏆
                </h1>
                <p className="text-sm font-medium text-[#645c50] mt-1">
                  Weekly study streaks, student XP rankings, and active mastery momentum.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveNav('assign')}
                  className="px-4 py-2 text-xs sm:text-sm font-bold rounded-full bg-[#ffe1d0] border-[1.5px] border-[#201e1d] text-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all active:translate-y-0.5"
                >
                  Assign Challenge Round
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNav('roster')}
                  className="px-4 py-2 text-xs sm:text-sm font-bold rounded-full bg-[#f9f4ed] border-[1.5px] border-[#201e1d] text-[#201e1d] shadow-offset-2 hover:bg-[#eee7db] transition-all active:translate-y-0.5"
                >
                  View Full Roster
                </button>
              </div>
            </div>

            {leaderboardLoading ? (
              <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-12 shadow-offset-4 text-center">
                <div className="text-3xl animate-bounce">⏳</div>
                <p className="text-sm font-bold text-[#645c50] mt-2">Loading leaderboard standings...</p>
              </div>
            ) : leaderboard.length < 3 ? (
              <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-8 sm:p-12 shadow-offset-4 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#ffe1d0] border-2 border-[#201e1d] shadow-offset-2 flex items-center justify-center text-3xl">
                  🏆
                </div>
                <div className="space-y-1">
                  <h2 className="font-heading text-xl font-black text-[#201e1d]">Leaderboard Standings</h2>
                  <p className="text-sm font-medium text-[#645c50] max-w-md mx-auto">
                    No student activity recorded on the leaderboard yet. Students will appear here as they complete rounds and earn XP!
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveNav('assign')}
                    className="px-5 py-2.5 text-xs sm:text-sm font-bold rounded-full bg-[#ffe1d0] border-[1.5px] border-[#201e1d] text-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all active:translate-y-0.5"
                  >
                    Assign Challenge Round
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Top 3 Podium Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* 1st Place */}
                  <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-5 shadow-offset-4 flex flex-col items-center text-center relative overflow-hidden order-1 sm:order-2 sm:-translate-y-2">
                    <div className="absolute top-2 right-2 text-2xl">🥇</div>
                    <div className="w-14 h-14 rounded-full border-2 border-[#201e1d] bg-[#ccdbb2] flex items-center justify-center font-black text-lg text-[#201e1d] shadow-offset-2 mb-3">
                      {getInitials(leaderboard[0].display_name)}
                    </div>
                    <span className="font-heading text-lg font-black text-[#201e1d]">
                      {leaderboard[0].display_name}
                    </span>
                    <span className="text-xs font-bold text-[#645c50] mt-0.5">
                      {(leaderboard[0].current_streak ?? 0) > 0 ? `${leaderboard[0].current_streak} Day Streak 🔥` : 'Active Streak 🔥'}
                    </span>
                    <div className="mt-3 px-3 py-1 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-xs font-black text-[#272e1b]">
                      {(leaderboard[0].total_xp || 0).toLocaleString()} XP
                    </div>
                  </div>

                  {/* 2nd Place */}
                  <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-5 shadow-offset-3 flex flex-col items-center text-center relative order-2 sm:order-1">
                    <div className="absolute top-2 right-2 text-2xl">🥈</div>
                    <div className="w-12 h-12 rounded-full border-2 border-[#201e1d] bg-[#ffe1d0] flex items-center justify-center font-black text-base text-[#201e1d] shadow-offset-2 mb-3">
                      {getInitials(leaderboard[1].display_name)}
                    </div>
                    <span className="font-heading text-base font-black text-[#201e1d]">
                      {leaderboard[1].display_name}
                    </span>
                    <span className="text-xs font-bold text-[#645c50] mt-0.5">
                      {(leaderboard[1].current_streak ?? 0) > 0 ? `${leaderboard[1].current_streak} Day Streak 🔥` : 'Active Streak 🔥'}
                    </span>
                    <div className="mt-3 px-3 py-1 rounded-full bg-[#ffe1d0] border border-[#201e1d] text-xs font-black text-[#643312]">
                      {(leaderboard[1].total_xp || 0).toLocaleString()} XP
                    </div>
                  </div>

                  {/* 3rd Place */}
                  <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-5 shadow-offset-3 flex flex-col items-center text-center relative order-3">
                    <div className="absolute top-2 right-2 text-2xl">🥉</div>
                    <div className="w-12 h-12 rounded-full border-2 border-[#201e1d] bg-[#ffe1d0] flex items-center justify-center font-black text-base text-[#201e1d] shadow-offset-2 mb-3">
                      {getInitials(leaderboard[2].display_name)}
                    </div>
                    <span className="font-heading text-base font-black text-[#201e1d]">
                      {leaderboard[2].display_name}
                    </span>
                    <span className="text-xs font-bold text-[#645c50] mt-0.5">
                      {(leaderboard[2].current_streak ?? 0) > 0 ? `${leaderboard[2].current_streak} Day Streak 🔥` : 'Active Streak 🔥'}
                    </span>
                    <div className="mt-3 px-3 py-1 rounded-full bg-[#ffe1d0] border border-[#201e1d] text-xs font-black text-[#643312]">
                      {(leaderboard[2].total_xp || 0).toLocaleString()} XP
                    </div>
                  </div>
                </div>

                {/* Cohort XP Leaderboard Table */}
                <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-5 shadow-offset-4 overflow-hidden">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b-[1.5px] border-[#dcd3c4]">
                    <h2 className="font-heading text-lg font-black text-[#201e1d]">Cohort Standings</h2>
                    <span className="text-xs font-bold text-[#645c50]">{leaderboard.length} Active Students</span>
                  </div>
                  <div className="divide-y divide-[#eee7db]">
                    {leaderboard.map((student, idx) => (
                      <div key={student.id || idx} className="py-2.5 flex items-center justify-between text-sm">
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center font-black text-xs text-[#645c50]">#{student.rank ?? idx + 1}</span>
                          <span className="font-bold text-[#201e1d]">{student.display_name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#eee7db] text-[#474238] font-medium hidden sm:inline-block">
                            {getTier(student.total_xp || 0)}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-[#645c50]">
                            {(student.current_streak ?? 0) > 0 ? `${student.current_streak}d streak` : 'Inactive'}
                          </span>
                          <span className="font-black text-[#c67139] w-16 text-right">
                            {(student.total_xp || 0).toLocaleString()} XP
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        );
      case 'bank':
        return (
          <AdminTools
            key="bank"
            initialView="bank"
            onOpenEditor={(qid) => {
              setSelectedQuestionId(qid);
              setActiveNav('editor');
            }}
          />
        );
      case 'ingestion':
      case 'importer':
        return (
          <div className="rounded-[28px] border-2 border-[#201e1d] bg-[#f9f4ed] p-8 sm:p-12 shadow-offset-4 text-center space-y-6 max-w-2xl mx-auto my-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#ccdbb2] border-2 border-[#201e1d] shadow-offset-2 flex items-center justify-center text-3xl">
              📦
            </div>
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#728157]">Relocated Tool</span>
              <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight">
                Ingestion Tools Have Moved to App Admin
              </h1>
              <p className="text-sm font-medium text-[#645c50] leading-relaxed max-w-lg mx-auto">
                Exam paper ingestion, question extraction, and staging workflows have moved to the dedicated <b>App Admin Dashboard</b>.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/admin?tab=ingestion"
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#ccdbb2] text-[#272e1b] font-black text-sm border-2 border-[#201e1d] shadow-offset-3 hover:bg-[#b8c99d] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none flex items-center justify-center gap-2"
              >
                <span>Open Ingestion in App Admin</span>
                <span>🛠️</span>
              </Link>
              <button
                type="button"
                onClick={() => setActiveNav('overview')}
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-[#f9f4ed] text-[#201e1d] font-bold text-sm border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#eee7db] transition-all active:translate-y-0.5"
              >
                Back to Teacher Overview
              </button>
            </div>
          </div>
        );
      case 'flagged':
        return <AdminCMS key="flagged" initialView="flagged" />;
      case 'editor':
        return <AdminCMS key="editor" initialView="editor" questionId={selectedQuestionId} />;
      case 'school':
        return (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-[1.5px] border-[#dcd3c4]">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-[#201e1d] font-heading tracking-tight">
                  School & Licence Management 🏫
                </h1>
                <p className="text-sm font-medium text-[#645c50] mt-1">
                  Frontier International Academy · Institutional subscription and educator team seats.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveNav('roster')}
                  className="px-4 py-2 text-xs sm:text-sm font-bold rounded-full bg-[#ffe1d0] border-[1.5px] border-[#201e1d] text-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all active:translate-y-0.5"
                >
                  Manage Roster
                </button>
              </div>
            </div>

            {/* School Licence Card */}
            <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-6 shadow-offset-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-[1.5px] border-[#dcd3c4] pb-4">
                <div>
                  <span className="text-xs font-bold tracking-wider uppercase text-[#c67139]">Active Institutional Plan</span>
                  <h2 className="text-xl font-black text-[#201e1d] font-heading mt-1">Revizz Enterprise Campus</h2>
                </div>
                <span className="px-3 py-1 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-xs font-bold text-[#272e1b] self-start sm:self-auto">
                  ● Active until June 30, 2027
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-[#eee7db] border-[1.5px] border-[#dcd3c4]">
                  <span className="text-xs font-bold text-[#645c50]">Allocated Seats</span>
                  <div className="text-2xl font-black text-[#201e1d] mt-1 font-heading">250 / 300</div>
                  <span className="text-[11px] text-[#645c50]">50 licenses remaining</span>
                </div>
                <div className="p-4 rounded-2xl bg-[#eee7db] border-[1.5px] border-[#dcd3c4]">
                  <span className="text-xs font-bold text-[#645c50]">Active Classes</span>
                  <div className="text-2xl font-black text-[#201e1d] mt-1 font-heading">12 Cohorts</div>
                  <span className="text-[11px] text-[#645c50]">IGCSE Physics & Economics</span>
                </div>
                <div className="p-4 rounded-2xl bg-[#eee7db] border-[1.5px] border-[#dcd3c4]">
                  <span className="text-xs font-bold text-[#645c50]">Teacher Seats</span>
                  <div className="text-2xl font-black text-[#201e1d] mt-1 font-heading">8 Instructors</div>
                  <span className="text-[11px] text-[#645c50]">Unlimited staff access</span>
                </div>
              </div>
            </div>

            {/* Cohort Breakdown */}
            <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-6 shadow-offset-4 space-y-4">
              <h3 className="font-heading text-lg font-black text-[#201e1d]">Registered Cohorts</h3>
              <div className="divide-y divide-[#eee7db]">
                {[
                  { name: '10A Physics (Cambridge 0625)', teacher: 'Mr. D. Patel', students: 28, sync: 'Active' },
                  { name: '10B Physics (Cambridge 0625)', teacher: 'Ms. A. Okafor', students: 26, sync: 'Active' },
                  { name: '11A Physics (Cambridge 0625)', teacher: 'Ms. A. Okafor', students: 24, sync: 'Active' },
                  { name: '10 Economics (Cambridge 0455)', teacher: 'Mr. C. Tan', students: 22, sync: 'Active' },
                ].map((c, i) => (
                  <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                    <div>
                      <div className="font-bold text-[#201e1d]">{c.name}</div>
                      <div className="text-xs text-[#645c50]">Teacher: {c.teacher} · {c.students} students</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#f0fae1] text-[#272e1b] text-xs font-bold border border-[#8fa073]">
                        {c.sync}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveNav('assign')}
                        className="px-3 py-1 text-xs font-bold rounded-full bg-[#f9f4ed] border border-[#201e1d] hover:bg-[#ffe1d0] transition-colors"
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return (
          <TeacherAnalytics
            key="default-roster"
            initialView="roster"
            onNavigateToAssign={() => setActiveNav('assign')}
          />
        );
    }
  };

  return (
    <div className="lg:grid lg:grid-cols-[232px_minmax(0,1fr)] min-h-screen bg-[#f5ead8] text-[#201e1d] font-body">
      {/* Desktop Sidebar (sticky) */}
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <AdminNav
          role={role}
          active={activeNav}
          onSelect={handleSelectNav}
          onToggleRole={handleToggleRole}
          userDisplayName={userProfile?.display_name || 'Guest Educator'}
          isAdmin={isAdmin}
        />
      </div>

      {/* Mobile slide-over drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation overlay"
          />
          {/* Drawer container */}
          <div className="fixed inset-y-0 left-0 w-[232px] max-w-[85vw] h-full shadow-2xl z-50">
            <AdminNav
              role={role}
              active={activeNav}
              onSelect={handleSelectNav}
              onToggleRole={handleToggleRole}
              onClose={() => setMobileNavOpen(false)}
              userDisplayName={userProfile?.display_name || 'Guest Educator'}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="min-w-0 flex flex-col min-h-screen">
        {/* Mobile Sticky Top Bar */}
        {/* Mobile Sticky Top Header */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#ebddc5] border-b-[1.5px] border-[#dcd3c4] px-4 py-2.5 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="p-1.5 rounded-lg bg-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-colors active:translate-y-0.5"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-[#201e1d]" />
            </button>
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-heading text-sm font-black text-[#201e1d]">
                Teacher Portal
              </span>
              <span className="text-[#645c50] text-xs font-mono">/</span>
              <span className="text-xs font-bold text-[#645c50] truncate">
                {NAV_LABELS[activeNav] || 'Overview'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <Link
                href="/admin"
                className="text-xs font-bold px-2.5 py-1 rounded-xl bg-[#ccdbb2] border-[1.5px] border-[#201e1d] text-[#201e1d] hover:bg-[#b8c99d] transition-colors flex items-center gap-1 shadow-offset-2 active:translate-y-0.5"
                title="Open App Admin"
              >
                <span>App Admin 🛠️</span>
              </Link>
            )}
          </div>
        </header>

        {/* Desktop Sticky Top Header */}
        <header className="hidden lg:flex sticky top-0 z-20 bg-[#ebddc5]/95 backdrop-blur-xs border-b-[1.5px] border-[#dcd3c4] px-8 py-3 items-center justify-between shadow-xs">
          <div className="flex items-center gap-4 min-w-0">
            {/* Clean Breadcrumb Header */}
            <div className="flex items-center gap-2">
              <span className="font-heading font-black text-lg text-[#201e1d]">
                Teacher Portal
              </span>
              <span className="text-[#645c50] font-mono text-base">/</span>
              <span className="font-heading font-bold text-base text-[#201e1d]">
                {NAV_LABELS[activeNav] || 'Overview'}
              </span>
            </div>

            {/* Telemetry Status */}
            <div className="flex items-center gap-2 pl-4 border-l border-[#201e1d]/15 text-xs font-mono text-[#645c50]">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f9f4ed] border border-[#201e1d]/20 font-bold text-[#201e1d]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Active Cohort: 10B Physics
              </span>
              <span>·</span>
              <span className="px-2.5 py-0.5 rounded-full bg-[#f9f4ed] border border-[#201e1d]/20 font-bold text-[#201e1d]">
                Syllabus: Cambridge IGCSE 2024
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ccdbb2] text-[#201e1d] font-heading font-black text-xs border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#b8c99d] transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
                title="Open App Administration Dashboard"
              >
                <span>Open App Admin 🛠️</span>
              </Link>
            )}
            <Link
              href="/"
              className="text-xs font-bold text-[#645c50] hover:text-[#201e1d] px-2 py-1 transition-colors"
            >
              Student Home ↗
            </Link>
          </div>
        </header>

        {/* Scrollable Main Content Area */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">
          {/* Notification banner if navigating to ingestion on portal */}
          {(searchParams?.get('tab') === 'ingestion' || searchParams?.get('nav') === 'ingestion' || searchParams?.get('tab') === 'importer') && activeNav !== 'ingestion' && (
            <div className="mb-6 p-3 px-4 rounded-2xl bg-[#fff2eb] border-2 border-[#201e1d] shadow-offset-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-bold text-[#201e1d]">
              <div className="flex items-center gap-2">
                <span className="text-base">📦</span>
                <span>Ingestion tools have moved to the App Admin Dashboard.</span>
              </div>
              <Link
                href="/admin?tab=ingestion"
                className="px-3 py-1 rounded-full bg-[#ccdbb2] border border-[#201e1d] hover:bg-[#b8c99d] transition-colors flex items-center gap-1 shrink-0 text-[#201e1d] font-bold"
              >
                <span>Open in App Admin 🛠️</span>
              </Link>
            </div>
          )}
          {guestMode && !userProfile && (
            <div className="space-y-4 mb-6">
              <div className="p-3 px-4 rounded-2xl bg-[#fff2eb] border-2 border-[#201e1d] shadow-offset-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-bold text-[#201e1d]">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎓</span>
                  <span>Guest Educator Mode · Full interactive preview of teaching and curriculum tools</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSigningIn}
                    onClick={handleGoogleSignIn}
                    className="px-3 py-1 rounded-full bg-[#ffe1d0] border border-[#201e1d] hover:bg-[#ffc6a5] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isSigningIn ? (
                      <>
                        <span className="inline-block animate-spin text-[10px]">⏳</span>
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>Sign In with Google</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestMode(false)}
                    className="px-3 py-1 rounded-full bg-[#eee7db] border border-[#201e1d] hover:bg-[#dcd3c4] transition-colors cursor-pointer"
                  >
                    Exit Guest
                  </button>
                </div>
              </div>

              {authError && (
                <div className="p-4 rounded-2xl bg-[#fff2eb] border-2 border-[#201e1d] shadow-offset-3 text-xs text-[#201e1d] space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="text-xl">⚠️</span>
                      <div className="space-y-1">
                        <h3 className="font-heading font-black text-sm text-[#201e1d]">
                          Google Sign-In is not configured in Supabase
                        </h3>
                        <p className="font-medium text-[#645c50] leading-relaxed">
                          Google OAuth credentials have not been enabled in the project dashboard yet. You are currently in Guest / Demo mode with full educator preview access.
                        </p>
                        {typeof authError === 'string' && (
                          <div className="mt-1 p-1 px-2 bg-[#eee7db] rounded border border-[#dcd3c4] font-mono text-[10px] text-[#8c491a] inline-block">
                            Error: {authError}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAuthError(null)}
                      className="px-2.5 py-1 rounded-lg bg-[#eee7db] border border-[#201e1d] hover:bg-[#dcd3c4] text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      Dismiss
                    </button>
                  </div>

                  <div className="pt-2 border-t-[1.5px] border-[#dcd3c4]">
                    <button
                      type="button"
                      onClick={() => setShowOAuthGuide(!showOAuthGuide)}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#645c50] hover:text-[#201e1d] cursor-pointer"
                    >
                      <span>🛠️ How to enable Google OAuth</span>
                      {showOAuthGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showOAuthGuide && (
                      <div className="mt-2.5 p-3 bg-[#f9f4ed] rounded-xl border-2 border-[#201e1d] space-y-2">
                        <div>
                          <div className="text-[10px] font-black text-[#645c50] uppercase tracking-wider mb-1">
                            Callback URL
                          </div>
                          <div className="flex items-center gap-2 p-1.5 rounded-lg bg-[#eee7db] border border-[#dcd3c4] font-mono text-[11px]">
                            <span className="flex-1 select-all break-all">
                              https://dmvahcaxixvhgxidmkqs.supabase.co/auth/v1/callback
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                                  navigator.clipboard.writeText('https://dmvahcaxixvhgxidmkqs.supabase.co/auth/v1/callback');
                                  setCopiedCallback(true);
                                  setTimeout(() => setCopiedCallback(false), 2000);
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-[#ffe1d0] border border-[#201e1d] text-[10px] font-bold hover:bg-[#ffc6a5] cursor-pointer shadow-offset-2 active:translate-y-0.5"
                            >
                              {copiedCallback ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                        <ol className="list-decimal list-inside space-y-0.5 text-[#474238] font-medium text-[11px]">
                          <li>Create Web OAuth client in Google Cloud Console</li>
                          <li>Enable Google provider in Supabase Dashboard (Authentication &gt; Providers &gt; Google)</li>
                        </ol>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default function PortalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f5ead8] flex items-center justify-center p-6 font-body">
          <div className="max-w-md w-full bg-[#f9f4ed] rounded-[28px] p-8 border-2 border-[#201e1d] shadow-offset-4 text-center space-y-6 animate-pulse">
            <div className="text-6xl">⏳</div>
            <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight">Loading Portal</h1>
            <div className="h-3 bg-[#eee7db] rounded-full w-3/4 mx-auto"></div>
            <div className="h-3 bg-[#eee7db] rounded-full w-1/2 mx-auto"></div>
          </div>
        </div>
      }
    >
      <PortalContent />
    </Suspense>
  );
}

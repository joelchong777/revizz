'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useAuth, signInWithGoogle } from '@/lib/auth';
import { useSearchParams } from 'next/navigation';
import { Menu, ArrowRightLeft } from 'lucide-react';
import AdminNav from '@/components/portal/AdminNav';
import AdminCMS from '@/components/portal/AdminCMS';
import AdminTools from '@/components/portal/AdminTools';
import TeacherAnalytics from '@/components/portal/TeacherAnalytics';

const NAV_LABELS: Record<string, string> = {
  overview: 'Overview',
  roster: 'Classes & students',
  assign: 'Assign rounds',
  mastery: 'Mastery analytics',
  xp: 'Leaderboard & XP',
  bank: 'Question bank',
  flagged: 'Flagged questions',
  editor: 'Question editor',
  school: 'School & licence',
};

function PortalContent() {
  const { userProfile, loading } = useAuth();
  const searchParams = useSearchParams();

  // Navigation & Role states
  const [role, setRole] = useState<'teacher' | 'content'>('teacher');
  const [activeNav, setActiveNav] = useState<string>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | undefined>(undefined);

  // Dev override to quickly preview UI in development
  const isDev = process.env.NODE_ENV === 'development';
  const [devOverride, setDevOverride] = useState(isDev);

  // Sync with searchParams
  useEffect(() => {
    const tab = searchParams?.get('tab') || searchParams?.get('nav');
    if (!tab) return;

    const normalized = tab.toLowerCase();
    if (normalized === 'admin') {
      setActiveNav('assign');
      setRole('teacher');
    } else if (normalized === 'content') {
      setActiveNav('bank');
      setRole('content');
    } else if (normalized === 'analytics') {
      setActiveNav('roster');
      setRole('teacher');
    } else if (['roster', 'mastery', 'overview', 'assign', 'xp', 'school'].includes(normalized)) {
      setActiveNav(normalized);
      setRole('teacher');
    } else if (['bank', 'flagged', 'editor'].includes(normalized)) {
      setActiveNav(normalized);
    }
  }, [searchParams]);

  const handleToggleRole = () => {
    setRole((prev) => {
      const nextRole = prev === 'teacher' ? 'content' : 'teacher';
      if (nextRole === 'content' && !['bank', 'flagged', 'editor'].includes(activeNav)) {
        setActiveNav('bank');
      }
      return nextRole;
    });
  };

  const handleSelectNav = (tab: string) => {
    setActiveNav(tab);
    setMobileNavOpen(false);
  };

  // Auth gate
  if (loading && !devOverride) {
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

  const isEducator = devOverride || (userProfile && (userProfile.role === 'teacher' || userProfile.role === 'admin'));

  if (!isEducator) {
    return (
      <div className="min-h-screen bg-[#f5ead8] p-6 flex flex-col items-center justify-center font-body text-[#201e1d]">
        <div className="max-w-md w-full bg-[#f9f4ed] rounded-[28px] p-8 border-2 border-[#201e1d] shadow-offset-4 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#ffe1d0] border-2 border-[#201e1d] shadow-offset-2 flex items-center justify-center text-3xl">
            🎓
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-[#201e1d] font-heading tracking-tight">Educator Access Only</h1>
            <p className="text-[#645c50] font-medium text-sm">
              This area is restricted to teachers and administrators. Please sign in with your school account.
            </p>
          </div>

          <div className="space-y-3 pt-4 border-t-2 border-[#dcd3c4]">
            {!userProfile ? (
              <button
                onClick={() => signInWithGoogle()}
                className="w-full py-3 bg-[#ffe1d0] text-[#201e1d] font-bold rounded-full border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all active:translate-y-0.5"
              >
                Sign In with Google
              </button>
            ) : null}

            <button
              onClick={() => setDevOverride(true)}
              className="w-full py-3 bg-[#f0fae1] text-[#272e1b] font-bold rounded-full border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#e1eecc] transition-all active:translate-y-0.5"
            >
              Preview as Teacher / Admin (Dev)
            </button>

            <Link
              href="/"
              className="block w-full py-3 bg-[#eee7db] text-[#474238] font-bold rounded-full border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#dcd3c4] transition-all active:translate-y-0.5 text-center"
            >
              Return to Home
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
                  Weekly study streaks, student XP rankings, and active mastery momentum for 10B Physics.
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

            {/* Top 3 Podium Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 1st Place */}
              <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-5 shadow-offset-4 flex flex-col items-center text-center relative overflow-hidden order-1 sm:order-2 sm:-translate-y-2">
                <div className="absolute top-2 right-2 text-2xl">🥇</div>
                <div className="w-14 h-14 rounded-full border-2 border-[#201e1d] bg-[#ccdbb2] flex items-center justify-center font-black text-lg text-[#201e1d] shadow-offset-2 mb-3">
                  PS
                </div>
                <span className="font-heading text-lg font-black text-[#201e1d]">Priya S.</span>
                <span className="text-xs font-bold text-[#645c50] mt-0.5">12 Day Streak 🔥</span>
                <div className="mt-3 px-3 py-1 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-xs font-black text-[#272e1b]">
                  1,280 XP
                </div>
              </div>

              {/* 2nd Place */}
              <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-5 shadow-offset-3 flex flex-col items-center text-center relative order-2 sm:order-1">
                <div className="absolute top-2 right-2 text-2xl">🥈</div>
                <div className="w-12 h-12 rounded-full border-2 border-[#201e1d] bg-[#ffe1d0] flex items-center justify-center font-black text-base text-[#201e1d] shadow-offset-2 mb-3">
                  OK
                </div>
                <span className="font-heading text-base font-black text-[#201e1d]">Omar K.</span>
                <span className="text-xs font-bold text-[#645c50] mt-0.5">7 Day Streak 🔥</span>
                <div className="mt-3 px-3 py-1 rounded-full bg-[#ffe1d0] border border-[#201e1d] text-xs font-black text-[#643312]">
                  1,105 XP
                </div>
              </div>

              {/* 3rd Place */}
              <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-5 shadow-offset-3 flex flex-col items-center text-center relative order-3">
                <div className="absolute top-2 right-2 text-2xl">🥉</div>
                <div className="w-12 h-12 rounded-full border-2 border-[#201e1d] bg-[#ffe1d0] flex items-center justify-center font-black text-base text-[#201e1d] shadow-offset-2 mb-3">
                  ML
                </div>
                <span className="font-heading text-base font-black text-[#201e1d]">Mei L.</span>
                <span className="text-xs font-bold text-[#645c50] mt-0.5">3 Day Streak 🔥</span>
                <div className="mt-3 px-3 py-1 rounded-full bg-[#ffe1d0] border border-[#201e1d] text-xs font-black text-[#643312]">
                  960 XP
                </div>
              </div>
            </div>

            {/* Cohort XP Leaderboard Table */}
            <div className="rounded-[24px] border-2 border-[#201e1d] bg-[#f9f4ed] p-5 shadow-offset-4 overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-3 border-b-[1.5px] border-[#dcd3c4]">
                <h2 className="font-heading text-lg font-black text-[#201e1d]">Cohort Standings</h2>
                <span className="text-xs font-bold text-[#645c50]">Class 10B · 8 Active Students</span>
              </div>
              <div className="divide-y divide-[#eee7db]">
                {[
                  { rank: 1, name: 'Priya S.', xp: 1280, streak: 12, acc: '86%', tier: '👑 Master' },
                  { rank: 2, name: 'Omar K.', xp: 1105, streak: 7, acc: '79%', tier: '⚡ Proficient' },
                  { rank: 3, name: 'Mei L.', xp: 960, streak: 3, acc: '72%', tier: '⚡ Proficient' },
                  { rank: 4, name: 'Hana O.', xp: 610, streak: 5, acc: '70%', tier: '⚡ Proficient' },
                  { rank: 5, name: 'Alex M.', xp: 340, streak: 4, acc: '66%', tier: '⚡ Proficient' },
                  { rank: 6, name: 'Jonah R.', xp: 310, streak: 0, acc: '44%', tier: '🌱 Novice' },
                  { rank: 7, name: 'Sara A.', xp: 285, streak: 0, acc: '51%', tier: '⚡ Proficient' },
                  { rank: 8, name: 'Leo T.', xp: 240, streak: 1, acc: '48%', tier: '🌱 Novice' },
                ].map((student) => (
                  <div key={student.rank} className="py-2.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center font-black text-xs text-[#645c50]">#{student.rank}</span>
                      <span className="font-bold text-[#201e1d]">{student.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#eee7db] text-[#474238] font-medium hidden sm:inline-block">
                        {student.tier}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-[#645c50]">{student.streak > 0 ? `${student.streak}d streak` : 'Inactive'}</span>
                      <span className="text-xs font-bold text-[#201e1d]">{student.acc}</span>
                      <span className="font-black text-[#c67139] w-16 text-right">{student.xp} XP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
          userDisplayName={userProfile?.display_name}
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
              userDisplayName={userProfile?.display_name}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="min-w-0 flex flex-col min-h-screen">
        {/* Mobile Sticky Top Bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#ebddc5] border-b-[1.5px] border-[#dcd3c4] px-4 py-2.5 flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="p-1.5 rounded-lg bg-[#f9f4ed] border-[1.5px] border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-colors active:translate-y-0.5"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 text-[#201e1d]" />
            </button>
            <Link
              href="/"
              className="font-heading text-lg font-black tracking-wide text-[#201e1d] hover:opacity-80 transition-opacity shrink-0"
            >
              REVIZZ
            </Link>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#f9f4ed] border-[1.5px] border-[#201e1d] text-[#201e1d] shadow-offset-2 truncate max-w-[120px] sm:max-w-none">
              {NAV_LABELS[activeNav] || 'Classes & students'}
            </span>

            <button
              type="button"
              onClick={handleToggleRole}
              className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#ffe1d0] border-[1.5px] border-[#201e1d] text-[#201e1d] hover:bg-[#ffc6a5] transition-colors flex items-center gap-1 shadow-offset-2 active:translate-y-0.5"
              title="Switch role"
            >
              <span>{role === 'teacher' ? 'School admin' : 'Content studio'}</span>
              <ArrowRightLeft className="w-3 h-3 text-[#645c50]" />
            </button>
          </div>
        </header>

        {/* Scrollable Main Content Area */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full flex-1">
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

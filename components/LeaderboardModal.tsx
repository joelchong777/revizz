'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchWeeklyLeaderboard, toggleLeaderboardOptIn, LeaderboardEntry } from '../lib/leaderboard';
import { signOut, isDemoStudentSession } from '../lib/auth';
import { UserProfile } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { AdSlotBanner } from '@/components/ads/AdSlotBanner';
import AuthModal from './AuthModal';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onProfileUpdate: (updated: Partial<UserProfile>) => void;
  initialTab?: 'account' | 'leaderboard';
}

export default function LeaderboardModal({
  isOpen,
  onClose,
  userProfile,
  onProfileUpdate,
  initialTab = 'account',
}: LeaderboardModalProps) {
  const [activeTab, setActiveTab] = useState<'account' | 'leaderboard'>(initialTab || 'account');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);

  const isDemo =
    !userProfile ||
    isDemoStudentSession(userProfile) ||
    userProfile.id === 'demo-student-local' ||
    userProfile.display_name === 'Demo Student' ||
    Boolean(userProfile.id.startsWith('demo-'));

  const isSchool = Boolean(userProfile?.is_school_account);

  const displayName = isDemo
    ? (userProfile?.display_name || 'Demo Student')
    : (userProfile?.display_name || 'Verified Student');

  const userInitials = isDemo
    ? 'DS'
    : userProfile?.display_name
    ? userProfile.display_name
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .replace('.', '')
        .slice(0, 2)
        .toUpperCase()
    : 'VS';

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'account');
      loadLeaderboard();
    }
  }, [isOpen, initialTab]);

  const loadLeaderboard = async () => {
    setLoading(true);
    const data = await fetchWeeklyLeaderboard();
    setLeaderboard(data);
    setLoading(false);
  };

  const handleToggleOptIn = async () => {
    if (!userProfile) return;
    const newStatus = await toggleLeaderboardOptIn(userProfile.id, userProfile.opt_in_leaderboard);
    onProfileUpdate({ opt_in_leaderboard: newStatus });
    loadLeaderboard(); // refresh leaderboard
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="w-[calc(100vw-24px)] sm:w-full sm:max-w-md p-0 overflow-hidden border-2 border-[#201e1d] rounded-3xl shadow-[4px_4px_0_0_#201e1d] bg-[#FFFDF7] text-[#201e1d] max-h-[90vh] flex flex-col gap-0">
          {/* Neobrutalist Header Bar */}
          <DialogHeader className="p-4 bg-amber-50/80 border-b-2 border-[#201e1d] flex flex-row items-center justify-between pr-12 space-y-0">
            <DialogTitle className="text-base sm:text-lg font-black text-[#201e1d] flex items-center gap-2">
              Student Account & Rankings
            </DialogTitle>
          </DialogHeader>

          {/* Tactile 2-Tab Segmented Control */}
          <div className="px-4 pt-3 pb-2 bg-[#f9f4ed] border-b border-[#201e1d]/15 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={
                activeTab === 'account'
                  ? 'flex-1 flex items-center justify-center gap-1.5 bg-[#201e1d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-black text-xs sm:text-sm py-1.5 px-3 rounded-xl transition-all cursor-pointer'
                  : 'flex-1 flex items-center justify-center gap-1.5 bg-white text-slate-700 border-2 border-[#201e1d] hover:bg-amber-50 shadow-[1px_1px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none font-bold text-xs sm:text-sm py-1.5 px-3 rounded-xl transition-all cursor-pointer'
              }
            >
              <span>👤</span>
              <span>My Account</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={
                activeTab === 'leaderboard'
                  ? 'flex-1 flex items-center justify-center gap-1.5 bg-[#201e1d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-black text-xs sm:text-sm py-1.5 px-3 rounded-xl transition-all cursor-pointer'
                  : 'flex-1 flex items-center justify-center gap-1.5 bg-white text-slate-700 border-2 border-[#201e1d] hover:bg-amber-50 shadow-[1px_1px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none font-bold text-xs sm:text-sm py-1.5 px-3 rounded-xl transition-all cursor-pointer'
              }
            >
              <span>🏆</span>
              <span>Leaderboard</span>
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="p-4 sm:p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
            {activeTab === 'account' ? (
              <div className="space-y-4">
                {/* Student Avatar & Profile Info */}
                <div className="flex items-center gap-3 p-3 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_0_#201e1d]">
                  <div className="w-12 h-12 rounded-full bg-accent-2-300 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center font-black text-base text-[#201e1d] shrink-0">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-black text-base sm:text-lg text-[#201e1d] truncate">
                      {displayName}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {isSchool ? (
                        <span className="bg-indigo-100 border border-indigo-600 text-indigo-900 font-bold text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                          🎓 School Account
                        </span>
                      ) : isDemo ? (
                        <span className="bg-amber-100 border border-amber-600 text-amber-900 font-bold text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                          ⚡ Guest Session · Unsaved
                        </span>
                      ) : (
                        <span className="bg-emerald-100 border border-emerald-600 text-emerald-900 font-bold text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                          ✨ Verified Student
                        </span>
                      )}
                    </div>
                    {userProfile?.email && !isDemo && (
                      <p className="text-xs text-slate-500 font-medium truncate mt-1">
                        {userProfile.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats Summary Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-accent-200 border-2 border-[#201e1d] rounded-xl p-2 text-center shadow-[1px_1px_0_0_#201e1d]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Total XP</div>
                    <div className="font-black text-sm sm:text-base text-[#201e1d] truncate mt-0.5">
                      +{userProfile?.total_xp || 0} XP
                    </div>
                  </div>
                  <div className="bg-accent-300 border-2 border-[#201e1d] rounded-xl p-2 text-center shadow-[1px_1px_0_0_#201e1d]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Streak</div>
                    <div className="font-black text-sm sm:text-base text-[#201e1d] truncate mt-0.5">
                      🔥 {userProfile?.current_streak || 0}
                    </div>
                  </div>
                  <div className="bg-neutral-100 border-2 border-[#201e1d] rounded-xl p-2 text-center shadow-[1px_1px_0_0_#201e1d]">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-700">Status</div>
                    <div className="font-black text-sm sm:text-base text-[#201e1d] truncate mt-0.5">
                      {isDemo ? 'Guest' : 'Ranked'}
                    </div>
                  </div>
                </div>

                {/* Student Profile Hub Navigation Card */}
                <div className="bg-white border-2 border-[#201e1d] rounded-2xl p-3 shadow-[2px_2px_0_0_#201e1d] space-y-2">
                  <Link
                    href="/profile"
                    onClick={onClose}
                    data-testid="open-profile-hub-btn"
                    className="w-full bg-accent-300 hover:bg-amber-300 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] rounded-xl py-2.5 px-3 font-black text-xs sm:text-sm text-[#201e1d] flex items-center justify-between transition-transform active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    <span>🏠 Open Full Student Profile Hub</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Link
                      href="/profile?tab=stats"
                      onClick={onClose}
                      className="p-2 rounded-lg border-2 border-[#201e1d] bg-neutral-100 hover:bg-neutral-200 text-[#201e1d] font-bold text-[11px] text-center shadow-[1px_1px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none transition-all"
                    >
                      📊 Stats & Mastery
                    </Link>
                    <Link
                      href="/profile?tab=review"
                      onClick={onClose}
                      className="p-2 rounded-lg border-2 border-[#201e1d] bg-neutral-100 hover:bg-neutral-200 text-[#201e1d] font-bold text-[11px] text-center shadow-[1px_1px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none transition-all"
                    >
                      🧠 Questions to Review
                    </Link>
                    <Link
                      href="/profile?tab=achievements"
                      onClick={onClose}
                      className="p-2 rounded-lg border-2 border-[#201e1d] bg-neutral-100 hover:bg-neutral-200 text-[#201e1d] font-bold text-[11px] text-center shadow-[1px_1px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none transition-all"
                    >
                      🏅 Badges & Activity
                    </Link>
                    <Link
                      href="/profile?tab=settings"
                      onClick={onClose}
                      className="p-2 rounded-lg border-2 border-[#201e1d] bg-neutral-100 hover:bg-neutral-200 text-[#201e1d] font-bold text-[11px] text-center shadow-[1px_1px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none transition-all"
                    >
                      ⚙️ Profile Settings
                    </Link>
                  </div>
                </div>

                {/* Authentication & Progress Card */}
                {isDemo ? (
                  <div className="bg-amber-50/70 border-2 border-[#201e1d] rounded-2xl p-3.5 shadow-[2px_2px_0_0_#201e1d] space-y-2.5">
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      You're revising in a local guest session. Sign in or create an account with Google or Email to save your revision history, unlock review piles, and join the global leaderboard!
                    </p>
                    <button
                      type="button"
                      onClick={() => setAuthModalOpen(true)}
                      className="w-full min-h-[44px] bg-[#FACC15] hover:bg-yellow-300 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] rounded-xl font-black text-xs sm:text-sm text-[#201e1d] flex items-center justify-center gap-2 active:translate-y-0.5 active:shadow-none cursor-pointer transition-all"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Sign In / Create Account to Save Progress</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full text-center text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline py-1 cursor-pointer"
                    >
                      Exit Demo / Reset Session
                    </button>
                  </div>
                ) : (
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 rounded-xl border-2 border-[#201e1d] bg-white shadow-[1px_1px_0_0_#201e1d] cursor-pointer">
                    <div className="space-y-0.5 pr-2">
                      <span className="text-xs sm:text-sm font-black text-[#201e1d] block">Appear on Global Leaderboard</span>
                      <p className="text-[11px] text-slate-500 font-medium">Allow other Cambridge students to see your weekly score</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={userProfile?.opt_in_leaderboard ?? false}
                      onChange={handleToggleOptIn}
                      className="w-5 h-5 rounded text-amber-500 border-2 border-[#201e1d] focus:ring-amber-400 cursor-pointer shrink-0"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full py-2.5 rounded-xl border-2 border-[#201e1d] bg-rose-50 hover:bg-rose-100 text-rose-700 font-black text-xs sm:text-sm shadow-[2px_2px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    Sign Out of Account
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-xs sm:text-sm text-[#201e1d]">Top Cambridge Learners This Week</h4>
                  <p className="text-[11px] text-slate-500 font-medium">Updated live with XP earned across past papers</p>
                </div>
                {loading && (
                  <span className="text-[11px] font-bold text-slate-400 animate-pulse">Refreshing...</span>
                )}
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {loading && leaderboard.length === 0 ? (
                  <div className="p-6 text-center text-xs font-bold text-slate-400">Loading standings...</div>
                ) : leaderboard.length > 0 ? (
                  leaderboard.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] ${
                        entry.id === userProfile?.id ? 'bg-yellow-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="text-base w-6 text-center shrink-0">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </span>
                        <span className="font-black text-xs sm:text-sm text-[#201e1d] truncate">
                          {entry.display_name} {entry.is_school_account && '🎓'}
                        </span>
                        {entry.id === userProfile?.id && (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200 border border-[#201e1d] px-1.5 py-0.2 rounded shrink-0">
                            You
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 bg-accent-2-200 border-2 border-[#201e1d] rounded-full px-2.5 py-0.5 font-black text-xs text-[#201e1d]">
                        {entry.total_xp} XP
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center bg-white border-2 border-[#201e1d] rounded-2xl shadow-[2px_2px_0_0_#201e1d] space-y-1.5">
                    <div className="text-3xl">🏆</div>
                    <p className="font-black text-sm text-[#201e1d]">The weekly leaderboard is wide open!</p>
                    <p className="text-xs text-slate-600">Complete a quiz round to claim the #1 spot.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-3 pt-2.5 border-t border-slate-200">
            <AdSlotBanner slotId="leaderboard_footer" />
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <AuthModal
      isOpen={isAuthModalOpen}
      onClose={() => setAuthModalOpen(false)}
      onSuccess={() => {
        if (userProfile) onProfileUpdate(userProfile);
      }}
    />
  </>
);
}

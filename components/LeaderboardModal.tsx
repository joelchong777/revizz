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
          <DialogHeader className="p-4 sm:p-5 bg-[#FEF08A] border-b-2 border-[#201e1d] flex flex-row items-center justify-between pr-12 space-y-0">
            <DialogTitle className="text-base sm:text-lg font-heading font-black text-[#201e1d] flex items-center gap-2">
              <span>🎓</span> Student Account & Rankings
            </DialogTitle>
          </DialogHeader>

          {/* Tactile 2-Tab Segmented Control */}
          <div className="px-4 pt-3 pb-2.5 bg-[#F9F4ED] border-b-2 border-[#201e1d]/10 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('account')}
              className={
                activeTab === 'account'
                  ? 'flex-1 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 bg-[#201e1d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-heading font-black text-xs sm:text-sm py-2 px-3 rounded-xl transition-all cursor-pointer'
                  : 'flex-1 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 bg-white text-[#201e1d] border-2 border-[#201e1d] hover:bg-[#FEF08A] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none font-heading font-black text-xs sm:text-sm py-2 px-3 rounded-xl transition-all cursor-pointer'
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
                  ? 'flex-1 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 bg-[#201e1d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-heading font-black text-xs sm:text-sm py-2 px-3 rounded-xl transition-all cursor-pointer'
                  : 'flex-1 shrink-0 whitespace-nowrap flex items-center justify-center gap-1.5 bg-white text-[#201e1d] border-2 border-[#201e1d] hover:bg-[#FEF08A] shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none font-heading font-black text-xs sm:text-sm py-2 px-3 rounded-xl transition-all cursor-pointer'
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
                <div className="flex items-center gap-3.5 p-3.5 bg-white border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_0_#201e1d]">
                  <div className="w-12 h-12 rounded-2xl bg-[#BBF7D0] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center font-heading font-black text-base text-[#166534] shrink-0">
                    {userInitials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading font-black text-base sm:text-lg text-[#201e1d] truncate">
                      {displayName}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {isSchool ? (
                        <span className="bg-[#EEF2FF] border border-[#201e1d] text-indigo-950 font-black text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-[1px_1px_0_0_#201e1d] shrink-0 whitespace-nowrap">
                          🎓 School Account
                        </span>
                      ) : isDemo ? (
                        <span className="bg-[#FEF08A] border border-[#201e1d] text-amber-950 font-black text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-[1px_1px_0_0_#201e1d] shrink-0 whitespace-nowrap">
                          ⚡ Guest Session · Unsaved
                        </span>
                      ) : (
                        <span className="bg-[#DCFCE7] border border-[#201e1d] text-emerald-950 font-black text-[11px] px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 shadow-[1px_1px_0_0_#201e1d] shrink-0 whitespace-nowrap">
                          ✨ Verified Student
                        </span>
                      )}
                    </div>
                    {userProfile?.email && !isDemo && (
                      <p className="text-xs text-neutral-500 font-bold truncate mt-1">
                        {userProfile.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Stats Summary Grid */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  <div className="bg-[#FEF08A] border-2 border-[#201e1d] rounded-2xl p-2.5 text-center shadow-[2px_2px_0_0_#201e1d] overflow-hidden">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-950/70 truncate">Total XP</div>
                    <div className="font-heading font-black text-sm sm:text-base text-[#201e1d] truncate mt-0.5">
                      +{userProfile?.total_xp || 0} XP
                    </div>
                  </div>
                  <div className="bg-[#FED7AA] border-2 border-[#201e1d] rounded-2xl p-2.5 text-center shadow-[2px_2px_0_0_#201e1d] overflow-hidden">
                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-950/70 truncate">Streak</div>
                    <div className="font-heading font-black text-sm sm:text-base text-[#201e1d] truncate mt-0.5">
                      🔥 {userProfile?.current_streak || 0}
                    </div>
                  </div>
                  <div className="bg-[#C7D2FE] border-2 border-[#201e1d] rounded-2xl p-2.5 text-center shadow-[2px_2px_0_0_#201e1d] overflow-hidden">
                    <div className="text-[10px] font-black uppercase tracking-wider text-indigo-950/70 truncate">Status</div>
                    <div className="font-heading font-black text-sm sm:text-base text-[#201e1d] truncate mt-0.5">
                      {isDemo ? 'Guest' : 'Ranked'}
                    </div>
                  </div>
                </div>

                {/* Student Profile Hub Navigation Card */}
                <div className="bg-[#F9F4ED] border-2 border-[#201e1d] rounded-2xl p-3.5 shadow-[3px_3px_0_0_#201e1d] space-y-2.5 overflow-hidden">
                  <Link
                    href="/profile"
                    onClick={onClose}
                    data-testid="open-profile-hub-btn"
                    className="w-full shrink-0 whitespace-nowrap bg-[#FEF08A] hover:bg-[#FDE047] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] rounded-xl py-2.5 px-3.5 font-heading font-black text-xs sm:text-sm text-[#201e1d] flex items-center justify-between transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                  >
                    <span>🏠 Open Full Student Profile Hub</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/homework"
                      onClick={onClose}
                      className="shrink-0 whitespace-nowrap p-2.5 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#FEF08A] text-[#201e1d] font-heading font-black text-[11px] text-center shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all col-span-2"
                    >
                      📝 Assigned Homework
                    </Link>
                    <Link
                      href="/profile?tab=stats"
                      onClick={onClose}
                      className="shrink-0 whitespace-nowrap p-2.5 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#FEF08A] text-[#201e1d] font-heading font-black text-[11px] text-center shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                    >
                      📊 Stats & Mastery
                    </Link>
                    <Link
                      href="/profile?tab=review"
                      onClick={onClose}
                      className="shrink-0 whitespace-nowrap p-2.5 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#FEF08A] text-[#201e1d] font-heading font-black text-[11px] text-center shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                    >
                      🧠 Questions to Review
                    </Link>
                    <Link
                      href="/profile?tab=achievements"
                      onClick={onClose}
                      className="shrink-0 whitespace-nowrap p-2.5 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#FEF08A] text-[#201e1d] font-heading font-black text-[11px] text-center shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                    >
                      🏅 Badges & Activity
                    </Link>
                    <Link
                      href="/profile?tab=settings"
                      onClick={onClose}
                      className="shrink-0 whitespace-nowrap p-2.5 rounded-xl border-2 border-[#201e1d] bg-white hover:bg-[#FEF08A] text-[#201e1d] font-heading font-black text-[11px] text-center shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                    >
                      ⚙️ Profile Settings
                    </Link>
                  </div>
                </div>

                {/* Authentication & Progress Card */}
                {isDemo ? (
                  <div className="bg-[#FFFDF7] border-2 border-[#201e1d] rounded-2xl p-4 shadow-[3px_3px_0_0_#201e1d] space-y-3">
                    <p className="text-xs text-neutral-600 leading-relaxed font-bold">
                      You&apos;re revising in a local guest session. Sign in or create an account with Google or Email to save your revision history, unlock review piles, and join the global leaderboard!
                    </p>
                    <button
                      type="button"
                      onClick={() => setAuthModalOpen(true)}
                      className="w-full shrink-0 whitespace-nowrap min-h-[44px] bg-[#FEF08A] hover:bg-[#FDE047] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] rounded-xl font-heading font-black text-xs sm:text-sm text-[#201e1d] flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer transition-all"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>Sign In / Create Account to Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full shrink-0 whitespace-nowrap text-center text-xs font-heading font-black text-rose-700 hover:text-rose-900 hover:underline py-1 cursor-pointer"
                    >
                      Exit Demo / Reset Session
                    </button>
                  </div>
                ) : (
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-[#201e1d] bg-white shadow-[2px_2px_0_0_#201e1d] cursor-pointer">
                    <div className="space-y-0.5 pr-2 min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-heading font-black text-[#201e1d] block">Appear on Global Leaderboard</span>
                      <p className="text-[11px] text-neutral-500 font-bold">Allow other Cambridge students to see your weekly score</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={userProfile?.opt_in_leaderboard ?? false}
                      onChange={handleToggleOptIn}
                      className="w-5 h-5 rounded-md text-amber-500 border-2 border-[#201e1d] focus:ring-[#FEF08A] cursor-pointer shrink-0"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="w-full shrink-0 whitespace-nowrap py-2.5 rounded-xl border-2 border-[#201e1d] bg-[#FFF1F2] hover:bg-[#FFE4E6] text-rose-800 font-heading font-black text-xs sm:text-sm shadow-[2px_2px_0_0_#201e1d] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    Sign Out of Account
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h4 className="font-heading font-black text-sm sm:text-base text-[#201e1d]">Top Cambridge Learners This Week</h4>
                  <p className="text-[11px] text-neutral-500 font-bold">Updated live with XP earned across past papers</p>
                </div>
                {loading && (
                  <span className="text-[11px] font-black text-neutral-400 animate-pulse bg-neutral-100 px-2 py-0.5 rounded-md border border-[#201e1d]/20 shrink-0 whitespace-nowrap">
                    Refreshing...
                  </span>
                )}
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {loading && leaderboard.length === 0 ? (
                  <div className="p-8 text-center text-xs font-bold text-neutral-400">Loading standings...</div>
                ) : leaderboard.length > 0 ? (
                  leaderboard.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className={`flex items-center justify-between p-3 rounded-2xl border-2 border-[#201e1d] transition-all overflow-hidden ${
                        idx === 0
                          ? 'bg-[#FEF08A] shadow-[3px_3px_0_0_#201e1d]'
                          : idx === 1
                            ? 'bg-[#F3F4F6] shadow-[2px_2px_0_0_#201e1d]'
                            : idx === 2
                              ? 'bg-[#FED7AA] shadow-[2px_2px_0_0_#201e1d]'
                              : entry.id === userProfile?.id
                                ? 'bg-amber-50 shadow-[2px_2px_0_0_#201e1d] ring-2 ring-[#201e1d]'
                                : 'bg-white shadow-[2px_2px_0_0_#201e1d]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="text-base w-7 text-center shrink-0 font-heading font-black">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </span>
                        <span className="font-heading font-black text-xs sm:text-sm text-[#201e1d] truncate">
                          {entry.display_name} {entry.is_school_account && '🎓'}
                        </span>
                        {entry.id === userProfile?.id && (
                          <span className="text-[10px] font-black uppercase tracking-wider bg-[#201e1d] text-white px-2 py-0.5 rounded-md shadow-[1px_1px_0_0_#201e1d] shrink-0 whitespace-nowrap">
                            You
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 whitespace-nowrap bg-[#C7D2FE] border-2 border-[#201e1d] rounded-xl px-2.5 py-0.5 font-heading font-black text-xs text-[#201e1d] shadow-[1px_1px_0_0_#201e1d]">
                        {entry.total_xp} XP
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center bg-white border-2 border-[#201e1d] rounded-2xl shadow-[3px_3px_0_0_#201e1d] space-y-2">
                    <div className="text-3xl">🏆</div>
                    <p className="font-heading font-black text-base text-[#201e1d]">The weekly leaderboard is wide open!</p>
                    <p className="text-xs text-neutral-600 font-bold">Complete a quiz round to claim the #1 spot.</p>
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

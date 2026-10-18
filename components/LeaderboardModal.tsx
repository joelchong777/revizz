'use client';

import React, { useEffect, useState } from 'react';
import { fetchWeeklyLeaderboard, toggleLeaderboardOptIn, LeaderboardEntry } from '../lib/leaderboard';
import { signOut, signInWithGoogle, isDemoStudentSession, isProviderNotEnabledError } from '../lib/auth';
import { UserProfile } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { AdSlotBanner } from '@/components/ads/AdSlotBanner';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onProfileUpdate: (updated: Partial<UserProfile>) => void;
}

export default function LeaderboardModal({ isOpen, onClose, userProfile, onProfileUpdate }: LeaderboardModalProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const isDemo =
    isDemoStudentSession(userProfile) ||
    userProfile?.id === 'demo-student-local' ||
    userProfile?.display_name === 'Demo Student';

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
      setAuthNotice(null);
    }
  }, [isOpen]);

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

  const handleGoogleSignIn = async () => {
    try {
      setLoginLoading(true);
      setAuthNotice(null);
      await signInWithGoogle();
    } catch (err: any) {
      if (isProviderNotEnabledError(err) || err?.code === 'PROVIDER_NOT_ENABLED') {
        setAuthNotice(
          'Google Sign-In is not currently enabled on this instance. Your progress remains saved locally!'
        );
      } else {
        setAuthNotice(err?.message || 'Unable to connect to Google.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-2 border-b-4 border-slate-800 shadow-chunky">
        <DialogHeader className="p-6 bg-blue-50 border-b-2 border-slate-800 flex flex-row justify-between items-center space-y-0">
          <DialogTitle className="text-2xl font-black text-blue-900 flex items-center gap-2">
            🏆 Weekly Leaderboard
          </DialogTitle>
        </DialogHeader>

        <div className="p-6">
          {userProfile && (
            <div className="mb-6 bg-gray-50 rounded-xl p-4 border-2 border-slate-800">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-800">Your Stats</span>
                  {isDemo && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-700 font-bold text-[11px] text-amber-900 shadow-sm">
                      Demo Account (Local Session)
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-sm text-red-600 font-semibold hover:underline cursor-pointer"
                >
                  {isDemo ? 'Exit Demo / Sign Out' : 'Sign Out'}
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-3">{userProfile.display_name} • {userProfile.total_xp} XP</p>

              {isDemo ? (
                <div className="flex flex-col gap-2 pt-1 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loginLoading}
                    className="w-full py-2.5 px-3.5 rounded-xl bg-accent-200 hover:bg-accent-300 border-2 border-slate-800 shadow-offset-2 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none font-bold text-xs sm:text-sm text-slate-900 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>{loginLoading ? 'Connecting...' : 'Log In with Google to Join Global Leaderboard'}</span>
                  </button>
                  {authNotice && (
                    <p className="text-[11px] font-semibold text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-300 m-0">
                      {authNotice}
                    </p>
                  )}
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userProfile.opt_in_leaderboard}
                    onChange={handleToggleOptIn}
                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Appear on Leaderboard</span>
                </label>
              )}
            </div>
          )}

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {loading ? (
              <p className="text-center text-gray-500 py-4">Loading...</p>
            ) : leaderboard.length > 0 ? (
              leaderboard.map((entry, idx) => (
                <div key={entry.id} className={`flex items-center justify-between p-3 rounded-xl border ${entry.id === userProfile?.id ? 'bg-yellow-50 border-slate-800 border-2' : 'bg-white border-slate-800 border-2'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl w-6 text-center">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                    </span>
                    <span className="font-bold text-gray-800">
                      {entry.display_name} {entry.is_school_account && '🎓'}
                    </span>
                  </div>
                  <Badge variant="indigo" className="font-black text-blue-600 bg-blue-50 border-blue-200">
                    {entry.total_xp} XP
                  </Badge>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 py-4">No one on the leaderboard yet!</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200">
            <AdSlotBanner slotId="leaderboard_footer" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

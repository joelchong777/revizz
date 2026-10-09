'use client';

import React, { useEffect, useState } from 'react';
import { fetchWeeklyLeaderboard, toggleLeaderboardOptIn, LeaderboardEntry } from '../lib/leaderboard';
import { signOut } from '../lib/auth';
import { UserProfile } from '../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onProfileUpdate: (updated: Partial<UserProfile>) => void;
}

export default function LeaderboardModal({ isOpen, onClose, userProfile, onProfileUpdate }: LeaderboardModalProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLeaderboard();
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
                <span className="font-bold text-gray-800">Your Stats</span>
                <button onClick={handleSignOut} className="text-sm text-red-600 font-semibold hover:underline cursor-pointer">
                  Sign Out
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">{userProfile.display_name} • {userProfile.total_xp} XP</p>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={userProfile.opt_in_leaderboard}
                  onChange={handleToggleOptIn}
                  className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Appear on Leaderboard</span>
              </label>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

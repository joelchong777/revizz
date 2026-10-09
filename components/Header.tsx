'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useAnimation, useReducedMotion } from 'framer-motion';
import { SoundToggle } from './SoundToggle';
import { cn } from '@/lib/utils';
import { useAuth, signInWithGoogle } from '../lib/auth';
import { syncGuestDataToUser } from '../lib/sync';
import LeaderboardModal from './LeaderboardModal';

interface HeaderProps {
  currentXp?: number;
  currentStreak?: number;
  className?: string;
}

export function Header({
  currentXp = 0,
  currentStreak = 0,
  className,
}: HeaderProps) {
  const { userProfile, loading, setUserProfile } = useAuth();
  const [isLeaderboardOpen, setLeaderboardOpen] = useState(false);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();

  const [liveXp, setLiveXp] = useState(currentXp);
  const [liveStreak, setLiveStreak] = useState(currentStreak);

  const streakControls = useAnimation();
  const xpControls = useAnimation();

  // Auto-dismiss sync toast message after 3.5s
  useEffect(() => {
    if (!syncToastMessage) return;
    const timer = setTimeout(() => {
      setSyncToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [syncToastMessage]);

  useEffect(() => {
    setLiveXp(currentXp);
  }, [currentXp]);

  useEffect(() => {
    setLiveStreak(currentStreak);
  }, [currentStreak]);

  // Listen for live quiz game stat events across components
  useEffect(() => {
    const handleStatsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ xp?: number; streak?: number }>;
      if (customEvent.detail) {
        if (typeof customEvent.detail.xp === 'number') {
          setLiveXp(customEvent.detail.xp);
        }
        if (typeof customEvent.detail.streak === 'number') {
          setLiveStreak(customEvent.detail.streak);
        }
      }
    };

    window.addEventListener('revizz:stats', handleStatsUpdate);
    return () => {
      window.removeEventListener('revizz:stats', handleStatsUpdate);
    };
  }, []);

  useEffect(() => {
    if (userProfile) {
      // attempt guest sync
      syncGuestDataToUser(userProfile.id, userProfile).then((updatedProfile) => {
        if (updatedProfile && updatedProfile.total_xp !== userProfile.total_xp) {
          setSyncToastMessage("Guest progress saved to your account! 🎉");
          setUserProfile(updatedProfile);
        }
      });
    }
  }, [userProfile, setUserProfile]);

  const displayXp = userProfile ? Math.max(userProfile.total_xp, liveXp) : liveXp;
  const displayStreak = userProfile ? Math.max(userProfile.current_streak, liveStreak) : liveStreak;

  const prevStreakRef = useRef(displayStreak);
  const prevXpRef = useRef(displayXp);

  // Spring scale bounce when streak (🔥) updates
  useEffect(() => {
    if (prevStreakRef.current !== displayStreak) {
      prevStreakRef.current = displayStreak;
      if (!shouldReduceMotion) {
        streakControls.start({
          scale: [1, 1.25, 1],
          transition: { type: 'spring' as const, stiffness: 500, damping: 15 },
        });
      }
    }
  }, [displayStreak, shouldReduceMotion, streakControls]);

  // Spring scale bounce when XP (⚡) updates
  useEffect(() => {
    if (prevXpRef.current !== displayXp) {
      prevXpRef.current = displayXp;
      if (!shouldReduceMotion) {
        xpControls.start({
          scale: [1, 1.25, 1],
          transition: { type: 'spring' as const, stiffness: 500, damping: 15 },
        });
      }
    }
  }, [displayXp, shouldReduceMotion, xpControls]);

  const handleSignIn = async () => {
    const confirmed = confirm("Save your XP, streaks, and join the leaderboard!");
    if (confirmed) {
      try {
        await signInWithGoogle();
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <>
      {/* Non-blocking sync toast notification banner */}
      <AnimatePresence>
        {syncToastMessage && (
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            role="status"
            aria-live="polite"
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-100 border-2 border-slate-800 text-emerald-950 font-black rounded-2xl shadow-chunky text-xs sm:text-sm flex items-center gap-2"
          >
            <span>{syncToastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header
        className={cn(
          'w-full select-none transition-all',
          // Mobile: compact sticky bar (h-14)
          'sticky top-0 z-30 h-14 -mx-3 px-3 sm:mx-0 sm:px-1 flex items-center justify-between bg-amber-50/90 backdrop-blur-md border-b border-amber-200/50',
          // Tablet / Desktop: clean, spacious header
          'sm:static sm:h-auto sm:bg-transparent sm:backdrop-blur-none sm:border-b-0 sm:py-3 sm:flex-col sm:gap-3',
          className
        )}
      >
        {/* Top / Main Controls Bar */}
        <div className="w-full flex items-center justify-between gap-2">
          {/* Brand Logo & Title */}
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-brand-yellow border-2 sm:border-2 border-b-4 border-slate-800 flex items-center justify-center font-black text-amber-950 text-lg sm:text-xl shadow-xs group-active:scale-95 transition-transform">
              R
            </div>
            <div>
              <span className="font-black text-xl sm:text-2xl tracking-tight text-slate-900 drop-shadow-xs">
                Revizz
              </span>
            </div>
          </Link>

          {/* Right Controls: Streak & XP Chips + Sound Toggle */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setLeaderboardOpen(true)}
              title="Leaderboard"
              className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-blue-50 border-2 border-b-4 border-slate-800 shadow-chunky text-blue-700 text-xs font-black shadow-xs hover:bg-blue-100 cursor-pointer active:scale-95 transition-transform"
            >
              🏆
            </button>

            {/* Streak Chip with Spring Scale Bounce */}
            <motion.div
              animate={streakControls}
              whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
              title={`Current Streak: ${displayStreak}`}
              className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-orange-50 border-2 border-b-4 border-slate-800 shadow-chunky text-orange-700 text-xs font-black shadow-xs cursor-default"
            >
              <span className="text-xs sm:text-sm">🔥</span>
              <span>{displayStreak}</span>
            </motion.div>

            {/* XP Chip with Spring Scale Bounce */}
            <motion.div
              animate={xpControls}
              whileHover={shouldReduceMotion ? undefined : { scale: 1.05 }}
              title={`Total XP: ${displayXp}`}
              className="flex items-center gap-1 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-50 border-2 border-b-4 border-slate-800 shadow-chunky text-amber-800 text-xs font-black shadow-xs cursor-default"
            >
              <span className="text-xs sm:text-sm">⚡</span>
              <span>{displayXp} XP</span>
            </motion.div>

            {/* Sound Toggle Button */}
            <SoundToggle />

            {/* Mobile-only compact Auth Button */}
            <div className="sm:hidden flex items-center">
              {loading ? (
                <div className="w-6 h-6 rounded-full bg-slate-200 animate-pulse" />
              ) : userProfile ? (
                <button
                  onClick={() => setLeaderboardOpen(true)}
                  title={userProfile.display_name}
                  className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold active:scale-95 transition-transform shadow-xs cursor-pointer"
                >
                  {userProfile.display_name.charAt(0)}
                </button>
              ) : (
                <button
                  onClick={handleSignIn}
                  title="Sign in with Google"
                  className="w-7 h-7 rounded-full bg-white border border-slate-300 flex items-center justify-center shadow-xs active:scale-95 transition-transform cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tablet / Desktop Action Bar with Prominent Educator Portal & Auth */}
        <div className="hidden sm:flex items-center justify-between gap-3 pt-1 border-t border-slate-200/50">
          {/* Prominent Educator Portal Link */}
          <Link
            href="/portal"
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-full px-3.5 py-1.5 border-2 border-b-4 border-slate-800 shadow-chunky shadow-xs font-bold text-xs sm:text-sm cursor-pointer transition-all active:scale-95"
          >
            <span>Educator Portal 🎓</span>
          </Link>

          {/* Auth Bar */}
          <div className="flex items-center gap-2">
            {loading ? (
              <div className="text-sm text-gray-500 font-bold animate-pulse">Loading...</div>
            ) : userProfile ? (
              <div
                className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1 border-2 border-b-4 border-slate-800 shadow-chunky shadow-sm cursor-pointer hover:bg-gray-200/80 transition-colors"
                onClick={() => setLeaderboardOpen(true)}
              >
                <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                  {userProfile.display_name.charAt(0)}
                </div>
                <span className="text-sm font-bold text-gray-700">
                  {userProfile.display_name} {userProfile.is_school_account && '🎓'}
                </span>
              </div>
            ) : (
              <button
                onClick={handleSignIn}
                className="flex items-center gap-2 bg-white rounded-full px-4 py-1.5 border-2 border-b-4 border-slate-800 shadow-chunky shadow-sm hover:bg-gray-50 active:scale-95 transition-transform cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                <span className="text-sm font-bold text-gray-700">Sign in</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <LeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        userProfile={userProfile}
        onProfileUpdate={(updated) => {
          if (userProfile) {
            setUserProfile({ ...userProfile, ...updated });
          }
        }}
      />
    </>
  );
}

export default Header;

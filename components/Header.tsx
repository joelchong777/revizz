'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useAnimation, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth, signInWithGoogle, isProviderNotEnabledError } from '../lib/auth';
import { syncGuestDataToUser } from '../lib/sync';
import { isSoundEnabled, setSoundEnabled, playPop, subscribeSoundState } from '@/lib/audio';
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
  const [soundOn, setSoundOn] = useState<boolean>(false);
  const shouldReduceMotion = useReducedMotion();

  const [liveXp, setLiveXp] = useState(currentXp);
  const [liveStreak, setLiveStreak] = useState(currentStreak);

  const streakControls = useAnimation();
  const xpControls = useAnimation();

  // Sound listener
  useEffect(() => {
    setSoundOn(isSoundEnabled());
    const unsubscribe = subscribeSoundState((enabled) => {
      setSoundOn(enabled);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const handleToggleSound = () => {
    const nextState = !soundOn;
    setSoundEnabled(nextState);
    setSoundOn(nextState);
    if (nextState) {
      playPop();
    }
  };

  // Auto-dismiss sync toast message after 5s
  useEffect(() => {
    if (!syncToastMessage) return;
    const timer = setTimeout(() => {
      setSyncToastMessage(null);
    }, 5000);
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
      syncGuestDataToUser(userProfile.id, userProfile).then((updatedProfile) => {
        if (updatedProfile && updatedProfile.total_xp !== userProfile.total_xp) {
          setSyncToastMessage('Guest progress saved to your account! 🎉');
          setUserProfile(updatedProfile);
        }
      });
    }
  }, [userProfile, setUserProfile]);

  const displayXp = userProfile ? Math.max(userProfile.total_xp, liveXp) : liveXp;
  const displayStreak = userProfile ? Math.max(userProfile.current_streak, liveStreak) : liveStreak;

  const prevStreakRef = useRef(displayStreak);
  const prevXpRef = useRef(displayXp);

  // Tactile scale bounce when streak (🔥) updates (tween transition prevents multi-keyframe spring crashes)
  useEffect(() => {
    if (prevStreakRef.current !== displayStreak) {
      prevStreakRef.current = displayStreak;
      if (!shouldReduceMotion) {
        streakControls.start({
          scale: [1, 1.25, 1],
          transition: { type: 'tween', duration: 0.3, ease: 'easeOut' },
        });
      }
    }
  }, [displayStreak, shouldReduceMotion, streakControls]);

  // Tactile scale bounce when XP (⚡) updates (tween transition prevents multi-keyframe spring crashes)
  useEffect(() => {
    if (prevXpRef.current !== displayXp) {
      prevXpRef.current = displayXp;
      if (!shouldReduceMotion) {
        xpControls.start({
          scale: [1, 1.25, 1],
          transition: { type: 'tween', duration: 0.3, ease: 'easeOut' },
        });
      }
    }
  }, [displayXp, shouldReduceMotion, xpControls]);

  const handleSignIn = async () => {
    const confirmed = confirm('Save your XP, streaks, and join the leaderboard!');
    if (confirmed) {
      try {
        await signInWithGoogle();
      } catch (e: any) {
        console.error('Sign-in error:', e);
        const errMsg = e?.message || e?.error_description || String(e || '');
        const errCode = e?.code || '';
        const isProviderNotEnabled =
          isProviderNotEnabledError(e) ||
          errCode === 'PROVIDER_NOT_ENABLED' ||
          errCode === 'validation_failed' ||
          /provider.*not enabled/i.test(errMsg) ||
          /validation/i.test(errMsg) ||
          /not enabled/i.test(errMsg) ||
          /unsupported provider/i.test(errMsg) ||
          errMsg.includes('PROVIDER_NOT_ENABLED');

        const notice = (isProviderNotEnabled || !errMsg)
          ? "Notice: Google Sign-In is currently disabled on this demo instance. Your XP and streaks continue to be saved locally on your device!"
          : errMsg;

        setSyncToastMessage(notice);
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          try {
            window.alert(notice);
          } catch {
            // Ignore if alerts are restricted in environment
          }
        }
      }
    }
  };

  const streakBg =
    displayStreak >= 3
      ? 'bg-accent-300'
      : 'bg-neutral-100';

  const flameFill = displayStreak >= 3 ? '#c67139' : '#a19786';

  const isDemo =
    userProfile?.id === 'demo-student-local' ||
    userProfile?.display_name === 'Demo Student' ||
    Boolean(userProfile?.id?.startsWith('demo-'));

  const userName = isDemo
    ? 'Demo Student'
    : userProfile?.display_name || 'Guest Learner';

  const userInitials = isDemo
    ? 'DS'
    : userProfile?.display_name
    ? userProfile.display_name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .replace('.', '')
        .slice(0, 2)
        .toUpperCase()
    : 'GL';

  const userBadge = isDemo
    ? 'Demo Mode'
    : userProfile?.is_school_account
    ? 'School Member'
    : userProfile?.email
    ? 'Google Account'
    : 'Revizz Learner';
  const isDev = process.env.NODE_ENV === 'development';
  const isAdmin = userProfile?.role === 'admin' || isDev;

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
            onClick={() => setSyncToastMessage(null)}
            title="Click to dismiss"
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 max-w-[92vw] sm:max-w-md bg-accent-2-200 border-2 border-text text-text font-bold rounded-2xl shadow-offset-3 text-xs sm:text-sm flex items-center justify-center text-center gap-2 cursor-pointer leading-snug"
          >
            <span>{syncToastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <header
        className={cn(
          'sticky top-0 z-20 bg-bg/95 backdrop-blur-xs border-b-2 border-text select-none transition-all py-2 px-3 sm:px-4',
          className
        )}
      >
        <div className="max-w-[480px] mx-auto flex flex-col gap-2">
          {/* Top Row: Brand Wordmark + Tactile Controls */}
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1.5 mr-auto cursor-pointer group"
              title="REVIZZ Home"
            >
              <span className="font-heading text-2xl sm:text-[26px] leading-none tracking-[0.03em] text-text font-normal">
                REVIZZ
              </span>
              <span className="w-7 h-7 rounded-full bg-accent-300 border-2 border-text shadow-offset-2 flex items-center justify-center font-bold text-xs -rotate-12 transition-transform group-hover:rotate-0">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="#201e1d"
                  stroke="#201e1d"
                  strokeWidth="2"
                  strokeLinejoin="round"
                >
                  <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                </svg>
              </span>
            </Link>

            {/* Admin Pill (when isAdmin) */}
            {isAdmin && (
              <Link
                href="/admin"
                title="App Administration"
                className="px-2.5 py-1 rounded-full bg-accent-2-200 border-2 border-text shadow-offset-2 font-bold text-[11px] text-text hover:bg-accent-2-300 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center gap-1 cursor-pointer transition-all"
              >
                <span>Admin</span>
                <span>🛠️</span>
              </Link>
            )}

            {/* Sound Toggle Button */}
            <button
              type="button"
              onClick={handleToggleSound}
              title={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
              className="w-9 h-9 rounded-full bg-neutral-100 border-2 border-text shadow-offset-2 flex items-center justify-center hover:bg-neutral-200 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer transition-all text-text"
            >
              {soundOn ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="22" x2="16" y1="9" y2="15" />
                  <line x1="16" x2="22" y1="9" y2="15" />
                </svg>
              )}
            </button>

            {/* Leaderboard Button */}
            <button
              type="button"
              onClick={() => setLeaderboardOpen(true)}
              title="Leaderboard"
              className="w-9 h-9 rounded-full bg-neutral-100 border-2 border-text shadow-offset-2 flex items-center justify-center hover:bg-neutral-200 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer transition-all text-text"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            </button>
          </div>

          {/* Bottom Row: User Telemetry */}
          <div className="flex items-center gap-2">
            {/* User Profile Chip */}
            <div
              onClick={() => {
                if (userProfile) {
                  setLeaderboardOpen(true);
                } else {
                  handleSignIn();
                }
              }}
              className="flex items-center gap-2 mr-auto min-w-0 cursor-pointer group"
              title={
                isDemo
                  ? 'Demo Mode • Click to sign in or view stats'
                  : userProfile
                  ? 'View Profile & Leaderboard'
                  : 'Sign in to save progress'
              }
            >
              <span className="w-8 h-8 flex-none rounded-full bg-accent-2-300 border-2 border-text flex items-center justify-center font-bold text-xs text-text group-hover:scale-105 transition-transform">
                {userInitials}
              </span>
              <div className="flex flex-col leading-tight min-w-0">
                <span className="font-bold text-xs sm:text-sm text-text truncate">
                  {userName}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-accent-2-800 font-semibold whitespace-nowrap">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  {userBadge}
                </span>
              </div>
            </div>

            {/* XP Pill */}
            <motion.span
              animate={xpControls}
              title={`Total XP: ${displayXp}`}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-200 border-2 border-text shadow-offset-2 font-bold text-xs sm:text-sm text-text tabular-nums whitespace-nowrap select-none"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="#f6a06b"
                stroke="#201e1d"
                strokeWidth="2.5"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>{displayXp} XP</span>
            </motion.span>

            {/* Streak Pill */}
            <motion.span
              animate={streakControls}
              title={`Current Streak: ${displayStreak}`}
              className={cn(
                'flex items-center gap-1 px-3 py-1 rounded-full border-2 border-text shadow-offset-2 font-bold text-xs sm:text-sm text-text tabular-nums whitespace-nowrap select-none',
                streakBg
              )}
            >
              <span className={cn('inline-flex', displayStreak >= 3 && 'animate-bounce')}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={flameFill}
                  stroke="#201e1d"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
              </span>
              <span>{displayStreak}</span>
            </motion.span>
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

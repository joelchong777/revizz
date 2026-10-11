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
    displayStreak >= 5
      ? 'bg-accent-300'
      : displayStreak >= 3
      ? 'bg-accent-200'
      : 'bg-neutral-100';

  const flameFill = displayStreak >= 3 ? '#c67139' : '#a19786';

  const userName = userProfile?.display_name || 'Alex M.';
  const userInitials = userProfile?.display_name
    ? userProfile.display_name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .replace('.', '')
        .slice(0, 2)
        .toUpperCase()
    : 'AM';
  const isDev = process.env.NODE_ENV === 'development';
  const isAdmin = userProfile?.role === 'admin' || isDev;
  const streakMultiplier = displayStreak >= 5 ? 1.5 : displayStreak >= 3 ? 1.2 : 1.0;

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
          'sticky top-0 z-20 backdrop-blur-md bg-[#f5ead8]/85 border-b-[1.5px] border-[#201e1d]/15 select-none transition-all',
          className
        )}
      >
        <div className="max-w-[500px] mx-auto px-4 py-2.5 flex flex-col gap-2">
          {/* Top Row: Brand Wordmark + Telemetry Controls */}
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-2 mr-auto cursor-pointer group"
              title="REVIZZ Home"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-heading font-black tracking-tight text-xl sm:text-2xl text-text">
                  REVIZZ
                </span>
                <span className="w-2 h-2 rounded-full bg-[#c67139] animate-pulse" />
              </div>
              <span className="w-6 h-6 rounded-md bg-[#201e1d] text-[#f9f4ed] flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform text-[11px] font-mono font-bold shadow-xs">
                ⚡
              </span>
            </Link>

            {/* Educator Portal Pill Link */}
            <Link
              href="/portal"
              title="Educator Portal"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/80 border border-[#201e1d]/20 shadow-xs font-mono font-bold text-xs text-text cursor-pointer transition-all hover:bg-white hover:border-[#201e1d]/40 active:scale-95"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Portal</span>
            </Link>

            {/* App Admin Pill Link for Admins */}
            {isAdmin && (
              <Link
                href="/admin"
                title="App Administration"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ccdbb2]/50 border border-[#201e1d]/20 shadow-xs font-mono font-bold text-xs text-text cursor-pointer transition-all hover:bg-[#ccdbb2] hover:border-[#201e1d]/40 active:scale-95"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Admin</span>
              </Link>
            )}

            {/* Sound Toggle Button (Micro-bars equalizer SVG) */}
            <button
              type="button"
              onClick={handleToggleSound}
              title={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
              className="w-8 h-8 rounded-full bg-white/80 border border-[#201e1d]/20 shadow-xs flex items-center justify-center cursor-pointer transition-all hover:bg-white hover:border-[#201e1d]/40 active:scale-95 text-text"
            >
              {soundOn ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="text-[#c67139]"
                >
                  <rect x="3" y="9" width="3" height="6" rx="1.5" fill="currentColor" />
                  <rect x="9" y="4" width="3" height="16" rx="1.5" fill="currentColor" />
                  <rect x="15" y="7" width="3" height="10" rx="1.5" fill="currentColor" />
                  <rect x="21" y="10" width="3" height="4" rx="1.5" fill="currentColor" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="text-neutral-400"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
                  <line x1="22" x2="16" y1="9" y2="15" />
                  <line x1="16" x2="22" y1="9" y2="15" />
                </svg>
              )}
            </button>

            {/* Leaderboard Button */}
            <button
              type="button"
              onClick={() => setLeaderboardOpen(true)}
              title="Telemetry Leaderboard"
              className="w-8 h-8 rounded-full bg-white/80 border border-[#201e1d]/20 shadow-xs flex items-center justify-center cursor-pointer transition-all hover:bg-white hover:border-[#201e1d]/40 active:scale-95 text-text"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
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

          {/* Bottom Row: User Profile Pill + XP Telemetry Pill + Streak Pill Capsule */}
          <div className="flex items-center gap-2">
            {/* User Profile Pill */}
            <div
              onClick={() => {
                if (userProfile) {
                  setLeaderboardOpen(true);
                } else {
                  handleSignIn();
                }
              }}
              className="flex items-center gap-2 mr-auto min-w-0 cursor-pointer group"
              title={userProfile ? 'View Profile & Leaderboard' : 'Sign in to save progress'}
            >
              <span className="w-8 h-8 flex-none rounded-full bg-accent-2-300 border-[1.5px] border-[#201e1d]/30 shadow-xs flex items-center justify-center font-bold text-xs text-text group-hover:scale-105 transition-transform">
                {userInitials}
              </span>
              <div className="flex flex-col leading-[1.15] min-w-0">
                <span className="font-bold text-xs sm:text-sm text-text truncate">
                  {userName}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-neutral-600 font-mono font-medium whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{userProfile?.is_school_account ? "Frontier Int'l" : "IGCSE Candidate"}</span>
                </span>
              </div>
            </div>

            {/* XP HUD Telemetry Pill with subtle glow */}
            <motion.div
              animate={xpControls}
              title={`Total XP: ${displayXp}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 border border-[#201e1d]/20 shadow-[0_0_12px_rgba(198,113,57,0.12)] font-mono text-xs font-bold text-text whitespace-nowrap select-none"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="#f6a06b"
                stroke="#201e1d"
                strokeWidth="2.2"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              <span>{displayXp} XP</span>
            </motion.div>

            {/* Streak HUD Pill Capsule with multiplier badge */}
            <motion.div
              animate={streakControls}
              title={`Current Streak: ${displayStreak}`}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#201e1d]/20 shadow-xs font-mono text-xs font-bold text-text whitespace-nowrap select-none',
                displayStreak >= 3 ? 'bg-[#ffeedd]' : 'bg-white/90'
              )}
            >
              <span className={cn('inline-flex', displayStreak >= 3 && 'animate-bounce')}>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill={flameFill}
                  stroke="#201e1d"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                </svg>
              </span>
              <span>{displayStreak} STREAK</span>
              {displayStreak >= 3 && (
                <span className="px-1 py-0.2 rounded bg-[#c67139] text-[#f9f4ed] text-[10px] font-bold">
                  {streakMultiplier.toFixed(1)}×
                </span>
              )}
            </motion.div>
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

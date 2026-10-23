'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useAnimation, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth, signInWithGoogle, isProviderNotEnabledError, signOut } from '../lib/auth';
import { syncGuestDataToUser } from '../lib/sync';
import { isSoundEnabled, setSoundEnabled, playPop, subscribeSoundState } from '@/lib/audio';
import LeaderboardModal from './LeaderboardModal';
import { AuthModal } from './AuthModal';
import { User, Trophy, LogOut } from 'lucide-react';
import { usePageAccess } from './PageGate';

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
  const pageAccess = usePageAccess();
  const showProfileLink = !pageAccess.isBlocked('profile');
  const showLeaderboardLink = !pageAccess.isBlocked('leaderboard');
  const [isLeaderboardOpen, setLeaderboardOpen] = useState(false);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [modalTab, setModalTab] = useState<'account' | 'leaderboard'>('account');
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

  // Close account dropdown menu on outside click/pointerdown
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleClickOutside);
    return () => {
      window.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isMenuOpen]);

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

  const syncedUserIdRef = useRef<string | null>(null);
  const syncUserId = userProfile?.id ?? null;
  const syncIsDemo = Boolean(
    userProfile &&
      (userProfile.id === 'demo-student-local' ||
        userProfile.display_name === 'Demo Student' ||
        userProfile.id.startsWith('demo-') ||
        !userProfile.email)
  );
  useEffect(() => {
    if (!userProfile || !syncUserId || syncIsDemo) return;
    if (syncedUserIdRef.current === syncUserId) return;
    syncedUserIdRef.current = syncUserId;
    syncGuestDataToUser(syncUserId, userProfile);
    // Run once per user id, not on every profile object change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUserId, syncIsDemo]);

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

  const handleSignIn = () => {
    setAuthModalOpen(true);
  };

  const isDemo =
    userProfile?.id === 'demo-student-local' ||
    userProfile?.display_name === 'Demo Student' ||
    Boolean(userProfile?.id?.startsWith('demo-'));

  const userName = isDemo
    ? 'Demo Student'
    : userProfile?.display_name || (userProfile?.email ? userProfile.email.split('@')[0] : 'Guest Learner');

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
          'sticky top-0 z-20 bg-bg border-b-2 border-text select-none transition-all py-2 md:rounded-t-[20px]',
          className
        )}
      >
        <div className="max-w-[480px] mx-auto px-4 flex items-center justify-between gap-2">
          {/* Left: REVIZZ Brand Wordmark + Star Badge */}
          <Link
            href="/"
            className="flex items-center gap-1.5 cursor-pointer group flex-shrink-0"
            title="REVIZZ Home"
          >
            <span className="font-heading text-2xl sm:text-[26px] leading-none tracking-[0.03em] text-text font-normal">
              REVIZZ
            </span>
            <span className="w-7 h-7 rounded-full bg-accent-300 border-2 border-text shadow-offset-2 flex items-center justify-center font-bold text-xs -rotate-12 transition-transform group-hover:rotate-0 flex-shrink-0">
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

          {/* Right: Controls (Mute on left, User icon on right) */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Sound Toggle (Mute) Button */}
            <button
              type="button"
              onClick={handleToggleSound}
              title={soundOn ? 'Mute sound effects' : 'Enable sound effects'}
              className="w-9 h-9 rounded-full bg-neutral-100 border-2 border-text shadow-offset-2 flex items-center justify-center hover:bg-neutral-200 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer transition-all text-text flex-shrink-0"
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

            {/* Compact User Profile Avatar Button & Account Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  if (userProfile) {
                    setIsMenuOpen((prev) => !prev);
                  } else {
                    setAuthModalOpen(true);
                  }
                }}
                title={
                  isDemo
                    ? 'Demo Mode • Click for account menu'
                    : userProfile
                    ? `Signed in as ${userName} (${userBadge}) • Account menu`
                    : 'Sign in to save progress'
                }
                aria-expanded={isMenuOpen}
                aria-haspopup="true"
                className="w-9 h-9 rounded-full bg-accent-2-300 border-2 border-text shadow-offset-2 flex items-center justify-center font-bold text-sm text-text hover:bg-accent-2-400 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none cursor-pointer transition-all flex-shrink-0"
              >
                {userInitials}
              </button>

              {/* Account Dropdown Menu */}
              {isMenuOpen && userProfile && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-[#FFFDF7] border-2 border-text shadow-[4px_4px_0_0_#201e1d] p-2 z-50 flex flex-col gap-1">
                  {/* User summary header */}
                  <div className="px-2.5 py-1.5 border-b border-text/10 mb-1">
                    <p className="text-xs font-heading font-bold text-text truncate">
                      {userName}
                    </p>
                    <p className="text-[10px] text-text/70 truncate">
                      {userProfile.email || userBadge}
                    </p>
                  </div>

                  {/* Profile & Stats Link */}
                  {showProfileLink && (
                  <Link
                    href="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-text rounded-xl hover:bg-neutral-100 transition-colors"
                  >
                    <User className="w-4 h-4 text-text/80 shrink-0" />
                    <span>Profile & Stats</span>
                  </Link>
                  )}

                  {/* Leaderboard Button */}
                  {showLeaderboardLink && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setModalTab('leaderboard');
                      setLeaderboardOpen(true);
                    }}
                    className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs font-bold text-text rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
                  >
                    <Trophy className="w-4 h-4 text-text/80 shrink-0" />
                    <span>Leaderboard</span>
                  </button>
                  )}

                  {/* Log Out Button */}
                  <button
                    type="button"
                    onClick={async () => {
                      setIsMenuOpen(false);
                      try {
                        await signOut();
                      } catch (err) {
                        console.error('Failed to sign out:', err);
                      }
                    }}
                    className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-xl border-t border-text/10 pt-2 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
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
        initialTab={modalTab}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </>
  );
}

export default Header;

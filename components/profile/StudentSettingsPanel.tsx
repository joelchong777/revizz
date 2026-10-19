'use client';

import React, { useState, useEffect } from 'react';
import type { UserProfile } from '@/types';
import type { StudentPreferences } from '@/lib/studentProfile';
import type { DiagramFilter } from '@/hooks/useQuizGame';
import { clearRoundHistory, clearBookmarkedQuestions } from '@/lib/studentProfile';
import { clearReviewPile } from '@/lib/mastery';
import { isSoundEnabled, setSoundEnabled } from '@/lib/audio';
import { toggleLeaderboardOptIn } from '@/lib/leaderboard';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import {
  User,
  Sparkles,
  BookOpen,
  Calendar,
  Clock,
  Target,
  Volume2,
  VolumeX,
  Trophy,
  Trash2,
  LogOut,
  Check,
  AlertTriangle,
  Layers,
  Flame,
} from 'lucide-react';

export interface StudentSettingsPanelProps {
  userProfile: UserProfile | null;
  isDemoSession: boolean;
  preferences: StudentPreferences;
  onUpdatePreferences: (partial: Partial<StudentPreferences>) => void;
  onProfileUpdate: (updated: Partial<UserProfile>) => void;
  onOpenAuthModal: () => void;
  onDataReset: () => void;
}

const AVATAR_OPTIONS = ['🎓', '🦊', '🚀', '⚡', '🦉', '🌟', '🔥', '🧠'] as const;
const SUBJECT_OPTIONS = [
  'Economics 0455',
  'Biology 0610',
  'Chemistry 0620',
  'Physics 0625',
] as const;
const SERIES_OPTIONS = ['Feb/Mar', 'May/June', 'Oct/Nov'] as const;
const YEAR_OPTIONS = [2026, 2027, 2028] as const;
const GOAL_OPTIONS = [5, 10, 15, 20, 30] as const;
const ROUND_LENGTH_OPTIONS = [3, 5, 10, 30] as const;
const DIAGRAM_FILTER_OPTIONS: Array<{ value: DiagramFilter; label: string; desc: string }> = [
  { value: 'mixed', label: 'All Questions', desc: 'Mix of graphs, diagrams & text' },
  { value: 'graph', label: 'Graphs Only', desc: 'Curves, coordinates, and market axes' },
  { value: 'diagrams', label: 'Diagrams Only', desc: 'Visual apparatus, charts & illustrations' },
  { value: 'no-diagrams', label: 'Text Only', desc: 'Fast calculation & theory stems' },
];

export function StudentSettingsPanel({
  userProfile,
  isDemoSession,
  preferences,
  onUpdatePreferences,
  onProfileUpdate,
  onOpenAuthModal,
  onDataReset,
}: StudentSettingsPanelProps): React.ReactElement {
  // Unconditional React hook declarations (React Error #310 Defense)
  const [displayNameInput, setDisplayNameInput] = useState<string>(
    preferences.displayNameOverride || userProfile?.display_name || ''
  );
  const [savingName, setSavingName] = useState<boolean>(false);
  const [nameSavedSuccess, setNameSavedSuccess] = useState<boolean>(false);
  const [soundActive, setSoundActive] = useState<boolean>(() => isSoundEnabled());
  const [togglingLeaderboard, setTogglingLeaderboard] = useState<boolean>(false);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState<boolean>(false);

  useEffect(() => {
    setDisplayNameInput(preferences.displayNameOverride || userProfile?.display_name || '');
  }, [preferences.displayNameOverride, userProfile?.display_name]);

  const handleSaveDisplayName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = displayNameInput.trim();
    if (!trimmed) return;

    setSavingName(true);
    setNameSavedSuccess(false);

    try {
      // 1. Update local student preferences
      onUpdatePreferences({ displayNameOverride: trimmed });

      // 2. If authenticated or demo profile exists, update memory profile
      if (userProfile) {
        onProfileUpdate({ display_name: trimmed });

        // 3. If real remote account, update Supabase profiles table safely
        if (!isDemoSession && userProfile.id && !userProfile.id.startsWith('demo-')) {
          const { error } = await supabase
            .from('profiles')
            .update({ display_name: trimmed })
            .eq('id', userProfile.id);

          if (error) {
            console.warn('Could not sync display_name to Supabase:', error.message);
          }
        }
      }

      setNameSavedSuccess(true);
      setTimeout(() => setNameSavedSuccess(false), 3000);
    } catch (err) {
      console.warn('Error saving display name:', err);
    } finally {
      setSavingName(false);
    }
  };

  const handleToggleSound = () => {
    const nextVal = !soundActive;
    setSoundEnabled(nextVal);
    setSoundActive(nextVal);
  };

  const handleToggleLeaderboard = async () => {
    if (isDemoSession || !userProfile) return;
    setTogglingLeaderboard(true);
    setLeaderboardError(null);

    try {
      const currentOptIn = !!userProfile.opt_in_leaderboard;
      const updatedOptIn = await toggleLeaderboardOptIn(userProfile.id, currentOptIn);
      onProfileUpdate({ opt_in_leaderboard: updatedOptIn });
    } catch (err) {
      console.error('Failed to toggle leaderboard opt-in:', err);
      setLeaderboardError('Unable to update leaderboard preference.');
    } finally {
      setTogglingLeaderboard(false);
    }
  };

  const handleExecuteReset = () => {
    try {
      clearReviewPile();
      clearRoundHistory();
      clearBookmarkedQuestions();
      onDataReset();
      setShowResetConfirm(false);
      setResetSuccessMessage('Study data has been reset successfully.');
      setTimeout(() => setResetSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Error during data reset:', err);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      window.location.href = '/';
    } catch (err) {
      console.error('Error signing out:', err);
      setSigningOut(false);
    }
  };

  const currentAvatar = preferences.avatarEmoji || '🎓';

  return (
    <div className="w-full space-y-6 sm:space-y-8 select-none">
      {/* Feedback banner */}
      {resetSuccessMessage && (
        <div className="p-4 rounded-2xl bg-[#DCFCE7] border-2 border-[#201e1d] text-emerald-950 font-bold flex items-center gap-3 shadow-[3px_3px_0_0_#201e1d]">
          <Check className="w-5 h-5 text-emerald-700 flex-shrink-0" />
          <span>{resetSuccessMessage}</span>
        </div>
      )}

      {/* 1. Identity & Avatar Section */}
      <section className="bg-[#FFFDF7] rounded-2xl sm:rounded-3xl border-2 border-[#201e1d] p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d] overflow-hidden">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#FEF08A] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-2xl shrink-0">
            {currentAvatar}
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-heading font-black text-[#201e1d] flex items-center gap-2">
              Identity & Student Profile
            </h2>
            <p className="text-xs sm:text-sm font-bold text-neutral-500 mt-0.5">
              Personalize your revision badge, student nickname, and account credentials
            </p>
          </div>
        </div>

        {/* Avatar Picker */}
        <div className="mb-6">
          <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-2.5">
            Choose Your Study Avatar
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
            {AVATAR_OPTIONS.map((emoji) => {
              const isSelected = currentAvatar === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onUpdatePreferences({ avatarEmoji: emoji })}
                  className={`h-14 sm:h-16 rounded-2xl text-2xl sm:text-3xl flex items-center justify-center transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                    isSelected
                      ? 'bg-[#FEF08A] border-2 border-[#201e1d] shadow-[3px_3px_0_0_#201e1d] scale-105 ring-2 ring-[#201e1d]/20'
                      : 'bg-[#F9F4ED] border-2 border-[#201e1d]/30 hover:border-[#201e1d] hover:bg-white text-slate-800'
                  }`}
                  aria-label={`Select avatar ${emoji}`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>

        {/* Display Name Editor */}
        <form onSubmit={handleSaveDisplayName} className="mb-6">
          <label
            htmlFor="student-display-name"
            className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-2"
          >
            Display Name / Nickname
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="student-display-name"
              type="text"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="e.g. Cambridge Scholar"
              maxLength={40}
              className="flex-1 px-4 py-3 rounded-2xl border-2 border-[#201e1d] bg-white font-bold text-[#201e1d] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FEF08A] shadow-[2px_2px_0_0_#201e1d] transition-all text-base"
            />
            <button
              type="submit"
              disabled={savingName || !displayNameInput.trim()}
              className="shrink-0 whitespace-nowrap px-6 py-3 rounded-2xl bg-[#FEF08A] hover:bg-[#FDE047] text-[#201e1d] font-heading font-black border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {savingName ? (
                <span>Saving...</span>
              ) : nameSavedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-800 stroke-[3]" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Name</span>
              )}
            </button>
          </div>
        </form>

        {/* Account Badge & Verification Status */}
        <div className="p-4 rounded-2xl bg-[#F9F4ED] border-2 border-[#201e1d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0_0_#201e1d] overflow-hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-white border-2 border-[#201e1d] flex items-center justify-center text-[#201e1d] shadow-[1px_1px_0_0_#201e1d] shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading font-black text-sm sm:text-base text-[#201e1d] truncate">
                  {userProfile?.email || 'Guest Student'}
                </span>
                {userProfile?.is_school_account ? (
                  <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-[#DCFCE7] text-emerald-950 border border-[#201e1d]">
                    🎓 School Account
                  </span>
                ) : userProfile && !isDemoSession ? (
                  <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-[#EEF2FF] text-indigo-950 border border-[#201e1d]">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Verified Student
                  </span>
                ) : (
                  <span className="shrink-0 whitespace-nowrap inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-[#FEF08A] text-amber-950 border border-[#201e1d]">
                    ⚡ Guest Session · Unsaved
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-500 font-bold mt-1">
                {isDemoSession || !userProfile
                  ? 'Your progress is stored in local browser storage only.'
                  : 'Syncing your mastery and review history across devices.'}
              </p>
            </div>
          </div>

          {(isDemoSession || !userProfile) && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="w-full sm:w-auto shrink-0 whitespace-nowrap px-4 py-2 rounded-xl bg-[#FEF08A] hover:bg-[#FDE047] text-[#201e1d] font-heading font-black text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sign In to Save</span>
            </button>
          )}
        </div>
      </section>

      {/* 2. Cambridge Study Target & Exam Countdown Config */}
      <section className="bg-[#FFFDF7] rounded-2xl sm:rounded-3xl border-2 border-[#201e1d] p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d] overflow-hidden">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#BBF7D0] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-emerald-900 shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-heading font-black text-[#201e1d] flex items-center gap-2">
              Cambridge Study Target & Countdown
            </h2>
            <p className="text-xs sm:text-sm font-bold text-neutral-500 mt-0.5">
              Configure your primary revision subject, exam series, and daily quota
            </p>
          </div>
        </div>

        {/* Primary Subject Selection */}
        <div className="mb-6">
          <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-2.5">
            Primary Revision Subject
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {SUBJECT_OPTIONS.map((subj) => {
              const isSelected = preferences.primarySubject === subj;
              return (
                <button
                  key={subj}
                  type="button"
                  onClick={() => onUpdatePreferences({ primarySubject: subj })}
                  className={`shrink-0 p-3.5 rounded-2xl font-black text-sm text-left flex items-center justify-between transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                    isSelected
                      ? 'bg-[#FEF08A] text-[#201e1d] border-2 border-[#201e1d] shadow-[3px_3px_0_0_#201e1d] scale-[1.02]'
                      : 'bg-[#F9F4ED] text-[#201e1d] border-2 border-[#201e1d]/30 hover:border-[#201e1d] hover:bg-white'
                  }`}
                >
                  <span className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                    <BookOpen className="w-4 h-4 text-[#201e1d] shrink-0" />
                    {subj}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-[#201e1d] stroke-[3] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Exam Series & Year */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-2.5">
              Target Exam Series
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {SERIES_OPTIONS.map((series) => {
                const isSelected = preferences.targetExamSeries === series;
                return (
                  <button
                    key={series}
                    type="button"
                    onClick={() => onUpdatePreferences({ targetExamSeries: series })}
                    className={`shrink-0 whitespace-nowrap py-3 rounded-2xl font-black text-xs sm:text-sm text-center transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                      isSelected
                        ? 'bg-[#201e1d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                        : 'bg-[#F9F4ED] text-[#201e1d] border-2 border-[#201e1d]/30 hover:border-[#201e1d] hover:bg-white'
                    }`}
                  >
                    {series}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-2.5">
              Target Exam Year
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {YEAR_OPTIONS.map((year) => {
                const isSelected = preferences.targetExamYear === year;
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => onUpdatePreferences({ targetExamYear: year })}
                    className={`shrink-0 whitespace-nowrap py-3 rounded-2xl font-black text-xs sm:text-sm text-center transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                      isSelected
                        ? 'bg-[#201e1d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                        : 'bg-[#F9F4ED] text-[#201e1d] border-2 border-[#201e1d]/30 hover:border-[#201e1d] hover:bg-white'
                    }`}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Daily Question Goal */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-2.5">
            Daily Question Target (Paced Revision)
          </label>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2.5">
            {GOAL_OPTIONS.map((goal) => {
              const isSelected = preferences.dailyQuestionGoal === goal;
              return (
                <button
                  key={goal}
                  type="button"
                  onClick={() => onUpdatePreferences({ dailyQuestionGoal: goal })}
                  className={`min-w-0 py-2.5 sm:py-3 rounded-2xl font-heading font-black text-center transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                    isSelected
                      ? 'bg-[#FEF08A] text-[#201e1d] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d]'
                      : 'bg-[#F9F4ED] text-[#201e1d] border-2 border-[#201e1d]/30 hover:border-[#201e1d] hover:bg-white'
                  }`}
                >
                  <span className="block text-sm sm:text-base leading-tight">{goal}</span>
                  <span className="block text-[10px] sm:text-xs font-bold text-neutral-600 leading-tight">Q/day</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Default Quiz Gameplay Rules */}
      <section className="bg-[#FFFDF7] rounded-2xl sm:rounded-3xl border-2 border-[#201e1d] p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d] overflow-hidden">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#C7D2FE] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-indigo-950 shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-heading font-black text-[#201e1d] flex items-center gap-2">
              Default Quiz Gameplay Rules
            </h2>
            <p className="text-xs sm:text-sm font-bold text-neutral-500 mt-0.5">
              Customize standard round lengths, timer mode, and diagram filtering
            </p>
          </div>
        </div>

        {/* Default Round Length */}
        <div className="mb-6">
          <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-2.5">
            Default Round Length
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
            {ROUND_LENGTH_OPTIONS.map((length) => {
              const isSelected = preferences.defaultRoundLength === length;
              return (
                <button
                  key={length}
                  type="button"
                  onClick={() => onUpdatePreferences({ defaultRoundLength: length })}
                  className={`min-w-0 px-2 py-3 sm:py-3.5 rounded-2xl font-heading font-black text-sm sm:text-base text-center transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                    isSelected
                      ? 'bg-[#FEF08A] text-[#201e1d] border-2 border-[#201e1d] shadow-[3px_3px_0_0_#201e1d]'
                      : 'bg-[#F9F4ED] text-[#201e1d] border-2 border-[#201e1d]/30 hover:border-[#201e1d] hover:bg-white'
                  }`}
                >
                  {length} Questions
                </button>
              );
            })}
          </div>
        </div>

        {/* Default Timer Mode */}
        <div className="mb-6">
          <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-2.5">
            Timer Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onUpdatePreferences({ defaultTimedMode: true })}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 overflow-hidden ${
                preferences.defaultTimedMode
                  ? 'bg-[#FFFDF7] border-[#201e1d] text-[#201e1d] shadow-[3px_3px_0_0_#201e1d]'
                  : 'bg-[#F9F4ED] border-[#201e1d]/30 text-neutral-600 hover:border-[#201e1d] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-heading font-black text-sm sm:text-base flex items-center gap-2 text-[#201e1d]">
                  <Clock className="w-4 h-4 text-rose-600" />
                  Timed (90s / Question)
                </span>
                {preferences.defaultTimedMode && <Check className="w-4 h-4 text-rose-700 stroke-[3]" />}
              </div>
              <p className="text-xs text-neutral-500 font-bold leading-relaxed">
                Simulates official Cambridge exam pacing (45 minutes for 30 questions).
              </p>
            </button>

            <button
              type="button"
              onClick={() => onUpdatePreferences({ defaultTimedMode: false })}
              className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 overflow-hidden ${
                !preferences.defaultTimedMode
                  ? 'bg-[#FFFDF7] border-[#201e1d] text-[#201e1d] shadow-[3px_3px_0_0_#201e1d]'
                  : 'bg-[#F9F4ED] border-[#201e1d]/30 text-neutral-600 hover:border-[#201e1d] hover:bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-heading font-black text-sm sm:text-base flex items-center gap-2 text-[#201e1d]">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Relaxed (Untimed)
                </span>
                {!preferences.defaultTimedMode && <Check className="w-4 h-4 text-emerald-700 stroke-[3]" />}
              </div>
              <p className="text-xs text-neutral-500 font-bold leading-relaxed">
                No countdown clock. Think deeply through tricky distractors without pressure.
              </p>
            </button>
          </div>
        </div>

        {/* Default Diagram Filter */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-neutral-500 mb-2.5">
            Default Diagram Filter
          </label>
          <div className="flex flex-col gap-2.5 sm:gap-3">
            {DIAGRAM_FILTER_OPTIONS.map((opt) => {
              const isSelected =
                preferences.defaultDiagramFilter === opt.value ||
                (opt.value === 'mixed' && preferences.defaultDiagramFilter === 'all') ||
                (opt.value === 'diagrams' && preferences.defaultDiagramFilter === 'diagram') ||
                (opt.value === 'no-diagrams' && preferences.defaultDiagramFilter === 'text');
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdatePreferences({ defaultDiagramFilter: opt.value })}
                  className={`p-3.5 sm:p-4 rounded-2xl border-2 text-left transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 overflow-hidden ${
                    isSelected
                      ? 'bg-[#FEF08A] border-[#201e1d] text-[#201e1d] shadow-[3px_3px_0_0_#201e1d]'
                      : 'bg-[#F9F4ED] border-[#201e1d]/30 text-[#201e1d] hover:border-[#201e1d] hover:bg-white'
                  }`}
                >
                  <div className="font-heading font-black text-sm mb-1 flex items-center justify-between">
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-[#201e1d] stroke-[3]" />}
                  </div>
                  <p className="text-xs text-neutral-600 font-bold leading-relaxed">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Audio, Leaderboard Privacy & Data Controls */}
      <section className="bg-[#FFFDF7] rounded-2xl sm:rounded-3xl border-2 border-[#201e1d] p-5 sm:p-7 shadow-[4px_4px_0_0_#201e1d] overflow-hidden">
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#FED7AA] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex items-center justify-center text-amber-950 shrink-0">
            <Volume2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-heading font-black text-[#201e1d] flex items-center gap-2">
              Audio, Privacy & Study Data Controls
            </h2>
            <p className="text-xs sm:text-sm font-bold text-neutral-500 mt-0.5">
              Manage procedural audio, global leaderboard opt-in, and local storage data
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Sound Effects Toggle */}
          <div className="p-4 rounded-2xl bg-[#F9F4ED] border-2 border-[#201e1d] flex items-center justify-between gap-3 shadow-[2px_2px_0_0_#201e1d] overflow-hidden">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-white border-2 border-[#201e1d] flex items-center justify-center text-[#201e1d] shadow-[1px_1px_0_0_#201e1d] shrink-0">
                {soundActive ? <Volume2 className="w-5 h-5 text-emerald-700" /> : <VolumeX className="w-5 h-5 text-neutral-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-heading font-black text-sm text-[#201e1d] block truncate">
                  Sound Effects (Web Audio Synthesizer)
                </span>
                <span className="text-xs text-neutral-500 font-bold">
                  Procedural chimes, buzzers, and celebratory fanfares for tactile answers.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleSound}
              className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-xl font-heading font-black text-xs border-2 border-[#201e1d] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none shadow-[2px_2px_0_0_#201e1d] ${
                soundActive
                  ? 'bg-[#BBF7D0] text-[#166534]'
                  : 'bg-white text-neutral-600'
              }`}
            >
              {soundActive ? 'ENABLED' : 'MUTED'}
            </button>
          </div>

          {/* Global Leaderboard Opt-In Toggle */}
          <div className="p-4 rounded-2xl bg-[#F9F4ED] border-2 border-[#201e1d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[2px_2px_0_0_#201e1d] overflow-hidden">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-white border-2 border-[#201e1d] flex items-center justify-center text-[#201e1d] shadow-[1px_1px_0_0_#201e1d] shrink-0">
                <Trophy className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-heading font-black text-sm text-[#201e1d] block">
                  Weekly Leaderboard Participation
                </span>
                <span className="text-xs text-neutral-500 font-bold">
                  Showcase your verified XP and streak rank among fellow Cambridge students.
                </span>
                {isDemoSession || !userProfile ? (
                  <span className="text-xs text-amber-800 font-bold block mt-0.5">
                    * Sign in with a student account to join the global leaderboard.
                  </span>
                ) : null}
                {leaderboardError && (
                  <span className="text-xs text-rose-600 font-bold block mt-0.5">
                    {leaderboardError}
                  </span>
                )}
              </div>
            </div>

            {isDemoSession || !userProfile ? (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="shrink-0 whitespace-nowrap px-4 py-2 rounded-xl bg-white hover:bg-[#FEF08A] text-[#201e1d] font-heading font-black text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
              >
                Sign In to Join
              </button>
            ) : (
              <button
                type="button"
                disabled={togglingLeaderboard}
                onClick={handleToggleLeaderboard}
                className={`shrink-0 whitespace-nowrap px-4 py-2 rounded-xl font-heading font-black text-xs border-2 border-[#201e1d] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none shadow-[2px_2px_0_0_#201e1d] disabled:opacity-50 ${
                  userProfile.opt_in_leaderboard
                    ? 'bg-[#FEF08A] text-[#201e1d]'
                    : 'bg-white text-neutral-600'
                }`}
              >
                {togglingLeaderboard
                  ? 'UPDATING...'
                  : userProfile.opt_in_leaderboard
                  ? 'OPTED IN'
                  : 'OPTED OUT'}
              </button>
            )}
          </div>

          {/* Reset Study Data & Sign Out Actions */}
          <div className="pt-4 border-t-2 border-[#201e1d]/10 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Reset Local Data */}
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="w-full sm:w-auto shrink-0 whitespace-nowrap px-4 py-2.5 min-h-[44px] rounded-xl bg-[#FFF1F2] hover:bg-[#FFE4E6] text-rose-800 font-heading font-black text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Reset Local Study Data</span>
              </button>
            ) : (
              <div className="w-full sm:w-auto p-3.5 rounded-2xl bg-[#FFF1F2] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex flex-col sm:flex-row items-center gap-2.5 overflow-hidden">
                <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5 shrink-0">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  Clear mistake review pile & history?
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleExecuteReset}
                    className="flex-1 sm:flex-none shrink-0 whitespace-nowrap px-3.5 py-2 min-h-[40px] rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-heading font-black text-xs border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] cursor-pointer"
                  >
                    Yes, Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 sm:flex-none shrink-0 whitespace-nowrap px-3.5 py-2 min-h-[40px] rounded-xl bg-white text-[#201e1d] font-heading font-black text-xs border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] hover:bg-neutral-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Sign Out */}
            <button
              type="button"
              disabled={signingOut}
              onClick={handleSignOut}
              className="w-full sm:w-auto shrink-0 whitespace-nowrap px-5 py-2.5 min-h-[44px] rounded-xl bg-white hover:bg-neutral-100 text-[#201e1d] font-heading font-black text-xs border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 text-[#201e1d]" />
              <span>{signingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

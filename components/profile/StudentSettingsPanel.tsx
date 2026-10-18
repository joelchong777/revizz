'use client';

import React, { useState, useEffect } from 'react';
import type { UserProfile } from '@/types';
import type { StudentPreferences } from '@/lib/studentProfile';
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
const DIAGRAM_FILTER_OPTIONS: Array<{ value: 'mixed' | 'diagrams' | 'no-diagrams'; label: string; desc: string }> = [
  { value: 'mixed', label: 'All Questions', desc: 'Mix of diagrams & text' },
  { value: 'diagrams', label: 'Diagrams Only', desc: 'Focus on graphs & visual stems' },
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
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-emerald-900 font-bold flex items-center gap-3 shadow-chunky">
          <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span>{resetSuccessMessage}</span>
        </div>
      )}

      {/* 1. Identity & Avatar Section */}
      <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 sm:p-7 shadow-chunky">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-brand-yellow/30 border-2 border-slate-800 flex items-center justify-center text-xl">
            {currentAvatar}
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              Identity & Student Profile
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-500">
              Personalize your revision badge, student nickname, and account credentials
            </p>
          </div>
        </div>

        {/* Avatar Picker */}
        <div className="mb-6">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
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
                  className={`h-14 sm:h-16 rounded-2xl text-2xl sm:text-3xl flex items-center justify-center transition-all duration-75 active:translate-y-0.5 active:border-b-2 active:shadow-none ${
                    isSelected
                      ? 'bg-amber-100 border-2 border-b-4 border-slate-900 shadow-chunky scale-105 ring-2 ring-brand-yellow'
                      : 'bg-slate-50 border-2 border-b-4 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
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
            className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2"
          >
            Display Name / Nickname
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              id="student-display-name"
              type="text"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              placeholder="e.g. Alex Cambridge"
              maxLength={40}
              className="flex-1 px-4 py-3 rounded-2xl border-2 border-slate-300 bg-white font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20 transition-all text-base"
            />
            <button
              type="submit"
              disabled={savingName || !displayNameInput.trim()}
              className="px-6 py-3 rounded-2xl bg-brand-yellow hover:bg-yellow-400 text-slate-900 font-extrabold border-2 border-b-4 border-slate-900 shadow-chunky transition-all active:translate-y-0.5 active:border-b-2 active:shadow-none duration-75 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {savingName ? (
                <span>Saving...</span>
              ) : nameSavedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-emerald-800" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Name</span>
              )}
            </button>
          </div>
        </form>

        {/* Account Badge & Verification Status */}
        <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center text-slate-700">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">
                  {userProfile?.email || 'Guest Student'}
                </span>
                {userProfile?.is_school_account ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                    🎓 School Account
                  </span>
                ) : userProfile && !isDemoSession ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-brand-indigo/15 text-indigo-900 border border-indigo-200">
                    <Sparkles className="w-3 h-3 text-indigo-600" />
                    Verified Student
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                    ⚡ Guest Session · Unsaved
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
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
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-brand-yellow hover:bg-yellow-400 text-slate-900 font-black text-xs border-2 border-b-3 border-slate-900 shadow-xs transition-all active:translate-y-0.5 active:border-b-2 duration-75 flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sign In to Save</span>
            </button>
          )}
        </div>
      </section>

      {/* 2. Cambridge Study Target & Exam Countdown Config */}
      <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 sm:p-7 shadow-chunky">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-teal-100 border-2 border-slate-800 flex items-center justify-center text-teal-800">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              Cambridge Study Target & Countdown
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-500">
              Configure your primary revision subject, exam series, and daily quota
            </p>
          </div>
        </div>

        {/* Primary Subject Selection */}
        <div className="mb-6">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
            Primary Revision Subject
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {SUBJECT_OPTIONS.map((subj) => {
              const isSelected = preferences.primarySubject === subj;
              return (
                <button
                  key={subj}
                  type="button"
                  onClick={() => onUpdatePreferences({ primarySubject: subj })}
                  className={`p-3.5 rounded-2xl font-bold text-sm text-left flex items-center justify-between transition-all duration-75 active:translate-y-0.5 active:border-b-2 active:shadow-none ${
                    isSelected
                      ? 'bg-brand-yellow text-slate-900 border-2 border-b-4 border-slate-900 shadow-chunky'
                      : 'bg-slate-50 text-slate-700 border-2 border-b-4 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-slate-700" />
                    {subj}
                  </span>
                  {isSelected && <Check className="w-4 h-4 text-slate-900 stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Target Exam Series & Year */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
              Target Exam Series
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SERIES_OPTIONS.map((series) => {
                const isSelected = preferences.targetExamSeries === series;
                return (
                  <button
                    key={series}
                    type="button"
                    onClick={() => onUpdatePreferences({ targetExamSeries: series })}
                    className={`py-3 rounded-2xl font-bold text-xs sm:text-sm text-center transition-all duration-75 active:translate-y-0.5 active:border-b-2 active:shadow-none ${
                      isSelected
                        ? 'bg-brand-teal text-white border-2 border-b-4 border-teal-900 shadow-chunky'
                        : 'bg-slate-50 text-slate-700 border-2 border-b-4 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {series}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
              Target Exam Year
            </label>
            <div className="grid grid-cols-3 gap-2">
              {YEAR_OPTIONS.map((year) => {
                const isSelected = preferences.targetExamYear === year;
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => onUpdatePreferences({ targetExamYear: year })}
                    className={`py-3 rounded-2xl font-bold text-xs sm:text-sm text-center transition-all duration-75 active:translate-y-0.5 active:border-b-2 active:shadow-none ${
                      isSelected
                        ? 'bg-brand-teal text-white border-2 border-b-4 border-teal-900 shadow-chunky'
                        : 'bg-slate-50 text-slate-700 border-2 border-b-4 border-slate-200 hover:bg-slate-100'
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
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
            Daily Question Target (Paced Revision)
          </label>
          <div className="grid grid-cols-5 gap-2">
            {GOAL_OPTIONS.map((goal) => {
              const isSelected = preferences.dailyQuestionGoal === goal;
              return (
                <button
                  key={goal}
                  type="button"
                  onClick={() => onUpdatePreferences({ dailyQuestionGoal: goal })}
                  className={`py-3 rounded-2xl font-extrabold text-sm sm:text-base text-center transition-all duration-75 active:translate-y-0.5 active:border-b-2 active:shadow-none ${
                    isSelected
                      ? 'bg-amber-400 text-slate-900 border-2 border-b-4 border-amber-900 shadow-chunky'
                      : 'bg-slate-50 text-slate-700 border-2 border-b-4 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {goal} <span className="text-xs font-semibold block sm:inline">Q/day</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. Default Quiz Gameplay Rules */}
      <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 sm:p-7 shadow-chunky">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-100 border-2 border-slate-800 flex items-center justify-center text-indigo-800">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              Default Quiz Gameplay Rules
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-500">
              Customize standard round lengths, timer mode, and diagram filtering
            </p>
          </div>
        </div>

        {/* Default Round Length */}
        <div className="mb-6">
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
            Default Round Length
          </label>
          <div className="grid grid-cols-4 gap-2.5">
            {ROUND_LENGTH_OPTIONS.map((length) => {
              const isSelected = preferences.defaultRoundLength === length;
              return (
                <button
                  key={length}
                  type="button"
                  onClick={() => onUpdatePreferences({ defaultRoundLength: length })}
                  className={`py-3 sm:py-3.5 rounded-2xl font-extrabold text-sm sm:text-base text-center transition-all duration-75 active:translate-y-0.5 active:border-b-2 active:shadow-none ${
                    isSelected
                      ? 'bg-brand-yellow text-slate-900 border-2 border-b-4 border-slate-900 shadow-chunky'
                      : 'bg-slate-50 text-slate-700 border-2 border-b-4 border-slate-200 hover:bg-slate-100'
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
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
            Timer Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onUpdatePreferences({ defaultTimedMode: true })}
              className={`p-4 rounded-2xl border-2 border-b-4 text-left transition-all duration-75 active:translate-y-0.5 active:border-b-2 active:shadow-none ${
                preferences.defaultTimedMode
                  ? 'bg-brand-coral/15 border-brand-coral text-slate-900 shadow-chunky'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-rose-600" />
                  Timed (90s / Question)
                </span>
                {preferences.defaultTimedMode && <Check className="w-4 h-4 text-rose-700 stroke-[3]" />}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                Simulates official Cambridge exam pacing (45 minutes for 30 questions).
              </p>
            </button>

            <button
              type="button"
              onClick={() => onUpdatePreferences({ defaultTimedMode: false })}
              className={`p-4 rounded-2xl border-2 border-b-4 text-left transition-all duration-75 active:translate-y-0.5 active:border-b-2 active:shadow-none ${
                !preferences.defaultTimedMode
                  ? 'bg-emerald-50 border-emerald-500 text-slate-900 shadow-chunky'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Relaxed (Untimed)
                </span>
                {!preferences.defaultTimedMode && <Check className="w-4 h-4 text-emerald-700 stroke-[3]" />}
              </div>
              <p className="text-xs text-slate-500 font-medium">
                No countdown clock. Think deeply through tricky distractors without pressure.
              </p>
            </button>
          </div>
        </div>

        {/* Default Diagram Filter */}
        <div>
          <label className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5">
            Default Diagram Filter
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {DIAGRAM_FILTER_OPTIONS.map((opt) => {
              const isSelected = preferences.defaultDiagramFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onUpdatePreferences({ defaultDiagramFilter: opt.value })}
                  className={`p-3.5 rounded-2xl border-2 border-b-4 text-left transition-all duration-75 active:translate-y-0.5 active:border-b-2 active:shadow-none ${
                    isSelected
                      ? 'bg-amber-100 border-slate-900 text-slate-900 shadow-chunky'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="font-extrabold text-sm mb-0.5 flex items-center justify-between">
                    <span>{opt.label}</span>
                    {isSelected && <Check className="w-4 h-4 text-slate-900 stroke-[3]" />}
                  </div>
                  <p className="text-xs text-slate-500 font-medium">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Audio, Leaderboard Privacy & Data Controls */}
      <section className="bg-white rounded-3xl border-2 border-b-4 border-slate-200 p-5 sm:p-7 shadow-chunky">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 border-2 border-slate-800 flex items-center justify-center text-amber-800">
            <Volume2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              Audio, Privacy & Study Data Controls
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-500">
              Manage procedural audio, global leaderboard opt-in, and local storage data
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Sound Effects Toggle */}
          <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center text-slate-700">
                {soundActive ? <Volume2 className="w-5 h-5 text-teal-600" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
              </div>
              <div>
                <span className="font-extrabold text-sm text-slate-900 block">
                  Sound Effects (Web Audio Synthesizer)
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Procedural chimes, buzzers, and celebratory fanfares for tactile answers.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleSound}
              className={`px-4 py-2 rounded-xl font-black text-xs border-2 border-b-3 transition-all duration-75 active:translate-y-0.5 active:border-b-2 shadow-xs ${
                soundActive
                  ? 'bg-brand-teal text-white border-teal-900'
                  : 'bg-slate-200 text-slate-600 border-slate-300'
              }`}
            >
              {soundActive ? 'ENABLED' : 'MUTED'}
            </button>
          </div>

          {/* Global Leaderboard Opt-In Toggle */}
          <div className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border-2 border-slate-300 flex items-center justify-center text-slate-700">
                <Trophy className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <span className="font-extrabold text-sm text-slate-900 block">
                  Weekly Leaderboard Participation
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Showcase your verified XP and streak rank among fellow Cambridge students.
                </span>
                {isDemoSession || !userProfile ? (
                  <span className="text-xs text-amber-700 font-bold block mt-0.5">
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
                className="px-4 py-2 rounded-xl bg-slate-200 text-slate-500 font-black text-xs border-2 border-slate-300 cursor-pointer hover:bg-slate-300"
              >
                Sign In to Join
              </button>
            ) : (
              <button
                type="button"
                disabled={togglingLeaderboard}
                onClick={handleToggleLeaderboard}
                className={`px-4 py-2 rounded-xl font-black text-xs border-2 border-b-3 transition-all duration-75 active:translate-y-0.5 active:border-b-2 shadow-xs disabled:opacity-50 ${
                  userProfile.opt_in_leaderboard
                    ? 'bg-amber-400 text-slate-900 border-amber-900'
                    : 'bg-slate-200 text-slate-600 border-slate-300'
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
          <div className="pt-4 border-t-2 border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Reset Local Data */}
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs border-2 border-b-3 border-rose-200 hover:border-rose-300 transition-all active:translate-y-0.5 active:border-b-2 duration-75 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Reset Local Study Data</span>
              </button>
            ) : (
              <div className="w-full sm:w-auto p-3 rounded-2xl bg-rose-50 border-2 border-rose-300 flex flex-col sm:flex-row items-center gap-2">
                <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  Clear mistake review pile & history?
                </span>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleExecuteReset}
                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs border border-rose-800 shadow-xs"
                  >
                    Yes, Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-white text-slate-700 font-extrabold text-xs border border-slate-300 hover:bg-slate-50"
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
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs border-2 border-b-3 border-slate-300 transition-all active:translate-y-0.5 active:border-b-2 duration-75 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 text-slate-600" />
              <span>{signingOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

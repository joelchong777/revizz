'use client';

import React, { useState, useEffect } from 'react';
import {
  UserProfile,
} from '@/types';
import {
  useAuth,
  switchActiveProfile,
  getCustomTestProfiles,
  deleteCustomTestProfile,
  createAndSwitchTestProfile,
  signInAsDemoStudent,
  signInAsGuestEducator,
  signInAsDemoAdmin,
  signInWithEmail,
  signInWithOtp,
  signInWithGoogle,
  signOut,
  isProviderNotEnabledError,
  DEFAULT_DEMO_STUDENT_PROFILE,
  DEFAULT_GUEST_EDUCATOR_PROFILE,
  DEFAULT_DEMO_ADMIN_PROFILE,
} from '@/lib/auth';
import { supabase } from '@/lib/supabaseClient';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  Users,
  UserPlus,
  LogIn,
  LogOut,
  GraduationCap,
  School,
  Shield,
  Trophy,
  Flame,
  Trash2,
  Check,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Mail,
  Lock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export interface ProfileSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole?: 'student' | 'teacher' | 'admin';
  onProfileSwitched?: (profile: UserProfile) => void;
}

export function ProfileSwitcherModal({
  isOpen,
  onClose,
  currentRole,
  onProfileSwitched,
}: ProfileSwitcherModalProps) {
  // Unconditional React hook declarations (React Error #310 Defense)
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profiles' | 'create' | 'login'>('profiles');
  const [customProfiles, setCustomProfiles] = useState<UserProfile[]>([]);

  // Create Profile Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'teacher' | 'admin'>('student');
  const [newIsSchool, setNewIsSchool] = useState(false);
  const [newXp, setNewXp] = useState('0');
  const [newStreak, setNewStreak] = useState('0');
  const [newCohort, setNewCohort] = useState('General');

  // Supabase Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [loadingSignOut, setLoadingSignOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Sync custom profiles from local storage when modal opens or profile changes
  useEffect(() => {
    if (isOpen) {
      setCustomProfiles(getCustomTestProfiles());
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  const refreshCustomList = () => {
    setCustomProfiles(getCustomTestProfiles());
  };

  const handleSwitch = (target: UserProfile) => {
    switchActiveProfile(target);
    if (onProfileSwitched) {
      onProfileSwitched(target);
    }
    onClose();
  };

  const handleDeleteCustom = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteCustomTestProfile(id);
    refreshCustomList();
  };

  const handleCreateAndSwitch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setErrorMessage('Please provide a name for the test profile.');
      return;
    }

    const created = createAndSwitchTestProfile({
      display_name: newName.trim(),
      email: newEmail.trim() || undefined,
      role: newRole,
      is_school_account: newIsSchool,
      total_xp: Math.max(0, parseInt(newXp, 10) || 0),
      current_streak: Math.max(0, parseInt(newStreak, 10) || 0),
      opt_in_leaderboard: false,
    });

    // Best-effort optional sync to Supabase if session exists
    try {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user?.id === created.id) {
        await supabase.from('profiles').upsert(created);
      }
    } catch {
      // Ignore background sync errors for local test profiles
    }

    refreshCustomList();
    if (onProfileSwitched) {
      onProfileSwitched(created);
    }
    onClose();
  };

  const handleGoogleAuth = async () => {
    try {
      setLoadingGoogle(true);
      setErrorMessage(null);
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      console.warn('Google sign-in attempt error:', err);
      if (isProviderNotEnabledError(err) || err?.code === 'PROVIDER_NOT_ENABLED') {
        setErrorMessage(
          'Google Sign-In is not currently enabled in Supabase. You can sign in with Email / Password or use a Demo Profile.'
        );
      } else {
        setErrorMessage(err?.message || 'Failed to authenticate with Google.');
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    try {
      setLoadingSubmit(true);
      setErrorMessage(null);
      await signInWithEmail(loginEmail.trim(), loginPassword);
      setSuccessMessage('Successfully signed in to Supabase!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Invalid email or password.');
    } finally {
      setLoadingSubmit(false);
    }
  };

  const handleOtpSignIn = async () => {
    if (!loginEmail.trim()) {
      setErrorMessage('Please enter your email address to receive a magic link.');
      return;
    }

    try {
      setLoadingOtp(true);
      setErrorMessage(null);
      await signInWithOtp(loginEmail.trim());
      setSuccessMessage('Magic link sent! Check your inbox to sign in instantly.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Could not send magic link. Please check the email address.');
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoadingSignOut(true);
      await signOut();
      setSuccessMessage('Successfully signed out of all local & cloud sessions.');
      refreshCustomList();
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error signing out.');
    } finally {
      setLoadingSignOut(false);
    }
  };

  const getRoleBadge = (role?: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-500 shadow-[1px_1px_0_0_#201e1d]">
            <Shield className="w-3 h-3" /> Admin
          </span>
        );
      case 'teacher':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-500 shadow-[1px_1px_0_0_#201e1d]">
            <School className="w-3 h-3" /> Teacher
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 border border-blue-500 shadow-[1px_1px_0_0_#201e1d]">
            <GraduationCap className="w-3 h-3" /> Student
          </span>
        );
    }
  };

  const isCurrentActive = (candidateId: string, candidateRole?: string) => {
    if (userProfile?.id) {
      return userProfile.id === candidateId;
    }
    if (currentRole && candidateRole) {
      return currentRole === candidateRole;
    }
    return false;
  };

  const defaultProfiles: UserProfile[] = [
    DEFAULT_DEMO_STUDENT_PROFILE,
    DEFAULT_GUEST_EDUCATOR_PROFILE,
    DEFAULT_DEMO_ADMIN_PROFILE,
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="w-[calc(100vw-24px)] sm:w-full sm:max-w-lg p-0 overflow-hidden border-2 border-[#201e1d] rounded-[28px] shadow-offset-4 bg-[#f9f4ed] text-[#201e1d] font-body max-h-[90vh] flex flex-col gap-0 select-none"
        aria-describedby="profile-switcher-desc"
      >
        {/* Neobrutalist Header Bar */}
        <DialogHeader className="p-4 sm:p-5 bg-amber-50/80 border-b-2 border-[#201e1d] flex flex-row items-center justify-between pr-12 space-y-0">
          <DialogTitle className="text-base sm:text-lg font-heading font-black text-[#201e1d] flex items-center gap-2">
            <span>🎭</span>
            <span>Profile & Role Switcher</span>
          </DialogTitle>
        </DialogHeader>

        <p id="profile-switcher-desc" className="sr-only">
          Switch between student, educator, and administrator test profiles, or sign in via Supabase.
        </p>

        {/* 3-Tab Segmented Control */}
        <div
          role="tablist"
          aria-label="Profile switcher modes"
          className="px-4 sm:px-6 pt-3 pb-2 bg-[#f9f4ed] border-b-2 border-[#201e1d]/15 flex items-center gap-2 shrink-0 overflow-x-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'profiles'}
            onClick={() => setActiveTab('profiles')}
            className={
              activeTab === 'profiles'
                ? 'flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-[#201e1d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-heading font-black text-xs py-2 px-3 rounded-xl transition-all cursor-pointer'
                : 'flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-white text-[#201e1d] border-2 border-[#201e1d] hover:bg-amber-50 shadow-[1px_1px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none font-bold text-xs py-2 px-3 rounded-xl transition-all cursor-pointer'
            }
          >
            <Users className="w-3.5 h-3.5" />
            <span>Profiles</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'create'}
            onClick={() => setActiveTab('create')}
            className={
              activeTab === 'create'
                ? 'flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-[#201e1d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-heading font-black text-xs py-2 px-3 rounded-xl transition-all cursor-pointer'
                : 'flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-white text-[#201e1d] border-2 border-[#201e1d] hover:bg-amber-50 shadow-[1px_1px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none font-bold text-xs py-2 px-3 rounded-xl transition-all cursor-pointer'
            }
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Test</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'login'}
            onClick={() => setActiveTab('login')}
            className={
              activeTab === 'login'
                ? 'flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-[#201e1d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-heading font-black text-xs py-2 px-3 rounded-xl transition-all cursor-pointer'
                : 'flex-1 min-w-[90px] flex items-center justify-center gap-1.5 bg-white text-[#201e1d] border-2 border-[#201e1d] hover:bg-amber-50 shadow-[1px_1px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none font-bold text-xs py-2 px-3 rounded-xl transition-all cursor-pointer'
            }
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Supabase</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(90vh-140px)] flex flex-col gap-4">
          {/* Active Profile Info Banner */}
          <div className="p-3.5 rounded-2xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border-2 border-[#201e1d] flex items-center justify-center text-lg font-heading font-black shrink-0">
                {userProfile?.display_name ? userProfile.display_name.charAt(0).toUpperCase() : '👤'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-heading font-black text-sm text-[#201e1d] truncate">
                    {userProfile?.display_name || 'Anonymous Guest'}
                  </span>
                  {getRoleBadge(userProfile?.role || currentRole || 'student')}
                </div>
                <div className="text-xs text-[#82796a] truncate">
                  {userProfile?.email || 'Local Sandbox Session'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-[#645c50] pt-1 sm:pt-0 border-t sm:border-t-0 border-[#201e1d]/10">
              <span className="inline-flex items-center gap-1" title="Total XP">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>{userProfile?.total_xp ?? 0} XP</span>
              </span>
              <span className="inline-flex items-center gap-1" title="Current Streak">
                <Flame className="w-3.5 h-3.5 text-red-500" />
                <span>{userProfile?.current_streak ?? 0}d</span>
              </span>
            </div>
          </div>

          {/* Feedback Banners */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border-2 border-red-500 text-xs font-bold text-red-800 flex items-start gap-2.5 shadow-[2px_2px_0_0_rgba(239,68,68,0.2)]">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-600 text-xs font-bold text-emerald-900 flex items-start gap-2.5 shadow-[2px_2px_0_0_rgba(5,150,105,0.2)]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{successMessage}</div>
            </div>
          )}

          {/* TAB 1: PROFILES */}
          {activeTab === 'profiles' && (
            <div className="flex flex-col gap-4">
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-[#82796a] mb-2">
                  Default Demo Accounts (1-Click Switch)
                </h4>
                <div className="flex flex-col gap-2">
                  {defaultProfiles.map((p) => {
                    const active = isCurrentActive(p.id, p.role);
                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-2xl border-2 border-[#201e1d] flex items-center justify-between gap-3 transition-all ${
                          active
                            ? 'bg-amber-100/70 shadow-[2px_2px_0_0_#201e1d]'
                            : 'bg-white hover:bg-amber-50/50 shadow-[1px_1px_0_0_#201e1d]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="shrink-0">{getRoleBadge(p.role)}</div>
                          <div className="min-w-0">
                            <div className="font-heading font-black text-xs sm:text-sm text-[#201e1d] truncate">
                              {p.display_name}
                            </div>
                            <div className="text-[11px] text-[#82796a] truncate">
                              {p.email || 'No email attached'} • {p.total_xp} XP
                            </div>
                          </div>
                        </div>

                        {active ? (
                          <span className="shrink-0 px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 shadow-[1px_1px_0_0_#201e1d]">
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSwitch(p)}
                            aria-label={`Switch to ${p.display_name}`}
                            className="shrink-0 px-3 py-1.5 rounded-xl bg-[#201e1d] text-white hover:bg-neutral-800 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-heading font-black text-xs transition-all cursor-pointer"
                          >
                            Switch
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom Test Profiles */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-[#82796a]">
                    Custom Test Profiles ({customProfiles.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() => setActiveTab('create')}
                    className="text-[11px] font-bold text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Add New</span>
                  </button>
                </div>

                {customProfiles.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-white/70 border-2 border-dashed border-[#201e1d]/30 text-center text-xs font-semibold text-[#82796a]">
                    No custom profiles created yet. Use the <strong>Create Test</strong> tab to configure realistic user scenarios!
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {customProfiles.map((p) => {
                      const active = isCurrentActive(p.id, p.role);
                      return (
                        <div
                          key={p.id}
                          className={`p-3 rounded-2xl border-2 border-[#201e1d] flex items-center justify-between gap-2.5 transition-all ${
                            active
                              ? 'bg-amber-100/70 shadow-[2px_2px_0_0_#201e1d]'
                              : 'bg-white hover:bg-amber-50/50 shadow-[1px_1px_0_0_#201e1d]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="shrink-0">{getRoleBadge(p.role)}</div>
                            <div className="min-w-0">
                              <div className="font-heading font-black text-xs sm:text-sm text-[#201e1d] truncate">
                                {p.display_name}
                              </div>
                              <div className="text-[11px] text-[#82796a] truncate">
                                {p.email} • {p.total_xp} XP • {p.current_streak}d streak
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {active ? (
                              <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 shadow-[1px_1px_0_0_#201e1d]">
                                <Check className="w-3.5 h-3.5" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSwitch(p)}
                                aria-label={`Switch to ${p.display_name}`}
                                className="px-3 py-1.5 rounded-xl bg-[#201e1d] text-white hover:bg-neutral-800 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none font-heading font-black text-xs transition-all cursor-pointer"
                              >
                                Switch
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCustom(e, p.id)}
                              aria-label={`Delete custom profile ${p.display_name}`}
                              className="p-1.5 rounded-xl bg-white hover:bg-red-50 text-red-600 border border-[#201e1d]/30 hover:border-red-500 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CREATE TEST PROFILE */}
          {activeTab === 'create' && (
            <form onSubmit={handleCreateAndSwitch} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1">
                  Full Name / Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Dr. Alex Mercer"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs sm:text-sm font-semibold text-[#201e1d] placeholder:text-[#a19786] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1">
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. alex.mercer@frontier.edu"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs sm:text-sm font-semibold text-[#201e1d] placeholder:text-[#a19786] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                />
              </div>

              {/* Role Toggle Pills */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1">
                  Role Permission *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('student');
                      setNewIsSchool(false);
                    }}
                    className={`py-2 px-2.5 rounded-xl border-2 border-[#201e1d] font-heading font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      newRole === 'student'
                        ? 'bg-blue-500 text-white shadow-[2px_2px_0_0_#201e1d]'
                        : 'bg-white text-[#201e1d] hover:bg-blue-50 shadow-[1px_1px_0_0_#201e1d]'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Student</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('teacher');
                      setNewIsSchool(true);
                    }}
                    className={`py-2 px-2.5 rounded-xl border-2 border-[#201e1d] font-heading font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      newRole === 'teacher'
                        ? 'bg-purple-600 text-white shadow-[2px_2px_0_0_#201e1d]'
                        : 'bg-white text-[#201e1d] hover:bg-purple-50 shadow-[1px_1px_0_0_#201e1d]'
                    }`}
                  >
                    <School className="w-3.5 h-3.5" />
                    <span>Teacher</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewRole('admin');
                      setNewIsSchool(true);
                    }}
                    className={`py-2 px-2.5 rounded-xl border-2 border-[#201e1d] font-heading font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      newRole === 'admin'
                        ? 'bg-amber-500 text-white shadow-[2px_2px_0_0_#201e1d]'
                        : 'bg-white text-[#201e1d] hover:bg-amber-50 shadow-[1px_1px_0_0_#201e1d]'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin</span>
                  </button>
                </div>
              </div>

              {/* School Account Toggle */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d]">
                <input
                  id="school-account-toggle"
                  type="checkbox"
                  checked={newIsSchool}
                  onChange={(e) => setNewIsSchool(e.target.checked)}
                  className="w-4 h-4 rounded border-[#201e1d] text-[#c67139] focus:ring-[#c67139] cursor-pointer"
                />
                <label htmlFor="school-account-toggle" className="text-xs font-bold text-[#201e1d] cursor-pointer select-none">
                  Flag as School / Institutional Account (Unlocks classroom roster features)
                </label>
              </div>

              {/* Stats Simulation: XP & Streak */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1">
                    Initial XP
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newXp}
                    onChange={(e) => setNewXp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-bold text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1">
                    Current Streak (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newStreak}
                    onChange={(e) => setNewStreak(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-bold text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                  />
                </div>
              </div>

              {/* Cohort Tag */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1">
                  Cohort / Class Group
                </label>
                <input
                  type="text"
                  value={newCohort}
                  onChange={(e) => setNewCohort(e.target.value)}
                  placeholder="e.g. 10-A, Economics-2026, General"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-semibold text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                />
              </div>

              <button
                type="submit"
                className="mt-2 w-full py-3 px-4 rounded-xl bg-[#201e1d] text-white hover:bg-neutral-800 border-2 border-[#201e1d] shadow-[3px_3px_0_0_#201e1d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 font-heading font-black text-sm cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Create & Switch Profile</span>
              </button>
            </form>
          )}

          {/* TAB 3: LOG IN / SUPABASE */}
          {activeTab === 'login' && (
            <div className="flex flex-col gap-3.5">
              {/* 1-Click Google OAuth */}
              <button
                type="button"
                onClick={handleGoogleAuth}
                disabled={loadingGoogle || loadingSubmit || loadingOtp}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-amber-50/50 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2.5 font-heading font-black text-xs sm:text-sm text-[#201e1d] cursor-pointer disabled:opacity-60"
              >
                {loadingGoogle ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#201e1d]" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>Continue with Google</span>
              </button>

              <div className="relative my-1 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t-2 border-[#201e1d]/15" />
                </div>
                <span className="relative bg-[#f9f4ed] px-3 text-[11px] font-bold text-[#82796a] uppercase tracking-wider">
                  or sign in with email
                </span>
              </div>

              {/* Email & Password Form */}
              <form onSubmit={handleEmailSignIn} className="flex flex-col gap-3">
                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#82796a]" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="e.g. educator@school.edu"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs sm:text-sm font-semibold text-[#201e1d] placeholder:text-[#a19786] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#82796a]" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs sm:text-sm font-semibold text-[#201e1d] placeholder:text-[#a19786] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="submit"
                    disabled={loadingSubmit}
                    className="py-2.5 px-3 rounded-xl bg-[#201e1d] text-white hover:bg-neutral-800 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center gap-1.5 font-heading font-black text-xs cursor-pointer disabled:opacity-60"
                  >
                    {loadingSubmit ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <ArrowRight className="w-3.5 h-3.5" />
                    )}
                    <span>Sign In</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOtpSignIn}
                    disabled={loadingOtp}
                    className="py-2.5 px-3 rounded-xl bg-white hover:bg-amber-50 text-[#201e1d] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center gap-1.5 font-bold text-xs cursor-pointer disabled:opacity-60"
                  >
                    {loadingOtp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#201e1d]" />
                    ) : (
                      <Mail className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    <span>Magic Link</span>
                  </button>
                </div>
              </form>

              {/* Sign Out Button */}
              <div className="pt-3 border-t-2 border-[#201e1d]/15">
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loadingSignOut}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-100 hover:bg-red-200 text-red-900 border-2 border-red-800 shadow-[2px_2px_0_0_#991b1b] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all flex items-center justify-center gap-2 font-heading font-black text-xs cursor-pointer disabled:opacity-60"
                >
                  {loadingSignOut ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-red-900" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5" />
                  )}
                  <span>Sign Out of All Sessions</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProfileSwitcherModal;

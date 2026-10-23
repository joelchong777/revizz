'use client';

import React, { useState, useEffect } from 'react';
import {
  signInWithGoogle,
  signInWithEmail,
  signInWithOtp,
  signUpWithEmail,
  requestPasswordReset,
  signInAsDemoStudent,
  isProviderNotEnabledError,
} from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Mail, Lock, User, Sparkles, CheckCircle2, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';

const GOOGLE_LOGIN_ENABLED = false;

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
  initialEmail?: string;
  initialInviteId?: string;
  onSuccess?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  initialMode = 'signin',
  initialEmail = '',
  initialInviteId,
  onSuccess,
}: AuthModalProps) {
  // Unconditional React hook declarations (React Error #310 Defense)
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>(initialMode);
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [loadingOtp, setLoadingOtp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode || 'signin');
      if (initialEmail) {
        setEmail(initialEmail);
      }
      setErrorMessage(null);
      setSuccessMessage(null);
      setAgreedToTerms(false);
    }
  }, [isOpen, initialMode, initialEmail]);

  const resetFormFeedback = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleTabChange = (newMode: 'signin' | 'signup' | 'forgot') => {
    setMode(newMode);
    resetFormFeedback();
  };

  // 1-Click Google Authentication
  const handleGoogleAuth = async () => {
    resetFormFeedback();
    setErrorMessage('Unavailable, log in with email');
  };

  // Sign In with Email & Password
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email and password.');
      return;
    }

    try {
      setLoadingSubmit(true);
      resetFormFeedback();
      await signInWithEmail(email.trim(), password);
      setSuccessMessage('Successfully signed in! Welcome back.');
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 600);
    } catch (err: any) {
      console.error('Sign-in error:', err);
      const msg = err?.message || 'Invalid email or password. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Sign Up with Email, Password & Display Name
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and choose a password.');
      return;
    }
    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }
    if (!agreedToTerms) {
      setErrorMessage('Please confirm you are 13 or older and agree to the Terms and Privacy Policy.');
      return;
    }

    try {
      setLoadingSubmit(true);
      resetFormFeedback();
      const res = await signUpWithEmail(email.trim(), password, displayName.trim() || undefined);
      if (res?.session) {
        setSuccessMessage('Account created successfully! Welcome to Revizz.');
        if (onSuccess) onSuccess();
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        setSuccessMessage('Account registered! If confirmation is required, please check your email inbox.');
      }
    } catch (err: any) {
      console.error('Sign-up error:', err);
      const msg = err?.message || 'Failed to create account. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Forgot password: always show the same message so we never reveal which emails have accounts
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    try {
      setLoadingReset(true);
      resetFormFeedback();
      await requestPasswordReset(email.trim());
      setSuccessMessage("If an account exists for that email, we've sent a reset link. Check your inbox.");
    } catch (err: any) {
      console.error('Password reset error:', err);
      setErrorMessage(err?.message || 'Could not send the reset link. Please try again.');
    } finally {
      setLoadingReset(false);
    }
  };

  // 1-Click Magic Link (OTP)
  const handleSendMagicLink = async () => {
    if (!email.trim()) {
      setErrorMessage('Please enter your email address first to receive a magic link.');
      return;
    }

    try {
      setLoadingOtp(true);
      resetFormFeedback();
      await signInWithOtp(email.trim(), displayName.trim() || undefined);
      setSuccessMessage('Magic link sent! Check your inbox to sign in instantly with 1 click.');
    } catch (err: any) {
      console.error('Magic link error:', err);
      const msg = err?.message || 'Could not send magic link. Please check your email address.';
      setErrorMessage(msg);
    } finally {
      setLoadingOtp(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[calc(100vw-24px)] sm:w-full sm:max-w-md p-0 overflow-hidden border-2 border-[#201e1d] rounded-3xl shadow-[4px_4px_0_0_#201e1d] bg-[#FFFDF7] text-[#201e1d] max-h-[90vh] flex flex-col gap-0 select-none">
        {/* Neobrutalist Header Bar */}
        <DialogHeader className="p-4 sm:p-5 bg-amber-50/80 border-b-2 border-[#201e1d] flex flex-row items-center justify-between pr-12 space-y-0">
          <DialogTitle className="text-base sm:text-lg font-heading font-black text-[#201e1d] flex items-center gap-2">
            <span>⚡</span>
            <span>{mode === 'signin' ? 'Sign In to Revizz' : mode === 'forgot' ? 'Reset Your Password' : 'Create Your Revizz Account'}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Tactile 2-Tab Segmented Control (hidden while resetting a password) */}
        {mode !== 'forgot' && (
        <div className="px-4 sm:px-6 pt-3 pb-2 bg-[#f9f4ed] border-b border-[#201e1d]/15 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleTabChange('signin')}
            className={
              mode === 'signin'
                ? 'flex-1 flex items-center justify-center gap-1.5 bg-[#201e1d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-heading font-black text-xs sm:text-sm py-2 px-3 rounded-xl transition-all cursor-pointer'
                : 'flex-1 flex items-center justify-center gap-1.5 bg-white text-slate-700 border-2 border-[#201e1d] hover:bg-amber-50 shadow-[1px_1px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none font-bold text-xs sm:text-sm py-2 px-3 rounded-xl transition-all cursor-pointer'
            }
          >
            <span>🔑</span>
            <span>Sign In</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('signup')}
            className={
              mode === 'signup'
                ? 'flex-1 flex items-center justify-center gap-1.5 bg-[#201e1d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] font-heading font-black text-xs sm:text-sm py-2 px-3 rounded-xl transition-all cursor-pointer'
                : 'flex-1 flex items-center justify-center gap-1.5 bg-white text-slate-700 border-2 border-[#201e1d] hover:bg-amber-50 shadow-[1px_1px_0_0_#201e1d] active:translate-y-0.5 active:shadow-none font-bold text-xs sm:text-sm py-2 px-3 rounded-xl transition-all cursor-pointer'
            }
          >
            <span>✨</span>
            <span>Create Account</span>
          </button>
        </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto max-h-[calc(90vh-140px)] flex flex-col gap-4">
          {/* Informational Pill / Invite Banner */}
          {initialInviteId ? (
            <div className="p-3 rounded-xl bg-amber-100 border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs font-bold text-[#201e1d] flex items-center gap-2">
              <span className="text-base shrink-0">🎟️</span>
              <span>You&apos;ve been invited to Revizz! Set your password to activate your account.</span>
            </div>
          ) : mode === 'signup' ? (
            <div className="p-3 rounded-xl bg-[#ccdbb2]/30 border-2 border-[#8fa073] text-xs font-bold text-[#272e1b] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#728157] shrink-0" />
              <span>Account will save your XP, streaks, and quiz history.</span>
            </div>
          ) : null}

          {/* Feedback: Error Alert */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border-2 border-red-500 text-xs font-bold text-red-800 flex items-start gap-2.5 shadow-[2px_2px_0_0_rgba(239,68,68,0.2)]">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* Feedback: Success Banner */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-600 text-xs font-bold text-emerald-900 flex items-start gap-2.5 shadow-[2px_2px_0_0_rgba(5,150,105,0.2)]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{successMessage}</div>
            </div>
          )}

          {GOOGLE_LOGIN_ENABLED && (
            <>
          {/* 1-Click Google OAuth Button */}
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
            <span>{mode === 'signin' ? 'Continue with Google' : 'Sign up with Google'}</span>
          </button>

          {/* Divider */}
          <div className="relative my-1 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-[#201e1d]/15" />
            </div>
            <span className="relative bg-[#FFFDF7] px-3 text-[11px] font-bold text-[#82796a] uppercase tracking-wider">
              {mode === 'signin' ? 'or with Email / Gmail' : 'or register with Email'}
            </span>
          </div>
            </>
          )}

          {/* Form */}
          {mode === 'forgot' ? (
          <form onSubmit={handleForgotPassword} className="flex flex-col gap-3.5">
            <p className="text-xs font-semibold text-[#645c50] m-0">
              Enter your account email and we&apos;ll send you a link to choose a new password.
            </p>
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#82796a]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. yourname@gmail.com"
                  autoComplete="email"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-base sm:text-sm font-semibold text-[#201e1d] placeholder:text-[#a19786] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loadingReset}
              className="w-full mt-1 py-3 px-4 min-h-[44px] rounded-xl bg-[#c67139] hover:bg-[#b2622d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 font-heading font-black text-xs sm:text-sm cursor-pointer disabled:opacity-60"
            >
              {loadingReset ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>Send reset link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => handleTabChange('signin')}
                className="min-h-[44px] px-2 text-xs font-bold text-[#c67139] hover:text-[#9e4e1e] hover:underline cursor-pointer"
              >
                Back to sign in
              </button>
            </div>
          </form>
          ) : (
          <form
            onSubmit={mode === 'signin' ? handleSignIn : handleSignUp}
            className="flex flex-col gap-3.5"
          >
            {/* Display Name Input (Sign Up mode only) */}
            {mode === 'signup' && (
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1">
                  Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#82796a]" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Jordan Lee"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs sm:text-sm font-semibold text-[#201e1d] placeholder:text-[#a19786] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                  />
                </div>
              </div>
            )}

            {/* Email Address Input */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#82796a]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. yourname@gmail.com"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs sm:text-sm font-semibold text-[#201e1d] placeholder:text-[#a19786] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-black uppercase tracking-wider text-[#201e1d]">
                  Password
                </label>
                {mode === 'signup' && (
                  <span className="text-[10px] font-bold text-[#82796a]">At least 8 characters</span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#82796a]" />
                <input
                  type="password"
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? '•••••••• (min 8 characters)' : '••••••••'}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] text-xs sm:text-sm font-semibold text-[#201e1d] placeholder:text-[#a19786] focus:outline-none focus:ring-2 focus:ring-[#c67139]"
                />
              </div>
              {mode === 'signin' && (
                <div className="mt-1 text-right">
                  <button
                    type="button"
                    onClick={() => handleTabChange('forgot')}
                    className="min-h-[44px] px-1 text-xs font-bold text-[#c67139] hover:text-[#9e4e1e] hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
              )}
            </div>

            {/* Age + consent (Sign Up mode only) */}
            {mode === 'signup' && (
              <label className="flex items-start gap-3 min-h-[44px] cursor-pointer text-xs font-semibold text-[#201e1d] leading-snug">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  required
                  className="mt-0.5 w-5 h-5 shrink-0 accent-[#c67139] cursor-pointer"
                />
                <span>
                  I&apos;m 13 or older and agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-black text-[#c67139] underline">
                    Terms
                  </a>{' '}
                  and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" className="font-black text-[#c67139] underline">
                    Privacy Policy
                  </a>
                </span>
              </label>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={loadingSubmit || loadingGoogle || loadingOtp || (mode === 'signup' && !agreedToTerms)}
              className="w-full mt-1 py-3 px-4 rounded-xl bg-[#c67139] hover:bg-[#b2622d] text-white border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 font-heading font-black text-xs sm:text-sm cursor-pointer disabled:opacity-60"
            >
              {loadingSubmit ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
          )}

          {/* 1-Click Magic Link Option (Sign In Mode) */}
          {mode === 'signin' && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleSendMagicLink}
                disabled={loadingOtp || loadingSubmit || loadingGoogle}
                className="text-xs font-bold text-[#c67139] hover:text-[#9e4e1e] hover:underline inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loadingOtp ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                <span>Send 1-Click Magic Link instead</span>
              </button>
            </div>
          )}

          {/* Guest / Demo Mode Button */}
          <div className="pt-3 border-t-2 border-[#201e1d]/15 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => {
                signInAsDemoStudent();
                if (onSuccess) onSuccess();
                onClose();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-[#ccdbb2] hover:bg-[#bccca1] text-[#201e1d] border-2 border-[#201e1d] shadow-[2px_2px_0_0_#201e1d] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center justify-center gap-2 font-heading font-black text-xs sm:text-sm cursor-pointer"
            >
              <span>⚡ Play as Guest / Demo Student</span>
            </button>
            <p className="text-[11px] text-center text-[#82796a] font-medium m-0">
              Instant access without an account · progress saved on device
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AuthModal;

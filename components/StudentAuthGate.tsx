'use client';

import React, { useState } from 'react';
import { signInWithGoogle, signInAsDemoStudent, isProviderNotEnabledError } from '@/lib/auth';
import { AuthModal } from './AuthModal';

interface StudentAuthGateProps {
  onSuccess?: () => void;
}

export function StudentAuthGate({ onSuccess }: StudentAuthGateProps) {
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoadingGoogle(true);
      setErrorMessage(null);
      await signInWithGoogle();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.warn('Google sign-in attempt:', err);
      if (isProviderNotEnabledError(err) || err?.code === 'PROVIDER_NOT_ENABLED') {
        setErrorMessage(
          'Google Sign-In is not currently enabled on this instance. Jump right in with Demo Mode below to begin revising!'
        );
      } else {
        const msg = err?.message || 'Unable to sign in with Google right now. Please try Demo Mode.';
        setErrorMessage(msg);
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  const handleDemoSignIn = () => {
    try {
      setLoadingDemo(true);
      setErrorMessage(null);
      signInAsDemoStudent();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Demo sign-in error:', err);
      setErrorMessage('Failed to start demo session. Please try again.');
    } finally {
      setLoadingDemo(false);
    }
  };

  return (
    <div className="w-full max-w-[460px] mx-auto p-2 sm:p-4 select-none">
      <div className="bg-neutral-100 border-4 border-text shadow-[6px_6px_0_#201e1d] rounded-3xl sm:rounded-[32px] p-6 sm:p-8 flex flex-col gap-6 text-center">
        {/* Top Badge */}
        <div className="flex justify-center">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-accent-2-200 border-2 border-text shadow-offset-2 font-bold text-xs uppercase tracking-wider text-text">
            <span>✨</span> Cambridge IGCSE MCQ Revision
          </span>
        </div>

        {/* Title & Subtitle */}
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl sm:text-4xl text-text leading-tight tracking-tight">
            Welcome to Revizz
          </h1>
          <p className="text-neutral-700 font-medium text-sm sm:text-[15px] leading-relaxed">
            Master past papers with spaced repetition, instant explanations, and tactile telemetry.
          </p>
        </div>

        {/* Error / Notice Banner */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-600 shadow-offset-2 text-left flex items-start gap-2.5">
            <span className="text-lg flex-shrink-0">💡</span>
            <p className="text-xs sm:text-sm font-semibold text-amber-900 leading-snug">
              {errorMessage}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3.5 pt-1">
          {/* Option 1: Google Login */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loadingGoogle || loadingDemo}
            className="w-full p-4 rounded-2xl bg-white hover:bg-neutral-50 border-2 border-text shadow-offset-3 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-3.5 text-left group disabled:opacity-60 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-neutral-100 border-2 border-text flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
              {loadingGoogle ? (
                <div className="w-5 h-5 border-2 border-text border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
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
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-heading text-base font-bold text-text leading-tight">
                Log In with Google
              </span>
              <span className="text-xs text-neutral-600 font-medium truncate mt-0.5">
                Save your XP, streaks, and join the weekly leaderboard
              </span>
            </div>
          </button>

          {/* Option 2: Demo Mode */}
          <button
            type="button"
            onClick={handleDemoSignIn}
            disabled={loadingGoogle || loadingDemo}
            className="w-full p-4 rounded-2xl bg-accent-200 hover:bg-accent-300 border-2 border-text shadow-offset-3 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-3.5 text-left group disabled:opacity-60 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-accent-300 border-2 border-text flex items-center justify-center flex-shrink-0 text-xl group-hover:scale-105 transition-transform">
              {loadingDemo ? (
                <div className="w-5 h-5 border-2 border-text border-t-transparent rounded-full animate-spin" />
              ) : (
                '⚡'
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-heading text-base font-bold text-text leading-tight">
                Try Demo Mode
              </span>
              <span className="text-xs text-neutral-700 font-medium truncate mt-0.5">
                Instant access without an account • progress saved locally
              </span>
            </div>
          </button>

          <div className="pt-1 text-center">
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="text-xs font-bold text-neutral-700 hover:text-text hover:underline cursor-pointer"
            >
              Or sign up / sign in with Email or Gmail →
            </button>
          </div>
        </div>

        {/* Clean Privacy Note */}
        <p className="text-[12px] text-neutral-600 font-medium leading-relaxed m-0">
          Zero tracking cookies. Switch to Google anytime from your profile.
        </p>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={onSuccess}
      />
    </div>
  );
}

export default StudentAuthGate;

'use client';

import React, { useState, useEffect } from 'react';
import { signInWithGoogle, signInAsDemoStudent, isProviderNotEnabledError } from '@/lib/auth';
import { AuthModal } from './AuthModal';

const GOOGLE_LOGIN_ENABLED = false;

interface StudentAuthGateProps {
  onSuccess?: () => void;
  initialEmail?: string;
  initialInviteId?: string;
  autoOpenAuthModal?: boolean;
}

export function StudentAuthGate({
  onSuccess,
  initialEmail,
  initialInviteId,
  autoOpenAuthModal,
}: StudentAuthGateProps) {
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [popupToast, setPopupToast] = useState<string | null>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAuthModalOpen, setAuthModalOpen] = useState(
    Boolean(autoOpenAuthModal || initialInviteId || initialEmail)
  );

  useEffect(() => {
    if (!popupToast) return;
    const timer = setTimeout(() => {
      setPopupToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [popupToast]);

  useEffect(() => {
    if (autoOpenAuthModal || initialInviteId || initialEmail) {
      if (initialInviteId || initialEmail) {
        setAuthModalMode('signup');
      }
      setAuthModalOpen(true);
    }
  }, [autoOpenAuthModal, initialInviteId, initialEmail]);

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
    <div className="w-full max-w-[460px] mx-auto p-2 sm:p-4 select-none relative">
      {/* Floating Popup Toast */}
      {popupToast && (
        <div
          role="alert"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#201e1d] text-white border-2 border-[#201e1d] rounded-2xl shadow-[4px_4px_0_0_#201e1d] px-4 py-2.5 sm:px-5 sm:py-3 flex items-center gap-2.5 text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <span className="text-base sm:text-lg flex-shrink-0">⚠️</span>
          <span>{popupToast}</span>
          <button
            type="button"
            onClick={() => setPopupToast(null)}
            aria-label="Close notification"
            className="ml-2 hover:opacity-75 font-mono text-sm leading-none cursor-pointer p-1"
          >
            ✕
          </button>
        </div>
      )}

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

        {/* Invitation Welcome Badge */}
        {(initialEmail || initialInviteId) && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setAuthModalMode('signup');
              setErrorMessage(null);
              setAuthModalOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setAuthModalMode('signup');
                setErrorMessage(null);
                setAuthModalOpen(true);
              }
            }}
            className="p-3.5 rounded-2xl bg-amber-100 hover:bg-amber-200 border-2 border-text shadow-offset-2 text-left flex items-start gap-2.5 cursor-pointer transition-colors"
          >
            <p className="text-xs sm:text-sm font-bold text-text leading-snug">
              {initialEmail
                ? `🎟️ Invitation detected for ${initialEmail}! Click below to complete account activation.`
                : '🎟️ Invitation detected! Click below to complete account activation.'}
            </p>
          </div>
        )}

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
          {/* Option 1: Log In */}
          <button
            type="button"
            onClick={() => {
              setAuthModalMode('signin');
              setErrorMessage(null);
              setAuthModalOpen(true);
            }}
            disabled={loadingDemo}
            className="w-full p-4 rounded-2xl bg-white hover:bg-neutral-50 border-2 border-text shadow-offset-3 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-3.5 text-left group disabled:opacity-60 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-neutral-100 border-2 border-text flex items-center justify-center flex-shrink-0 text-xl group-hover:scale-105 transition-transform">
              🔑
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-heading text-base font-bold text-text leading-tight">
                Log In
              </span>
              <span className="text-xs text-neutral-600 font-medium truncate mt-0.5">
                Sign in with email and password
              </span>
            </div>
          </button>

          {GOOGLE_LOGIN_ENABLED && (
            <>
          {/* Option 2: Log In with Google (Alternative option) */}
          <button
            type="button"
            onClick={() => {
              setPopupToast('Unavailable, log in with email');
              setErrorMessage('Unavailable, log in with email');
            }}
            disabled={loadingDemo}
            className="w-full p-4 rounded-2xl bg-white hover:bg-neutral-50 border-2 border-text shadow-offset-3 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all flex items-center gap-3.5 text-left group disabled:opacity-60 cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-neutral-100 border-2 border-text flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
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
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-heading text-base font-bold text-text leading-tight">
                Log In with Google
              </span>
              <span className="text-xs text-neutral-600 font-medium truncate mt-0.5">
                Alternative login option
              </span>
            </div>
          </button>
            </>
          )}

          {/* Option 3: Demo Mode */}
          <button
            type="button"
            onClick={handleDemoSignIn}
            disabled={loadingDemo}
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
              onClick={() => {
                setAuthModalMode('signup');
                setErrorMessage(null);
                setAuthModalOpen(true);
              }}
              className="text-xs font-bold text-neutral-700 hover:text-text hover:underline cursor-pointer"
            >
              Don&apos;t have an account? Sign up with email →
            </button>
          </div>
        </div>

        {/* Clean Privacy Note */}
        <p className="text-[12px] text-neutral-600 font-medium leading-relaxed m-0">
          Zero tracking cookies.
        </p>
      </div>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        initialEmail={initialEmail}
        initialInviteId={initialInviteId}
        onSuccess={onSuccess}
      />
    </div>
  );
}

export default StudentAuthGate;

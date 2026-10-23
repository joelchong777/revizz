'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth, updatePassword } from '@/lib/auth';

// How long we wait for supabase-js to turn the recovery token in the URL into a session.
const SESSION_WAIT_MS = 3000;

const cardClass =
  'w-full max-w-[480px] bg-neutral-100 border-4 border-text shadow-offset-6 rounded-3xl p-6 sm:p-8 flex flex-col gap-4';
const inputClass =
  'w-full h-14 px-4 rounded-2xl border-2 border-[#201e1d] bg-white font-body text-base text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-accent-200';
const buttonClass =
  'h-14 min-h-[44px] rounded-2xl bg-accent-200 border-4 border-text shadow-offset-4 font-heading font-black text-base text-[#201e1d] active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-60 flex items-center justify-center';

export default function ResetPasswordPage(): React.ReactElement {
  const { userProfile, isPasswordRecovery, isDemo } = useAuth();
  const [waited, setWaited] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), SESSION_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  // A leftover guest/demo session is not a real session, so it can't reset a password.
  const hasRealSession =
    isPasswordRecovery || (!!userProfile && !isDemo && !userProfile.id?.startsWith('demo-'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Your password needs at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Could not update your password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const icon = (emoji: string) => (
    <div className="w-12 h-12 mx-auto rounded-full bg-accent-200 border-2 border-text shadow-offset-2 flex items-center justify-center text-xl">
      {emoji}
    </div>
  );

  let content: React.ReactElement;

  if (done) {
    content = (
      <div className={`${cardClass} text-center`}>
        {icon('✅')}
        <h1 className="font-heading text-2xl font-black text-[#201e1d]">Password updated</h1>
        <p className="text-sm text-[#645c50]">You can now use your new password to sign in.</p>
        <Link href="/" className={buttonClass}>
          Continue to Revizz
        </Link>
      </div>
    );
  } else if (hasRealSession) {
    content = (
      <form onSubmit={handleSubmit} className={cardClass}>
        <div className="text-center flex flex-col gap-2">
          {icon('🔑')}
          <h1 className="font-heading text-2xl font-black text-[#201e1d]">Choose a new password</h1>
          <p className="text-sm text-[#645c50]">Pick a password you&apos;ll use to sign in from now on.</p>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-[#201e1d]">
          New password
          <div className="relative">
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className={`${inputClass} pr-12`}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-[#645c50] hover:text-[#201e1d] cursor-pointer"
            >
              {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-bold text-[#201e1d]">
          Confirm password
          <input
            type={show ? 'text' : 'password'}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
            className={inputClass}
          />
        </label>

        <p className="text-xs text-[#645c50]">At least 8 characters.</p>

        {error && (
          <p role="alert" className="text-sm font-bold text-[#9f1239] bg-[#fecdd3] border-2 border-text rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={saving} className={buttonClass}>
          {saving ? 'Saving...' : 'Update password'}
        </button>
      </form>
    );
  } else if (!waited) {
    content = (
      <div className={`${cardClass} text-center animate-pulse`} aria-busy="true">
        {icon('🔑')}
        <h1 className="font-heading text-2xl font-black text-[#201e1d]">Checking your link...</h1>
        <p className="text-sm text-[#645c50]">One moment while we verify your reset link.</p>
      </div>
    );
  } else {
    content = (
      <div className={`${cardClass} text-center`}>
        {icon('⏳')}
        <h1 className="font-heading text-2xl font-black text-[#201e1d]">This link has expired or was already used</h1>
        <p className="text-sm text-[#645c50]">
          Go back, choose &quot;Forgot password?&quot; on the sign-in screen, and we&apos;ll send you a new link.
        </p>
        <Link href="/" className={buttonClass}>
          Back to Revizz
        </Link>
      </div>
    );
  }

  return (
    <main className="w-full flex-1 flex flex-col items-center justify-center px-4 py-8">{content}</main>
  );
}

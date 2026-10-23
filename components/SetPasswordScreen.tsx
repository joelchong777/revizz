'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { completeFirstLoginPassword } from '@/lib/auth';

interface SetPasswordScreenProps {
  onDone: () => void;
}

export function SetPasswordScreen({ onDone }: SetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      const { error: updateError } = await completeFirstLoginPassword(password);
      if (updateError) {
        setError(updateError.message || 'Could not save your password. Please try again.');
        setSaving(false);
        return;
      }
      onDone();
    } catch {
      setError('Could not save your password. Please try again.');
      setSaving(false);
    }
  };

  const inputClass =
    'w-full h-14 px-4 rounded-2xl border-2 border-[#201e1d] bg-white font-body text-base text-[#201e1d] focus:outline-none focus:ring-2 focus:ring-accent-200';

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-[480px] bg-neutral-100 border-4 border-text shadow-offset-6 rounded-3xl p-6 sm:p-8 flex flex-col gap-4"
    >
      <div className="text-center flex flex-col gap-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-accent-200 border-2 border-text shadow-offset-2 flex items-center justify-center text-xl">
          🔑
        </div>
        <h1 className="font-heading text-2xl font-black text-[#201e1d]">Create your password</h1>
        <p className="text-sm text-[#645c50]">
          Welcome to Revizz! Choose a password you&apos;ll use to sign in next time.
        </p>
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
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#645c50] hover:text-[#201e1d] cursor-pointer"
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

      <button
        type="submit"
        disabled={saving}
        className="h-14 rounded-2xl bg-accent-200 border-4 border-text shadow-offset-4 font-heading font-black text-base text-[#201e1d] active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-60"
      >
        {saving ? 'Saving...' : 'Save password and continue'}
      </button>
    </form>
  );
}

export default SetPasswordScreen;

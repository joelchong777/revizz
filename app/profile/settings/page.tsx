import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { StudentProfileHub } from '@/components/profile/StudentProfileHub';

export const metadata: Metadata = {
  title: 'Profile Settings | Revizz',
  description:
    'Customize Cambridge exam countdown targets, quiz defaults, avatar, and study preferences.',
};

function ProfileLoadingFallback() {
  return (
    <div className="w-full py-12 px-4 flex items-center justify-center select-none">
      <div className="w-full max-w-md p-8 rounded-3xl bg-white border-2 border-b-4 border-slate-200 shadow-chunky text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 border-2 border-slate-800 flex items-center justify-center text-2xl animate-bounce">
          ⚙️
        </div>
        <h2 className="text-xl font-black text-slate-900">Loading Profile Settings...</h2>
        <p className="text-xs font-semibold text-slate-500">
          Preparing Cambridge study preferences and data controls
        </p>
      </div>
    </div>
  );
}

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={<ProfileLoadingFallback />}>
      <StudentProfileHub initialTab="settings" />
    </Suspense>
  );
}

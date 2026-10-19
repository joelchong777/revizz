import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { StudentProfileHub } from '@/components/profile/StudentProfileHub';

export const metadata: Metadata = {
  title: 'Assigned Homework & Tests | Revizz',
  description: 'View and complete your assigned Cambridge IGCSE revision tasks and online tests.',
};

function HomeworkLoadingFallback() {
  return (
    <div className="w-full py-12 px-4 flex items-center justify-center select-none">
      <div className="w-full max-w-md p-8 rounded-3xl bg-white border-2 border-[#201e1d] shadow-[4px_4px_0_0_#201e1d] text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FEF08A] border-2 border-[#201e1d] flex items-center justify-center text-2xl animate-bounce shadow-[2px_2px_0_0_#201e1d]">
          📝
        </div>
        <h2 className="text-xl font-heading font-black text-[#201e1d]">Loading Homework...</h2>
        <p className="text-xs font-semibold text-neutral-600">
          Gathering assigned Cambridge IGCSE tasks and test codes
        </p>
      </div>
    </div>
  );
}

export default function HomeworkPage() {
  return (
    <Suspense fallback={<HomeworkLoadingFallback />}>
      <StudentProfileHub initialTab="homework" />
    </Suspense>
  );
}

'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { Header } from './Header';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isPortalOrAdmin = pathname?.startsWith('/portal') || pathname?.startsWith('/admin');
  const isProfile = pathname?.startsWith('/profile');

  // Educator Portal and App Admin render their own unconstrained full-width layout
  if (isPortalOrAdmin) {
    return <>{children}</>;
  }

  // Student App ('/'): framed canvas on desktop (max-w-xl), fluid on mobile & tablet
  // Student Profile ('/profile'): expanded framed desktop canvas (max-w-5xl)
  return (
    <div
      className={`w-full ${
        isProfile ? 'max-w-5xl' : 'max-w-xl'
      } mx-auto md:my-8 md:p-6 md:rounded-3xl md:border-4 md:border-slate-800 md:shadow-[0_16px_0_0_rgba(15,23,42,0.15)] bg-amber-50/60 min-h-screen md:min-h-[85vh] flex flex-col px-3 sm:px-4 transition-all duration-300`}
    >
      <Header />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}

export default AppShell;

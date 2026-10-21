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

  // Educator Portal and App Admin render their own unconstrained full-width layout
  if (isPortalOrAdmin) {
    return <>{children}</>;
  }

  // Student App ('/' and '/profile'): Unified Mobile & Tablet-First Framed Canvas
  return (
    <div
      className="w-full max-w-xl md:max-w-2xl mx-auto md:my-8 md:rounded-3xl md:border-4 md:border-text md:shadow-offset-6 bg-bg min-h-screen md:min-h-[85vh] flex flex-col"
    >
      <Header />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}

export default AppShell;

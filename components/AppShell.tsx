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

  // Student App ('/'): framed canvas on desktop, fluid on mobile & tablet
  return (
    <div className="w-full max-w-xl mx-auto md:my-8 md:p-6 md:rounded-[32px] md:border-[1.5px] md:border-[#201e1d]/20 md:shadow-[0_24px_64px_-12px_rgba(32,30,29,0.14),0_0_0_1px_rgba(255,255,255,0.7)] bg-[#f7efe4]/95 backdrop-blur-xl min-h-screen md:min-h-[85vh] flex flex-col px-3 sm:px-4">
      <Header />
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
}

export default AppShell;

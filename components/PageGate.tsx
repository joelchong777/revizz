'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { usePageVisibility } from '@/lib/pageVisibility';

/**
 * Access helper shared by gates, header menus and tab bars.
 * Admins are never blocked. Until the visibility list loads we fail open
 * (render everything) so pages do not flash an "unavailable" card.
 */
export function usePageAccess() {
  const { userProfile } = useAuth();
  const { hidden, loaded, isHidden } = usePageVisibility();
  const isAdmin = userProfile?.role === 'admin';
  return {
    isAdmin,
    loaded,
    hidden,
    /** true when this page must be blocked for the current user */
    isBlocked: (id: string) => !isAdmin && loaded && isHidden(id),
    /** true when hidden for regular users (admins may see a marker) */
    isHiddenForUsers: (id: string) => loaded && isHidden(id),
  };
}

interface PageGateProps {
  pageId: string;
  children: React.ReactNode;
  /** Where the "back" link goes. Defaults to home. */
  fallbackHref?: string;
  fallbackLabel?: string;
}

export function PageGate({
  pageId,
  children,
  fallbackHref = '/',
  fallbackLabel = 'Back to Quiz Arena',
}: PageGateProps): React.ReactElement {
  const { isBlocked } = usePageAccess();

  if (!isBlocked(pageId)) {
    return <>{children}</>;
  }

  return <PageUnavailableCard href={fallbackHref} label={fallbackLabel} />;
}

export function PageUnavailableCard({
  href = '/',
  label = 'Back to Quiz Arena',
}: {
  href?: string;
  label?: string;
}): React.ReactElement {
  return (
    <div
      role="status"
      data-testid="page-unavailable"
      className="w-full max-w-[480px] mx-auto my-8 px-3"
    >
      <div className="bg-neutral-100 border-4 border-text shadow-offset-6 rounded-3xl p-8 text-center flex flex-col gap-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-accent-200 border-2 border-text shadow-offset-2 flex items-center justify-center text-xl">
          🔒
        </div>
        <h2 className="text-xl font-heading font-black text-text">Page unavailable</h2>
        <p className="text-sm font-semibold text-neutral-600">
          This page has been turned off by your administrator.
        </p>
        <Link
          href={href}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-2xl bg-accent-200 border-2 border-text shadow-offset-2 font-heading font-black text-sm text-text transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
        >
          {label}
        </Link>
      </div>
    </div>
  );
}

export default PageGate;

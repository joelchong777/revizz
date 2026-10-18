'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  History,
  Sparkles,
  BookOpen,
  Flag,
  Activity,
  Building2,
  GraduationCap,
  Home,
  X,
  ShieldCheck,
  Sliders,
  Megaphone,
} from 'lucide-react';

export interface AppAdminNavProps {
  active?: string;
  onSelectTab?: (tab: string) => void;
  compact?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  userDisplayName?: string;
  flaggedCount?: number;
  questionCount?: number;
  questionsLoading?: boolean;
}

export default function AppAdminNav({
  active = 'ingestion',
  onSelectTab,
  compact = false,
  isOpen = false,
  onClose,
  userDisplayName = 'Administrator',
  flaggedCount = 0,
  questionCount,
  questionsLoading = false,
}: AppAdminNavProps) {
  const handleNavClick = (tabKey: string) => {
    if (onSelectTab) {
      onSelectTab(tabKey);
    }
    if (onClose) {
      onClose();
    }
  };

  const navItemClass = (tabKey: string) => {
    const isActive = active === tabKey;
    return `w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 text-[13px] select-none cursor-pointer group text-left ${
      isActive
        ? 'bg-[#ffe1d0] text-[#201e1d] font-bold border-[1.5px] border-[#201e1d] shadow-offset-2'
        : 'bg-transparent text-[#474238] font-medium border-[1.5px] border-transparent hover:bg-[#f5ead8] hover:text-[#201e1d] hover:border-[#201e1d]/15 active:translate-y-0.5'
    } ${compact ? 'justify-center px-2' : ''}`;
  };

  const renderIcon = (Icon: React.ElementType, tabKey: string) => {
    const isActive = active === tabKey;
    return (
      <span
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          isActive
            ? 'bg-[#201e1d] text-[#f9f4ed]'
            : 'bg-[#f5ead8] text-[#645c50] group-hover:bg-[#ffe1d0] group-hover:text-[#201e1d]'
        }`}
      >
        <Icon className="w-4 h-4" />
      </span>
    );
  };

  return (
    <aside
      className={`h-full flex flex-col justify-between p-3.5 box-border bg-[#ebddc5] border-r-2 border-[#201e1d] font-body text-[#201e1d] z-30 transition-all ${
        compact ? 'w-[76px]' : 'w-[264px]'
      }`}
    >
      <div className="flex flex-col gap-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="w-9 h-9 shrink-0 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center -rotate-6 hover:rotate-0 transition-transform shadow-offset-2"
              title="Student Home"
            >
              <span className="font-heading font-black text-sm text-[#201e1d]">R</span>
            </Link>
            {!compact && (
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-black text-lg tracking-tight leading-none text-[#201e1d]">
                    REVIZZ
                  </span>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#645c50] font-bold mt-0.5">
                  Command Deck
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isOpen && (
              <button
                type="button"
                onClick={onClose}
                className="lg:hidden p-1 rounded-xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-colors"
                aria-label="Close admin navigation"
              >
                <X className="w-4 h-4 text-[#201e1d]" />
              </button>
            )}
          </div>
        </div>

        {/* Platform Ops Badge */}
        {!compact && (
          <div className="px-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ccdbb2] text-[#201e1d] border border-[#201e1d] font-mono text-[10px] font-bold tracking-wider shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              APP ADMIN · PLATFORM OPS
            </span>
          </div>
        )}

        {/* Quick Cross-Portal Switcher Actions */}
        <div className="flex flex-col gap-1.5 pt-0.5">
          <Link
            href="/portal"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#ffe1d0] border-[1.5px] border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all text-xs font-bold text-[#201e1d] group cursor-pointer active:translate-x-[1px] active:translate-y-[1px] ${
              compact ? 'justify-center px-1' : ''
            }`}
            title="Open Teacher Classroom Portal"
          >
            <span className="w-7 h-7 rounded-lg bg-[#201e1d] text-[#f9f4ed] flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform">
              <GraduationCap className="w-4 h-4" />
            </span>
            {!compact && (
              <>
                <span className="flex-1 min-w-0 truncate font-bold text-[13px] text-[#201e1d]">Teacher Portal</span>
                <span className="text-xs shrink-0">🎓</span>
              </>
            )}
          </Link>

          <Link
            href="/"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#f5ead8] border-[1.5px] border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-all text-xs font-bold text-[#474238] hover:text-[#201e1d] group cursor-pointer active:translate-x-[1px] active:translate-y-[1px] ${
              compact ? 'justify-center px-1' : ''
            }`}
            title="Return to Student Practice"
          >
            <span className="w-7 h-7 rounded-lg bg-[#ebddc5] text-[#474238] flex items-center justify-center shrink-0 border border-[#201e1d]/20 group-hover:bg-[#201e1d] group-hover:text-[#f9f4ed] transition-colors">
              <Home className="w-4 h-4" />
            </span>
            {!compact && (
              <>
                <span className="flex-1 min-w-0 truncate font-bold text-[13px]">Student Home</span>
                <span className="text-xs shrink-0">🏠</span>
              </>
            )}
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-0.5 no-scrollbar">
          {/* Section 1: Content Pipeline */}
          <div>
            {!compact && (
              <div className="px-2 mb-1.5 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#645c50] font-bold">
                  Content Pipeline
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            )}
            <nav className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleNavClick('ingestion')}
                className={navItemClass('ingestion')}
                title="Ingestion Studio"
              >
                {renderIcon(FileText, 'ingestion')}
                {!compact && (
                  <span className="flex-1 min-w-0 truncate">Ingestion Studio</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('history')}
                className={navItemClass('history')}
                title="Ingestion History"
              >
                {renderIcon(History, 'history')}
                {!compact && (
                  <>
                    <span className="flex-1 min-w-0 truncate">Ingestion History</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-[#f5ead8] text-[#474238] text-[10px] font-mono font-bold border border-[#201e1d]/20 shrink-0">
                      Ledger
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('diagnostics')}
                className={navItemClass('diagnostics')}
                title="Ingestion Diagnostics"
              >
                {renderIcon(Sparkles, 'diagnostics')}
                {!compact && (
                  <>
                    <span className="flex-1 min-w-0 truncate">Ingestion Diagnostics</span>
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f0fae1] text-[#3d472b] text-[10px] font-bold border border-[#201e1d]/15 shrink-0 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      <span>Live</span>
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('bank')}
                className={navItemClass('bank')}
                title="Global Question Bank"
              >
                {renderIcon(BookOpen, 'bank')}
                {!compact && (
                  <>
                    <span className="flex-1 min-w-0 truncate">Global Question Bank</span>
                    {questionsLoading ? (
                      <span className="w-6 h-4 rounded-full bg-[#f5ead8] border border-[#201e1d]/20 animate-pulse shrink-0" />
                    ) : questionCount !== undefined ? (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#f9f4ed] text-[#201e1d] font-mono text-[10px] font-bold border border-[#201e1d]/20 shrink-0">
                        {questionCount}
                      </span>
                    ) : null}
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('flagged')}
                className={navItemClass('flagged')}
                title="Flagged Questions"
              >
                {renderIcon(Flag, 'flagged')}
                {!compact && (
                  <>
                    <span className="flex-1 min-w-0 truncate">Flagged Questions</span>
                    {flaggedCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-[#ffc6a5] text-[#8c491a] text-[10px] font-black border border-[#201e1d]/25 flex items-center justify-center shrink-0">
                        {flaggedCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            </nav>
          </div>

          {/* Section 2: Platform & System */}
          <div>
            {!compact && (
              <div className="px-2 mb-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#645c50] font-bold">
                  Platform & System
                </span>
              </div>
            )}
            <nav className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleNavClick('settings')}
                className={navItemClass('settings')}
                title="Settings"
              >
                {renderIcon(Sliders, 'settings')}
                {!compact && (
                  <>
                    <span className="flex-1 min-w-0 truncate">Settings</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-[#ccdbb2] text-[#272e1b] text-[10px] font-mono font-bold border border-[#201e1d]/25 shrink-0">
                      6 Panels
                    </span>
                  </>
                )}
              </button>

              {/* Note: portal-menu (Portal Menu Manager) has moved into the Settings hub (?tab=settings&sub=portal-menu) */}

              <button
                type="button"
                onClick={() => handleNavClick('ads')}
                className={navItemClass('ads')}
                title="Ads & Monetization"
              >
                {renderIcon(Megaphone, 'ads')}
                {!compact && (
                  <>
                    <span className="flex-1 min-w-0 truncate">Ads & Monetization</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-[#ffe1d0] text-[#201e1d] text-[10px] font-mono font-bold border border-[#201e1d]/25 shrink-0">
                      Studio
                    </span>
                  </>
                )}
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Footer Profile & Security Pill */}
      <div className="pt-3 border-t-2 border-[#201e1d]/15 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] flex items-center justify-center font-heading font-black text-xs text-[#201e1d] shrink-0 shadow-offset-2">
            {(() => {
              const trimmed = (userDisplayName || '').trim();
              if (!trimmed) return 'AD';
              const parts = trimmed.split(/\s+/).filter(Boolean);
              if (parts.length >= 2) {
                return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
              }
              return trimmed.slice(0, 2).toUpperCase();
            })()}
          </div>
          {!compact && (
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black text-[#201e1d] truncate">
                {userDisplayName}
              </span>
              <span className="text-[10px] font-bold text-[#645c50] flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-700" />
                Super Admin
              </span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

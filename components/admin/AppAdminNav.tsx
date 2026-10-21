'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
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
  Users,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  onOpenProfileSwitcher?: () => void;
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
  onOpenProfileSwitcher,
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
    return `w-full flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all duration-150 text-[12px] select-none cursor-pointer group text-left ${
      isActive
        ? 'bg-[#ffe1d0] text-[#201e1d] font-bold border-[1.5px] border-[#201e1d] shadow-offset-2'
        : 'bg-transparent text-[#474238] font-medium border-[1.5px] border-transparent hover:bg-[#f5ead8] hover:text-[#201e1d] hover:border-[#201e1d]/15 active:translate-y-0.5'
    } ${compact ? 'justify-center px-2' : ''}`;
  };

  const renderIcon = (Icon: React.ElementType, tabKey: string) => {
    const isActive = active === tabKey;
    return (
      <span
        className={`w-6.5 h-6.5 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          isActive
            ? 'bg-[#201e1d] text-[#f9f4ed]'
            : 'bg-[#f5ead8] text-[#645c50] group-hover:bg-[#ffe1d0] group-hover:text-[#201e1d]'
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
    );
  };

  return (
    <aside
      className={`h-full flex flex-col justify-between p-2.5 box-border bg-[#ebddc5] border-r-2 border-[#201e1d] font-body text-[#201e1d] z-30 transition-all ${
        compact ? 'w-[76px]' : 'w-[180px] shrink-0'
      }`}
    >
      <div className="flex flex-col gap-4">
        {/* Brand Header */}
        <div className={cn("flex items-center px-1", compact ? (isOpen ? 'justify-between' : 'justify-center') : 'justify-between')}>
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="w-8 h-8 shrink-0 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center -rotate-6 hover:rotate-0 transition-transform shadow-offset-2"
              title="Student Home"
            >
              <span className="font-heading font-black text-sm text-[#201e1d]">R</span>
            </Link>
            {!compact && (
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-black text-base tracking-tight leading-none text-[#201e1d]">
                    REVIZZ
                  </span>
                </div>
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

        {/* Quick Cross-Portal Switcher Actions */}
        <div className="flex flex-col gap-1.5 pt-0.5">
          <Link
            href="/portal"
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#ffe1d0] border-[1.5px] border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all text-[12px] font-bold text-[#201e1d] group cursor-pointer active:translate-x-[1px] active:translate-y-[1px] ${
              compact ? 'justify-center px-1' : ''
            }`}
            title="Open Teacher Classroom Portal"
          >
            <span className="w-6.5 h-6.5 rounded-lg bg-[#201e1d] text-[#f9f4ed] flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform">
              <GraduationCap className="w-3.5 h-3.5" />
            </span>
            {!compact && (
              <>
                <span className="flex-1 min-w-0 truncate font-bold text-[12px] text-[#201e1d]">Teacher Portal</span>
                <span className="text-xs shrink-0">🎓</span>
              </>
            )}
          </Link>

          <Link
            href="/"
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#f5ead8] border-[1.5px] border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-all text-[12px] font-bold text-[#474238] hover:text-[#201e1d] group cursor-pointer active:translate-x-[1px] active:translate-y-[1px] ${
              compact ? 'justify-center px-1' : ''
            }`}
            title="Return to Student Practice"
          >
            <span className="w-6.5 h-6.5 rounded-lg bg-[#ebddc5] text-[#474238] flex items-center justify-center shrink-0 border border-[#201e1d]/20 group-hover:bg-[#201e1d] group-hover:text-[#f9f4ed] transition-colors">
              <Home className="w-3.5 h-3.5" />
            </span>
            {!compact && (
              <>
                <span className="flex-1 min-w-0 truncate font-bold text-[12px]">Student Home</span>
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
                onClick={() => handleNavClick('papers')}
                className={navItemClass('papers')}
                title="Whole Paper Viewer"
              >
                {renderIcon(BookOpen, 'papers')}
                {!compact && (
                  <span className="flex-1 min-w-0 truncate">Whole Papers</span>
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
                  <span className="flex-1 min-w-0 truncate">Global Question Bank</span>
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
                onClick={() => handleNavClick('users')}
                className={navItemClass('users')}
                title="User Management"
              >
                {renderIcon(Users, 'users')}
                {!compact && (
                  <span className="flex-1 min-w-0 truncate">User Management</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('settings')}
                className={navItemClass('settings')}
                title="Settings"
              >
                {renderIcon(Sliders, 'settings')}
                {!compact && (
                  <span className="flex-1 min-w-0 truncate">Settings</span>
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
                  <span className="flex-1 min-w-0 truncate">Ads & Monetization</span>
                )}
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Footer Profile & Security Pill */}
      <div className={`pt-3 border-t-2 border-[#201e1d]/15 flex ${compact ? 'flex-col items-center justify-center gap-2' : 'items-center justify-between gap-2'}`}>
        <div
          onClick={onOpenProfileSwitcher}
          className={`flex items-center gap-2 min-w-0 ${onOpenProfileSwitcher ? 'cursor-pointer group' : ''}`}
          title={onOpenProfileSwitcher ? 'Switch Profile & Role' : undefined}
          role={onOpenProfileSwitcher ? 'button' : undefined}
          tabIndex={onOpenProfileSwitcher ? 0 : undefined}
          onKeyDown={
            onOpenProfileSwitcher
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') onOpenProfileSwitcher();
                }
              : undefined
          }
        >
          <div className="w-7 h-7 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] flex items-center justify-center font-heading font-black text-xs text-[#201e1d] shrink-0 shadow-offset-2 group-hover:scale-105 transition-transform">
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
              <span className="text-[11px] font-bold text-[#201e1d] truncate group-hover:text-[#c67139] transition-colors">
                {userDisplayName}
              </span>
              <span className="text-[9px] font-bold text-[#645c50] truncate flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                Super Admin
              </span>
            </div>
          )}
        </div>

        {onOpenProfileSwitcher && (
          <button
            type="button"
            onClick={onOpenProfileSwitcher}
            title="Switch profile & role"
            aria-label="Switch profile"
            className={compact
              ? "w-8 h-8 rounded-xl bg-white hover:bg-amber-100 text-[#201e1d] border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center justify-center shrink-0"
              : "px-1.5 py-1 rounded-xl bg-white hover:bg-amber-100 text-[#201e1d] border-2 border-[#201e1d] shadow-[1px_1px_0_0_#201e1d] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold shrink-0"
            }
          >
            <ArrowRightLeft className="w-3 h-3 text-[#c67139] shrink-0" />
            {!compact && <span>Switch</span>}
          </button>
        )}
      </div>
    </aside>
  );
}

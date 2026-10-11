'use client';

import React from 'react';
import Link from 'next/link';
import {
  FileText,
  Layers,
  Sparkles,
  BookOpen,
  Flag,
  Activity,
  Building2,
  GraduationCap,
  Home,
  X,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';

export interface AppAdminNavProps {
  active?: string;
  onSelectTab?: (tab: string) => void;
  compact?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  userDisplayName?: string;
}

export default function AppAdminNav({
  active = 'ingestion',
  onSelectTab,
  compact = false,
  isOpen = false,
  onClose,
  userDisplayName = 'Administrator',
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
    return `w-full flex items-center justify-between px-3 py-2.5 rounded-2xl transition-all text-sm select-none cursor-pointer border-2 ${
      isActive
        ? 'bg-[#ffe1d0] text-[#201e1d] font-black border-[#201e1d] shadow-offset-2'
        : 'bg-transparent text-[#474238] font-bold border-transparent hover:bg-[#f5ead8] hover:border-[#201e1d]/20 active:translate-y-0.5'
    }`;
  };

  return (
    <aside
      className={`h-full flex flex-col justify-between p-4 box-border bg-[#ebddc5] border-r-2 border-[#201e1d] font-body text-[#201e1d] z-30 transition-all ${
        compact ? 'w-[76px]' : 'w-[250px]'
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
        <div className="px-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ccdbb2] text-[#201e1d] border border-[#201e1d] font-mono text-[10px] font-bold tracking-wider shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            APP ADMIN · PLATFORM OPS
          </span>
        </div>

        {/* Quick Cross-Portal Switcher Actions */}
        <div className="space-y-1.5 pt-0.5">
          <Link
            href="/portal"
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#ffe1d0] border-[1.5px] border-[#201e1d] shadow-offset-2 hover:bg-[#ffc6a5] transition-all text-xs font-bold text-[#201e1d] group cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
            title="Open Teacher Classroom Portal"
          >
            <span className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#201e1d]" />
              <span>Teacher Portal 🎓</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-[#645c50] group-hover:text-[#201e1d]" />
          </Link>

          <Link
            href="/"
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-[#645c50] hover:text-[#201e1d] hover:bg-[#f5ead8] transition-colors cursor-pointer"
            title="Return to Student Practice"
          >
            <span className="flex items-center gap-2">
              <span className="text-sm">🏠</span>
              <span>Student Home</span>
            </span>
            <span className="text-[10px] font-mono text-[#645c50]">/</span>
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-0.5">
          {/* Section 1: Content Pipeline */}
          <div>
            <div className="px-2 mb-1.5 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#645c50] font-bold">
                Content Pipeline
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <nav className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleNavClick('ingestion')}
                className={navItemClass('ingestion')}
              >
                <span className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#201e1d]" />
                  <span>Ingestion Studio</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#ccdbb2] border border-[#201e1d]/30 text-[#201e1d]">
                  [ 1 STAGED ]
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('staged')}
                className={navItemClass('staged')}
              >
                <span className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4 text-[#201e1d]" />
                  <span>Staged Papers</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('diagnostics')}
                className={navItemClass('diagnostics')}
              >
                <span className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#201e1d]" />
                  <span>Ingestion Diagnostics</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#ffe1d0] text-[#8c491a] border border-[#201e1d]/30">
                  [ OCR/KaTeX ]
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('bank')}
                className={navItemClass('bank')}
              >
                <span className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-[#201e1d]" />
                  <span>Global Question Bank</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('flagged')}
                className={navItemClass('flagged')}
              >
                <span className="flex items-center gap-2.5">
                  <Flag className="w-4 h-4 text-[#201e1d]" />
                  <span>Flagged Questions</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-[#f5d0bd] text-[#8c491a] border border-[#201e1d]/30">
                  [ 8 ]
                </span>
              </button>
            </nav>
          </div>

          {/* Section 2: Platform & System */}
          <div>
            <div className="px-2 mb-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#645c50] font-bold">
                Platform & System
              </span>
            </div>
            <nav className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => handleNavClick('system')}
                className={navItemClass('system')}
              >
                <span className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-[#201e1d]" />
                  <span>System Overview</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('school')}
                className={navItemClass('school')}
              >
                <span className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-[#201e1d]" />
                  <span>School Licences</span>
                </span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Footer Profile & Security Pill */}
      <div className="pt-3 border-t-2 border-[#201e1d]/15 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] flex items-center justify-center font-heading font-black text-xs text-[#201e1d] shrink-0 shadow-offset-2">
            AD
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-black text-[#201e1d] truncate">
              {userDisplayName}
            </span>
            <span className="text-[10px] font-bold text-[#645c50] flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-700" />
              Super Admin
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}

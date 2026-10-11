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
      <div className="flex flex-col gap-5">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="w-9 h-9 shrink-0 rounded-2xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center -rotate-6 hover:rotate-0 transition-transform shadow-offset-2"
              title="Student Home"
            >
              <span className="font-heading font-black text-sm text-[#201e1d]">R</span>
            </Link>
            <div className="flex flex-col">
              <span className="font-heading font-black text-base tracking-tight leading-none text-[#201e1d]">
                REVIZZ
              </span>
              <span className="text-[10px] font-black uppercase tracking-wider text-[#73634e] mt-0.5">
                Admin Console
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#ccdbb2] text-[#201e1d] border-2 border-[#201e1d] shadow-offset-2">
              App Admin
            </span>
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
        <div className="space-y-1.5 pt-1">
          <Link
            href="/portal"
            className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-all text-xs font-black text-[#201e1d] group cursor-pointer"
            title="Open Teacher Classroom Portal"
          >
            <span className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-[#201e1d]" />
              <span>Teacher Portal</span>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-[#645c50] group-hover:text-[#201e1d]" />
          </Link>

          <Link
            href="/"
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold text-[#645c50] hover:text-[#201e1d] hover:bg-[#f5ead8]/60 transition-colors cursor-pointer"
            title="Return to Student Practice"
          >
            <span className="flex items-center gap-2">
              <Home className="w-3.5 h-3.5" />
              <span>Student Home</span>
            </span>
            <span className="text-[10px] font-mono">/</span>
          </Link>
        </div>

        {/* Navigation Sections */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-0.5">
          {/* Section 1: Content Pipeline */}
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-[#73634e] px-2 mb-1.5 flex items-center justify-between">
              <span>Content Pipeline</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
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
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-[#ccdbb2] border border-[#201e1d] text-[#201e1d]">
                  1 staged
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
                  <span>Diagnostics</span>
                </span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-[#ffe1d0] text-[#8c491a] border border-[#201e1d]/40">
                  OCR/KaTeX
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('bank')}
                className={navItemClass('bank')}
              >
                <span className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-[#201e1d]" />
                  <span>Question Bank</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('flagged')}
                className={navItemClass('flagged')}
              >
                <span className="flex items-center gap-2.5">
                  <Flag className="w-4 h-4 text-[#201e1d]" />
                  <span>Flagged Reports</span>
                </span>
              </button>
            </nav>
          </div>

          {/* Section 2: Platform & System */}
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-[#73634e] px-2 mb-1.5">
              Platform & System
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

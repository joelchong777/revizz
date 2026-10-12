'use client';

import React from 'react';
import Link from 'next/link';
import { 
  LayoutGrid, 
  Users, 
  Send, 
  BarChart3, 
  Trophy, 
  BookOpen, 
  Flag, 
  Building2, 
  Sparkles,
  X,
  FileText,
  Home
} from 'lucide-react';

export interface AdminNavProps {
  role?: 'teacher' | 'content';
  active?: string;
  onSelectTab?: (tab: string) => void;
  onSelect?: (tab: string) => void;
  onSwitchRole?: (role: 'teacher' | 'content') => void;
  onToggleRole?: () => void;
  compact?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  userDisplayName?: string;
  isAdmin?: boolean;
}

export default function AdminNav({
  role = 'teacher',
  active = 'overview',
  onSelectTab,
  onSelect,
  onSwitchRole,
  onToggleRole,
  compact = false,
  isOpen = false,
  onClose,
  userDisplayName,
  isAdmin = false,
}: AdminNavProps) {
  const isTeacher = true;
  const agentLine = '3 tasks need approval';
  const initials = userDisplayName
    ? userDisplayName
        .split(' ')
        .map((w) => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'AO';
  const avatarBg = 'var(--color-accent-300, #ffe1d0)';
  const userName = userDisplayName || 'Ms. A. Okafor';
  const userRole = isAdmin ? 'Teacher · School admin' : 'Teacher · Educator';

  const handleNavClick = (tabKey: string) => {
    if (onSelect) {
      onSelect(tabKey);
    }
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
      style={{
        background: 'var(--color-surface, #ebddc5)',
        borderColor: 'var(--color-neutral-300, #201e1d)',
        color: 'var(--color-text, #201e1d)',
      }}
    >
      <div className="flex flex-col gap-4">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="w-9 h-9 shrink-0 rounded-xl bg-[#ffe1d0] border-2 border-[#201e1d] flex items-center justify-center -rotate-6 hover:rotate-0 transition-transform shadow-offset-2"
              title="Return to Student Home"
            >
              <span className="font-heading font-black text-sm text-[#201e1d]">R</span>
            </Link>

            {!compact && (
              <div className="flex flex-col leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-black tracking-tight text-lg text-[#201e1d]">
                    REVIZZ
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-[#ffe1d0] text-[#c67139] text-[9px] font-black uppercase tracking-wider border border-[#201e1d]/20">
                    EDUCATOR
                  </span>
                </div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#645c50] font-bold">
                  Command Deck
                </span>
              </div>
            )}
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1 rounded-xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-colors"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4 text-[#201e1d]" />
            </button>
          )}
        </div>

        {/* Switcher & Links */}
        <div className="flex flex-col gap-1.5 pt-0.5">
          {/* Admin Switcher: Sleek tactile pill button for Admins */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#ccdbb2] border-[1.5px] border-[#201e1d] shadow-offset-2 text-[#201e1d] font-bold text-xs hover:bg-[#b8c99d] transition-all active:translate-x-[1px] active:translate-y-[1px] group cursor-pointer ${
                compact ? 'justify-center px-1' : ''
              }`}
              title="Switch to App Administration Dashboard"
            >
              <span className="w-7 h-7 rounded-lg bg-[#201e1d] text-[#f9f4ed] flex items-center justify-center shrink-0 group-hover:rotate-6 transition-transform">
                <span className="text-xs leading-none">🛠️</span>
              </span>
              {!compact && (
                <>
                  <span className="flex-1 min-w-0 truncate font-bold text-[13px] text-[#201e1d]">Switch to App Admin</span>
                  <span className="text-xs shrink-0">🛠️</span>
                </>
              )}
            </Link>
          )}

          {/* Return to Student Home Link */}
          <Link
            href="/"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#f5ead8] border-[1.5px] border-[#201e1d] shadow-offset-2 hover:bg-[#ffe1d0] transition-all text-xs font-bold text-[#474238] hover:text-[#201e1d] group cursor-pointer active:translate-x-[1px] active:translate-y-[1px] ${
              compact ? 'justify-center px-1' : ''
            }`}
            title="Return to Student Home"
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
          {/* Teaching Section */}
          {isTeacher && (
            <div className="flex flex-col gap-1">
              {!compact && (
                <span className="px-2 pb-0.5 font-mono text-[10px] uppercase tracking-widest text-[#645c50] font-bold">
                  Teaching
                </span>
              )}

              <button
                type="button"
                onClick={() => handleNavClick('overview')}
                className={navItemClass('overview')}
                title="Overview"
              >
                {renderIcon(LayoutGrid, 'overview')}
                {!compact && <span className="flex-1 min-w-0 truncate">Overview</span>}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('roster')}
                className={navItemClass('roster')}
                title="Classes & students"
              >
                {renderIcon(Users, 'roster')}
                {!compact && <span className="flex-1 min-w-0 truncate">Classes & students</span>}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('assign')}
                className={navItemClass('assign')}
                title="Assign rounds"
              >
                {renderIcon(Send, 'assign')}
                {!compact && <span className="flex-1 min-w-0 truncate">Assign rounds</span>}
              </button>

              <button
                type="button"
                onClick={() => handleNavClick('compiler')}
                className={navItemClass('compiler')}
                title="Test compiler"
              >
                {renderIcon(FileText, 'compiler')}
                {!compact && (
                  <>
                    <span className="flex-1 min-w-0 truncate">Test compiler</span>
                    <span className="px-1.5 py-0.5 rounded-md bg-[#ffe1d0] text-[#c67139] text-[9px] font-black uppercase tracking-wider shrink-0 whitespace-nowrap">
                      New
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Analytics Section */}
          <div className="flex flex-col gap-1">
            {!compact && (
              <span className="px-2 pb-0.5 font-mono text-[10px] uppercase tracking-widest text-[#645c50] font-bold">
                Analytics
              </span>
            )}

            <button
              type="button"
              onClick={() => handleNavClick('mastery')}
              className={navItemClass('mastery')}
              title="Mastery analytics"
            >
              {renderIcon(BarChart3, 'mastery')}
              {!compact && <span className="flex-1 min-w-0 truncate">Mastery analytics</span>}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('xp')}
              className={navItemClass('xp')}
              title="Leaderboard & XP"
            >
              {renderIcon(Trophy, 'xp')}
              {!compact && <span className="flex-1 min-w-0 truncate">Leaderboard & XP</span>}
            </button>
          </div>

          {/* Question Verification Section */}
          <div className="flex flex-col gap-1">
            {!compact && (
              <span className="px-2 pb-0.5 font-mono text-[10px] uppercase tracking-widest text-[#645c50] font-bold">
                Question Verification
              </span>
            )}

            <button
              type="button"
              onClick={() => handleNavClick('bank')}
              className={navItemClass('bank')}
              title="Question bank"
            >
              {renderIcon(BookOpen, 'bank')}
              {!compact && <span className="flex-1 min-w-0 truncate">Question bank</span>}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('flagged')}
              className={navItemClass('flagged')}
              title="Flagged questions"
            >
              {renderIcon(Flag, 'flagged')}
              {!compact && (
                <>
                  <span className="flex-1 min-w-0 truncate">Flagged questions</span>
                  <span className="w-5 h-5 rounded-full bg-[#ffc6a5] text-[#8c491a] text-[10px] font-black border border-[#201e1d]/25 flex items-center justify-center shrink-0">
                    8
                  </span>
                </>
              )}
            </button>
          </div>

          {/* School Section */}
          {isTeacher && (
            <div className="flex flex-col gap-1">
              {!compact && (
                <span className="px-2 pb-0.5 font-mono text-[10px] uppercase tracking-widest text-[#645c50] font-bold">
                  School
                </span>
              )}

              <button
                type="button"
                onClick={() => handleNavClick('school')}
                className={navItemClass('school')}
                title="School & licence"
              >
                {renderIcon(Building2, 'school')}
                {!compact && <span className="flex-1 min-w-0 truncate">School & licence</span>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer: AI Agent Card & User Profile */}
      <div className="mt-auto flex flex-col gap-2.5 pt-3 border-t-2 border-[#201e1d]/15">
        {/* Docked AI Agent Card */}
        <button
          type="button"
          onClick={() => handleNavClick(isTeacher ? 'overview' : 'flagged')}
          className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-left hover:bg-[#e1eecc] transition-colors active:translate-y-0.5 shadow-xs cursor-pointer"
          title={`Agent: ${agentLine}`}
        >
          <span className="w-7 h-7 shrink-0 rounded-lg bg-[#8fa073] text-[#f9f4ed] grid place-items-center">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          {!compact && (
            <span className="flex flex-col leading-tight flex-1 min-w-0">
              <span className="font-bold text-[12px] text-[#201e1d]">Agent Assistant</span>
              <span className="text-[10px] text-[#3d472b] truncate">{agentLine}</span>
            </span>
          )}
        </button>

        {/* User Card */}
        <div className="flex items-center gap-2.5 px-1 py-1">
          <span
            className="w-8 h-8 shrink-0 rounded-xl border-2 border-[#201e1d] grid place-items-center text-xs font-black shadow-offset-2"
            style={{ backgroundColor: avatarBg }}
          >
            {initials}
          </span>
          {!compact && (
            <div className="flex flex-col leading-tight min-w-0 flex-1">
              <span className="font-bold text-[13px] text-[#201e1d] truncate">{userName}</span>
              <span className="text-[10px] font-bold text-[#645c50] truncate">{userRole}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

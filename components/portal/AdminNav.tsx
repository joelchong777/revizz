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
  Layers,
  Flag, 
  Building2, 
  Sparkles,
  ArrowRightLeft,
  X,
  FileText
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
}: AdminNavProps) {
  const isTeacher = role === 'teacher';
  const roleLabel = isTeacher ? 'School admin' : 'Content studio';
  const agentLine = isTeacher ? '3 tasks need approval' : '12 drafts in review';
  const initials = isTeacher ? 'AO' : 'SR';
  const avatarBg = isTeacher ? 'var(--color-accent-300)' : 'var(--color-accent-2-300)';
  const userName = userDisplayName || (isTeacher ? 'Ms. A. Okafor' : 'Sam Reyes');
  const userRole = isTeacher ? 'Teacher · School admin' : 'Content editor · Revizz';

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
    return `w-full flex items-center gap-2.5 px-2.5 py-2 rounded-full transition-all text-sm select-none cursor-pointer ${
      isActive
        ? 'bg-[#ffe1d0] text-[#201e1d] font-bold shadow-sm'
        : 'text-[#474238] font-medium hover:bg-[#eee7db]/80 active:translate-y-0.5'
    }`;
  };

  return (
    <aside
      className={`h-full flex flex-col gap-4 p-4 box-border bg-[#ebddc5] border-r-[1.5px] border-[#dcd3c4] font-body text-[#201e1d] z-30 transition-all ${
        compact ? 'w-[76px]' : 'w-[232px]'
      }`}
      style={{
        background: 'var(--color-surface, #ebddc5)',
        borderColor: 'var(--color-neutral-300, #dcd3c4)',
        color: 'var(--color-text, #201e1d)',
      }}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-1.5">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="w-8 h-8 shrink-0 rounded-full bg-[#ffc6a5] border-[1.5px] border-[#201e1d] flex items-center justify-center -rotate-12 hover:rotate-0 transition-transform shadow-offset-2"
            title="Return to Student Home"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="#201e1d"
              stroke="#201e1d"
              strokeWidth="2"
              strokeLinejoin="round"
            >
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            </svg>
          </Link>

          {!compact && (
            <div className="flex flex-col leading-tight">
              <span className="font-heading text-[21px] tracking-[0.03em] font-black text-[#201e1d]">
                REVIZZ
              </span>
              <button
                type="button"
                onClick={() => {
                  if (onToggleRole) {
                    onToggleRole();
                  } else if (onSwitchRole) {
                    onSwitchRole(isTeacher ? 'content' : 'teacher');
                  }
                }}
                className="text-[10px] font-bold tracking-[0.1em] uppercase text-[#645c50] text-left hover:text-[#c67139] flex items-center gap-1 group transition-colors"
                title="Click to toggle role"
              >
                <span>{roleLabel}</span>
                <ArrowRightLeft className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>
            </div>
          )}
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded-full text-[#645c50] hover:bg-[#dcd3c4]"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto no-scrollbar">
        {/* Teaching Section */}
        {isTeacher && (
          <div className="flex flex-col gap-0.5">
            {!compact && (
              <span className="px-2.5 pb-1 text-[10px] font-bold tracking-[0.1em] uppercase text-[#645c50]">
                Teaching
              </span>
            )}

            <button
              type="button"
              onClick={() => handleNavClick('overview')}
              className={navItemClass('overview')}
              title="Overview"
            >
              <LayoutGrid className="w-[18px] h-[18px] shrink-0" strokeWidth={2.75} />
              {!compact && <span>Overview</span>}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('roster')}
              className={navItemClass('roster')}
              title="Classes & students"
            >
              <Users className="w-[18px] h-[18px] shrink-0" strokeWidth={2.75} />
              {!compact && <span>Classes & students</span>}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('assign')}
              className={navItemClass('assign')}
              title="Assign rounds"
            >
              <Send className="w-[18px] h-[18px] shrink-0" strokeWidth={2.75} />
              {!compact && <span>Assign rounds</span>}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('compiler')}
              className={navItemClass('compiler')}
              title="Test compiler"
            >
              <FileText className="w-[18px] h-[18px] shrink-0" strokeWidth={2.75} />
              {!compact && (
                <>
                  <span className="flex-1 text-left">Test compiler</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#ffe1d0] text-[#c67139] text-[9px] font-black uppercase tracking-wide">
                    New
                  </span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('mastery')}
              className={navItemClass('mastery')}
              title="Mastery analytics"
            >
              <BarChart3 className="w-[18px] h-[18px] shrink-0" strokeWidth={2.75} />
              {!compact && <span>Mastery analytics</span>}
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('xp')}
              className={navItemClass('xp')}
              title="Leaderboard & XP"
            >
              <Trophy className="w-[18px] h-[18px] shrink-0" strokeWidth={2.75} />
              {!compact && <span>Leaderboard & XP</span>}
            </button>
          </div>
        )}

        {/* Content Section */}
        <div className="flex flex-col gap-0.5">
          {!compact && (
            <span className="px-2.5 pb-1 text-[10px] font-bold tracking-[0.1em] uppercase text-[#645c50]">
              Content
            </span>
          )}

          <button
            type="button"
            onClick={() => handleNavClick('bank')}
            className={navItemClass('bank')}
            title="Question bank"
          >
            <BookOpen className="w-[18px] h-[18px] shrink-0" strokeWidth={2.75} />
            {!compact && <span>Question bank</span>}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('ingestion')}
            className={navItemClass('ingestion')}
            title="Ingestion studio"
          >
            <Layers className="w-[18px] h-[18px] shrink-0" strokeWidth={2.75} />
            {!compact && (
              <>
                <span className="flex-1 text-left">Ingestion studio</span>
                <span className="px-2 py-0.5 rounded-full bg-[#ccdbb2] text-[#272e1b] text-[11px] font-bold">
                  1 staged
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('flagged')}
            className={navItemClass('flagged')}
            title="Flagged"
          >
            <Flag className="w-[18px] h-[18px] shrink-0" strokeWidth={2.75} />
            {!compact && (
              <>
                <span className="flex-1 text-left">Flagged</span>
                <span className="px-2 py-0.5 rounded-full bg-[#b2622d] text-[#f9f4ed] text-[11px] font-bold">
                  8
                </span>
              </>
            )}
          </button>
        </div>

        {/* School Section */}
        {isTeacher && (
          <div className="flex flex-col gap-0.5">
            {!compact && (
              <span className="px-2.5 pb-1 text-[10px] font-bold tracking-[0.1em] uppercase text-[#645c50]">
                School
              </span>
            )}

            <button
              type="button"
              onClick={() => handleNavClick('school')}
              className={navItemClass('school')}
              title="School & licence"
            >
              <Building2 className="w-[18px] h-[18px] shrink-0" strokeWidth={2.75} />
              {!compact && <span>School & licence</span>}
            </button>
          </div>
        )}
      </div>

      {/* Footer: AI Agent Card & User Profile */}
      <div className="mt-auto flex flex-col gap-2.5 pt-2">
        {/* Docked AI Agent Card */}
        <button
          type="button"
          onClick={() => handleNavClick(isTeacher ? 'overview' : 'flagged')}
          className="w-full flex items-center gap-2.5 p-2.5 rounded-[20px] bg-[#f0fae1] border-[1.5px] border-[#8fa073] text-left hover:bg-[#e1eecc] transition-colors active:translate-y-0.5"
          title={`Agent: ${agentLine}`}
        >
          <span className="w-7 h-7 shrink-0 rounded-full bg-[#8fa073] text-[#f9f4ed] grid place-items-center">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          {!compact && (
            <span className="flex flex-col leading-tight flex-1 min-w-0">
              <span className="font-bold text-[13px] text-[#201e1d]">Agent</span>
              <span className="text-[11px] text-[#3d472b] truncate">{agentLine}</span>
            </span>
          )}
        </button>

        {/* User Card */}
        <div className="flex items-center gap-2.5 px-1 py-1">
          <span
            className="w-8 h-8 shrink-0 rounded-full border-[1.5px] border-[#201e1d] grid place-items-center text-xs font-bold"
            style={{ backgroundColor: avatarBg }}
          >
            {initials}
          </span>
          {!compact && (
            <div className="flex flex-col leading-tight min-w-0 flex-1">
              <span className="font-bold text-[13px] text-[#201e1d] truncate">{userName}</span>
              <span className="text-[11px] text-[#645c50] truncate">{userRole}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

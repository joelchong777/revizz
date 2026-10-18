'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  X,
  Plus,
  Download,
  RefreshCw,
  ShieldCheck,
  GraduationCap,
  Building2,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Copy,
  Check,
  Sliders,
  User,
  UserCheck,
  UserX,
  Mail,
  ExternalLink,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Flame,
  Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import {
  addRosterInvite,
  getRosterInvites,
  deleteRosterInvite,
  RosterInvite,
} from '@/lib/roster';
import { getDemoStudentSession, getGuestEducatorSession } from '@/lib/auth';
import type { UserProfile } from '@/types';

export type UserRole = 'student' | 'teacher' | 'admin';
export type UserStatus = 'active' | 'invited' | 'suspended';
export type RoleFilterTab = 'all' | 'students' | 'teachers' | 'admins' | 'invites';
export type AccountTypeFilter = 'all' | 'school' | 'individual';

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_school_account: boolean;
  total_xp: number;
  current_streak: number;
  status: UserStatus;
  cohort: string;
  created_at: string;
  isInvite?: boolean;
}

export interface UserManagementHubProps {
  onSelectTab?: (tab: string, sub?: string) => void;
}

interface LocalUserOverrides {
  [userId: string]: {
    role?: UserRole;
    is_school_account?: boolean;
    status?: UserStatus;
  };
}

const STORAGE_OVERRIDES_KEY = 'revizz_admin_user_overrides_v1';
const STORAGE_DELETED_KEY = 'revizz_admin_deleted_users_v1';

const getStorage = (): Storage | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

const getStoredOverrides = (): LocalUserOverrides => {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Failed to parse admin user overrides:', e);
    return {};
  }
};

const saveStoredOverrides = (overrides: LocalUserOverrides): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch (e) {
    console.warn('Failed to save admin user overrides:', e);
  }
};

const getStoredDeletedIds = (): Set<string> => {
  const storage = getStorage();
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(STORAGE_DELETED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    console.warn('Failed to parse admin deleted users:', e);
    return new Set();
  }
};

const saveStoredDeletedIds = (ids: Set<string>): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_DELETED_KEY, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.warn('Failed to save admin deleted users:', e);
  }
};

const getInitials = (name?: string, email?: string): string => {
  const cleanName = (name || '').trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return 'US';
};

export default function UserManagementHub({ onSelectTab }: UserManagementHubProps) {
  // All React state declared at the top of the component (React Error #310 defense)
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeRoleFilter, setActiveRoleFilter] = useState<RoleFilterTab>('all');
  const [accountTypeFilter, setAccountTypeFilter] = useState<AccountTypeFilter>('all');
  const [sortBy, setSortBy] = useState<'name' | 'xp' | 'created_at' | 'role'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modal states
  const [isInviteModalOpen, setIsInviteModalOpen] = useState<boolean>(false);
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<UserRole>('student');
  const [inviteCohort, setInviteCohort] = useState<string>('General');
  const [inviteIsSchool, setInviteIsSchool] = useState<boolean>(false);
  const [submittingInvite, setSubmittingInvite] = useState<boolean>(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Delete confirmation state
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<boolean>(false);

  // Toast feedback state
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

  const showFeedback = useCallback((msg: string) => {
    setFeedbackMessage(msg);
  }, []);

  useEffect(() => {
    if (!feedbackMessage) return;
    const timer = setTimeout(() => {
      setFeedbackMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  // Primary loader function
  const loadDirectoryData = useCallback(async () => {
    setLoading(true);
    const deletedIds = getStoredDeletedIds();
    const overrides = getStoredOverrides();
    const directory: ManagedUser[] = [];
    const seenEmails = new Set<string>();

    // 1. Fetch Supabase registered profiles
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(profiles)) {
        for (const p of profiles) {
          if (!p.id || deletedIds.has(p.id)) continue;
          const email = (p.email || '').trim().toLowerCase();
          if (email) seenEmails.add(email);

          const override = overrides[p.id] || {};
          const role: UserRole = override.role || (p.role as UserRole) || 'student';
          const isSchool: boolean =
            override.is_school_account !== undefined
              ? override.is_school_account
              : Boolean(p.is_school_account);
          const status: UserStatus = override.status || 'active';

          directory.push({
            id: p.id,
            name: p.display_name || (email ? email.split('@')[0] : 'Revizz User'),
            email: p.email || '',
            role,
            is_school_account: isSchool,
            total_xp: typeof p.total_xp === 'number' ? p.total_xp : 0,
            current_streak: typeof p.current_streak === 'number' ? p.current_streak : 0,
            status,
            cohort: p.cohort || 'General',
            created_at: p.created_at || new Date().toISOString(),
            isInvite: false,
          });
        }
      }
    } catch (e) {
      console.warn('Supabase profiles query notice (proceeding to local/invites):', e);
    }

    // 2. Fetch pending & claimed roster invitations
    try {
      const invites = await getRosterInvites();
      for (const inv of invites) {
        if (!inv.id || deletedIds.has(inv.id)) continue;
        const normEmail = (inv.email || '').trim().toLowerCase();
        if (normEmail && seenEmails.has(normEmail)) continue;
        if (normEmail) seenEmails.add(normEmail);

        const override = overrides[inv.id] || {};
        const role: UserRole = override.role || inv.role || 'student';
        const isSchool: boolean =
          override.is_school_account !== undefined ? override.is_school_account : true;
        const status: UserStatus =
          override.status || (inv.status === 'claimed' ? 'active' : 'invited');

        directory.push({
          id: inv.id,
          name: inv.display_name || (normEmail ? normEmail.split('@')[0] : 'Invited Learner'),
          email: inv.email,
          role,
          is_school_account: isSchool,
          total_xp: 0,
          current_streak: 0,
          status,
          cohort: inv.cohort || 'General',
          created_at: inv.created_at || new Date().toISOString(),
          isInvite: true,
        });
      }
    } catch (e) {
      console.warn('Roster invites query notice:', e);
    }

    // 3. Fallback to active demo or guest session if directory is empty or local testing
    try {
      const demoStudent = getDemoStudentSession();
      if (demoStudent && demoStudent.id && !deletedIds.has(demoStudent.id)) {
        const demoEmail = (demoStudent.email || '').trim().toLowerCase();
        if (!demoEmail || !seenEmails.has(demoEmail)) {
          const override = overrides[demoStudent.id] || {};
          directory.push({
            id: demoStudent.id,
            name: demoStudent.display_name || 'Demo Student',
            email: demoStudent.email || 'demo.student@revizz.local',
            role: override.role || (demoStudent.role as UserRole) || 'student',
            is_school_account:
              override.is_school_account !== undefined
                ? override.is_school_account
                : demoStudent.is_school_account,
            total_xp: demoStudent.total_xp || 0,
            current_streak: demoStudent.current_streak || 0,
            status: override.status || 'active',
            cohort: 'Demo Practice',
            created_at: new Date().toISOString(),
            isInvite: false,
          });
          if (demoEmail) seenEmails.add(demoEmail);
        }
      }

      const guestEducator = getGuestEducatorSession();
      if (guestEducator && guestEducator.id && !deletedIds.has(guestEducator.id)) {
        const guestEmail = (guestEducator.email || '').trim().toLowerCase();
        if (!guestEmail || !seenEmails.has(guestEmail)) {
          const override = overrides[guestEducator.id] || {};
          directory.push({
            id: guestEducator.id,
            name: guestEducator.display_name || 'Guest Educator',
            email: guestEducator.email || 'educator.guest@revizz.local',
            role: override.role || (guestEducator.role as UserRole) || 'teacher',
            is_school_account:
              override.is_school_account !== undefined
                ? override.is_school_account
                : guestEducator.is_school_account,
            total_xp: guestEducator.total_xp || 2500,
            current_streak: guestEducator.current_streak || 5,
            status: override.status || 'active',
            cohort: 'Faculty Campus',
            created_at: new Date().toISOString(),
            isInvite: false,
          });
          if (guestEmail) seenEmails.add(guestEmail);
        }
      }
    } catch (e) {
      console.warn('Demo session fallback check notice:', e);
    }

    setUsers(directory);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDirectoryData();
  }, [loadDirectoryData]);

  // Role Switcher Handler
  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    // Update state immediately
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    );

    // Save override to localStorage
    const overrides = getStoredOverrides();
    overrides[userId] = {
      ...(overrides[userId] || {}),
      role: newRole,
    };
    saveStoredOverrides(overrides);

    // Persist to Supabase if applicable
    if (targetUser.isInvite) {
      try {
        await supabase.from('roster_invites').update({ role: newRole }).eq('id', userId);
      } catch (e) {
        console.warn('Failed to update roster_invites role in Supabase:', e);
      }
    } else {
      try {
        await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      } catch (e) {
        console.warn('Failed to update profiles role in Supabase:', e);
      }
    }

    showFeedback(`Updated role for ${targetUser.name} to ${newRole.toUpperCase()}`);
  };

  // Account Type Switcher Handler
  const handleToggleSchoolAccount = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    const newIsSchool = !targetUser.is_school_account;

    // Update state immediately
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, is_school_account: newIsSchool } : u))
    );

    // Save override to localStorage
    const overrides = getStoredOverrides();
    overrides[userId] = {
      ...(overrides[userId] || {}),
      is_school_account: newIsSchool,
    };
    saveStoredOverrides(overrides);

    // Persist to Supabase if profile
    if (!targetUser.isInvite) {
      try {
        await supabase
          .from('profiles')
          .update({ is_school_account: newIsSchool })
          .eq('id', userId);
      } catch (e) {
        console.warn('Failed to update is_school_account in Supabase:', e);
      }
    }

    showFeedback(
      `${targetUser.name} converted to ${newIsSchool ? 'Institutional Campus' : 'Individual Learner'}`
    );
  };

  // Status Switcher Handler
  const handleUpdateStatus = async (userId: string, newStatus: UserStatus) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    // Update state immediately
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
    );

    // Save override to localStorage
    const overrides = getStoredOverrides();
    overrides[userId] = {
      ...(overrides[userId] || {}),
      status: newStatus,
    };
    saveStoredOverrides(overrides);

    // Persist to Supabase if roster invite
    if (targetUser.isInvite) {
      try {
        const rosterStatus = newStatus === 'active' ? 'claimed' : 'pending';
        await supabase
          .from('roster_invites')
          .update({ status: rosterStatus })
          .eq('id', userId);
      } catch (e) {
        console.warn('Failed to update roster status in Supabase:', e);
      }
    }

    showFeedback(`User status for ${targetUser.name} changed to ${newStatus.toUpperCase()}`);
  };

  // Delete / Revoke Handler
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    const { id, isInvite, name, email } = userToDelete;

    try {
      if (isInvite) {
        await deleteRosterInvite(id);
      } else {
        await supabase.from('profiles').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('Notice while deleting user record from backend:', e);
    }

    // Persist deletion locally so it never reappears
    const deletedIds = getStoredDeletedIds();
    deletedIds.add(id);
    saveStoredDeletedIds(deletedIds);

    // Remove from UI state
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setDeletingUser(false);
    setUserToDelete(null);
    showFeedback(`Account for ${name || email} has been revoked.`);
  };

  // Invite Form Submit Handler
  const handleSubmitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setInviteError('Please enter a valid email address.');
      return;
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setInviteError('Please provide a properly formatted email address (e.g. user@domain.com).');
      return;
    }

    setSubmittingInvite(true);
    setInviteError(null);

    try {
      const createdInvite = await addRosterInvite({
        email: cleanEmail,
        displayName: inviteName.trim() || undefined,
        role: inviteRole,
        cohort: inviteCohort.trim() || 'General',
        invitedBy: 'Administrator',
      });

      // Save school account preference in local override if checked
      if (inviteIsSchool) {
        const overrides = getStoredOverrides();
        overrides[createdInvite.id] = {
          ...(overrides[createdInvite.id] || {}),
          is_school_account: true,
          role: inviteRole,
        };
        saveStoredOverrides(overrides);
      }

      // Add to directory state
      const newUser: ManagedUser = {
        id: createdInvite.id,
        name: createdInvite.display_name || cleanEmail.split('@')[0],
        email: createdInvite.email,
        role: createdInvite.role,
        is_school_account: inviteIsSchool,
        total_xp: 0,
        current_streak: 0,
        status: 'invited',
        cohort: createdInvite.cohort,
        created_at: createdInvite.created_at,
        isInvite: true,
      };

      setUsers((prev) => [newUser, ...prev.filter((u) => u.id !== newUser.id && u.email !== newUser.email)]);

      // Reset form
      setInviteName('');
      setInviteEmail('');
      setInviteRole('student');
      setInviteCohort('General');
      setInviteIsSchool(false);
      setIsInviteModalOpen(false);
      showFeedback(`Invitation successfully sent to ${cleanEmail}!`);
    } catch (err: any) {
      console.error('Failed to create user invite:', err);
      setInviteError(err?.message || 'Failed to send invitation. Please try again.');
    } finally {
      setSubmittingInvite(false);
    }
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (filteredUsers.length === 0) {
      showFeedback('No users available to export.');
      return;
    }

    const headers = [
      'User ID',
      'Name',
      'Email',
      'Role',
      'Account Type',
      'Status',
      'Total XP',
      'Current Streak',
      'Cohort',
      'Joined / Invited At',
    ];

    const rows = filteredUsers.map((u) => [
      `"${u.id.replace(/"/g, '""')}"`,
      `"${(u.name || '').replace(/"/g, '""')}"`,
      `"${(u.email || '').replace(/"/g, '""')}"`,
      `"${u.role}"`,
      `"${u.is_school_account ? 'School Campus' : 'Individual'}"`,
      `"${u.status}"`,
      u.total_xp,
      u.current_streak,
      `"${(u.cohort || '').replace(/"/g, '""')}"`,
      `"${u.created_at || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `revizz-users-export-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showFeedback(`Exported ${filteredUsers.length} user records to CSV`);
  };

  const handleCopyEmail = (userId: string, email: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(email);
      setCopiedEmailId(userId);
      setTimeout(() => setCopiedEmailId(null), 2000);
      showFeedback(`Copied ${email} to clipboard`);
    }
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const totalUsers = users.length;
    const students = users.filter((u) => u.role === 'student').length;
    const teachers = users.filter((u) => u.role === 'teacher').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const pendingInvites = users.filter((u) => u.status === 'invited' || u.isInvite).length;
    const schoolAccounts = users.filter((u) => u.is_school_account).length;

    return {
      totalUsers,
      students,
      teachers,
      admins,
      pendingInvites,
      schoolAccounts,
    };
  }, [users]);

  // Filtering and Sorting
  const filteredUsers = useMemo(() => {
    let result = [...users];

    // Search query filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.cohort.toLowerCase().includes(q)
      );
    }

    // Role tabs filter
    if (activeRoleFilter === 'students') {
      result = result.filter((u) => u.role === 'student');
    } else if (activeRoleFilter === 'teachers') {
      result = result.filter((u) => u.role === 'teacher');
    } else if (activeRoleFilter === 'admins') {
      result = result.filter((u) => u.role === 'admin');
    } else if (activeRoleFilter === 'invites') {
      result = result.filter((u) => u.status === 'invited' || u.isInvite);
    }

    // Account Type dropdown filter
    if (accountTypeFilter === 'school') {
      result = result.filter((u) => u.is_school_account);
    } else if (accountTypeFilter === 'individual') {
      result = result.filter((u) => !u.is_school_account);
    }

    // Sorting
    result.sort((a, b) => {
      let comp = 0;
      if (sortBy === 'name') {
        comp = a.name.localeCompare(b.name);
      } else if (sortBy === 'xp') {
        comp = a.total_xp - b.total_xp;
      } else if (sortBy === 'role') {
        comp = a.role.localeCompare(b.role);
      } else {
        comp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === 'asc' ? comp : -comp;
    });

    return result;
  }, [users, searchQuery, activeRoleFilter, accountTypeFilter, sortBy, sortOrder]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-body text-[#201e1d]">
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="bg-[#ccdbb2] border-2 border-[#201e1d] text-[#201e1d] font-heading font-black text-xs px-4 py-3 rounded-2xl shadow-offset-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#166534]" />
            <span>{feedbackMessage}</span>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-2">
          {/* Neobrutalist Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-[#201e1d] text-[#f9f4ed] font-mono text-[11px] font-bold tracking-wider">
              USER OPERATIONS · ACCESS CONTROL
            </span>
            <span className="px-3 py-1 rounded-full bg-[#ffe1d0] border border-[#201e1d] font-mono text-[11px] font-bold text-[#201e1d]">
              Role &amp; Identity Management
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-heading font-black tracking-tight flex items-center gap-2 text-[#201e1d]">
            User Management 👥
          </h1>
          <p className="text-xs sm:text-sm font-medium text-[#645c50] max-w-2xl">
            Manage user accounts, role permissions (Student, Teacher, Admin), institutional
            school status, and pending roster invitations with instant real-time synchronization.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadDirectoryData}
            disabled={loading}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-1 hover:bg-[#eee7db] active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh directory list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex-1 sm:flex-initial px-3.5 py-2.5 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-1 hover:bg-[#e0d6c5] active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            title="Export directory data to CSV format"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsInviteModalOpen(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] font-heading font-black text-xs shadow-offset-2 hover:bg-[#b8c99d] active:translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Invite User</span>
          </button>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Users */}
        <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-2 space-y-1">
          <div className="flex items-center justify-between text-[#645c50]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
              Total Users
            </span>
            <Users className="w-4 h-4 text-[#201e1d]" />
          </div>
          <div className="text-2xl font-heading font-black text-[#201e1d]">
            {metrics.totalUsers}
          </div>
          <div className="text-[10px] font-mono font-medium text-[#645c50]">
            {metrics.schoolAccounts} Institutional
          </div>
        </div>

        {/* Students Count */}
        <div className="p-4 rounded-2xl bg-[#f0f9ff] border-2 border-[#201e1d] shadow-offset-2 space-y-1">
          <div className="flex items-center justify-between text-[#0369a1]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
              Students
            </span>
            <GraduationCap className="w-4 h-4" />
          </div>
          <div className="text-2xl font-heading font-black text-[#0369a1]">
            {metrics.students}
          </div>
          <div className="text-[10px] font-mono font-medium text-[#0369a1]/80">
            Learner Profiles
          </div>
        </div>

        {/* Educators / Teachers Count */}
        <div className="p-4 rounded-2xl bg-[#fff7ed] border-2 border-[#201e1d] shadow-offset-2 space-y-1">
          <div className="flex items-center justify-between text-[#c2410c]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
              Teachers
            </span>
            <Building2 className="w-4 h-4" />
          </div>
          <div className="text-2xl font-heading font-black text-[#c2410c]">
            {metrics.teachers}
          </div>
          <div className="text-[10px] font-mono font-medium text-[#c2410c]/80">
            Faculty &amp; Instructors
          </div>
        </div>

        {/* Administrators Count */}
        <div className="p-4 rounded-2xl bg-[#f0fdf4] border-2 border-[#201e1d] shadow-offset-2 space-y-1">
          <div className="flex items-center justify-between text-[#15803d]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
              Admins
            </span>
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-heading font-black text-[#15803d]">
            {metrics.admins}
          </div>
          <div className="text-[10px] font-mono font-medium text-[#15803d]/80">
            Full Access Deck
          </div>
        </div>

        {/* Pending Invites */}
        <div className="p-4 rounded-2xl bg-[#fefce8] border-2 border-[#201e1d] shadow-offset-2 space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-[#a16207]">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
              Pending Invites
            </span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-heading font-black text-[#a16207]">
            {metrics.pendingInvites}
          </div>
          <div className="text-[10px] font-mono font-medium text-[#a16207]/80">
            Awaiting Sign-in
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-2 space-y-3.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Instant Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#645c50] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by student/teacher name, email address, or cohort..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 bg-[#fcfaf6] border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] placeholder:text-[#645c50]/70 focus:outline-none focus:bg-white transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#645c50] hover:text-[#201e1d]"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Account Type Dropdown */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-[#645c50] shrink-0">
              Campus:
            </span>
            <select
              value={accountTypeFilter}
              onChange={(e) => setAccountTypeFilter(e.target.value as AccountTypeFilter)}
              className="px-3 py-2 bg-[#fcfaf6] border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] focus:outline-none cursor-pointer"
            >
              <option value="all">All Accounts</option>
              <option value="school">School Campus</option>
              <option value="individual">Individual</option>
            </select>

            {/* Sort Dropdown */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb as any);
                setSortOrder(so as any);
              }}
              className="px-3 py-2 bg-[#fcfaf6] border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] focus:outline-none cursor-pointer"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="xp-desc">Highest XP</option>
              <option value="role-asc">Role Order</option>
            </select>
          </div>
        </div>

        {/* Filter Tabs / Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pt-2 border-t border-[#201e1d]/10 pb-0.5 scrollbar-thin">
          <button
            type="button"
            onClick={() => setActiveRoleFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl border-2 text-xs font-heading font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeRoleFilter === 'all'
                ? 'bg-[#201e1d] text-[#f9f4ed] border-[#201e1d] shadow-offset-1'
                : 'bg-[#fcfaf6] text-[#645c50] border-[#201e1d]/30 hover:border-[#201e1d] hover:text-[#201e1d]'
            }`}
          >
            <span>All Directory</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                activeRoleFilter === 'all'
                  ? 'bg-white text-[#201e1d]'
                  : 'bg-[#201e1d]/10 text-[#201e1d]'
              }`}
            >
              {metrics.totalUsers}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRoleFilter('students')}
            className={`px-3.5 py-1.5 rounded-xl border-2 text-xs font-heading font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeRoleFilter === 'students'
                ? 'bg-[#bae6fd] text-[#0369a1] border-[#201e1d] shadow-offset-1'
                : 'bg-[#fcfaf6] text-[#645c50] border-[#201e1d]/30 hover:border-[#201e1d] hover:text-[#201e1d]'
            }`}
          >
            <span>Students</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#0369a1]/15 text-[#0369a1] text-[10px] font-mono">
              {metrics.students}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRoleFilter('teachers')}
            className={`px-3.5 py-1.5 rounded-xl border-2 text-xs font-heading font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeRoleFilter === 'teachers'
                ? 'bg-[#ffe1d0] text-[#c2410c] border-[#201e1d] shadow-offset-1'
                : 'bg-[#fcfaf6] text-[#645c50] border-[#201e1d]/30 hover:border-[#201e1d] hover:text-[#201e1d]'
            }`}
          >
            <span>Teachers</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#c2410c]/15 text-[#c2410c] text-[10px] font-mono">
              {metrics.teachers}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRoleFilter('admins')}
            className={`px-3.5 py-1.5 rounded-xl border-2 text-xs font-heading font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeRoleFilter === 'admins'
                ? 'bg-[#ccdbb2] text-[#15803d] border-[#201e1d] shadow-offset-1'
                : 'bg-[#fcfaf6] text-[#645c50] border-[#201e1d]/30 hover:border-[#201e1d] hover:text-[#201e1d]'
            }`}
          >
            <span>Admins</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#15803d]/15 text-[#15803d] text-[10px] font-mono">
              {metrics.admins}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveRoleFilter('invites')}
            className={`px-3.5 py-1.5 rounded-xl border-2 text-xs font-heading font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              activeRoleFilter === 'invites'
                ? 'bg-[#fef08a] text-[#854d0e] border-[#201e1d] shadow-offset-1'
                : 'bg-[#fcfaf6] text-[#645c50] border-[#201e1d]/30 hover:border-[#201e1d] hover:text-[#201e1d]'
            }`}
          >
            <span>Pending Invites</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#854d0e]/15 text-[#854d0e] text-[10px] font-mono">
              {metrics.pendingInvites}
            </span>
          </button>
        </div>
      </div>

      {/* Interactive Directory Table Container */}
      <div className="bg-white border-2 border-[#201e1d] rounded-2xl shadow-offset-3 overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-[#201e1d]" />
            <p className="font-heading font-bold text-sm text-[#645c50]">
              Loading user directory and permissions...
            </p>
          </div>
        ) : filteredUsers.length === 0 ? (
          /* Tactile Empty State */
          <div className="py-16 px-4 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#eee7db] border-2 border-[#201e1d] flex items-center justify-center text-[#201e1d] shadow-offset-2">
              <Users className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="font-heading font-black text-lg text-[#201e1d]">
                {users.length === 0 ? 'User Directory is Empty' : 'No Matching Users Found'}
              </h3>
              <p className="text-xs text-[#645c50] max-w-md mx-auto">
                {users.length === 0
                  ? 'No registered profiles or active roster invites currently exist. Provision an account below to get started.'
                  : `No users match the search query "${searchQuery}" with the selected role or account filters.`}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center gap-2">
              {searchQuery || activeRoleFilter !== 'all' || accountTypeFilter !== 'all' ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveRoleFilter('all');
                    setAccountTypeFilter('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] font-bold text-xs text-[#201e1d] shadow-offset-1 hover:bg-[#e0d6c5] active:translate-y-0.5 cursor-pointer"
                >
                  Clear Filters
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] font-heading font-black text-xs text-[#272e1b] shadow-offset-2 hover:bg-[#b8c99d] active:translate-y-0.5 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Invite User</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f5ead8] border-b-2 border-[#201e1d] text-[11px] font-mono font-bold uppercase tracking-wider text-[#201e1d]">
                  <th className="py-3 px-4">User Identity</th>
                  <th className="py-3 px-3">Role &amp; Permissions</th>
                  <th className="py-3 px-3">Account Type</th>
                  <th className="py-3 px-3">Progress</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#201e1d]/10 text-xs">
                {filteredUsers.map((user) => {
                  const roleBadgeBg =
                    user.role === 'admin'
                      ? 'bg-[#ccdbb2] text-[#15803d]'
                      : user.role === 'teacher'
                      ? 'bg-[#ffe1d0] text-[#c2410c]'
                      : 'bg-[#bae6fd] text-[#0369a1]';

                  const avatarBg =
                    user.role === 'admin'
                      ? 'bg-[#ccdbb2]'
                      : user.role === 'teacher'
                      ? 'bg-[#ffe1d0]'
                      : 'bg-[#bae6fd]';

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-[#faf7f2] transition-colors group"
                    >
                      {/* 1. User Identity */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {/* Tactile Avatar */}
                          <div
                            className={`w-9 h-9 rounded-xl border-2 border-[#201e1d] ${avatarBg} text-[#201e1d] font-heading font-black text-xs flex items-center justify-center shrink-0 shadow-offset-1`}
                          >
                            {getInitials(user.name, user.email)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-heading font-bold text-sm text-[#201e1d] truncate">
                                {user.name}
                              </span>
                              {user.isInvite && (
                                <span className="px-1.5 py-0.2 rounded-full bg-[#fef9c3] border border-[#201e1d]/30 text-[9px] font-mono font-bold text-[#854d0e]">
                                  Invite
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#645c50] font-mono mt-0.5">
                              <span className="truncate max-w-[200px]">{user.email || 'No email registered'}</span>
                              {user.email && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyEmail(user.id, user.email)}
                                  className="text-[#645c50] hover:text-[#201e1d] p-0.5"
                                  title="Copy email address"
                                >
                                  {copiedEmailId === user.id ? (
                                    <Check className="w-3 h-3 text-[#166534]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Role Switcher */}
                      <td className="py-3.5 px-3">
                        <div className="inline-flex items-center">
                          <select
                            value={user.role}
                            onChange={(e) =>
                              handleUpdateRole(user.id, e.target.value as UserRole)
                            }
                            className={`px-2.5 py-1 rounded-xl border-2 border-[#201e1d] font-heading font-black text-[11px] focus:outline-none cursor-pointer shadow-offset-1 ${roleBadgeBg}`}
                          >
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                            <option value="admin">Administrator</option>
                          </select>
                        </div>
                      </td>

                      {/* 3. Account Type Switcher */}
                      <td className="py-3.5 px-3">
                        <button
                          type="button"
                          onClick={() => handleToggleSchoolAccount(user.id)}
                          className={`px-2.5 py-1 rounded-xl border-2 border-[#201e1d] text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all active:translate-y-0.5 cursor-pointer shadow-offset-1 ${
                            user.is_school_account
                              ? 'bg-[#fef3c7] text-[#92400e] hover:bg-[#fde68a]'
                              : 'bg-white text-[#645c50] hover:bg-[#eee7db]'
                          }`}
                          title="Click to toggle between School Campus and Individual account"
                        >
                          {user.is_school_account ? (
                            <>
                              <Building2 className="w-3.5 h-3.5" />
                              <span>School Campus</span>
                            </>
                          ) : (
                            <>
                              <User className="w-3.5 h-3.5" />
                              <span>Individual</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* 4. Progress (XP & Streak) */}
                      <td className="py-3.5 px-3">
                        {user.isInvite && user.status === 'invited' ? (
                          <span className="font-mono text-[11px] text-[#645c50]">
                            — Awaiting Login
                          </span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-[11px] font-bold text-[#201e1d] flex items-center gap-1">
                              <Zap className="w-3 h-3 text-[#eab308] fill-[#eab308]" />
                              {user.total_xp.toLocaleString()} XP
                            </span>
                            <span className="font-mono text-[10px] text-[#645c50] flex items-center gap-1">
                              <Flame className="w-3 h-3 text-[#ea580c] fill-[#ea580c]" />
                              {user.current_streak} streak
                            </span>
                          </div>
                        )}
                      </td>

                      {/* 5. Status Changer */}
                      <td className="py-3.5 px-3">
                        <select
                          value={user.status}
                          onChange={(e) =>
                            handleUpdateStatus(user.id, e.target.value as UserStatus)
                          }
                          className={`px-2.5 py-1 rounded-xl border-2 border-[#201e1d] font-mono font-bold text-[10px] focus:outline-none cursor-pointer shadow-offset-1 ${
                            user.status === 'active'
                              ? 'bg-[#ccdbb2] text-[#166534]'
                              : user.status === 'suspended'
                              ? 'bg-[#fecdd3] text-[#9f1239]'
                              : 'bg-[#fef08a] text-[#854d0e]'
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="invited">Invited</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </td>

                      {/* 6. Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => setUserToDelete(user)}
                          className="p-1.5 rounded-lg border border-transparent hover:border-[#201e1d] hover:bg-[#ffe4e6] text-[#645c50] hover:text-[#e11d48] transition-colors"
                          title="Revoke / Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* "+ Invite User" Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#201e1d]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#fcfaf6] border-2 border-[#201e1d] rounded-3xl shadow-offset-4 overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-[#f5ead8] border-b-2 border-[#201e1d] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] flex items-center justify-center text-[#201e1d] shadow-offset-1">
                  <Plus className="w-5 h-5 stroke-[3]" />
                </div>
                <div>
                  <h3 className="font-heading font-black text-base text-[#201e1d]">
                    Invite New User
                  </h3>
                  <p className="text-[11px] text-[#645c50]">
                    Provision identity roles, cohort grouping, and institutional campus access.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInviteModalOpen(false);
                  setInviteError(null);
                }}
                className="p-1 rounded-lg border border-transparent hover:border-[#201e1d] hover:bg-white text-[#645c50] hover:text-[#201e1d]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitInvite} className="p-5 space-y-4">
              {inviteError && (
                <div className="p-3 rounded-xl bg-[#ffe4e6] border-2 border-[#e11d48] text-[#9f1239] text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{inviteError}</span>
                </div>
              )}

              {/* Display Name */}
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Charlie Campbell"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] focus:outline-none focus:bg-[#fcfaf6]"
                />
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                  Email Address <span className="text-[#e11d48]">*</span>
                </label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] focus:outline-none focus:bg-[#fcfaf6]"
                />
              </div>

              {/* Role Select & Cohort */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                    Role &amp; Permissions
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2.5 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] focus:outline-none cursor-pointer"
                  >
                    <option value="student">Student (Learner)</option>
                    <option value="teacher">Teacher (Educator)</option>
                    <option value="admin">Administrator (Deck)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                    Cohort / Dept
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 11B Physics or General"
                    value={inviteCohort}
                    onChange={(e) => setInviteCohort(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] focus:outline-none focus:bg-[#fcfaf6]"
                  />
                </div>
              </div>

              {/* School Account Toggle */}
              <div className="p-3 rounded-xl bg-white border-2 border-[#201e1d] flex items-center justify-between">
                <div>
                  <div className="font-heading font-black text-xs text-[#201e1d]">
                    Institutional School Campus
                  </div>
                  <div className="text-[10px] text-[#645c50]">
                    Grants access to school-wide license seats and cohort assignments.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={inviteIsSchool}
                  onChange={(e) => setInviteIsSchool(e.target.checked)}
                  className="w-5 h-5 accent-[#201e1d] cursor-pointer"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsInviteModalOpen(false);
                    setInviteError(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border-2 border-[#201e1d] bg-white text-xs font-bold text-[#645c50] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInvite}
                  className="px-5 py-2.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] font-heading font-black text-xs text-[#272e1b] shadow-offset-2 hover:bg-[#b8c99d] active:translate-y-0.5 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {submittingInvite ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Invite...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Send Invitation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Revoke Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-[#201e1d]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#fcfaf6] border-2 border-[#201e1d] rounded-3xl shadow-offset-4 overflow-hidden animate-in fade-in duration-150">
            <div className="p-5 bg-[#ffe4e6] border-b-2 border-[#201e1d] flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border-2 border-[#201e1d] flex items-center justify-center text-[#e11d48] shadow-offset-1">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading font-black text-base text-[#201e1d]">
                  Revoke / Delete User
                </h3>
                <p className="text-[11px] text-[#9f1239]">
                  Are you sure you want to remove this account?
                </p>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs text-[#645c50]">
                You are about to remove <strong className="text-[#201e1d]">{userToDelete.name}</strong> ({userToDelete.email}).
                This will revoke their access permissions and remove them from the active directory.
              </p>

              <div className="p-3 rounded-xl bg-white border-2 border-[#201e1d]/30 font-mono text-[11px] space-y-1">
                <div><span className="text-[#645c50]">Role:</span> <strong className="uppercase">{userToDelete.role}</strong></div>
                <div><span className="text-[#645c50]">Account Type:</span> <strong>{userToDelete.is_school_account ? 'School Campus' : 'Individual'}</strong></div>
                <div><span className="text-[#645c50]">Status:</span> <strong className="uppercase">{userToDelete.status}</strong></div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={deletingUser}
                  onClick={() => setUserToDelete(null)}
                  className="px-4 py-2 rounded-xl border-2 border-[#201e1d] bg-white text-xs font-bold text-[#645c50] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingUser}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-[#e11d48] border-2 border-[#201e1d] font-heading font-black text-xs text-white shadow-offset-2 hover:bg-[#be123c] active:translate-y-0.5 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deletingUser ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Revoking...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirm Revocation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

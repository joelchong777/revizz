'use client';
import { authFetch } from '../../lib/authFetch';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Search,
  X,
  Plus,
  UserPlus,
  Eye,
  EyeOff,
  Key,
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
  UserX,
  Mail,
  ExternalLink,
  ChevronDown,
  ArrowUpDown,
  Filter,
  Flame,
  Zap,
  Link as LinkIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import {
  addRosterInvite,
  getRosterInvites,
  deleteRosterInvite,
  RosterInvite,
} from '@/lib/roster';
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

const STORAGE_OVERRIDES_KEY = 'revizz_admin_user_overrides_v2';
const STORAGE_DELETED_KEY = 'revizz_admin_deleted_users_v2';
const STORAGE_USERS_CACHE_KEY = 'revizz_admin_users_cache_v2';

const LEGACY_STORAGE_KEYS = [
  'revizz_admin_user_overrides_v1',
  'revizz_admin_deleted_users_v1',
  'revizz_admin_users_cache_v1',
];

const cleanupLegacyStorage = (): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      storage.removeItem(key);
    }
  } catch (e) {
    console.warn('Failed to cleanup legacy admin storage:', e);
  }
};

export const isTestFixtureEmail = (email?: string): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (
    normalized === 'student.alpha@school.edu' ||
    normalized === 'teacher.beta@school.edu' ||
    normalized === 'test_user_admin_verify@example.com' ||
    normalized === 'created_via_rpc@example.com' ||
    normalized.endsWith('@revizz.local')
  ) {
    return true;
  }
  return false;
};

const getStorage = (): Storage | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

const getStoredUsersCache = (): ManagedUser[] => {
  cleanupLegacyStorage();
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_USERS_CACHE_KEY);
    const parsed: ManagedUser[] = raw ? JSON.parse(raw) : [];
    return parsed.filter((u) => !isTestFixtureEmail(u.email));
  } catch (e) {
    console.warn('Failed to parse admin users cache:', e);
    return [];
  }
};

const saveStoredUsersCache = (cachedUsers: ManagedUser[]): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_USERS_CACHE_KEY, JSON.stringify(cachedUsers));
  } catch (e) {
    console.warn('Failed to save admin users cache:', e);
  }
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
  const [users, setUsers] = useState<ManagedUser[]>(() => getStoredUsersCache());
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
  const [lastInviteResult, setLastInviteResult] = useState<{
    email: string;
    inviteLink: string;
    mailtoUrl: string;
    emailDelivery: {
      sent: boolean;
      provider?: string | null;
      reason?: string;
    };
  } | null>(null);
  const [copiedInviteLinkId, setCopiedInviteLinkId] = useState<string | null>(null);

  // Create User with Password Modal states
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState<boolean>(false);
  const [createUserName, setCreateUserName] = useState<string>('');
  const [createUserEmail, setCreateUserEmail] = useState<string>('');
  const [createUserPassword, setCreateUserPassword] = useState<string>('');
  const [createUserRole, setCreateUserRole] = useState<UserRole>('student');
  const [createUserCohort, setCreateUserCohort] = useState<string>('General');
  const [createUserIsSchool, setCreateUserIsSchool] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [submittingCreateUser, setSubmittingCreateUser] = useState<boolean>(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [lastCreatedUserResult, setLastCreatedUserResult] = useState<{
    user: ManagedUser;
    password: string;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState<boolean>(false);

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

  // Primary loader function connecting to live Supabase API route
  const loadDirectoryData = useCallback(async () => {
    setLoading(true);
    const deletedIds = getStoredDeletedIds();
    const overrides = getStoredOverrides();

    // 1. Primary path: Fetch live directory from backend API /api/admin/users
    try {
      const res = await authFetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          const liveUsers: ManagedUser[] = data.users
            .filter((u: ManagedUser) => !deletedIds.has(u.id) && !isTestFixtureEmail(u.email))
            .map((u: ManagedUser) => {
              const override = overrides[u.id];
              if (!override) return u;
              return {
                ...u,
                role: override.role || u.role,
                is_school_account:
                  override.is_school_account !== undefined
                    ? override.is_school_account
                    : u.is_school_account,
                status: override.status || u.status,
              };
            });

          setUsers(liveUsers);
          saveStoredUsersCache(liveUsers);
          setLoading(false);
          return;
        }
      }
    } catch (apiErr) {
      console.warn('Notice from /api/admin/users GET (falling back to local cache/client):', apiErr);
    }

    // 2. Offline fallback: check cached users
    const cached = getStoredUsersCache();
    if (cached.length > 0) {
      const filteredCached = cached.filter((u) => !deletedIds.has(u.id) && !isTestFixtureEmail(u.email));
      setUsers(filteredCached);
      setLoading(false);
      return;
    }

    // 3. Direct fallback to Supabase client & roster if offline / initial fallback
    const directory: ManagedUser[] = [];
    const seenEmails = new Set<string>();

    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(profiles)) {
        for (const p of profiles) {
          if (!p.id || deletedIds.has(p.id)) continue;
          const email = (p.email || '').trim().toLowerCase();
          if (isTestFixtureEmail(email)) continue;
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

    try {
      const invites = await getRosterInvites();
      for (const inv of invites) {
        if (!inv.id || deletedIds.has(inv.id)) continue;
        const normEmail = (inv.email || '').trim().toLowerCase();
        if (isTestFixtureEmail(normEmail)) continue;
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

    setUsers(directory);
    saveStoredUsersCache(directory);
    setLoading(false);
  }, []);

  useEffect(() => {
    cleanupLegacyStorage();
    loadDirectoryData();
  }, [loadDirectoryData]);

  // Role Switcher Handler
  const handleUpdateRole = async (userId: string, newRole: UserRole) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    // Optimistically update UI state
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

    // Persist to live backend API
    try {
      await authFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          role: newRole,
          isInvite: targetUser.isInvite,
        }),
      });
    } catch (e) {
      console.warn('Failed to update role via /api/admin/users, falling back to direct:', e);
      if (targetUser.isInvite) {
        try {
          await supabase.from('roster_invites').update({ role: newRole }).eq('id', userId);
        } catch {}
      } else {
        try {
          await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
        } catch {}
      }
    }

    showFeedback(`Updated role for ${targetUser.name} to ${newRole.toUpperCase()}`);
  };

  // Account Type Switcher Handler
  const handleToggleSchoolAccount = async (userId: string) => {
    const targetUser = users.find((u) => u.id === userId);
    if (!targetUser) return;

    const newIsSchool = !targetUser.is_school_account;

    // Optimistically update UI state
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

    // Persist to live backend API
    try {
      await authFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          is_school_account: newIsSchool,
          isInvite: targetUser.isInvite,
        }),
      });
    } catch (e) {
      console.warn('Failed to update school account via /api/admin/users, falling back to direct:', e);
      if (!targetUser.isInvite) {
        try {
          await supabase
            .from('profiles')
            .update({ is_school_account: newIsSchool })
            .eq('id', userId);
        } catch {}
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

    // Optimistically update UI state
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

    // Persist to live backend API
    try {
      await authFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          status: newStatus,
          isInvite: targetUser.isInvite,
        }),
      });
    } catch (e) {
      console.warn('Failed to update status via /api/admin/users, falling back to direct:', e);
      if (targetUser.isInvite) {
        try {
          const rosterStatus = newStatus === 'active' ? 'claimed' : 'pending';
          await supabase
            .from('roster_invites')
            .update({ status: rosterStatus })
            .eq('id', userId);
        } catch {}
      }
    }

    showFeedback(`User status for ${targetUser.name} changed to ${newStatus.toUpperCase()}`);
  };

  // Delete / Revoke Handler
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    const { id, isInvite, name, email } = userToDelete;

    // Optimistically remove user from UI state
    setUsers((prev) => prev.filter((u) => u.id !== id));

    // Persist to live backend API
    try {
      await authFetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isInvite }),
      });
    } catch (e) {
      console.warn('Notice while deleting user record via /api/admin/users:', e);
      if (isInvite) {
        await deleteRosterInvite(id);
      } else {
        await supabase.from('profiles').delete().eq('id', id);
      }
    }

    // Persist deletion locally so it never reappears
    const deletedIds = getStoredDeletedIds();
    deletedIds.add(id);
    saveStoredDeletedIds(deletedIds);

    // Update cached users
    saveStoredUsersCache(users.filter((u) => u.id !== id));

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
      let createdUser: ManagedUser | null = null;
      let apiInviteLink: string | undefined;
      let apiMailtoUrl: string | undefined;
      let apiEmailDelivery: { sent: boolean; provider?: string | null; reason?: string } | undefined;

      try {
        const res = await authFetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            name: inviteName.trim() || undefined,
            role: inviteRole,
            cohort: inviteCohort.trim() || 'General',
            is_school_account: inviteIsSchool,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            createdUser = data.user;
            apiInviteLink = data.inviteLink;
            apiMailtoUrl = data.mailtoUrl;
            apiEmailDelivery = data.emailDelivery;
          }
        }
      } catch (apiErr) {
        console.warn('Notice from /api/admin/users POST (falling back to roster engine):', apiErr);
      }

      // Fallback to addRosterInvite if API didn't return
      if (!createdUser) {
        const createdInvite = await addRosterInvite({
          email: cleanEmail,
          displayName: inviteName.trim() || undefined,
          role: inviteRole,
          cohort: inviteCohort.trim() || 'General',
          invitedBy: 'Administrator',
        });

        createdUser = {
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
      }

      // Save school account preference in local override if checked
      if (inviteIsSchool) {
        const overrides = getStoredOverrides();
        overrides[createdUser.id] = {
          ...(overrides[createdUser.id] || {}),
          is_school_account: true,
          role: inviteRole,
        };
        saveStoredOverrides(overrides);
      }

      // Prepend returned user to users list
      const newUser = createdUser;
      setUsers((prev) => [newUser, ...prev.filter((u) => u.id !== newUser.id && u.email !== newUser.email)]);

      // Construct inviteLink and mailtoUrl
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const inviteLink =
        apiInviteLink ||
        `${origin}/?invite=${newUser.id}&email=${encodeURIComponent(cleanEmail)}`;
      const mailSubject = encodeURIComponent('Invitation to join Revizz');
      const mailBody = encodeURIComponent(
        `Hi ${inviteName.trim() || cleanEmail.split('@')[0]},\n\nYou have been invited to join Revizz!\nClick here to get started: ${inviteLink}\n\nHappy revising!`
      );
      const mailtoUrl =
        apiMailtoUrl ||
        `mailto:${encodeURIComponent(cleanEmail)}?subject=${mailSubject}&body=${mailBody}`;
      const emailDelivery = apiEmailDelivery || {
        sent: false,
        provider: null,
        reason: 'Email provider not configured',
      };

      if (emailDelivery.sent) {
        showFeedback(`Email notification sent via ${emailDelivery.provider || 'email'}!`);
      } else {
        showFeedback(`Invitation ready for ${cleanEmail}!`);
      }

      // Display the post-invite success panel inside the modal
      setLastInviteResult({
        email: cleanEmail,
        inviteLink,
        mailtoUrl,
        emailDelivery,
      });

      // Reset form fields
      setInviteName('');
      setInviteEmail('');
      setInviteRole('student');
      setInviteCohort('General');
      setInviteIsSchool(false);
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

  const handleCopyInviteLink = (inviteUrl: string, identifier: string, email?: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(inviteUrl);
      setCopiedInviteLinkId(identifier);
      setTimeout(() => setCopiedInviteLinkId(null), 2000);
      showFeedback(
        email ? `Copied invite link for ${email} to clipboard!` : 'Copied invite link to clipboard!'
      );
    }
  };

  const handleCloseInviteModal = () => {
    setIsInviteModalOpen(false);
    setLastInviteResult(null);
    setInviteError(null);
  };

  // Create User with Password Handlers
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let randomPart = '';
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const generated = `Revizz!2026_${randomPart}`;
    setCreateUserPassword(generated);
    setShowPassword(true);
  };

  const handleCloseCreateUserModal = () => {
    setIsCreateUserModalOpen(false);
    setLastCreatedUserResult(null);
    setCreateUserError(null);
    setCreateUserName('');
    setCreateUserEmail('');
    setCreateUserPassword('');
    setCreateUserRole('student');
    setCreateUserCohort('General');
    setCreateUserIsSchool(false);
    setShowPassword(false);
    setCopiedCredentials(false);
  };

  const handleCopyCredentials = (email: string, pass: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const text = `Revizz Account Credentials:\nEmail: ${email}\nPassword: ${pass}\nLogin: ${origin}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedCredentials(true);
      setTimeout(() => setCopiedCredentials(false), 2500);
      showFeedback(`Credentials for ${email} copied to clipboard!`);
    }
  };

  const handleSubmitCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = createUserEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setCreateUserError('Please enter a valid email address (e.g. user@domain.com).');
      return;
    }
    if (!createUserPassword || createUserPassword.trim().length < 6) {
      setCreateUserError('Password must be at least 6 characters long.');
      return;
    }

    setSubmittingCreateUser(true);
    setCreateUserError(null);

    try {
      const res = await authFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          name: createUserName.trim() || undefined,
          role: createUserRole,
          cohort: createUserCohort.trim() || 'General',
          is_school_account: createUserIsSchool,
          password: createUserPassword.trim(),
        }),
      });

      const data = await res.json();
      if (res.status === 401) {
        throw new Error(
          'You are not signed in with a real admin account (Demo App Admin has no login). Sign out, then sign in with your admin account and try again.'
        );
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create user account.');
      }

      const newUser: ManagedUser = data.user;

      if (createUserIsSchool) {
        const overrides = getStoredOverrides();
        overrides[newUser.id] = {
          ...(overrides[newUser.id] || {}),
          is_school_account: true,
          role: createUserRole,
        };
        saveStoredOverrides(overrides);
      }

      // Prepend to users list
      setUsers((prev) => [newUser, ...prev.filter((u) => u.id !== newUser.id && u.email !== newUser.email)]);
      const currentCache = getStoredUsersCache();
      saveStoredUsersCache([newUser, ...currentCache.filter((u) => u.id !== newUser.id && u.email !== newUser.email)]);

      showFeedback(`User ${cleanEmail} created successfully!`);
      setLastCreatedUserResult({
        user: newUser,
        password: createUserPassword.trim(),
      });

      // Clear input fields
      setCreateUserName('');
      setCreateUserEmail('');
      setCreateUserPassword('');
      setCreateUserRole('student');
      setCreateUserCohort('General');
      setCreateUserIsSchool(false);
      setShowPassword(false);
    } catch (err: any) {
      console.error('Failed to create user with credentials:', err);
      setCreateUserError(err?.message || 'Failed to create user account.');
    } finally {
      setSubmittingCreateUser(false);
    }
  };

  // Metrics computation
  const metrics = useMemo(() => {
    const totalUsers = users.length;
    const students = users.filter((u) => u.role === 'student').length;
    const teachers = users.filter((u) => u.role === 'teacher').length;
    const admins = users.filter((u) => u.role === 'admin').length;
    const pendingInvites = users.filter((u) => u.status === 'invited').length;
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
      result = result.filter((u) => u.status === 'invited');
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
      <div className="px-4 py-3 rounded-2xl bg-[#f5ead8] border-2 border-[#201e1d] shadow-offset-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5 md:gap-3">
        <div className="flex flex-col md:flex-row md:items-center gap-x-3 gap-y-1.5 min-w-0 md:flex-1">
          <h1 className="text-xl font-heading font-black tracking-tight text-[#201e1d] whitespace-nowrap leading-tight">
            User Management 👥
          </h1>
          {/* Neobrutalist Badges */}
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className="md:hidden xl:inline-block px-2.5 py-0.5 rounded-full bg-[#201e1d] text-[#f9f4ed] font-mono text-[10px] font-bold tracking-wider whitespace-nowrap">
              USER OPERATIONS · ACCESS CONTROL
            </span>
            <span className="hidden 2xl:inline-block px-2.5 py-0.5 rounded-full bg-[#ffe1d0] border border-[#201e1d] font-mono text-[10px] font-bold text-[#201e1d] whitespace-nowrap">
              Role &amp; Identity Management
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#dcfce7] border border-[#15803d] font-mono text-[10px] font-bold text-[#15803d] flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-pulse" />
              <span>Live Database Connected</span>
              <span className="px-1.5 rounded-full bg-[#15803d] text-white text-[10px]">
                {metrics.totalUsers} Total
              </span>
            </span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="grid grid-cols-2 md:flex md:flex-nowrap items-stretch md:items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadDirectoryData}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-white border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-1 hover:bg-[#eee7db] active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
            title="↻ Sync with Supabase / Refresh directory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync with Supabase</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 rounded-xl bg-[#eee7db] border-2 border-[#201e1d] text-xs font-bold text-[#201e1d] shadow-offset-1 hover:bg-[#e0d6c5] active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="Export directory data to CSV format"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLastInviteResult(null);
              setInviteError(null);
              setIsInviteModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] text-[#272e1b] font-heading font-black text-xs shadow-offset-1 hover:bg-[#b8c99d] active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Invite User</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLastCreatedUserResult(null);
              setCreateUserError(null);
              setIsCreateUserModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-[#bfdbfe] border-2 border-[#201e1d] text-[#1e3a8a] font-heading font-black text-xs shadow-offset-1 hover:bg-[#93c5fd] active:translate-y-0.5 transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Add User</span>
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
                onClick={() => {
                  setLastInviteResult(null);
                  setInviteError(null);
                  setIsInviteModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] font-heading font-black text-xs text-[#272e1b] shadow-offset-2 hover:bg-[#b8c99d] active:translate-y-0.5 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Invite User</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLastCreatedUserResult(null);
                  setCreateUserError(null);
                  setIsCreateUserModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#bfdbfe] border-2 border-[#201e1d] font-heading font-black text-xs text-[#1e3a8a] shadow-offset-2 hover:bg-[#93c5fd] active:translate-y-0.5 cursor-pointer flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4 stroke-[3]" />
                <span>+ Add User</span>
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

                  const isPendingInvite = user.status === 'invited';

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
                              {isPendingInvite && (
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
                                  className="text-[#645c50] hover:text-[#201e1d] p-0.5 cursor-pointer"
                                  title="Copy email address"
                                >
                                  {copiedEmailId === user.id ? (
                                    <Check className="w-3 h-3 text-[#166534]" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                              {isPendingInvite && user.email && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                    const link = `${origin}/?invite=${user.id}&email=${encodeURIComponent(user.email)}`;
                                    handleCopyInviteLink(link, user.id, user.email);
                                  }}
                                  className="text-[#854d0e] hover:text-[#201e1d] p-0.5 cursor-pointer ml-0.5"
                                  title="Copy invite link for this user"
                                >
                                  {copiedInviteLinkId === user.id ? (
                                    <Check className="w-3 h-3 text-[#166534]" />
                                  ) : (
                                    <LinkIcon className="w-3 h-3" />
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
                        <div className="flex items-center justify-end gap-1.5">
                          {isPendingInvite && user.email && (
                            <>
                              {/* Dedicated Copy Invite Link button */}
                              <button
                                type="button"
                                onClick={() => {
                                  const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                  const link = `${origin}/?invite=${user.id}&email=${encodeURIComponent(user.email)}`;
                                  handleCopyInviteLink(link, user.id, user.email);
                                }}
                                className={`p-1.5 rounded-lg border-2 transition-all shadow-offset-1 cursor-pointer ${
                                  copiedInviteLinkId === user.id
                                    ? 'bg-[#ccdbb2] border-[#201e1d] text-[#166534]'
                                    : 'bg-white border-[#201e1d] text-[#201e1d] hover:bg-[#eee7db]'
                                }`}
                                title="Copy invite link for this user"
                              >
                                {copiedInviteLinkId === user.id ? (
                                  <Check className="w-3.5 h-3.5 text-[#166534]" />
                                ) : (
                                  <LinkIcon className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* Dedicated Open Mail Client button */}
                              <a
                                href={`mailto:${encodeURIComponent(user.email)}?subject=${encodeURIComponent(
                                  'Invitation to join Revizz'
                                )}&body=${encodeURIComponent(
                                  `Hi ${user.name || ''},\n\nYou have been invited to join Revizz!\nClick here to get started: ${
                                    typeof window !== 'undefined' ? window.location.origin : ''
                                  }/?invite=${user.id}&email=${encodeURIComponent(user.email)}\n\nHappy revising!`
                                )}`}
                                className="p-1.5 rounded-lg border-2 border-[#201e1d] bg-white text-[#201e1d] hover:bg-[#eee7db] shadow-offset-1 transition-all cursor-pointer inline-flex items-center justify-center"
                                title="Open mail client to send invitation"
                              >
                                <Mail className="w-3.5 h-3.5" />
                              </a>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={() => setUserToDelete(user)}
                            className="p-1.5 rounded-lg border border-transparent hover:border-[#201e1d] hover:bg-[#ffe4e6] text-[#645c50] hover:text-[#e11d48] transition-colors cursor-pointer"
                            title="Revoke / Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
                  {lastInviteResult ? (
                    <CheckCircle2 className="w-5 h-5 text-[#166534]" />
                  ) : (
                    <Plus className="w-5 h-5 stroke-[3]" />
                  )}
                </div>
                <div>
                  <h3 className="font-heading font-black text-base text-[#201e1d]">
                    {lastInviteResult ? 'Invitation Ready!' : 'Invite New User'}
                  </h3>
                  <p className="text-[11px] text-[#645c50]">
                    {lastInviteResult
                      ? `Access link and delivery details for ${lastInviteResult.email}`
                      : 'Provision identity roles, cohort grouping, and institutional campus access.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseInviteModal}
                className="p-1 rounded-lg border border-transparent hover:border-[#201e1d] hover:bg-white text-[#645c50] hover:text-[#201e1d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {lastInviteResult ? (
              /* Post-Invite Success / Dispatch Panel */
              <div className="p-5 space-y-4">
                {/* Email Delivery Feedback Card */}
                {lastInviteResult.emailDelivery.sent ? (
                  <div className="p-3.5 rounded-2xl bg-[#dcfce7] border-2 border-[#166534] text-[#166534] flex items-start gap-3 shadow-offset-1">
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#166534]" />
                    <div className="space-y-0.5">
                      <div className="font-heading font-black text-xs">
                        Email Notification Dispatched!
                      </div>
                      <div className="text-[11px] text-[#166534]/90">
                        Automated invitation delivered via {lastInviteResult.emailDelivery.provider || 'email service'}.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-[#fef9c3] border-2 border-[#854d0e] text-[#854d0e] flex items-start gap-3 shadow-offset-1">
                    <Mail className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-heading font-black text-xs">
                        Direct Invite Link Ready
                      </div>
                      <div className="text-[11px] text-[#854d0e]/90">
                        {lastInviteResult.emailDelivery.reason ||
                          'Email provider not configured. You can copy the unique link below or send it directly via your mail client.'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Direct Invite Link Box */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                    Direct Activation Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={lastInviteResult.inviteLink}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="flex-1 px-3 py-2.5 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-mono text-[#201e1d] select-all truncate focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyInviteLink(
                          lastInviteResult.inviteLink,
                          'modal',
                          lastInviteResult.email
                        )
                      }
                      className={`px-3.5 py-2.5 rounded-xl border-2 border-[#201e1d] font-heading font-black text-xs transition-all shadow-offset-1 flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        copiedInviteLinkId === 'modal'
                          ? 'bg-[#ccdbb2] text-[#166534]'
                          : 'bg-[#bae6fd] text-[#0369a1] hover:bg-[#93c5fd]'
                      }`}
                    >
                      {copiedInviteLinkId === 'modal' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#166534]" />
                          <span>✓ Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Invite Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Quick Dispatch Actions */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <a
                    href={lastInviteResult.mailtoUrl}
                    className="px-4 py-2.5 rounded-xl border-2 border-[#201e1d] bg-white text-xs font-heading font-bold text-[#201e1d] hover:bg-[#eee7db] shadow-offset-1 flex items-center justify-center gap-2 transition-all active:translate-y-0.5 cursor-pointer"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Open Mail Client</span>
                  </a>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setLastInviteResult(null)}
                      className="px-3.5 py-2.5 rounded-xl border-2 border-[#201e1d] bg-white text-xs font-bold text-[#645c50] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer"
                    >
                      + Invite Another
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseInviteModal}
                      className="px-5 py-2.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] font-heading font-black text-xs text-[#272e1b] shadow-offset-2 hover:bg-[#b8c99d] active:translate-y-0.5 cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Modal Form */
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
                    onClick={handleCloseInviteModal}
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
            )}
          </div>
        </div>
      )}

      {/* "+ Add User" Modal (with credentials) */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#201e1d]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#fcfaf6] border-2 border-[#201e1d] rounded-3xl shadow-offset-4 overflow-hidden animate-in fade-in duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-[#dbeafe] border-b-2 border-[#201e1d] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#bfdbfe] border-2 border-[#201e1d] flex items-center justify-center text-[#1e3a8a] shadow-offset-1">
                  {lastCreatedUserResult ? (
                    <CheckCircle2 className="w-5 h-5 text-[#166534]" />
                  ) : (
                    <UserPlus className="w-5 h-5 stroke-[2.5]" />
                  )}
                </div>
                <div>
                  <h3 className="font-heading font-black text-base text-[#201e1d]">
                    {lastCreatedUserResult ? 'User Created with Credentials!' : 'Add New User'}
                  </h3>
                  <p className="text-[11px] text-[#645c50]">
                    {lastCreatedUserResult
                      ? `Direct credentials generated for ${lastCreatedUserResult.user.email}`
                      : 'Instantly create an active account with login credentials.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseCreateUserModal}
                className="p-1 rounded-lg border border-transparent hover:border-[#201e1d] hover:bg-white text-[#645c50] hover:text-[#201e1d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {lastCreatedUserResult ? (
              /* Success / Credentials View */
              <div className="p-5 space-y-4">
                <div className="p-3.5 rounded-2xl bg-[#dcfce7] border-2 border-[#166534] text-[#166534] flex items-start gap-3 shadow-offset-1">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#166534]" />
                  <div className="space-y-0.5">
                    <div className="font-heading font-black text-xs">
                      Account Active &amp; Ready for Login!
                    </div>
                    <div className="text-[11px] text-[#166534]/90">
                      The user profile has been created and verified in Supabase Auth. Share these credentials with the user.
                    </div>
                  </div>
                </div>

                {/* Credentials Card */}
                <div className="p-4 rounded-2xl bg-white border-2 border-[#201e1d] shadow-offset-1 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#201e1d]/10">
                    <div className="font-heading font-black text-xs text-[#201e1d] flex items-center gap-2">
                      <span>{lastCreatedUserResult.user.name}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-[#f5ead8] border border-[#201e1d]">
                        {lastCreatedUserResult.user.role}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-[#166534] bg-[#dcfce7] px-2 py-0.5 rounded-md border border-[#166534]/30">
                      active
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50] block mb-0.5">
                        Email Address
                      </span>
                      <div className="font-mono font-bold text-[#201e1d] bg-[#fcfaf6] px-3 py-2 rounded-xl border border-[#201e1d]/20 select-all">
                        {lastCreatedUserResult.user.email}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50] block mb-0.5">
                        Temporary / Set Password
                      </span>
                      <div className="font-mono font-bold text-[#201e1d] bg-[#f5ead8] px-3 py-2 rounded-xl border-2 border-[#201e1d] select-all flex items-center justify-between">
                        <span>{lastCreatedUserResult.password}</span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#645c50] block mb-0.5">
                        Login URL
                      </span>
                      <div className="font-mono text-[11px] text-[#645c50] bg-[#fcfaf6] px-3 py-2 rounded-xl border border-[#201e1d]/20 select-all truncate">
                        {typeof window !== 'undefined' ? window.location.origin : 'https://revizz.app'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyCredentials(
                        lastCreatedUserResult.user.email,
                        lastCreatedUserResult.password
                      )
                    }
                    className={`w-full py-2.5 rounded-xl border-2 border-[#201e1d] font-heading font-black text-xs transition-all shadow-offset-1 flex items-center justify-center gap-2 cursor-pointer ${
                      copiedCredentials
                        ? 'bg-[#ccdbb2] text-[#166534]'
                        : 'bg-[#bfdbfe] text-[#1e3a8a] hover:bg-[#93c5fd]'
                    }`}
                  >
                    {copiedCredentials ? (
                      <>
                        <Check className="w-4 h-4 text-[#166534]" />
                        <span>✓ Credentials Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Credentials (Email &amp; Password)</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Success Modal Footer Actions */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setLastCreatedUserResult(null);
                      setCreateUserError(null);
                      setCopiedCredentials(false);
                    }}
                    className="px-4 py-2.5 rounded-xl border-2 border-[#201e1d] bg-white text-xs font-bold text-[#645c50] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer"
                  >
                    + Add Another User
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseCreateUserModal}
                    className="px-5 py-2.5 rounded-xl bg-[#ccdbb2] border-2 border-[#201e1d] font-heading font-black text-xs text-[#272e1b] shadow-offset-2 hover:bg-[#b8c99d] active:translate-y-0.5 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              /* Modal Form */
              <form onSubmit={handleSubmitCreateUser} className="p-5 space-y-4">
                {createUserError && (
                  <div className="p-3 rounded-xl bg-[#ffe4e6] border-2 border-[#e11d48] text-[#9f1239] text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{createUserError}</span>
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
                    value={createUserName}
                    onChange={(e) => setCreateUserName(e.target.value)}
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
                    value={createUserEmail}
                    onChange={(e) => setCreateUserEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-bold text-[#201e1d] focus:outline-none focus:bg-[#fcfaf6]"
                  />
                </div>

                {/* Password with generator & visibility toggle */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50]">
                      Initial Password <span className="text-[#e11d48]">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="text-[11px] font-heading font-black text-[#1e3a8a] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#2563eb]" />
                      <span>Generate Password</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min 6 characters (e.g. Revizz!2026_x7)"
                      required
                      minLength={6}
                      value={createUserPassword}
                      onChange={(e) => setCreateUserPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-white border-2 border-[#201e1d] rounded-xl text-xs font-mono font-bold text-[#201e1d] focus:outline-none focus:bg-[#fcfaf6]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#645c50] hover:text-[#201e1d] cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="mt-1 text-[10px] text-[#645c50]">
                    Password must be at least 6 characters. User will be created directly in Supabase Auth.
                  </div>
                </div>

                {/* Role & Cohort */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[#645c50] mb-1">
                      Role &amp; Permissions
                    </label>
                    <select
                      value={createUserRole}
                      onChange={(e) => setCreateUserRole(e.target.value as UserRole)}
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
                      value={createUserCohort}
                      onChange={(e) => setCreateUserCohort(e.target.value)}
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
                    checked={createUserIsSchool}
                    onChange={(e) => setCreateUserIsSchool(e.target.checked)}
                    className="w-5 h-5 accent-[#201e1d] cursor-pointer"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={handleCloseCreateUserModal}
                    className="px-4 py-2.5 rounded-xl border-2 border-[#201e1d] bg-white text-xs font-bold text-[#645c50] hover:bg-[#eee7db] active:translate-y-0.5 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingCreateUser}
                    className="px-5 py-2.5 rounded-xl bg-[#bfdbfe] border-2 border-[#201e1d] font-heading font-black text-xs text-[#1e3a8a] shadow-offset-2 hover:bg-[#93c5fd] active:translate-y-0.5 cursor-pointer disabled:opacity-50 flex items-center gap-2"
                  >
                    {submittingCreateUser ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Creating User...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Create User</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
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

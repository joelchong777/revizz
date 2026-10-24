import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { authFetch } from './authFetch';
import { UserProfile } from '../types';
import { setStudentStorageScope, notifyStudentProfileChanged } from './studentProfile';

export const PROVIDER_NOT_ENABLED_CODE = 'PROVIDER_NOT_ENABLED';

export interface AuthCustomError extends Error {
  code: string;
  status: number;
  originalError?: unknown;
}

export interface SignInOptions {
  redirectTo?: string;
  scopes?: string;
  queryParams?: { [key: string]: string };
  skipBrowserRedirect?: boolean;
}

/**
 * Checks whether an error represents a disabled Supabase OAuth provider
 * (e.g. Google Sign-In not enabled in Supabase Dashboard).
 */
export const isProviderNotEnabledError = (error: unknown): boolean => {
  if (!error) return false;
  const anyErr = error as any;
  if (anyErr.code === PROVIDER_NOT_ENABLED_CODE) return true;

  const msg = [
    anyErr.message,
    anyErr.error_description,
    anyErr.msg,
    typeof error === 'string' ? error : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const code = anyErr.code ?? anyErr.error_code ?? anyErr.status;

  const codeMatches =
    code === 400 ||
    code === '400' ||
    code === 'validation_failed' ||
    anyErr.error_code === 'validation_failed' ||
    anyErr.error === 'unsupported_provider';

  const messageMatches =
    msg.includes('unsupported provider') ||
    msg.includes('provider is not enabled') ||
    msg.includes('not enabled');

  return messageMatches || (codeMatches && (msg.includes('provider') || msg.includes('validation')));
};

/**
 * Normalizes authentication errors into friendly, structured Error instances.
 */
export const normalizeAuthError = (error: unknown): AuthCustomError => {
  if (!error) {
    const defaultErr = new Error('Unknown authentication error') as AuthCustomError;
    defaultErr.code = 'UNKNOWN_AUTH_ERROR';
    defaultErr.status = 500;
    return defaultErr;
  }

  const anyErr = error as any;
  if (anyErr.code === PROVIDER_NOT_ENABLED_CODE && anyErr instanceof Error) {
    return anyErr as AuthCustomError;
  }

  const msg = [
    anyErr.message,
    anyErr.error_description,
    anyErr.msg,
    typeof error === 'string' ? error : '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const code = anyErr.code ?? anyErr.error_code ?? anyErr.status;

  const isUnsupported =
    code === 400 ||
    code === '400' ||
    code === 'validation_failed' ||
    anyErr.error_code === 'validation_failed' ||
    anyErr.error === 'unsupported_provider' ||
    msg.includes('unsupported provider') ||
    msg.includes('not enabled') ||
    msg.includes('provider is not enabled');

  if (isUnsupported) {
    const friendlyError = new Error(
      'Google Sign-In is not currently enabled in the Supabase Dashboard (Auth > Providers > Google).'
    ) as AuthCustomError;
    friendlyError.code = PROVIDER_NOT_ENABLED_CODE;
    friendlyError.status = 400;
    friendlyError.originalError = error;
    return friendlyError;
  }

  if (error instanceof Error) {
    const structured = error as AuthCustomError;
    if (!structured.code) structured.code = code ? String(code) : 'AUTH_ERROR';
    if (!structured.status) structured.status = typeof code === 'number' ? code : 400;
    return structured;
  }

  const fallbackMsg = anyErr.message || anyErr.error_description || String(error);
  const fallbackError = new Error(fallbackMsg) as AuthCustomError;
  fallbackError.code = code ? String(code) : 'AUTH_ERROR';
  fallbackError.status = typeof code === 'number' ? code : 400;
  fallbackError.originalError = error;
  return fallbackError;
};

/**
 * Initiates Google OAuth sign-in via Supabase, catching and normalizing
 * provider configuration errors into actionable user messages.
 */
export const signInWithGoogle = async (options?: SignInOptions) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: options?.redirectTo ?? (typeof window !== 'undefined' ? window.location.origin : ''),
        scopes: options?.scopes,
        queryParams: options?.queryParams,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      throw normalizeAuthError(error);
    }

    if (data?.url) {
      try {
        const probe = await fetch(data.url, { method: 'GET' });
        if (!probe.ok && probe.type !== 'opaqueredirect') {
          const errorBody = await probe.json().catch(() => null);
          throw normalizeAuthError(errorBody || new Error(`OAuth provider error (${probe.status})`));
        }

        if (typeof window !== 'undefined') {
          window.location.assign(data.url);
        }
      } catch (probeErr: any) {
        throw normalizeAuthError(probeErr);
      }
    }

    return data;
  } catch (err) {
    throw normalizeAuthError(err);
  }
};

/**
 * Signs up a new user with email and password, setting full_name in user_metadata if provided.
 */
export const signUpWithEmail = async (email: string, password: string, displayName?: string) => {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: displayName ? { full_name: displayName.trim() } : undefined,
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) {
      throw normalizeAuthError(error);
    }

    return data;
  } catch (err) {
    throw normalizeAuthError(err);
  }
};

/**
 * Maps the "email or username" field of a sign-in form to an email address.
 * The word `admin` (any case, surrounding spaces ignored) resolves to the
 * admin account's email; anything else must already contain an "@".
 * Throws "Enter your email address" for any other input without "@".
 */
export const resolveLoginIdentifier = (input: string): string => {
  const trimmed = (input ?? '').trim();
  const lowered = trimmed.toLowerCase();
  if (!lowered.includes('@')) {
    if (lowered === 'admin') return 'admin@revizz.app';
    throw new Error('Enter your email address');
  }
  return trimmed;
};

/**
 * Sends a password-reset email. Resolves the same way whether or not an account
 * exists, so the form can never be used to discover registered emails.
 * Throws only for an invalid email, a rate limit or a network error.
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  const trimmed = resolveLoginIdentifier(email);
  let error: any = null;
  try {
    const res = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    error = res?.error ?? null;
  } catch (err) {
    error = err ?? new Error('network');
  }
  if (!error) return;
  const text = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
  if (error?.status === 429 || text.includes('rate') || text.includes('too many')) {
    throw new Error('Too many reset requests. Wait a few minutes and try again.');
  }
  if (error?.status === 0 || error?.name === 'AuthRetryableFetchError' || text.includes('fetch') || text.includes('network')) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  // Anything else could reveal account state; treat as sent.
};

/** Sets a new password for the signed-in (or recovery-session) user. */
export const updatePassword = async (newPassword: string): Promise<void> => {
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { needs_password: false },
  });
  if (error) {
    const text = String((error as any)?.message ?? '').trim();
    throw new Error(text || 'Could not update your password. Try again.');
  }
};

/**
 * Permanently deletes the signed-in user's account (server route), clears this
 * device's revizz_ data, then signs out. Admins are refused by the server.
 */
export const deleteMyAccount = async (): Promise<void> => {
  const res = await authFetch('/api/account/delete', { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || 'Could not delete your account');
  }
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('revizz_')) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Storage unavailable; the account is already gone.
    }
  }
  await signOut();
};

/**
 * Signs in an existing user with email and password.
 */
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw normalizeAuthError(error);
    }

    return data;
  } catch (err) {
    throw normalizeAuthError(err);
  }
};

/**
 * Sends a passwordless OTP / magic link to the user's email.
 */
export const signInWithOtp = async (email: string, displayName?: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        data: displayName ? { full_name: displayName.trim() } : undefined,
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });

    if (error) {
      throw normalizeAuthError(error);
    }

    return data;
  } catch (err) {
    throw normalizeAuthError(err);
  }
};

export const DEMO_STUDENT_STORAGE_KEY = 'revizz_demo_student_session';

export const DEFAULT_DEMO_STUDENT_PROFILE: UserProfile = {
  id: 'demo-student-local',
  display_name: 'Demo Student',
  email: null,
  is_school_account: false,
  total_xp: 0,
  current_streak: 0,
  opt_in_leaderboard: false,
  role: 'student',
};

export const GUEST_EDUCATOR_STORAGE_KEY = 'revizz_guest_educator_session';

export const DEFAULT_GUEST_EDUCATOR_PROFILE: UserProfile = {
  id: 'guest-educator-local',
  display_name: 'Guest Educator',
  email: 'educator.guest@revizz.app',
  is_school_account: true,
  total_xp: 2500,
  current_streak: 5,
  opt_in_leaderboard: false,
  role: 'teacher',
};

export const DEFAULT_DEMO_ADMIN_PROFILE: UserProfile = {
  id: 'demo-admin-local',
  display_name: 'Demo App Admin',
  email: 'admin.demo@revizz.app',
  is_school_account: true,
  total_xp: 9999,
  current_streak: 14,
  opt_in_leaderboard: false,
  role: 'admin',
};

export const ACTIVE_CUSTOM_SESSION_KEY = 'revizz_active_custom_profile';

const getStorage = (): Storage | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
};

export const getDemoStudentSession = (): UserProfile | null => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(DEMO_STUDENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch (e) {
    console.warn('Failed to parse demo student session from storage:', e);
    return null;
  }
};

export const setDemoStudentSession = (profile: UserProfile): void => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(DEMO_STUDENT_STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to persist demo student session to storage:', e);
    }
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('revizz:auth_changed', { detail: profile }));
  }
};

export const clearDemoStudentSession = (): void => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(DEMO_STUDENT_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear demo student session from storage:', e);
    }
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('revizz:auth_changed', { detail: null }));
  }
};

export const signInAsDemoStudent = (customProfile?: Partial<UserProfile>): UserProfile => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(GUEST_EDUCATOR_STORAGE_KEY);
      storage.removeItem(ACTIVE_CUSTOM_SESSION_KEY);
    } catch (e) {
      console.warn('Failed to clear other sessions from storage:', e);
    }
  }
  const profile: UserProfile = {
    ...DEFAULT_DEMO_STUDENT_PROFILE,
    ...customProfile,
  };
  setDemoStudentSession(profile);
  return profile;
};

export const isDemoStudentSession = (profile: UserProfile | null): boolean => {
  if (!profile || !profile.id) return false;
  return profile.id === 'demo-student-local' || profile.id.startsWith('demo-');
};

export const getGuestEducatorSession = (): UserProfile | null => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(GUEST_EDUCATOR_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserProfile;
  } catch (e) {
    console.warn('Failed to parse guest educator session from storage:', e);
    return null;
  }
};

export const setGuestEducatorSession = (profile: UserProfile): void => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(GUEST_EDUCATOR_STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to persist guest educator session to storage:', e);
    }
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('revizz:auth_changed', { detail: profile }));
  }
};

export const clearGuestEducatorSession = (): void => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(GUEST_EDUCATOR_STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear guest educator session from storage:', e);
    }
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('revizz:auth_changed', { detail: null }));
  }
};

/**
 * Creates and persists a temporary local guest educator session for frictionless testing without OAuth.
 */
export const signInAsGuestEducator = (customProfile?: Partial<UserProfile>): UserProfile => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(DEMO_STUDENT_STORAGE_KEY);
      storage.removeItem(ACTIVE_CUSTOM_SESSION_KEY);
    } catch (e) {
      console.warn('Failed to clear other sessions from storage:', e);
    }
  }
  const profile: UserProfile = {
    ...DEFAULT_GUEST_EDUCATOR_PROFILE,
    ...customProfile,
  };
  setGuestEducatorSession(profile);
  return profile;
};

export const getActiveLocalSession = (): UserProfile | null => {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const rawCustom = storage.getItem(ACTIVE_CUSTOM_SESSION_KEY);
    if (rawCustom) return JSON.parse(rawCustom) as UserProfile;

    const rawGuest = storage.getItem(GUEST_EDUCATOR_STORAGE_KEY);
    if (rawGuest) return JSON.parse(rawGuest) as UserProfile;

    const rawDemo = storage.getItem(DEMO_STUDENT_STORAGE_KEY);
    if (rawDemo) return JSON.parse(rawDemo) as UserProfile;

    return null;
  } catch (e) {
    console.warn('Failed to parse active local session from storage:', e);
    return null;
  }
};

export const setActiveLocalSession = (profile: UserProfile): void => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(DEMO_STUDENT_STORAGE_KEY);
      storage.removeItem(GUEST_EDUCATOR_STORAGE_KEY);
      storage.setItem(ACTIVE_CUSTOM_SESSION_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('Failed to persist active custom profile session to storage:', e);
    }
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('revizz:auth_changed', { detail: profile }));
  }
};

export const clearActiveLocalSession = (): void => {
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(ACTIVE_CUSTOM_SESSION_KEY);
    } catch (e) {
      console.warn('Failed to clear active custom profile session from storage:', e);
    }
  }

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('revizz:auth_changed', { detail: null }));
  }
};

export const signInAsDemoAdmin = (customProfile?: Partial<UserProfile>): UserProfile => {
  const profile: UserProfile = {
    ...DEFAULT_DEMO_ADMIN_PROFILE,
    ...customProfile,
  };
  setActiveLocalSession(profile);
  return profile;
};

export const signOut = async () => {
  clearDemoStudentSession();
  clearGuestEducatorSession();
  clearActiveLocalSession();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const formatDisplayName = (fullName: string | undefined | null, email: string) => {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return parts[0];
  }
  return email.split('@')[0];
};

export const checkIsSchoolAccount = (email: string) => {
  return email.toLowerCase().includes('frontier');
};

export const useAuth = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(() => {
    return getActiveLocalSession();
  });
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Set during render so children reading profile storage in this same render see the right user.
  const scopeChanged = setStudentStorageScope(userProfile?.id);
  useEffect(() => {
    if (scopeChanged) notifyStudentProfileChanged();
  });

  useEffect(() => {
    let mounted = true;

    // Listen for custom guest/demo auth updates across tabs / components
    const handleLocalAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<UserProfile | null>;
      if (mounted) {
        if (customEvent && customEvent.detail !== undefined) {
          setUserProfile(customEvent.detail);
        } else {
          setUserProfile(getActiveLocalSession());
        }
      }
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('revizz:auth_changed', handleLocalAuthChange);
    }

    const fetchProfile = async (userId: string) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();

        if (error) {
          console.error('Error fetching profile:', error);
          if (mounted) setUserProfile(getActiveLocalSession());
        } else if (mounted) {
          setUserProfile(data as UserProfile);
        }
      } catch (e) {
        console.error('Exception fetching profile:', e);
        if (mounted) setUserProfile(getActiveLocalSession());
      }
    };

    const safetyTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 1500);

    const handleAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        const session = data?.session;
        
        if (session?.user) {
          // Sync/create profile
          const email = session.user.email || '';
          const name = session.user.user_metadata?.full_name || '';
          
          const isSchoolAccount = checkIsSchoolAccount(email);
          const displayName = formatDisplayName(name, email);

          // Roster invites are claimed server-side; the browser never writes role.
          try {
            await supabase.rpc('claim_roster_invite');
          } catch (inviteErr) {
            console.warn('Error claiming roster invite:', inviteErr);
          }

          try {
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (!existingProfile) {
              const newProfile: UserProfile = {
                id: session.user.id,
                display_name: displayName,
                email: email,
                is_school_account: isSchoolAccount,
                total_xp: 0,
                current_streak: 0,
                opt_in_leaderboard: false,
                role: 'student',
              };
              
              await supabase.from('profiles').insert(newProfile);
              if (mounted) setUserProfile(newProfile);
            } else {
              if (mounted) setUserProfile(existingProfile as UserProfile);
            }
          } catch (profileError) {
            console.error('Error syncing profile:', profileError);
            if (mounted) setUserProfile(getActiveLocalSession());
          }
        } else {
          if (mounted) setUserProfile(getActiveLocalSession());
        }
      } catch (sessionError) {
        console.error('Error fetching session:', sessionError);
        if (mounted) setUserProfile(getActiveLocalSession());
      } finally {
        if (mounted) setLoading(false);
      }
    };

    handleAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        if (mounted) setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        if (mounted) setIsPasswordRecovery(false);
      }
      if (session?.user) {
        handleAuth();
      } else {
        if (mounted) {
          setUserProfile(getActiveLocalSession());
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('revizz:auth_changed', handleLocalAuthChange);
      }
    };
  }, []);

  return {
    userProfile,
    loading,
    setUserProfile,
    isDemo: isDemoStudentSession(userProfile),
    signInAsDemo: signInAsDemoStudent,
    signInAsGuestEducator,
    signInAsDemoAdmin,
    signOut,
    isPasswordRecovery,
  };
};

/** First-login password for invited users (Supabase-invite path). Clears the needs_password flag. */
export const completeFirstLoginPassword = async (password: string) =>
  supabase.auth.updateUser({ password, data: { needs_password: false } });

/** True when the signed-in Supabase user still has to choose a password. False on any error. */
export const userNeedsPassword = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return false;
    return data.user.user_metadata?.needs_password === true;
  } catch {
    return false;
  }
};

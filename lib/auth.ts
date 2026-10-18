import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { UserProfile } from '../types';
import { checkAndClaimInvite } from './roster';

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
    } catch (e) {
      console.warn('Failed to clear guest educator session from storage:', e);
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
    } catch (e) {
      console.warn('Failed to clear demo student session from storage:', e);
    }
  }
  const profile: UserProfile = {
    ...DEFAULT_GUEST_EDUCATOR_PROFILE,
    ...customProfile,
  };
  setGuestEducatorSession(profile);
  return profile;
};

export const signOut = async () => {
  clearDemoStudentSession();
  clearGuestEducatorSession();
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
    return getDemoStudentSession() || getGuestEducatorSession() || null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Listen for custom guest/demo auth updates across tabs / components
    const handleLocalAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<UserProfile | null>;
      if (mounted) {
        if (customEvent && customEvent.detail !== undefined) {
          setUserProfile(customEvent.detail);
        } else {
          setUserProfile(getDemoStudentSession() || getGuestEducatorSession() || null);
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
          if (mounted) setUserProfile(getDemoStudentSession() || getGuestEducatorSession() || null);
        } else if (mounted) {
          setUserProfile(data as UserProfile);
        }
      } catch (e) {
        console.error('Exception fetching profile:', e);
        if (mounted) setUserProfile(getDemoStudentSession() || getGuestEducatorSession() || null);
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
          
          let isSchoolAccount = checkIsSchoolAccount(email);
          const displayName = formatDisplayName(name, email);

          // Check for roster invite and claim if available
          let claimedInvite = null;
          if (email) {
            try {
              claimedInvite = await checkAndClaimInvite(email, session.user.id);
            } catch (inviteErr) {
              console.warn('Error checking/claiming roster invite:', inviteErr);
            }
          }

          if (claimedInvite) {
            isSchoolAccount = true;
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
                role: claimedInvite?.role || 'student',
              };
              
              await supabase.from('profiles').insert(newProfile);
              if (mounted) setUserProfile(newProfile);
            } else {
              const updates: Partial<UserProfile> = {};

              // ensure school tag is up to date
              if (isSchoolAccount && !existingProfile.is_school_account) {
                updates.is_school_account = true;
                existingProfile.is_school_account = true;
              }

              // If an invite exists and has role === 'teacher' or role === 'admin', ensure role is updated in profile
              if (claimedInvite && (claimedInvite.role === 'teacher' || claimedInvite.role === 'admin')) {
                if (existingProfile.role !== claimedInvite.role) {
                  updates.role = claimedInvite.role;
                  existingProfile.role = claimedInvite.role;
                }
              }

              if (Object.keys(updates).length > 0) {
                await supabase.from('profiles').update(updates).eq('id', session.user.id);
              }

              if (mounted) setUserProfile(existingProfile as UserProfile);
            }
          } catch (profileError) {
            console.error('Error syncing profile:', profileError);
            if (mounted) setUserProfile(getDemoStudentSession() || getGuestEducatorSession() || null);
          }
        } else {
          if (mounted) setUserProfile(getDemoStudentSession() || getGuestEducatorSession() || null);
        }
      } catch (sessionError) {
        console.error('Error fetching session:', sessionError);
        if (mounted) setUserProfile(getDemoStudentSession() || getGuestEducatorSession() || null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    handleAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        handleAuth();
      } else {
        if (mounted) {
          setUserProfile(getDemoStudentSession() || getGuestEducatorSession() || null);
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
    signOut,
  };
};

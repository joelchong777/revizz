import { supabase } from './supabaseClient';

export interface RosterInvite {
  id: string;
  email: string;
  display_name?: string;
  role: 'student' | 'teacher' | 'admin';
  cohort: string;
  invited_by?: string;
  status: 'pending' | 'claimed';
  created_at: string;
}

export const ROSTER_INVITES_STORAGE_KEY = 'revizz_roster_invites';

const getStorage = (): Storage | null => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  return null;
};

const getLocalInvites = (): RosterInvite[] => {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(ROSTER_INVITES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to parse roster invites from storage:', e);
    return [];
  }
};

const saveLocalInvites = (invites: RosterInvite[]): void => {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(ROSTER_INVITES_STORAGE_KEY, JSON.stringify(invites));
  } catch (e) {
    console.warn('Failed to save roster invites to storage:', e);
  }
};

/**
 * Creates and persists a new roster invitation.
 * Normalizes email (trim and lowercase), stores in Supabase roster_invites,
 * and maintains local storage as an offline/demo resilient fallback.
 */
export async function addRosterInvite(invite: {
  email: string;
  displayName?: string;
  role?: 'student' | 'teacher' | 'admin';
  cohort?: string;
  invitedBy?: string;
}): Promise<RosterInvite> {
  const normalizedEmail = (invite.email || '').trim().toLowerCase();
  const newInvite: RosterInvite = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `invite_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    email: normalizedEmail,
    display_name: invite.displayName?.trim() || undefined,
    role: invite.role || 'student',
    cohort: invite.cohort?.trim() || 'General',
    invited_by: invite.invitedBy,
    status: 'pending',
    created_at: new Date().toISOString(),
  };

  try {
    const { data: existingInvite } = await supabase
      .from('roster_invites')
      .select('id')
      .eq('email', newInvite.email)
      .maybeSingle();

    if (existingInvite?.id) {
      newInvite.id = existingInvite.id;
      const { data, error } = await supabase
        .from('roster_invites')
        .update({
          display_name: newInvite.display_name,
          role: newInvite.role,
          cohort: newInvite.cohort,
          invited_by: newInvite.invited_by,
          status: newInvite.status,
        })
        .eq('id', existingInvite.id)
        .select()
        .single();

      if (!error && data && data.created_at) {
        newInvite.created_at = data.created_at;
      }
    } else {
      const { data, error } = await supabase
        .from('roster_invites')
        .insert({
          id: newInvite.id,
          email: newInvite.email,
          display_name: newInvite.display_name,
          role: newInvite.role,
          cohort: newInvite.cohort,
          invited_by: newInvite.invited_by,
          status: newInvite.status,
          created_at: newInvite.created_at,
        })
        .select()
        .single();

      if (!error && data) {
        if (data.id) newInvite.id = data.id;
        if (data.created_at) newInvite.created_at = data.created_at;
      } else if (error) {
        console.warn('Supabase insert roster_invites notice (falling back to local):', error.message || error);
      }
    }
  } catch (err) {
    console.warn('Supabase roster_invites error (using local fallback):', err);
  }

  // Update localStorage fallback
  const localList = getLocalInvites();
  const updated = [newInvite, ...localList.filter((item) => item.id !== newInvite.id && item.email !== newInvite.email)];
  saveLocalInvites(updated);

  return newInvite;
}

/**
 * Retrieves roster invites.
 * Reads from Supabase roster_invites, falling back to localStorage if offline/empty,
 * filtered by cohort if provided and ordered by created_at descending.
 */
export async function getRosterInvites(cohort?: string): Promise<RosterInvite[]> {
  try {
    let query = supabase
      .from('roster_invites')
      .select('*')
      .order('created_at', { ascending: false });

    if (cohort && cohort.trim()) {
      query = query.eq('cohort', cohort.trim());
    }

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      // Sync to local storage
      const currentLocal = getLocalInvites();
      const map = new Map<string, RosterInvite>();
      for (const item of currentLocal) {
        map.set(item.id, item);
      }
      for (const item of data as RosterInvite[]) {
        map.set(item.id, item);
      }
      const merged = Array.from(map.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      saveLocalInvites(merged);
      return data as RosterInvite[];
    }
  } catch (err) {
    console.warn('Supabase getRosterInvites error, falling back to local storage:', err);
  }

  // Fallback to localStorage if offline/empty
  const local = getLocalInvites();
  let filtered = local;
  if (cohort && cohort.trim()) {
    const targetCohort = cohort.trim().toLowerCase();
    filtered = filtered.filter((i) => i.cohort.toLowerCase() === targetCohort);
  }
  return filtered.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Deletes a roster invite by ID.
 * Deletes from Supabase roster_invites and updates localStorage.
 */
export async function deleteRosterInvite(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('roster_invites').delete().eq('id', id);
    if (error) {
      console.warn('Supabase delete roster_invites warning:', error.message || error);
    }
  } catch (err) {
    console.warn('Supabase delete roster_invites error:', err);
  }

  const local = getLocalInvites();
  const updated = local.filter((item) => item.id !== id);
  saveLocalInvites(updated);
  return true;
}

/**
 * Checks for a pending invite matching LOWER(email).
 * If found, updates status to 'claimed' in Supabase and local storage, and returns the invite.
 */
export async function checkAndClaimInvite(
  email: string,
  userId: string
): Promise<RosterInvite | null> {
  if (!email) return null;
  const normalizedEmail = email.trim().toLowerCase();

  let matchedInvite: RosterInvite | null = null;

  try {
    const { data, error } = await supabase
      .from('roster_invites')
      .select('*')
      .ilike('email', normalizedEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!error && data && data.length > 0) {
      matchedInvite = data[0] as RosterInvite;
      const { error: updateError } = await supabase
        .from('roster_invites')
        .update({
          status: 'claimed',
        })
        .eq('id', matchedInvite.id);

      if (updateError) {
        console.warn('Supabase update status to claimed warning:', updateError.message || updateError);
      }
      matchedInvite.status = 'claimed';
    }
  } catch (err) {
    console.warn('Supabase checkAndClaimInvite error, falling back to local storage:', err);
  }

  // Local storage lookup fallback
  const localList = getLocalInvites();
  if (!matchedInvite) {
    const foundLocal = localList.find(
      (i) => i.email.toLowerCase() === normalizedEmail && i.status === 'pending'
    );
    if (foundLocal) {
      matchedInvite = { ...foundLocal, status: 'claimed' };
    }
  }

  // Persist claimed status to local storage
  if (matchedInvite) {
    let foundInLocal = false;
    const updated = localList.map((item) => {
      if (item.id === matchedInvite!.id || item.email.toLowerCase() === normalizedEmail) {
        foundInLocal = true;
        return { ...item, status: 'claimed' as const };
      }
      return item;
    });
    if (!foundInLocal) {
      updated.unshift({ ...matchedInvite, status: 'claimed' });
    }
    saveLocalInvites(updated);
  }

  return matchedInvite;
}

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

/* ==========================================================
   TEACHER CLASSROOM & ROSTER DATA EXTENSIONS
   ========================================================== */

export interface TeacherClassRoom {
  id: string;
  name: string;        // e.g. '10B Physics'
  subjectCode: string; // e.g. '0625' | '0455' | '0610' | '0620'
  subjectName: string; // e.g. 'Physics' | 'Economics' | 'Biology' | 'Chemistry'
  yearGroup: string;   // e.g. 'Year 10' | 'Year 11'
  joinCode: string;    // e.g. 'RVZ-10BP'
  targetAccuracy: number; // default 75
  weeklyGoalXp: number;   // default 500
  createdAt: string;
}

export const TEACHER_CLASSES_STORAGE_KEY = 'revizz_teacher_classes';
export const STUDENT_CLASS_OVERRIDES_KEY = 'revizz_student_class_overrides';

export const DEFAULT_TEACHER_CLASSES: TeacherClassRoom[] = [
  {
    id: 'cls_10b_physics',
    name: '10B Physics',
    subjectCode: '0625',
    subjectName: 'Physics',
    yearGroup: 'Year 10',
    joinCode: 'RVZ-10BP',
    targetAccuracy: 75,
    weeklyGoalXp: 500,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'cls_10a_physics',
    name: '10A Physics',
    subjectCode: '0625',
    subjectName: 'Physics',
    yearGroup: 'Year 10',
    joinCode: 'RVZ-10AP',
    targetAccuracy: 80,
    weeklyGoalXp: 600,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'cls_11a_physics',
    name: '11A Physics',
    subjectCode: '0625',
    subjectName: 'Physics',
    yearGroup: 'Year 11',
    joinCode: 'RVZ-11AP',
    targetAccuracy: 80,
    weeklyGoalXp: 750,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'cls_10_economics',
    name: '10 Economics',
    subjectCode: '0455',
    subjectName: 'Economics',
    yearGroup: 'Year 10',
    joinCode: 'RVZ-10EC',
    targetAccuracy: 75,
    weeklyGoalXp: 500,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: 'cls_10_biology',
    name: '10 Biology',
    subjectCode: '0610',
    subjectName: 'Biology',
    yearGroup: 'Year 10',
    joinCode: 'RVZ-10BI',
    targetAccuracy: 75,
    weeklyGoalXp: 500,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
];

export function getTeacherClasses(): TeacherClassRoom[] {
  const storage = getStorage();
  if (!storage) return DEFAULT_TEACHER_CLASSES;
  try {
    const raw = storage.getItem(TEACHER_CLASSES_STORAGE_KEY);
    if (!raw) return DEFAULT_TEACHER_CLASSES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_TEACHER_CLASSES;
  } catch (e) {
    console.warn('Failed to parse teacher classes from storage:', e);
    return DEFAULT_TEACHER_CLASSES;
  }
}

export function saveTeacherClasses(classes: TeacherClassRoom[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(TEACHER_CLASSES_STORAGE_KEY, JSON.stringify(classes));
  } catch (e) {
    console.warn('Failed to save teacher classes to storage:', e);
  }
}

export function createTeacherClass(input: {
  name: string;
  subjectCode: string;
  subjectName?: string;
  yearGroup?: string;
  targetAccuracy?: number;
  weeklyGoalXp?: number;
}): TeacherClassRoom {
  const current = getTeacherClasses();
  const cleanNameLetters = input.name.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase();
  const codeSuffix = cleanNameLetters.length >= 2 ? cleanNameLetters : Math.random().toString(36).substring(2, 6).toUpperCase();
  const joinCode = `RVZ-${codeSuffix}`;

  const subjectNameMap: Record<string, string> = {
    '0625': 'Physics',
    '0455': 'Economics',
    '0610': 'Biology',
    '0620': 'Chemistry',
  };
  const resolvedSubjectName = input.subjectName || subjectNameMap[input.subjectCode] || 'Cambridge Subject';

  const newClass: TeacherClassRoom = {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? `cls_${crypto.randomUUID()}`
        : `cls_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: input.name.trim(),
    subjectCode: input.subjectCode.trim(),
    subjectName: resolvedSubjectName,
    yearGroup: input.yearGroup?.trim() || 'Year 10',
    joinCode,
    targetAccuracy: input.targetAccuracy ?? 75,
    weeklyGoalXp: input.weeklyGoalXp ?? 500,
    createdAt: new Date().toISOString(),
  };

  const updated = [newClass, ...current];
  saveTeacherClasses(updated);
  return newClass;
}

export function updateTeacherClass(id: string, patch: Partial<TeacherClassRoom>): TeacherClassRoom[] {
  const current = getTeacherClasses();
  const updated = current.map((c) => {
    if (c.id === id) {
      return { ...c, ...patch };
    }
    return c;
  });
  saveTeacherClasses(updated);
  return updated;
}

export function deleteTeacherClass(id: string): TeacherClassRoom[] {
  const current = getTeacherClasses();
  const updated = current.filter((c) => c.id !== id);
  saveTeacherClasses(updated);
  return updated;
}

export interface StudentClassOverride {
  studentId: string;
  notes?: string;
  cohort?: string;
  removed?: boolean;
  manualStudent?: boolean;
  name?: string;
  email?: string;
  updatedAt?: string;
}

export function getStudentClassOverrides(): Record<string, StudentClassOverride> {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(STUDENT_CLASS_OVERRIDES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('Failed to parse student class overrides from storage:', e);
    return {};
  }
}

export function saveStudentClassOverride(
  studentId: string,
  patch: Partial<StudentClassOverride>
): Record<string, StudentClassOverride> {
  const current = getStudentClassOverrides();
  current[studentId] = {
    ...current[studentId],
    studentId,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(STUDENT_CLASS_OVERRIDES_KEY, JSON.stringify(current));
    } catch (e) {
      console.warn('Failed to save student class overrides to storage:', e);
    }
  }
  return current;
}

function escapeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateClassRosterCsv(
  className: string,
  subjectCode: string,
  students: Array<{
    name: string;
    email?: string;
    xp: string | number;
    streak: number;
    acc: number;
    weak: string;
    tier: string;
    last: string;
    status?: string;
  }>
): string {
  const headers = [
    'Class',
    'Subject Code',
    'Student Name',
    'Email',
    'Total XP',
    'Streak (Days)',
    '1st-Try Accuracy (%)',
    'Weakest Topic',
    'Mastery Tier',
    'Last Active',
    'Status',
  ];

  const rows = students.map((s) => [
    escapeCsvCell(className),
    escapeCsvCell(subjectCode),
    escapeCsvCell(s.name),
    escapeCsvCell(s.email || '—'),
    escapeCsvCell(s.xp),
    escapeCsvCell(s.streak),
    escapeCsvCell(`${s.acc}%`),
    escapeCsvCell(s.weak),
    escapeCsvCell(s.tier),
    escapeCsvCell(s.last),
    escapeCsvCell(s.status || (s.streak > 0 ? 'Active' : 'Inactive')),
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}


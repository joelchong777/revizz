import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Polyfill WebSocket in Node runtime if absent
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

export type UserRole = 'student' | 'teacher' | 'admin';
export type UserStatus = 'active' | 'invited' | 'suspended';

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

export interface UserCounts {
  total: number;
  students: number;
  teachers: number;
  admins: number;
  invites: number;
  schoolAccounts: number;
}

function getSupabaseClient(): SupabaseClient {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmvahcaxixvhgxidmkqs.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdmFoY2F4aXh2aGd4aWRta3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTc4NzQsImV4cCI6MjEwNzAzMzg3NH0.qeqa5hQ84xnIOljKmu7SUhcko53qM1gO_dCmYvjnf-4';

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * GET /api/admin/users
 * Fetches all registered user profiles and roster invitations,
 * de-duplicates by normalized email, computes counts, and returns merged directory.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // 1. Fetch all rows from public.profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(
        'id, display_name, email, role, is_school_account, total_xp, current_streak, opt_in_leaderboard, updated_at, created_at'
      )
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.warn('GET /api/admin/users: Failed to query profiles from Supabase:', profilesError.message);
    }

    // 2. Fetch all rows from public.roster_invites
    const { data: rosterInvites, error: invitesError } = await supabase
      .from('roster_invites')
      .select('id, email, display_name, role, cohort, invited_by, status, created_at')
      .order('created_at', { ascending: false });

    if (invitesError) {
      console.warn('GET /api/admin/users: Failed to query roster_invites from Supabase:', invitesError.message);
    }

    const users: ManagedUser[] = [];
    const seenEmails = new Set<string>();

    // 3. Process registered profiles
    if (Array.isArray(profiles)) {
      for (const p of profiles) {
        if (!p.id) continue;
        const normEmail = (p.email || '').trim().toLowerCase();
        if (normEmail) seenEmails.add(normEmail);

        users.push({
          id: p.id,
          name: p.display_name || (normEmail ? normEmail.split('@')[0] : 'Revizz User'),
          email: p.email || '',
          role: (p.role as UserRole) || 'student',
          is_school_account: Boolean(p.is_school_account),
          total_xp: typeof p.total_xp === 'number' ? p.total_xp : 0,
          current_streak: typeof p.current_streak === 'number' ? p.current_streak : 0,
          status: 'active',
          cohort: (p as any).cohort || 'General',
          created_at: p.created_at || new Date().toISOString(),
          isInvite: false,
        });
      }
    }

    // 4. Process roster invites
    if (Array.isArray(rosterInvites)) {
      for (const inv of rosterInvites) {
        if (!inv.id) continue;
        const normEmail = (inv.email || '').trim().toLowerCase();
        if (normEmail && seenEmails.has(normEmail)) continue;
        if (normEmail) seenEmails.add(normEmail);

        const status: UserStatus = inv.status === 'claimed' ? 'active' : 'invited';

        users.push({
          id: inv.id,
          name: inv.display_name || (normEmail ? normEmail.split('@')[0] : 'Invited Learner'),
          email: inv.email || '',
          role: (inv.role as UserRole) || 'student',
          is_school_account: true,
          total_xp: 0,
          current_streak: 0,
          status,
          cohort: inv.cohort || 'General',
          created_at: inv.created_at || new Date().toISOString(),
          isInvite: true,
        });
      }
    }

    // 5. Compute real live counts
    const counts: UserCounts = {
      total: users.length,
      students: users.filter((u) => u.role === 'student').length,
      teachers: users.filter((u) => u.role === 'teacher').length,
      admins: users.filter((u) => u.role === 'admin').length,
      invites: users.filter((u) => u.isInvite || u.status === 'invited').length,
      schoolAccounts: users.filter((u) => u.is_school_account).length,
    };

    return NextResponse.json({
      success: true,
      users,
      counts,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Error in GET /api/admin/users:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/users
 * Creates a new user invitation record in public.roster_invites.
 */
export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { email, name, role, cohort, is_school_account } = body || {};

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required (e.g. user@domain.com)' },
        { status: 400 }
      );
    }

    const validRoles: UserRole[] = ['student', 'teacher', 'admin'];
    const userRole: UserRole = validRoles.includes(role) ? role : 'student';
    const cleanCohort = (cohort || 'General').trim();
    const cleanName = (name || '').trim();
    const isSchool = is_school_account !== undefined ? Boolean(is_school_account) : true;

    const supabase = getSupabaseClient();
    const inviteId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `invite_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newInviteRow = {
      id: inviteId,
      email: cleanEmail,
      display_name: cleanName || null,
      role: userRole,
      cohort: cleanCohort,
      invited_by: 'Administrator',
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('roster_invites')
      .insert(newInviteRow)
      .select()
      .single();

    if (error) {
      console.error('Failed to insert roster_invites in Supabase:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const createdUser: ManagedUser = {
      id: data?.id || inviteId,
      name: data?.display_name || cleanName || cleanEmail.split('@')[0],
      email: cleanEmail,
      role: (data?.role as UserRole) || userRole,
      is_school_account: isSchool,
      total_xp: 0,
      current_streak: 0,
      status: 'invited',
      cohort: data?.cohort || cleanCohort,
      created_at: data?.created_at || newInviteRow.created_at,
      isInvite: true,
    };

    return NextResponse.json({
      success: true,
      user: createdUser,
    });
  } catch (err: any) {
    console.error('Error in POST /api/admin/users:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/users
 * Updates role, institutional school status, or active/invited status.
 * Routes updates to either public.roster_invites (if invite) or public.profiles.
 */
export async function PATCH(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { id, isInvite, role, is_school_account, status } = body || {};

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    if (isInvite) {
      const updatePayload: Record<string, any> = {};
      if (role) updatePayload.role = role;
      if (status) {
        updatePayload.status = status === 'active' ? 'claimed' : 'pending';
      }

      if (Object.keys(updatePayload).length > 0) {
        const { error } = await supabase
          .from('roster_invites')
          .update(updatePayload)
          .eq('id', id);

        if (error) {
          console.error('Failed to update roster_invites in Supabase:', error);
          return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
          );
        }
      }
    } else {
      const updatePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (role) updatePayload.role = role;
      if (is_school_account !== undefined) {
        updatePayload.is_school_account = Boolean(is_school_account);
      }

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
        console.error('Failed to update profiles in Supabase:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      updated: { id, role, is_school_account, status },
    });
  } catch (err: any) {
    console.error('Error in PATCH /api/admin/users:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users
 * Deletes user profile or revokes roster invitation.
 */
export async function DELETE(req: NextRequest) {
  try {
    let id: string | null = null;
    let isInvite: boolean = false;

    // Check query params first
    const { searchParams } = new URL(req.url);
    if (searchParams.get('id')) {
      id = searchParams.get('id');
      isInvite = searchParams.get('isInvite') === 'true';
    }

    // Check request body if ID not in query params
    if (!id) {
      try {
        const body = await req.json();
        if (body?.id) {
          id = body.id;
          isInvite = Boolean(body.isInvite);
        }
      } catch {
        // Body may not be valid JSON or empty
      }
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    if (isInvite) {
      const { error } = await supabase
        .from('roster_invites')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete roster_invites in Supabase:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete profiles in Supabase:', error);
        return NextResponse.json(
          { success: false, error: error.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (err: any) {
    console.error('Error in DELETE /api/admin/users:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

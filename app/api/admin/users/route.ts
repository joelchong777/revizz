import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient, requireRole } from '@/lib/apiAuth';
import { buildInviteLink, buildInviteMailto, sendInviteEmail } from '@/lib/email';

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

/**
 * GET /api/admin/users
 * Fetches all registered user profiles and roster invitations,
 * de-duplicates by normalized email, computes counts, and returns merged directory.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) return auth.response;
  try {
    const supabase = getServiceClient();

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
      invites: users.filter((u) => u.status === 'invited').length,
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
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) return auth.response;
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

    const { email, name, role, cohort, is_school_account, password } = body || {};

    const cleanEmail = (email || '').trim().toLowerCase();
    const validRoles: UserRole[] = ['student', 'teacher', 'admin'];
    const userRole: UserRole = validRoles.includes(role) ? role : 'student';
    const cleanCohort = (cohort || 'General').trim();
    const cleanName = (name || '').trim();
    const isSchool = is_school_account !== undefined ? Boolean(is_school_account) : true;
    const supabase = getServiceClient();

    // Check if password is provided in request body (manual user creation with credentials)
    if (password !== undefined && password !== null) {
      if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        return NextResponse.json(
          { success: false, error: 'A valid email address is required (e.g. user@domain.com)' },
          { status: 400 }
        );
      }

      const cleanPassword = String(password).trim();
      if (cleanPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 6 characters long' },
          { status: 400 }
        );
      }

      // First attempt: call secure SECURITY DEFINER RPC public.admin_create_user
      // This directly seeds auth.users and auth.identities safely even without service_role key
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_create_user', {
        new_email: cleanEmail,
        new_password: cleanPassword,
        new_role: userRole,
        new_name: cleanName || cleanEmail.split('@')[0],
        new_cohort: cleanCohort,
        new_is_school: isSchool,
      });

      if (rpcError) {
        // Fallback to supabase.auth.admin.createUser if service role key is configured
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const { data, error } = await supabase.auth.admin.createUser({
            email: cleanEmail,
            password: cleanPassword,
            email_confirm: true,
            user_metadata: {
              full_name: cleanName || cleanEmail.split('@')[0],
              display_name: cleanName || cleanEmail.split('@')[0],
              role: userRole,
            },
          });

          if (error || !data?.user) {
            return NextResponse.json(
              { success: false, error: error?.message || 'Failed to create user in auth' },
              { status: 400 }
            );
          }

          const profilePayload = {
            id: data.user.id,
            email: cleanEmail,
            display_name: cleanName || cleanEmail.split('@')[0],
            role: userRole,
            is_school_account: isSchool,
            created_at: new Date().toISOString(),
          };

          await supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' });

          const createdUser: ManagedUser = {
            id: data.user.id,
            name: cleanName || cleanEmail.split('@')[0],
            email: cleanEmail,
            role: userRole,
            is_school_account: isSchool,
            total_xp: 0,
            current_streak: 0,
            status: 'active',
            cohort: cleanCohort,
            created_at: data.user.created_at || new Date().toISOString(),
            isInvite: false,
          };

          return NextResponse.json({
            success: true,
            user: createdUser,
            credentials: {
              email: cleanEmail,
              password: cleanPassword,
            },
          });
        }

        return NextResponse.json(
          { success: false, error: rpcError.message || 'Failed to create user in auth' },
          { status: 400 }
        );
      }

      const createdUser: ManagedUser = {
        id: rpcData?.id || `usr_${Date.now()}`,
        name: rpcData?.display_name || cleanName || cleanEmail.split('@')[0],
        email: cleanEmail,
        role: (rpcData?.role as UserRole) || userRole,
        is_school_account: rpcData?.is_school_account !== undefined ? rpcData.is_school_account : isSchool,
        total_xp: 0,
        current_streak: 0,
        status: 'active',
        cohort: rpcData?.cohort || cleanCohort,
        created_at: rpcData?.created_at || new Date().toISOString(),
        isInvite: false,
      };

      return NextResponse.json({
        success: true,
        user: createdUser,
        credentials: {
          email: cleanEmail,
          password: cleanPassword,
        },
      });
    }

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      return NextResponse.json(
        { success: false, error: 'A valid email address is required (e.g. user@domain.com)' },
        { status: 400 }
      );
    }

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

    // Determine origin for invite link
    let origin = req.headers.get('origin');
    if (!origin) {
      const referer = req.headers.get('referer');
      if (referer) {
        try {
          origin = new URL(referer).origin;
        } catch {
          origin = referer;
        }
      }
    }
    if (!origin) {
      origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    }

    const inviteLink = buildInviteLink({ origin, inviteId, email: cleanEmail });
    const mailtoUrl = buildInviteMailto({
      email: cleanEmail,
      name: cleanName,
      role: userRole,
      cohort: cleanCohort,
      inviteLink,
    });
    const emailDelivery = await sendInviteEmail({
      email: cleanEmail,
      name: cleanName,
      role: userRole,
      cohort: cleanCohort,
      inviteLink,
    });

    return NextResponse.json({
      success: true,
      user: createdUser,
      inviteLink,
      mailtoUrl,
      emailDelivery,
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
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) return auth.response;
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

    const supabase = getServiceClient();

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
  const auth = await requireRole(req, ['admin']);
  if (!auth.ok) return auth.response;
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

    const supabase = getServiceClient();

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

import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Polyfill WebSocket in Node runtime if absent
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

export type AppRole = 'student' | 'teacher' | 'admin';

export interface Caller {
  id: string;
  email: string | null;
  role: AppRole;
}

export class ServerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerConfigError';
  }
}

const FALLBACK_SUPABASE_URL = 'https://dmvahcaxixvhgxidmkqs.supabase.co';
// Public anon key (safe to ship; RLS is the guard). Kept ONLY in this file.
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdmFoY2F4aXh2aGd4aWRta3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTc4NzQsImV4cCI6MjEwNzAzMzg3NH0.qeqa5hQ84xnIOljKmu7SUhcko53qM1gO_dCmYvjnf-4';

let warnedAnonFallback = false;

function getSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
}

function getAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;
}

export function parseBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token || null;
}

export function isDevBypassEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.REVIZZ_DEV_AUTH_BYPASS === '1';
}

export function getServiceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient(getSupabaseUrl(), serviceKey);
  }
  if (process.env.NODE_ENV === 'production') {
    throw new ServerConfigError('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  if (!warnedAnonFallback) {
    warnedAnonFallback = true;
    console.warn('[apiAuth] SUPABASE_SERVICE_ROLE_KEY is not set; falling back to the anon key (dev only).');
  }
  return createClient(getSupabaseUrl(), getAnonKey());
}

/** Identity only: one auth round trip, no profiles.role lookup. Never throws. */
export async function getCallerUserId(req: Request): Promise<string | null> {
  try {
    if (isDevBypassEnabled()) return 'dev-bypass';
    const token = parseBearerToken(req.headers.get('authorization'));
    if (!token) return null;
    const anon = createClient(getSupabaseUrl(), getAnonKey());
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

export async function getCaller(req: Request): Promise<Caller | null> {
  try {
    if (isDevBypassEnabled()) {
      return { id: 'dev-bypass', email: null, role: 'admin' };
    }
    const token = parseBearerToken(req.headers.get('authorization'));
    if (!token) return null;

    const anon = createClient(getSupabaseUrl(), getAnonKey());
    const { data, error } = await anon.auth.getUser(token);
    if (error || !data?.user) return null;
    const user = data.user;

    const asUser = createClient(getSupabaseUrl(), getAnonKey(), {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: profile, error: profileError } = await asUser
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) return null;

    const rawRole = (profile as { role?: string } | null)?.role;
    const role: AppRole = rawRole === 'admin' || rawRole === 'teacher' ? rawRole : 'student';
    return { id: user.id, email: user.email ?? null, role };
  } catch {
    return null;
  }
}

export async function requireRole(
  req: Request,
  roles: AppRole[]
): Promise<{ ok: true; caller: Caller } | { ok: false; response: NextResponse }> {
  const caller = await getCaller(req);
  if (!caller) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Sign in required' }, { status: 401 }) };
  }
  if (!roles.includes(caller.role)) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Not allowed' }, { status: 403 }) };
  }
  return { ok: true, caller };
}

export function serverErrorResponse(err: unknown): NextResponse {
  if (err instanceof ServerConfigError) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
  return NextResponse.json(
    { success: false, error: (err as any)?.message || 'Internal server error' },
    { status: 500 }
  );
}

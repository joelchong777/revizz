import { supabase } from './supabaseClient';

/**
 * fetch wrapper for the locked-down /api/admin, /api/ingest and /api/questions routes.
 * Attaches the signed-in user's Supabase access token as `Authorization: Bearer <token>`.
 * Existing headers are kept. A session error never throws; the request is sent without the header.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
  } catch {
    // Send without the header.
  }
  return fetch(input, { ...init, headers });
}

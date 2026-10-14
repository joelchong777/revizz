// Polyfill WebSocket in Node runtime if absent
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class MockWebSocket {};
}

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dmvahcaxixvhgxidmkqs.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtdmFoY2F4aXh2aGd4aWRta3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTc4NzQsImV4cCI6MjEwNzAzMzg3NH0.qeqa5hQ84xnIOljKmu7SUhcko53qM1gO_dCmYvjnf-4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);


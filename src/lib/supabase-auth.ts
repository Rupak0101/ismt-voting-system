import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseAuthClient: SupabaseClient | null = null;

export function getSupabaseAuthClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_AUTH_ENV_MISSING');
  }

  if (!supabaseAuthClient) {
    supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAuthClient;
}

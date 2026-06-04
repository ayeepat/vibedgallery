import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Check your .env.local file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'vibedgallery_access_token',
    detectSessionInUrl: true,
    // PKCE keeps OAuth callback URLs short (?code=abc) and is more secure
    // than the legacy implicit flow (which returns the full JWT in the URL
    // hash and trips Safari on long URLs).
    flowType: 'pkce',
  }
})
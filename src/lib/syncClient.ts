import type { SupabaseClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Sync only exists when the app was built with a Supabase project's URL and public key. */
export const syncAvailable = Boolean(URL && KEY)

let client: Promise<SupabaseClient> | null = null

/** The Supabase client, loaded on first use so people without sync never download it. */
export function getClient(): Promise<SupabaseClient> {
  client ??= import('@supabase/supabase-js').then((m) =>
    m.createClient(URL!, KEY!, { auth: { persistSession: true, autoRefreshToken: true } }),
  )
  return client
}

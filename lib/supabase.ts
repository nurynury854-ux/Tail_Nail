import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey)

// Next 14 caches server-side fetch() by default, and supabase-js is built on
// fetch — so a route's query can be answered from the Data Cache and keep
// returning the list as it was minutes or days ago (a booking that exists in
// the database but never shows up on the calendar). Never cache DB reads.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl!, supabaseAnonKey!, { global: { fetch: noStoreFetch } })
  : null

// Server-side admin client (for API routes)
export const createAdminClient = () => {
  if (!supabaseUrl || !serviceRoleKey) return null

  return createClient(supabaseUrl, serviceRoleKey, {
    global: { fetch: noStoreFetch },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

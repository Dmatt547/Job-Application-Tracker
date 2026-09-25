import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const env = import.meta.env

const url = env.VITE_SUPABASE_URL?.trim()

// Supabase is retiring the JWT-style `anon` key in favour of `sb_publishable_…`
// by the end of 2026. Both work today, so accept either and prefer the new one.
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || env.VITE_SUPABASE_ANON_KEY?.trim()

/** Null when the env vars are absent, which puts the app in local-only mode. */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: false } }) : null

export const isCloud = supabase !== null

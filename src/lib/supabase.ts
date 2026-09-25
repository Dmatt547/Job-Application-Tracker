import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// These must be direct `import.meta.env.X` member reads. Vite replaces them
// with literals at build time, which lets Rollup prove the branch below is
// dead and drop the Supabase client entirely in local-only builds. Aliasing
// import.meta.env to a variable first defeats that and costs ~230 kB.
const url = import.meta.env.VITE_SUPABASE_URL?.trim()

// Supabase retires the JWT-style `anon` key in favour of `sb_publishable_…` at
// the end of 2026. Both work today, so prefer the new name and fall back.
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/** Null when the env vars are absent, which puts the app in local-only mode. */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: false } }) : null

export const isCloud = supabase !== null

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  /** Current key format: sb_publishable_… */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Legacy JWT key, retired by Supabase at the end of 2026. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

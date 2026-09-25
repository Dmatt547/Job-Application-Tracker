import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isCloud } from './supabase'

export interface Auth {
  /** Null when signed out, or when running in local-only mode. */
  session: Session | null
  userId: string | null
  email: string | null
  /** True until the initial session lookup finishes. */
  loading: boolean
  /** True when a sign-in is required before data can load. */
  required: boolean
  sendMagicLink: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

/**
 * Session state for the Supabase backend.
 *
 * In local-only mode there is no account and nothing to sign in to, so this
 * reports `required: false` and the app runs open. Auth only gates the cloud
 * path, where row level security makes a session genuinely necessary.
 */
export function useAuth(): Auth {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isCloud)

  useEffect(() => {
    const sb = supabase
    if (!sb) {
      setLoading(false)
      return
    }

    let active = true

    // Existing session from a previous visit, if the token is still valid.
    sb.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setLoading(false)
    })

    // Fires on sign-in, sign-out, token refresh, and when the magic link
    // lands back on the page with the session in the URL fragment.
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      if (!active) return
      setSession(next)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const sendMagicLink = useCallback(async (email: string) => {
    const sb = supabase
    if (!sb) return { error: 'Supabase is not configured.' }
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    const sb = supabase
    if (!sb) return
    await sb.auth.signOut()
    // Drop the cached mirror too. Leaving it behind would show the previous
    // account's jobs to whoever signs in next on this machine.
    try {
      localStorage.removeItem('job-tracker:jobs:v1')
    } catch {
      /* private mode */
    }
  }, [])

  return {
    session,
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
    loading,
    required: isCloud && !loading && session === null,
    sendMagicLink,
    signOut,
  }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase, isCloud } from './supabase'
import type { Job, JobDraft } from '../types'

const LOCAL_KEY = 'job-tracker:jobs:v1'
const TABLE = 'jobs'

/* ------------------------------------------------------------------ *
 * Local storage adapter
 * ------------------------------------------------------------------ */

function readLocal(): Job[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as Job[]) : []
  } catch {
    return []
  }
}

function writeLocal(jobs: Job[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(jobs))
  } catch (e) {
    console.warn('Could not persist to localStorage', e)
  }
}

function newId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

/* ------------------------------------------------------------------ *
 * Store
 *
 * One hook owning every read and write. Supabase when it is configured and
 * signed in, localStorage when it is not, with the same surface either way
 * so no component needs to know which is live.
 *
 * Row level security scopes every cloud query to the signed-in account, so
 * the client never filters by user itself — it just has to stamp user_id on
 * insert so the policy's with-check passes.
 * ------------------------------------------------------------------ */

export interface Store {
  jobs: Job[]
  loading: boolean
  error: string | null
  cloud: boolean
  addJob: (draft: JobDraft) => Promise<void>
  updateJob: (id: string, patch: Partial<JobDraft>) => Promise<void>
  deleteJob: (id: string) => Promise<void>
  importJobs: (drafts: JobDraft[], mode: 'replace' | 'merge') => Promise<void>
}

/**
 * @param userId The signed-in account, or null in local-only mode. Cloud reads
 *   and writes are held back until this is known, so a query never fires
 *   before the session is restored and comes back empty.
 */
export function useStore(userId: string | null): Store {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Keeps the latest list available to optimistic writes without re-binding callbacks.
  const jobsRef = useRef<Job[]>([])
  jobsRef.current = jobs

  // Cloud is only usable once configured AND signed in.
  const useCloud = isCloud && userId !== null

  const sortJobs = (list: Job[]) =>
    [...list].sort((a, b) => (b.date_found ?? '').localeCompare(a.date_found ?? ''))

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (!useCloud || !supabase) {
      // In local-only mode this is the real store. When cloud is configured
      // but signed out, the app shows the sign-in screen instead, so this
      // branch just leaves an empty list behind.
      setJobs(isCloud ? [] : sortJobs(readLocal()))
      setLoading(false)
      return
    }

    const { data, error } = await supabase.from(TABLE).select('*')
    if (error) {
      setError(`Could not load from Supabase: ${error.message}`)
      setJobs(sortJobs(readLocal()))
    } else {
      const rows = (data ?? []) as Job[]
      setJobs(sortJobs(rows))
      // Mirror for offline use — but never let an empty cloud table clobber a
      // populated local cache. That happens the first time you point an app
      // full of localStorage data at a fresh database, and it silently eats
      // everything. The cloud is still the source of truth for what renders;
      // this only keeps the fallback copy from being destroyed.
      if (rows.length > 0 || readLocal().length === 0) writeLocal(rows)
    }
    setLoading(false)
  }, [useCloud])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Live updates from other devices, or from a scheduled task writing rows in.
  useEffect(() => {
    const sb = supabase
    if (!sb || !useCloud) return
    const channel = sb
      .channel('jobs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => {
        void refresh()
      })
      .subscribe()
    return () => {
      void sb.removeChannel(channel)
    }
  }, [refresh, useCloud])

  const persistLocal = (next: Job[]) => {
    const sorted = sortJobs(next)
    setJobs(sorted)
    // Only mirror locally when local IS the store. In cloud mode the mirror is
    // refreshed from the server, so writing optimistic rows here would leave
    // stale copies behind if the server rejected them.
    if (!isCloud) writeLocal(sorted)
  }

  const addJob = useCallback(
    async (draft: JobDraft) => {
      const now = new Date().toISOString()
      const row: Job = { ...draft, id: newId(), created_at: now, updated_at: now }
      persistLocal([...jobsRef.current, row])
      if (useCloud && supabase) {
        // user_id must be set for the insert policy's with-check to pass.
        const { error } = await supabase.from(TABLE).insert({ ...row, user_id: userId })
        if (error) setError(`Save failed: ${error.message}`)
      }
    },
    [useCloud, userId],
  )

  const updateJob = useCallback(
    async (id: string, patch: Partial<JobDraft>) => {
      const now = new Date().toISOString()
      persistLocal(
        jobsRef.current.map((j) => (j.id === id ? { ...j, ...patch, updated_at: now } : j)),
      )
      if (useCloud && supabase) {
        const { error } = await supabase
          .from(TABLE)
          .update({ ...patch, updated_at: now })
          .eq('id', id)
        if (error) setError(`Save failed: ${error.message}`)
      }
    },
    [useCloud],
  )

  const deleteJob = useCallback(
    async (id: string) => {
      persistLocal(jobsRef.current.filter((j) => j.id !== id))
      if (useCloud && supabase) {
        const { error } = await supabase.from(TABLE).delete().eq('id', id)
        if (error) setError(`Delete failed: ${error.message}`)
      }
    },
    [useCloud],
  )

  const importJobs = useCallback(
    async (drafts: JobDraft[], mode: 'replace' | 'merge') => {
      const now = new Date().toISOString()
      const rows: Job[] = drafts.map((d) => ({
        ...d,
        id: newId(),
        created_at: now,
        updated_at: now,
      }))

      if (mode === 'merge') {
        // Skip anything that already matches on company + role, so re-importing
        // the spreadsheet does not duplicate the pipeline.
        const seen = new Set(
          jobsRef.current.map((j) => `${j.company.toLowerCase()}|${j.role.toLowerCase()}`),
        )
        const fresh = rows.filter(
          (r) => !seen.has(`${r.company.toLowerCase()}|${r.role.toLowerCase()}`),
        )
        persistLocal([...jobsRef.current, ...fresh])
        if (useCloud && supabase && fresh.length) {
          const { error } = await supabase
            .from(TABLE)
            .insert(fresh.map((r) => ({ ...r, user_id: userId })))
          if (error) setError(`Import failed: ${error.message}`)
          else await refresh()
        }
        return
      }

      persistLocal(rows)
      if (useCloud && supabase) {
        // RLS scopes this delete to the signed-in account, so it cannot reach
        // anyone else's rows even though there is no explicit user filter.
        await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        const { error } = await supabase
          .from(TABLE)
          .insert(rows.map((r) => ({ ...r, user_id: userId })))
        if (error) setError(`Import failed: ${error.message}`)
        else await refresh()
      }
    },
    [useCloud, userId, refresh],
  )

  return {
    jobs,
    loading,
    error,
    cloud: useCloud,
    addJob,
    updateJob,
    deleteJob,
    importJobs,
  }
}

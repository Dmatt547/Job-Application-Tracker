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
 * One hook owning every read and write. Supabase when it is configured,
 * localStorage when it is not, with the same surface either way so no
 * component needs to know which is live.
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
  refresh: () => Promise<void>
}

export function useStore(): Store {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Keeps the latest list available to optimistic writes without re-binding callbacks.
  const jobsRef = useRef<Job[]>([])
  jobsRef.current = jobs

  const sortJobs = (list: Job[]) =>
    [...list].sort((a, b) => (b.date_found ?? '').localeCompare(a.date_found ?? ''))

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    if (!isCloud || !supabase) {
      setJobs(sortJobs(readLocal()))
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
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Live updates from other devices, or from a scheduled task writing rows in.
  useEffect(() => {
    const sb = supabase
    if (!sb) return
    const channel = sb
      .channel('jobs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, () => {
        void refresh()
      })
      .subscribe()
    return () => {
      void sb.removeChannel(channel)
    }
  }, [refresh])

  const persistLocal = (next: Job[]) => {
    const sorted = sortJobs(next)
    setJobs(sorted)
    writeLocal(sorted)
  }

  const addJob = useCallback(async (draft: JobDraft) => {
    const now = new Date().toISOString()
    const row: Job = { ...draft, id: newId(), created_at: now, updated_at: now }
    persistLocal([...jobsRef.current, row])
    if (isCloud && supabase) {
      const { error } = await supabase.from(TABLE).insert(row)
      if (error) setError(`Save failed: ${error.message}`)
    }
  }, [])

  const updateJob = useCallback(async (id: string, patch: Partial<JobDraft>) => {
    const now = new Date().toISOString()
    persistLocal(
      jobsRef.current.map((j) => (j.id === id ? { ...j, ...patch, updated_at: now } : j)),
    )
    if (isCloud && supabase) {
      const { error } = await supabase
        .from(TABLE)
        .update({ ...patch, updated_at: now })
        .eq('id', id)
      if (error) setError(`Save failed: ${error.message}`)
    }
  }, [])

  const deleteJob = useCallback(async (id: string) => {
    persistLocal(jobsRef.current.filter((j) => j.id !== id))
    if (isCloud && supabase) {
      const { error } = await supabase.from(TABLE).delete().eq('id', id)
      if (error) setError(`Delete failed: ${error.message}`)
    }
  }, [])

  const importJobs = useCallback(async (drafts: JobDraft[], mode: 'replace' | 'merge') => {
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
      if (isCloud && supabase && fresh.length) {
        const { error } = await supabase.from(TABLE).insert(fresh)
        if (error) setError(`Import failed: ${error.message}`)
      }
      return
    }

    persistLocal(rows)
    if (isCloud && supabase) {
      await supabase.from(TABLE).delete().neq('id', '00000000-0000-0000-0000-000000000000')
      const { error } = await supabase.from(TABLE).insert(rows)
      if (error) setError(`Import failed: ${error.message}`)
    }
  }, [])

  return { jobs, loading, error, cloud: isCloud, addJob, updateJob, deleteJob, importJobs, refresh }
}

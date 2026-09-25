import { useEffect, useState } from 'react'
import type { Job, JobDraft, Status } from '../types'
import { STATUSES, SOURCES, PRIORITIES, emptyDraft } from '../types'
import { todayISO } from '../lib/format'
import { Button, Field, fieldClass } from './ui'

export function JobModal({
  job,
  onClose,
  onSave,
  onDelete,
}: {
  /** An existing job to edit, or null for a new one. */
  job: Job | null
  onClose: () => void
  onSave: (draft: JobDraft, id: string | null) => void
  onDelete: (id: string) => void
}) {
  const today = todayISO()
  const [draft, setDraft] = useState<JobDraft>(() =>
    job ? { ...(job as unknown as JobDraft) } : emptyDraft(today),
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const set = <K extends keyof JobDraft>(key: K, value: JobDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.company.trim()) return
    const out: JobDraft = { ...draft, last_update: today }
    // Stamp the applied date the moment it leaves "Not applied".
    if (out.status !== 'Not applied' && !out.date_applied) out.date_applied = today
    onSave(out, job?.id ?? null)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-label={job ? `Edit ${job.company}` : 'Add a job'}
    >
      <form
        onSubmit={submit}
        className="my-auto w-full max-w-2xl rounded-xl border bg-[var(--surface)]"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <header className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
          <h2 className="text-base font-semibold">{job ? 'Edit role' : 'Add a role'}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            ✕
          </Button>
        </header>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company *">
              <input
                className={fieldClass}
                value={draft.company}
                onChange={(e) => set('company', e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label="Role">
              <input
                className={fieldClass}
                value={draft.role}
                onChange={(e) => set('role', e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Location">
              <input
                className={fieldClass}
                value={draft.location}
                onChange={(e) => set('location', e.target.value)}
                placeholder="Melbourne VIC (Hybrid)"
              />
            </Field>
            <Field label="Link to the ad" hint="Goes straight to the application page.">
              <input
                type="url"
                className={fieldClass}
                value={draft.link}
                onChange={(e) => set('link', e.target.value)}
                placeholder="https://"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Status">
              <select
                className={fieldClass}
                value={draft.status}
                onChange={(e) => set('status', e.target.value as Status)}
              >
                {STATUSES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                className={fieldClass}
                value={draft.priority}
                onChange={(e) => set('priority', e.target.value as JobDraft['priority'])}
              >
                {PRIORITIES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Source">
              <select
                className={fieldClass}
                value={draft.source}
                onChange={(e) => set('source', e.target.value as JobDraft['source'])}
              >
                {SOURCES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Date found">
              <input
                type="date"
                className={fieldClass}
                value={draft.date_found ?? ''}
                onChange={(e) => set('date_found', e.target.value || null)}
              />
            </Field>
            <Field label="Date applied">
              <input
                type="date"
                className={fieldClass}
                value={draft.date_applied ?? ''}
                onChange={(e) => set('date_applied', e.target.value || null)}
              />
            </Field>
            <Field label="Closing date">
              <input
                type="date"
                className={fieldClass}
                value={draft.deadline ?? ''}
                onChange={(e) => set('deadline', e.target.value || null)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_11rem]">
            <Field label="Next action" hint="What you have to do next, in your own words.">
              <input
                className={fieldClass}
                value={draft.next_action}
                onChange={(e) => set('next_action', e.target.value)}
                placeholder="Follow up with the recruiter"
              />
            </Field>
            <Field label="Action due" hint="Drives the Today list.">
              <input
                type="date"
                className={fieldClass}
                value={draft.next_action_due ?? ''}
                onChange={(e) => set('next_action_due', e.target.value || null)}
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              className={`${fieldClass} min-h-28 resize-y`}
              value={draft.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Stack, package, eligibility, who you spoke to…"
            />
          </Field>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t px-5 py-3">
          <div>
            {job &&
              (confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)]">Delete for good?</span>
                  <Button type="button" variant="danger" size="sm" onClick={() => onDelete(job.id)}>
                    Yes, delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </Button>
              ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {job ? 'Save changes' : 'Add role'}
            </Button>
          </div>
        </footer>
      </form>
    </div>
  )
}

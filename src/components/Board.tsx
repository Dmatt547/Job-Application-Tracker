import { useState } from 'react'
import type { Job, Status } from '../types'
import { BOARD_COLUMNS } from '../types'
import { fmtDate, daysUntil, initials, hueFor, todayISO } from '../lib/format'
import { STATUS_STYLE, PriorityDot } from './ui'

function JobCard({
  job,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging,
}: {
  job: Job
  onOpen: (j: Job) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  dragging: boolean
}) {
  const hue = hueFor(job.company)
  const dl = daysUntil(job.deadline)
  const deadlineSoon = dl !== null && dl >= 0 && dl <= 7
  const deadlinePassed = dl !== null && dl < 0 && job.status === 'Not applied'

  return (
    <article
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', job.id)
        onDragStart(job.id)
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(job)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(job)
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`${job.company} — ${job.role}`}
      className={`cursor-grab rounded-lg border bg-[var(--surface)] p-3 text-left active:cursor-grabbing ${
        dragging ? 'dragging' : ''
      }`}
      style={{ boxShadow: 'var(--shadow-sm)' }}
    >
      <div className="flex items-start gap-2">
        <div
          className="grid size-7 shrink-0 place-items-center rounded-md text-[10px] font-semibold"
          style={{ background: `oklch(0.92 0.05 ${hue})`, color: `oklch(0.35 0.11 ${hue})` }}
          aria-hidden="true"
        >
          {initials(job.company)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <h3 className="truncate text-sm font-medium text-[var(--text-primary)]">
              {job.company}
            </h3>
            <PriorityDot priority={job.priority} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">{job.role}</p>
        </div>
      </div>

      {job.location && (
        <p className="mt-2 truncate text-[11px] text-[var(--text-muted)]">{job.location}</p>
      )}

      {(deadlineSoon || deadlinePassed || job.next_action) && (
        <div className="mt-2 space-y-1">
          {deadlineSoon && (
            <div
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
              style={{
                color: 'var(--critical)',
                background: 'color-mix(in oklab, var(--critical) 12%, transparent)',
              }}
            >
              <span aria-hidden="true">⏱</span> Closes {fmtDate(job.deadline)}
            </div>
          )}
          {deadlinePassed && (
            <div className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
              <span aria-hidden="true">⊘</span> Closed {fmtDate(job.deadline)}
            </div>
          )}
          {job.next_action && (
            <p className="line-clamp-2 text-[11px] text-[var(--text-secondary)]">
              <span aria-hidden="true">→ </span>
              {job.next_action}
            </p>
          )}
        </div>
      )}
    </article>
  )
}

export function Board({
  jobs,
  onOpen,
  onUpdate,
}: {
  jobs: Job[]
  onOpen: (j: Job) => void
  onUpdate: (id: string, patch: Partial<Job>) => void
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<Status | null>(null)

  const drop = (status: Status) => {
    if (!draggingId) return
    const job = jobs.find((j) => j.id === draggingId)
    setDraggingId(null)
    setOverCol(null)
    if (!job || job.status === status) return

    const today = todayISO()
    const patch: Partial<Job> = { status, last_update: today }
    // Moving into Applied for the first time should stamp the date.
    if (status === 'Applied' && !job.date_applied) patch.date_applied = today
    onUpdate(job.id, patch)
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 thin-scroll">
      {BOARD_COLUMNS.map((status) => {
        const col = jobs.filter((j) => j.status === status)
        const s = STATUS_STYLE[status]
        return (
          <section
            key={status}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setOverCol(status)
            }}
            onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
            onDrop={(e) => {
              e.preventDefault()
              drop(status)
            }}
            className={`flex max-h-[calc(100vh-15rem)] w-[17rem] shrink-0 flex-col rounded-xl border bg-[var(--surface-2)] ${
              overCol === status ? 'drag-over' : ''
            }`}
          >
            <header className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <span aria-hidden="true" style={{ color: s.color }}>
                  {s.glyph}
                </span>
                <span className="text-[var(--text-primary)]">{status}</span>
              </div>
              <span className="tabular rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                {col.length}
              </span>
            </header>

            <div className="thin-scroll flex-1 space-y-2 overflow-y-auto p-2">
              {col.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-[var(--text-muted)]">
                  Drag a card here
                </p>
              ) : (
                col.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onOpen={onOpen}
                    dragging={draggingId === job.id}
                    onDragStart={setDraggingId}
                    onDragEnd={() => {
                      setDraggingId(null)
                      setOverCol(null)
                    }}
                  />
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

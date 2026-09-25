import type { Job } from '../types'
import type { ActionItem } from '../lib/derive'
import { buildActionQueue } from '../lib/derive'
import { fmtDate, relativeDate, initials, hueFor, todayISO } from '../lib/format'
import { Card, Button, StatusBadge, EmptyState, StatTile } from './ui'

/** Colour and glyph per action kind. Never colour alone. */
const KIND_STYLE: Record<ActionItem['kind'], { color: string; glyph: string }> = {
  'deadline-passed': { color: 'var(--text-muted)', glyph: '⊘' },
  'deadline-soon': { color: 'var(--critical)', glyph: '⏱' },
  'next-action-due': { color: 'var(--critical)', glyph: '!' },
  interview: { color: 'var(--good)', glyph: '★' },
  'awaiting-reply': { color: 'var(--serious)', glyph: '↩' },
  'high-priority-unapplied': { color: 'var(--warning)', glyph: '▲' },
}

function ActionRow({
  item,
  onOpen,
  onApplied,
  onDone,
}: {
  item: ActionItem
  onOpen: (j: Job) => void
  onApplied: (j: Job) => void
  onDone: (j: Job) => void
}) {
  const { job, kind, label, detail } = item
  const style = KIND_STYLE[kind]
  const hue = hueFor(job.company)

  return (
    <li className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
      <div
        className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg text-xs font-semibold"
        style={{
          background: `oklch(0.92 0.05 ${hue})`,
          color: `oklch(0.35 0.11 ${hue})`,
        }}
        aria-hidden="true"
      >
        {initials(job.company)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
            style={{
              color: style.color,
              background: `color-mix(in oklab, ${style.color} 12%, transparent)`,
            }}
          >
            <span aria-hidden="true">{style.glyph}</span>
            {label}
          </span>
          <span className="truncate font-medium text-[var(--text-primary)]">{job.company}</span>
          <span className="truncate text-sm text-[var(--text-secondary)]">{job.role}</span>
        </div>

        <p className="mt-1 text-sm text-[var(--text-secondary)]">{detail}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--text-muted)]">
          <StatusBadge status={job.status} size="xs" />
          {job.location && <span>{job.location}</span>}
          {job.deadline && <span className="tabular">Closes {fmtDate(job.deadline)}</span>}
          {job.next_action_due && (
            <span className="tabular">Action {relativeDate(job.next_action_due)}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {job.link && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => window.open(job.link, '_blank', 'noopener,noreferrer')}
          >
            Open ↗
          </Button>
        )}
        {job.status === 'Not applied' ? (
          <Button size="sm" onClick={() => onApplied(job)}>
            Mark applied
          </Button>
        ) : (
          item.kind === 'next-action-due' && (
            <Button size="sm" onClick={() => onDone(job)}>
              Done
            </Button>
          )
        )}
        <Button size="sm" variant="ghost" onClick={() => onOpen(job)} aria-label={`Edit ${job.company}`}>
          Edit
        </Button>
      </div>
    </li>
  )
}

export function Today({
  jobs,
  onOpen,
  onUpdate,
}: {
  jobs: Job[]
  onOpen: (j: Job) => void
  onUpdate: (id: string, patch: Partial<Job>) => void
}) {
  const queue = buildActionQueue(jobs)
  const today = todayISO()

  const urgent = queue.filter((q) => q.urgency < 0)
  const rest = queue.filter((q) => q.urgency >= 0)

  const markApplied = (j: Job) =>
    onUpdate(j.id, { status: 'Applied', date_applied: today, last_update: today })

  const clearAction = (j: Job) =>
    onUpdate(j.id, { next_action: '', next_action_due: null, last_update: today })

  const interviews = jobs.filter((j) => j.status === 'Interview').length
  const liveApps = jobs.filter((j) =>
    ['Applied', 'Pending', 'Heard back', 'Interview', 'Offer'].includes(j.status),
  ).length
  const toApply = jobs.filter((j) => j.status === 'Not applied').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Needs you now"
          value={urgent.length}
          sub={urgent.length ? 'Overdue or closing soon' : 'Nothing overdue'}
          tone={urgent.length ? 'critical' : 'good'}
        />
        <StatTile label="Interviews live" value={interviews} sub="Booked or in progress" />
        <StatTile label="Applications out" value={liveApps} sub="Awaiting an outcome" />
        <StatTile label="Still to apply" value={toApply} sub="In the backlog" />
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          Do these first
          {urgent.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{
                color: 'var(--critical)',
                background: 'color-mix(in oklab, var(--critical) 12%, transparent)',
              }}
            >
              {urgent.length}
            </span>
          )}
        </h2>
        {urgent.length === 0 ? (
          <EmptyState
            icon="✓"
            title="Nothing urgent today"
            hint="No overdue follow-ups, no deadlines inside a week, no interviews waiting on you."
          />
        ) : (
          <Card className="overflow-hidden">
            <ul>
              {urgent.map((item) => (
                <ActionRow
                  key={item.job.id}
                  item={item}
                  onOpen={onOpen}
                  onApplied={markApplied}
                  onDone={clearAction}
                />
              ))}
            </ul>
          </Card>
        )}
      </section>

      {rest.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-[var(--text-primary)]">
            Worth a look ({rest.length})
          </h2>
          <Card className="overflow-hidden">
            <ul>
              {rest.slice(0, 25).map((item) => (
                <ActionRow
                  key={item.job.id}
                  item={item}
                  onOpen={onOpen}
                  onApplied={markApplied}
                  onDone={clearAction}
                />
              ))}
            </ul>
          </Card>
          {rest.length > 25 && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              {rest.length - 25} more in the list view.
            </p>
          )}
        </section>
      )}
    </div>
  )
}

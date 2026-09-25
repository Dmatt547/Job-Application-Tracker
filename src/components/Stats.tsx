import { useState } from 'react'
import type { Job } from '../types'
import { buildStats } from '../lib/derive'
import { Card, StatTile, EmptyState } from './ui'

/* Ordinal ramp for the funnel: one hue, monotone lightness, validated
 * light-end contrast in both modes. Stage colour encodes depth, not identity. */
const FUNNEL_STEPS = ['var(--stage-1)', 'var(--stage-2)', 'var(--stage-3)', 'var(--stage-4)', 'var(--stage-5)']

function Funnel({ jobs }: { jobs: Job[] }) {
  const stages = [
    { label: 'Found', test: () => true },
    { label: 'Applied', test: (j: Job) => j.status !== 'Not applied' },
    {
      label: 'Heard back',
      test: (j: Job) => ['Heard back', 'Interview', 'Offer'].includes(j.status),
    },
    { label: 'Interview', test: (j: Job) => ['Interview', 'Offer'].includes(j.status) },
    { label: 'Offer', test: (j: Job) => j.status === 'Offer' },
  ]

  const counts = stages.map((s) => jobs.filter(s.test).length)
  const max = counts[0] || 1

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">Pipeline funnel</h3>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        How far applications get. Percentages are of everything found.
      </p>

      <div className="mt-4 space-y-2">
        {stages.map((s, i) => {
          const n = counts[i]
          const pct = max ? (n / max) * 100 : 0
          // Conversion from the previous stage is the number that actually matters.
          const prev = i > 0 ? counts[i - 1] : null
          const step = prev ? (prev ? Math.round((n / prev) * 100) : 0) : null
          return (
            <div key={s.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="font-medium text-[var(--text-primary)]">{s.label}</span>
                <span className="tabular text-[var(--text-secondary)]">
                  {n}
                  {step !== null && (
                    <span className="ml-1.5 text-[var(--text-muted)]">({step}% of previous)</span>
                  )}
                </span>
              </div>
              <div
                className="h-5 w-full overflow-hidden rounded-r-[4px] bg-[var(--surface-2)]"
                role="img"
                aria-label={`${s.label}: ${n} of ${max}`}
              >
                <div
                  className="h-full rounded-r-[4px] transition-[width] duration-500"
                  style={{
                    width: `${Math.max(pct, n > 0 ? 1.5 : 0)}%`,
                    background: FUNNEL_STEPS[i],
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function WeeklyBars({ weekly }: { weekly: { weekStart: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...weekly.map((w) => w.count))
  const total = weekly.reduce((a, w) => a + w.count, 0)

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">Applications per week</h3>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">
        Last 12 weeks — {total} application{total === 1 ? '' : 's'} sent.
      </p>

      <div className="relative mt-4">
        <div className="flex h-32 items-end gap-1.5">
          {weekly.map((w, i) => {
            const h = (w.count / max) * 100
            const isLast = i === weekly.length - 1
            return (
              <div
                key={w.weekStart}
                className="group relative flex h-full flex-1 flex-col justify-end"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className="w-full rounded-t-[4px] transition-all"
                  style={{
                    height: `${Math.max(h, w.count > 0 ? 4 : 1.5)}%`,
                    background: w.count > 0 ? 'var(--series-1)' : 'var(--grid)',
                    opacity: hover === null || hover === i ? 1 : 0.55,
                  }}
                />
                {/* Direct-label only the latest bar; never a number on every bar */}
                {isLast && w.count > 0 && (
                  <span className="tabular absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-[var(--text-secondary)]">
                    {w.count}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        <div className="mt-1.5 flex justify-between text-[10px] text-[var(--text-muted)]">
          <span>12 weeks ago</span>
          <span>This week</span>
        </div>

        {hover !== null && (
          <div
            className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 -translate-y-full rounded-lg border bg-[var(--surface)] px-2.5 py-1.5 text-xs whitespace-nowrap"
            style={{
              left: `${((hover + 0.5) / weekly.length) * 100}%`,
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div className="tabular font-semibold">
              {weekly[hover].count} application{weekly[hover].count === 1 ? '' : 's'}
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">
              week of{' '}
              {new Date(weekly[hover].weekStart + 'T00:00:00').toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

function SourceTable({ bySource }: { bySource: ReturnType<typeof buildStats>['bySource'] }) {
  const max = Math.max(1, ...bySource.map((s) => s.applied))

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Which sources answer back</h3>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            Applications sent against replies received.
          </p>
        </div>
        {/* Two series, so a legend is always present */}
        <div className="flex shrink-0 items-center gap-3 text-[11px] text-[var(--text-secondary)]">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ background: 'var(--series-1)' }}
              aria-hidden="true"
            />
            Applied
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block size-2.5 rounded-sm"
              style={{ background: 'var(--series-2)' }}
              aria-hidden="true"
            />
            Replied
          </span>
        </div>
      </div>

      {bySource.length === 0 ? (
        <p className="py-6 text-center text-xs text-[var(--text-muted)]">
          No applications recorded yet.
        </p>
      ) : (
        <table className="mt-4 w-full text-sm">
          <caption className="sr-only">Applications and replies by source</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Source</th>
              <th scope="col">Applied</th>
              <th scope="col">Replied</th>
              <th scope="col">Reply rate</th>
            </tr>
          </thead>
          <tbody>
            {bySource.map((s) => (
              <tr key={s.source}>
                <th
                  scope="row"
                  className="w-28 py-1.5 pr-3 text-left text-xs font-medium text-[var(--text-secondary)]"
                >
                  {s.source}
                </th>
                <td className="py-1.5">
                  {/* Grouped bars on one shared scale, with a 2px surface gap
                      between them. Never appended end to end: that would read
                      as a total wider than the applications actually sent. */}
                  <div className="flex flex-col gap-[2px]">
                    <div
                      className="h-2.5 rounded-r-[4px]"
                      style={{
                        width: `${Math.max((s.applied / max) * 100, 1)}%`,
                        background: 'var(--series-1)',
                      }}
                    />
                    <div
                      className="h-2.5 rounded-r-[4px]"
                      style={{
                        width: `${Math.max((s.responses / max) * 100, s.responses > 0 ? 1 : 0)}%`,
                        background: 'var(--series-2)',
                        minWidth: s.responses > 0 ? '3px' : 0,
                      }}
                    />
                  </div>
                </td>
                <td className="tabular w-24 py-1.5 pl-3 text-right text-xs whitespace-nowrap text-[var(--text-secondary)]">
                  {s.responses}/{s.applied}
                  <span className="ml-1.5 text-[var(--text-muted)]">
                    {Math.round(s.rate * 100)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}

export function Stats({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return <EmptyState icon="📊" title="No data yet" hint="Add a few roles and the numbers appear here." />
  }

  const s = buildStats(jobs)
  const rate = Math.round(s.responseRate * 100)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total tracked" value={s.total} sub={`${s.live} still live`} />
        <StatTile
          label="Reply rate"
          value={`${rate}%`}
          sub={`${s.responses} of ${s.applied} applications`}
          tone={rate >= 15 ? 'good' : undefined}
        />
        <StatTile label="Sent last 7 days" value={s.appliedLast7} sub="Keep the rhythm up" />
        <StatTile label="Sent last 30 days" value={s.appliedLast30} sub="Rolling month" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Funnel jobs={jobs} />
        <WeeklyBars weekly={s.weekly} />
      </div>

      <SourceTable bySource={s.bySource} />
    </div>
  )
}

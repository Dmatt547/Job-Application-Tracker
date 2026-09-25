import { useMemo, useState } from 'react'
import type { Job, Status, Priority } from '../types'
import { STATUSES, PRIORITIES } from '../types'
import { fmtDate, daysUntil } from '../lib/format'
import { Card, Button, StatusBadge, PriorityDot, EmptyState, inputClass } from './ui'

type SortKey = 'company' | 'role' | 'status' | 'priority' | 'date_found' | 'deadline'

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: 'company', label: 'Company' },
  { key: 'role', label: 'Role' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Pri', className: 'text-center' },
  { key: 'date_found', label: 'Found' },
  { key: 'deadline', label: 'Closes' },
  { key: null, label: '', className: 'text-right' },
]

const STATUS_ORDER: Record<Status, number> = {
  Offer: 0,
  Interview: 1,
  'Heard back': 2,
  Applied: 3,
  Pending: 4,
  'Not applied': 5,
  Rejected: 6,
  Withdrawn: 7,
}
const PRIORITY_ORDER: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }

export function ListView({
  jobs,
  onOpen,
}: {
  jobs: Job[]
  onOpen: (j: Job) => void
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | 'live' | Status>('all')
  const [priority, setPriority] = useState<'all' | Priority>('all')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date_found', dir: -1 })

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    let out = jobs.filter((j) => {
      if (q) {
        const hay = `${j.company} ${j.role} ${j.location} ${j.notes} ${j.next_action}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (status === 'live') {
        if (j.status === 'Rejected' || j.status === 'Withdrawn') return false
      } else if (status !== 'all' && j.status !== status) return false
      if (priority !== 'all' && j.priority !== priority) return false
      return true
    })

    out = [...out].sort((a, b) => {
      const { key, dir } = sort
      let cmp = 0
      if (key === 'status') cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      else if (key === 'priority') cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      else if (key === 'date_found' || key === 'deadline') {
        // Empty dates sort last regardless of direction.
        const av = a[key] ?? ''
        const bv = b[key] ?? ''
        if (!av && !bv) cmp = 0
        else if (!av) return 1
        else if (!bv) return -1
        else cmp = av.localeCompare(bv)
      } else cmp = String(a[key]).localeCompare(String(b[key]))
      return cmp * dir
    })
    return out
  }, [jobs, query, status, priority, sort])

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }))

  return (
    <div className="space-y-3">
      {/* Filters sit in one row above the table */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search company, role, notes…"
          aria-label="Search jobs"
          className={`${inputClass} w-full max-w-xs flex-1`}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          aria-label="Filter by status"
          className={`${inputClass} w-auto`}
        >
          <option value="all">All statuses</option>
          <option value="live">Live only</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          aria-label="Filter by priority"
          className={`${inputClass} w-auto`}
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="tabular ml-auto text-xs text-[var(--text-muted)]">
          {rows.length} of {jobs.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="🔍" title="Nothing matches" hint="Try clearing the filters or the search box." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-[var(--surface-2)]">
                  {COLUMNS.map((c) => (
                    <th
                      key={c.label || 'actions'}
                      scope="col"
                      className={`px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] ${c.className ?? ''}`}
                      aria-sort={
                        c.key && sort.key === c.key
                          ? sort.dir === 1
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      {c.key ? (
                        <button
                          onClick={() => toggleSort(c.key!)}
                          className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]"
                        >
                          {c.label}
                          <span aria-hidden="true" className="text-[10px]">
                            {sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : '⇅'}
                          </span>
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => {
                  const dl = daysUntil(j.deadline)
                  const soon = dl !== null && dl >= 0 && dl <= 7
                  const passed = dl !== null && dl < 0
                  return (
                    <tr
                      key={j.id}
                      className="border-b last:border-b-0 hover:bg-[var(--surface-2)]"
                    >
                      <td className="max-w-[12rem] truncate px-3 py-2 font-medium">{j.company}</td>
                      <td className="max-w-[20rem] truncate px-3 py-2 text-[var(--text-secondary)]">
                        {j.role}
                        {j.location && (
                          <span className="block text-[11px] text-[var(--text-muted)]">
                            {j.location}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={j.status} size="xs" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <PriorityDot priority={j.priority} />
                      </td>
                      <td className="tabular px-3 py-2 text-xs text-[var(--text-muted)]">
                        {fmtDate(j.date_found)}
                      </td>
                      <td
                        className="tabular px-3 py-2 text-xs"
                        style={{
                          color: soon
                            ? 'var(--critical)'
                            : passed
                              ? 'var(--text-muted)'
                              : 'var(--text-secondary)',
                          fontWeight: soon ? 600 : 400,
                        }}
                      >
                        {soon && <span aria-hidden="true">⏱ </span>}
                        {passed && <span aria-hidden="true">⊘ </span>}
                        {fmtDate(j.deadline)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {j.link && (
                          <a
                            href={j.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mr-1 inline-block rounded px-2 py-1 text-xs font-medium text-[var(--accent)] hover:underline"
                          >
                            Open ↗
                          </a>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => onOpen(j)}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

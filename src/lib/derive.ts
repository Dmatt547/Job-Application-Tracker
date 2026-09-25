import type { Job, Status } from '../types'
import { OPEN_STATUSES } from '../types'
import { daysUntil, daysSince } from './format'

/* ------------------------------------------------------------------ *
 * The action queue
 *
 * The whole point of the app: turn 98 rows into the handful of things
 * that actually need doing today.
 * ------------------------------------------------------------------ */

export type ActionKind =
  | 'deadline-passed'
  | 'deadline-soon'
  | 'next-action-due'
  | 'interview'
  | 'awaiting-reply'
  | 'high-priority-unapplied'

export interface ActionItem {
  job: Job
  kind: ActionKind
  /** Lower sorts first. */
  urgency: number
  label: string
  detail: string
}

const SOON_DAYS = 7
/** After this many days with no word, an application is worth a nudge. */
const STALE_DAYS = 21

export function buildActionQueue(jobs: Job[]): ActionItem[] {
  const items: ActionItem[] = []

  for (const job of jobs) {
    const live = OPEN_STATUSES.includes(job.status)
    if (!live) continue

    // A next action with a due date that has arrived.
    const naDue = daysUntil(job.next_action_due)
    if (job.next_action && naDue !== null && naDue <= SOON_DAYS) {
      items.push({
        job,
        kind: 'next-action-due',
        urgency: naDue < 0 ? -1000 + naDue : naDue,
        label: naDue < 0 ? 'Overdue' : naDue === 0 ? 'Due today' : `Due in ${naDue}d`,
        detail: job.next_action,
      })
      continue
    }

    // An interview booked, or a stage that needs a response.
    if (job.status === 'Interview') {
      items.push({
        job,
        kind: 'interview',
        urgency: -500,
        label: 'Interview',
        detail: job.next_action || 'Interview stage — check the date and prepare.',
      })
      continue
    }

    if (job.status === 'Heard back') {
      items.push({
        job,
        kind: 'awaiting-reply',
        urgency: -400,
        label: 'Needs a reply',
        detail: job.next_action || 'They came back to you. Respond or complete the next step.',
      })
      continue
    }

    // A closing date approaching on something not yet applied for.
    const dl = daysUntil(job.deadline)
    if (job.status === 'Not applied' && dl !== null) {
      if (dl < 0) {
        items.push({
          job,
          kind: 'deadline-passed',
          urgency: 900,
          label: 'Closed',
          detail: `Deadline passed ${-dl} days ago. Apply anyway or archive it.`,
        })
      } else if (dl <= SOON_DAYS) {
        items.push({
          job,
          kind: 'deadline-soon',
          urgency: -800 + dl,
          label: dl === 0 ? 'Closes today' : `Closes in ${dl}d`,
          detail: `${job.role} — apply before the listing closes.`,
        })
      }
      continue
    }

    // Applied a while ago and heard nothing.
    if (job.status === 'Applied' || job.status === 'Pending') {
      const since = daysSince(job.date_applied ?? job.last_update)
      if (since !== null && since >= STALE_DAYS) {
        items.push({
          job,
          kind: 'awaiting-reply',
          urgency: 100 - Math.min(since, 90),
          label: `Quiet ${since}d`,
          detail: 'No word since you applied. Worth a follow-up or writing it off.',
        })
      }
      continue
    }

    // High priority, found, still not applied for.
    if (job.status === 'Not applied' && job.priority === 'High') {
      const found = daysSince(job.date_found)
      items.push({
        job,
        kind: 'high-priority-unapplied',
        urgency: 200 - (found ?? 0),
        label: 'High priority',
        detail: found !== null ? `Found ${found} days ago, still not applied.` : 'Still not applied.',
      })
    }
  }

  return items.sort((a, b) => a.urgency - b.urgency)
}

/* ------------------------------------------------------------------ *
 * Stats
 * ------------------------------------------------------------------ */

export interface Stats {
  total: number
  byStatus: Record<Status, number>
  live: number
  applied: number
  responses: number
  responseRate: number
  appliedLast7: number
  appliedLast30: number
  bySource: { source: string; applied: number; responses: number; rate: number }[]
  weekly: { weekStart: string; count: number }[]
}

const RESPONDED: Status[] = ['Heard back', 'Interview', 'Offer']

export function buildStats(jobs: Job[]): Stats {
  const byStatus = {} as Record<Status, number>
  for (const j of jobs) byStatus[j.status] = (byStatus[j.status] ?? 0) + 1

  // "Applied" here means the application actually went in, whatever happened after.
  const appliedJobs = jobs.filter((j) => j.status !== 'Not applied')
  const responded = jobs.filter((j) => RESPONDED.includes(j.status))

  const within = (days: number) =>
    jobs.filter((j) => {
      const s = daysSince(j.date_applied)
      return s !== null && s >= 0 && s <= days
    }).length

  // Source conversion
  const sourceMap = new Map<string, { applied: number; responses: number }>()
  for (const j of appliedJobs) {
    const key = j.source || 'Other'
    const e = sourceMap.get(key) ?? { applied: 0, responses: 0 }
    e.applied++
    if (RESPONDED.includes(j.status)) e.responses++
    sourceMap.set(key, e)
  }
  const bySource = [...sourceMap.entries()]
    .map(([source, v]) => ({
      source,
      applied: v.applied,
      responses: v.responses,
      rate: v.applied ? v.responses / v.applied : 0,
    }))
    .sort((a, b) => b.applied - a.applied)

  // Applications per week over the last 12 weeks
  const weekly: { weekStart: string; count: number }[] = []
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  for (let i = 11; i >= 0; i--) {
    const start = new Date(monday)
    start.setDate(monday.getDate() - i * 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 7)
    const iso = start.toISOString().slice(0, 10)
    const count = jobs.filter((j) => {
      if (!j.date_applied) return false
      const d = new Date(j.date_applied + 'T00:00:00')
      return d >= start && d < end
    }).length
    weekly.push({ weekStart: iso, count })
  }

  return {
    total: jobs.length,
    byStatus,
    live: jobs.filter((j) => OPEN_STATUSES.includes(j.status)).length,
    applied: appliedJobs.length,
    responses: responded.length,
    responseRate: appliedJobs.length ? responded.length / appliedJobs.length : 0,
    appliedLast7: within(7),
    appliedLast30: within(30),
    bySource,
    weekly,
  }
}

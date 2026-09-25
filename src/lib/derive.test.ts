import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildActionQueue, buildStats } from './derive'
import type { Job, Status, Priority, Source } from '../types'

/* A fixed "today" so relative-date logic is deterministic. */
const TODAY = new Date('2026-09-25T09:00:00+10:00')

/* Local-time yyyy-mm-dd, matching how todayISO() formats. Using
 * toISOString() here would format in UTC and shift every fixture by a day. */
const iso = (offsetDays: number) => {
  const d = new Date(TODAY)
  d.setDate(d.getDate() + offsetDays)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

let seq = 0
function job(overrides: Partial<Job> = {}): Job {
  seq += 1
  return {
    id: `job-${seq}`,
    company: `Company ${seq}`,
    role: 'Software Engineer',
    location: 'Melbourne VIC',
    link: '',
    source: 'Seek' as Source,
    priority: 'Medium' as Priority,
    status: 'Not applied' as Status,
    date_found: iso(-30),
    date_applied: null,
    deadline: null,
    last_update: null,
    next_action: '',
    next_action_due: null,
    notes: '',
    created_at: TODAY.toISOString(),
    updated_at: TODAY.toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('buildActionQueue', () => {
  it('ignores jobs that are already closed out', () => {
    const jobs = [
      job({ status: 'Rejected', next_action: 'chase', next_action_due: iso(-5) }),
      job({ status: 'Withdrawn', next_action: 'chase', next_action_due: iso(-5) }),
    ]
    expect(buildActionQueue(jobs)).toHaveLength(0)
  })

  it('emits at most one item per job', () => {
    // This job qualifies on several rules at once: high priority, not applied,
    // a deadline inside the week, and a due next action. It must still surface
    // once, or the queue double-counts and the header badge lies.
    const j = job({
      status: 'Not applied',
      priority: 'High',
      deadline: iso(3),
      next_action: 'Finish the application',
      next_action_due: iso(0),
    })
    expect(buildActionQueue([j])).toHaveLength(1)
  })

  it('ranks an overdue action above one due today, and today above future', () => {
    const overdue = job({ status: 'Applied', next_action: 'a', next_action_due: iso(-3) })
    const today = job({ status: 'Applied', next_action: 'b', next_action_due: iso(0) })
    const soon = job({ status: 'Applied', next_action: 'c', next_action_due: iso(4) })

    const order = buildActionQueue([soon, today, overdue]).map((i) => i.job.id)
    expect(order).toEqual([overdue.id, today.id, soon.id])
  })

  it('labels a passed action Overdue and a future one with the day count', () => {
    const q = buildActionQueue([
      job({ status: 'Applied', next_action: 'a', next_action_due: iso(-2) }),
      job({ status: 'Applied', next_action: 'b', next_action_due: iso(2) }),
    ])
    expect(q[0].label).toBe('Overdue')
    expect(q[1].label).toBe('Due in 2d')
  })

  it('does not surface an action dated beyond the week', () => {
    const q = buildActionQueue([job({ status: 'Applied', next_action: 'a', next_action_due: iso(30) })])
    expect(q).toHaveLength(0)
  })

  it('surfaces an interview even with no next action recorded', () => {
    const q = buildActionQueue([job({ status: 'Interview' })])
    expect(q).toHaveLength(1)
    expect(q[0].kind).toBe('interview')
  })

  it('treats Heard back as needing a reply', () => {
    const q = buildActionQueue([job({ status: 'Heard back' })])
    expect(q[0].kind).toBe('awaiting-reply')
    expect(q[0].label).toBe('Needs a reply')
  })

  describe('deadlines on unapplied roles', () => {
    it('puts one closing inside the week in the urgent bucket', () => {
      const q = buildActionQueue([job({ status: 'Not applied', deadline: iso(3) })])
      expect(q[0].kind).toBe('deadline-soon')
      expect(q[0].label).toBe('Closes in 3d')
      // Negative urgency is what the Today view uses to split "do these first".
      expect(q[0].urgency).toBeLessThan(0)
    })

    it('keeps a passed deadline visible but out of the urgent bucket', () => {
      const q = buildActionQueue([job({ status: 'Not applied', deadline: iso(-4) })])
      expect(q[0].kind).toBe('deadline-passed')
      expect(q[0].urgency).toBeGreaterThan(0)
    })

    it('says "Closes today" rather than "in 0d"', () => {
      const q = buildActionQueue([job({ status: 'Not applied', deadline: iso(0) })])
      expect(q[0].label).toBe('Closes today')
    })

    it('ignores a far-off deadline', () => {
      expect(buildActionQueue([job({ status: 'Not applied', deadline: iso(60) })])).toHaveLength(0)
    })
  })

  describe('applications that have gone quiet', () => {
    it('flags one with no word for three weeks', () => {
      const q = buildActionQueue([job({ status: 'Applied', date_applied: iso(-25) })])
      expect(q[0].kind).toBe('awaiting-reply')
      expect(q[0].label).toBe('Quiet 25d')
    })

    it('leaves a recent application alone', () => {
      expect(buildActionQueue([job({ status: 'Applied', date_applied: iso(-5) })])).toHaveLength(0)
    })

    it('ranks a longer silence above a shorter one', () => {
      const older = job({ status: 'Pending', date_applied: iso(-80) })
      const newer = job({ status: 'Pending', date_applied: iso(-25) })
      const order = buildActionQueue([newer, older]).map((i) => i.job.id)
      expect(order).toEqual([older.id, newer.id])
    })
  })

  it('nudges a high-priority role that was never applied for', () => {
    const q = buildActionQueue([job({ status: 'Not applied', priority: 'High', date_found: iso(-14) })])
    expect(q[0].kind).toBe('high-priority-unapplied')
    expect(q[0].detail).toContain('14 days ago')
  })

  it('leaves a medium-priority unapplied role out of the queue', () => {
    expect(buildActionQueue([job({ status: 'Not applied', priority: 'Medium' })])).toHaveLength(0)
  })

  it('sorts interviews and replies ahead of quiet applications', () => {
    const quiet = job({ status: 'Pending', date_applied: iso(-40) })
    const interview = job({ status: 'Interview' })
    const reply = job({ status: 'Heard back' })
    const order = buildActionQueue([quiet, reply, interview]).map((i) => i.job.id)
    expect(order).toEqual([interview.id, reply.id, quiet.id])
  })
})

describe('buildStats', () => {
  it('counts an empty pipeline without dividing by zero', () => {
    const s = buildStats([])
    expect(s.total).toBe(0)
    expect(s.responseRate).toBe(0)
    expect(s.weekly).toHaveLength(12)
  })

  it('excludes unapplied roles from the reply-rate denominator', () => {
    // 2 applied, 1 of which replied => 50%, not 25% across all four rows.
    const jobs = [
      job({ status: 'Not applied' }),
      job({ status: 'Not applied' }),
      job({ status: 'Applied', date_applied: iso(-10) }),
      job({ status: 'Interview', date_applied: iso(-10) }),
    ]
    const s = buildStats(jobs)
    expect(s.applied).toBe(2)
    expect(s.responses).toBe(1)
    expect(s.responseRate).toBeCloseTo(0.5)
  })

  it('counts Offer and Interview as responses but not Rejected', () => {
    const jobs = [
      job({ status: 'Offer', date_applied: iso(-5) }),
      job({ status: 'Interview', date_applied: iso(-5) }),
      job({ status: 'Heard back', date_applied: iso(-5) }),
      job({ status: 'Rejected', date_applied: iso(-5) }),
    ]
    expect(buildStats(jobs).responses).toBe(3)
  })

  it('treats live as everything not rejected or withdrawn', () => {
    const jobs = [
      job({ status: 'Applied' }),
      job({ status: 'Rejected' }),
      job({ status: 'Withdrawn' }),
    ]
    expect(buildStats(jobs).live).toBe(1)
  })

  it('windows recent applications by date applied', () => {
    const jobs = [
      job({ status: 'Applied', date_applied: iso(-2) }),
      job({ status: 'Applied', date_applied: iso(-20) }),
      job({ status: 'Applied', date_applied: iso(-200) }),
    ]
    const s = buildStats(jobs)
    expect(s.appliedLast7).toBe(1)
    expect(s.appliedLast30).toBe(2)
  })

  it('breaks conversion down by source', () => {
    const jobs = [
      job({ status: 'Interview', source: 'Seek', date_applied: iso(-5) }),
      job({ status: 'Applied', source: 'Seek', date_applied: iso(-5) }),
      job({ status: 'Applied', source: 'LinkedIn', date_applied: iso(-5) }),
      // Not applied, so it should not appear at all.
      job({ status: 'Not applied', source: 'Grad program' }),
    ]
    const s = buildStats(jobs)
    const seek = s.bySource.find((x) => x.source === 'Seek')!
    const linkedin = s.bySource.find((x) => x.source === 'LinkedIn')!

    expect(seek.applied).toBe(2)
    expect(seek.responses).toBe(1)
    expect(seek.rate).toBeCloseTo(0.5)
    expect(linkedin.rate).toBe(0)
    expect(s.bySource.map((x) => x.source)).not.toContain('Grad program')
  })

  it('orders sources by volume', () => {
    const jobs = [
      job({ status: 'Applied', source: 'LinkedIn', date_applied: iso(-1) }),
      job({ status: 'Applied', source: 'Seek', date_applied: iso(-1) }),
      job({ status: 'Applied', source: 'Seek', date_applied: iso(-1) }),
    ]
    expect(buildStats(jobs).bySource[0].source).toBe('Seek')
  })

  it('buckets applications into the right week', () => {
    const jobs = [
      job({ status: 'Applied', date_applied: iso(-1) }),
      job({ status: 'Applied', date_applied: iso(-2) }),
    ]
    const weekly = buildStats(jobs).weekly
    expect(weekly).toHaveLength(12)
    expect(weekly.reduce((a, w) => a + w.count, 0)).toBe(2)
  })
})

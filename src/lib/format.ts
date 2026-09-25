/** Today as an ISO yyyy-mm-dd string in the browser's local timezone. */
export function todayISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10)
}

/** Whole days from today to an ISO date. Negative means the date has passed. */
export function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const then = new Date(iso + 'T00:00:00')
  const now = new Date(todayISO() + 'T00:00:00')
  return Math.round((then.getTime() - now.getTime()) / 86_400_000)
}

export function daysSince(iso: string | null): number | null {
  const d = daysUntil(iso)
  return d === null ? null : -d
}

/** "21 Sep 2026" */
export function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** "in 3 days" / "2 days ago" / "today" */
export function relativeDate(iso: string | null): string {
  const d = daysUntil(iso)
  if (d === null) return '—'
  if (d === 0) return 'today'
  if (d === 1) return 'tomorrow'
  if (d === -1) return 'yesterday'
  if (d > 0) return `in ${d} days`
  return `${-d} days ago`
}

export function initials(company: string): string {
  const words = company.replace(/[^\w\s]/g, ' ').trim().split(/\s+/)
  if (words.length === 0 || !words[0]) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/** Deterministic hue from a string, so each company keeps the same accent. */
export function hueFor(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360
  return h
}

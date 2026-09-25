import type { ReactNode, ButtonHTMLAttributes } from 'react'
import type { Status, Priority } from '../types'

/* ------------------------------------------------------------------ *
 * Status presentation
 *
 * Pipeline stages use the ordinal blue ramp (they are a progression).
 * Terminal outcomes use the fixed status palette. Every badge carries a
 * glyph as well as colour, so state never rests on hue alone.
 * ------------------------------------------------------------------ */

export const STATUS_STYLE: Record<Status, { color: string; glyph: string }> = {
  'Not applied': { color: 'var(--text-muted)', glyph: '○' },
  Applied: { color: 'var(--stage-2)', glyph: '◔' },
  Pending: { color: 'var(--stage-3)', glyph: '◑' },
  'Heard back': { color: 'var(--stage-4)', glyph: '◕' },
  Interview: { color: 'var(--stage-5)', glyph: '★' },
  Offer: { color: 'var(--good)', glyph: '✓' },
  Rejected: { color: 'var(--critical)', glyph: '✕' },
  Withdrawn: { color: 'var(--text-muted)', glyph: '—' },
}

export function StatusBadge({ status, size = 'sm' }: { status: Status; size?: 'sm' | 'xs' }) {
  const s = STATUS_STYLE[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap ${
        size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
      style={{
        color: s.color,
        borderColor: `color-mix(in oklab, ${s.color} 35%, transparent)`,
        background: `color-mix(in oklab, ${s.color} 10%, transparent)`,
      }}
    >
      <span aria-hidden="true">{s.glyph}</span>
      {status}
    </span>
  )
}

const PRIORITY_STYLE: Record<Priority, { color: string; glyph: string }> = {
  High: { color: 'var(--critical)', glyph: '▲' },
  Medium: { color: 'var(--serious)', glyph: '■' },
  Low: { color: 'var(--text-muted)', glyph: '▼' },
}

export function PriorityDot({ priority }: { priority: Priority }) {
  const p = PRIORITY_STYLE[priority]
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium"
      style={{ color: p.color }}
      title={`${priority} priority`}
    >
      <span aria-hidden="true">{p.glyph}</span>
      <span className="sr-only">{priority} priority</span>
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

export function Card({
  children,
  className = '',
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-xl border bg-[var(--surface)] ${className}`}
      style={{ boxShadow: 'var(--shadow-sm)' }}
      {...rest}
    >
      {children}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline'
  size?: 'sm' | 'md'
}

export function Button({ variant = 'outline', size = 'md', className = '', ...rest }: BtnProps) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm'
  const variants: Record<string, string> = {
    primary:
      'bg-[var(--accent)] text-[var(--accent-contrast)] hover:opacity-90 border border-transparent',
    outline: 'border bg-[var(--surface)] hover:bg-[var(--surface-2)] text-[var(--text-primary)]',
    ghost: 'hover:bg-[var(--surface-2)] text-[var(--text-secondary)] border border-transparent',
    danger:
      'border text-[var(--critical)] hover:bg-[color-mix(in_oklab,var(--critical)_10%,transparent)]',
  }
  return <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest} />
}

export function StatTile({
  label,
  value,
  sub,
  tone,
}: {
  label: string
  value: string | number
  sub?: string
  tone?: 'good' | 'critical'
}) {
  const color =
    tone === 'good' ? 'var(--good-text)' : tone === 'critical' ? 'var(--critical)' : 'var(--text-primary)'
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-3xl font-semibold leading-none" style={{ color }}>
        {value}
      </div>
      {sub && <div className="mt-1.5 text-xs text-[var(--text-secondary)]">{sub}</div>}
    </Card>
  )
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
      <div className="text-3xl" aria-hidden="true">
        {icon}
      </div>
      <div className="mt-3 font-medium text-[var(--text-primary)]">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">{hint}</div>}
    </div>
  )
}

export function Field({
  label,
  children,
  hint,
  className = '',
}: {
  label: string
  children: ReactNode
  hint?: string
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-[var(--text-secondary)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-[var(--text-muted)]">{hint}</span>}
    </label>
  )
}

/** Width is deliberately left off so callers can size these without a class clash. */
export const inputClass =
  'rounded-lg border bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]'

/** The full-width variant used inside form fields. */
export const fieldClass = `${inputClass} w-full`

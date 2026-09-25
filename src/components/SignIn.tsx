import { useState } from 'react'
import type { Auth } from '../lib/auth'
import { Button, Field, fieldClass } from './ui'

export function SignIn({ auth }: { auth: Auth }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setStatus('sending')
    setError(null)
    const { error } = await auth.sendMagicLink(email)
    if (error) {
      setError(error)
      setStatus('idle')
    } else {
      setStatus('sent')
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-16">
      <div
        className="w-full max-w-sm rounded-xl border bg-[var(--surface)] p-6"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="grid size-9 place-items-center rounded-lg text-sm font-bold"
            style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            aria-hidden="true"
          >
            JT
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-semibold">Job Tracker</h1>
            <p className="text-xs text-[var(--text-muted)]">Sign in to load your pipeline</p>
          </div>
        </div>

        {status === 'sent' ? (
          <div className="mt-6">
            <div
              className="rounded-lg border px-3 py-3 text-sm"
              style={{
                borderColor: 'color-mix(in oklab, var(--good) 40%, transparent)',
                background: 'color-mix(in oklab, var(--good) 8%, transparent)',
              }}
            >
              <p className="font-medium" style={{ color: 'var(--good-text)' }}>
                <span aria-hidden="true">✓ </span>Check your inbox
              </p>
              <p className="mt-1 text-[var(--text-secondary)]">
                A sign-in link is on its way to <strong>{email}</strong>. Open it on this device
                and you will land back here signed in. The link expires in an hour.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setStatus('idle')
                setError(null)
              }}
            >
              Use a different address
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <Field label="Email address" hint="No password. We email you a one-time link.">
              <input
                type="email"
                className={fieldClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                autoComplete="email"
              />
            </Field>

            {error && (
              <p role="alert" className="text-sm" style={{ color: 'var(--critical)' }}>
                <span aria-hidden="true">⚠ </span>
                {error}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </Button>
          </form>
        )}

        <p className="mt-5 border-t pt-4 text-[11px] leading-relaxed text-[var(--text-muted)]">
          Each account sees only its own roles. Signing up with a new address gives you an empty
          tracker, so feel free to try it out.
        </p>
      </div>
    </div>
  )
}

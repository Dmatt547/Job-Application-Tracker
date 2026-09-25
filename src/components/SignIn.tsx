import { useState } from 'react'
import type { Auth } from '../lib/auth'
import { Button, Field, fieldClass } from './ui'

export function SignIn({ auth }: { auth: Auth }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'redirecting'>('idle')
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

  const google = async () => {
    setStatus('redirecting')
    setError(null)
    const { error } = await auth.signInWithGoogle()
    // A successful call navigates away, so reaching here means it failed.
    if (error) {
      setError(
        /provider is not enabled/i.test(error)
          ? 'Google sign-in is not switched on for this project yet. Enable it under Authentication → Sign In / Providers in Supabase.'
          : error,
      )
      setStatus('idle')
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
          <>
            <Button
              variant="outline"
              className="mt-6 w-full"
              onClick={() => void google()}
              disabled={status === 'redirecting'}
            >
              {/* Google's official mark, served from public/google.svg. Their
                  branding guidelines require the supplied asset rather than a
                  redrawn copy, so if the file is missing we drop the image and
                  keep a text-only button instead of showing a broken icon. */}
              <img
                src="/google.svg"
                alt=""
                aria-hidden="true"
                width={18}
                height={18}
                className="shrink-0"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              {status === 'redirecting' ? 'Redirecting…' : 'Continue with Google'}
            </Button>

            <div className="my-4 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-[var(--border-strong)]" />
              <span className="text-[11px] text-[var(--text-muted)]">or</span>
              <span className="h-px flex-1 bg-[var(--border-strong)]" />
            </div>

            <form onSubmit={submit} className="space-y-3">
              <Field label="Email address" hint="No password. We email you a one-time link.">
                <input
                  type="email"
                  className={fieldClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </Field>

              <Button
                type="submit"
                variant="primary"
                className="w-full"
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
              </Button>
            </form>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--critical)' }}>
            <span aria-hidden="true">⚠ </span>
            {error}
          </p>
        )}

        <p className="mt-5 border-t pt-4 text-[11px] leading-relaxed text-[var(--text-muted)]">
          Both routes reach the same account when the email matches. Each account sees only its own
          roles, so signing up with a new address gives you an empty tracker.
        </p>
      </div>
    </div>
  )
}

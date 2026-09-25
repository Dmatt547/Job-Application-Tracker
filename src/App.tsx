import { useEffect, useRef, useState } from 'react'
import type { Job, JobDraft } from './types'
import { useStore } from './lib/store'
import { useAuth } from './lib/auth'
import { buildActionQueue } from './lib/derive'
import { Today } from './components/Today'
import { Board } from './components/Board'
import { ListView } from './components/ListView'
import { Stats } from './components/Stats'
import { JobModal } from './components/JobModal'
import { SignIn } from './components/SignIn'
import { Button } from './components/ui'

type View = 'today' | 'board' | 'list' | 'stats'

const VIEWS: { id: View; label: string; glyph: string }[] = [
  { id: 'today', label: 'Today', glyph: '◎' },
  { id: 'board', label: 'Board', glyph: '▦' },
  { id: 'list', label: 'All roles', glyph: '☰' },
  { id: 'stats', label: 'Stats', glyph: '◔' },
]

type Theme = 'light' | 'dark' | 'system'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem('job-tracker:theme') as Theme) || 'system'
    } catch {
      return 'system'
    }
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('job-tracker:theme', theme)
    } catch {
      /* private mode */
    }
  }, [theme])
  return { theme, setTheme }
}

export default function App() {
  const auth = useAuth()
  const store = useStore(auth.userId)
  const { theme, setTheme } = useTheme()
  const [view, setView] = useState<View>('today')
  const [editing, setEditing] = useState<Job | null>(null)
  const [adding, setAdding] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const urgentCount = buildActionQueue(store.jobs).filter((q) => q.urgency < 0).length

  useEffect(() => {
    document.title = urgentCount ? `(${urgentCount}) Job Tracker` : 'Job Tracker'
  }, [urgentCount])

  const save = async (draft: JobDraft, id: string | null) => {
    if (id) await store.updateJob(id, draft)
    else await store.addJob(draft)
    setEditing(null)
    setAdding(false)
  }

  const remove = async (id: string) => {
    await store.deleteJob(id)
    setEditing(null)
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(store.jobs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `job-tracker-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async (file: File) => {
    try {
      const rows = JSON.parse(await file.text())
      if (!Array.isArray(rows)) throw new Error('Expected a JSON array')
      const merge = store.jobs.length > 0 && confirm('Merge with what is already here? Cancel replaces everything.')
      await store.importJobs(rows as JobDraft[], merge ? 'merge' : 'replace')
    } catch (e) {
      alert(`Could not import that file: ${(e as Error).message}`)
    }
  }

  // Restoring the session on load. Rendering the app first would flash the
  // sign-in screen at someone who is already signed in.
  if (auth.loading) {
    return (
      <div className="grid min-h-full place-items-center">
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      </div>
    )
  }

  if (auth.required) return <SignIn auth={auth} />

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b bg-[var(--surface)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span
              className="grid size-8 place-items-center rounded-lg text-sm font-bold"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
              aria-hidden="true"
            >
              JT
            </span>
            <div className="leading-tight">
              <h1 className="text-sm font-semibold">Job Tracker</h1>
              <p className="text-[11px] text-[var(--text-muted)]">
                {store.cloud ? 'Synced' : 'This browser only'} · {store.jobs.length} roles
              </p>
            </div>
          </div>

          <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto" aria-label="Views">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                aria-current={view === v.id ? 'page' : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  view === v.id
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
                }`}
              >
                <span aria-hidden="true">{v.glyph}</span>
                {v.label}
                {v.id === 'today' && urgentCount > 0 && (
                  <span
                    className="tabular ml-0.5 rounded-full px-1.5 text-[10px] font-bold"
                    style={{
                      background: view === v.id ? 'rgb(0 0 0 / 0.2)' : 'var(--critical)',
                      color: view === v.id ? 'inherit' : '#fff',
                    }}
                  >
                    {urgentCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
              aria-label="Colour theme"
              className="rounded-lg border bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-secondary)]"
            >
              <option value="system">Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            {auth.email && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void auth.signOut()}
                title={`Signed in as ${auth.email}`}
              >
                Sign out
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={exportJson} title="Download a JSON backup">
              Export
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
              Import
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importJson(f)
                e.target.value = ''
              }}
            />
            <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
              + Add
            </Button>
          </div>
        </div>
      </header>

      {store.error && (
        <div
          role="alert"
          className="mx-auto mt-3 max-w-7xl rounded-lg border px-4 py-2 text-sm"
          style={{
            borderColor: 'color-mix(in oklab, var(--critical) 40%, transparent)',
            background: 'color-mix(in oklab, var(--critical) 8%, transparent)',
            color: 'var(--critical)',
          }}
        >
          <span aria-hidden="true">⚠ </span>
          {store.error}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-5">
        {store.loading ? (
          <p className="py-20 text-center text-sm text-[var(--text-muted)]">Loading…</p>
        ) : store.jobs.length === 0 ? (
          <div className="mx-auto max-w-md rounded-xl border border-dashed px-6 py-14 text-center">
            <div className="text-3xl" aria-hidden="true">
              🎯
            </div>
            <h2 className="mt-3 font-medium">Nothing tracked yet</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Add your first role, or import the JSON exported from your spreadsheet.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="primary" onClick={() => setAdding(true)}>
                + Add a role
              </Button>
              <Button onClick={() => fileRef.current?.click()}>Import JSON</Button>
            </div>
          </div>
        ) : (
          <>
            {view === 'today' && (
              <Today jobs={store.jobs} onOpen={setEditing} onUpdate={store.updateJob} />
            )}
            {view === 'board' && (
              <Board jobs={store.jobs} onOpen={setEditing} onUpdate={store.updateJob} />
            )}
            {view === 'list' && <ListView jobs={store.jobs} onOpen={setEditing} />}
            {view === 'stats' && <Stats jobs={store.jobs} />}
          </>
        )}
      </main>

      {(editing || adding) && (
        <JobModal
          job={editing}
          onClose={() => {
            setEditing(null)
            setAdding(false)
          }}
          onSave={save}
          onDelete={remove}
        />
      )}
    </div>
  )
}

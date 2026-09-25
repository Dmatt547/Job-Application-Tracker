# Job Tracker

A job application tracker I built because the spreadsheet I was using stopped
being useful at around 90 rows.

[![CI](https://github.com/DanielMattioli/job-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/DanielMattioli/job-tracker/actions/workflows/ci.yml)

Live: _add your Netlify URL here once deployed_

## The problem

I am a final-year software engineering student applying for graduate roles. I
tracked everything in an Excel workbook: company, role, link, status, dates,
notes. It worked until it didn't. By the time there were 98 rows across eight
statuses, the spreadsheet could tell me *what* I had applied for but not *what I
needed to do today*. Twice I found out a deadline had passed by scrolling past it.

Three things a spreadsheet is bad at, that this fixes:

1. **Nothing surfaces itself.** A closing date in a cell is invisible until you
   look at that cell. Here, anything overdue or closing inside seven days is on
   the first screen, sorted by how urgent it is.
2. **Status changes are tedious.** Changing a dropdown for each of eight stages
   discourages keeping it current, so it goes stale. Here you drag a card.
3. **No sense of whether it is working.** COUNTIF cells gave me totals, not
   whether applying through Seek was actually converting better than grad
   programs. Here that is a chart.

## Architecture

```
  Browser (React + TS)
         │
         │  supabase-js, RLS-scoped to the signed-in account
         ▼
  Supabase ──── Postgres      jobs table, per-user row level security
           ├─── Auth          Google OAuth + passwordless email link
           └─── Realtime      change feed, so two devices stay in step
         ▲
         │  cron: read inbox, match ATS replies, scrape boards  (next)
  Ingestion service
```

Two storage backends behind one interface. With Supabase configured the app
talks to Postgres and subscribes to realtime changes; without it, the same
store falls back to `localStorage` and everything still works, which means the
app runs straight after `npm install` with no account and keeps working
offline. The client never filters by user — row level security does it in the
database, so a bug in the frontend cannot leak another account's rows.

## What it does

**Today** — the action queue. Overdue follow-ups, deadlines inside a week,
interviews, and applications that have gone quiet for three weeks or more, ranked
by urgency. Each row has the direct link to the ad and a one-click "mark applied".

**Board** — a drag-and-drop kanban across the pipeline (Not applied → Applied →
Pending → Heard back → Interview → Offer). Dropping a card into Applied stamps
today's date automatically.

**All roles** — the spreadsheet replacement. Sortable, filterable, searchable
across company, role, location and notes.

**Stats** — the conversion funnel, applications per week over 12 weeks, and reply
rate broken down by where the role came from.

## Stack

| Layer | Choice | Why |
|---|---|---|
| UI | React 18 + TypeScript | Strict mode on, no `any` in application code |
| Build | Vite 5 | ~1s production build, 57 kB gzipped total |
| Styling | Tailwind CSS v4 | Design tokens as CSS custom properties |
| Data | Supabase (Postgres) | Real database, realtime subscriptions, free tier |
| Charts | Hand-rolled SVG/CSS | No charting dependency for four simple forms |
| Hosting | Netlify | Git-connected, deploys on push |

**Zero runtime chart dependencies.** The funnel, bar series and conversion chart
are plain elements. Adding Recharts would have roughly doubled the bundle for
four charts I could draw myself.

### Two storage modes

The data layer is an adapter. With `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` set, it talks to Postgres and subscribes to realtime
changes, so an edit on my phone appears on my laptop. Without them, it falls back
to `localStorage` and the app still works end to end — which means it runs
straight after `npm install` with no account setup, and it keeps working offline
once loaded. Writes are optimistic: the UI updates immediately and reconciles
with the server after.

### Testing and CI

42 unit tests over the parts where a bug would be silent: the action-queue
ranking in `derive.ts`, the funnel and conversion maths, and the date helpers.
The UI is deliberately not tested — it changes constantly and the logic is
where correctness actually lives.

Two of the tests exist because of real bugs the suite is there to prevent:

- **One item per job.** A role can qualify on several rules at once (high
  priority, unapplied, closing this week, action due). It must surface once,
  or the "needs you now" count lies.
- **No drift across daylight saving.** Melbourne changes to AEDT in October,
  making one day 23 hours long. `daysUntil` uses `Math.round` rather than
  `Math.floor` for exactly this reason, and there is a test pinned to the
  transition that fails if anyone "tidies" it.

I checked the suite has teeth by mutating the source: removing the
closed-job filter and swapping that `Math.round` for `Math.floor` each fail
exactly one test.

CI runs typecheck, tests and a production build on every push and PR. There
are two equivalent configs: `.github/workflows/ci.yml` is the one wired up,
and `azure-pipelines.yml` expresses the same gate for Azure DevOps.

```bash
npm test          # watchable locally
npm run typecheck
npm run build
```

### Accessibility and colour

Colour was chosen rather than picked. Pipeline stages use a single-hue ordinal
ramp (they are a progression, so lightness carries the ordering); terminal
outcomes use a fixed status palette. Every status badge pairs a glyph with its
colour, so state never depends on hue alone — which matters for the ~8% of men
with a colour vision deficiency. The palette was validated programmatically for
colour-blind separation and contrast against both the light and dark surfaces,
and dark mode is a separately chosen set of steps rather than an inverted filter.

## Running it

```bash
npm install
npm run dev
```

That is enough. It opens on `localhost:5173` in localStorage mode.

### Adding the database (optional, needed for multi-device sync)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env` and fill in the URL and anon key from
   **Project Settings → API**.
4. Restart the dev server. The header switches from "This browser only" to
   "Synced".

### Importing the old spreadsheet

```bash
pip install openpyxl
python scripts/seed_from_xlsx.py
```

Reads the `Pipeline` sheet and writes `scripts/seed.json`. Load it with the
**Import** button in the app. Import offers merge (skips anything already
tracked, matching on company plus role) or replace.

**Export** downloads the whole pipeline as JSON at any time, so the data is never
locked in.

## Deploying to Netlify

1. Push this repo to GitHub.
2. In Netlify, **Add new site → Import an existing project**, pick the repo.
3. Build settings come from `netlify.toml` — build `npm run build`, publish
   `dist`. Nothing to type.
4. If using Supabase, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under
   **Site configuration → Environment variables**, then redeploy.

Every push to `main` redeploys.

## A note on security

This is a single-user app with no login, so the Supabase anon key is the only
credential and row-level security is permissive. Anyone with the deployed URL and
that key can read and write the table. That is a deliberate trade for a personal
tool. Before putting the live link anywhere public, swap in Supabase Auth with a
magic link and scope the RLS policy to `auth.uid()` — there is a comment in
`schema.sql` marking exactly where.

## Project structure

```
src/
  types.ts              Status, Source, Priority unions; the Job shape
  lib/
    supabase.ts         Client, null when env vars are absent
    store.ts            useStore hook — every read and write, both backends
    derive.ts           Action queue ranking and stats calculations
    format.ts           Date maths and display formatting
  components/
    Today.tsx           Action queue
    Board.tsx           Drag-and-drop kanban
    ListView.tsx        Sortable, filterable table
    Stats.tsx           Funnel, weekly bars, source conversion
    JobModal.tsx        Add and edit form
    ui.tsx              Shared primitives and status presentation
supabase/
  schema.sql            Tables, indexes, trigger, base RLS policy
  02_auth.sql           user_id column, backfill, per-account policies
scripts/seed_from_xlsx.py   Spreadsheet importer
.github/workflows/ci.yml    CI (typecheck, test, build)
azure-pipelines.yml         The same gate for Azure DevOps
```

## Things I would do next

- Supabase Auth, so the live link is safe to share.
- Parse a job ad URL and pre-fill the form, rather than typing company and role.
- Email digest of the action queue each morning.
- Track which cover letter went with which application.

---

Built by [Daniel Mattioli](https://danielmattioli.dev)

# Job Tracker

A job application tracker I built because the spreadsheet I was using stopped
being useful at around 90 rows.

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
3. Copy `.env.example` to `.env` and fill in the project URL and the
   **publishable key** (`sb_publishable_…`) from **Settings → API Keys**.
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
4. If using Supabase, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_PUBLISHABLE_KEY` under **Site configuration → Environment
   variables**, then redeploy.

Every push to `main` redeploys.

## A note on security

This is a single-user app with no login, so the Supabase publishable key is the
only credential and row-level security is permissive. The publishable key is
meant to be visible in browser code — that part is normal — but because the RLS
policy grants the `anon` role full access, anyone who has both the deployed URL
and that key can read and write the table. That is a deliberate trade for a
personal tool, not a pattern to copy.

Before putting the live link anywhere public, add Supabase Auth with an email
magic link and scope the policy to `auth.uid()`. There is a comment in
`schema.sql` marking exactly which policy to replace.

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
supabase/schema.sql     Tables, indexes, trigger, RLS policy
scripts/seed_from_xlsx.py   Spreadsheet importer
```

## Things I would do next

- Supabase Auth, so the live link is safe to share.
- Parse a job ad URL and pre-fill the form, rather than typing company and role.
- Email digest of the action queue each morning.
- Track which cover letter went with which application.

---

Built by [Daniel Mattioli](https://danielmattioli.dev)

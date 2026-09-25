-- Job Tracker schema
-- Paste this into the Supabase SQL editor and run it once.

create extension if not exists "pgcrypto";

create table if not exists public.jobs (
  id              uuid primary key default gen_random_uuid(),
  company         text not null,
  role            text not null default '',
  location        text not null default '',
  link            text not null default '',
  source          text not null default 'Other',
  priority        text not null default 'Medium',
  status          text not null default 'Not applied',
  date_found      date,
  date_applied    date,
  deadline        date,
  last_update     date,
  next_action     text not null default '',
  next_action_due date,
  notes           text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint jobs_status_check check (status in (
    'Not applied','Applied','Pending','Heard back','Interview','Offer','Rejected','Withdrawn'
  )),
  constraint jobs_priority_check check (priority in ('High','Medium','Low')),
  constraint jobs_source_check check (source in (
    'Seek','LinkedIn','Grad program','Company site','Referral','Recruiter','Other'
  ))
);

-- Queries in the app filter on these three more than anything else.
create index if not exists jobs_status_idx   on public.jobs (status);
create index if not exists jobs_deadline_idx on public.jobs (deadline);
create index if not exists jobs_due_idx      on public.jobs (next_action_due);

-- Keep updated_at honest even when a row is changed outside the app.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists jobs_touch_updated_at on public.jobs;
create trigger jobs_touch_updated_at
  before update on public.jobs
  for each row execute function public.touch_updated_at();

-- Realtime, so a change on your phone shows up on your laptop.
alter publication supabase_realtime add table public.jobs;

-- ---------------------------------------------------------------------
-- Row level security
--
-- This is a single-user app with no login, so the anon key is the only
-- credential. That means anyone holding your anon key can read and write
-- this table. Two ways to handle it, pick one:
--
--   A. Keep it private. Do not put the deployed URL anywhere public, and
--      treat the anon key as a password. Simplest, and fine for personal use.
--
--   B. Add Supabase Auth (email magic link) and swap the policy below for
--      one scoped to auth.uid(). Do this before you put the live link on
--      your CV, since recruiters will click it.
--
-- The policy below implements option A.
-- ---------------------------------------------------------------------

alter table public.jobs enable row level security;

drop policy if exists "anon full access" on public.jobs;
create policy "anon full access"
  on public.jobs
  for all
  to anon
  using (true)
  with check (true);

-- ---------------------------------------------------------------------
-- Migration 02: add authentication
--
-- Run this in the Supabase SQL editor AFTER schema.sql, and AFTER you have
-- signed in to the app at least once (so your row exists in auth.users).
--
-- What it does:
--   1. Adds a user_id column linking each job to the account that owns it
--   2. Backfills your existing rows to your account
--   3. Replaces the "anyone with the key" policy with per-user policies
--
-- After this, the table is genuinely private per account. Someone else can
-- sign up and get their own empty tracker; they cannot see yours.
-- ---------------------------------------------------------------------

-- 1. The ownership column ------------------------------------------------

alter table public.jobs
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

create index if not exists jobs_user_id_idx on public.jobs (user_id);

-- 2. Backfill -------------------------------------------------------------
--
-- Claims every job that currently has no owner. Safe to run once, while you
-- are the only account. Replace the email if you signed up with a different
-- one. If this updates 0 rows, you have not signed in yet — do that first.

update public.jobs
set user_id = (
  select id from auth.users
  where email = 'danielmattioli2005@gmail.com'
  limit 1
)
where user_id is null;

-- Refuse to continue if anything is still unowned, rather than locking
-- yourself out of your own rows when the policies below take effect.
do $$
declare
  orphans int;
begin
  select count(*) into orphans from public.jobs where user_id is null;
  if orphans > 0 then
    raise exception
      'Still % job row(s) with no user_id. Sign in to the app once, then re-run this file.', orphans;
  end if;
end $$;

-- Now that every row is owned, require it going forward.
alter table public.jobs alter column user_id set not null;

-- 3. Policies -------------------------------------------------------------
--
-- Drop the permissive single-user policy from schema.sql and replace it with
-- four scoped ones. Separate policies per command rather than "for all" so
-- the with-check on insert and update is explicit: it stops a client from
-- writing a row owned by somebody else.

drop policy if exists "anon full access" on public.jobs;
drop policy if exists "own jobs: select" on public.jobs;
drop policy if exists "own jobs: insert" on public.jobs;
drop policy if exists "own jobs: update" on public.jobs;
drop policy if exists "own jobs: delete" on public.jobs;

create policy "own jobs: select"
  on public.jobs for select
  to authenticated
  using (auth.uid() = user_id);

create policy "own jobs: insert"
  on public.jobs for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "own jobs: update"
  on public.jobs for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own jobs: delete"
  on public.jobs for delete
  to authenticated
  using (auth.uid() = user_id);

-- Default user_id to the caller, so a client that forgets to send it still
-- writes a correctly owned row instead of failing the with-check.
alter table public.jobs alter column user_id set default auth.uid();

-- 4. Verify ---------------------------------------------------------------
-- Expect: 4 policies, all scoped to the authenticated role.

select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'jobs'
order by policyname;

-- Phase 2: let admins manage people from the app.

-- Inactive people keep their history but can no longer sign in.
alter table public.profiles
  add column if not exists active boolean not null default true;

-- A reporting line must not point at the person themselves.
alter table public.profiles
  drop constraint if exists profiles_not_own_manager,
  add constraint profiles_not_own_manager check (manager_id is null or manager_id <> id);

-- Everyone signed in can see the names of managers and leadership, so the
-- People screen and later screens can show "reports to" without leaking
-- anything about other employees.
create policy "read managers and leadership"
  on public.profiles for select
  using (auth.uid() is not null and role in ('manager', 'executive'));

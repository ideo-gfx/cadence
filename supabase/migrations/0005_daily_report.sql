-- Phase 5: the daily report. At 9 PM the report for that day is "closed":
-- every approved day not yet in a report is stamped with that report's date.
-- Days approved after that go into the next report as late approvals.

alter table public.days add column if not exists reported_on date;
create index if not exists days_reported_on_idx on public.days (reported_on);

-- One row per report (and per reminder run), so a job never sends twice.
create table public.report_runs (
  run_date    date not null,
  kind        text not null check (kind in ('report', 'reminder_people', 'reminder_managers')),
  ran_at      timestamptz not null default now(),
  emailed     boolean not null default false,
  recipients  int not null default 0,
  primary key (run_date, kind)
);

-- Only the server (service role) writes runs; leadership and admins can read them.
alter table public.report_runs enable row level security;
create policy "leadership and admins read runs"
  on public.report_runs for select
  using (public.current_role_is('executive') or public.current_is_admin());

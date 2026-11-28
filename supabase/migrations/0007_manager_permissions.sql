-- Phase 4b: manager permissions and task review.
--  * Managers see their whole team (reports of their reports too), read-only
--    below their direct reports.
--  * A manager can name a backup approver for a date range, who can approve
--    or send back that manager's direct reports while it lasts.
--  * A manager can let a direct report edit the projects list.
--  * Sending a day back can point at the tasks that need changing.
-- Safe to run more than once.

-- 1. Everyone below me in the reporting tree. --------------------------------
create or replace function public.is_in_my_team(person uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with recursive tree as (
    select id from public.profiles where manager_id = auth.uid()
    union
    select p.id from public.profiles p join tree t on p.manager_id = t.id
  )
  select exists (select 1 from tree where id = person);
$$;

-- 2. Backup approvers. One per manager at a time. ----------------------------
create table if not exists public.approval_delegates (
  manager_id   uuid primary key references public.profiles (id) on delete cascade,
  delegate_id  uuid not null references public.profiles (id) on delete cascade,
  starts_on    date not null,
  ends_on      date not null,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint approval_delegates_dates check (ends_on >= starts_on),
  constraint approval_delegates_not_self check (delegate_id <> manager_id)
);
create index if not exists approval_delegates_delegate_idx on public.approval_delegates (delegate_id);

alter table public.approval_delegates enable row level security;

drop policy if exists "read own delegations" on public.approval_delegates;
create policy "read own delegations"
  on public.approval_delegates for select
  using (manager_id = auth.uid() or delegate_id = auth.uid() or public.current_is_admin());
-- No insert/update/delete policies: changes go through the functions below.

-- Can I approve or send back this person's day? Their manager is me, or their
-- manager made me backup approver for today. Never your own day.
create or replace function public.can_review(person uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select person <> auth.uid() and exists (
    select 1 from public.profiles p
     where p.id = person
       and (
         p.manager_id = auth.uid()
         or exists (
           select 1 from public.approval_delegates a
            where a.manager_id = p.manager_id
              and a.delegate_id = auth.uid()
              and public.team_today() between a.starts_on and a.ends_on)
       ));
$$;

-- Set (or replace) a backup approver. Managers set their own; admins can set
-- one for any manager by passing p_manager.
create or replace function public.set_backup_approver(
  p_delegate uuid, p_starts date, p_ends date, p_manager uuid default null
) returns public.approval_delegates
language plpgsql security definer set search_path = public as $$
declare
  v_manager uuid := coalesce(p_manager, auth.uid());
  v_row public.approval_delegates;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if v_manager <> auth.uid() and not public.current_is_admin() then
    raise exception 'Only admins can set a backup approver for someone else.';
  end if;
  if not exists (select 1 from public.profiles where manager_id = v_manager and active) then
    raise exception 'Nobody reports to this manager yet, so there''s nothing to hand over.';
  end if;
  if p_delegate = v_manager then raise exception 'Pick someone other than the manager.'; end if;
  if not exists (select 1 from public.profiles where id = p_delegate and active) then
    raise exception 'That person isn''t active in Cadence.';
  end if;
  if p_starts is null or p_ends is null or p_ends < p_starts then
    raise exception 'The end date must be on or after the start date.';
  end if;
  if p_ends < public.team_today() then raise exception 'The end date is already in the past.'; end if;

  insert into public.approval_delegates (manager_id, delegate_id, starts_on, ends_on, created_by)
  values (v_manager, p_delegate, p_starts, p_ends, auth.uid())
  on conflict (manager_id) do update
     set delegate_id = excluded.delegate_id, starts_on = excluded.starts_on,
         ends_on = excluded.ends_on, created_by = excluded.created_by, created_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.clear_backup_approver(p_manager uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_manager uuid := coalesce(p_manager, auth.uid());
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if v_manager <> auth.uid() and not public.current_is_admin() then
    raise exception 'Only admins can change someone else''s backup approver.';
  end if;
  delete from public.approval_delegates where manager_id = v_manager;
end;
$$;

-- 3. Wider read access: whole team, plus people I'm backing up for. ----------
drop policy if exists "read my team and the teams I back up" on public.profiles;
create policy "read my team and the teams I back up"
  on public.profiles for select
  using (public.is_in_my_team(id) or public.can_review(id));

drop policy if exists "read own, reports, or all" on public.days;
create policy "read own, reports, or all"
  on public.days for select
  using (
    user_id = auth.uid()
    or public.is_in_my_team(user_id)
    or public.can_review(user_id)
    or public.current_role_is('executive')
    or public.current_is_admin()
  );

-- 4. Project-list permission a manager can grant. ----------------------------
alter table public.profiles
  add column if not exists can_manage_projects boolean not null default false;

create or replace function public.current_can_manage_projects()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin or role = 'manager' or can_manage_projects
       from public.profiles where id = auth.uid() and active),
    false);
$$;

-- Managers set it for their direct reports; admins for anyone.
create or replace function public.set_project_permission(p_person uuid, p_allowed boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not (public.current_is_admin() or public.is_my_report(p_person)) then
    raise exception 'You can only change this for people who report to you.';
  end if;
  update public.profiles set can_manage_projects = coalesce(p_allowed, false) where id = p_person;
  if not found then raise exception 'That person wasn''t found.'; end if;
end;
$$;

-- 5. Task-level review notes. ------------------------------------------------
-- A snapshot of the tasks the reviewer pointed at: [{description, note}].
-- Kept on the day (not the task) so it survives the person editing tasks.
alter table public.days
  add column if not exists review_tasks jsonb not null default '[]'::jsonb;

create or replace function public.approve_days(p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  update public.days
     set state = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = '', review_tasks = '[]'::jsonb, updated_at = now()
   where id = any(p_ids)
     and state = 'submitted'
     and public.can_review(user_id);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- p_task_notes: [{task_id, note}] for the tasks that need changing (optional).
drop function if exists public.return_day(uuid, text);
create or replace function public.return_day(p_id uuid, p_reason text, p_task_notes jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_tasks jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Say why you''re sending it back.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('description', t.description, 'note', trim(coalesce(n.elem ->> 'note', '')))
                            order by t.position), '[]'::jsonb)
    into v_tasks
    from jsonb_array_elements(coalesce(p_task_notes, '[]'::jsonb)) as n(elem)
    join public.tasks t on t.id = nullif(n.elem ->> 'task_id', '')::uuid and t.day_id = p_id;

  update public.days
     set state = 'returned', reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = trim(p_reason), review_tasks = v_tasks, updated_at = now()
   where id = p_id and state = 'submitted' and public.can_review(user_id);
  if not found then
    raise exception 'That day isn''t waiting for your approval any more.';
  end if;
  -- Project leads look again once it's resubmitted.
  delete from public.project_reviews where day_id = p_id;
end;
$$;

create or replace function public.reopen_day(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.current_is_admin() then raise exception 'Only admins can reopen an approved day.'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Say why you''re reopening it.';
  end if;
  update public.days
     set state = 'returned', reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = trim(p_reason), review_tasks = '[]'::jsonb, updated_at = now()
   where id = p_id and state = 'approved';
  if not found then raise exception 'That day isn''t approved.'; end if;
end;
$$;

-- 6. Project leads. ---------------------------------------------------------
-- Each project can have a lead who reviews the tasks logged on it. The line
-- manager still approves the day; the lead's review shows up next to it.
alter table public.projects
  add column if not exists lead_id uuid references public.profiles (id) on delete set null;
create index if not exists projects_lead_id_idx on public.projects (lead_id);

create table if not exists public.project_reviews (
  day_id       uuid not null references public.days (id) on delete cascade,
  project_id   uuid not null references public.projects (id) on delete cascade,
  reviewer_id  uuid references public.profiles (id) on delete set null,
  status       text not null check (status in ('ok', 'flagged')),
  note         text not null default '',
  reviewed_at  timestamptz not null default now(),
  primary key (day_id, project_id),
  constraint project_reviews_flag_needs_note check (status <> 'flagged' or length(trim(note)) > 0)
);

alter table public.project_reviews enable row level security;
-- Anyone who can see the day (the person, their managers, leadership, admins)
-- sees its project reviews; leads see the reviews on their projects.
drop policy if exists "read reviews of visible days" on public.project_reviews;
create policy "read reviews of visible days"
  on public.project_reviews for select
  using (
    exists (select 1 from public.days d where d.id = day_id)
    or exists (select 1 from public.projects pr where pr.id = project_id and pr.lead_id = auth.uid())
  );
-- Writes go through review_project_tasks().

-- Days with tasks on projects I lead, from p_from on, with only those tasks.
create or replace function public.project_review_queue(p_from date)
returns table (
  day_id uuid, work_date date, person_id uuid, person_name text, day_state public.day_state,
  project_id uuid, project_name text, tasks jsonb, review_status text, review_note text
)
language sql stable security definer set search_path = public as $$
  select d.id, d.work_date, d.user_id, coalesce(nullif(pf.full_name, ''), pf.email), d.state,
         pr.id, pr.name,
         jsonb_agg(jsonb_build_object('id', t.id, 'description', t.description, 'hours', t.hours,
                                      'status', t.status, 'blocker', t.blocker) order by t.position),
         rv.status, coalesce(rv.note, '')
    from public.projects pr
    join public.tasks t on t.project_id = pr.id
    join public.days d on d.id = t.day_id
    join public.profiles pf on pf.id = d.user_id
    left join public.project_reviews rv on rv.day_id = d.id and rv.project_id = pr.id
   where pr.lead_id = auth.uid()
     and d.state in ('submitted', 'approved', 'returned')
     and d.work_date >= p_from
     and d.user_id <> auth.uid()
   group by d.id, d.work_date, d.user_id, pf.full_name, pf.email, d.state, pr.id, pr.name, rv.status, rv.note
   order by d.work_date desc, pr.name, 4;
$$;

-- Mark a day's tasks on my project as fine, or flag them with a note.
create or replace function public.review_project_tasks(p_day uuid, p_project uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from public.projects where id = p_project and lead_id = auth.uid()) then
    raise exception 'You''re not the lead on that project.';
  end if;
  if not exists (
    select 1 from public.tasks t join public.days d on d.id = t.day_id
     where t.day_id = p_day and t.project_id = p_project and d.user_id <> auth.uid()) then
    raise exception 'That day has no tasks on your project.';
  end if;
  if p_status = 'flagged' and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Say what needs a look.';
  end if;
  if p_status is null or p_status = '' then
    delete from public.project_reviews where day_id = p_day and project_id = p_project;
    return;
  end if;
  insert into public.project_reviews (day_id, project_id, reviewer_id, status, note)
  values (p_day, p_project, auth.uid(), p_status, trim(coalesce(p_note, '')))
  on conflict (day_id, project_id) do update
     set reviewer_id = excluded.reviewer_id, status = excluded.status,
         note = excluded.note, reviewed_at = now();
end;
$$;

-- 7. Grants (Supabase's API roles need these for new tables and functions). --
grant select on public.approval_delegates to authenticated;
grant all on public.approval_delegates to service_role;
grant execute on function public.is_in_my_team(uuid) to authenticated, service_role;
grant execute on function public.can_review(uuid) to authenticated, service_role;
grant execute on function public.set_backup_approver(uuid, date, date, uuid) to authenticated, service_role;
grant execute on function public.clear_backup_approver(uuid) to authenticated, service_role;
grant execute on function public.set_project_permission(uuid, boolean) to authenticated, service_role;
grant execute on function public.approve_days(uuid[]) to authenticated, service_role;
grant execute on function public.return_day(uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.reopen_day(uuid, text) to authenticated, service_role;
grant select on public.project_reviews to authenticated;
grant all on public.project_reviews to service_role;
grant execute on function public.project_review_queue(date) to authenticated, service_role;
grant execute on function public.review_project_tasks(uuid, uuid, text, text) to authenticated, service_role;

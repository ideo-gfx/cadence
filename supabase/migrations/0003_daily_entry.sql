-- Phase 3: daily entry. Each person logs one day at a time: a day status
-- (working, leave, holiday...), an optional note, and a list of tasks.

-- The team works in India; "today" is the date in Asia/Kolkata.
create or replace function public.team_today()
returns date language sql stable as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- Projects and clients people pick from. Admins and managers keep the list.
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create unique index projects_name_key on public.projects (lower(name));

create or replace function public.current_can_manage_projects()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin or role = 'manager' from public.profiles where id = auth.uid() and active),
    false);
$$;

alter table public.projects enable row level security;

create policy "signed-in people read projects"
  on public.projects for select using (auth.uid() is not null);
create policy "admins and managers add projects"
  on public.projects for insert with check (public.current_can_manage_projects());
create policy "admins and managers edit projects"
  on public.projects for update
  using (public.current_can_manage_projects())
  with check (public.current_can_manage_projects());

-- One row per person per date.
create type public.day_status as enum ('working', 'wfh', 'half_day_leave', 'full_day_leave', 'holiday');
-- draft: still editing. submitted: waiting for the manager (locked).
-- returned: the manager sent it back (editable). approved: done (locked).
create type public.day_state as enum ('draft', 'submitted', 'returned', 'approved');

create table public.days (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  work_date     date not null,
  status        public.day_status not null default 'working',
  note          text not null default '',
  state         public.day_state not null default 'draft',
  submitted_at  timestamptz,
  reviewed_by   uuid references public.profiles (id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, work_date)
);
create index days_work_date_idx on public.days (work_date);

create type public.task_status as enum ('done', 'in_progress', 'blocked');

create table public.tasks (
  id             uuid primary key default gen_random_uuid(),
  day_id         uuid not null references public.days (id) on delete cascade,
  position       int not null default 0,
  description    text not null check (length(trim(description)) > 0),
  project_id     uuid references public.projects (id) on delete set null,
  project_other  text not null default '',
  hours          numeric(4, 2) not null check (hours > 0 and hours <= 24 and mod(hours * 4, 1) = 0),
  status         public.task_status not null default 'done',
  blocker        text not null default '',
  constraint tasks_blocked_needs_note check (status <> 'blocked' or length(trim(blocker)) > 0)
);
create index tasks_day_id_idx on public.tasks (day_id);

-- Is this person someone I manage directly?
create or replace function public.is_my_report(person uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = person and manager_id = auth.uid());
$$;

alter table public.days enable row level security;
alter table public.tasks enable row level security;

-- Read: your own days, your direct reports' days, or everything for leadership and admins.
create policy "read own, reports, or all"
  on public.days for select
  using (
    user_id = auth.uid()
    or public.is_my_report(user_id)
    or public.current_role_is('executive')
    or public.current_is_admin()
  );

-- Create your own day only within the entry window (today and 7 days back).
-- Edit it only while it's a draft or was sent back. Submitting is allowed; approving isn't.
create policy "create own day in window"
  on public.days for insert
  with check (
    user_id = auth.uid()
    and work_date between public.team_today() - 7 and public.team_today()
    and state in ('draft', 'submitted')
  );
create policy "edit own open day"
  on public.days for update
  using (user_id = auth.uid() and state in ('draft', 'returned'))
  with check (user_id = auth.uid() and state in ('draft', 'returned', 'submitted'));

create policy "read tasks of visible days"
  on public.tasks for select
  using (exists (select 1 from public.days d where d.id = day_id));

create or replace function public.day_is_mine_and_open(d uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.days
    where id = d and user_id = auth.uid() and state in ('draft', 'returned'));
$$;

create policy "write tasks of own open day"
  on public.tasks for all
  using (public.day_is_mine_and_open(day_id))
  with check (public.day_is_mine_and_open(day_id));

-- Save a whole day in one go: day fields plus the full task list, replacing
-- what was there. Runs as the caller, so every policy above still applies.
-- p_tasks: [{description, project_id, project_other, hours, status, blocker}]
create or replace function public.save_day(
  p_date date,
  p_status public.day_status,
  p_note text,
  p_tasks jsonb,
  p_submit boolean
) returns public.days
language plpgsql security invoker set search_path = public as $$
declare
  v_day public.days;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if p_date > public.team_today() then
    raise exception 'You can''t log a day in the future.';
  end if;

  select * into v_day from public.days where user_id = auth.uid() and work_date = p_date;
  if v_day.id is not null and v_day.state not in ('draft', 'returned') then
    raise exception 'This day is already submitted. Ask your manager to send it back to change it.';
  end if;
  -- A day your manager sent back can always be fixed; otherwise stay in the window.
  if (v_day.id is null or v_day.state = 'draft') and p_date < public.team_today() - 7 then
    raise exception 'You can only log the last 7 days.';
  end if;

  if v_day.id is null then
    insert into public.days (user_id, work_date, status, note)
    values (auth.uid(), p_date, p_status, coalesce(p_note, ''))
    returning * into v_day;
  else
    update public.days
       set status = p_status, note = coalesce(p_note, ''), updated_at = now()
     where id = v_day.id
    returning * into v_day;
  end if;

  delete from public.tasks where day_id = v_day.id;
  insert into public.tasks (day_id, position, description, project_id, project_other, hours, status, blocker)
  select v_day.id,
         t.ord - 1,
         trim(t.elem ->> 'description'),
         nullif(t.elem ->> 'project_id', '')::uuid,
         trim(coalesce(t.elem ->> 'project_other', '')),
         (t.elem ->> 'hours')::numeric,
         (t.elem ->> 'status')::public.task_status,
         trim(coalesce(t.elem ->> 'blocker', ''))
    from jsonb_array_elements(coalesce(p_tasks, '[]'::jsonb)) with ordinality as t(elem, ord);

  if p_submit then
    if p_status not in ('full_day_leave', 'holiday')
       and not exists (select 1 from public.tasks where day_id = v_day.id) then
      raise exception 'Add at least one task before submitting.';
    end if;
    update public.days
       set state = 'submitted', submitted_at = now(), updated_at = now()
     where id = v_day.id
    returning * into v_day;
  end if;

  return v_day;
end;
$$;

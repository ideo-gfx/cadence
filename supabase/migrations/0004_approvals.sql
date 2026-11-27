-- Phase 4: manager approval. Managers approve or send back their direct
-- reports' submitted days. Admins can reopen an approved day. People with
-- nobody to report to have their day approved as soon as they submit.
-- All changes go through these functions; nobody updates days.state directly.

-- Approve submitted days of my direct reports. Returns how many were approved.
create or replace function public.approve_days(p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare
  n int;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  update public.days
     set state = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = '', updated_at = now()
   where id = any(p_ids)
     and state = 'submitted'
     and public.is_my_report(user_id);
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Send a submitted day back to the person with a reason, so they can fix it.
create or replace function public.return_day(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Say why you''re sending it back.';
  end if;
  update public.days
     set state = 'returned', reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = trim(p_reason), updated_at = now()
   where id = p_id and state = 'submitted' and public.is_my_report(user_id);
  if not found then
    raise exception 'That day isn''t waiting for your approval any more.';
  end if;
end;
$$;

-- Admins only: reopen an approved day so the person can correct it.
create or replace function public.reopen_day(p_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.current_is_admin() then raise exception 'Only admins can reopen an approved day.'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Say why you''re reopening it.';
  end if;
  update public.days
     set state = 'returned', reviewed_by = auth.uid(), reviewed_at = now(),
         review_note = trim(p_reason), updated_at = now()
   where id = p_id and state = 'approved';
  if not found then raise exception 'That day isn''t approved.'; end if;
end;
$$;

-- Approve my own just-submitted day when I report to nobody.
create or replace function public.approve_own_if_no_manager(p_id uuid)
returns public.days language plpgsql security definer set search_path = public as $$
declare
  v_day public.days;
begin
  update public.days d
     set state = 'approved', reviewed_by = null, reviewed_at = now(), review_note = '', updated_at = now()
   where d.id = p_id
     and d.user_id = auth.uid()
     and d.state = 'submitted'
     and (select manager_id from public.profiles where id = auth.uid()) is null
  returning d.* into v_day;
  if v_day.id is null then
    select * into v_day from public.days where id = p_id and user_id = auth.uid();
  end if;
  return v_day;
end;
$$;

-- save_day as in 0003, plus the auto-approval above on submit.
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
    v_day := public.approve_own_if_no_manager(v_day.id);
  end if;

  return v_day;
end;
$$;

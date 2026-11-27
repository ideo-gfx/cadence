-- Step 1: people, roles and reporting lines.
create type public.user_role as enum ('employee', 'manager', 'executive');

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  full_name   text not null default '',
  role        public.user_role not null default 'employee',
  manager_id  uuid references public.profiles (id) on delete set null,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index profiles_manager_id_idx on public.profiles (manager_id);

-- Create a profile automatically when an account is invited/created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used by policies (security definer avoids recursive RLS checks).
create or replace function public.current_role_is(r public.user_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = r);
$$;

create or replace function public.current_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

alter table public.profiles enable row level security;

-- Everyone sees their own profile; managers see their direct reports;
-- executives and admins see everyone.
create policy "read own, reports, or all for executives"
  on public.profiles for select
  using (
    id = auth.uid()
    or manager_id = auth.uid()
    or public.current_role_is('executive')
    or public.current_is_admin()
  );

-- Only admins change roles and reporting lines.
create policy "admins manage profiles"
  on public.profiles for update
  using (public.current_is_admin())
  with check (public.current_is_admin());

-- Table and function permissions for Supabase's API roles.
-- Newer Supabase projects don't grant these automatically to tables made in
-- the SQL Editor, which showed up as "permission denied for table profiles"
-- right after sign-in. Row-level security still decides which rows each
-- person can see or change; these grants only let the API reach the tables.
-- Safe to run more than once.

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Tables and functions added by later migrations get the same access.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public grant execute on functions to authenticated, service_role;

# Cadence

Employees log daily tasks, hours and leave. Reporting managers approve their team's day, and an approved summary is emailed to leadership.

Stack: Next.js (App Router) · Supabase (Postgres + email sign-in) · Vercel · Resend.

## Status

- [x] Step 1: Foundation and sign-in (roles: employee, manager, executive; reporting lines)
- [ ] Step 2: Daily entry screen
- [ ] Step 3: Manager approval
- [ ] Step 4: Daily report email + pilot

## Setup

1. Create a free project at supabase.com.
2. In the Supabase SQL editor, run `supabase/migrations/0001_profiles.sql`.
3. Supabase > Authentication > URL Configuration: set Site URL to your app URL and add `<app URL>/auth/callback` to Redirect URLs.
4. Copy `.env.example` to `.env.local` and fill in the values from Supabase > Project Settings > API.
5. `npm install && npm run dev`, then open http://localhost:3000.

## Adding people

Sign-in is invite-only. In Supabase > Authentication > Users, click **Invite user** for each person. A profile row is created automatically. Then in Table Editor > `profiles`, set each person's `full_name`, `role` and `manager_id` (the manager's profile id). Tick `is_admin` for whoever manages the team list.

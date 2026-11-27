# Cadence

Employees log daily tasks, hours and leave. Reporting managers approve their team's day, and an approved summary is emailed to leadership.

Stack: Next.js (App Router) · Supabase (Postgres + email sign-in) · Vercel · Resend.

## Status

- [x] Phase 1: Foundation and sign-in (roles: employee, manager, leadership; reporting lines)
- [x] Phase 2: Go live (People screen for admins, deploy setup below)
- [ ] Phase 3: Daily entry
- [ ] Phase 4: Manager approval
- [ ] Phase 5: Daily report email and reminders
- [ ] Phase 6: Pilot with the IDEO Graphics team
- [ ] Phase 7: Leave tracking and insights

## Go live, step by step

You need free accounts on Supabase, Vercel and Resend, and access to add DNS records to the email domain.

### 1. Supabase (database and sign-in)

1. Create a project at supabase.com. Pick the region closest to the team.
2. SQL Editor: run each file in `supabase/migrations/` in order (`0001_…`, then `0002_…`).
3. Project Settings > API: copy the **Project URL**, the **anon** key and the **service_role** key. Keep the service_role key secret.

### 2. Resend (email)

1. At resend.com, add the domain you'll send from (for example `yourcompany.com`) and add the DNS records it shows. Wait until it says **Verified**.
2. Create an API key.
3. Supabase > Authentication > Emails > SMTP Settings: turn on custom SMTP with
   host `smtp.resend.com`, port `465`, username `resend`, password = the Resend API key,
   sender `cadence@yourcompany.com`, sender name `Cadence`.
   Supabase's built-in sender only allows a few emails an hour, so sign-in links need this.

### 3. Vercel (hosting)

1. At vercel.com, **Add New > Project** and import the `cadence` GitHub repo.
2. Add these environment variables (values from step 1), then **Deploy**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` = the address Vercel gives you, such as `https://cadence-xyz.vercel.app`
3. Back in Supabase > Authentication > URL Configuration: set **Site URL** to that address and add `<address>/auth/callback` to **Redirect URLs**.

### 4. First admin

1. Supabase > Authentication > Users > **Add user > Create new user**, with your email and **Auto Confirm User** ticked.
2. Table Editor > `profiles`: fill in your `full_name`, set `role`, and tick `is_admin`.
3. Open the live site and sign in with your email. You'll see **People** in the header.

From then on, add everyone from the **People** screen: name, email, role and who they report to. They sign in from the login page with their email; there are no passwords. Unticking **Active** blocks someone's sign-in but keeps their history.

## Run locally

Copy `.env.example` to `.env.local`, fill in the values, then `npm install && npm run dev` and open http://localhost:3000.

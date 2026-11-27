import Link from "next/link";
import type { Profile } from "@/lib/supabase/server";

const roleLabel = { employee: "Employee", manager: "Manager", executive: "Leadership" } as const;

export function AppShell({ profile, title, children }: { profile: Profile; title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">Cadence</Link>
          <div className="flex items-center gap-3 text-sm">
            {profile.is_admin && (
              <Link href="/people" className="rounded-md px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-900">
                People
              </Link>
            )}
            <span className="text-neutral-500">
              {profile.full_name || profile.email} · {roleLabel[profile.role]}
            </span>
            <form action="/auth/signout" method="post">
              <button className="rounded-md px-2 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-900">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}

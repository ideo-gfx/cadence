import Link from "next/link";
import { homeFor, type Profile } from "@/lib/supabase/server";
import { NavLink } from "./NavLink";
import { Badge, Button, Logo } from "./ui";

const roleLabel = { employee: "Employee", manager: "Manager", executive: "Leadership" } as const;
const homeLabel = { employee: "Today", manager: "Team", executive: "Reports" } as const;

export function AppShell({
  profile,
  title,
  description,
  children,
}: {
  profile: Profile;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 z-10 border-b border-line-subtle bg-page/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <Logo />
          </Link>
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {profile.role !== "executive" && <NavLink href="/entry">Today</NavLink>}
            {profile.role !== "employee" && (
              <NavLink href={homeFor[profile.role]}>{homeLabel[profile.role]}</NavLink>
            )}
            {(profile.is_admin || profile.role === "manager") && <NavLink href="/projects">Projects</NavLink>}
            {profile.is_admin && <NavLink href="/people">People</NavLink>}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm text-fg-secondary sm:flex">
              {profile.full_name || profile.email}
              <Badge tone="secondary">{roleLabel[profile.role]}</Badge>
            </span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm">Sign out</Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.01em] text-fg">{title}</h1>
        {description && <p className="mt-2 text-md text-fg-secondary">{description}</p>}
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

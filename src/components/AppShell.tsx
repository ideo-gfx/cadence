import Link from "next/link";
import { canEditProjects, homeFor, type Profile } from "@/lib/supabase/server";
import { NavLink } from "./NavLink";
import { Badge, Button, Logo } from "./ui";

const roleLabel = { employee: "Employee", manager: "Manager", executive: "Leadership" } as const;
const homeLabel = { employee: "Today", manager: "Team", executive: "Reports" } as const;

/** The top bar. Rendered once by the (app) layout so it doesn't reload between screens. */
export function AppHeader({ profile }: { profile: Profile }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line-subtle bg-page/85 backdrop-blur">
      {/* Two rows: logo and account on top, the menu below. The menu scrolls
          sideways when it doesn't fit, with no visible scrollbar. */}
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="flex h-14 items-center gap-4">
          <Link href="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-focus">
            <Logo />
          </Link>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="hidden items-center gap-2 whitespace-nowrap text-sm text-fg-secondary sm:flex">
              {profile.full_name || profile.email}
              <Badge tone="primary">{roleLabel[profile.role]}</Badge>
            </span>
            <form action="/auth/signout" method="post">
              <Button variant="ghost" size="sm">Sign out</Button>
            </form>
          </div>
        </div>
        <nav className="no-scrollbar -mx-3 flex items-center gap-1 overflow-x-auto overflow-y-hidden px-0 pb-2">
          {profile.role !== "executive" && <NavLink href="/entry">Today</NavLink>}
          {profile.role !== "employee" && <NavLink href={homeFor[profile.role]}>{homeLabel[profile.role]}</NavLink>}
          {profile.role !== "manager" && (profile.is_admin || profile.backup_for.length > 0) && (
            <NavLink href="/team">Team</NavLink>
          )}
          {profile.role !== "executive" && profile.is_admin && <NavLink href="/reports">Reports</NavLink>}
          {profile.leads_projects && <NavLink href="/project-review">Project review</NavLink>}
          {canEditProjects(profile) && <NavLink href="/projects">Projects</NavLink>}
          {(profile.is_admin || profile.role === "manager") && <NavLink href="/access">Access</NavLink>}
          {profile.is_admin && <NavLink href="/people">People</NavLink>}
        </nav>
      </div>
    </header>
  );
}

/** A screen's title and body. The header comes from the (app) layout. */
export function AppShell({
  title,
  description,
  children,
}: {
  /** Kept so screens can pass it; the header reads the profile itself. */
  profile?: Profile;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.01em] text-fg">{title}</h1>
      {description && <p className="mt-2 text-md text-fg-secondary">{description}</p>}
      <div className="mt-8">{children}</div>
    </main>
  );
}

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { teamToday } from "@/lib/workday";

export type Role = "employee" | "manager" | "executive";
export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  manager_id: string | null;
  is_admin: boolean;
  active: boolean;
  can_manage_projects: boolean;
  /** Managers who made this person their backup approver for today. */
  backup_for: string[];
  /** Leads at least one project, so reviews tasks logged on it. */
  leads_projects: boolean;
};

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; middleware refreshes the session.
          }
        },
      },
    },
  );
}

export type Account =
  | { state: "signed-out" }
  | { state: "ok"; profile: Profile }
  | { state: "no-profile" | "inactive" | "error"; email: string; detail?: string };

/**
 * Who is signed in, and whether they have a usable Cadence profile.
 * Cached per request, so the layout, the page and helpers share one lookup.
 */
export const getAccount = cache(async (): Promise<Account> => {
  const supabase = await createClient();
  // getClaims checks the session token locally when the project uses signing
  // keys, instead of a round trip to Supabase Auth on every request.
  const { data: auth } = await supabase.auth.getClaims();
  const claims = auth?.claims;
  if (!claims?.sub) return { state: "signed-out" };
  const userId = claims.sub;
  const email = typeof claims.email === "string" ? claims.email : "";
  const today = teamToday();
  // One round trip for all three. The last two tables come from migration
  // 0007; before it runs they just return nothing.
  const [{ data, error }, { data: backups }, { count: leadCount }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase
      .from("approval_delegates")
      .select("manager_id")
      .eq("delegate_id", userId)
      .lte("starts_on", today)
      .gte("ends_on", today),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("lead_id", userId).eq("active", true),
  ]);
  if (error) {
    console.error("Profile lookup failed:", error.message);
    return { state: "error", email, detail: error.message };
  }
  if (!data) return { state: "no-profile", email };
  // Deactivated people can't use the app.
  if (data.active === false) return { state: "inactive", email };
  const profile: Profile = {
    ...(data as Profile),
    can_manage_projects: Boolean(data.can_manage_projects),
    backup_for: (backups ?? []).map((b) => b.manager_id as string),
    leads_projects: (leadCount ?? 0) > 0,
  };
  return { state: "ok", profile };
});

/** Signed-in user's usable profile, or null. */
export async function getProfile(): Promise<Profile | null> {
  const account = await getAccount();
  return account.state === "ok" ? account.profile : null;
}

export const homeFor: Record<Role, string> = {
  employee: "/entry",
  manager: "/team",
  executive: "/reports",
};

/** Can approve or send back someone's day: a manager, or a backup approver today. */
export const canReviewDays = (p: Profile) => p.role === "manager" || p.backup_for.length > 0;

/** Can edit the projects list. */
export const canEditProjects = (p: Profile) => p.is_admin || p.role === "manager" || p.can_manage_projects;

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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

/** Signed-in user's profile, or null when signed out. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!data) return null;
  // Deactivated people are treated as signed out.
  if (data.active === false) return null;
  const today = teamToday();
  const [{ data: backups }, { count: leadCount }] = await Promise.all([
    supabase
      .from("approval_delegates")
      .select("manager_id")
      .eq("delegate_id", user.id)
      .lte("starts_on", today)
      .gte("ends_on", today),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("lead_id", user.id).eq("active", true),
  ]);
  return {
    ...(data as Profile),
    can_manage_projects: Boolean(data.can_manage_projects),
    backup_for: (backups ?? []).map((b) => b.manager_id as string),
    leads_projects: (leadCount ?? 0) > 0,
  };
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

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export type Role = "employee" | "manager" | "executive";
export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  manager_id: string | null;
  is_admin: boolean;
  active: boolean;
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
  const profile = (data as Profile) ?? null;
  // Deactivated people are treated as signed out.
  if (profile && profile.active === false) return null;
  return profile;
}

export const homeFor: Record<Role, string> = {
  employee: "/entry",
  manager: "/team",
  executive: "/reports",
};

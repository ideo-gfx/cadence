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

export type Account =
  | { state: "signed-out" }
  | { state: "ok"; profile: Profile }
  | { state: "no-profile" | "inactive" | "error"; email: string; detail?: string };

/** Who is signed in, and whether they have a usable Cadence profile. */
export async function getAccount(): Promise<Account> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { state: "signed-out" };
  const email = user.email ?? "";
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) {
    console.error("Profile lookup failed:", error.message);
    return { state: "error", email, detail: error.message };
  }
  if (!data) return { state: "no-profile", email };
  const profile = data as Profile;
  // Deactivated people can't use the app.
  if (profile.active === false) return { state: "inactive", email };
  return { state: "ok", profile };
}

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

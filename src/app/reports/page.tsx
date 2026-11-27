import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getProfile, homeFor } from "@/lib/supabase/server";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "executive") redirect(homeFor[profile.role]);
  return (
    <AppShell profile={profile} title="Daily reports">
      <p className="text-sm text-neutral-500">Approved daily reports arrive in step 4.</p>
    </AppShell>
  );
}

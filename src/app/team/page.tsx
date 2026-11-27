import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getProfile, homeFor } from "@/lib/supabase/server";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "manager") redirect(homeFor[profile.role]);
  return (
    <AppShell profile={profile} title="Team approvals">
      <p className="text-sm text-neutral-500">Your team&apos;s daily summaries arrive in step 3.</p>
    </AppShell>
  );
}

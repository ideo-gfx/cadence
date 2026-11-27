import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/ui";
import { getProfile, homeFor } from "@/lib/supabase/server";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "employee") redirect(homeFor[profile.role]);
  return (
    <AppShell profile={profile} title="Today's tasks" description="Log what you worked on today, with hours.">
      <EmptyState title="Daily entry is coming next">You&apos;ll log today&apos;s tasks and hours here.</EmptyState>
    </AppShell>
  );
}

import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/ui";
import { getProfile, homeFor } from "@/lib/supabase/server";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (profile.role !== "manager") redirect(homeFor[profile.role]);
  return (
    <AppShell profile={profile} title="Team approvals" description="Review and approve your team's day.">
      <EmptyState title="Nothing to approve yet">Your team&apos;s daily summaries will show up here.</EmptyState>
    </AppShell>
  );
}

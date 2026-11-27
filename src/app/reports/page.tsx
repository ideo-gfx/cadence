import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/ui";
import { getProfile, homeFor } from "@/lib/supabase/server";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (profile.role !== "executive") redirect(homeFor[profile.role]);
  return (
    <AppShell profile={profile} title="Daily reports" description="Approved summaries from every team.">
      <EmptyState title="No reports yet">Approved daily reports will show up here.</EmptyState>
    </AppShell>
  );
}

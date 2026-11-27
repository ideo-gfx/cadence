import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getProfile, homeFor } from "@/lib/supabase/server";

export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "employee") redirect(homeFor[profile.role]);
  return (
    <AppShell profile={profile} title="Today's tasks">
      <p className="text-sm text-neutral-500">The daily entry form arrives in step 2.</p>
    </AppShell>
  );
}

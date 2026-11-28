import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppShell";
import { getProfile } from "@/lib/supabase/server";

// Signed-in screens share this header. It stays on screen while you move
// between screens, and only the page below it reloads.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (!profile) redirect("/");
  return (
    <div className="min-h-screen bg-page">
      <AppHeader profile={profile} />
      {children}
    </div>
  );
}

import { redirect } from "next/navigation";
import { Button, Card, Logo } from "@/components/ui";
import { getAccount, homeFor } from "@/lib/supabase/server";

const messages = {
  "no-profile": "Your sign-in worked, but there's no Cadence profile for this account yet. Ask your admin to add you on the People screen.",
  inactive: "This account has been deactivated. Ask your admin if you need access again.",
  error: "We couldn't load your profile. Try again in a moment, or ask your admin.",
} as const;

export default async function Home() {
  const account = await getAccount();
  if (account.state === "signed-out") redirect("/login");
  if (account.state === "ok") redirect(homeFor[account.profile.role]);

  // Signed in, but no usable profile: explain instead of looping back to sign-in.
  return (
    <main className="grid min-h-screen place-items-center bg-page px-4">
      <div className="w-full max-w-sm">
        <Logo className="text-xl" />
        <Card className="mt-6 space-y-4 p-5">
          <p className="text-sm text-fg">{messages[account.state]}</p>
          <p className="text-xs text-fg-secondary">
            Signed in as {account.email}
            {account.detail ? ` · ${account.detail}` : ""}
          </p>
          <form action="/auth/signout" method="post">
            <Button variant="secondary" size="sm">Sign out</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}

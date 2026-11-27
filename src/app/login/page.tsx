"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Logo, Notice } from "@/components/ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Only people an admin has added can sign in.
        shouldCreateUser: false,
        // Same site the person is on: the sign-in check is stored there.
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      // Supabase refuses sign-ups for unknown emails; show other errors as-is.
      const unknown = /signups? not allowed|user not found/i.test(error.message);
      setError(unknown ? "We couldn't find that email. Ask your admin to add you." : error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-page px-4">
      {/* Meld's soft brand glow behind the sign-in card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(188,73,137,0.15)_0%,rgba(57,64,154,0.18)_50%,transparent_80%)]"
      />
      <div className="relative w-full max-w-sm">
        <Logo className="text-xl" />
        <h1 className="mt-8 text-2xl font-semibold leading-tight tracking-tight text-fg">Sign in</h1>
        <p className="mt-1 text-sm text-fg-secondary">Use your work email. We&apos;ll send you a link.</p>

        <Card className="mt-6 p-5 shadow-meld-md">
          {status === "sent" ? (
            <p className="text-sm text-fg">
              Check <strong className="font-semibold">{email}</strong> for a sign-in link.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-3">
              <Input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                aria-label="Work email"
              />
              <Button fullWidth disabled={status === "sending"}>
                {status === "sending" ? "Sending…" : "Send sign-in link"}
              </Button>
              {status === "error" && <Notice tone="danger">{error}</Notice>}
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}

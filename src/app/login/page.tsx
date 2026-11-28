"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Logo, Notice } from "@/components/ui";

// Temporary for testing: email + password sign-in. Email-link sign-in comes
// back once email sending (Resend on our own domain) is set up.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        /invalid login credentials/i.test(error.message)
          ? "That email and password don't match. Ask your admin if you need a new password."
          : error.message,
      );
      setBusy(false);
      return;
    }
    // A full page load makes sure the new session cookie reaches the server
    // (a client-side navigation can reuse a cached redirect to /login).
    window.location.assign("/");
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-page px-4">
      {/* Soft Cadence brand glow behind the sign-in card. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[image:var(--brand-glow)]" />
      <div className="relative w-full max-w-sm">
        <Logo className="text-2xl" />
        <p className="mt-2 text-sm text-muted">The rhythm of work.</p>
        <h1 className="mt-8 text-2xl font-semibold leading-tight tracking-tight text-fg">Sign in</h1>
        <p className="mt-1 text-sm text-fg-secondary">Use your work email and password.</p>

        <Card className="mt-6 p-5 shadow-meld-md">
          <form onSubmit={onSubmit} className="space-y-3">
            <Input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              aria-label="Work email"
            />
            <Input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Password"
            />
            <Button fullWidth disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </Button>
            {error && <Notice tone="danger">{error}</Notice>}
          </form>
        </Card>
      </div>
    </main>
  );
}

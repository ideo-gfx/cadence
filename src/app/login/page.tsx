"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Temporary for testing: email + password sign-in. Email-link sign-in comes
// back once email sending (Resend on our own domain) is set up.
export default function LoginPage() {
  const router = useRouter();
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
    router.replace("/");
    router.refresh();
  }

  const input =
    "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2.5 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100";

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Cadence</h1>
        <p className="mt-1 text-sm text-neutral-500">Sign in with your work email and password.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <input
            type="email"
            required
            autoFocus
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            aria-label="Email"
            className={input}
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            className={input}
          />
          <button
            disabled={busy}
            className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </form>
      </div>
    </main>
  );
}

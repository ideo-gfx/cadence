"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  // Explain why a sign-in link didn't work (set by /auth/callback).
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("error");
    if (!reason) return;
    setError(
      reason === "browser"
        ? "Open the sign-in link in the same browser you requested it from, then try again."
        : "That sign-in link has expired or was already used. Request a new one.",
    );
    setStatus("error");
  }, []);

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
    <main className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Cadence</h1>
        <p className="mt-1 text-sm text-neutral-500">Sign in with your work email.</p>

        {status === "sent" ? (
          <p className="mt-8 rounded-lg bg-neutral-100 p-4 text-sm dark:bg-neutral-900">
            Check <strong>{email}</strong> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2.5 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100"
            />
            <button
              disabled={status === "sending"}
              className="w-full rounded-lg bg-neutral-900 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </button>
            {status === "error" && <p className="text-sm text-red-600">{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}

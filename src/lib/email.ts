import { Resend } from "resend";

/**
 * Email goes out only when EMAIL_ENABLED=true and Resend is configured
 * (RESEND_API_KEY, EMAIL_FROM such as "Cadence <cadence@ideogfx.com>").
 * Otherwise sends are skipped and logged, so everything else still works.
 */
export function emailConfigured() {
  return process.env.EMAIL_ENABLED === "true" && !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM;
}

export type Email = { to: string[]; subject: string; html: string; text: string };

export async function sendEmail(email: Email): Promise<{ sent: boolean; error?: string }> {
  if (email.to.length === 0) return { sent: false, error: "No recipients." };
  if (!emailConfigured()) {
    console.log(`[email off] would send "${email.subject}" to ${email.to.length} recipient(s)`);
    return { sent: false };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  // One message per recipient so people don't see each other's addresses.
  // Resend takes up to 100 messages per batch.
  for (let i = 0; i < email.to.length; i += 100) {
    const { error } = await resend.batch.send(
      email.to
        .slice(i, i + 100)
        .map((to) => ({ from: process.env.EMAIL_FROM!, to, subject: email.subject, html: email.html, text: email.text })),
    );
    if (error) return { sent: false, error: error.message };
  }
  return { sent: true };
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "https://cadenceforideo.vercel.app").replace(/\/$/, "");

/** Escapes text for use inside HTML. */
export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

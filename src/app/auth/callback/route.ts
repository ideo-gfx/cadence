import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let reason = "link";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/`);
    console.error("Sign-in link failed:", error.message);
    // The sign-in check is stored in the browser that asked for the link.
    reason = /verifier/i.test(error.message) ? "browser" : "expired";
  }
  return NextResponse.redirect(`${origin}/login?error=${reason}`);
}

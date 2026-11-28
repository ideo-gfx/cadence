import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { remindManagers, remindPeople, runDailyReport } from "@/lib/jobs";
import { teamToday } from "@/lib/workday";

// Called by Vercel Cron (see vercel.json). Vercel sends
// "Authorization: Bearer $CRON_SECRET"; anything else is refused.
const jobs = {
  report: runDailyReport,
  "remind-people": remindPeople,
  "remind-managers": remindManagers,
} as const;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { job } = await params;
  const run = jobs[job as keyof typeof jobs];
  if (!run) return NextResponse.json({ error: "Unknown job" }, { status: 404 });
  try {
    const result = await run(createAdminClient(), teamToday());
    console.log(`[cron] ${job}:`, result.detail);
    return NextResponse.json(result);
  } catch (e) {
    console.error(`[cron] ${job} failed:`, e);
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

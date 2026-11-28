"use server";

import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";

export type ReviewResult = { ok: boolean; message: string };

async function run(fn: string, args: Record<string, unknown>): Promise<string | null> {
  const me = await getProfile();
  if (!me) return "Your session ended. Sign in again.";
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn, args);
  return error?.message ?? null;
}

export async function approveDays(ids: string[]): Promise<ReviewResult> {
  if (ids.length === 0) return { ok: false, message: "Nothing to approve." };
  const me = await getProfile();
  if (!me) return { ok: false, message: "Your session ended. Sign in again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("approve_days", { p_ids: ids });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/team");
  const n = Number(data ?? 0);
  return { ok: true, message: n === 1 ? "Approved." : `Approved ${n} days.` };
}

export async function returnDay(
  id: string,
  reason: string,
  taskNotes: { taskId: string; note: string }[] = [],
): Promise<ReviewResult> {
  if (!reason.trim()) return { ok: false, message: "Say why you're sending it back." };
  const error = await run("return_day", {
    p_id: id,
    p_reason: reason.trim(),
    p_task_notes: taskNotes.map((t) => ({ task_id: t.taskId, note: t.note.trim() })),
  });
  if (error) return { ok: false, message: error };
  revalidatePath("/team");
  return { ok: true, message: "Sent back." };
}

export async function reopenDay(id: string, reason: string): Promise<ReviewResult> {
  if (!reason.trim()) return { ok: false, message: "Say why you're reopening it." };
  const error = await run("reopen_day", { p_id: id, p_reason: reason.trim() });
  if (error) return { ok: false, message: error };
  revalidatePath("/team");
  return { ok: true, message: "Reopened." };
}

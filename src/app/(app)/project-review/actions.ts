"use server";

import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";

export type ReviewResult = { ok: boolean; message: string };

/** Marks a day's tasks on my project as fine ("ok"), flags them, or clears my review (""). */
export async function reviewProjectTasks(
  dayId: string,
  projectId: string,
  status: "ok" | "flagged" | "",
  note: string,
): Promise<ReviewResult> {
  const me = await getProfile();
  if (!me) return { ok: false, message: "Your session ended. Sign in again." };
  if (status === "flagged" && !note.trim()) return { ok: false, message: "Say what needs a look." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_project_tasks", {
    p_day: dayId,
    p_project: projectId,
    p_status: status,
    p_note: note.trim(),
  });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/project-review");
  revalidatePath("/team");
  return { ok: true, message: status === "ok" ? "Marked as fine." : status === "flagged" ? "Flagged for the manager." : "Cleared." };
}

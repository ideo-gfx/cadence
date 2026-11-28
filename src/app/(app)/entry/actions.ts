"use server";

import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isDayOff, isIsoDate, type DayStatus, type TaskStatus } from "@/lib/workday";

export type TaskInput = {
  description: string;
  project_id: string; // "" when none, "other" when typed in
  project_other: string;
  hours: string;
  status: TaskStatus;
  blocker: string;
};

export type DayInput = {
  date: string;
  status: DayStatus;
  note: string;
  tasks: TaskInput[];
  submit: boolean;
};

export type SaveResult = { ok: boolean; message: string; errors?: Record<number, string> };

const DAY_STATUSES: DayStatus[] = ["working", "wfh", "half_day_leave", "full_day_leave", "holiday"];
const TASK_STATUSES: TaskStatus[] = ["done", "in_progress", "blocked"];

/** Checks each task row and returns a message per broken row. */
function validate(input: DayInput) {
  const errors: Record<number, string> = {};
  input.tasks.forEach((t, i) => {
    const hours = Number(t.hours);
    if (!t.description.trim()) errors[i] = "Describe the task.";
    else if (!t.hours || !Number.isFinite(hours) || hours <= 0 || hours > 24) errors[i] = "Enter hours between 0.25 and 24.";
    else if (Math.round(hours * 4) !== hours * 4) errors[i] = "Use steps of 0.25 hours (15 minutes).";
    else if (t.project_id === "other" && !t.project_other.trim()) errors[i] = "Name the project or client.";
    else if (!TASK_STATUSES.includes(t.status)) errors[i] = "Pick a status.";
    else if (t.status === "blocked" && !t.blocker.trim()) errors[i] = "Say what's blocking it.";
  });
  return errors;
}

/** Drops rows the person left completely empty. */
const isBlank = (t: TaskInput) => !t.description.trim() && !t.hours && !t.project_id && !t.blocker.trim();

export async function saveDay(input: DayInput): Promise<SaveResult> {
  const me = await getProfile();
  if (!me) return { ok: false, message: "Your session ended. Sign in again." };
  if (me.role === "executive") return { ok: false, message: "Leadership accounts don't log days." };
  if (!isIsoDate(input.date)) return { ok: false, message: "That date isn't valid." };
  if (!DAY_STATUSES.includes(input.status)) return { ok: false, message: "Pick a day status." };

  const rows = isDayOff(input.status) ? [] : input.tasks.filter((t) => !isBlank(t));
  const errors = validate({ ...input, tasks: rows });
  if (Object.keys(errors).length) {
    return { ok: false, message: "Fix the highlighted tasks first.", errors: remap(input.tasks, rows, errors) };
  }
  if (input.submit && !isDayOff(input.status) && rows.length === 0) {
    return { ok: false, message: "Add at least one task before submitting." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_day", {
    p_date: input.date,
    p_status: input.status,
    p_note: input.note.trim(),
    p_submit: input.submit,
    p_tasks: rows.map((t) => ({
      description: t.description.trim(),
      project_id: t.project_id && t.project_id !== "other" ? t.project_id : "",
      project_other: t.project_id === "other" ? t.project_other.trim() : "",
      hours: Number(t.hours),
      status: t.status,
      blocker: t.status === "blocked" ? t.blocker.trim() : "",
    })),
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/entry");
  return { ok: true, message: input.submit ? "Submitted to your manager." : "Draft saved." };
}

/** Maps row errors back to the positions shown on screen (blank rows were skipped). */
function remap(all: TaskInput[], kept: TaskInput[], errors: Record<number, string>) {
  const out: Record<number, string> = {};
  for (const [i, msg] of Object.entries(errors)) out[all.indexOf(kept[Number(i)])] = msg;
  return out;
}

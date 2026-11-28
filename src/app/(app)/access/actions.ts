"use server";

import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isIsoDate } from "@/lib/workday";

export type ActionState = { ok: boolean; message: string } | null;

async function signedIn() {
  const me = await getProfile();
  if (!me) throw new Error("Your session ended. Sign in again.");
  if (!(me.role === "manager" || me.is_admin)) throw new Error("Only managers and admins can change access.");
  return me;
}

function done(message: string): ActionState {
  revalidatePath("/access");
  revalidatePath("/team");
  return { ok: true, message };
}

/** Names (or replaces) the backup approver for my team, for a date range. */
export async function setBackupApprover(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await signedIn();
    const delegate = String(form.get("delegate_id") ?? "");
    const starts = String(form.get("starts_on") ?? "");
    const ends = String(form.get("ends_on") ?? "");
    const manager = String(form.get("manager_id") ?? "") || null;
    if (!delegate) return { ok: false, message: "Pick who will approve for you." };
    if (!isIsoDate(starts) || !isIsoDate(ends)) return { ok: false, message: "Pick a start and end date." };
    if (ends < starts) return { ok: false, message: "The end date must be on or after the start date." };
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_backup_approver", {
      p_delegate: delegate,
      p_starts: starts,
      p_ends: ends,
      p_manager: manager,
    });
    if (error) return { ok: false, message: error.message };
    return done("Backup approver saved.");
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function clearBackupApprover(managerId: string | null): Promise<ActionState> {
  try {
    await signedIn();
    const supabase = await createClient();
    const { error } = await supabase.rpc("clear_backup_approver", { p_manager: managerId });
    if (error) return { ok: false, message: error.message };
    return done("Backup approver removed.");
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Lets one of my direct reports edit the projects list, or takes it away. */
export async function setProjectPermission(personId: string, allowed: boolean): Promise<ActionState> {
  try {
    await signedIn();
    const supabase = await createClient();
    const { error } = await supabase.rpc("set_project_permission", { p_person: personId, p_allowed: allowed });
    if (error) return { ok: false, message: error.message };
    return done(allowed ? "They can now edit the projects list." : "They can no longer edit the projects list.");
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

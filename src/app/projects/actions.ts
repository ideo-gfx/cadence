"use server";

import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";

export type ActionState = { ok: boolean; message: string } | null;

async function requireEditor() {
  const me = await getProfile();
  if (!me || !(me.is_admin || me.role === "manager")) throw new Error("Only admins and managers can edit projects.");
  return me;
}

const friendly = (message: string) =>
  message.includes("projects_name_key") ? "A project with that name already exists." : message;

export async function addProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireEditor();
    const name = String(form.get("name") ?? "").trim();
    if (!name) return { ok: false, message: "Enter a name." };
    const supabase = await createClient();
    const { error } = await supabase.from("projects").insert({ name, created_by: me.id });
    if (error) return { ok: false, message: friendly(error.message) };
    revalidatePath("/projects");
    return { ok: true, message: `Added ${name}.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

export async function updateProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireEditor();
    const id = String(form.get("id") ?? "");
    const name = String(form.get("name") ?? "").trim();
    const active = form.get("active") === "on";
    if (!name) return { ok: false, message: "Enter a name." };
    const supabase = await createClient();
    const { error } = await supabase.from("projects").update({ name, active }).eq("id", id);
    if (error) return { ok: false, message: friendly(error.message) };
    revalidatePath("/projects");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

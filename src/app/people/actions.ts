"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getProfile, type Role } from "@/lib/supabase/server";

export type ActionState = { ok: boolean; message: string } | null;

const ROLES: Role[] = ["employee", "manager", "executive"];

async function requireAdmin() {
  const me = await getProfile();
  if (!me?.is_admin) throw new Error("Only admins can manage people.");
  return me;
}

function readFields(form: FormData) {
  const role = String(form.get("role") ?? "employee") as Role;
  const managerId = String(form.get("manager_id") ?? "");
  return {
    full_name: String(form.get("full_name") ?? "").trim(),
    role: ROLES.includes(role) ? role : "employee",
    manager_id: managerId || null,
  };
}

const MIN_PASSWORD = 8;

/** Adds a person with a starting password the admin shares with them. */
export async function addPerson(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await requireAdmin();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const fields = readFields(form);
    if (!email.includes("@")) return { ok: false, message: "Enter a valid email." };
    if (!fields.full_name) return { ok: false, message: "Enter their name." };
    const password = String(form.get("password") ?? "");
    if (password.length < MIN_PASSWORD) {
      return { ok: false, message: `The password needs at least ${MIN_PASSWORD} characters.` };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: { full_name: fields.full_name },
    });
    if (error || !data.user) {
      const taken = error?.message.toLowerCase().includes("already");
      return { ok: false, message: taken ? `${email} is already added.` : (error?.message ?? "Could not add them.") };
    }

    // The sign-up trigger created the profile; now set role and manager.
    const { error: updateError } = await admin
      .from("profiles")
      .update(fields)
      .eq("id", data.user.id);
    if (updateError) return { ok: false, message: updateError.message };

    revalidatePath("/people");
    return { ok: true, message: `Added ${fields.full_name}. They sign in with ${email} and the password you set.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

/** Updates name, role, manager, admin flag and active status. */
export async function updatePerson(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const me = await requireAdmin();
    const id = String(form.get("id") ?? "");
    const fields = readFields(form);
    const isAdmin = form.get("is_admin") === "on";
    const active = form.get("active") === "on";

    if (id === me.id && (!isAdmin || !active)) {
      return { ok: false, message: "You can't remove your own admin access or deactivate yourself." };
    }
    if (fields.manager_id === id) return { ok: false, message: "Someone can't report to themselves." };
    const newPassword = String(form.get("new_password") ?? "");
    if (newPassword && newPassword.length < MIN_PASSWORD) {
      return { ok: false, message: `The new password needs at least ${MIN_PASSWORD} characters.` };
    }

    // Row-level security makes sure only admins can do this update.
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ ...fields, is_admin: isAdmin, active })
      .eq("id", id);
    if (error) return { ok: false, message: error.message };

    // Block or allow sign-in to match the active flag.
    const admin = createAdminClient();
    const { error: banError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: active ? "none" : "876000h",
      ...(newPassword ? { password: newPassword } : {}),
    });
    if (banError) return { ok: false, message: banError.message };

    revalidatePath("/people");
    return { ok: true, message: newPassword ? "Saved, with the new password." : "Saved." };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

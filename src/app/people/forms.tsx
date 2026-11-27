"use client";

import { useActionState } from "react";
import type { Profile } from "@/lib/supabase/server";
import { addPerson, updatePerson, type ActionState } from "./actions";

type Manager = { id: string; name: string };

const input =
  "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-100";
const button =
  "rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900";

function RoleSelect({ value }: { value?: string }) {
  return (
    <select name="role" defaultValue={value ?? "employee"} className={input} aria-label="Role">
      <option value="employee">Employee</option>
      <option value="manager">Manager</option>
      <option value="executive">Leadership</option>
    </select>
  );
}

function ManagerSelect({ managers, value }: { managers: Manager[]; value?: string | null }) {
  return (
    <select name="manager_id" defaultValue={value ?? ""} className={input} aria-label="Reports to">
      <option value="">Reports to nobody</option>
      {managers.map((m) => (
        <option key={m.id} value={m.id}>
          Reports to {m.name}
        </option>
      ))}
    </select>
  );
}

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return (
    <p role="status" className={`text-sm ${state.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}`}>
      {state.message}
    </p>
  );
}

export function AddPersonForm({ managers }: { managers: Manager[] }) {
  const [state, action, pending] = useActionState(addPerson, null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="full_name" required placeholder="Full name" className={input} aria-label="Full name" />
        <input name="email" type="email" required placeholder="name@company.com" className={input} aria-label="Email" />
        <RoleSelect />
        <ManagerSelect managers={managers} />
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className={button}>
          {pending ? "Adding…" : "Add person"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function PersonRow({ person, isSelf, managers }: { person: Profile; isSelf: boolean; managers: Manager[] }) {
  const [state, action, pending] = useActionState(updatePerson, null);
  return (
    <form action={action} className={`space-y-3 ${person.active ? "" : "opacity-60"}`}>
      <input type="hidden" name="id" value={person.id} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-neutral-500">{person.email}</span>
        {!person.active && <span className="text-xs text-neutral-500">Inactive</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input name="full_name" defaultValue={person.full_name} placeholder="Full name" className={input} aria-label="Full name" />
        <RoleSelect value={person.role} />
        <ManagerSelect managers={managers} value={person.manager_id} />
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="is_admin" defaultChecked={person.is_admin} disabled={isSelf} />
          Admin
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={person.active} disabled={isSelf} />
          Active
        </label>
        {/* Disabled checkboxes aren't submitted, so keep your own flags on. */}
        {isSelf && (
          <>
            <input type="hidden" name="is_admin" value="on" />
            <input type="hidden" name="active" value="on" />
          </>
        )}
        <button disabled={pending} className={button}>
          {pending ? "Saving…" : "Save"}
        </button>
        <Status state={state} />
      </div>
    </form>
  );
}

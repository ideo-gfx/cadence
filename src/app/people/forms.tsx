"use client";

import { useActionState } from "react";
import { Badge, Button, Checkbox, Input, Notice, Select, cx } from "@/components/ui";
import type { Profile } from "@/lib/supabase/server";
import { addPerson, updatePerson, type ActionState } from "./actions";

type Manager = { id: string; name: string };

function RoleSelect({ value }: { value?: string }) {
  return (
    <Select name="role" defaultValue={value ?? "employee"} aria-label="Role">
      <option value="employee">Employee</option>
      <option value="manager">Manager</option>
      <option value="executive">Leadership</option>
    </Select>
  );
}

function ManagerSelect({ managers, value }: { managers: Manager[]; value?: string | null }) {
  return (
    <Select name="manager_id" defaultValue={value ?? ""} aria-label="Reports to">
      <option value="">Reports to nobody</option>
      {managers.map((m) => (
        <option key={m.id} value={m.id}>
          Reports to {m.name}
        </option>
      ))}
    </Select>
  );
}

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>;
}

export function AddPersonForm({ managers }: { managers: Manager[] }) {
  const [state, action, pending] = useActionState(addPerson, null);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input name="full_name" required placeholder="Full name" aria-label="Full name" />
        <Input name="email" type="email" required placeholder="name@company.com" aria-label="Email" />
        <Input name="password" type="text" required minLength={8} autoComplete="off" placeholder="Starting password (8+ characters)" aria-label="Starting password" />
        <RoleSelect />
        <ManagerSelect managers={managers} />
      </div>
      <div className="flex items-center gap-3">
        <Button disabled={pending}>{pending ? "Adding…" : "Add person"}</Button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function PersonRow({ person, isSelf, managers }: { person: Profile; isSelf: boolean; managers: Manager[] }) {
  const [state, action, pending] = useActionState(updatePerson, null);
  return (
    <form action={action} className={cx("space-y-3", !person.active && "opacity-60")}>
      <input type="hidden" name="id" value={person.id} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-fg">{person.email}</span>
        <span className="flex gap-1.5">
          {person.is_admin && <Badge tone="primary">Admin</Badge>}
          {!person.active && <Badge>Inactive</Badge>}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input name="full_name" defaultValue={person.full_name} placeholder="Full name" aria-label="Full name" />
        <RoleSelect value={person.role} />
        <ManagerSelect managers={managers} value={person.manager_id} />
        <Input name="new_password" type="text" minLength={8} autoComplete="off" placeholder="New password (leave empty to keep)" className="sm:col-span-3" aria-label="New password" />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Checkbox name="is_admin" defaultChecked={person.is_admin} disabled={isSelf} label="Admin" />
        <Checkbox name="active" defaultChecked={person.active} disabled={isSelf} label="Active" />
        {/* Disabled checkboxes aren't submitted, so keep your own flags on. */}
        {isSelf && (
          <>
            <input type="hidden" name="is_admin" value="on" />
            <input type="hidden" name="active" value="on" />
          </>
        )}
        <Button variant="secondary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Status state={state} />
      </div>
    </form>
  );
}

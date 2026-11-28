"use client";

import { useActionState } from "react";
import { Button, Checkbox, Input, Notice, Select, cx } from "@/components/ui";
import { addProject, updateProject, type ActionState } from "./actions";

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>;
}

export function AddProjectForm() {
  const [state, action, pending] = useActionState(addProject, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <Input name="name" required placeholder="Project or client name" aria-label="Project or client name" className="sm:max-w-sm" />
      <Button disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
      <Status state={state} />
    </form>
  );
}

export type Lead = { id: string; name: string };

export function ProjectRow({
  project,
  leads,
}: {
  project: { id: string; name: string; active: boolean; lead_id: string | null };
  leads: Lead[];
}) {
  const [state, action, pending] = useActionState(updateProject, null);
  return (
    <form action={action} className={cx("flex flex-wrap items-center gap-3", !project.active && "opacity-60")}>
      <input type="hidden" name="id" value={project.id} />
      <Input name="name" defaultValue={project.name} aria-label="Name" className="sm:max-w-sm" />
      <Select name="lead_id" defaultValue={project.lead_id ?? ""} aria-label="Project lead" className="sm:max-w-56">
        <option value="">No lead</option>
        {leads.map((l) => (
          <option key={l.id} value={l.id}>
            Lead: {l.name}
          </option>
        ))}
      </Select>
      <Checkbox name="active" defaultChecked={project.active} label="In use" />
      <Button variant="secondary" size="sm" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      <Status state={state} />
    </form>
  );
}

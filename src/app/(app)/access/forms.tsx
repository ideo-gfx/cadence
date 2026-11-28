"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Checkbox, Field, Input, Notice, Select } from "@/components/ui";
import { clearBackupApprover, setBackupApprover, setProjectPermission, type ActionState } from "./actions";

type Person = { id: string; name: string };

function Status({ state }: { state: ActionState }) {
  if (!state) return null;
  return <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>;
}

export function BackupApproverForm({
  candidates,
  current,
  today,
  managerId,
}: {
  candidates: Person[];
  current: { delegateId: string; startsOn: string; endsOn: string } | null;
  today: string;
  /** Set when an admin edits another manager's backup. */
  managerId?: string;
}) {
  const [state, action, pending] = useActionState(setBackupApprover, null);
  const [removeState, setRemoveState] = useState<ActionState>(null);
  const [removing, startRemove] = useTransition();

  return (
    <form action={action} className="space-y-4">
      {managerId && <input type="hidden" name="manager_id" value={managerId} />}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <Field label="Who approves for you">
          <Select name="delegate_id" defaultValue={current?.delegateId ?? ""} required>
            <option value="" disabled>
              Pick a person
            </option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <Input name="starts_on" type="date" required defaultValue={current?.startsOn ?? today} />
        </Field>
        <Field label="Until">
          <Input name="ends_on" type="date" required min={today} defaultValue={current?.endsOn ?? ""} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={pending}>
          {pending ? "Saving…" : current ? "Update" : "Set backup approver"}
        </Button>
        {current && (
          <Button
            size="sm"
            variant="ghost"
            type="button"
            disabled={removing}
            onClick={() => startRemove(async () => setRemoveState(await clearBackupApprover(managerId ?? null)))}
          >
            {removing ? "Removing…" : "Remove"}
          </Button>
        )}
        <Status state={removeState ?? state} />
      </div>
    </form>
  );
}

export function RemoveBackupButton({ managerId }: { managerId: string }) {
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => start(async () => setState(await clearBackupApprover(managerId)))}
      >
        {pending ? "Removing…" : "Remove"}
      </Button>
      {state && !state.ok && <Notice tone="danger">{state.message}</Notice>}
    </span>
  );
}

export function ProjectPermissionToggle({
  personId,
  name,
  allowed,
}: {
  personId: string;
  name: string;
  allowed: boolean;
}) {
  const [checked, setChecked] = useState(allowed);
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        disabled={pending}
        aria-label={`${name} can edit the projects list`}
        label="Can edit projects"
        onChange={(e) => {
          const next = e.target.checked;
          setChecked(next);
          start(async () => {
            const res = await setProjectPermission(personId, next);
            setState(res);
            if (!res?.ok) setChecked(!next);
          });
        }}
      />
      {state && !state.ok && <Notice tone="danger">{state.message}</Notice>}
    </span>
  );
}

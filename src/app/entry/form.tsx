"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Card, Eyebrow, Field, Input, Notice, Select, cx } from "@/components/ui";
import {
  dayStateLabel,
  dayStatusLabel,
  expectedHours,
  formatHours,
  isDayOff,
  taskStatusLabel,
  type DayState,
  type DayStatus,
  type TaskStatus,
} from "@/lib/workday";
import { TaskList } from "@/components/TaskList";
import { saveDay, type SaveResult, type TaskInput } from "./actions";

export type Project = { id: string; name: string };
export type SavedDay = {
  status: DayStatus;
  note: string;
  state: DayState;
  reviewNote: string;
  tasks: TaskInput[];
};

const emptyTask = (): TaskInput => ({
  description: "",
  project_id: "",
  project_other: "",
  hours: "",
  status: "done",
  blocker: "",
});

const stateTone: Record<DayState, "neutral" | "primary" | "secondary" | "success"> = {
  draft: "neutral",
  submitted: "secondary",
  returned: "primary",
  approved: "success",
};

const totalOf = (tasks: TaskInput[]) => tasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);

export function DayForm({
  date,
  saved,
  editable,
  projects,
  managerName,
}: {
  date: string;
  saved: SavedDay | null;
  editable: boolean;
  projects: Project[];
  managerName: string | null;
}) {
  const [status, setStatus] = useState<DayStatus>(saved?.status ?? "working");
  const [note, setNote] = useState(saved?.note ?? "");
  const [tasks, setTasks] = useState<TaskInput[]>(saved?.tasks.length ? saved.tasks : [emptyTask()]);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmLow, setConfirmLow] = useState(false);

  const dayOff = isDayOff(status);
  const total = totalOf(tasks);
  const expected = expectedHours(status);
  const lowHours = !dayOff && total < expected;
  const projectName = (id: string) => projects.find((p) => p.id === id)?.name;

  if (!editable) return <ReadOnlyDay saved={saved} projectName={projectName} managerName={managerName} />;

  const update = (i: number, patch: Partial<TaskInput>) =>
    setTasks((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  function save(submit: boolean) {
    if (submit && lowHours && !confirmLow) {
      setConfirmLow(true);
      return;
    }
    setConfirmLow(false);
    startTransition(async () => {
      const res = await saveDay({ date, status, note, tasks, submit });
      setResult(res);
    });
  }

  return (
    <div className="space-y-6">
      {saved?.state === "returned" && (
        <Card className="border-primary/40 bg-primary-light p-4">
          <p className="text-sm font-medium text-fg">This day was sent back for changes</p>
          {saved.reviewNote && <p className="mt-1 text-sm text-fg-secondary">{saved.reviewNote}</p>}
        </Card>
      )}

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-end">
          <Field label="Day status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as DayStatus)}>
              {(Object.keys(dayStatusLabel) as DayStatus[]).map((s) => (
                <option key={s} value={s}>
                  {dayStatusLabel[s]}
                </option>
              ))}
            </Select>
          </Field>
          <p className="text-sm text-fg-secondary">
            {dayOff
              ? "No tasks needed. Submit so your manager knows."
              : status === "half_day_leave"
                ? `Log the half you worked (about ${formatHours(expected)}).`
                : `A full day is about ${formatHours(expected)}.`}
          </p>
        </div>
      </Card>

      {!dayOff && (
        <section>
          <div className="flex items-baseline justify-between">
            <Eyebrow>Tasks</Eyebrow>
            <span className={cx("text-sm font-medium", lowHours ? "text-warning" : "text-fg")}>
              {formatHours(total)} of {formatHours(expected)}
            </span>
          </div>
          <Card className="mt-3 overflow-hidden">
            <ol className="divide-y divide-line-subtle">
              {tasks.map((t, i) => (
                <TaskRow
                  key={i}
                  index={i}
                  task={t}
                  projects={projects}
                  error={result?.errors?.[i]}
                  onChange={(patch) => update(i, patch)}
                  onRemove={tasks.length > 1 ? () => setTasks((ts) => ts.filter((_, j) => j !== i)) : undefined}
                />
              ))}
            </ol>
            <div className="border-t border-line-subtle p-3">
              <Button variant="ghost" size="sm" type="button" onClick={() => setTasks((ts) => [...ts, emptyTask()])}>
                + Add task
              </Button>
            </div>
          </Card>
        </section>
      )}

      <Field label="Note for your manager (optional)">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className={cx(
            "w-full rounded-lg border border-control-line bg-control px-3 py-2 text-sm text-fg",
            "placeholder:text-placeholder transition-colors hover:border-line-interactive",
            "outline-none focus:border-focus focus:ring-3 focus:ring-focus/20",
          )}
          placeholder="Anything they should know about today"
        />
      </Field>

      <div className="space-y-3">
        {confirmLow && (
          <Card className="border-warning/40 p-4">
            <p className="text-sm text-fg">
              You&apos;ve logged {formatHours(total)}, less than the usual {formatHours(expected)}. Submit anyway?
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" type="button" disabled={pending} onClick={() => save(true)}>
                Submit anyway
              </Button>
              <Button size="sm" variant="secondary" type="button" onClick={() => setConfirmLow(false)}>
                Keep editing
              </Button>
            </div>
          </Card>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={pending} onClick={() => save(true)}>
            {pending ? "Saving…" : managerName ? `Submit to ${managerName}` : "Submit"}
          </Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => save(false)}>
            Save draft
          </Button>
          {result && <Notice tone={result.ok ? "success" : "danger"}>{result.message}</Notice>}
        </div>
        <p className="text-xs text-muted">Once submitted, the day is locked unless your manager sends it back.</p>
      </div>
    </div>
  );
}

function TaskRow({
  index,
  task,
  projects,
  error,
  onChange,
  onRemove,
}: {
  index: number;
  task: TaskInput;
  projects: Project[];
  error?: string;
  onChange: (patch: Partial<TaskInput>) => void;
  onRemove?: () => void;
}) {
  const n = index + 1;
  return (
    <li className={cx("space-y-3 p-4", error && "bg-danger/5")}>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <Input
          value={task.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="What did you work on?"
          aria-label={`Task ${n} description`}
        />
        <Select
          value={task.project_id}
          onChange={(e) => onChange({ project_id: e.target.value })}
          aria-label={`Task ${n} project or client`}
        >
          <option value="">No project</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="other">Other…</option>
        </Select>
      </div>
      {task.project_id === "other" && (
        <Input
          value={task.project_other}
          onChange={(e) => onChange({ project_other: e.target.value })}
          placeholder="Project or client name"
          aria-label={`Task ${n} other project`}
        />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-32 items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            min={0.25}
            max={24}
            step={0.25}
            value={task.hours}
            onChange={(e) => onChange({ hours: e.target.value })}
            placeholder="0"
            aria-label={`Task ${n} hours`}
          />
          <span className="text-sm text-muted">hours</span>
        </div>
        <div className="w-40">
          <Select
            value={task.status}
            onChange={(e) => onChange({ status: e.target.value as TaskStatus })}
            aria-label={`Task ${n} status`}
          >
            {(Object.keys(taskStatusLabel) as TaskStatus[]).map((s) => (
              <option key={s} value={s}>
                {taskStatusLabel[s]}
              </option>
            ))}
          </Select>
        </div>
        {onRemove && (
          <Button variant="ghost" size="sm" type="button" onClick={onRemove} className="ml-auto" aria-label={`Remove task ${n}`}>
            Remove
          </Button>
        )}
      </div>
      {task.status === "blocked" && (
        <Input
          value={task.blocker}
          onChange={(e) => onChange({ blocker: e.target.value })}
          placeholder="What's blocking it?"
          aria-label={`Task ${n} blocker`}
        />
      )}
      {error && <Notice tone="danger">{error}</Notice>}
    </li>
  );
}

function ReadOnlyDay({
  saved,
  projectName,
  managerName,
}: {
  saved: SavedDay | null;
  projectName: (id: string) => string | undefined;
  managerName: string | null;
}) {
  if (!saved) {
    return (
      <Card className="p-5">
        <p className="text-sm text-fg-secondary">Nothing was logged for this day, and it&apos;s too far back to add now.</p>
      </Card>
    );
  }
  const total = totalOf(saved.tasks);
  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-3 p-5">
        <Badge tone={stateTone[saved.state]}>{dayStateLabel[saved.state]}</Badge>
        <span className="text-sm text-fg">{dayStatusLabel[saved.status]}</span>
        {!isDayOff(saved.status) && <span className="text-sm text-fg-secondary">{formatHours(total)} logged</span>}
        <span className="text-sm text-muted sm:ml-auto">
          {saved.state === "approved"
            ? `Approved${managerName ? ` by ${managerName}` : ""}`
            : `Waiting for ${managerName ?? "approval"}`}
        </span>
      </Card>
      {saved.tasks.length > 0 && (
        <Card className="overflow-hidden">
          <TaskList
            tasks={saved.tasks.map((t) => ({
              description: t.description,
              project: t.project_id === "other" ? t.project_other : t.project_id ? (projectName(t.project_id) ?? "") : "",
              hours: Number(t.hours),
              status: t.status,
              blocker: t.blocker,
            }))}
          />
        </Card>
      )}
      {saved.note && (
        <div>
          <Eyebrow>Note</Eyebrow>
          <p className="mt-2 text-sm text-fg-secondary">{saved.note}</p>
        </div>
      )}
    </div>
  );
}

import { formatHours, taskStatusLabel, type TaskStatus } from "@/lib/workday";
import { Badge } from "./ui";

export type TaskView = {
  description: string;
  project: string;
  hours: number;
  status: TaskStatus;
  blocker: string;
};

/** Read-only list of a day's tasks. Put it inside a Card or a bordered block. */
export function TaskList({ tasks }: { tasks: TaskView[] }) {
  return (
    <ol className="divide-y divide-line-subtle">
      {tasks.map((t, i) => (
        <li key={i} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
          <span className="min-w-0 flex-1 text-sm text-fg">{t.description}</span>
          {t.project && <span className="text-xs text-muted">{t.project}</span>}
          <Badge tone={t.status === "blocked" ? "primary" : "neutral"}>{taskStatusLabel[t.status]}</Badge>
          <span className="w-12 text-right text-sm font-medium text-fg">{formatHours(t.hours)}</span>
          {t.status === "blocked" && t.blocker && (
            <span className="w-full text-xs text-fg-secondary">Blocked by: {t.blocker}</span>
          )}
        </li>
      ))}
    </ol>
  );
}

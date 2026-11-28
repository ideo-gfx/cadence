"use client";

import { useState, useTransition } from "react";
import { TaskList, type TaskView } from "@/components/TaskList";
import { FlaggedTasks } from "@/components/FlaggedTasks";
import { Badge, Button, Card, Checkbox, Input, Notice, cx } from "@/components/ui";
import {
  dayStateLabel,
  dayStatusLabel,
  expectedHours,
  formatHours,
  isDayOff,
  type DayState,
  type DayStatus,
} from "@/lib/workday";
import { approveDays, reopenDay, returnDay, type ReviewResult } from "./actions";

export type PersonDay = {
  personId: string;
  name: string;
  /** e.g. "Reports to Asha", for skip-level people and teams you're covering. */
  subtitle?: string;
  /** Shown in the review queue, where days from different dates sit together. */
  dateLabel?: string;
  canApprove: boolean;
  day: {
    id: string;
    status: DayStatus;
    note: string;
    state: DayState;
    reviewNote: string;
    reviewTasks: { description: string; note: string }[];
    /** What project leads said about the tasks on their projects. */
    projectReviews: { project: string; status: "ok" | "flagged"; note: string }[];
    tasks: (TaskView & { id: string })[];
  } | null;
};

const stateTone: Record<DayState, "neutral" | "primary" | "secondary" | "success"> = {
  draft: "neutral",
  submitted: "secondary",
  returned: "primary",
  approved: "success",
};

export function TeamDay({
  rows,
  isAdmin,
  mode = "day",
}: {
  rows: PersonDay[];
  isAdmin: boolean;
  mode?: "day" | "queue";
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReviewResult | null>(null);

  const waiting = rows.filter((r) => r.canApprove && r.day?.state === "submitted");
  const notIn = rows.filter((r) => !r.day || r.day.state === "draft");
  const approved = rows.filter((r) => r.day?.state === "approved").length;

  const approveAll = () =>
    startTransition(async () => setResult(await approveDays(waiting.map((r) => r.day!.id))));

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
        <span className="text-sm text-fg">
          <strong className="font-semibold">{waiting.length}</strong> waiting
        </span>
        {mode === "day" && (
          <>
            <span className="text-sm text-fg-secondary">{approved} approved</span>
            <span className="text-sm text-fg-secondary">{notIn.length} not submitted</span>
          </>
        )}
        <div className="flex items-center gap-3 sm:ml-auto">
          {result && <Notice tone={result.ok ? "success" : "danger"}>{result.message}</Notice>}
          <Button size="sm" disabled={pending || waiting.length === 0} onClick={approveAll}>
            {pending ? "Approving…" : waiting.length ? `Approve all (${waiting.length})` : "Approve all"}
          </Button>
        </div>
      </Card>

      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.day?.id ?? r.personId}>
            <PersonCard row={r} isAdmin={isAdmin} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PersonCard({ row, isAdmin }: { row: PersonDay; isAdmin: boolean }) {
  const { day } = row;
  const [mode, setMode] = useState<"idle" | "return" | "reopen">("idle");
  const [reason, setReason] = useState("");
  // Task id -> note, for the tasks the reviewer flags when sending back.
  const [flags, setFlags] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (!day || day.state === "draft") {
    return (
      <Card className="flex flex-wrap items-center gap-3 p-4 opacity-80">
        <span className="text-sm font-medium text-fg">{row.name}</span>
        {row.subtitle && <span className="text-xs text-muted">{row.subtitle}</span>}
        <span className="ml-auto text-sm text-muted">{day ? "Drafting, not submitted" : "Not submitted"}</span>
      </Card>
    );
  }

  const total = day.tasks.reduce((s, t) => s + t.hours, 0);
  const expected = expectedHours(day.status);
  const low = !isDayOff(day.status) && total < expected;
  const blocked = day.tasks.filter((t) => t.status === "blocked").length;
  const canReview = row.canApprove && day.state === "submitted";
  const canReopen = isAdmin && day.state === "approved";

  const act = (fn: () => Promise<ReviewResult>) =>
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      if (res.ok) {
        setMode("idle");
        setReason("");
        setFlags({});
      }
    });

  return (
    <Card className={cx("overflow-hidden", day.state === "submitted" && row.canApprove && "border-secondary/40")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
        {row.dateLabel && <span className="text-sm font-medium text-secondary">{row.dateLabel}</span>}
        <span className="text-md font-medium text-fg">{row.name}</span>
        {row.subtitle && <span className="text-xs text-muted">{row.subtitle}</span>}
        <Badge tone={stateTone[day.state]}>{dayStateLabel[day.state]}</Badge>
        <span className="text-sm text-fg-secondary">{dayStatusLabel[day.status]}</span>
        <span className="flex items-center gap-3 sm:ml-auto">
          {blocked > 0 && <span className="text-xs text-danger">{blocked} blocked</span>}
          {!isDayOff(day.status) && (
            <span className={cx("text-sm font-medium", low ? "text-warning" : "text-fg")}>
              {formatHours(total)}
              {low && <span className="font-normal text-muted"> of {formatHours(expected)}</span>}
            </span>
          )}
        </span>
      </div>

      {day.tasks.length > 0 && mode !== "return" && (
        <div className="border-t border-line-subtle">
          <TaskList tasks={day.tasks} />
        </div>
      )}
      {day.tasks.length > 0 && mode === "return" && (
        <div className="border-t border-line-subtle">
          <p className="px-4 pt-3 text-xs text-muted">Tick the tasks that need changing, and say what to fix.</p>
          <ol className="divide-y divide-line-subtle">
            {day.tasks.map((t) => {
              const flagged = t.id in flags;
              return (
                <li key={t.id} className={cx("space-y-2 px-4 py-3", flagged && "bg-primary-light/50")}>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <Checkbox
                      checked={flagged}
                      onChange={(e) =>
                        setFlags((f) => {
                          const next = { ...f };
                          if (e.target.checked) next[t.id] = "";
                          else delete next[t.id];
                          return next;
                        })
                      }
                      label={<span className="text-sm text-fg">{t.description}</span>}
                      className="min-w-0 flex-1"
                    />
                    {t.project && <span className="text-xs text-muted">{t.project}</span>}
                    <span className="text-sm font-medium text-fg">{formatHours(t.hours)}</span>
                  </div>
                  {flagged && (
                    <Input
                      value={flags[t.id]}
                      onChange={(e) => setFlags((f) => ({ ...f, [t.id]: e.target.value }))}
                      placeholder="What should change on this task? (optional)"
                      aria-label={`Note on ${t.description}`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {day.projectReviews.length > 0 && (
        <ul className="space-y-1 border-t border-line-subtle px-4 py-3">
          {day.projectReviews.map((pr) => (
            <li key={pr.project} className="flex flex-wrap items-baseline gap-2 text-sm">
              <Badge tone={pr.status === "ok" ? "success" : "primary"}>
                {pr.status === "ok" ? "Lead OK" : "Lead flagged"}
              </Badge>
              <span className="font-medium text-fg">{pr.project}</span>
              {pr.note && <span className="text-fg-secondary">{pr.note}</span>}
            </li>
          ))}
        </ul>
      )}
      {day.note && (
        <p className="border-t border-line-subtle px-4 py-3 text-sm text-fg-secondary">
          <span className="text-muted">Note: </span>
          {day.note}
        </p>
      )}
      {day.state === "returned" && day.reviewNote && (
        <p className="border-t border-line-subtle px-4 py-3 text-sm text-fg-secondary">
          <span className="text-muted">Sent back: </span>
          {day.reviewNote}
        </p>
      )}
      {day.state === "returned" && day.reviewTasks.length > 0 && <FlaggedTasks tasks={day.reviewTasks} />}

      {(canReview || canReopen) && (
        <div className="space-y-3 border-t border-line-subtle bg-subtle/60 p-4">
          {mode === "idle" ? (
            <div className="flex flex-wrap items-center gap-2">
              {canReview && (
                <>
                  <Button size="sm" disabled={pending} onClick={() => act(() => approveDays([day.id]))}>
                    {pending ? "Saving…" : "Approve"}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => setMode("return")}>
                    Send back
                  </Button>
                </>
              )}
              {canReopen && (
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => setMode("reopen")}>
                  Reopen for changes
                </Button>
              )}
              {result && <Notice tone={result.ok ? "success" : "danger"}>{result.message}</Notice>}
            </div>
          ) : (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                act(() =>
                  mode === "return"
                    ? returnDay(
                        day.id,
                        reason,
                        Object.entries(flags).map(([taskId, note]) => ({ taskId, note })),
                      )
                    : reopenDay(day.id, reason),
                );
              }}
            >
              <div className="min-w-0 flex-1 basis-64">
                <Input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={mode === "return" ? "Why are you sending it back?" : "Why reopen it?"}
                  aria-label="Reason"
                />
              </div>
              <Button size="sm" disabled={pending || !reason.trim()}>
                {pending ? "Sending…" : mode === "return" ? "Send back" : "Reopen"}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setMode("idle")}>
                Cancel
              </Button>
              {result && !result.ok && <Notice tone="danger">{result.message}</Notice>}
            </form>
          )}
        </div>
      )}
    </Card>
  );
}

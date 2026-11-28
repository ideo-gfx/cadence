"use client";

import { useState, useTransition } from "react";
import { TaskList, type TaskView } from "@/components/TaskList";
import { Badge, Button, Card, Input, Notice } from "@/components/ui";
import { dayStateLabel, formatHours, type DayState } from "@/lib/workday";
import { reviewProjectTasks, type ReviewResult } from "./actions";

export type ProjectDay = {
  dayId: string;
  projectId: string;
  dateLabel: string;
  person: string;
  dayState: DayState;
  tasks: TaskView[];
  review: { status: "ok" | "flagged"; note: string } | null;
};

export function ProjectDayCard({ item }: { item: ProjectDay }) {
  const [flagging, setFlagging] = useState(false);
  const [note, setNote] = useState(item.review?.note ?? "");
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [pending, start] = useTransition();
  const total = item.tasks.reduce((s, t) => s + t.hours, 0);
  const locked = item.dayState === "approved";

  const act = (status: "ok" | "flagged" | "", n = "") =>
    start(async () => {
      const res = await reviewProjectTasks(item.dayId, item.projectId, status, n);
      setResult(res);
      if (res.ok) setFlagging(false);
    });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
        <span className="text-sm font-medium text-secondary">{item.dateLabel}</span>
        <span className="text-md font-medium text-fg">{item.person}</span>
        <Badge tone={item.dayState === "approved" ? "success" : item.dayState === "returned" ? "primary" : "secondary"}>
          {dayStateLabel[item.dayState]}
        </Badge>
        {item.review && (
          <Badge tone={item.review.status === "ok" ? "success" : "primary"}>
            {item.review.status === "ok" ? "You marked fine" : "You flagged"}
          </Badge>
        )}
        <span className="text-sm font-medium text-fg sm:ml-auto">{formatHours(total)}</span>
      </div>
      <div className="border-t border-line-subtle">
        <TaskList tasks={item.tasks} />
      </div>
      {item.review?.status === "flagged" && item.review.note && !flagging && (
        <p className="border-t border-line-subtle px-4 py-3 text-sm text-fg-secondary">
          <span className="text-muted">Your flag: </span>
          {item.review.note}
        </p>
      )}
      {!locked && (
        <div className="space-y-3 border-t border-line-subtle bg-subtle/60 p-4">
          {flagging ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                act("flagged", note);
              }}
            >
              <div className="min-w-0 flex-1 basis-64">
                <Input
                  autoFocus
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What should the manager look at?"
                  aria-label="Flag note"
                />
              </div>
              <Button size="sm" disabled={pending || !note.trim()}>
                {pending ? "Saving…" : "Flag"}
              </Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setFlagging(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {item.review?.status !== "ok" && (
                <Button size="sm" disabled={pending} onClick={() => act("ok")}>
                  Looks fine
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => setFlagging(true)}>
                {item.review?.status === "flagged" ? "Edit flag" : "Flag for manager"}
              </Button>
              {item.review && (
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => act("")}>
                  Clear
                </Button>
              )}
            </div>
          )}
          {result && <Notice tone={result.ok ? "success" : "danger"}>{result.message}</Notice>}
        </div>
      )}
    </Card>
  );
}

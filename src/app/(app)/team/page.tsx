import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DayStrip } from "@/components/DayStrip";
import { PendingLabel } from "@/components/NavLink";
import { EmptyState, cx } from "@/components/ui";
import { canReviewDays, createClient, getProfile, homeFor, type Profile } from "@/lib/supabase/server";
import {
  BACKFILL_DAYS,
  addDays,
  formatDay,
  isIsoDate,
  teamToday,
  type DayState,
  type DayStatus,
  type TaskStatus,
} from "@/lib/workday";
import { TeamDay, type PersonDay } from "./review";

type DayRow = {
  id: string;
  user_id: string;
  work_date: string;
  status: DayStatus;
  note: string;
  state: DayState;
  review_note: string;
  review_tasks: { description: string; note: string }[] | null;
  tasks: {
    id: string;
    position: number;
    description: string;
    project_other: string;
    hours: number;
    status: TaskStatus;
    blocker: string;
    projects: { name: string } | null;
  }[];
};

const DAY_FIELDS =
  "id, user_id, work_date, status, note, state, review_note, review_tasks, tasks(id, position, description, project_other, hours, status, blocker, projects(name))";

type Scope = "mine" | "team" | "all";
const scopeLabel: Record<Scope, string> = { mine: "To review", team: "Whole team", all: "Everyone" };

/** Everyone below `rootId` in the reporting tree, from the profiles we can see. */
function treeBelow(rootId: string, people: Profile[]) {
  const below = new Set<string>();
  let frontier = [rootId];
  while (frontier.length) {
    const next = people.filter((p) => p.manager_id && frontier.includes(p.manager_id) && !below.has(p.id));
    next.forEach((p) => below.add(p.id));
    frontier = next.map((p) => p.id);
  }
  below.delete(rootId);
  return below;
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; scope?: string; view?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/");
  const reviewer = canReviewDays(profile);
  if (!reviewer && !profile.is_admin) redirect(homeFor[profile.role]);

  const { date: asked, scope: askedScope, view: askedView } = await searchParams;
  const today = teamToday();
  const date = isIsoDate(asked) && asked <= today ? asked : today;
  const oldest = addDays(today, -BACKFILL_DAYS);
  const view = askedView === "queue" ? "queue" : "day";

  const supabase = await createClient();
  // Row-level security returns only the people this person may see.
  const { data: peopleData } = await supabase
    .from("profiles")
    .select("*")
    .eq("active", true)
    .neq("role", "executive")
    .order("full_name");
  const visible = (peopleData ?? []) as Profile[];
  const nameOf = new Map(visible.map((p) => [p.id, p.full_name || p.email]));

  // People whose day I can approve: my direct reports, plus the teams I'm backing up today.
  const canApprove = (p: Profile) =>
    p.id !== profile.id && !!p.manager_id && (p.manager_id === profile.id || profile.backup_for.includes(p.manager_id));
  const reviewable = visible.filter(canApprove);
  const tree = treeBelow(profile.id, visible);
  const hasSkipLevel = visible.some((p) => tree.has(p.id) && p.manager_id !== profile.id);

  const scopes: Scope[] = [
    ...(reviewer ? (["mine"] as const) : []),
    ...(hasSkipLevel ? (["team"] as const) : []),
    ...(profile.is_admin ? (["all"] as const) : []),
  ];
  const scope: Scope = scopes.includes(askedScope as Scope) ? (askedScope as Scope) : scopes[0];
  const people =
    scope === "mine"
      ? reviewable
      : scope === "team"
        ? visible.filter((p) => tree.has(p.id) || canApprove(p))
        : visible.filter((p) => p.id !== profile.id);
  const ids = people.map((p) => p.id);

  const [{ data: dayData }, { data: pendingData }, { data: queueData }] = await Promise.all([
    view === "day"
      ? supabase.from("days").select(DAY_FIELDS).eq("work_date", date).in("user_id", ids)
      : Promise.resolve({ data: [] }),
    supabase.from("days").select("work_date, user_id").eq("state", "submitted").in("user_id", ids),
    supabase
      .from("days")
      .select("id")
      .eq("state", "submitted")
      .in("user_id", reviewable.map((p) => p.id)),
  ]);
  const queueCount = queueData?.length ?? 0;

  // Who someone reports to, when it isn't obvious (skip-level or a team I'm covering).
  const subtitleFor = (p: Profile) =>
    p.manager_id && p.manager_id !== profile.id ? `Reports to ${nameOf.get(p.manager_id) ?? "someone else"}` : undefined;

  const toRow = (p: Profile, d: DayRow | undefined, withDate = false): PersonDay => ({
    personId: p.id,
    name: p.full_name || p.email,
    subtitle: subtitleFor(p),
    dateLabel: withDate && d ? formatDay(d.work_date, { weekday: "short", day: "numeric", month: "short" }) : undefined,
    canApprove: canApprove(p),
    day: d
      ? {
          id: d.id,
          status: d.status,
          note: d.note,
          state: d.state,
          reviewNote: d.review_note,
          reviewTasks: d.review_tasks ?? [],
          projectReviews: [],
          tasks: [...d.tasks]
            .sort((a, b) => a.position - b.position)
            .map((t) => ({
              id: t.id,
              description: t.description,
              project: t.projects?.name ?? t.project_other,
              hours: Number(t.hours),
              status: t.status,
              blocker: t.blocker,
            })),
        }
      : null,
  });

  let rows: PersonDay[] = [];
  if (view === "day") {
    const dayByPerson = new Map(((dayData ?? []) as unknown as DayRow[]).map((d) => [d.user_id, d]));
    rows = people.map((p) => toRow(p, dayByPerson.get(p.id)));
  } else {
    const { data } = await supabase
      .from("days")
      .select(DAY_FIELDS)
      .eq("state", "submitted")
      .in("user_id", reviewable.map((p) => p.id))
      .order("work_date");
    const byId = new Map(reviewable.map((p) => [p.id, p]));
    rows = ((data ?? []) as unknown as DayRow[]).map((d) => toRow(byId.get(d.user_id)!, d, true));
  }

  // What project leads said about the tasks on their projects.
  const dayIds = rows.flatMap((r) => (r.day ? [r.day.id] : []));
  if (dayIds.length) {
    const { data: reviewData } = await supabase
      .from("project_reviews")
      .select("day_id, status, note, projects(name)")
      .in("day_id", dayIds);
    const byDay = new Map<string, { project: string; status: "ok" | "flagged"; note: string }[]>();
    for (const r of (reviewData ?? []) as unknown as {
      day_id: string;
      status: "ok" | "flagged";
      note: string;
      projects: { name: string } | null;
    }[]) {
      byDay.set(r.day_id, [...(byDay.get(r.day_id) ?? []), { project: r.projects?.name ?? "A project", status: r.status, note: r.note }]);
    }
    for (const r of rows) if (r.day) r.day.projectReviews = byDay.get(r.day.id) ?? [];
  }

  const waitingByDate = new Map<string, number>();
  for (const d of pendingData ?? []) waitingByDate.set(d.work_date, (waitingByDate.get(d.work_date) ?? 0) + 1);

  const href = (opts: { date?: string; scope?: Scope; view?: "day" | "queue" }) => {
    const q = new URLSearchParams();
    const v = opts.view ?? view;
    if (v === "queue") q.set("view", "queue");
    else if ((opts.date ?? date) !== today) q.set("date", opts.date ?? date);
    const s = opts.scope ?? scope;
    if (v === "day" && s !== scopes[0]) q.set("scope", s);
    const qs = q.toString();
    return qs ? `/team?${qs}` : "/team";
  };

  const strip = Array.from({ length: BACKFILL_DAYS + 1 }, (_, i) => addDays(today, -i)).map((d) => {
    const n = waitingByDate.get(d) ?? 0;
    return {
      date: d,
      href: href({ date: d }),
      label: n ? `${n} waiting` : "—",
      tone: n ? ("secondary" as const) : ("muted" as const),
    };
  });
  // The strip covers a week; point to anything older that's still waiting.
  const olderWaiting = [...waitingByDate.keys()].filter((d) => d < oldest).sort();

  const backupNames = profile.backup_for.map((id) => nameOf.get(id) ?? "another manager");

  return (
    <AppShell
      profile={profile}
      title={scope === "all" && !reviewer ? "Everyone's days" : "Team"}
      description={
        view === "queue"
          ? "Every day waiting for you, oldest first."
          : date === today
            ? "Review and approve your team's day."
            : `Reviewing ${formatDay(date, { weekday: "long", day: "numeric", month: "long" })}.`
      }
    >
      {backupNames.length > 0 && (
        <p className="-mt-4 mb-6 text-sm text-fg-secondary">
          You&apos;re the backup approver for {backupNames.join(" and ")}&apos;s team today.
        </p>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Tabs
          items={[
            ...(reviewer
              ? [{ href: href({ view: "queue" }), label: `Needs review${queueCount ? ` (${queueCount})` : ""}`, active: view === "queue" }]
              : []),
            { href: href({ view: "day" }), label: "By day", active: view === "day" },
          ]}
        />
        {view === "day" && scopes.length > 1 && (
          <Tabs
            subtle
            items={scopes.map((s) => ({ href: href({ view: "day", scope: s }), label: scopeLabel[s], active: s === scope }))}
          />
        )}
      </div>

      {view === "day" && (
        <>
          <DayStrip days={strip} current={date} today={today} />
          {olderWaiting.length > 0 && (
            <p className="-mt-3 mb-6 text-xs text-muted">
              Older days are still waiting too:{" "}
              {olderWaiting.map((d, i) => (
                <span key={d}>
                  {i > 0 && ", "}
                  <Link href={href({ date: d })} className="text-link hover:underline">
                    {formatDay(d)}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </>
      )}

      {people.length === 0 ? (
        <EmptyState title="Nobody reports to you yet">
          An admin can set who reports to you on the People screen.
        </EmptyState>
      ) : view === "queue" && rows.length === 0 ? (
        <EmptyState title="All caught up">Nothing is waiting for your review.</EmptyState>
      ) : (
        <TeamDay key={`${view}-${date}-${scope}`} rows={rows} isAdmin={profile.is_admin} mode={view} />
      )}
    </AppShell>
  );
}

function Tabs({ items, subtle }: { items: { href: string; label: string; active: boolean }[]; subtle?: boolean }) {
  return (
    <nav className="flex gap-1">
      {items.map((t) => (
        <Link
          key={t.href + t.label}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={cx(
            "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-[color,background-color,transform] duration-100 active:scale-[0.97]",
            t.active
              ? subtle
                ? "bg-subtle text-fg"
                : "bg-primary-light text-primary"
              : "text-fg-secondary hover:bg-hover hover:text-fg",
          )}
        >
          <PendingLabel>{t.label}</PendingLabel>
        </Link>
      ))}
    </nav>
  );
}

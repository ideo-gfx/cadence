import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DayStrip } from "@/components/DayStrip";
import { EmptyState, cx } from "@/components/ui";
import { createClient, getProfile, homeFor, type Profile } from "@/lib/supabase/server";
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
  tasks: {
    position: number;
    description: string;
    project_other: string;
    hours: number;
    status: TaskStatus;
    blocker: string;
    projects: { name: string } | null;
  }[];
};

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; scope?: string }>;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/");
  const isManager = profile.role === "manager";
  if (!isManager && !profile.is_admin) redirect(homeFor[profile.role]);

  const { date: asked, scope: askedScope } = await searchParams;
  // Admins can look at everyone's days; managers see their direct reports.
  const scope = profile.is_admin && (askedScope === "all" || !isManager) ? "all" : "mine";
  const today = teamToday();
  const date = isIsoDate(asked) && asked <= today ? asked : today;
  const oldest = addDays(today, -BACKFILL_DAYS);

  const supabase = await createClient();
  let peopleQuery = supabase
    .from("profiles")
    .select("*")
    .eq("active", true)
    .neq("role", "executive")
    .order("full_name");
  peopleQuery = scope === "mine" ? peopleQuery.eq("manager_id", profile.id) : peopleQuery.neq("id", profile.id);
  const { data: peopleData } = await peopleQuery;
  const people = (peopleData ?? []) as Profile[];
  const ids = people.map((p) => p.id);

  const [{ data: dayData }, { data: pendingData }] = await Promise.all([
    supabase
      .from("days")
      .select(
        "id, user_id, work_date, status, note, state, review_note, tasks(position, description, project_other, hours, status, blocker, projects(name))",
      )
      .eq("work_date", date)
      .in("user_id", ids),
    supabase
      .from("days")
      .select("work_date, user_id")
      .eq("state", "submitted")
      .in("user_id", ids),
  ]);

  const dayByPerson = new Map(((dayData ?? []) as unknown as DayRow[]).map((d) => [d.user_id, d]));
  const waitingByDate = new Map<string, number>();
  for (const d of pendingData ?? []) waitingByDate.set(d.work_date, (waitingByDate.get(d.work_date) ?? 0) + 1);

  const rows: PersonDay[] = people.map((p) => {
    const d = dayByPerson.get(p.id);
    return {
      personId: p.id,
      name: p.full_name || p.email,
      canApprove: p.manager_id === profile.id,
      day: d
        ? {
            id: d.id,
            status: d.status,
            note: d.note,
            state: d.state,
            reviewNote: d.review_note,
            tasks: [...d.tasks]
              .sort((a, b) => a.position - b.position)
              .map((t) => ({
                description: t.description,
                project: t.projects?.name ?? t.project_other,
                hours: Number(t.hours),
                status: t.status,
                blocker: t.blocker,
              })),
          }
        : null,
    };
  });

  const scopeParam = scope === "all" && isManager ? "&scope=all" : "";
  const strip = Array.from({ length: BACKFILL_DAYS + 1 }, (_, i) => addDays(today, -i)).map((d) => {
    const n = waitingByDate.get(d) ?? 0;
    return {
      date: d,
      href: `/team?date=${d}${scopeParam}`,
      label: n ? `${n} waiting` : "—",
      tone: n ? ("secondary" as const) : ("muted" as const),
    };
  });
  // The strip covers a week; point to anything older that's still waiting.
  const olderWaiting = [...waitingByDate.keys()].filter((d) => d < oldest).sort();

  return (
    <AppShell
      profile={profile}
      title={scope === "all" ? "Everyone's days" : "Team approvals"}
      description={
        date === today
          ? "Review and approve your team's day."
          : `Reviewing ${formatDay(date, { weekday: "long", day: "numeric", month: "long" })}.`
      }
    >
      {isManager && profile.is_admin && (
        <div className="mb-4 flex gap-1">
          {(["mine", "all"] as const).map((s) => (
            <Link
              key={s}
              href={`/team?date=${date}${s === "all" ? "&scope=all" : ""}`}
              className={cx(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                scope === s ? "bg-primary-light text-primary" : "text-fg-secondary hover:bg-hover hover:text-fg",
              )}
            >
              {s === "mine" ? "My team" : "Everyone"}
            </Link>
          ))}
        </div>
      )}
      <DayStrip days={strip} current={date} today={today} />
      {olderWaiting.length > 0 && (
        <p className="-mt-3 mb-6 text-xs text-muted">
          Older days are still waiting too:{" "}
          {olderWaiting.map((d, i) => (
            <span key={d}>
              {i > 0 && ", "}
              <Link href={`/team?date=${d}${scopeParam}`} className="text-link hover:underline">
                {formatDay(d)}
              </Link>
            </span>
          ))}
        </p>
      )}
      {people.length === 0 ? (
        <EmptyState title="Nobody reports to you yet">
          An admin can set who reports to you on the People screen.
        </EmptyState>
      ) : (
        <TeamDay key={date} rows={rows} isAdmin={profile.is_admin} />
      )}
    </AppShell>
  );
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { isDayOff, type DayState, type DayStatus, type TaskStatus } from "./workday";

// Builds the daily report for one date. Works with the signed-in client
// (leadership and admins can read everything) or the service-role client.

export type ReportPerson = {
  id: string;
  name: string;
  state: DayState | null;
  status: DayStatus | null;
  hours: number;
  tasks: { description: string; project: string; hours: number; status: TaskStatus; blocker: string }[];
  note: string;
};

export type ReportTeam = {
  managerName: string;
  people: ReportPerson[];
  approved: ReportPerson[];
  onLeave: ReportPerson[];
  waiting: ReportPerson[];
  notSubmitted: ReportPerson[];
  hours: number;
  projectHours: { project: string; hours: number }[];
  blockers: { person: string; description: string; blocker: string }[];
};

export type LateApproval = ReportPerson & { workDate: string };

export type DailyReport = {
  date: string;
  /** True once the 9 PM run has closed this report. */
  closed: boolean;
  teams: ReportTeam[];
  late: LateApproval[];
  totals: { people: number; approved: number; onLeave: number; waiting: number; notSubmitted: number; hours: number };
};

type ProfileRow = { id: string; full_name: string; email: string; manager_id: string | null; role: string; active: boolean };
type DayRow = {
  id: string;
  user_id: string;
  work_date: string;
  status: DayStatus;
  state: DayState;
  note: string;
  reported_on: string | null;
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

const DAY_SELECT =
  "id, user_id, work_date, status, state, note, reported_on, tasks(position, description, project_other, hours, status, blocker, projects(name))";

const nameOf = (p: Pick<ProfileRow, "full_name" | "email">) => p.full_name || p.email;

function toPerson(p: ProfileRow, d: DayRow | undefined): ReportPerson {
  const tasks = [...(d?.tasks ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((t) => ({
      description: t.description,
      project: t.projects?.name ?? t.project_other ?? "",
      hours: Number(t.hours),
      status: t.status,
      blocker: t.blocker,
    }));
  return {
    id: p.id,
    name: nameOf(p),
    state: d?.state ?? null,
    status: d?.status ?? null,
    hours: tasks.reduce((s, t) => s + t.hours, 0),
    tasks,
    note: d?.note ?? "",
  };
}

/**
 * The report for `date`. Once closed, it holds exactly the days stamped with
 * that date. Before then it previews what would go out now: that day's
 * approved days, plus (for today) earlier days approved since the last report.
 */
export async function buildReport(supabase: SupabaseClient, date: string, opts: { today: string }): Promise<DailyReport> {
  const [{ data: run }, { data: profileData }] = await Promise.all([
    supabase.from("report_runs").select("run_date").eq("run_date", date).eq("kind", "report").maybeSingle(),
    supabase.from("profiles").select("id, full_name, email, manager_id, role, active"),
  ]);
  const closed = !!run;
  const profiles = (profileData ?? []) as ProfileRow[];
  const byId = new Map(profiles.map((p) => [p.id, p]));

  // Everyone's day for this date (for "waiting" and "not submitted").
  const { data: dayData } = await supabase.from("days").select(DAY_SELECT).eq("work_date", date);
  const days = (dayData ?? []) as unknown as DayRow[];

  // Approved days that belong in this report.
  const inReport = (d: DayRow) =>
    d.state === "approved" && (closed ? d.reported_on === date : d.reported_on === null || d.reported_on === date);

  let lateRows: DayRow[] = [];
  if (closed) {
    const { data } = await supabase.from("days").select(DAY_SELECT).eq("reported_on", date).lt("work_date", date);
    lateRows = (data ?? []) as unknown as DayRow[];
  } else if (date === opts.today) {
    const { data } = await supabase
      .from("days")
      .select(DAY_SELECT)
      .eq("state", "approved")
      .is("reported_on", null)
      .lt("work_date", date);
    lateRows = (data ?? []) as unknown as DayRow[];
  }

  const dayByUser = new Map(days.map((d) => [d.user_id, d]));
  // Who's expected: active people who log days, plus anyone with a day on this date.
  const people = profiles.filter((p) => (p.active && p.role !== "executive") || dayByUser.has(p.id));

  const groups = new Map<string, ProfileRow[]>();
  for (const p of people) {
    const key = p.manager_id ?? "";
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }

  const teams: ReportTeam[] = [...groups.entries()]
    .map(([managerId, members]) => {
      const persons = members
        .map((p) => {
          const d = dayByUser.get(p.id);
          // A day approved after this report closed isn't part of it yet.
          return toPerson(p, d && d.state === "approved" && !inReport(d) ? { ...d, state: "submitted" } : d);
        })
        .sort((a, b) => a.name.localeCompare(b.name));
      const approved = persons.filter((p) => p.state === "approved");
      const projectHours = new Map<string, number>();
      for (const p of approved)
        for (const t of p.tasks) projectHours.set(t.project || "No project", (projectHours.get(t.project || "No project") ?? 0) + t.hours);
      const manager = managerId ? byId.get(managerId) : undefined;
      return {
        managerName: manager ? `${nameOf(manager)}'s team` : "Reports to nobody",
        people: persons,
        approved,
        onLeave: approved.filter((p) => p.status && isDayOff(p.status)),
        waiting: persons.filter((p) => p.state === "submitted"),
        notSubmitted: persons.filter((p) => !p.state || p.state === "draft" || p.state === "returned"),
        hours: approved.reduce((s, p) => s + p.hours, 0),
        projectHours: [...projectHours.entries()]
          .map(([project, hours]) => ({ project, hours }))
          .sort((a, b) => b.hours - a.hours),
        blockers: approved.flatMap((p) =>
          p.tasks.filter((t) => t.status === "blocked").map((t) => ({ person: p.name, description: t.description, blocker: t.blocker })),
        ),
      };
    })
    .sort((a, b) => (a.managerName === "Reports to nobody" ? 1 : b.managerName === "Reports to nobody" ? -1 : a.managerName.localeCompare(b.managerName)));

  const late: LateApproval[] = lateRows
    .filter((d) => byId.has(d.user_id))
    .map((d) => ({ ...toPerson(byId.get(d.user_id)!, d), workDate: d.work_date }))
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || a.name.localeCompare(b.name));

  const sum = (f: (t: ReportTeam) => number) => teams.reduce((s, t) => s + f(t), 0);
  return {
    date,
    closed,
    teams,
    late,
    totals: {
      people: sum((t) => t.people.length),
      approved: sum((t) => t.approved.length),
      onLeave: sum((t) => t.onLeave.length),
      waiting: sum((t) => t.waiting.length),
      notSubmitted: sum((t) => t.notSubmitted.length),
      hours: sum((t) => t.hours),
    },
  };
}

import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DayStrip } from "@/components/DayStrip";
import { createClient, getProfile } from "@/lib/supabase/server";
import {
  BACKFILL_DAYS,
  addDays,
  dayStateLabel,
  formatDay,
  isIsoDate,
  teamToday,
  type DayState,
  type DayStatus,
  type TaskStatus,
} from "@/lib/workday";
import { DayForm, type Project, type SavedDay } from "./form";

type DayRow = {
  id: string;
  work_date: string;
  status: DayStatus;
  note: string;
  state: DayState;
  review_note: string;
  tasks: {
    position: number;
    description: string;
    project_id: string | null;
    project_other: string;
    hours: number;
    status: TaskStatus;
    blocker: string;
  }[];
};

export default async function EntryPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (profile.role === "executive") redirect("/reports");

  const today = teamToday();
  const oldest = addDays(today, -BACKFILL_DAYS);
  const { date: asked } = await searchParams;
  const date = isIsoDate(asked) && asked <= today ? asked : today;

  const supabase = await createClient();
  const [{ data: dayData }, { data: recentData }, { data: projectData }, { data: managerData }] = await Promise.all([
    supabase
      .from("days")
      .select("id, work_date, status, note, state, review_note, tasks(position, description, project_id, project_other, hours, status, blocker)")
      .eq("user_id", profile.id)
      .eq("work_date", date)
      .maybeSingle(),
    supabase
      .from("days")
      .select("work_date, state")
      .eq("user_id", profile.id)
      .gte("work_date", oldest)
      .lte("work_date", today),
    supabase.from("projects").select("id, name, active").order("name"),
    profile.manager_id
      ? supabase.from("profiles").select("full_name, email").eq("id", profile.manager_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const day = dayData as DayRow | null;
  const stateByDate = new Map((recentData ?? []).map((d) => [d.work_date as string, d.state as DayState]));
  const usedProjects = new Set(day?.tasks.map((t) => t.project_id) ?? []);
  const projects = ((projectData ?? []) as (Project & { active: boolean })[])
    .filter((p) => p.active || usedProjects.has(p.id))
    .map(({ id, name }) => ({ id, name }));
  const manager = managerData as { full_name: string; email: string } | null;

  // A date outside the window can still be opened if it was sent back.
  const inWindow = date >= oldest;
  const editable = day ? day.state === "draft" || day.state === "returned" : inWindow;

  const saved: SavedDay | null = day && {
    status: day.status,
    note: day.note,
    state: day.state,
    reviewNote: day.review_note,
    tasks: [...day.tasks]
      .sort((a, b) => a.position - b.position)
      .map((t) => ({
        description: t.description,
        project_id: t.project_id ?? (t.project_other ? "other" : ""),
        project_other: t.project_other,
        hours: String(Number(t.hours)),
        status: t.status,
        blocker: t.blocker,
      })),
  };

  const strip = Array.from({ length: BACKFILL_DAYS + 1 }, (_, i) => addDays(today, -i));

  return (
    <AppShell
      profile={profile}
      title={date === today ? "Today" : formatDay(date, { weekday: "long", day: "numeric", month: "long" })}
      description="Log what you worked on, with hours. Submit when your day is done."
    >
      <DayStrip
        today={today}
        current={date}
        days={strip.map((d) => {
          const state = stateByDate.get(d);
          return {
            date: d,
            href: d === today ? "/entry" : `/entry?date=${d}`,
            label: state ? dayStateLabel[state] : "Not started",
            tone:
              state === "approved" ? "success" : state === "returned" ? "danger" : state === "submitted" ? "secondary" : "muted",
          };
        })}
      />

      <DayForm
        key={`${date}-${day?.state ?? "new"}`}
        date={date}
        saved={saved}
        editable={editable}
        projects={projects}
        managerName={manager ? manager.full_name || manager.email : null}
      />
    </AppShell>
  );
}

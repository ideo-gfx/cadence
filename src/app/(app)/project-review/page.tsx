import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EmptyState, Eyebrow } from "@/components/ui";
import { getProfile, createClient, homeFor } from "@/lib/supabase/server";
import { addDays, formatDay, teamToday, type DayState, type TaskStatus } from "@/lib/workday";
import { ProjectDayCard, type ProjectDay } from "./review";

/** How far back the project review list goes. */
const REVIEW_WINDOW_DAYS = 14;

type QueueRow = {
  day_id: string;
  work_date: string;
  person_name: string;
  day_state: DayState;
  project_id: string;
  project_name: string;
  tasks: { id: string; description: string; hours: number; status: TaskStatus; blocker: string }[];
  review_status: "ok" | "flagged" | null;
  review_note: string;
};

export default async function ProjectReviewPage() {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (!profile.leads_projects) redirect(homeFor[profile.role]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("project_review_queue", {
    p_from: addDays(teamToday(), -REVIEW_WINDOW_DAYS),
  });
  const rows = (data ?? []) as QueueRow[];

  const byProject = new Map<string, { name: string; items: ProjectDay[] }>();
  for (const r of rows) {
    const group = byProject.get(r.project_id) ?? { name: r.project_name, items: [] };
    group.items.push({
      dayId: r.day_id,
      projectId: r.project_id,
      dateLabel: formatDay(r.work_date),
      person: r.person_name,
      dayState: r.day_state,
      tasks: r.tasks.map((t) => ({
        description: t.description,
        project: "",
        hours: Number(t.hours),
        status: t.status,
        blocker: t.blocker,
      })),
      review: r.review_status ? { status: r.review_status, note: r.review_note } : null,
    });
    byProject.set(r.project_id, group);
  }
  const groups = [...byProject.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AppShell
      profile={profile}
      title="Project review"
      description={`Tasks logged on projects you lead, from the last ${REVIEW_WINDOW_DAYS} days. Each person's line manager still approves the day and sees what you flag.`}
    >
      {error ? (
        <EmptyState title="Couldn't load project tasks">{error.message}</EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState title="Nothing to review yet">Submitted tasks on your projects will show up here.</EmptyState>
      ) : (
        <div className="space-y-12">
          {groups.map((g) => (
            <section key={g.name}>
              <Eyebrow>
                {g.name} ({g.items.length})
              </Eyebrow>
              <ul className="mt-3 space-y-4">
                {g.items.map((item) => (
                  <li key={item.dayId}>
                    <ProjectDayCard item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}

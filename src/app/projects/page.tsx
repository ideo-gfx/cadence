import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, EmptyState, Eyebrow } from "@/components/ui";
import { canEditProjects, createClient, getProfile, homeFor } from "@/lib/supabase/server";
import { AddProjectForm, ProjectRow } from "./forms";

export default async function ProjectsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!canEditProjects(profile)) redirect(homeFor[profile.role]);

  const supabase = await createClient();
  const [{ data }, { data: peopleData }] = await Promise.all([
    supabase.from("projects").select("id, name, active, lead_id").order("active", { ascending: false }).order("name"),
    supabase.from("profiles").select("id, full_name, email").eq("active", true).order("full_name"),
  ]);
  const projects = data ?? [];
  const leads = (peopleData ?? []).map((p) => ({ id: p.id as string, name: (p.full_name || p.email) as string }));

  return (
    <AppShell
      profile={profile}
      title="Projects and clients"
      description="The list people pick from when they log a task. A project’s lead reviews the tasks logged on it. Untick “In use” to hide one without losing its history."
    >
      <section>
        <Eyebrow>Add a project or client</Eyebrow>
        <Card className="mt-3 p-5">
          <AddProjectForm />
        </Card>
      </section>
      <section className="mt-12">
        <Eyebrow>All ({projects.length})</Eyebrow>
        {projects.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="No projects yet">Add the projects and clients your team works on.</EmptyState>
          </div>
        ) : (
          <Card className="mt-3 overflow-hidden">
            <ul className="divide-y divide-line-subtle">
              {projects.map((p) => (
                <li key={p.id} className="p-4">
                  <ProjectRow project={p} leads={leads} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </AppShell>
  );
}

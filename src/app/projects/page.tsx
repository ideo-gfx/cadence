import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, EmptyState, Eyebrow } from "@/components/ui";
import { createClient, getProfile, homeFor } from "@/lib/supabase/server";
import { AddProjectForm, ProjectRow } from "./forms";

export default async function ProjectsPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!(profile.is_admin || profile.role === "manager")) redirect(homeFor[profile.role]);

  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("id, name, active").order("active", { ascending: false }).order("name");
  const projects = data ?? [];

  return (
    <AppShell
      profile={profile}
      title="Projects and clients"
      description="The list people pick from when they log a task. Untick “In use” to hide one without losing its history."
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
                  <ProjectRow project={p} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </AppShell>
  );
}

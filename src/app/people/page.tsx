import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, Eyebrow } from "@/components/ui";
import { createClient, getProfile, homeFor, type Profile } from "@/lib/supabase/server";
import { AddPersonForm, PersonRow } from "./forms";

export default async function PeoplePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.is_admin) redirect(homeFor[profile.role]);

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("active", { ascending: false })
    .order("full_name");
  const people = (data ?? []) as Profile[];
  const managers = people
    .filter((p) => p.active && p.role !== "employee")
    .map((p) => ({ id: p.id, name: p.full_name || p.email }));

  return (
    <AppShell profile={profile} title="People" description="Who can sign in, their role, and who they report to.">
      <section>
        <Eyebrow>Add a person</Eyebrow>
        <Card className="mt-3 p-5">
          <p className="mb-4 text-sm text-fg-secondary">
            Set a starting password and share it with them. They sign in with their email and that password.
          </p>
          <AddPersonForm managers={managers} />
        </Card>
      </section>

      <section className="mt-12">
        <Eyebrow>Everyone ({people.length})</Eyebrow>
        <Card className="mt-3 overflow-hidden">
          <ul className="divide-y divide-line-subtle">
            {people.map((p) => (
              <li key={p.id} className="p-5">
                <PersonRow
                  person={p}
                  isSelf={p.id === profile.id}
                  managers={managers.filter((m) => m.id !== p.id)}
                />
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </AppShell>
  );
}

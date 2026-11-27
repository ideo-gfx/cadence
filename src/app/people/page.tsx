import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
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
    <AppShell profile={profile} title="People">
      <section>
        <h2 className="text-sm font-medium">Add a person</h2>
        <p className="mt-1 text-sm text-neutral-500">
          They sign in from the login page with this email. No password needed.
        </p>
        <div className="mt-3">
          <AddPersonForm managers={managers} />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium">Everyone ({people.length})</h2>
        <ul className="mt-3 divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {people.map((p) => (
            <li key={p.id} className="p-4">
              <PersonRow
                person={p}
                isSelf={p.id === profile.id}
                managers={managers.filter((m) => m.id !== p.id)}
              />
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}

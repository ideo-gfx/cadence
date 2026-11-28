import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Badge, Card, EmptyState, Eyebrow } from "@/components/ui";
import { createClient, getProfile, homeFor, type Profile } from "@/lib/supabase/server";
import { formatDay, teamToday } from "@/lib/workday";
import { BackupApproverForm, ProjectPermissionToggle, RemoveBackupButton } from "./forms";

type Delegation = { manager_id: string; delegate_id: string; starts_on: string; ends_on: string };

const roleLabel = { employee: "Employee", manager: "Manager", executive: "Leadership" } as const;

// What each role can do. Keep in step with the policies in supabase/migrations.
const MATRIX: { what: string; employee: string; manager: string; executive: string; admin: string }[] = [
  { what: "Log and submit their own day", employee: "Yes", manager: "Yes", executive: "No", admin: "Yes" },
  { what: "See days", employee: "Own", manager: "Own and whole team", executive: "Everyone", admin: "Everyone" },
  { what: "Approve or send back days", employee: "As backup", manager: "Direct reports", executive: "As backup", admin: "As manager" },
  { what: "Reopen an approved day", employee: "No", manager: "No", executive: "No", admin: "Yes" },
  { what: "Edit the projects list", employee: "If granted", manager: "Yes", executive: "If granted", admin: "Yes" },
  { what: "Name a backup approver", employee: "No", manager: "Own team", executive: "No", admin: "Any manager" },
  { what: "Get the daily report", employee: "No", manager: "No", executive: "Yes", admin: "On screen" },
  { what: "Add people, roles, reporting lines", employee: "No", manager: "No", executive: "No", admin: "Yes" },
];

function rangeLabel(d: Delegation, today: string) {
  const range = `${formatDay(d.starts_on)} to ${formatDay(d.ends_on)}`;
  if (d.ends_on < today) return { range, tone: "neutral" as const, state: "Ended" };
  if (d.starts_on > today) return { range, tone: "secondary" as const, state: "Upcoming" };
  return { range, tone: "success" as const, state: "Active now" };
}

export default async function AccessPage() {
  const profile = await getProfile();
  if (!profile) redirect("/");
  if (!(profile.role === "manager" || profile.is_admin)) redirect(homeFor[profile.role]);

  const today = teamToday();
  const supabase = await createClient();
  const [{ data: peopleData }, { data: delegationData }] = await Promise.all([
    supabase.from("profiles").select("*").eq("active", true).order("full_name"),
    supabase.from("approval_delegates").select("manager_id, delegate_id, starts_on, ends_on"),
  ]);
  const people = (peopleData ?? []) as Profile[];
  const delegations = (delegationData ?? []) as Delegation[];
  const nameOf = new Map(people.map((p) => [p.id, p.full_name || p.email]));
  const name = (id: string) => nameOf.get(id) ?? "Someone";

  const childrenOf = new Map<string | null, Profile[]>();
  for (const p of people) {
    const key = p.manager_id && nameOf.has(p.manager_id) ? p.manager_id : null;
    childrenOf.set(key, [...(childrenOf.get(key) ?? []), p]);
  }

  // Managers see the tree under them; admins see the whole organisation.
  const isManager = profile.role === "manager";
  const roots = profile.is_admin
    ? (childrenOf.get(null) ?? []).filter((p) => p.role !== "executive" || childrenOf.has(p.id))
    : (childrenOf.get(profile.id) ?? []);
  const leadership = people.filter((p) => p.role === "executive" && !childrenOf.has(p.id));

  const mine = delegations.find((d) => d.manager_id === profile.id) ?? null;
  const covering = delegations.filter((d) => d.delegate_id === profile.id && d.ends_on >= today);
  const others = profile.is_admin ? delegations.filter((d) => d.manager_id !== profile.id) : [];
  const candidates = people
    .filter((p) => p.id !== profile.id)
    .map((p) => ({ id: p.id, name: `${p.full_name || p.email} (${roleLabel[p.role]})` }));
  const hasReports = childrenOf.has(profile.id);

  const renderNode = (p: Profile, depth: number): React.ReactNode => {
    const kids = childrenOf.get(p.id) ?? [];
    const editable = profile.is_admin || p.manager_id === profile.id;
    const projectsByRole = p.is_admin || p.role === "manager";
    return (
      <li key={p.id}>
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-subtle py-3 pr-4"
          style={{ paddingLeft: `${1 + depth * 1.5}rem` }}
        >
          {depth > 0 && <span aria-hidden className="text-muted">↳</span>}
          <span className="text-sm font-medium text-fg">{p.full_name || p.email}</span>
          <Badge tone={p.role === "manager" ? "secondary" : p.role === "executive" ? "primary" : "neutral"}>
            {roleLabel[p.role]}
          </Badge>
          {p.is_admin && <Badge tone="primary">Admin</Badge>}
          {kids.length > 0 && <span className="text-xs text-muted">{kids.length} reporting</span>}
          <span className="sm:ml-auto">
            {projectsByRole ? (
              <span className="text-xs text-muted">Edits projects with their role</span>
            ) : editable ? (
              <ProjectPermissionToggle personId={p.id} name={p.full_name || p.email} allowed={p.can_manage_projects} />
            ) : (
              <span className="text-xs text-muted">{p.can_manage_projects ? "Can edit projects" : "No extra access"}</span>
            )}
          </span>
        </div>
        {kids.length > 0 && <ul>{kids.map((k) => renderNode(k, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <AppShell
      profile={profile}
      title="Access"
      description="Who reports to whom, who can approve, and what each person can do."
    >
      {covering.length > 0 && (
        <Card className="mb-10 border-secondary/40 p-4">
          {covering.map((d) => {
            const r = rangeLabel(d, today);
            return (
              <p key={d.manager_id} className="text-sm text-fg">
                You&apos;re the backup approver for <strong className="font-semibold">{name(d.manager_id)}</strong>&apos;s
                team, {r.range}.{" "}
                {r.state === "Active now" && (
                  <Link href="/team?view=queue" className="text-link hover:underline">
                    Review their days
                  </Link>
                )}
              </p>
            );
          })}
        </Card>
      )}

      {isManager && (
        <section>
          <Eyebrow>Backup approver</Eyebrow>
          <Card className="mt-3 p-5">
            {hasReports ? (
              <>
                <p className="mb-4 text-sm text-fg-secondary">
                  When you&apos;re away, this person can approve or send back your team&apos;s days. They can&apos;t
                  approve their own.
                  {mine && (
                    <>
                      {" "}
                      Now: <strong className="font-medium text-fg">{name(mine.delegate_id)}</strong>,{" "}
                      {rangeLabel(mine, today).range} ({rangeLabel(mine, today).state.toLowerCase()}).
                    </>
                  )}
                </p>
                <BackupApproverForm
                  candidates={candidates}
                  today={today}
                  current={mine && { delegateId: mine.delegate_id, startsOn: mine.starts_on, endsOn: mine.ends_on }}
                />
              </>
            ) : (
              <p className="text-sm text-fg-secondary">Once people report to you, you can name a backup here.</p>
            )}
          </Card>
        </section>
      )}

      {others.length > 0 && (
        <section className={isManager ? "mt-12" : ""}>
          <Eyebrow>Backup approvers across the team</Eyebrow>
          <Card className="mt-3 overflow-hidden">
            <ul className="divide-y divide-line-subtle">
              {others.map((d) => {
                const r = rangeLabel(d, today);
                return (
                  <li key={d.manager_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-4">
                    <span className="text-sm text-fg">
                      <strong className="font-medium">{name(d.delegate_id)}</strong> approves for {name(d.manager_id)}
                    </span>
                    <span className="text-xs text-muted">{r.range}</span>
                    <Badge tone={r.tone}>{r.state}</Badge>
                    <span className="sm:ml-auto">
                      <RemoveBackupButton managerId={d.manager_id} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      )}

      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <Eyebrow>{profile.is_admin ? "Reporting lines" : "Your team"}</Eyebrow>
          {profile.is_admin && (
            <Link href="/people" className="text-sm text-link hover:underline">
              Change roles and reporting lines
            </Link>
          )}
        </div>
        {roots.length === 0 ? (
          <div className="mt-3">
            <EmptyState title="Nobody reports to you yet">
              An admin can set who reports to you on the People screen.
            </EmptyState>
          </div>
        ) : (
          <Card className="mt-3 overflow-hidden">
            <ul className="-mb-px">{roots.map((p) => renderNode(p, 0))}</ul>
          </Card>
        )}
        {profile.is_admin && leadership.length > 0 && (
          <p className="mt-3 text-xs text-muted">
            Leadership (gets the daily report): {leadership.map((p) => p.full_name || p.email).join(", ")}
          </p>
        )}
        <p className="mt-3 text-xs text-muted">
          {profile.is_admin
            ? "Tick “Can edit projects” to let someone add and edit projects without being a manager."
            : "You can let your direct reports edit the projects list. Roles and reporting lines are set by an admin."}
        </p>
      </section>

      <section className="mt-12">
        <Eyebrow>What each role can do</Eyebrow>
        <Card className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead>
              <tr className="border-b border-line-subtle text-xs text-muted">
                <th className="p-3 font-medium"> </th>
                <th className="p-3 font-medium">Employee</th>
                <th className="p-3 font-medium">Manager</th>
                <th className="p-3 font-medium">Leadership</th>
                <th className="p-3 font-medium">Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {MATRIX.map((m) => (
                <tr key={m.what}>
                  <td className="p-3 text-fg">{m.what}</td>
                  <td className="p-3 text-fg-secondary">{m.employee}</td>
                  <td className="p-3 text-fg-secondary">{m.manager}</td>
                  <td className="p-3 text-fg-secondary">{m.executive}</td>
                  <td className="p-3 text-fg-secondary">{m.admin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </AppShell>
  );
}

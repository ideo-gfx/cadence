import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DayStrip } from "@/components/DayStrip";
import { TaskList } from "@/components/TaskList";
import { Badge, Card, Eyebrow, cx } from "@/components/ui";
import { emailConfigured } from "@/lib/email";
import { buildReport, type ReportTeam } from "@/lib/report";
import { createClient, getProfile, homeFor } from "@/lib/supabase/server";
import { addDays, dayStatusLabel, formatDay, formatHours, isIsoDate, isWorkingDay, teamToday } from "@/lib/workday";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "executive" && !profile.is_admin) redirect(homeFor[profile.role]);

  const today = teamToday();
  const { date: asked } = await searchParams;
  const date = isIsoDate(asked) && asked <= today ? asked : today;

  const supabase = await createClient();
  const report = await buildReport(supabase, date, { today });
  const t = report.totals;

  // The last ten working days, newest first.
  const strip: string[] = [];
  for (let d = today; strip.length < 10; d = addDays(d, -1)) if (isWorkingDay(d)) strip.push(d);
  if (!strip.includes(date)) strip.unshift(date);

  return (
    <AppShell
      profile={profile}
      title="Daily report"
      description={formatDay(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
    >
      <DayStrip
        today={today}
        current={date}
        days={strip.map((d) => ({
          date: d,
          href: d === today ? "/reports" : `/reports?date=${d}`,
          label: d === today ? "Live" : "Report",
        }))}
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={report.closed ? "success" : "secondary"}>{report.closed ? "Sent at 9 PM" : "In progress"}</Badge>
          {!report.closed && (
            <span className="text-xs text-muted">
              {date === today ? "Closes at 9 PM. This shows what's approved so far." : "No report went out for this day."}
            </span>
          )}
          {profile.is_admin && !emailConfigured() && (
            <span className="text-xs text-muted sm:ml-auto">Email is off until Resend is set up.</span>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label="Approved" value={`${t.approved} of ${t.people}`} />
          <Stat label="Hours logged" value={formatHours(t.hours)} />
          <Stat label="On leave" value={String(t.onLeave)} />
          <Stat label="Waiting" value={String(t.waiting)} />
          <Stat label="Not submitted" value={String(t.notSubmitted)} tone={t.notSubmitted ? "warning" : undefined} />
        </dl>
      </Card>

      {report.teams.map((team) => (
        <TeamSection key={team.managerName} team={team} />
      ))}

      {report.late.length > 0 && (
        <section className="mt-10">
          <Eyebrow>Late approvals</Eyebrow>
          <p className="mt-1 text-sm text-fg-secondary">Earlier days approved after their own report went out.</p>
          <Card className="mt-3 overflow-hidden">
            <ul className="divide-y divide-line-subtle">
              {report.late.map((p) => (
                <li key={`${p.id}-${p.workDate}`} className="flex flex-wrap items-baseline gap-x-3 px-4 py-3">
                  <span className="text-sm font-medium text-fg">{p.name}</span>
                  <span className="text-sm text-muted">{formatDay(p.workDate)}</span>
                  <span className="ml-auto text-sm text-fg">
                    {p.tasks.length ? formatHours(p.hours) : p.status ? dayStatusLabel[p.status] : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </AppShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warning" }) {
  return (
    <div>
      <dt className="text-2xs text-muted">{label}</dt>
      <dd className={cx("text-lg font-semibold", tone === "warning" ? "text-warning" : "text-fg")}>{value}</dd>
    </div>
  );
}

function TeamSection({ team }: { team: ReportTeam }) {
  const working = team.approved.filter((p) => !team.onLeave.includes(p));
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-fg">{team.managerName}</h2>
        <span className="text-sm text-fg-secondary">
          {team.approved.length} of {team.people.length} approved · {formatHours(team.hours)}
        </span>
      </div>

      {working.length > 0 && (
        <Card className="mt-3 overflow-hidden">
          <ul className="divide-y divide-line-subtle">
            {working.map((p) => (
              <li key={p.id}>
                <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-3">
                  <span className="text-sm font-medium text-fg">{p.name}</span>
                  {p.status && p.status !== "working" && <span className="text-xs text-muted">{dayStatusLabel[p.status]}</span>}
                  <span className="ml-auto text-sm font-medium text-fg">{formatHours(p.hours)}</span>
                </div>
                <TaskList tasks={p.tasks} />
                {p.note && <p className="px-4 pb-3 text-xs text-fg-secondary">Note: {p.note}</p>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {team.projectHours.length > 0 && (
          <Mini title="Hours by project">
            {team.projectHours.map((p) => (
              <li key={p.project} className="flex justify-between gap-3">
                <span>{p.project}</span>
                <span className="font-medium">{formatHours(p.hours)}</span>
              </li>
            ))}
          </Mini>
        )}
        {team.blockers.length > 0 && (
          <Mini title="Blockers">
            {team.blockers.map((b, i) => (
              <li key={i}>
                <span className="font-medium">{b.person}</span>, {b.description}: <span className="text-danger">{b.blocker}</span>
              </li>
            ))}
          </Mini>
        )}
        {team.onLeave.length > 0 && (
          <Mini title="On leave">
            {team.onLeave.map((p) => (
              <li key={p.id}>
                {p.name} <span className="text-muted">({dayStatusLabel[p.status!]})</span>
              </li>
            ))}
          </Mini>
        )}
        {(team.waiting.length > 0 || team.notSubmitted.length > 0) && (
          <Mini title="Not in the report yet">
            {team.waiting.map((p) => (
              <li key={p.id}>
                {p.name} <span className="text-muted">(waiting for approval)</span>
              </li>
            ))}
            {team.notSubmitted.map((p) => (
              <li key={p.id}>
                {p.name} <span className="text-muted">(not submitted)</span>
              </li>
            ))}
          </Mini>
        )}
      </div>
    </section>
  );
}

function Mini({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <Eyebrow>{title}</Eyebrow>
      <ul className="mt-2 space-y-1 text-sm text-fg">{children}</ul>
    </Card>
  );
}

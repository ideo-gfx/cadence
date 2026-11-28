import type { SupabaseClient } from "@supabase/supabase-js";
import { esc, sendEmail, siteUrl } from "./email";
import { buildReport } from "./report";
import { reportHtml, reportSubject, reportText } from "./report-email";
import { formatDay, isWorkingDay } from "./workday";

// Scheduled jobs. Each runs at most once per date and kind (report_runs).
// Pass the service-role client: these read and stamp everyone's days.

export type JobKind = "report" | "reminder_people" | "reminder_managers";
export type JobResult = { kind: JobKind; date: string; status: "done" | "skipped"; detail: string };

/** Claims today's run, or returns false if it already ran. */
async function claim(db: SupabaseClient, date: string, kind: JobKind) {
  const { error } = await db.from("report_runs").insert({ run_date: date, kind });
  if (!error) return true;
  if (error.code === "23505") return false; // already ran
  throw new Error(error.message);
}

async function finish(db: SupabaseClient, date: string, kind: JobKind, emailed: boolean, recipients: number) {
  await db.from("report_runs").update({ emailed, recipients }).eq("run_date", date).eq("kind", kind);
}

const skip = (kind: JobKind, date: string, detail: string): JobResult => ({ kind, date, status: "skipped", detail });

/** 9 PM: close today's report, then email it to leadership. */
export async function runDailyReport(db: SupabaseClient, today: string): Promise<JobResult> {
  const kind = "report";
  if (!isWorkingDay(today)) return skip(kind, today, "Not a working day; approvals roll into the next report.");
  if (!(await claim(db, today, kind))) return skip(kind, today, "Already sent.");

  // Stamp every approved day not yet reported, including late ones from earlier dates.
  const { error } = await db
    .from("days")
    .update({ reported_on: today })
    .eq("state", "approved")
    .is("reported_on", null)
    .lte("work_date", today);
  if (error) throw new Error(error.message);

  const report = await buildReport(db, today, { today });
  const { data: leaders } = await db.from("profiles").select("email").eq("role", "executive").eq("active", true);
  const to = (leaders ?? []).map((l) => l.email as string);
  const res = await sendEmail({ to, subject: reportSubject(report), html: reportHtml(report), text: reportText(report) });
  await finish(db, today, kind, res.sent, to.length);
  return {
    kind,
    date: today,
    status: "done",
    detail: res.sent ? `Emailed ${to.length} leader(s).` : `Report closed; email not sent (${res.error ?? "email is off"}).`,
  };
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#b92d63;color:#fff;text-decoration:none;border-radius:8px;padding:10px 16px;font-family:Arial,sans-serif;font-size:14px">${esc(label)}</a>`;

const shell = (body: string) =>
  `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px 16px;background:#f7f7f5"><div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e5e5e0;border-radius:12px;padding:24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#171717">${body}</div></body></html>`;

/** 6:30 PM: nudge everyone who hasn't submitted today. */
export async function remindPeople(db: SupabaseClient, today: string): Promise<JobResult> {
  const kind = "reminder_people";
  if (!isWorkingDay(today)) return skip(kind, today, "Not a working day.");
  if (!(await claim(db, today, kind))) return skip(kind, today, "Already sent.");

  const [{ data: people }, { data: days }] = await Promise.all([
    db.from("profiles").select("id, email").eq("active", true).neq("role", "executive"),
    db.from("days").select("user_id, state").eq("work_date", today).in("state", ["submitted", "approved"]),
  ]);
  const done = new Set((days ?? []).map((d) => d.user_id as string));
  const to = (people ?? []).filter((p) => !done.has(p.id)).map((p) => p.email as string);
  const res = await sendEmail({
    to,
    subject: `Log your day in Cadence · ${formatDay(today)}`,
    html: shell(
      `<p style="margin:0 0 16px">You haven't submitted today's tasks yet. It takes a minute, and your manager approves them tonight.</p>${button(`${siteUrl()}/entry`, "Log today")}`,
    ),
    text: `You haven't submitted today's tasks yet. Log them here: ${siteUrl()}/entry`,
  });
  await finish(db, today, kind, res.sent, to.length);
  return { kind, date: today, status: "done", detail: `${to.length} reminder(s)${res.sent ? " sent" : " (email off)"}.` };
}

/** 8 PM: nudge managers who have days waiting for approval. */
export async function remindManagers(db: SupabaseClient, today: string): Promise<JobResult> {
  const kind = "reminder_managers";
  if (!isWorkingDay(today)) return skip(kind, today, "Not a working day.");
  if (!(await claim(db, today, kind))) return skip(kind, today, "Already sent.");

  const [{ data: waiting }, { data: profiles }, { data: backups }] = await Promise.all([
    db.from("days").select("user_id").eq("state", "submitted"),
    db.from("profiles").select("id, email, manager_id, active"),
    db.from("approval_delegates").select("manager_id, delegate_id").lte("starts_on", today).gte("ends_on", today),
  ]);
  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]));
  // A manager's backup approver gets the same nudge while the backup is active.
  const backupOf = new Map((backups ?? []).map((b) => [b.manager_id as string, b.delegate_id as string]));
  const countByManager = new Map<string, number>();
  const bump = (id: string) => countByManager.set(id, (countByManager.get(id) ?? 0) + 1);
  for (const d of waiting ?? []) {
    const managerId = byId.get(d.user_id)?.manager_id as string | null;
    if (!managerId) continue;
    bump(managerId);
    const backup = backupOf.get(managerId);
    if (backup && backup !== d.user_id) bump(backup);
  }

  let sent = 0;
  let emailed = false;
  for (const [managerId, n] of countByManager) {
    const manager = byId.get(managerId);
    if (!manager?.active) continue;
    const res = await sendEmail({
      to: [manager.email as string],
      subject: `${n} day${n === 1 ? "" : "s"} waiting for your approval`,
      html: shell(
        `<p style="margin:0 0 16px">${n} day${n === 1 ? " is" : "s are"} waiting for your approval. The daily report goes to leadership at 9 PM.</p>${button(`${siteUrl()}/team`, "Review and approve")}`,
      ),
      text: `${n} day(s) waiting for your approval: ${siteUrl()}/team`,
    });
    sent++;
    emailed ||= res.sent;
  }
  await finish(db, today, kind, emailed, sent);
  return { kind, date: today, status: "done", detail: `${sent} manager reminder(s)${emailed ? " sent" : " (email off)"}.` };
}

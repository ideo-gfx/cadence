import { esc, siteUrl } from "./email";
import type { DailyReport } from "./report";
import { dayStatusLabel, formatDay, formatHours } from "./workday";

// Plain, inline-styled HTML so it renders the same in Gmail and Outlook.
// Colours follow the Cadence brand kit: #17151b charcoal, #6d6670 muted, #b92d63 magenta.

const C = { fg: "#17151b", muted: "#6d6670", line: "#e5dde5", accent: "#b92d63", danger: "#dc2626", subtle: "#f8f6f9" };
const font = "font-family:'Space Grotesk',Arial,Helvetica,sans-serif;";

function section(title: string, body: string) {
  return `<p style="${font}margin:20px 0 6px;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${C.muted}">${esc(title)}</p>${body}`;
}

function list(items: string[]) {
  if (items.length === 0) return "";
  return `<ul style="${font}margin:0;padding-left:18px;font-size:14px;line-height:1.6;color:${C.fg}">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
}

export function reportSubject(r: DailyReport) {
  return `Cadence daily report · ${formatDay(r.date, { weekday: "short", day: "numeric", month: "short" })}`;
}

export function reportHtml(r: DailyReport) {
  const t = r.totals;
  const summary = `${t.approved} of ${t.people} approved · ${formatHours(t.hours)} logged · ${t.onLeave} on leave · ${t.notSubmitted + t.waiting} not in yet`;

  const teams = r.teams
    .map((team) => {
      const working = team.approved.filter((p) => !team.onLeave.includes(p));
      const rows = working
        .map(
          (p) => `<tr>
            <td style="${font}padding:6px 0;border-top:1px solid ${C.line};font-size:14px;color:${C.fg}">${esc(p.name)}${p.status === "wfh" || p.status === "half_day_leave" ? ` <span style="color:${C.muted}">(${esc(dayStatusLabel[p.status])})</span>` : ""}<br><span style="font-size:13px;color:${C.muted}">${esc(p.tasks.map((x) => x.description).join(" · "))}</span></td>
            <td style="${font}padding:6px 0;border-top:1px solid ${C.line};font-size:14px;color:${C.fg};text-align:right;vertical-align:top;white-space:nowrap">${formatHours(p.hours)}</td>
          </tr>`,
        )
        .join("");
      return `
        <div style="margin-top:28px">
          <p style="${font}margin:0;font-size:17px;font-weight:600;color:${C.fg}">${esc(team.managerName)}</p>
          <p style="${font}margin:2px 0 0;font-size:13px;color:${C.muted}">${team.approved.length} of ${team.people.length} approved · ${formatHours(team.hours)}</p>
          ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;border-collapse:collapse">${rows}</table>` : ""}
          ${team.projectHours.length ? section("Hours by project", list(team.projectHours.map((p) => `${esc(p.project)}: ${formatHours(p.hours)}`))) : ""}
          ${team.blockers.length ? section("Blockers", list(team.blockers.map((b) => `<strong>${esc(b.person)}</strong>, ${esc(b.description)}: <span style="color:${C.danger}">${esc(b.blocker)}</span>`))) : ""}
          ${team.onLeave.length ? section("On leave", list(team.onLeave.map((p) => `${esc(p.name)} (${esc(dayStatusLabel[p.status!])})`))) : ""}
          ${team.waiting.length ? section("Waiting for approval", list(team.waiting.map((p) => esc(p.name)))) : ""}
          ${team.notSubmitted.length ? section("Not submitted", list(team.notSubmitted.map((p) => esc(p.name)))) : ""}
        </div>`;
    })
    .join("");

  const late = r.late.length
    ? `<div style="margin-top:28px">${section(
        "Late approvals",
        list(r.late.map((p) => `${esc(p.name)}, ${formatDay(p.workDate)}: ${p.status && p.tasks.length === 0 ? esc(dayStatusLabel[p.status]) : formatHours(p.hours)}`)),
      )}</div>`
    : "";

  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:${C.subtle}">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border:1px solid ${C.line};border-radius:12px;padding:24px">
      <p style="${font}margin:0;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${C.accent}">Cadence daily report</p>
      <p style="${font}margin:4px 0 0;font-size:24px;font-weight:600;color:${C.fg}">${esc(formatDay(r.date, { weekday: "long", day: "numeric", month: "long" }))}</p>
      <p style="${font}margin:6px 0 0;font-size:14px;color:${C.muted}">${esc(summary)}</p>
      ${teams}
      ${late}
      <p style="${font}margin:28px 0 0;font-size:13px"><a href="${siteUrl()}/reports?date=${r.date}" style="color:${C.accent}">Open in Cadence</a></p>
    </div>
  </div></body></html>`;
}

export function reportText(r: DailyReport) {
  const lines = [`Cadence daily report, ${formatDay(r.date, { weekday: "long", day: "numeric", month: "long" })}`, ""];
  for (const team of r.teams) {
    lines.push(`${team.managerName}: ${team.approved.length} of ${team.people.length} approved, ${formatHours(team.hours)}`);
    for (const p of team.approved) lines.push(`  ${p.name}: ${p.tasks.length ? formatHours(p.hours) : dayStatusLabel[p.status!]}`);
    for (const b of team.blockers) lines.push(`  Blocked: ${b.person}, ${b.description} (${b.blocker})`);
    if (team.notSubmitted.length) lines.push(`  Not submitted: ${team.notSubmitted.map((p) => p.name).join(", ")}`);
    lines.push("");
  }
  if (r.late.length) lines.push(`Late approvals: ${r.late.map((p) => `${p.name} (${formatDay(p.workDate)})`).join(", ")}`);
  lines.push("", `${siteUrl()}/reports?date=${r.date}`);
  return lines.join("\n");
}

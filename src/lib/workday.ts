// Shared rules for the working day. Change the hours here (or with the
// NEXT_PUBLIC_WORKDAY_HOURS env var) if the team's normal day changes.

/** Team hours are 10 AM to 7 PM with an hour for lunch. */
export const WORKDAY_HOURS = Number(process.env.NEXT_PUBLIC_WORKDAY_HOURS ?? 8) || 8;
/** How many days back people can fill in. Must match public.save_day. */
export const BACKFILL_DAYS = 7;
export const TEAM_TIME_ZONE = "Asia/Kolkata";

export type DayStatus = "working" | "wfh" | "half_day_leave" | "full_day_leave" | "holiday";
export type DayState = "draft" | "submitted" | "returned" | "approved";
export type TaskStatus = "done" | "in_progress" | "blocked";

export const dayStatusLabel: Record<DayStatus, string> = {
  working: "Working",
  wfh: "Work from home",
  half_day_leave: "Half day leave",
  full_day_leave: "Full day leave",
  holiday: "Holiday",
};

export const dayStateLabel: Record<DayState, string> = {
  draft: "Draft",
  submitted: "Submitted",
  returned: "Sent back",
  approved: "Approved",
};

export const taskStatusLabel: Record<TaskStatus, string> = {
  done: "Done",
  in_progress: "In progress",
  blocked: "Blocked",
};

/** Days off need no tasks. */
export const isDayOff = (s: DayStatus) => s === "full_day_leave" || s === "holiday";

/** Hours below which we show a soft warning. */
export function expectedHours(s: DayStatus) {
  if (isDayOff(s)) return 0;
  return s === "half_day_leave" ? WORKDAY_HOURS / 2 : WORKDAY_HOURS;
}

/** Today's date in the team's time zone, as YYYY-MM-DD. */
export function teamToday(now = new Date()) {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: TEAM_TIME_ZONE }).format(now);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const isIsoDate = (s: string | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** "Fri 27 Nov" style label for a YYYY-MM-DD date. */
export function formatDay(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export const formatHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, "")}h`;

/**
 * Working days as ISO weekday numbers (1 = Monday ... 7 = Sunday). Monday to
 * Friday by default; set NEXT_PUBLIC_WORK_DAYS=1,2,3,4,5,6 to add Saturday.
 * Reports and reminders only go out on these days.
 */
export const WORK_DAYS = (process.env.NEXT_PUBLIC_WORK_DAYS ?? "1,2,3,4,5")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => n >= 1 && n <= 7);

export function isWorkingDay(date: string) {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
  return WORK_DAYS.includes(dow);
}

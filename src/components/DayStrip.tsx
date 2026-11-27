import Link from "next/link";
import { formatDay } from "@/lib/workday";
import { cx } from "./ui";

export type StripDay = {
  date: string;
  href: string;
  label: string;
  tone?: "muted" | "success" | "danger" | "secondary";
};

const toneClass = {
  muted: "text-muted",
  success: "text-success",
  danger: "text-danger",
  secondary: "text-secondary",
} as const;

/** A row of recent days to jump between, newest first. */
export function DayStrip({ days, current, today }: { days: StripDay[]; current: string; today: string }) {
  return (
    <nav aria-label="Choose a day" className="-mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {days.map((d) => {
        const active = d.date === current;
        return (
          <Link
            key={d.date}
            href={d.href}
            aria-current={active ? "date" : undefined}
            className={cx(
              "flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-lg border px-2 py-1.5 text-center transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-focus",
              active ? "border-primary bg-primary-light" : "border-line-subtle bg-surface hover:bg-subtle",
            )}
          >
            <span className={cx("text-2xs", active ? "text-primary" : "text-muted")}>
              {d.date === today ? "Today" : formatDay(d.date, { weekday: "short" })}
            </span>
            <span className={cx("text-sm font-medium", active ? "text-primary" : "text-fg")}>
              {formatDay(d.date, { day: "numeric", month: "short" })}
            </span>
            <span className={cx("text-2xs", toneClass[d.tone ?? "muted"])}>{d.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

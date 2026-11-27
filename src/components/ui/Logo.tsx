import { cx } from "./cx";

/** Cadence wordmark with a Meld gradient mark. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-semibold tracking-tight text-fg", className)}>
      <span aria-hidden className="size-5 rounded-md bg-[image:var(--meld-gradient)]" />
      Cadence
    </span>
  );
}

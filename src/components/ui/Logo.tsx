import { cx } from "./cx";

/**
 * Cadence's Rhythm mark: three rounded bars (brand/logos). Colours come from
 * --cadence-bar-1..3, which switch for dark backgrounds per the brand kit.
 * Sized by font size, so `text-xl` on the Logo scales both mark and wordmark.
 */
export function RhythmMark({ className }: { className?: string }) {
  return (
    <svg viewBox="4 12 88 80" aria-hidden className={cx("h-[1.15em] w-auto shrink-0", className)}>
      <rect x="8" y="44" width="20" height="44" rx="10" fill="var(--cadence-bar-1)" />
      <rect x="38" y="16" width="20" height="72" rx="10" fill="var(--cadence-bar-2)" />
      <rect x="68" y="30" width="20" height="58" rx="10" fill="var(--cadence-bar-3)" />
    </svg>
  );
}

/** Horizontal logo: Rhythm mark and the Cadence wordmark in Space Grotesk 600. */
export function Logo({ className, markOnly }: { className?: string; markOnly?: boolean }) {
  return (
    <span
      className={cx("inline-flex items-center gap-[0.45em] font-semibold tracking-[-0.03em] text-fg", className)}
      aria-label={markOnly ? "Cadence" : undefined}
    >
      <RhythmMark />
      {!markOnly && "Cadence"}
    </span>
  );
}

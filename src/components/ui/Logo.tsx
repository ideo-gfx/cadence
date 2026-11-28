import { useId } from "react";
import { cx } from "./cx";

/**
 * Cadence's Rhythm mark: three rounded, angled capsules (brand/Logo). Geometry
 * and colours follow the final branding kit; the same colours work on light
 * and dark backgrounds. Sized by font size, so `text-xl` scales it.
 */
export function RhythmMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="-4 15 182 118" aria-hidden className={cx("h-[1.1em] w-auto shrink-0", className)}>
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#B92D63" />
          <stop offset="1" stopColor="#C73870" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#C73870" />
          <stop offset="1" stopColor="#D44784" />
        </linearGradient>
      </defs>
      <rect x="0" y="54" width="36" height="62" rx="18" fill="#B92D63" transform="rotate(-12 18 85)" />
      <rect x="66" y="16" width="48" height="116" rx="24" fill={`url(#${id}a)`} transform="rotate(-12 90 74)" />
      <rect x="132" y="42" width="40" height="84" rx="20" fill={`url(#${id}b)`} transform="rotate(-12 152 84)" />
    </svg>
  );
}

/** Horizontal logo: Rhythm mark and the Cadence wordmark in Geist Bold. */
export function Logo({ className, markOnly }: { className?: string; markOnly?: boolean }) {
  return (
    <span
      className={cx("inline-flex items-center gap-[0.4em] font-bold tracking-[-0.03em] text-fg", className)}
      aria-label={markOnly ? "Cadence" : undefined}
    >
      <RhythmMark />
      {!markOnly && "Cadence"}
    </span>
  );
}

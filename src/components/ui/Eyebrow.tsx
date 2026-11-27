import { cx } from "./cx";

/** Meld's small uppercase label, used above headings and for section titles. */
export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cx("text-2xs font-semibold uppercase leading-snug tracking-wider text-muted", className)} {...props} />
  );
}

import { cx } from "./cx";

const tones = {
  success: "text-success",
  danger: "text-danger",
  info: "text-fg-secondary",
} as const;

/** A short status line, such as "Saved" or an error. */
export function Notice({
  tone = "info",
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement> & { tone?: keyof typeof tones }) {
  return <p role="status" className={cx("text-xs", tones[tone], className)} {...props} />;
}

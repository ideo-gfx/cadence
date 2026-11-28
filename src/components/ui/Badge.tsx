import { cx } from "./cx";

const tones = {
  neutral: "bg-subtle text-fg-secondary",
  primary: "bg-primary-light text-primary",
  secondary: "bg-secondary-light text-secondary",
  success: "bg-success/12 text-success",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

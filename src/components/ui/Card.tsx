import { cx } from "./cx";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-xl border border-line-subtle bg-surface shadow-meld-sm", className)} {...props} />;
}

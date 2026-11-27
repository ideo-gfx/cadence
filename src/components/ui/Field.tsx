import { cx } from "./cx";

const control = cx(
  "h-10 w-full rounded-lg border border-control-line bg-control px-3 text-sm text-fg",
  "placeholder:text-placeholder transition-colors hover:border-line-interactive",
  "outline-none focus:border-focus focus:ring-3 focus:ring-focus/20",
  "disabled:cursor-not-allowed disabled:opacity-60",
);

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(control, className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx(control, "pr-8", className)} {...props} />;
}

export function Checkbox({
  label,
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { label: React.ReactNode }) {
  return (
    <label className={cx("inline-flex items-center gap-2 text-sm text-fg", props.disabled && "opacity-60", className)}>
      <input type="checkbox" className="size-4 rounded accent-primary" {...props} />
      {label}
    </label>
  );
}

/** A labelled form control, with optional hint text. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

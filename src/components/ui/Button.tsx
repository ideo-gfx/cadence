import { cx } from "./cx";

const variants = {
  // Meld primary: brand pink, white text.
  primary: "bg-primary text-on-brand hover:bg-primary-hover",
  // Meld secondary: outlined on the surface.
  secondary: "border border-line-strong bg-surface text-fg hover:bg-subtle",
  // Low-emphasis, for headers and inline actions.
  ghost: "text-fg-secondary hover:bg-hover hover:text-fg",
} as const;

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-md",
} as const;

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  fullWidth?: boolean;
};

export const buttonClass = ({
  variant = "primary",
  size = "md",
  fullWidth,
}: Pick<ButtonProps, "variant" | "size" | "fullWidth"> = {}) =>
  cx(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium leading-tight transition-colors",
    "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-page",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
  );

export function Button({ variant, size, fullWidth, className, ...props }: ButtonProps) {
  return <button className={cx(buttonClass({ variant, size, fullWidth }), className)} {...props} />;
}

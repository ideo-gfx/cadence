import { Card } from "./Card";

/** Placeholder for a screen or list with nothing in it yet. */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Card className="bg-[image:var(--meld-gradient-subtle)] px-6 py-12 text-center">
      <p className="text-lg font-medium text-fg">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-sm text-sm text-fg-secondary">{children}</p>}
    </Card>
  );
}

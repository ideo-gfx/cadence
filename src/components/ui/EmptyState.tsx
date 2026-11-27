import { Card } from "./Card";
import { RhythmMark } from "./Logo";

/** Placeholder for a screen or list with nothing in it yet. */
export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Card className="bg-[image:var(--brand-tint)] px-6 py-12 text-center">
      <RhythmMark className="mx-auto mb-4 text-3xl opacity-80" />
      <p className="text-lg font-medium text-fg">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-sm text-sm text-fg-secondary">{children}</p>}
    </Card>
  );
}

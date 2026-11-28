// Shown the moment you open a screen, while its data loads.
export default function Loading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-subtle" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded bg-subtle" />
      <div className="mt-8 space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-line-subtle bg-surface" />
        ))}
      </div>
    </main>
  );
}

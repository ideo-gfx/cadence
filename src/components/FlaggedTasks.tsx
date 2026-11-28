/** The tasks a reviewer pointed at when sending a day back. */
export function FlaggedTasks({ tasks, bare }: { tasks: { description: string; note: string }[]; bare?: boolean }) {
  return (
    <div className={bare ? "mt-3" : "border-t border-line-subtle px-4 py-3"}>
      <p className="text-xs text-muted">Tasks to change</p>
      <ul className="mt-1.5 space-y-1.5">
        {tasks.map((t, i) => (
          <li key={i} className="text-sm">
            <span className="font-medium text-fg">{t.description}</span>
            {t.note && <span className="text-fg-secondary">: {t.note}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

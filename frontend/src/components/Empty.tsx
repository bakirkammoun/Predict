export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center text-slate-500 dark:border-slate-700 dark:bg-anthracite-800/50 dark:text-slate-400">
      <p className="font-medium text-slate-700 dark:text-slate-200">{title}</p>
      {hint ? <p className="mt-1 text-sm">{hint}</p> : null}
    </div>
  );
}

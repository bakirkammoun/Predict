import { ArrowUpRight, type LucideIcon } from "lucide-react";

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  accent = "violet",
}: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  accent?: "violet" | "blue" | "green" | "orange";
}) {
  return (
    <article className={`metric-card metric-card-${accent}`}>
      <div className="metric-card-top">
        <span className="metric-icon">
          <Icon size={20} />
        </span>
        <span className="metric-ring" aria-hidden="true">
          <ArrowUpRight size={15} />
        </span>
      </div>
      <p className="metric-value">{value}</p>
      <p className="metric-title">{title}</p>
      {hint ? <p className="metric-hint">{hint}</p> : null}
    </article>
  );
}

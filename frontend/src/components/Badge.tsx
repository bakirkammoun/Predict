import { healthLabel, statusClass } from "../lib/format";

export function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass(value)}`}>
      {healthLabel(value)}
    </span>
  );
}

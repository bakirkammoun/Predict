export function healthLabel(s: string) {
  const map: Record<string, string> = {
    normal: "Normal",
    warning: "Vigilance",
    critical: "Critique",
    offline: "Hors ligne",
    sensor_error: "Capteur en erreur",
    inactive: "Hors service",
    hardware: "HARDWARE_REAL",
    simulation: "SIMULATION",
    new: "Nouvelle",
    acknowledged: "Reconnue",
    in_progress: "En cours",
    resolved: "Résolue",
    planned: "Planifiée",
    todo: "À faire",
    on_hold: "En attente",
    completed: "Terminée",
    cancelled: "Annulée",
  };
  return map[s] ?? s;
}

export function statusClass(s: string) {
  const map: Record<string, string> = {
    normal: "bg-green-100 text-green-800",
    warning: "bg-amber-100 text-amber-900",
    critical: "bg-red-100 text-red-800",
    offline: "bg-slate-200 text-slate-700",
    sensor_error: "bg-cyan-100 text-cyan-900",
    hardware: "bg-emerald-100 text-emerald-900",
    simulation: "bg-amber-100 text-amber-900",
    new: "bg-sky-100 text-sky-800",
    acknowledged: "bg-blue-100 text-blue-800",
    in_progress: "bg-sky-100 text-sky-800",
    resolved: "bg-emerald-100 text-emerald-800",
    planned: "bg-slate-100 text-slate-700",
    todo: "bg-sky-100 text-sky-800",
    on_hold: "bg-orange-100 text-orange-800",
    completed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-slate-200 text-slate-600",
  };
  return map[s] ?? "bg-slate-100 text-slate-700";
}

export function when(d?: string | Date) {
  if (!d) return "—";
  return new Date(d).toLocaleString("fr-FR");
}

export function pct(n: number) {
  return `${Math.round(n * 1000) / 10} %`;
}

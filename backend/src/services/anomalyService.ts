export type MetricName = "vibration" | "temperature" | "current";
export type Level = "normal" | "warning" | "critical" | "invalid";

export interface MetricThresholds {
  unit: string;
  validMin: number;
  validMax: number;
  warningMin?: number;
  warningMax: number;
  criticalMin?: number;
  criticalMax: number;
}

export interface ConsecutiveCounters {
  warning: number;
  critical: number;
  normal: number;
}

export interface MachineThresholds {
  vibration: MetricThresholds;
  temperature: MetricThresholds;
  current: MetricThresholds;
}

export function toMetricThresholds(raw: {
  unit: string;
  validMin: number;
  validMax: number;
  warningMax: number;
  criticalMax: number;
  warningMin?: number | null;
  criticalMin?: number | null;
}): MetricThresholds {
  return {
    unit: raw.unit,
    validMin: raw.validMin,
    validMax: raw.validMax,
    warningMax: raw.warningMax,
    criticalMax: raw.criticalMax,
    warningMin: raw.warningMin ?? undefined,
    criticalMin: raw.criticalMin ?? undefined,
  };
}

export function classifyMetric(value: number, t: MetricThresholds): Level {
  if (!Number.isFinite(value) || value < t.validMin || value > t.validMax) {
    return "invalid";
  }
  const overCritical = value >= t.criticalMax || (t.criticalMin !== undefined && value <= t.criticalMin);
  if (overCritical) return "critical";
  const overWarning = value >= t.warningMax || (t.warningMin !== undefined && value <= t.warningMin);
  if (overWarning) return "warning";
  return "normal";
}

export function applyHysteresis(
  instantaneous: Level,
  counters: ConsecutiveCounters,
  confirmationCount: number,
  hysteresisCount: number,
  previousConfirmed: Level,
): { confirmed: Level; counters: ConsecutiveCounters } {
  const next: ConsecutiveCounters = { warning: 0, critical: 0, normal: 0 };
  if (instantaneous === "invalid") {
    return { confirmed: previousConfirmed === "invalid" ? "normal" : previousConfirmed, counters };
  }
  if (instantaneous === "critical") next.critical = counters.critical + 1;
  else if (instantaneous === "warning") next.warning = counters.warning + 1;
  else next.normal = counters.normal + 1;

  if (next.critical >= confirmationCount) {
    return { confirmed: "critical", counters: next };
  }
  if (previousConfirmed === "critical") {
    if (instantaneous === "normal" && next.normal >= hysteresisCount) {
      return { confirmed: "normal", counters: next };
    }
    if (instantaneous === "warning" && next.warning >= hysteresisCount) {
      return { confirmed: "warning", counters: next };
    }
    return { confirmed: "critical", counters: next };
  }
  if (next.warning >= confirmationCount) {
    return { confirmed: "warning", counters: next };
  }
  if (previousConfirmed === "warning") {
    if (instantaneous === "normal" && next.normal >= hysteresisCount) {
      return { confirmed: "normal", counters: next };
    }
    return { confirmed: "warning", counters: next };
  }
  return { confirmed: "normal", counters: next };
}

export function worstLevel(levels: Level[]): Exclude<Level, "invalid"> {
  if (levels.includes("critical")) return "critical";
  if (levels.includes("warning")) return "warning";
  return "normal";
}

/** Indicateur heuristique (non ML) : 0–100 à partir des écarts aux seuils d'avertissement. */
export function heuristicRiskScore(
  values: { vibration: number; temperature: number; current: number },
  thresholds: MachineThresholds,
): number {
  const ratios = (["vibration", "temperature", "current"] as const).map((k) => {
    const t = thresholds[k];
    const v = values[k];
    if (t.criticalMin !== undefined && v <= t.criticalMin) return 1.5;
    if (t.warningMin !== undefined && v <= t.warningMin) {
      return Math.min(1.5, t.warningMin / Math.max(v, Number.EPSILON));
    }
    if (t.warningMax <= 0) return 0;
    return Math.min(1.5, Math.max(0, v / t.warningMax));
  });
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  return Math.round(Math.min(100, (avg / 1.2) * 100));
}

export function alertFingerprint(machineId: string, parameter: string, severity: string) {
  return `${machineId}:${parameter}:${severity}`;
}

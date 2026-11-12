import { describe, expect, it } from "vitest";
import {
  applyHysteresis,
  classifyMetric,
  alertFingerprint,
  heuristicRiskScore,
  worstLevel,
  type MetricThresholds,
} from "./anomalyService.js";

const t: MetricThresholds = {
  unit: "g",
  validMin: 0,
  validMax: 20,
  warningMax: 0.8,
  criticalMax: 1.5,
};

describe("classifyMetric", () => {
  it("classe normal / warning / critical / invalid", () => {
    expect(classifyMetric(0.2, t)).toBe("normal");
    expect(classifyMetric(0.9, t)).toBe("warning");
    expect(classifyMetric(1.6, t)).toBe("critical");
    expect(classifyMetric(-1, t)).toBe("invalid");
    expect(classifyMetric(50, t)).toBe("invalid");
  });

  it("classe les seuils bas du courant", () => {
    const current: MetricThresholds = {
      unit: "A",
      validMin: 0,
      validMax: 100,
      warningMin: 1.5,
      warningMax: 8,
      criticalMin: 0.5,
      criticalMax: 12,
    };
    expect(classifyMetric(1, current)).toBe("warning");
    expect(classifyMetric(0.3, current)).toBe("critical");
    expect(classifyMetric(3, current)).toBe("normal");
  });
});

describe("applyHysteresis", () => {
  it("exige plusieurs mesures avant de confirmer un état critique", () => {
    let counters = { warning: 0, critical: 0, normal: 0 };
    let confirmed: ReturnType<typeof applyHysteresis>["confirmed"] = "normal";
    for (let i = 0; i < 2; i++) {
      const r = applyHysteresis("critical", counters, 3, 2, confirmed);
      counters = r.counters;
      confirmed = r.confirmed;
    }
    expect(confirmed).toBe("normal");
    const r3 = applyHysteresis("critical", counters, 3, 2, confirmed);
    expect(r3.confirmed).toBe("critical");
  });

  it("revient à normal après hystérésis", () => {
    const r1 = applyHysteresis("normal", { warning: 0, critical: 0, normal: 0 }, 3, 2, "critical");
    expect(r1.confirmed).toBe("critical");
    const r2 = applyHysteresis("normal", r1.counters, 3, 2, r1.confirmed);
    expect(r2.confirmed).toBe("normal");
  });
});

describe("worstLevel", () => {
  it("prend le plus sévère", () => {
    expect(worstLevel(["normal", "warning", "critical"])).toBe("critical");
    expect(worstLevel(["normal", "warning"])).toBe("warning");
  });
});

describe("alertFingerprint", () => {
  it("déduplique une anomalie persistante", () => {
    expect(alertFingerprint("m1", "temperature", "warning")).toBe("m1:temperature:warning");
    expect(alertFingerprint("m1", "temperature", "critical")).not.toBe(
      alertFingerprint("m1", "temperature", "warning"),
    );
  });
});

describe("heuristicRiskScore", () => {
  it("reste borné 0-100", () => {
    const score = heuristicRiskScore(
      { vibration: 0.2, temperature: 30, current: 3 },
      {
        vibration: t,
        temperature: { unit: "C", validMin: 0, validMax: 150, warningMax: 70, criticalMax: 90 },
        current: { unit: "A", validMin: 0, validMax: 100, warningMax: 8, criticalMax: 12 },
      },
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("augmente le risque lorsque le courant est anormalement faible", () => {
    const thresholds = {
      vibration: t,
      temperature: { unit: "C", validMin: 0, validMax: 150, warningMax: 70, criticalMax: 90 },
      current: {
        unit: "A",
        validMin: 0,
        validMax: 100,
        warningMin: 1.5,
        warningMax: 8,
        criticalMin: 0.5,
        criticalMax: 12,
      },
    };
    const lowCurrentRisk = heuristicRiskScore(
      { vibration: 0.2, temperature: 30, current: 0.2 },
      thresholds,
    );
    const normalCurrentRisk = heuristicRiskScore(
      { vibration: 0.2, temperature: 30, current: 3 },
      thresholds,
    );
    expect(lowCurrentRisk).toBeGreaterThan(normalCurrentRisk);
  });
});

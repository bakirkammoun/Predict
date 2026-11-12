import { describe, expect, it } from "vitest";
import { healthLabel, pct, statusClass } from "./format";

describe("format", () => {
  it("traduit les états", () => {
    expect(healthLabel("critical")).toBe("Critique");
    expect(healthLabel("hardware")).toBe("HARDWARE_REAL");
    expect(healthLabel("simulation")).toBe("SIMULATION");
    expect(healthLabel("sensor_error")).toBe("Capteur en erreur");
  });
  it("affiche un pourcentage", () => {
    expect(pct(0.876)).toBe("87.6 %");
  });
  it("associe une classe de badge", () => {
    expect(statusClass("critical")).toContain("bg-red");
  });
});

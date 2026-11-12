import { describe, expect, it } from "vitest";
import { telemetrySchema } from "./telemetry.js";

describe("telemetrySchema", () => {
  it("accepte un message conforme", () => {
    const parsed = telemetrySchema.parse({
      deviceId: "ESP32-001",
      timestamp: "2026-10-10T10:30:00.000Z",
      vibration: { value: 0.42, unit: "g" },
      temperature: { value: 48.5, unit: "C" },
      current: { value: 3.2, unit: "A" },
      source: "simulation",
    });
    expect(parsed.deviceId).toBe("ESP32-001");
  });

  it("accepte le format imbriqué measurements et HARDWARE_REAL", () => {
    const parsed = telemetrySchema.parse({
      deviceId: "ESP32-001",
      machineId: "MACHINE-001",
      timestamp: "2026-10-10T12:00:00.000Z",
      measurements: {
        vibration: { value: 2.4, unit: "mm/s" },
        temperature: { value: 48.5, unit: "°C" },
        current: { value: 3.2, unit: "A" },
      },
      source: "HARDWARE_REAL",
    });
    expect(parsed.source).toBe("hardware");
    expect(parsed.temperature.unit).toBe("C");
    expect(parsed.vibration.unit).toBe("mm/s");
  });

  it("accepte et normalise l'humidité dans le format imbriqué", () => {
    const parsed = telemetrySchema.parse({
      deviceId: "ESP32-001",
      measurements: {
        vibration: { value: 1, unit: "detection" },
        temperature: { value: 48.5, unit: "C" },
        humidity: { value: 55, unit: "%" },
        current: { value: 3.2, unit: "A" },
      },
      source: "hardware",
    });
    expect(parsed.humidity).toEqual({ value: 55, unit: "%" });
  });

  it("refuse une humidité hors de la plage du DHT22", () => {
    expect(() =>
      telemetrySchema.parse({
        deviceId: "ESP32-001",
        vibration: { value: 0, unit: "detection" },
        temperature: { value: 24, unit: "C" },
        humidity: { value: 105, unit: "%" },
        current: { value: 0, unit: "A" },
        source: "hardware",
      }),
    ).toThrow();
  });

  it("refuse une mesure mal formée", () => {
    expect(() =>
      telemetrySchema.parse({
        deviceId: "ESP32-001",
        timestamp: "not-a-date",
        vibration: { value: 0.42, unit: "g" },
      }),
    ).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { digestTelemetryMessage } from "./messageId.js";

describe("digestTelemetryMessage", () => {
  it("réutilise messageId s'il est fourni", () => {
    expect(
      digestTelemetryMessage({
        hardwareId: "ESP32-001",
        vibration: 0.4,
        temperature: 40,
        current: 3,
        messageId: "abc",
      }),
    ).toBe("abc");
  });

  it("produit le même hash pour un doublon", () => {
    const a = digestTelemetryMessage({
      hardwareId: "ESP32-001",
      timestamp: "2026-10-10T10:30:00.000Z",
      vibration: 0.42,
      temperature: 48.5,
      current: 3.2,
    });
    const b = digestTelemetryMessage({
      hardwareId: "ESP32-001",
      timestamp: "2026-10-10T10:30:00.000Z",
      vibration: 0.42,
      temperature: 48.5,
      current: 3.2,
    });
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });
});

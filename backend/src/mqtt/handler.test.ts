import { describe, expect, it } from "vitest";
import { decodeMqttMessage } from "./handler.js";
import { telemetryTopic } from "./topics.js";

const sample = {
  deviceId: "ESP32-001",
  timestamp: "2026-10-10T10:30:00.000Z",
  vibration: { value: 0.42, unit: "g" },
  temperature: { value: 48.5, unit: "C" },
  current: { value: 3.2, unit: "A" },
  source: "simulation",
};

describe("decodeMqttMessage", () => {
  it("accepte une télémétrie cohérente topic/appareil", () => {
    const r = decodeMqttMessage(telemetryTopic("ESP32-001"), JSON.stringify(sample));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.kind).toBe("telemetry");
  });

  it("refuse un appareil qui publie sur le topic d'un autre", () => {
    const r = decodeMqttMessage(telemetryTopic("ESP32-002"), JSON.stringify(sample));
    expect(r).toEqual({ ok: false, reason: "device_mismatch" });
  });

  it("refuse un JSON invalide", () => {
    expect(decodeMqttMessage(telemetryTopic("ESP32-001"), "{nope")).toEqual({
      ok: false,
      reason: "invalid_json",
    });
  });

  it("refuse un payload mal formé", () => {
    const r = decodeMqttMessage(
      telemetryTopic("ESP32-001"),
      JSON.stringify({ deviceId: "ESP32-001", source: "simulation" }),
    );
    expect(r).toEqual({ ok: false, reason: "invalid_payload" });
  });

  it("accepte l'alias machines/.../measurements", () => {
    const r = decodeMqttMessage(
      "predimaint/machines/MACHINE-001/measurements",
      JSON.stringify(sample),
    );
    expect(r.ok).toBe(true);
    if (r.ok && r.kind === "telemetry") expect(r.hardwareId).toBe("ESP32-001");
  });

  it("refuse un topic hors convention", () => {
    expect(decodeMqttMessage("evil/ESP32-001/telemetry", JSON.stringify(sample))).toEqual({
      ok: false,
      reason: "bad_topic",
    });
  });
});

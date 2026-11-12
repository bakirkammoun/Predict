import { describe, expect, it } from "vitest";
import { parseDeviceTopic, telemetryTopic } from "./topics.js";

describe("MQTT topics", () => {
  it("construit et parse un topic de télémétrie", () => {
    const t = telemetryTopic("ESP32-001");
    expect(t).toBe("predimaint/devices/ESP32-001/telemetry");
    expect(parseDeviceTopic(t)).toEqual({ hardwareId: "ESP32-001", kind: "telemetry" });
  });

  it("rejette un topic hors convention", () => {
    expect(parseDeviceTopic("other/devices/ESP32-001/telemetry")).toBeNull();
  });
});

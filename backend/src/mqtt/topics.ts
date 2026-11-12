export const TOPIC_PREFIX = "predimaint/devices";
export const MACHINE_PREFIX = "predimaint/machines";

export function telemetryTopic(deviceHardwareId: string) {
  return `${TOPIC_PREFIX}/${deviceHardwareId}/telemetry`;
}
export function statusTopic(deviceHardwareId: string) {
  return `${TOPIC_PREFIX}/${deviceHardwareId}/status`;
}
export function configTopic(deviceHardwareId: string) {
  return `${TOPIC_PREFIX}/${deviceHardwareId}/config`;
}
export function commandsTopic(deviceHardwareId: string) {
  return `${TOPIC_PREFIX}/${deviceHardwareId}/commands`;
}

export type ParsedTopic = { kind: string; hardwareId?: string; machineCode?: string };

export function parseDeviceTopic(topic: string): { hardwareId: string; kind: string } | null {
  const parsed = parsePredimaintTopic(topic);
  if (!parsed?.hardwareId) return null;
  return { hardwareId: parsed.hardwareId, kind: parsed.kind };
}

/** Topics canoniques appareil + alias cahier des charges (machines). */
export function parsePredimaintTopic(topic: string): ParsedTopic | null {
  const parts = topic.split("/");
  if (parts[0] !== "predimaint" || parts.length !== 4) return null;
  const kindRaw = parts[3];
  const kind = kindRaw === "measurements" || kindRaw === "telemetry" ? "telemetry" : kindRaw;
  if (parts[1] === "devices") {
    return { hardwareId: parts[2], kind };
  }
  if (parts[1] === "machines") {
    return { machineCode: parts[2], kind };
  }
  return null;
}

export const TELEMETRY_WILDCARD = `${TOPIC_PREFIX}/+/telemetry`;
export const STATUS_WILDCARD = `${TOPIC_PREFIX}/+/status`;
export const MACHINE_MEASUREMENTS_WILDCARD = `${MACHINE_PREFIX}/+/measurements`;
export const MACHINE_STATUS_WILDCARD = `${MACHINE_PREFIX}/+/status`;

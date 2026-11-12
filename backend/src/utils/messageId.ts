import { createHash } from "node:crypto";

export function digestTelemetryMessage(input: {
  hardwareId: string;
  timestamp?: string;
  vibration: number;
  temperature: number;
  humidity?: number;
  current: number;
  messageId?: string;
}) {
  if (input.messageId) return input.messageId;
  const humidity = input.humidity === undefined ? "" : `|${input.humidity}`;
  const raw = `${input.hardwareId}|${input.timestamp ?? ""}|${input.vibration}|${input.temperature}${humidity}|${input.current}`;
  return createHash("sha256").update(raw).digest("hex");
}

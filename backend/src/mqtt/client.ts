import mqtt from "mqtt";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import {
  MACHINE_MEASUREMENTS_WILDCARD,
  MACHINE_STATUS_WILDCARD,
  STATUS_WILDCARD,
  TELEMETRY_WILDCARD,
  commandsTopic,
  configTopic,
} from "./topics.js";
import { handleMqttMessage } from "./handler.js";

let client: mqtt.MqttClient | null = null;

export function getMqttClient() {
  return client;
}

export function startMqtt() {
  client = mqtt.connect(env.MQTT_URL, {
    clientId: env.MQTT_CLIENT_ID,
    username: env.MQTT_USERNAME || undefined,
    password: env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
  });

  client.on("connect", () => {
    logger.info("MQTT connected", { url: env.MQTT_URL });
    client?.subscribe(
      [TELEMETRY_WILDCARD, STATUS_WILDCARD, MACHINE_MEASUREMENTS_WILDCARD, MACHINE_STATUS_WILDCARD],
      { qos: 1 },
      (err) => {
      if (err) logger.error("MQTT subscribe failed", { err });
    });
  });

  client.on("reconnect", () => logger.warn("MQTT reconnecting"));
  client.on("error", (err) => logger.error("MQTT error", { err }));
  client.on("close", () => logger.warn("MQTT connection closed"));

  client.on("message", async (topic, buffer) => {
    try {
      const result = await handleMqttMessage(topic, buffer.toString());
      if ("ingested" in result && result.ingested.rejected) {
        logger.warn("MQTT telemetry rejected during ingestion", {
          topic,
          hardwareId: result.hardwareId,
          reason: result.ingested.reason,
        });
      }
    } catch (err) {
      logger.warn("MQTT message rejected", { topic, err });
    }
  });
}

function publishJson(topic: string, payload: Record<string, unknown>) {
  if (!client?.connected) {
    logger.warn("MQTT publish skipped: broker unavailable", { topic });
    return false;
  }
  client.publish(topic, JSON.stringify({ ...payload, issuedAt: new Date().toISOString() }), { qos: 1 });
  return true;
}

export function publishCommand(hardwareId: string, command: Record<string, unknown>) {
  return publishJson(commandsTopic(hardwareId), command);
}

export function publishConfig(hardwareId: string, config: Record<string, unknown>) {
  return publishJson(configTopic(hardwareId), config);
}

export function stopMqtt() {
  client?.end(true);
  client = null;
}

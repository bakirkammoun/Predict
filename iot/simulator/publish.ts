/**
 * Publisher MQTT de démonstration — ne pas lancer en parallèle du simulateur backend.
 */
import mqtt from "mqtt";

const url = process.env.MQTT_URL ?? "mqtt://127.0.0.1:1883";
const deviceId = process.env.DEVICE_ID ?? "ESP32-001";
const client = mqtt.connect(url);

client.on("connect", () => {
  setInterval(() => {
    const payload = {
      deviceId,
      timestamp: new Date().toISOString(),
      vibration: { value: Number((0.3 + Math.random() * 0.2).toFixed(3)), unit: "g" },
      temperature: { value: Number((40 + Math.random() * 8).toFixed(2)), unit: "C" },
      current: { value: Number((3 + Math.random()).toFixed(2)), unit: "A" },
      source: "simulation",
    };
    client.publish(`predimaint/devices/${deviceId}/telemetry`, JSON.stringify(payload));
  }, 4000);
});

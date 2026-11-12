import { Device } from "../models/Device.js";
import { Machine, defaultThresholds } from "../models/Machine.js";
import { Measurement } from "../models/Measurement.js";
import { HealthStateLog } from "../models/HealthStateLog.js";
import { Alert } from "../models/Alert.js";
import type { TelemetryPayload } from "../validators/telemetry.js";
import {
  alertFingerprint,
  applyHysteresis,
  classifyMetric,
  heuristicRiskScore,
  toMetricThresholds,
  worstLevel,
  type ConsecutiveCounters,
  type Level,
  type MetricName,
} from "./anomalyService.js";
import { env } from "../config/env.js";
import { emitToMachine, emitToOps } from "../sockets/hub.js";
import { notifyAlertCreated, notifyConnectivityRestored } from "./notificationService.js";
import { logger } from "../utils/logger.js";
import { digestTelemetryMessage } from "../utils/messageId.js";

export async function ingestTelemetry(payload: TelemetryPayload, topicHardwareId: string) {
  if (payload.deviceId !== topicHardwareId) {
    logger.warn("MQTT deviceId mismatch, rejected", { topicHardwareId, payloadId: payload.deviceId });
    return { rejected: true, reason: "device_mismatch" };
  }

  const device = await Device.findOne({ hardwareId: topicHardwareId });
  if (!device || device.revoked) {
    return { rejected: true, reason: "unknown_or_revoked_device" };
  }
  if (!device.machineId) {
    return { rejected: true, reason: "device_not_linked" };
  }

  const machine = await Machine.findById(device.machineId);
  if (!machine || machine.operationalStatus !== "active") {
    return { rejected: true, reason: "machine_inactive" };
  }
  if (payload.machineId && payload.machineId !== machine.code) {
    return { rejected: true, reason: "machine_mismatch" };
  }

  const messageId = digestTelemetryMessage({
    hardwareId: topicHardwareId,
    timestamp: payload.timestamp,
    vibration: payload.vibration.value,
    temperature: payload.temperature.value,
    current: payload.current.value,
    messageId: payload.messageId,
    ...(payload.humidity ? { humidity: payload.humidity.value } : {}),
  });
  const existing = await Measurement.findOne({ messageId }).select("_id").lean();
  if (existing) {
    return { rejected: true, reason: "duplicate" };
  }

  const measuredAt = payload.timestamp && !Number.isNaN(Date.parse(payload.timestamp))
    ? new Date(payload.timestamp)
    : new Date();
  const receivedAt = new Date();
  const metrics = {
    vibration: payload.vibration.value,
    temperature: payload.temperature.value,
    ...(payload.humidity ? { humidity: payload.humidity.value } : {}),
    current: payload.current.value,
  };

  const thresholds = {
    vibration: toMetricThresholds(machine.thresholds?.vibration ?? defaultThresholds.vibration),
    temperature: toMetricThresholds(machine.thresholds?.temperature ?? defaultThresholds.temperature),
    current: toMetricThresholds(machine.thresholds?.current ?? defaultThresholds.current),
  };

  const instant: Record<MetricName, Level> = {
    vibration: classifyMetric(metrics.vibration, thresholds.vibration),
    temperature: classifyMetric(metrics.temperature, thresholds.temperature),
    current: classifyMetric(metrics.current, thresholds.current),
  };

  const sensorFault = Boolean(
    payload.sensorErrors?.vibration ||
      payload.sensorErrors?.temperature ||
      payload.sensorErrors?.humidity ||
      payload.sensorErrors?.current ||
      metrics.temperature <= -126.5,
  );

  let validationStatus: "valid" | "out_of_range" | "sensor_error" = "valid";
  if (sensorFault) validationStatus = "sensor_error";
  else if (Object.values(instant).includes("invalid")) validationStatus = "out_of_range";

  const confirm = machine.confirmationCount ?? 3;
  const hyst = machine.hysteresisCount ?? 2;
  const storedMetricHealth = machine.get("metricHealth") as
    | Partial<Record<MetricName, Level>>
    | undefined;
  const metricHealth: Record<MetricName, Level> = {
    vibration: storedMetricHealth?.vibration ?? "normal",
    temperature: storedMetricHealth?.temperature ?? "normal",
    current: storedMetricHealth?.current ?? "normal",
  };

  const confirmed: Record<MetricName, Level> = { vibration: "normal", temperature: "normal", current: "normal" };
  (["vibration", "temperature", "current"] as MetricName[]).forEach((key) => {
    const counters = (machine.consecutive as Record<MetricName, ConsecutiveCounters>)[key];
    const result = applyHysteresis(
      instant[key],
      counters,
      confirm,
      hyst,
      metricHealth[key],
    );
    confirmed[key] = result.confirmed;
    metricHealth[key] = result.confirmed;
    (machine.consecutive as Record<MetricName, ConsecutiveCounters>)[key] = result.counters;
  });

  const derived = sensorFault ? "sensor_error" : worstLevel(Object.values(confirmed));
  const prevStatus = machine.healthStatus;
  machine.set("metricHealth", metricHealth);
  machine.healthStatus = derived;
  machine.lastCommunicationAt = receivedAt;
  machine.heuristicRisk = heuristicRiskScore(metrics, thresholds);
  await machine.save();

  await Device.updateOne(
    { _id: device._id },
    { $set: { status: "online", lastSeenAt: receivedAt } },
  );

  const measurement = await Measurement.create({
    machineId: machine._id,
    deviceId: device._id,
    hardwareId: device.hardwareId,
    messageId,
    vibration: payload.vibration,
    temperature: payload.temperature,
    ...(payload.humidity ? { humidity: payload.humidity } : {}),
    current: payload.current,
    measuredAt,
    receivedAt,
    source: payload.source,
    validationStatus,
    derivedHealth: derived,
  });
  await resolveConnectivityAlerts(machine, receivedAt);

  if (prevStatus !== derived) {
    await HealthStateLog.create({
      machineId: machine._id,
      fromStatus: prevStatus,
      toStatus: derived,
      at: receivedAt,
      reason: "telemetry",
    });
    emitToMachine(String(machine._id), "machine:status", {
      machineId: String(machine._id),
      healthStatus: derived,
    });
    emitToOps("machine:status", {
      machineId: String(machine._id),
      healthStatus: derived,
    });
  }

  if (!sensorFault) {
    await upsertAlerts(machine, instant, confirmed, metrics, payload.source);
  }

  const dto = measurement.toObject();
  emitToMachine(String(machine._id), "measurement:new", dto);
  emitToOps("measurement:new", dto);
  return { rejected: false, measurement: dto };
}

async function resolveConnectivityAlerts(
  machine: InstanceType<typeof Machine>,
  at: Date,
) {
  const alerts = await Alert.find({
    machineId: machine._id,
    parameter: "connectivity",
    status: { $in: ["new", "acknowledged", "in_progress"] },
  });
  for (const alert of alerts) {
    alert.status = "resolved";
    alert.resolvedAt = at;
    await alert.save();
    emitToMachine(String(machine._id), "alert:updated", alert.toObject());
    emitToOps("alert:updated", alert.toObject());
    await notifyConnectivityRestored(alert, machine);
  }
}

async function upsertAlerts(
  machine: InstanceType<typeof Machine>,
  instant: Record<MetricName, Level>,
  confirmed: Record<MetricName, Level>,
  metrics: Record<MetricName, number>,
  source: "simulation" | "hardware",
) {
  for (const parameter of ["vibration", "temperature", "current"] as MetricName[]) {
    if (instant[parameter] === "invalid") continue;
    const level = confirmed[parameter];
    if (level !== "warning" && level !== "critical") {
      continue;
    }
    const fingerprint = alertFingerprint(String(machine._id), parameter, level);
    const open = await Alert.findOne({
      fingerprint,
      status: { $in: ["new", "acknowledged", "in_progress"] },
    });
    if (open) {
      open.observedValue = metrics[parameter];
      await open.save();
      await notifyAlertCreated(open, machine, true);
      continue;
    }
    const recentResolved = await Alert.findOne({ fingerprint, status: "resolved" }).sort({
      resolvedAt: -1,
    });
    if (
      recentResolved?.resolvedAt &&
      Date.now() - recentResolved.resolvedAt.getTime() < env.ALERT_REOPEN_COOLDOWN_MS
    ) {
      continue;
    }
    const t = toMetricThresholds(
      machine.thresholds?.[parameter] ?? defaultThresholds[parameter],
    );
    const belowThreshold =
      metrics[parameter] <= (level === "critical" ? (t.criticalMin ?? Number.NEGATIVE_INFINITY) : (t.warningMin ?? Number.NEGATIVE_INFINITY));
    const threshold = level === "critical"
      ? belowThreshold ? t.criticalMin : t.criticalMax
      : belowThreshold ? t.warningMin : t.warningMax;
    const alert = await Alert.create({
      machineId: machine._id,
      fingerprint,
      type: `threshold_${parameter}`,
      parameter,
      observedValue: metrics[parameter],
      threshold,
      unit: t.unit,
      severity: level,
      detectedAt: new Date(),
      description: `${parameter} ${level === "critical" ? "critique" : "en vigilance"} (${metrics[parameter]} ${t.unit}). Ceci n'est pas une panne certaine, mais un dépassement de seuil.`,
      status: "new",
      source,
    });
    emitToMachine(String(machine._id), "alert:new", alert.toObject());
    emitToOps("alert:new", alert.toObject());
    await notifyAlertCreated(alert, machine);
  }
}

export async function markMachinesOffline(timeoutMs: number) {
  const cutoff = new Date(Date.now() - timeoutMs);
  const stale = await Machine.find({
    operationalStatus: "active",
    healthStatus: { $ne: "offline" },
    $or: [{ lastCommunicationAt: { $lt: cutoff } }, { lastCommunicationAt: { $exists: false } }],
  });
  for (const machine of stale) {
    const prev = machine.healthStatus;
    machine.healthStatus = "offline";
    await machine.save();
    await HealthStateLog.create({
      machineId: machine._id,
      fromStatus: prev,
      toStatus: "offline",
      at: new Date(),
      reason: "timeout",
    });
    await Device.updateOne({ _id: machine.deviceId }, { $set: { status: "offline" } });
    const fingerprint = alertFingerprint(String(machine._id), "connectivity", "warning");
    const open = await Alert.findOne({ fingerprint, status: { $in: ["new", "acknowledged", "in_progress"] } });
    if (!open) {
      const device = await Device.findById(machine.deviceId).select("firmwareVersion").lean();
      const lastMeasurement = await Measurement.findOne({ machineId: machine._id })
        .sort({ receivedAt: -1 })
        .select("source")
        .lean();
      const alert = await Alert.create({
        machineId: machine._id,
        fingerprint,
        type: "device_offline",
        parameter: "connectivity",
        severity: "warning",
        detectedAt: new Date(),
        description: `Aucune communication valide depuis plus de ${Math.round(timeoutMs / 1000)} s.`,
        status: "new",
        source: lastMeasurement?.source ?? (
          device?.firmwareVersion?.startsWith("sim-") ? "simulation" : "hardware"
        ),
      });
      emitToMachine(String(machine._id), "alert:new", alert.toObject());
      emitToOps("alert:new", alert.toObject());
      await notifyAlertCreated(alert, machine);
    }
    emitToMachine(String(machine._id), "machine:status", {
      machineId: String(machine._id),
      healthStatus: "offline",
    });
    emitToOps("machine:status", {
      machineId: String(machine._id),
      healthStatus: "offline",
    });
  }
}

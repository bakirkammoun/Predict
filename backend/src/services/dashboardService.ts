import { Alert } from "../models/Alert.js";
import { HealthStateLog } from "../models/HealthStateLog.js";
import { Intervention } from "../models/Intervention.js";
import { Machine } from "../models/Machine.js";
import { Measurement } from "../models/Measurement.js";
import { Device } from "../models/Device.js";
import { User } from "../models/User.js";
import { machineFilter } from "./scopeService.js";
import type { Role } from "../models/User.js";

/**
 * Disponibilité sur la période [from, to] :
 * A = (durée où l'état ∈ {normal, warning}) / durée de la période.
 * Les états critical et offline réduisent la disponibilité.
 * Calculé à partir des journaux HealthStateLog. Sans historique, l'état initial
 * est considéré hors ligne afin de ne pas inventer une disponibilité.
 */
export async function computeAvailability(machineId: string, from: Date, to: Date) {
  const logs = await HealthStateLog.find({ machineId, at: { $lte: to } })
    .sort({ at: 1 })
    .lean();
  const machine = await Machine.findById(machineId).lean();
  if (!machine) return 0;
  const total = to.getTime() - from.getTime();
  if (total <= 0) return 0;

  type St = "normal" | "warning" | "critical" | "offline" | "sensor_error";
  let current: St = "offline";
  let cursor = from.getTime();
  const firstInRange = logs.findIndex((l) => l.at.getTime() >= from.getTime());
  if (firstInRange > 0) current = logs[firstInRange - 1].toStatus as St;
  else if (firstInRange === -1 && logs.length) current = logs[logs.length - 1].toStatus as St;
  else if (firstInRange === 0) current = logs[0].fromStatus as St;

  let available = 0;
  const events = logs.filter((l) => l.at.getTime() >= from.getTime() && l.at.getTime() <= to.getTime());
  for (const ev of events) {
    const t = ev.at.getTime();
    if (current === "normal" || current === "warning") available += t - cursor;
    current = ev.toStatus as St;
    cursor = t;
  }
  if (current === "normal" || current === "warning") available += to.getTime() - cursor;
  return Math.min(1, Math.max(0, available / total));
}

export async function dashboardSummary(user: { id: string; role: Role }, from: Date, to: Date) {
  const filter = machineFilter(user);
  const machines = await Machine.find(filter).lean();
  const ids = machines.map((m) => m._id);
  const counts = {
    total: machines.length,
    normal: machines.filter((m) => m.healthStatus === "normal").length,
    warning: machines.filter((m) => m.healthStatus === "warning").length,
    critical: machines.filter((m) => m.healthStatus === "critical").length,
    offline: machines.filter((m) => m.healthStatus === "offline").length,
    sensorError: machines.filter((m) => m.healthStatus === "sensor_error").length,
  };
  const activeAlerts = await Alert.countDocuments({
    machineId: { $in: ids },
    status: { $in: ["new", "acknowledged", "in_progress"] },
  });
  const inProgress = await Intervention.countDocuments({
    machineId: { $in: ids },
    status: "in_progress",
  });
  const overdue = await Intervention.countDocuments({
    machineId: { $in: ids },
    status: { $in: ["planned", "todo", "in_progress", "on_hold"] },
    scheduledAt: { $lt: new Date() },
  });
  const adminOverview =
    user.role === "admin"
      ? await Promise.all([
          User.countDocuments({ isActive: true }),
          Device.countDocuments({ status: "online", revoked: false }),
          Device.countDocuments({ status: "offline", revoked: false }),
        ])
      : null;

  const activeMachines = machines.filter((machine) => machine.operationalStatus === "active");
  let availabilitySum = 0;
  for (const m of activeMachines) {
    availabilitySum += await computeAvailability(String(m._id), from, to);
  }
  const availability = activeMachines.length ? availabilitySum / activeMachines.length : 0;

  const latestAlerts = await Alert.find({ machineId: { $in: ids } })
    .sort({ detectedAt: -1 })
    .limit(8)
    .populate("machineId", "name code")
    .lean();
  const latestMeasurements = await Measurement.find({ machineId: { $in: ids } })
    .sort({ measuredAt: -1 })
    .limit(12)
    .populate("machineId", "name code")
    .lean();

  const spanMs = Math.max(0, to.getTime() - from.getTime());
  const bucket =
    spanMs <= 24 * 60 * 60_000
      ? { unit: "minute" as const, binSize: 15 }
      : spanMs <= 7 * 24 * 60 * 60_000
        ? { unit: "hour" as const, binSize: 2 }
        : { unit: "hour" as const, binSize: 6 };
  const trend = await Measurement.aggregate([
    { $match: { machineId: { $in: ids }, measuredAt: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: {
          $dateTrunc: { date: "$measuredAt", ...bucket },
        },
        vibration: { $avg: "$vibration.value" },
        temperature: { $avg: "$temperature.value" },
        humidity: { $avg: "$humidity.value" },
        current: { $avg: "$current.value" },
      },
    },
    { $sort: { _id: -1 } },
    { $limit: 120 },
    { $sort: { _id: 1 } },
  ]);

  return {
    counts,
    activeAlerts,
    interventionsInProgress: inProgress,
    interventionsOverdue: overdue,
    availability,
    availabilityFormula:
      "A = (durée où healthStatus ∈ {normal, warning}) / durée de la période, moyenne des machines en service avec disponibilité historique.",
    availabilityMachineCount: activeMachines.length,
    dataOrigin: "Calculé à partir des documents persistés (simulation ou matériel selon source des mesures).",
    latestAlerts,
    latestMeasurements,
    ...(adminOverview
      ? {
          adminOverview: {
            activeUsers: adminOverview[0],
            devicesOnline: adminOverview[1],
            devicesOffline: adminOverview[2],
          },
        }
      : {}),
    distribution: [
      { name: "Normal", value: counts.normal },
      { name: "Vigilance", value: counts.warning },
      { name: "Critique", value: counts.critical },
      { name: "Hors ligne", value: counts.offline },
      { name: "Capteur en erreur", value: counts.sensorError },
    ],
    trend,
  };
}

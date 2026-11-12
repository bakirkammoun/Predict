import { Alert } from "../models/Alert.js";
import { Machine } from "../models/Machine.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { emitToUser } from "../sockets/hub.js";

export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  type: string,
  resourceType = "",
  resourceId = "",
) {
  const doc = await Notification.create({ userId, title, body, type, resourceType, resourceId });
  emitToUser(userId, "notification:new", doc.toObject());
  return doc;
}

interface AlertNotification {
  alertId: string;
  machineName: string;
  parameter: string;
  observedValue?: number | null;
  unit: string;
  severity: string;
  assignedTechnicianId?: string | null;
}

async function notifyAlertRecipients(alert: AlertNotification, resendAfterRead: boolean) {
  const recipients = await User.find({
    isActive: true,
    $or: [
      { role: { $in: ["admin", "maintenance_manager"] } },
      ...(alert.assignedTechnicianId ? [{ _id: alert.assignedTechnicianId }] : []),
    ],
  })
    .select("_id")
    .lean();

  const body = `${alert.machineName} — ${alert.parameter} ${alert.observedValue ?? "—"} ${alert.unit}`.trim();
  await Promise.all(
    recipients.map(async (recipient) => {
      const userId = String(recipient._id);
      const notificationQuery = {
        userId,
        type: "alert",
        resourceId: alert.alertId,
        ...(resendAfterRead ? { readAt: { $exists: false } } : {}),
      };
      const exists = await Notification.exists(notificationQuery);
      if (exists) return;
      await notifyUser(
        userId,
        `Alerte ${alert.severity}`,
        body,
        "alert",
        "alert",
        alert.alertId,
      );
    }),
  );
}

export async function notifyAlertCreated(
  alert: {
    _id: unknown;
    parameter: string;
    observedValue?: number | null;
    unit?: string;
    severity: string;
  },
  machine: { _id: unknown; name: string; assignedTechnicianId?: unknown },
  resendAfterRead = false,
) {
  await notifyAlertRecipients({
    alertId: String(alert._id),
    machineName: machine.name,
    parameter: alert.parameter,
    observedValue: alert.observedValue,
    unit: alert.unit ?? "",
    severity: alert.severity,
    assignedTechnicianId: machine.assignedTechnicianId
      ? String(machine.assignedTechnicianId)
      : null,
  }, resendAfterRead);
}

export async function notifyConnectivityRestored(
  alert: { _id: unknown; severity: string },
  machine: { _id: unknown; name: string; assignedTechnicianId?: unknown },
) {
  const recipients = await User.find({
    isActive: true,
    $or: [
      { role: { $in: ["admin", "maintenance_manager"] } },
      ...(machine.assignedTechnicianId ? [{ _id: machine.assignedTechnicianId }] : []),
    ],
  })
    .select("_id")
    .lean();

  await Promise.all(
    recipients.map((recipient) =>
      notifyUser(
        String(recipient._id),
        "Communication rétablie",
        `${machine.name} — l’appareil est de nouveau connecté. L’alerte de connectivité est résolue.`,
        "alert",
        "alert",
        String(alert._id),
      ),
    ),
  );
}

export async function backfillOpenAlertNotifications() {
  const alerts = await Alert.find({
    status: { $in: ["new", "acknowledged", "in_progress"] },
  })
    .select("_id machineId parameter observedValue unit severity")
    .lean();
  if (alerts.length === 0) return;

  const machines = await Machine.find({
    _id: { $in: alerts.map((alert) => alert.machineId) },
  })
    .select("_id name assignedTechnicianId")
    .lean();
  const machinesById = new Map(machines.map((machine) => [String(machine._id), machine]));

  for (const alert of alerts) {
    const machine = machinesById.get(String(alert.machineId));
    if (machine) {
      await notifyAlertCreated(alert, machine);
    }
  }
}

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Notification } from "../models/Notification.js";
import { connectTestDb, clearTestDb, disconnectTestDb } from "../tests/mongo.js";
import { notifyAlertCreated } from "./notificationService.js";

describe("notifications d'alertes persistantes", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 120_000);

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("renvoie une notification après lecture, sans dupliquer les notifications non lues", async () => {
    const [admin, manager, assignedTech, otherTech] = await User.create([
      { email: "admin@example.test", passwordHash: "hash", firstName: "Admin", lastName: "Test", role: "admin" },
      { email: "manager@example.test", passwordHash: "hash", firstName: "Manager", lastName: "Test", role: "maintenance_manager" },
      { email: "tech@example.test", passwordHash: "hash", firstName: "Tech", lastName: "Assigned", role: "technician" },
      { email: "other@example.test", passwordHash: "hash", firstName: "Other", lastName: "Tech", role: "technician" },
    ]);
    const alert = {
      _id: new mongoose.Types.ObjectId(),
      parameter: "temperature",
      observedValue: 95,
      unit: "C",
      severity: "critical",
    };
    const machine = {
      _id: new mongoose.Types.ObjectId(),
      name: "Presse",
      assignedTechnicianId: assignedTech._id,
    };

    await notifyAlertCreated(alert, machine);
    await notifyAlertCreated(alert, machine, true);
    expect(await Notification.countDocuments({ resourceId: String(alert._id) })).toBe(3);

    await Notification.updateOne(
      { userId: admin._id, resourceId: String(alert._id) },
      { $set: { readAt: new Date() } },
    );
    await notifyAlertCreated(alert, machine, true);

    expect(await Notification.countDocuments({ userId: admin._id, resourceId: String(alert._id) })).toBe(2);
    expect(await Notification.countDocuments({ userId: manager._id, resourceId: String(alert._id) })).toBe(1);
    expect(await Notification.countDocuments({ userId: assignedTech._id, resourceId: String(alert._id) })).toBe(1);
    expect(await Notification.countDocuments({ userId: otherTech._id, resourceId: String(alert._id) })).toBe(0);
  });
});

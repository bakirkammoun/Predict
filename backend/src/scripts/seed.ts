import bcrypt from "bcryptjs";
import { connectDb, disconnectDb } from "../config/db.js";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Machine, defaultThresholds } from "../models/Machine.js";
import { Device } from "../models/Device.js";
import { SystemSettings } from "../models/SystemSettings.js";
import { logger } from "../utils/logger.js";

async function seed() {
  await connectDb();
  const existing = await User.countDocuments();
  if (existing > 0) {
    logger.info("Seed ignoré : des utilisateurs existent déjà.");
    await disconnectDb();
    return;
  }

  const passwordHash = await bcrypt.hash(env.SEED_PASSWORD, 12);
  const [admin, manager, tech] = await User.create([
    {
      email: "admin@gmail.com",
      passwordHash,
      firstName: "Bakir",
      lastName: "Kammoun",
      role: "admin",
    },
    {
      email: "manager@gmail.com",
      passwordHash,
      firstName: "Ayoub",
      lastName: "Bahroun",
      role: "maintenance_manager",
    },
    {
      email: "tech@gmail.com",
      passwordHash,
      firstName: "Nacir",
      lastName: "Mahfoudhi",
      role: "technician",
    },
  ]);

  const devices = await Device.create([
    { hardwareId: "ESP32-001", name: "Nœud presse", secretHash: passwordHash, firmwareVersion: "sim-1.0.0" },
    { hardwareId: "ESP32-002", name: "Nœud convoyeur", secretHash: passwordHash, firmwareVersion: "sim-1.0.0" },
    { hardwareId: "ESP32-003", name: "Nœud pompe", secretHash: passwordHash, firmwareVersion: "sim-1.0.0" },
    { hardwareId: "ESP32-004", name: "Nœud machine 004", secretHash: passwordHash, firmwareVersion: "esp32-1.2.0" },
  ]);

  const machines = await Machine.create([
    {
      name: "Presse hydraulique PH-12",
      code: "MACHINE-001",
      description: "Presse de formage — données de démonstration.",
      type: "Presse",
      brand: "DemoTech",
      model: "PH-12",
      location: "Atelier A",
      operationalStatus: "active",
      healthStatus: "offline",
      deviceId: devices[0]._id,
      assignedTechnicianId: tech._id,
      thresholds: defaultThresholds,
    },
    {
      name: "Convoyeur C-04",
      code: "MACHINE-002",
      description: "Ligne d'emballage — démonstration.",
      type: "Convoyeur",
      brand: "DemoTech",
      model: "CV-04",
      location: "Atelier B",
      operationalStatus: "active",
      healthStatus: "offline",
      deviceId: devices[1]._id,
      assignedTechnicianId: tech._id,
      thresholds: defaultThresholds,
    },
    {
      name: "Pompe centrifuge P-21",
      code: "MACHINE-003",
      description: "Circuit de refroidissement — démonstration.",
      type: "Pompe",
      brand: "DemoFlow",
      model: "PC-21",
      location: "Atelier A",
      operationalStatus: "active",
      healthStatus: "offline",
      deviceId: devices[2]._id,
      assignedTechnicianId: tech._id,
      thresholds: defaultThresholds,
    },
    {
      name: "Machine connectée 004",
      code: "MACHINE-004",
      description: "Machine connectée à l’ESP32-004.",
      type: "Machine",
      location: "Atelier A",
      operationalStatus: "active",
      healthStatus: "offline",
      deviceId: devices[3]._id,
      assignedTechnicianId: tech._id,
      thresholds: defaultThresholds,
    },
  ]);

  await Device.updateOne({ _id: devices[0]._id }, { machineId: machines[0]._id });
  await Device.updateOne({ _id: devices[1]._id }, { machineId: machines[1]._id });
  await Device.updateOne({ _id: devices[2]._id }, { machineId: machines[2]._id });
  await Device.updateOne({ _id: devices[3]._id }, { machineId: machines[3]._id });

  await SystemSettings.create({
    key: "global",
    offlineTimeoutMs: env.OFFLINE_TIMEOUT_MS,
    measurementRetentionDays: env.MEASUREMENT_RETENTION_DAYS,
  });

  logger.info("Seed de démonstration créé", {
    admin: admin.email,
    manager: manager.email,
    technician: tech.email,
    note: "Mot de passe : variable SEED_PASSWORD. Données fictives.",
  });
  await disconnectDb();
}

seed().catch((err) => {
  logger.error(err);
  process.exit(1);
});

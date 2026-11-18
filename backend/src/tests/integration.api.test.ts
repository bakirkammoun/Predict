import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../app.js";
import { connectTestDb, disconnectTestDb, clearTestDb } from "./mongo.js";
import { User } from "../models/User.js";
import { Device } from "../models/Device.js";
import { Machine, defaultThresholds } from "../models/Machine.js";
import { Intervention } from "../models/Intervention.js";
import { Alert } from "../models/Alert.js";
import { Measurement } from "../models/Measurement.js";
import { Notification } from "../models/Notification.js";
import { HealthStateLog } from "../models/HealthStateLog.js";
import { ingestTelemetry } from "../services/measurementIngestService.js";
import { computeAvailability } from "../services/dashboardService.js";
import { handleMqttMessage } from "../mqtt/handler.js";
import { telemetryTopic } from "../mqtt/topics.js";
import { backfillOpenAlertNotifications } from "../services/notificationService.js";

const app = createApp();
const password = "12345678Aa";

async function tokenFor(email: string) {
  const res = await request(app).post("/api/v1/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  return res.body.data.token as string;
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash(password, 4);
  const [admin, manager, tech, otherTech] = await User.create([
    { email: "admin@gmail.com", passwordHash, firstName: "A", lastName: "Admin", role: "admin" },
    {
      email: "manager@gmail.com",
      passwordHash,
      firstName: "M",
      lastName: "Manager",
      role: "maintenance_manager",
    },
    { email: "tech@gmail.com", passwordHash, firstName: "T", lastName: "Tech", role: "technician" },
    { email: "tech2@predimaint.local", passwordHash, firstName: "U", lastName: "Other", role: "technician" },
  ]);
  return { admin, manager, tech, otherTech };
}

async function seedMachine(techId: string, hardwareId = "ESP32-001", code = "MACHINE-001") {
  const device = await Device.create({
    hardwareId,
    name: hardwareId,
    secretHash: await bcrypt.hash("device-secret-ok", 4),
    status: "offline",
  });
  const machine = await Machine.create({
    name: code,
    code,
    type: "Presse",
    location: "Atelier A",
    operationalStatus: "active",
    healthStatus: "offline",
    deviceId: device._id,
    assignedTechnicianId: techId,
    thresholds: defaultThresholds,
    confirmationCount: 1,
    hysteresisCount: 1,
  });
  device.machineId = machine._id;
  await device.save();
  return { device, machine };
}

function telemetry(overrides: Record<string, unknown> = {}) {
  return {
    deviceId: "ESP32-001",
    timestamp: "2026-10-10T10:30:00.000Z",
    vibration: { value: 0.3, unit: "g" },
    temperature: { value: 40, unit: "C" },
    current: { value: 3, unit: "A" },
    source: "simulation" as const,
    ...overrides,
  };
}

describe("intégration API / MongoDB", () => {
  beforeAll(async () => {
    await connectTestDb();
  }, 120_000);

  afterAll(async () => {
    await disconnectTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("crée le premier administrateur puis refuse un second bootstrap", async () => {
    const first = await request(app).post("/api/v1/auth/bootstrap").send({
      email: "admin@gmail.com",
      password,
      firstName: "Amina",
      lastName: "Admin",
    });
    expect(first.status).toBe(201);
    expect(first.body.data.token).toBeTruthy();
    const second = await request(app).post("/api/v1/auth/bootstrap").send({
      email: "autre@predimaint.local",
      password,
      firstName: "X",
      lastName: "Y",
    });
    expect(second.status).toBe(409);
  });

  it("refuse un login invalide sans divulguer l'existence du compte", async () => {
    await seedUsers();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@gmail.com", password: "WrongPass_123" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("connecte un admin et refuse à un technicien la création de machine", async () => {
    const { tech } = await seedUsers();
    const adminToken = await tokenFor("admin@gmail.com");
    const techToken = await tokenFor("tech@gmail.com");
    const created = await request(app)
      .post("/api/v1/machines")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Presse",
        code: "PH-99",
        type: "Presse",
        location: "A",
        hardwareId: "ESP32-099",
        deviceSecret: "secret-device-99",
        assignedTechnicianId: String(tech._id),
      });
    expect(created.status).toBe(201);
    const forbidden = await request(app)
      .post("/api/v1/machines")
      .set("Authorization", `Bearer ${techToken}`)
      .send({
        name: "Hack",
        code: "HACK",
        type: "X",
        location: "Y",
        hardwareId: "ESP32-HACK",
        deviceSecret: "secret-device-99",
      });
    expect(forbidden.status).toBe(403);
  });

  it("isole les machines d'un technicien", async () => {
    const { tech, otherTech } = await seedUsers();
    await seedMachine(String(tech._id), "ESP32-001", "MACHINE-001");
    const { machine: other } = await seedMachine(String(otherTech._id), "ESP32-002", "MACHINE-002");
    const techToken = await tokenFor("tech@gmail.com");
    const list = await request(app).get("/api/v1/machines").set("Authorization", `Bearer ${techToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].code).toBe("MACHINE-001");
    const denied = await request(app)
      .get(`/api/v1/machines/${other._id}`)
      .set("Authorization", `Bearer ${techToken}`);
    expect(denied.status).toBe(403);
  });

  it("ingère une mesure MQTT, détecte une anomalie, déduplique l'alerte", async () => {
    const { tech } = await seedUsers();
    await seedMachine(String(tech._id));
    const critical = telemetry({
      vibration: { value: 2.1, unit: "g" },
      timestamp: "2026-10-10T11:00:00.000Z",
    });
    const first = await handleMqttMessage(telemetryTopic("ESP32-001"), JSON.stringify(critical));
    expect(first.ok).toBe(true);
    const stored = await Measurement.countDocuments();
    expect(stored).toBe(1);
    const alerts1 = await Alert.find({ status: { $in: ["new", "acknowledged", "in_progress"] } });
    expect(alerts1).toHaveLength(1);
    expect(alerts1[0].parameter).toBe("vibration");
    expect(alerts1[0].severity).toBe("critical");
    expect(await Notification.countDocuments({ resourceId: String(alerts1[0]._id) })).toBe(3);

    const dup = await ingestTelemetry(critical, "ESP32-001");
    expect(dup.rejected).toBe(true);
    expect(await Measurement.countDocuments()).toBe(1);

    const secondPulse = telemetry({
      vibration: { value: 2.2, unit: "g" },
      timestamp: "2026-10-10T11:00:05.000Z",
    });
    await ingestTelemetry(secondPulse, "ESP32-001");
    expect(await Alert.countDocuments()).toBe(1);
  });

  it("rétro-remplit les notifications de la barre pour les alertes actives", async () => {
    const { tech } = await seedUsers();
    await seedMachine(String(tech._id));
    await ingestTelemetry(
      telemetry({
        vibration: { value: 2.1, unit: "g" },
        timestamp: "2026-10-10T11:15:00.000Z",
      }),
      "ESP32-001",
    );
    await Notification.deleteMany({});

    await backfillOpenAlertNotifications();
    expect(await Notification.countDocuments({ type: "alert" })).toBe(3);

    await backfillOpenAlertNotifications();
    expect(await Notification.countDocuments({ type: "alert" })).toBe(3);
  });

  it("conserve et valide les seuils bas du courant via l’API", async () => {
    const { tech } = await seedUsers();
    const { machine } = await seedMachine(String(tech._id));
    const managerToken = await tokenFor("manager@gmail.com");
    const response = await request(app)
      .patch(`/api/v1/machines/${machine._id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        thresholds: {
          ...defaultThresholds,
          current: {
            ...defaultThresholds.current,
            warningMin: 2,
            criticalMin: 0.7,
          },
        },
      });
    expect(response.status).toBe(200);
    expect(response.body.data.thresholds.current.warningMin).toBe(2);
    expect(response.body.data.thresholds.current.criticalMin).toBe(0.7);

    const invalid = await request(app)
      .patch(`/api/v1/machines/${machine._id}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        thresholds: {
          ...defaultThresholds,
          current: { ...defaultThresholds.current, warningMin: 0.4, criticalMin: 0.7 },
        },
      });
    expect(invalid.status).toBe(400);
  });

  it("calcule la disponibilité depuis l’état avant le début de la période", async () => {
    const { tech } = await seedUsers();
    const { machine } = await seedMachine(String(tech._id));
    const from = new Date("2026-10-10T00:00:00.000Z");
    const to = new Date("2026-10-10T10:00:00.000Z");
    await HealthStateLog.create([
      {
        machineId: machine._id,
        fromStatus: "offline",
        toStatus: "normal",
        at: new Date("2026-10-09T22:00:00.000Z"),
      },
      {
        machineId: machine._id,
        fromStatus: "normal",
        toStatus: "critical",
        at: new Date("2026-10-10T08:00:00.000Z"),
      },
    ]);

    expect(await computeAvailability(String(machine._id), from, to)).toBe(0.8);
  });

  it("marque uniquement les notifications de l’utilisateur connecté comme lues", async () => {
    const { tech, otherTech } = await seedUsers();
    const ownUnread = await Notification.create({
      userId: tech._id,
      title: "Alerte",
      body: "Machine en vigilance",
      type: "alert",
    });
    await Notification.create({
      userId: tech._id,
      title: "Déjà lue",
      body: "Information",
      type: "alert",
      readAt: new Date(),
    });
    const otherUnread = await Notification.create({
      userId: otherTech._id,
      title: "Autre utilisateur",
      body: "Information",
      type: "alert",
    });

    const token = await tokenFor("tech@gmail.com");
    const response = await request(app)
      .patch("/api/v1/notifications/read-all")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.updated).toBe(1);
    expect((await Notification.findById(ownUnread._id))?.readAt).toBeTruthy();
    expect((await Notification.findById(otherUnread._id))?.readAt).toBeUndefined();
  });

  it("résout l’alerte et notifie au rétablissement de la communication", async () => {
    const { tech } = await seedUsers();
    const { machine } = await seedMachine(String(tech._id));
    await machine.updateOne({
      $set: {
        healthStatus: "normal",
        lastCommunicationAt: new Date(Date.now() - 60_000),
      },
    });
    const { markMachinesOffline } = await import("../services/measurementIngestService.js");
    await markMachinesOffline(1);
    const alert = await Alert.findOne({ machineId: machine._id, parameter: "connectivity" });
    expect(alert?.status).toBe("new");
    expect(await Notification.countDocuments({ resourceId: String(alert?._id) })).toBe(3);

    await ingestTelemetry(
      telemetry({ timestamp: "2026-10-10T15:00:00.000Z" }),
      "ESP32-001",
    );
    const resolved = await Alert.findById(alert?._id);
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolvedAt).toBeTruthy();
    expect(await Notification.countDocuments({ resourceId: String(alert?._id) })).toBe(6);
  });

  it("traite la recherche machine comme du texte littéral", async () => {
    const { tech } = await seedUsers();
    await seedMachine(String(tech._id));
    const adminToken = await tokenFor("admin@gmail.com");
    const response = await request(app)
      .get("/api/v1/machines?search=.*")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(0);
  });

  it("crée les alertes des capteurs valides même si le courant est hors plage", async () => {
    const { tech } = await seedUsers();
    const { machine } = await seedMachine(String(tech._id));
    machine.confirmationCount = 1;
    machine.thresholds = {
      ...defaultThresholds,
      vibration: {
        unit: "detection",
        validMin: 0,
        validMax: 1,
        warningMax: 0.5,
        criticalMax: 2,
      },
      temperature: {
        ...defaultThresholds.temperature,
        warningMax: 24,
        criticalMax: 30,
      },
    };
    await machine.save();

    await ingestTelemetry(
      telemetry({
        vibration: { value: 1, unit: "detection" },
        temperature: { value: 25, unit: "C" },
        current: { value: -8.9, unit: "A" },
        timestamp: "2026-10-10T13:00:00.000Z",
      }),
      "ESP32-001",
    );

    const measurement = await Measurement.findOne();
    expect(measurement?.validationStatus).toBe("out_of_range");
    const alerts = await Alert.find().sort({ parameter: 1 });
    expect(alerts.map((alert) => [alert.parameter, alert.severity])).toEqual([
      ["temperature", "warning"],
      ["vibration", "warning"],
    ]);
  });

  it("applique l’hystérésis indépendamment à chaque capteur", async () => {
    const { tech } = await seedUsers();
    const { machine } = await seedMachine(String(tech._id));
    machine.confirmationCount = 1;
    machine.hysteresisCount = 2;
    await machine.save();

    await ingestTelemetry(
      telemetry({
        vibration: { value: 2.1, unit: "g" },
        timestamp: "2026-10-10T14:00:00.000Z",
      }),
      "ESP32-001",
    );
    await ingestTelemetry(
      telemetry({
        vibration: { value: 0.3, unit: "g" },
        current: { value: 20, unit: "A" },
        timestamp: "2026-10-10T14:00:04.000Z",
      }),
      "ESP32-001",
    );
    await ingestTelemetry(
      telemetry({
        vibration: { value: 0.3, unit: "g" },
        current: { value: 3, unit: "A" },
        timestamp: "2026-10-10T14:00:08.000Z",
      }),
      "ESP32-001",
    );

    const updated = await Machine.findById(machine._id);
    expect(updated?.get("metricHealth")).toMatchObject({
      vibration: "normal",
      temperature: "normal",
      current: "critical",
    });
  });

  it("refuse une télémétrie d'un appareil sur le topic d'un autre", async () => {
    const { tech } = await seedUsers();
    await seedMachine(String(tech._id), "ESP32-001");
    await seedMachine(String(tech._id), "ESP32-002", "MACHINE-002");
    const payload = telemetry({ deviceId: "ESP32-002" });
    const r = await handleMqttMessage(telemetryTopic("ESP32-001"), JSON.stringify(payload));
    expect(r.ok).toBe(false);
    expect(await Measurement.countDocuments()).toBe(0);
  });

  it("applique les transitions d'intervention et d'alerte côté API", async () => {
    const { tech } = await seedUsers();
    const { machine } = await seedMachine(String(tech._id));
    await ingestTelemetry(
      telemetry({ vibration: { value: 2.1, unit: "g" }, timestamp: "2026-10-10T12:00:00.000Z" }),
      "ESP32-001",
    );
    const managerToken = await tokenFor("manager@gmail.com");
    const techToken = await tokenFor("tech@gmail.com");
    const alerts = await request(app).get("/api/v1/alerts").set("Authorization", `Bearer ${managerToken}`);
    expect(alerts.body.data.length).toBeGreaterThan(0);
    const alertId = alerts.body.data[0]._id;
    const ack = await request(app)
      .patch(`/api/v1/alerts/${alertId}/status`)
      .set("Authorization", `Bearer ${techToken}`)
      .send({ status: "acknowledged" });
    expect(ack.status).toBe(200);
    const reopen = await request(app)
      .patch(`/api/v1/alerts/${alertId}/status`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ status: "new" });
    expect(reopen.status).toBe(400);

    const created = await request(app)
      .post("/api/v1/interventions")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        machineId: String(machine._id),
        alertId,
        type: "corrective",
        problemDescription: "Vibration critique à contrôler",
        assignedTechnicianId: String(tech._id),
      });
    expect(created.status).toBe(201);
    const id = created.body.data._id;
    const bad = await request(app)
      .patch(`/api/v1/interventions/${id}`)
      .set("Authorization", `Bearer ${techToken}`)
      .send({ status: "completed", diagnosis: "ok" });
    expect(bad.status).toBe(400);
    const start = await request(app)
      .patch(`/api/v1/interventions/${id}`)
      .set("Authorization", `Bearer ${techToken}`)
      .send({ status: "in_progress" });
    expect(start.status).toBe(200);
    const done = await request(app)
      .patch(`/api/v1/interventions/${id}`)
      .set("Authorization", `Bearer ${techToken}`)
      .send({ status: "completed", diagnosis: "Palier à remplacer", actions: "Contrôle", observations: "RAS" });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe("completed");
  });

  it("inclut les interventions terminées au calendrier selon leur date de fin", async () => {
    const { tech } = await seedUsers();
    const { machine } = await seedMachine(String(tech._id));
    const [completedInMonth, activeInMonth, completedAfterMonth, completedWithoutEnd] =
      await Intervention.create([
        {
          reference: "INT-CALENDAR-DONE-IN",
          machineId: machine._id,
          type: "corrective",
          problemDescription: "Terminée pendant le mois",
          status: "completed",
          scheduledAt: new Date("2026-10-28T10:00:00.000Z"),
          endedAt: new Date("2026-11-12T12:00:00.000Z"),
        },
        {
          reference: "INT-CALENDAR-ACTIVE",
          machineId: machine._id,
          type: "preventive",
          problemDescription: "Planifiée pendant le mois",
          status: "todo",
          scheduledAt: new Date("2026-11-14T10:00:00.000Z"),
        },
        {
          reference: "INT-CALENDAR-DONE-AFTER",
          machineId: machine._id,
          type: "inspection",
          problemDescription: "Terminée le mois suivant",
          status: "completed",
          scheduledAt: new Date("2026-11-12T10:00:00.000Z"),
          endedAt: new Date("2026-12-01T12:00:00.000Z"),
        },
        {
          reference: "INT-CALENDAR-DONE-NO-END",
          machineId: machine._id,
          type: "inspection",
          problemDescription: "Ancienne intervention terminée",
          status: "completed",
          scheduledAt: new Date("2026-11-13T10:00:00.000Z"),
        },
      ]);
    const token = await tokenFor("manager@gmail.com");
    const response = await request(app)
      .get("/api/v1/interventions?calendar=true&from=2026-11-01T00:00:00.000Z&to=2026-11-30T23:59:59.999Z&limit=100")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    const ids = response.body.data.map((item: { _id: string }) => item._id);
    expect(ids).toContain(String(completedInMonth._id));
    expect(ids).toContain(String(activeInMonth._id));
    expect(ids).toContain(String(completedWithoutEnd._id));
    expect(ids).not.toContain(String(completedAfterMonth._id));
  });

  it("désactive un compte : le jeton n'est plus accepté", async () => {
    const { tech } = await seedUsers();
    const token = await tokenFor("tech@gmail.com");
    await User.findByIdAndUpdate(tech._id, { isActive: false });
    const me = await request(app).get(" /api/v1/auth/me".trim()).set("Authorization", `Bearer ${token}`);
    expect(me.status).toBe(401);
  });
});

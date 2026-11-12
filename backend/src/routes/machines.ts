import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Machine, defaultThresholds } from "../models/Machine.js";
import { Device } from "../models/Device.js";
import { Measurement } from "../models/Measurement.js";
import { Alert } from "../models/Alert.js";
import { Intervention } from "../models/Intervention.js";
import { authenticate } from "../middlewares/auth.js";
import { authorize } from "../middlewares/rbac.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { validate } from "../middlewares/validate.js";
import { ok, paginated } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import { assertObjectId } from "../utils/ids.js";
import { publishConfig } from "../mqtt/client.js";
import { audit } from "../services/auditService.js";
import { assertMachineAccess, machineFilter } from "../services/scopeService.js";
import { emitToMachine, emitToOps } from "../sockets/hub.js";
import { escapeRegex } from "../utils/escapeRegex.js";

export const machinesRouter = Router();
machinesRouter.use(authenticate);

const thresholdSchema = z.object({
  unit: z.string(),
  validMin: z.number(),
  validMax: z.number(),
  warningMin: z.number().optional(),
  warningMax: z.number(),
  criticalMin: z.number().optional(),
  criticalMax: z.number(),
}).superRefine((thresholds, context) => {
  if (thresholds.validMin >= thresholds.validMax) {
    context.addIssue({ code: "custom", message: "validMin doit être inférieur à validMax" });
  }
  if (
    thresholds.warningMax < thresholds.validMin ||
    thresholds.warningMax >= thresholds.criticalMax ||
    thresholds.criticalMax > thresholds.validMax
  ) {
    context.addIssue({ code: "custom", message: "Les seuils supérieurs doivent respecter les limites valides" });
  }
  if (
    (thresholds.warningMin !== undefined &&
      (thresholds.warningMin <= (thresholds.criticalMin ?? thresholds.validMin) ||
        thresholds.warningMin >= thresholds.warningMax)) ||
    (thresholds.criticalMin !== undefined &&
      (thresholds.criticalMin < thresholds.validMin ||
        thresholds.criticalMin >= thresholds.warningMax))
  ) {
    context.addIssue({ code: "custom", message: "Les seuils inférieurs doivent respecter les limites valides" });
  }
});

const thresholdsSchema = z.object({
  vibration: thresholdSchema,
  temperature: thresholdSchema,
  current: thresholdSchema,
});

const createSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  type: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  location: z.string().min(1),
  commissionedAt: z.string().datetime().optional(),
  assignedTechnicianId: z.string().optional(),
  hardwareId: z.string().min(1),
  deviceSecret: z.string().min(8),
  thresholds: thresholdsSchema.optional(),
});

machinesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(100, Number(req.query.limit ?? 20));
    const q: Record<string, unknown> = { ...machineFilter(req.user!) };
    if (req.query.status) q.healthStatus = req.query.status;
    if (req.query.location) q.location = req.query.location;
    if (req.query.type) q.type = req.query.type;
    if (req.query.operational) q.operationalStatus = req.query.operational;
    if (req.query.search) {
      const search = escapeRegex(String(req.query.search).slice(0, 100));
      q.$or = [
        { name: new RegExp(search, "i") },
        { code: new RegExp(search, "i") },
      ];
    }
    const sort: Record<string, 1 | -1> = { name: 1 };
    if (req.query.sort === "health") sort.healthStatus = 1;
    const [data, total] = await Promise.all([
      Machine.find(q)
        .populate("assignedTechnicianId", "firstName lastName email")
        .populate("deviceId", "hardwareId status lastSeenAt")
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Machine.countDocuments(q),
    ]);
    paginated(res, data, { page, limit, total });
  }),
);

machinesRouter.post(
  "/",
  authorize("admin"),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const secretHash = await bcrypt.hash(req.body.deviceSecret, 10);
    const device = await Device.create({
      hardwareId: req.body.hardwareId,
      name: `ESP32 ${req.body.code}`,
      secretHash,
      status: "offline",
    });
    const machine = await Machine.create({
      ...req.body,
      code: req.body.code.toUpperCase(),
      deviceId: device._id,
      thresholds: req.body.thresholds ?? defaultThresholds,
      commissionedAt: req.body.commissionedAt ? new Date(req.body.commissionedAt) : undefined,
    });
    device.machineId = machine._id;
    await device.save();
    await audit(req, "machine.create", "machine", String(machine._id));
    ok(res, machine, 201);
  }),
);

machinesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    assertObjectId(req.params.id, "Machine");
    await assertMachineAccess(req.user!, req.params.id);
    const machine = await Machine.findById(req.params.id)
      .populate("assignedTechnicianId", "firstName lastName email phone")
      .populate("deviceId", "hardwareId status lastSeenAt firmwareVersion revoked")
      .lean();
    if (!machine) throw new AppError(404, "Machine introuvable", "NOT_FOUND");
    ok(res, machine);
  }),
);

machinesRouter.patch(
  "/:id",
  authorize("admin", "maintenance_manager"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().optional(),
        description: z.string().optional(),
        type: z.string().optional(),
        brand: z.string().optional(),
        model: z.string().optional(),
        location: z.string().optional(),
        assignedTechnicianId: z.union([z.string(), z.null()]).optional(),
        operationalStatus: z.enum(["active", "inactive"]).optional(),
        thresholds: thresholdsSchema.optional(),
        confirmationCount: z.number().int().min(1).max(20).optional(),
        hysteresisCount: z.number().int().min(1).max(20).optional(),
      })
      .parse(req.body);
    assertObjectId(req.params.id, "Machine");
    const update: Record<string, unknown> = { ...body };
    if (body.assignedTechnicianId === "" || body.assignedTechnicianId === null) {
      update.assignedTechnicianId = null;
    }
    const machine = await Machine.findByIdAndUpdate(req.params.id, update, { new: true }).populate(
      "deviceId",
      "hardwareId",
    );
    if (!machine) throw new AppError(404, "Machine introuvable", "NOT_FOUND");
    if (body.thresholds) {
      const hardwareId = (machine.deviceId as unknown as { hardwareId?: string } | null)?.hardwareId;
      if (hardwareId) {
        publishConfig(hardwareId, { machineId: String(machine._id), thresholds: machine.thresholds });
      }
    }
    await audit(req, "machine.update", "machine", String(machine._id), {
      fields: Object.keys(body),
    });
    const updateEvent = { machineId: String(machine._id), fields: Object.keys(body) };
    emitToMachine(String(machine._id), "machine:updated", updateEvent);
    emitToOps("machine:updated", updateEvent);
    ok(res, machine);
  }),
);

machinesRouter.post(
  "/:id/deactivate",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    const machine = await Machine.findByIdAndUpdate(
      req.params.id,
      { operationalStatus: "inactive" },
      { new: true },
    );
    if (!machine) throw new AppError(404, "Machine introuvable", "NOT_FOUND");
    await audit(req, "machine.deactivate", "machine", String(machine._id));
    ok(res, machine);
  }),
);

machinesRouter.get(
  "/:id/measurements",
  asyncHandler(async (req, res) => {
    await assertMachineAccess(req.user!, req.params.id);
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(500, Number(req.query.limit ?? 100));
    const q: Record<string, unknown> = { machineId: req.params.id };
    if (req.query.from || req.query.to) {
      const measuredAt: Record<string, Date> = {};
      if (req.query.from) measuredAt.$gte = new Date(String(req.query.from));
      if (req.query.to) measuredAt.$lte = new Date(String(req.query.to));
      q.measuredAt = measuredAt;
    }
    const [data, total] = await Promise.all([
      Measurement.find(q)
        .sort({ measuredAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Measurement.countDocuments(q),
    ]);
    paginated(res, data, { page, limit, total });
  }),
);

machinesRouter.get(
  "/:id/alerts",
  asyncHandler(async (req, res) => {
    await assertMachineAccess(req.user!, req.params.id);
    const data = await Alert.find({ machineId: req.params.id }).sort({ detectedAt: -1 }).limit(100).lean();
    ok(res, data);
  }),
);

machinesRouter.get(
  "/:id/interventions",
  asyncHandler(async (req, res) => {
    await assertMachineAccess(req.user!, req.params.id);
    const data = await Intervention.find({ machineId: req.params.id }).sort({ createdAt: -1 }).lean();
    ok(res, data);
  }),
);

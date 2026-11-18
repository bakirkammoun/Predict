import { Router } from "express";
import { z } from "zod";
import {
  Intervention,
  INTERVENTION_STATUSES,
  INTERVENTION_TRANSITIONS,
  type InterventionStatus,
} from "../models/Intervention.js";
import { Alert } from "../models/Alert.js";
import { Machine } from "../models/Machine.js";
import { User } from "../models/User.js";
import { assertObjectId } from "../utils/ids.js";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authorize } from "../middlewares/rbac.js";
import { ok, paginated } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import { accessibleMachineIds, assertMachineAccess } from "../services/scopeService.js";
import { emitToMachine, emitToUser } from "../sockets/hub.js";
import { audit } from "../services/auditService.js";
import { notifyUser } from "../services/notificationService.js";

export const interventionsRouter = Router();
interventionsRouter.use(authenticate);

function nextRef() {
  return `INT-${Date.now().toString(36).toUpperCase()}`;
}

interventionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const ids = await accessibleMachineIds(req.user!);
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(100, Number(req.query.limit ?? 20));
    const q: Record<string, unknown> = { machineId: { $in: ids } };
    if (req.query.status) q.status = req.query.status;
    if (req.query.machineId) {
      const requested = String(req.query.machineId);
      if (!ids.map(String).includes(requested)) {
        throw new AppError(403, "Machine non autorisée", "FORBIDDEN");
      }
      q.machineId = requested;
    }
    if (req.query.technicianId) q.assignedTechnicianId = req.query.technicianId;
    if (req.user!.role === "technician") q.assignedTechnicianId = req.user!.id;
    if (req.query.from || req.query.to) {
      const dateRange: Record<string, Date> = {};
      if (req.query.from) dateRange.$gte = new Date(String(req.query.from));
      if (req.query.to) dateRange.$lte = new Date(String(req.query.to));
      if (req.query.calendar === "true") {
        q.$or = [
          { status: { $ne: "completed" }, scheduledAt: dateRange },
          { status: "completed", endedAt: dateRange },
          { status: "completed", scheduledAt: dateRange, endedAt: { $exists: false } },
        ];
      } else {
        q.scheduledAt = dateRange;
      }
    }
    const [data, total] = await Promise.all([
      Intervention.find(q)
        .populate("machineId", "name code location")
        .populate("assignedTechnicianId", "firstName lastName email")
        .populate("alertId", "parameter")
        .sort({ scheduledAt: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Intervention.countDocuments(q),
    ]);
    paginated(res, data, { page, limit, total });
  }),
);

interventionsRouter.post(
  "/",
  authorize("admin", "maintenance_manager"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        machineId: z.string(),
        alertId: z.string().optional(),
        type: z.enum(["corrective", "preventive", "inspection"]),
        problemDescription: z.string().min(3),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        assignedTechnicianId: z.string().optional(),
        scheduledAt: z.string().datetime().optional(),
        estimatedCost: z.number().optional(),
      })
      .parse(req.body);
    assertObjectId(body.machineId, "Machine");
    const machine = await Machine.findById(body.machineId);
    if (!machine) throw new AppError(404, "Machine introuvable", "NOT_FOUND");
    if (body.assignedTechnicianId) {
      assertObjectId(body.assignedTechnicianId, "Technicien");
      const tech = await User.findById(body.assignedTechnicianId);
      if (!tech || tech.role !== "technician" || !tech.isActive) {
        throw new AppError(400, "Technicien invalide ou inactif", "VALIDATION_ERROR");
      }
    }
    if (body.alertId) {
      assertObjectId(body.alertId, "Alerte");
      const alert = await Alert.findById(body.alertId);
      if (!alert) throw new AppError(404, "Alerte introuvable", "NOT_FOUND");
      if (String(alert.machineId) !== String(machine._id)) {
        throw new AppError(400, "L'alerte n'appartient pas à cette machine", "VALIDATION_ERROR");
      }
    }
    const doc = await Intervention.create({
      ...body,
      reference: nextRef(),
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
      status: body.scheduledAt ? "planned" : "todo",
      history: [{ actorId: req.user!.id, action: "created", toStatus: body.scheduledAt ? "planned" : "todo" }],
    });
    if (body.alertId) {
      await Alert.findByIdAndUpdate(body.alertId, { interventionId: doc._id, status: "in_progress" });
    }
    if (body.assignedTechnicianId) {
      await notifyUser(
        body.assignedTechnicianId,
        "Nouvelle intervention",
        doc.reference,
        "intervention",
        "intervention",
        String(doc._id),
      );
      emitToUser(body.assignedTechnicianId, "intervention:updated", doc.toObject());
    }
    emitToMachine(body.machineId, "intervention:updated", doc.toObject());
    await audit(req, "intervention.create", "intervention", String(doc._id));
    ok(res, doc, 201);
  }),
);

interventionsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    assertObjectId(req.params.id, "Intervention");
    const doc = await Intervention.findById(req.params.id)
      .populate("machineId")
      .populate("assignedTechnicianId", "firstName lastName email phone")
      .populate("alertId")
      .lean();
    if (!doc) throw new AppError(404, "Intervention introuvable", "NOT_FOUND");
    const machineRef = doc.machineId as unknown as { _id?: unknown } | string;
    const machineId =
      typeof machineRef === "object" && machineRef?._id != null ? String(machineRef._id) : String(machineRef);
    await assertMachineAccess(req.user!, machineId);
    if (req.user!.role === "technician" && String(doc.assignedTechnicianId?._id ?? doc.assignedTechnicianId) !== req.user!.id) {
      throw new AppError(403, "Intervention non assignée", "FORBIDDEN");
    }
    ok(res, doc);
  }),
);

interventionsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        status: z.enum(INTERVENTION_STATUSES).optional(),
        assignedTechnicianId: z.string().optional(),
        scheduledAt: z.string().datetime().optional(),
        diagnosis: z.string().optional(),
        actions: z.string().optional(),
        observations: z.string().optional(),
        parts: z.array(z.object({ name: z.string(), quantity: z.number().min(1) })).optional(),
        actualCost: z.number().optional(),
        estimatedCost: z.number().optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        problemDescription: z.string().optional(),
      })
      .parse(req.body);

    assertObjectId(req.params.id, "Intervention");
    const doc = await Intervention.findById(req.params.id);
    if (!doc) throw new AppError(404, "Intervention introuvable", "NOT_FOUND");
    await assertMachineAccess(req.user!, String(doc.machineId));

    const isTech = req.user!.role === "technician";
    if (isTech && String(doc.assignedTechnicianId) !== req.user!.id) {
      throw new AppError(403, "Intervention non assignée", "FORBIDDEN");
    }

    if (body.status && body.status !== doc.status) {
      const allowed = INTERVENTION_TRANSITIONS[doc.status as InterventionStatus];
      if (!allowed.includes(body.status)) {
        throw new AppError(400, "Transition de statut interdite", "INVALID_TRANSITION");
      }
      if (isTech && !["in_progress", "on_hold", "completed"].includes(body.status)) {
        throw new AppError(403, "Statut non autorisé pour un technicien", "FORBIDDEN");
      }
      if (body.status === "in_progress" && !doc.startedAt) doc.startedAt = new Date();
      if (body.status === "completed") {
        if (isTech && !body.diagnosis && !doc.diagnosis) {
          throw new AppError(400, "Un diagnostic est requis pour clôturer", "VALIDATION_ERROR");
        }
        doc.endedAt = new Date();
      }
      doc.history.push({
        actorId: req.user!.id as never,
        action: "status_change",
        fromStatus: doc.status,
        toStatus: body.status,
      });
      doc.status = body.status;
    }

    if (body.assignedTechnicianId && !isTech) doc.assignedTechnicianId = body.assignedTechnicianId as never;
    if (body.scheduledAt && !isTech) doc.scheduledAt = new Date(body.scheduledAt);
    if (body.diagnosis !== undefined) doc.diagnosis = body.diagnosis;
    if (body.actions !== undefined) doc.actions = body.actions;
    if (body.observations !== undefined) doc.observations = body.observations;
    if (body.parts) doc.set("parts", body.parts);
    if (body.actualCost !== undefined) doc.actualCost = body.actualCost;
    if (body.estimatedCost !== undefined && !isTech) doc.estimatedCost = body.estimatedCost;
    if (body.priority && !isTech) doc.priority = body.priority;
    if (body.problemDescription && !isTech) doc.problemDescription = body.problemDescription;

    await doc.save();
    emitToMachine(String(doc.machineId), "intervention:updated", doc.toObject());
    await audit(req, "intervention.update", "intervention", String(doc._id));
    ok(res, doc);
  }),
);

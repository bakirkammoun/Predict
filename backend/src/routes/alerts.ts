import { Router } from "express";
import { z } from "zod";
import { Alert, ALERT_STATUSES, ALERT_TRANSITIONS, type AlertStatus } from "../models/Alert.js";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { ok, paginated } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import { accessibleMachineIds, assertMachineAccess } from "../services/scopeService.js";
import { emitToMachine } from "../sockets/hub.js";
import { assertObjectId } from "../utils/ids.js";
import { audit } from "../services/auditService.js";

export const alertsRouter = Router();
alertsRouter.use(authenticate);

alertsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const ids = await accessibleMachineIds(req.user!);
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(100, Number(req.query.limit ?? 20));
    const q: Record<string, unknown> = { machineId: { $in: ids } };
    if (req.query.status) q.status = req.query.status;
    if (req.query.severity) q.severity = req.query.severity;
    if (req.query.machineId) {
      const requested = String(req.query.machineId);
      if (!ids.map(String).includes(requested)) {
        throw new AppError(403, "Machine non autorisée", "FORBIDDEN");
      }
      q.machineId = requested;
    }
    const [data, total] = await Promise.all([
      Alert.find(q)
        .populate("machineId", "name code location")
        .sort({ detectedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Alert.countDocuments(q),
    ]);
    paginated(res, data, { page, limit, total });
  }),
);

alertsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    assertObjectId(req.params.id, "Alerte");
    const alert = await Alert.findById(req.params.id)
      .populate("machineId", "name code location healthStatus")
      .populate("acknowledgedBy", "firstName lastName")
      .populate("interventionId", "reference status")
      .lean();
    if (!alert) throw new AppError(404, "Alerte introuvable", "NOT_FOUND");
    await assertMachineAccess(req.user!, String((alert.machineId as { _id: unknown })._id ?? alert.machineId));
    ok(res, alert);
  }),
);

alertsRouter.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const { status } = z.object({ status: z.enum(ALERT_STATUSES) }).parse(req.body);
    assertObjectId(req.params.id, "Alerte");
    const alert = await Alert.findById(req.params.id);
    if (!alert) throw new AppError(404, "Alerte introuvable", "NOT_FOUND");
    await assertMachineAccess(req.user!, String(alert.machineId));
    if (status !== alert.status) {
      const allowed = ALERT_TRANSITIONS[alert.status as AlertStatus] ?? [];
      if (!allowed.includes(status)) {
        throw new AppError(400, "Transition de statut d'alerte interdite", "INVALID_TRANSITION");
      }
    }
    alert.status = status;
    if (status === "acknowledged") {
      alert.acknowledgedBy = req.user!.id as never;
      alert.acknowledgedAt = new Date();
    }
    if (status === "resolved") alert.resolvedAt = new Date();
    await alert.save();
    emitToMachine(String(alert.machineId), "alert:updated", alert.toObject());
    await audit(req, "alert.status", "alert", String(alert._id), { status });
    ok(res, alert);
  }),
);

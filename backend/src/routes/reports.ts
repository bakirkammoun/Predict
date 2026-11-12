import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { authorize } from "../middlewares/rbac.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { Alert } from "../models/Alert.js";
import { Intervention } from "../models/Intervention.js";
import { Machine } from "../models/Machine.js";
import { Measurement } from "../models/Measurement.js";
import { accessibleMachineIds } from "../services/scopeService.js";
import { computeAvailability } from "../services/dashboardService.js";
import { ok } from "../utils/apiResponse.js";

export const reportsRouter = Router();
reportsRouter.use(authenticate, authorize("admin", "maintenance_manager"));

reportsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const ids = await accessibleMachineIds(req.user!);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 7 * 24 * 3600_000);
    const machines = await Machine.find({ _id: { $in: ids } }).lean();
    const rows = [];
    for (const m of machines) {
      const alerts = await Alert.countDocuments({
        machineId: m._id,
        detectedAt: { $gte: from, $lte: to },
      });
      const interventions = await Intervention.countDocuments({
        machineId: m._id,
        createdAt: { $gte: from, $lte: to },
      });
      const samples = await Measurement.countDocuments({
        machineId: m._id,
        measuredAt: { $gte: from, $lte: to },
      });
      rows.push({
        machineId: m._id,
        name: m.name,
        code: m.code,
        healthStatus: m.healthStatus,
        operationalStatus: m.operationalStatus,
        alerts,
        interventions,
        samples,
        availability: m.operationalStatus === "active"
          ? await computeAvailability(String(m._id), from, to)
          : null,
        heuristicRisk: m.heuristicRisk,
        heuristicNote: "Indicateur heuristique (écarts aux seuils), pas un modèle ML validé.",
      });
    }
    ok(res, { from, to, rows });
  }),
);

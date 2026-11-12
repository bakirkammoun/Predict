import { Router } from "express";
import { Measurement } from "../models/Measurement.js";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { paginated } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import { accessibleMachineIds } from "../services/scopeService.js";

export const measurementsRouter = Router();
measurementsRouter.use(authenticate);

measurementsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const ids = await accessibleMachineIds(req.user!);
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const q: Record<string, unknown> = { machineId: { $in: ids } };
    if (req.query.machineId) {
      const requested = String(req.query.machineId);
      if (!ids.map(String).includes(requested)) {
        throw new AppError(403, "Machine non autorisée", "FORBIDDEN");
      }
      q.machineId = requested;
    }
    if (req.query.source === "simulation" || req.query.source === "hardware") {
      q.source = req.query.source;
    }
    if (req.query.from || req.query.to) {
      const measuredAt: Record<string, Date> = {};
      if (req.query.from) measuredAt.$gte = new Date(String(req.query.from));
      if (req.query.to) measuredAt.$lte = new Date(String(req.query.to));
      q.measuredAt = measuredAt;
    }
    const [data, total] = await Promise.all([
      Measurement.find(q)
        .populate("machineId", "name code")
        .sort({ measuredAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Measurement.countDocuments(q),
    ]);
    paginated(res, data, { page, limit, total });
  }),
);

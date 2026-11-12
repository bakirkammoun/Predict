import { Router } from "express";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { dashboardSummary } from "../services/dashboardService.js";
import { ok } from "../utils/apiResponse.js";
import { HealthStateLog } from "../models/HealthStateLog.js";
import { accessibleMachineIds } from "../services/scopeService.js";

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 24 * 3600_000);
    const data = await dashboardSummary(req.user!, from, to);
    ok(res, data);
  }),
);

dashboardRouter.get(
  "/events",
  asyncHandler(async (req, res) => {
    const ids = await accessibleMachineIds(req.user!);
    const data = await HealthStateLog.find({ machineId: { $in: ids } })
      .sort({ at: -1 })
      .limit(40)
      .populate("machineId", "name code")
      .lean();
    ok(res, data);
  }),
);

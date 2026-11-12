import { Router } from "express";
import { AuditLog } from "../models/AuditLog.js";
import { authenticate } from "../middlewares/auth.js";
import { authorize } from "../middlewares/rbac.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { paginated } from "../utils/apiResponse.js";

export const auditRouter = Router();
auditRouter.use(authenticate, authorize("admin"));

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(100, Number(req.query.limit ?? 30));
    const q: Record<string, unknown> = {};
    if (req.query.resource) q.resource = req.query.resource;
    const [data, total] = await Promise.all([
      AuditLog.find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(q),
    ]);
    paginated(res, data, { page, limit, total });
  }),
);

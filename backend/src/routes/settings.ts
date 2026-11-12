import { Router } from "express";
import { z } from "zod";
import { SystemSettings } from "../models/SystemSettings.js";
import { authenticate } from "../middlewares/auth.js";
import { authorize } from "../middlewares/rbac.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { ok } from "../utils/apiResponse.js";
import { env } from "../config/env.js";
import { audit } from "../services/auditService.js";

export const settingsRouter = Router();
settingsRouter.use(authenticate, authorize("admin"));

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const doc =
      (await SystemSettings.findOne({ key: "global" }).lean()) ??
      (await SystemSettings.create({
        key: "global",
        offlineTimeoutMs: env.OFFLINE_TIMEOUT_MS,
        measurementRetentionDays: env.MEASUREMENT_RETENTION_DAYS,
      }));
    ok(res, doc);
  }),
);

settingsRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        offlineTimeoutMs: z.number().min(10_000).optional(),
        measurementRetentionDays: z.number().min(1).max(730).optional(),
        confirmationCount: z.number().int().min(1).optional(),
        hysteresisCount: z.number().int().min(1).optional(),
      })
      .parse(req.body);
    const doc = await SystemSettings.findOneAndUpdate({ key: "global" }, body, {
      new: true,
      upsert: true,
    });
    await audit(req, "settings.update", "settings", "global", body);
    ok(res, doc);
  }),
);

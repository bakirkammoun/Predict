import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Device } from "../models/Device.js";
import { authenticate } from "../middlewares/auth.js";
import { authorize } from "../middlewares/rbac.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { ok } from "../utils/apiResponse.js";
import { AppError } from "../utils/AppError.js";
import { audit } from "../services/auditService.js";
import { assertObjectId } from "../utils/ids.js";
import { validate } from "../middlewares/validate.js";

export const devicesRouter = Router();
devicesRouter.use(authenticate, authorize("admin"));

devicesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const data = await Device.find().populate("machineId", "name code").lean();
    ok(res, data);
  }),
);

devicesRouter.post(
  "/:id/revoke",
  asyncHandler(async (req, res) => {
    assertObjectId(req.params.id, "Appareil");
    const device = await Device.findByIdAndUpdate(req.params.id, { revoked: true, status: "offline" }, { new: true });
    if (!device) throw new AppError(404, "Appareil introuvable", "NOT_FOUND");
    await audit(req, "device.revoke", "device", String(device._id));
    ok(res, device);
  }),
);

devicesRouter.post(
  "/:id/rotate-secret",
  validate(z.object({ secret: z.string().min(8) })),
  asyncHandler(async (req, res) => {
    assertObjectId(req.params.id, "Appareil");
    const secretHash = await bcrypt.hash(req.body.secret, 10);
    const device = await Device.findByIdAndUpdate(req.params.id, { secretHash }, { new: true });
    if (!device) throw new AppError(404, "Appareil introuvable", "NOT_FOUND");
    await audit(req, "device.rotate_secret", "device", String(device._id));
    ok(res, { rotated: true, hardwareId: device.hardwareId });
  }),
);

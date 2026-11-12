import { Router } from "express";
import { Notification } from "../models/Notification.js";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { ok } from "../utils/apiResponse.js";

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const data = await Notification.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(50).lean();
    ok(res, data);
  }),
);

notificationsRouter.patch(
  "/read-all",
  asyncHandler(async (req, res) => {
    const result = await Notification.updateMany(
      { userId: req.user!.id, readAt: { $exists: false } },
      { $set: { readAt: new Date() } },
    );
    ok(res, { updated: result.modifiedCount });
  }),
);

notificationsRouter.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const doc = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { readAt: new Date() },
      { new: true },
    );
    ok(res, doc);
  }),
);

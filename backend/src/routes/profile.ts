import { Router } from "express";
import { z } from "zod";
import { User } from "../models/User.js";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { ok } from "../utils/apiResponse.js";
import { bumpTokenVersion, hashPassword } from "../services/authService.js";
import { AppError } from "../utils/AppError.js";
import bcrypt from "bcryptjs";

export const profileRouter = Router();
profileRouter.use(authenticate);

profileRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id);
    if (!user) throw new AppError(404, "Utilisateur introuvable", "NOT_FOUND");
    ok(res, user);
  }),
);

profileRouter.patch(
  "/",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().min(1).optional(),
        phone: z.string().optional(),
      })
      .parse(req.body);
    const user = await User.findByIdAndUpdate(req.user!.id, body, { new: true });
    ok(res, user);
  }),
);

profileRouter.patch(
  "/password",
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(8), newPassword: z.string().min(8) })
      .parse(req.body);
    const user = await User.findById(req.user!.id).select("+passwordHash");
    if (!user) throw new AppError(404, "Utilisateur introuvable", "NOT_FOUND");
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new AppError(400, "Mot de passe actuel incorrect", "INVALID_PASSWORD");
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    await bumpTokenVersion(String(user._id));
    ok(res, { updated: true });
  }),
);

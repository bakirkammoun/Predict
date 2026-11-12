import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { authenticate } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  bootstrapAdmin,
  bumpTokenVersion,
  login,
  register,
  verifyRegistration,
} from "../services/authService.js";
import { User } from "../models/User.js";
import { ok } from "../utils/apiResponse.js";
import { audit } from "../services/auditService.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  validate(
    z.object({
      email: z.string().email(),
      password: z.string().min(10),
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      phone: z.string().trim().max(30).optional(),
      role: z.enum(["maintenance_manager", "technician"]),
    }),
  ),
  asyncHandler(async (req, res) => {
    const data = await register(req.body);
    ok(res, data, 202);
  }),
);

authRouter.post(
  "/verify-email",
  validate(
    z.object({
      email: z.string().email(),
      code: z.string().regex(/^\d{6}$/),
    }),
  ),
  asyncHandler(async (req, res) => {
    const data = await verifyRegistration(req.body.email, req.body.code);
    ok(res, data, 202);
  }),
);

authRouter.post(
  "/login",
  validate(
    z.object({
      email: z.string().email(),
      password: z.string().min(8),
    }),
  ),
  asyncHandler(async (req, res) => {
    const data = await login(req.body.email, req.body.password);
    await audit(req, "auth.login", "user", data.user.id);
    ok(res, data);
  }),
);

authRouter.post(
  "/bootstrap",
  validate(
    z.object({
      email: z.string().email(),
      password: z.string().min(10),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
    }),
  ),
  asyncHandler(async (req, res) => {
    const data = await bootstrapAdmin(req.body);
    await audit(req, "auth.bootstrap", "user", data.user.id);
    ok(res, data, 201);
  }),
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user!.id).lean();
    ok(res, user);
  }),
);

authRouter.post(
  "/logout",
  authenticate,
  asyncHandler(async (req, res) => {
    await bumpTokenVersion(req.user!.id);
    await audit(req, "auth.logout", "user", req.user!.id);
    ok(res, { loggedOut: true });
  }),
);

import { Router } from "express";
import { z } from "zod";
import { User, ROLES } from "../models/User.js";
import { authenticate } from "../middlewares/auth.js";
import { authorize } from "../middlewares/rbac.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { validate } from "../middlewares/validate.js";
import { ok, paginated } from "../utils/apiResponse.js";
import { bumpTokenVersion, hashPassword } from "../services/authService.js";
import { AppError } from "../utils/AppError.js";
import { assertObjectId } from "../utils/ids.js";
import { audit } from "../services/auditService.js";
import { escapeRegex } from "../utils/escapeRegex.js";

export const usersRouter = Router();
usersRouter.use(authenticate);

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(ROLES),
});

usersRouter.get(
  "/",
  authorize("admin", "maintenance_manager"),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Math.min(100, Number(req.query.limit ?? 20));
    const q: Record<string, unknown> = {};
    if (req.query.role) q.role = req.query.role;
    if (req.query.search) {
      const search = escapeRegex(String(req.query.search).slice(0, 100));
      q.$or = [
        { email: new RegExp(search, "i") },
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
      ];
    }
    const [data, total] = await Promise.all([
      User.find(q)
        .sort({ lastName: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(q),
    ]);
    paginated(res, data, { page, limit, total });
  }),
);

usersRouter.get(
  "/pending-approval",
  authorize("admin"),
  asyncHandler(async (_req, res) => {
    const data = await User.find({ approvalStatus: "pending" })
      .select("email firstName lastName role createdAt")
      .sort({ createdAt: 1 })
      .lean();
    ok(res, data);
  }),
);

usersRouter.post(
  "/:id/approve",
  authorize("admin"),
  asyncHandler(async (req, res) => {
    assertObjectId(req.params.id, "Utilisateur");
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, approvalStatus: "pending" },
      { $set: { approvalStatus: "approved", isActive: true } },
      { new: true, runValidators: true },
    );
    if (!user) {
      throw new AppError(
        404,
        "Demande d’approbation introuvable",
        "PENDING_USER_NOT_FOUND",
      );
    }
    await audit(req, "user.approve", "user", String(user._id), {
      role: user.role,
    });
    ok(res, user);
  }),
);

usersRouter.post(
  "/",
  authorize("admin"),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const exists = await User.findOne({ email: req.body.email.toLowerCase() });
    if (exists) throw new AppError(409, "Email déjà utilisé", "CONFLICT");
    const passwordHash = await hashPassword(req.body.password);
    const user = await User.create({
      ...req.body,
      email: req.body.email.toLowerCase(),
      passwordHash,
    });
    await audit(req, "user.create", "user", String(user._id), {
      role: user.role,
    });
    ok(res, user, 201);
  }),
);

usersRouter.patch(
  "/:id",
  authorize("admin"),
  validate(
    z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      phone: z.string().optional(),
      role: z.enum(ROLES).optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(8).optional(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const update: Record<string, unknown> = { ...req.body };
    if (req.body.password) {
      update.passwordHash = await hashPassword(req.body.password);
      delete update.password;
    }
    assertObjectId(req.params.id, "Utilisateur");
    const user = await User.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    if (!user) throw new AppError(404, "Utilisateur introuvable", "NOT_FOUND");
    if (req.body.password || req.body.isActive === false) {
      await bumpTokenVersion(String(user._id));
    }
    await audit(req, "user.update", "user", String(user._id), {
      role: user.role,
      isActive: user.isActive,
    });
    ok(res, user);
  }),
);

usersRouter.get(
  "/:id",
  authorize("admin", "maintenance_manager"),
  asyncHandler(async (req, res) => {
    assertObjectId(req.params.id, "Utilisateur");
    const user = await User.findById(req.params.id).lean();
    if (!user) throw new AppError(404, "Utilisateur introuvable", "NOT_FOUND");
    ok(res, user);
  }),
);

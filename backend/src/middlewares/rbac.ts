import type { NextFunction, Request, Response } from "express";
import type { Role } from "../models/User.js";
import { AppError } from "../utils/AppError.js";

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new AppError(401, "Authentification requise", "UNAUTHENTICATED");
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, "Droits insuffisants", "FORBIDDEN");
    }
    next();
  };
}

export function isPrivileged(role: Role) {
  return role === "admin" || role === "maintenance_manager";
}

import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import type { Role } from "../models/User.js";
import { User } from "../models/User.js";

export interface JwtPayload {
  sub: string;
  role: Role;
  email: string;
  tv?: number;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  void (async () => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "Authentification requise", "UNAUTHENTICATED");
    }
    const token = header.slice(7);
    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      throw new AppError(401, "Jeton invalide ou expiré", "INVALID_TOKEN");
    }
    const user = await User.findById(payload.sub).select("role email isActive tokenVersion");
    if (!user || !user.isActive) {
      throw new AppError(401, "Session invalide ou compte désactivé", "INVALID_TOKEN");
    }
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new AppError(401, "Session expirée", "INVALID_TOKEN");
    }
    req.user = { id: String(user._id), role: user.role, email: user.email };
    next();
  })().catch(next);
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as JwtPayload;
      req.user = { id: payload.sub, role: payload.role, email: payload.email };
    } catch {
      /* ignore */
    }
  }
  next();
}

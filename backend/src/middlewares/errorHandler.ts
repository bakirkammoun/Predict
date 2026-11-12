import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Données invalides",
        details: err.flatten(),
      },
    });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Identifiant invalide" },
    });
  }
  if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
    return res.status(409).json({
      success: false,
      error: { code: "CONFLICT", message: "Ressource déjà existante" },
    });
  }
  logger.error("Unhandled error", { err });
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Une erreur interne est survenue" },
  });
}

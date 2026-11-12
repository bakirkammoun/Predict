import { AppError } from "./AppError.js";

const OBJECT_ID = /^[a-fA-F0-9]{24}$/;

export function assertObjectId(id: string, label = "Identifiant") {
  if (!OBJECT_ID.test(id)) {
    throw new AppError(400, `${label} invalide`, "VALIDATION_ERROR");
  }
  return id;
}

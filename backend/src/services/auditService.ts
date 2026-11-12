import type { Request } from "express";
import { AuditLog } from "../models/AuditLog.js";

export async function audit(
  req: Request | null,
  action: string,
  resource: string,
  resourceId = "",
  metadata: Record<string, unknown> = {},
) {
  await AuditLog.create({
    actorId: req?.user?.id,
    actorEmail: req?.user?.email ?? "system",
    action,
    resource,
    resourceId,
    metadata,
    ip: req?.ip ?? "",
  });
}

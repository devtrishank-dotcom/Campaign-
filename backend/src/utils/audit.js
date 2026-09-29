import { AuditLog } from "../models/AuditLog.js";
import { logger } from "./logger.js";
import { ownerValue } from "./scope.js";

export async function recordAudit(req, action, entity = "", entityId = "", meta = {}) {
  try {
    await AuditLog.create({
      actor: req.user?._id || null,
      actorEmail: req.user?.email || "",
      action,
      entity,
      entityId: entityId ? String(entityId) : "",
      meta,
      ip: req.ip || req.headers["x-forwarded-for"] || "",
      owner: ownerValue(req.user),
    });
  } catch (err) {
    logger.warn(`Audit log failed: ${err.message}`);
  }
}

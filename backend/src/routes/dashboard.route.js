import express from "express";
import { overview, auditLogs } from "../controllers/dashboard.controller.js";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

const router = express.Router();

router.use(protect);

router.get("/overview", requirePermission("dashboard.view", "reports.view"), overview);
router.get("/audit-logs", requirePermission("reports.view"), auditLogs);

export default router;

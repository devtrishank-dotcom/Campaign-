import express from "express";
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  roleMeta,
} from "../controllers/role.controller.js";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

const router = express.Router();

router.use(protect, requirePermission("roles.manage"));

router.get("/meta", roleMeta);
router.get("/", listRoles);
router.post("/", createRole);
router.get("/:id", getRole);
router.put("/:id", updateRole);
router.delete("/:id", deleteRole);

export default router;

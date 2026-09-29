import express from "express";
import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  meta,
  importUsers,
  exportUsers,
  userTemplate,
} from "../controllers/user.controller.js";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { uploadSpreadsheet } from "../middleware/upload.js";

const router = express.Router();

router.use(protect, requirePermission("users.manage"));

router.get("/meta", meta);
router.get("/template", userTemplate);
router.get("/export", exportUsers);
router.post("/import", uploadSpreadsheet.single("file"), importUsers);
router.get("/", listUsers);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;

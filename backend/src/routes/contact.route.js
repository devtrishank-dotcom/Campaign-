import express from "express";
import {
  listContacts,
  getContact,
  createContact,
  updateContact,
  deleteContact,
  bulkDeleteContacts,
  importContacts,
  contactTags,
  exportContacts,
  contactTemplate,
  contactDefaults,
} from "../controllers/contact.controller.js";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";
import { uploadCsv } from "../middleware/upload.js";

const router = express.Router();

router.use(protect, requirePermission("contacts.manage"));

router.get("/tags", contactTags);
router.get("/defaults", contactDefaults);
router.get("/template", contactTemplate);
router.get("/export", exportContacts);
router.post("/import", uploadCsv.single("file"), importContacts);
router.post("/bulk-delete", bulkDeleteContacts);
router.get("/", listContacts);
router.post("/", createContact);
router.get("/:id", getContact);
router.put("/:id", updateContact);
router.delete("/:id", deleteContact);

export default router;

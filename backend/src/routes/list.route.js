import express from "express";
import {
  listLists,
  getList,
  createList,
  updateList,
  deleteList,
  addContactsToList,
  removeContactFromList,
} from "../controllers/list.controller.js";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

const router = express.Router();

router.use(protect, requirePermission("lists.manage"));

router.get("/", listLists);
router.post("/", createList);
router.get("/:id", getList);
router.put("/:id", updateList);
router.delete("/:id", deleteList);
router.post("/:id/contacts", addContactsToList);
router.delete("/:id/contacts/:contactId", removeContactFromList);

export default router;

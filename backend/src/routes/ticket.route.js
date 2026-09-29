import express from "express";
import {
  createTicket,
  myTickets,
  listTickets,
  ticketStats,
  getTicket,
  replyTicket,
  closeTicket,
  reopenTicket,
  ticketMeta,
} from "../controllers/ticket.controller.js";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

const router = express.Router();

router.use(protect);

router.get("/meta", ticketMeta);
router.get("/mine", myTickets);
router.post("/", createTicket);
router.get("/", requirePermission("tickets.manage"), listTickets);
router.get("/stats", requirePermission("tickets.manage"), ticketStats);
router.get("/:id", getTicket);
router.post("/:id/reply", replyTicket);
router.post("/:id/close", requirePermission("tickets.manage"), closeTicket);
router.post("/:id/reopen", requirePermission("tickets.manage"), reopenTicket);

export default router;

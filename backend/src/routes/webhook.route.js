import express from "express";
import {
  metaVerify,
  metaWebhook,
  twilioWebhook,
  customWebhook,
} from "../controllers/webhook.controller.js";

const router = express.Router();

router.get("/meta", metaVerify);
router.post("/meta", metaWebhook);
router.post("/twilio", twilioWebhook);
router.post("/custom", customWebhook);

export default router;

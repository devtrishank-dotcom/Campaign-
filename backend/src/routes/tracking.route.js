import express from "express";
import { openPixel, clickRedirect, unsubscribe } from "../controllers/tracking.controller.js";

const router = express.Router();

router.get("/open/:id", openPixel);
router.get("/click/:id", clickRedirect);
router.get("/unsubscribe/:id", unsubscribe);

export default router;

import express from "express";
import { getBranding } from "../controllers/setting.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.get("/", protect, getBranding);

export default router;

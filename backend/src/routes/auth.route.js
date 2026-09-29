import express from "express";
import rateLimit from "express-rate-limit";
import { login, me, changePassword, updateTheme } from "../controllers/auth.controller.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts, please try again later" },
});

router.post("/login", loginLimiter, login);
router.get("/me", protect, me);
router.post("/change-password", protect, changePassword);
router.put("/theme", protect, updateTheme);

export default router;

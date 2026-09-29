import express from "express";
import rateLimit from "express-rate-limit";
import { publicGetSurvey, publicSubmitSurvey } from "../controllers/survey.controller.js";

const router = express.Router();

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many submissions, please slow down" },
});

router.get("/surveys/:slug", publicGetSurvey);
router.post("/surveys/:slug/submit", submitLimiter, publicSubmitSurvey);

export default router;

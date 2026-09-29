import express from "express";
import {
  listSurveys,
  getSurvey,
  createSurvey,
  updateSurvey,
  deleteSurvey,
  surveyResults,
  surveyMeta,
} from "../controllers/survey.controller.js";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

const router = express.Router();

router.use(protect, requirePermission("surveys.manage"));

router.get("/meta", surveyMeta);
router.get("/", listSurveys);
router.post("/", createSurvey);
router.get("/:id", getSurvey);
router.put("/:id", updateSurvey);
router.delete("/:id", deleteSurvey);
router.get("/:id/results", surveyResults);

export default router;

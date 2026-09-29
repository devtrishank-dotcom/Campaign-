import express from "express";
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  previewAudience,
  sendCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  listRecipients,
  campaignStats,
  campaignStatuses,
  testSend,
  requestApproval,
  approveCampaign,
  rejectCampaign,
  retryFailed,
  exportRecipients,
} from "../controllers/campaign.controller.js";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

const router = express.Router();

router.use(protect);

router.get("/meta/statuses", campaignStatuses);

router.get("/", requirePermission("campaigns.manage"), listCampaigns);
router.post("/", requirePermission("campaigns.manage"), createCampaign);
router.post("/preview-audience", requirePermission("campaigns.manage"), previewAudience);

router.get("/:id", requirePermission("campaigns.manage"), getCampaign);
router.put("/:id", requirePermission("campaigns.manage"), updateCampaign);
router.delete("/:id", requirePermission("campaigns.manage"), deleteCampaign);

router.get("/:id/stats", requirePermission("reports.view", "campaigns.manage"), campaignStats);
router.get("/:id/recipients", requirePermission("reports.view", "campaigns.manage"), listRecipients);
router.get("/:id/recipients/export", requirePermission("reports.view", "campaigns.manage"), exportRecipients);

router.post("/:id/test", requirePermission("campaigns.send", "campaigns.manage"), testSend);
router.post("/:id/send", requirePermission("campaigns.send"), sendCampaign);
router.post("/:id/pause", requirePermission("campaigns.send"), pauseCampaign);
router.post("/:id/resume", requirePermission("campaigns.send"), resumeCampaign);
router.post("/:id/cancel", requirePermission("campaigns.send"), cancelCampaign);
router.post("/:id/retry-failed", requirePermission("campaigns.send"), retryFailed);

router.post("/:id/request-approval", requirePermission("campaigns.manage"), requestApproval);
router.post("/:id/approve", requirePermission("campaigns.approve"), approveCampaign);
router.post("/:id/reject", requirePermission("campaigns.approve"), rejectCampaign);

export default router;

import express from "express";
import {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  activateProvider,
  deleteProvider,
  testProviderConfig,
  providerMeta,
  getSendingRules,
  updateSendingRules,
  fetchWhatsappTemplates,
  updateBranding,
  uploadBrandingLogo,
} from "../controllers/setting.controller.js";
import { uploadLogo } from "../middleware/upload.js";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

const router = express.Router();

router.use(protect, requirePermission("settings.manage"));

router.get("/meta", providerMeta);
router.put("/branding", updateBranding);
router.post("/branding/logo", uploadLogo.single("logo"), uploadBrandingLogo);
router.get("/sending-rules", getSendingRules);
router.put("/sending-rules", updateSendingRules);
router.get("/providers", listProviders);
router.post("/providers", createProvider);
router.get("/providers/:id", getProvider);
router.put("/providers/:id", updateProvider);
router.post("/providers/:id/activate", activateProvider);
router.post("/providers/:id/test", testProviderConfig);
router.get("/providers/:id/whatsapp-templates", fetchWhatsappTemplates);
router.delete("/providers/:id", deleteProvider);

export default router;

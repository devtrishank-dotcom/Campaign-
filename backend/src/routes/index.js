import express from "express";
import authRoutes from "./auth.route.js";
import userRoutes from "./user.route.js";
import roleRoutes from "./role.route.js";
import contactRoutes from "./contact.route.js";
import listRoutes from "./list.route.js";
import templateRoutes from "./template.route.js";
import categoryRoutes from "./category.route.js";
import campaignRoutes from "./campaign.route.js";
import surveyRoutes from "./survey.route.js";
import settingRoutes from "./setting.route.js";
import dashboardRoutes from "./dashboard.route.js";
import publicRoutes from "./public.route.js";
import webhookRoutes from "./webhook.route.js";
import brandingRoutes from "./branding.route.js";
import ticketRoutes from "./ticket.route.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/roles", roleRoutes);
router.use("/contacts", contactRoutes);
router.use("/lists", listRoutes);
router.use("/templates", templateRoutes);
router.use("/categories", categoryRoutes);
router.use("/campaigns", campaignRoutes);
router.use("/surveys", surveyRoutes);
router.use("/settings", settingRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/public", publicRoutes);
router.use("/webhooks", webhookRoutes);
router.use("/branding", brandingRoutes);
router.use("/tickets", ticketRoutes);

export default router;

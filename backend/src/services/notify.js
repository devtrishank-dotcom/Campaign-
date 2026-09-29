import { sendMessage } from "./providerService.js";
import { getSendingSettings } from "../models/AppSetting.js";
import { logger } from "../utils/logger.js";

export async function getBrandingFor(owner = null) {
  const doc = await getSendingSettings(owner);
  return {
    companyName: doc.companyName || "Campaign Admin",
    companyEmail: doc.companyEmail || "",
    companyPhone: doc.companyPhone || "",
    logoUrl: doc.logoUrl || "",
  };
}

// Best-effort notification email (never throws)
export async function notifyEmail(owner, to, subject, text) {
  if (!to) return { sent: false, reason: "no recipient" };
  try {
    const result = await sendMessage({
      channel: "email",
      to,
      subject,
      text,
      message: text,
      owner: owner || null,
    });
    return { sent: true, providerMessageId: result?.providerMessageId || "" };
  } catch (err) {
    logger.warn(`Notification email to ${to} failed: ${err.message}`);
    return { sent: false, reason: err.message };
  }
}

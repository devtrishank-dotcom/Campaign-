import { CampaignRecipient } from "../models/CampaignRecipient.js";
import { Campaign } from "../models/Campaign.js";
import { TrackingEvent } from "../models/TrackingEvent.js";
import { logger } from "../utils/logger.js";

// Normalize provider-specific statuses to our recipient statuses
export function normalizeStatus(raw = "") {
  const s = String(raw).toLowerCase();
  if (["delivered", "read"].includes(s)) return "delivered";
  if (["failed", "undelivered", "bounce", "bounced", "rejected", "error"].includes(s)) return "failed";
  if (["sent", "accepted", "queued", "submitted"].includes(s)) return "sent";
  return "";
}

async function findRecipient({ providerMessageId, trackingId }) {
  if (trackingId) {
    const byTracking = await CampaignRecipient.findOne({ trackingId });
    if (byTracking) return byTracking;
  }
  if (providerMessageId) {
    return CampaignRecipient.findOne({ providerMessageId });
  }
  return null;
}

// Apply a delivery status update from a provider webhook.
// Only advances status forward and avoids double counting stats.
export async function applyDeliveryStatus({ providerMessageId, trackingId, status, error = "" }) {
  const normalized = normalizeStatus(status);
  if (!normalized) return { updated: false, reason: "unrecognized status" };

  const recipient = await findRecipient({ providerMessageId, trackingId });
  if (!recipient) return { updated: false, reason: "recipient not found" };

  const current = recipient.status;
  if (["opened", "clicked", "unsubscribed"].includes(current)) {
    return { updated: false, reason: `already ${current}` };
  }

  if (normalized === "delivered") {
    if (current === "delivered") return { updated: false, reason: "already delivered" };
    recipient.status = "delivered";
    recipient.deliveredAt = new Date();
    await recipient.save();
    await Campaign.updateOne({ _id: recipient.campaign }, { $inc: { "stats.delivered": 1 } });
    await TrackingEvent.create({
      campaign: recipient.campaign,
      recipient: recipient._id,
      trackingId: recipient.trackingId,
      type: "delivered",
    }).catch(() => {});
    return { updated: true };
  }

  if (normalized === "failed") {
    if (current === "failed") return { updated: false, reason: "already failed" };
    recipient.status = "failed";
    recipient.error = error || "Delivery failed";
    await recipient.save();
    const inc = { "stats.failed": 1 };
    if (current === "pending") inc["stats.pending"] = -1;
    await Campaign.updateOne({ _id: recipient.campaign }, { $inc: inc });
    await TrackingEvent.create({
      campaign: recipient.campaign,
      recipient: recipient._id,
      trackingId: recipient.trackingId,
      type: "bounce",
      url: error || "",
    }).catch(() => {});
    return { updated: true };
  }

  // 'sent' acknowledgement from provider
  if (normalized === "sent" && current === "pending") {
    recipient.status = "sent";
    recipient.sentAt = recipient.sentAt || new Date();
    await recipient.save();
    await Campaign.updateOne(
      { _id: recipient.campaign },
      { $inc: { "stats.sent": 1, "stats.pending": -1 } }
    );
    return { updated: true };
  }

  logger.debug(`Delivery status ignored: ${current} -> ${normalized}`);
  return { updated: false, reason: "no change" };
}

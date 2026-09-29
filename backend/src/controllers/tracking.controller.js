import { CampaignRecipient } from "../models/CampaignRecipient.js";
import { Campaign } from "../models/Campaign.js";
import { Contact } from "../models/Contact.js";
import { TrackingEvent } from "../models/TrackingEvent.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export const openPixel = asyncHandler(async (req, res) => {
  const trackingId = String(req.params.id || "").replace(/\.gif$/, "");
  if (trackingId) {
    const recipient = await CampaignRecipient.findOne({ trackingId });
    if (recipient && !recipient.openedAt) {
      recipient.openedAt = new Date();
      if (["sent", "delivered"].includes(recipient.status)) recipient.status = "opened";
      await recipient.save();
      await Campaign.updateOne({ _id: recipient.campaign }, { $inc: { "stats.opened": 1 } });
      await TrackingEvent.create({
        campaign: recipient.campaign,
        recipient: recipient._id,
        trackingId,
        type: "open",
        ip: req.ip || "",
        userAgent: req.headers["user-agent"] || "",
      }).catch(() => {});
    }
  }
  res.set("Content-Type", "image/gif");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.send(TRANSPARENT_GIF);
});

export const clickRedirect = asyncHandler(async (req, res) => {
  const trackingId = String(req.params.id || "");
  const url = req.query.url ? decodeURIComponent(String(req.query.url)) : "";

  const recipient = await CampaignRecipient.findOne({ trackingId });
  if (recipient) {
    if (!recipient.clickedAt) {
      recipient.clickedAt = new Date();
      recipient.status = "clicked";
      await recipient.save();
      await Campaign.updateOne({ _id: recipient.campaign }, { $inc: { "stats.clicked": 1 } });
    }
    await TrackingEvent.create({
      campaign: recipient.campaign,
      recipient: recipient._id,
      trackingId,
      type: "click",
      url,
      ip: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
    }).catch(() => {});
  }

  if (url && /^https?:\/\//i.test(url)) {
    return res.redirect(url);
  }
  return res.redirect("/");
});

export const unsubscribe = asyncHandler(async (req, res) => {
  const trackingId = String(req.params.id || "");
  const recipient = await CampaignRecipient.findOne({ trackingId });
  if (recipient) {
    recipient.status = "unsubscribed";
    await recipient.save();
    if (recipient.contact) {
      await Contact.updateOne(
        { _id: recipient.contact },
        { status: "unsubscribed", optedOutAt: new Date() }
      );
    }
    await TrackingEvent.create({
      campaign: recipient.campaign,
      recipient: recipient._id,
      trackingId,
      type: "unsubscribe",
      ip: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
    }).catch(() => {});
  }
  res.set("Content-Type", "text/html");
  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title>
  <style>body{font-family:system-ui,Segoe UI,Arial,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#f8fafc;color:#0f172a;margin:0}
  .card{background:#fff;padding:32px 40px;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.08);text-align:center;max-width:420px}
  h1{margin:0 0 8px;font-size:20px}p{margin:0;color:#64748b;font-size:14px}</style></head>
  <body><div class="card"><h1>You have been unsubscribed</h1><p>You will no longer receive messages from this campaign.</p></div></body></html>`);
});

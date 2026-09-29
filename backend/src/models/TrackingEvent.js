import mongoose from "mongoose";

const trackingEventSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", default: null },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "CampaignRecipient", default: null },
    trackingId: { type: String, default: "" },
    type: { type: String, enum: ["open", "click", "delivered", "bounce", "unsubscribe"], required: true },
    url: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

trackingEventSchema.index({ campaign: 1, type: 1 });
trackingEventSchema.index({ trackingId: 1 });

export const TrackingEvent = mongoose.model("TrackingEvent", trackingEventSchema);

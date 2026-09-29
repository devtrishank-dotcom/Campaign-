import mongoose from "mongoose";
import { CHANNELS } from "./Template.js";

export const RECIPIENT_STATUS = [
  "pending",
  "queued",
  "sent",
  "delivered",
  "failed",
  "opened",
  "clicked",
  "unsubscribed",
];

const recipientSchema = new mongoose.Schema(
  {
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", default: null },
    channel: { type: String, enum: CHANNELS, required: true },
    trackingId: { type: String, required: true, unique: true },
    to: {
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    renderedSubject: { type: String, default: "" },
    renderedBody: { type: String, default: "" },
    status: { type: String, enum: RECIPIENT_STATUS, default: "pending" },
    providerMessageId: { type: String, default: "" },
    error: { type: String, default: "" },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    openedAt: { type: Date, default: null },
    clickedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

recipientSchema.index({ campaign: 1, status: 1 });

export const CampaignRecipient = mongoose.model("CampaignRecipient", recipientSchema);

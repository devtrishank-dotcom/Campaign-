import mongoose from "mongoose";
import { CHANNELS } from "./Template.js";

export const CAMPAIGN_STATUS = [
  "draft",
  "scheduled",
  "queued",
  "running",
  "paused",
  "completed",
  "failed",
  "cancelled",
];

const statsSchema = new mongoose.Schema(
  {
    total: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 },
  },
  { _id: false }
);

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    channel: { type: String, enum: CHANNELS, required: true },
    template: { type: mongoose.Schema.Types.ObjectId, ref: "Template", default: null },
    subject: { type: String, default: "" },
    body: { type: String, required: true, default: "" },
    html: { type: String, default: "" },
    whatsappTemplateName: { type: String, default: "" },
    whatsappLanguage: { type: String, default: "en" },
    lists: [{ type: mongoose.Schema.Types.ObjectId, ref: "ContactList" }],
    // optional survey to attach a tracked voting/survey link
    survey: { type: mongoose.Schema.Types.ObjectId, ref: "Survey", default: null },
    status: { type: String, enum: CAMPAIGN_STATUS, default: "draft" },
    approval: {
      required: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ["not_required", "pending", "approved", "rejected"],
        default: "not_required",
      },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      requestedAt: { type: Date, default: null },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      approvedAt: { type: Date, default: null },
      note: { type: String, default: "" },
    },
    pausedReason: { type: String, default: "" },
    scheduledAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    stats: { type: statsSchema, default: () => ({}) },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

campaignSchema.index({ owner: 1, status: 1, createdAt: -1 });

export const Campaign = mongoose.model("Campaign", campaignSchema);

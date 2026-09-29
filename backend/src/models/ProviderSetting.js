import mongoose from "mongoose";
import { CHANNELS } from "./Template.js";

export const PROVIDERS = {
  email: ["smtp", "sendgrid", "custom_http"],
  whatsapp: ["meta_cloud", "twilio", "custom_http"],
  sms: ["twilio", "msg91", "fast2sms", "custom_http"],
};

const providerSettingSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: CHANNELS, required: true },
    label: { type: String, required: true, trim: true },
    provider: { type: String, required: true },
    isActive: { type: Boolean, default: false },
    configEnc: { type: String, default: "" }, // encrypted JSON of credentials
    lastTestedAt: { type: Date, default: null },
    lastTestStatus: { type: String, enum: ["", "success", "failed"], default: "" },
    lastTestMessage: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

providerSettingSchema.index({ owner: 1, channel: 1, isActive: 1 });

export const ProviderSetting = mongoose.model("ProviderSetting", providerSettingSchema);

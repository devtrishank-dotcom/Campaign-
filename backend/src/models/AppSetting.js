import mongoose from "mongoose";

const appSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    sendWindowEnabled: { type: Boolean, default: false },
    sendWindowStart: { type: String, default: "09:00" },
    sendWindowEnd: { type: String, default: "21:00" },
    timezoneOffsetMinutes: { type: Number, default: 330 }, // IST +05:30
    dailyLimit: { type: Number, default: 0 }, // 0 = unlimited
    defaultCountryCode: { type: String, default: "+91" },
    // Branding / company profile
    companyName: { type: String, default: "" },
    companyEmail: { type: String, default: "" },
    companyPhone: { type: String, default: "" },
    companyWebsite: { type: String, default: "" },
    companyAddress: { type: String, default: "" },
    logoUrl: { type: String, default: "" },
    poweredBy: { type: String, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

appSettingSchema.index({ key: 1, owner: 1 }, { unique: true });

export const AppSetting = mongoose.model("AppSetting", appSettingSchema);

const SENDING_KEY = "sending";

export async function getSendingSettings(owner = null) {
  let doc = await AppSetting.findOne({ key: SENDING_KEY, owner });
  if (!doc) doc = await AppSetting.create({ key: SENDING_KEY, owner });
  return doc;
}

// Returns { open: bool, reason }
export function isWithinSendWindow(settings, date = new Date()) {
  if (!settings?.sendWindowEnabled) return { open: true, reason: "" };

  const offset = Number(settings.timezoneOffsetMinutes || 0);
  const local = new Date(date.getTime() + offset * 60 * 1000);
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes();

  const [sh, sm] = String(settings.sendWindowStart || "00:00").split(":").map(Number);
  const [eh, em] = String(settings.sendWindowEnd || "23:59").split(":").map(Number);
  const start = sh * 60 + (sm || 0);
  const end = eh * 60 + (em || 0);

  const open = start <= end ? minutes >= start && minutes <= end : minutes >= start || minutes <= end;
  return {
    open,
    reason: open ? "" : `Outside send window (${settings.sendWindowStart}-${settings.sendWindowEnd})`,
  };
}

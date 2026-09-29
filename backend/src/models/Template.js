import mongoose from "mongoose";

export const CHANNELS = ["email", "whatsapp", "sms"];

const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    channel: { type: String, enum: CHANNELS, required: true },
    subject: { type: String, default: "" }, // email only
    body: { type: String, required: true, default: "" },
    html: { type: String, default: "" }, // optional html for email
    // WhatsApp Cloud API specific
    whatsappTemplateName: { type: String, default: "" },
    whatsappLanguage: { type: String, default: "en" },
    whatsappHeaderParams: { type: [String], default: [] },
    variables: { type: [String], default: [] },
    category: { type: String, default: "general" },
    status: { type: String, enum: ["active", "archived"], default: "active" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

templateSchema.index({ owner: 1, channel: 1, status: 1 });

// Detect {{variable}} placeholders
export function extractVariables(text = "") {
  const set = new Set();
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(text)) !== null) set.add(m[1]);
  return Array.from(set);
}

templateSchema.pre("save", function detectVars(next) {
  const all = `${this.subject || ""} ${this.body || ""}`;
  this.variables = extractVariables(all);
  next();
});

export const Template = mongoose.model("Template", templateSchema);

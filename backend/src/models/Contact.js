import mongoose from "mongoose";

export const CONTACT_STATUS = ["subscribed", "unsubscribed", "bounced"];

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    whatsapp: { type: String, trim: true, default: "" },
    countryCode: { type: String, trim: true, default: "+91" },
    tags: { type: [String], default: [] },
    lists: [{ type: mongoose.Schema.Types.ObjectId, ref: "ContactList" }],
    customFields: { type: Map, of: String, default: {} },
    status: { type: String, enum: CONTACT_STATUS, default: "subscribed" },
    source: { type: String, default: "manual" },
    optedOutAt: { type: Date, default: null },
    lastContactedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

contactSchema.index({ email: 1 });
contactSchema.index({ phone: 1 });
contactSchema.index({ tags: 1 });
contactSchema.index({ lists: 1 });

contactSchema.pre("validate", function normalize(next) {
  if (!this.whatsapp && this.phone) this.whatsapp = this.phone;
  next();
});

export const Contact = mongoose.model("Contact", contactSchema);

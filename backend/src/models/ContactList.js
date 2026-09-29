import mongoose from "mongoose";

const contactListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    contactCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

contactListSchema.index({ owner: 1, name: 1 }, { unique: true });

export const ContactList = mongoose.model("ContactList", contactListSchema);

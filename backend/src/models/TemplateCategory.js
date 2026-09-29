import mongoose from "mongoose";

const templateCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

templateCategorySchema.index({ owner: 1, name: 1 }, { unique: true });

export const TemplateCategory = mongoose.model("TemplateCategory", templateCategorySchema);

export const DEFAULT_CATEGORIES = [
  "General",
  "Marketing",
  "Promotional",
  "Transactional",
  "Utility",
  "Announcement",
  "Reminder",
];

import mongoose from "mongoose";

export const QUESTION_TYPES = ["single", "multiple", "text", "rating", "yesno"];

const questionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    type: { type: String, enum: QUESTION_TYPES, default: "single" },
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
  },
  { _id: true }
);

const surveySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    questions: { type: [questionSchema], default: [] },
    status: { type: String, enum: ["draft", "active", "closed"], default: "draft" },
    thankYouMessage: { type: String, default: "Thank you for your response!" },
    responseCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  },
  { timestamps: true }
);

export const Survey = mongoose.model("Survey", surveySchema);

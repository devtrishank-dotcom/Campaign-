import mongoose from "mongoose";

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    label: { type: String, default: "" },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);

const surveyResponseSchema = new mongoose.Schema(
  {
    survey: { type: mongoose.Schema.Types.ObjectId, ref: "Survey", required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", default: null },
    contact: { type: mongoose.Schema.Types.ObjectId, ref: "Contact", default: null },
    trackingId: { type: String, default: "" },
    answers: { type: [answerSchema], default: [] },
    meta: {
      ip: { type: String, default: "" },
      userAgent: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

surveyResponseSchema.index({ survey: 1, createdAt: -1 });

export const SurveyResponse = mongoose.model("SurveyResponse", surveyResponseSchema);

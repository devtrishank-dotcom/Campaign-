import { Survey, QUESTION_TYPES } from "../models/Survey.js";
import { SurveyResponse } from "../models/SurveyResponse.js";
import { CampaignRecipient } from "../models/CampaignRecipient.js";
import { Contact } from "../models/Contact.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { ownerFilter, withOwner } from "../utils/scope.js";

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

async function uniqueSlug(base) {
  let slug = slugify(base) || `survey-${Date.now()}`;
  let i = 1;
  while (await Survey.exists({ slug })) {
    slug = `${slugify(base)}-${i}`;
    i += 1;
  }
  return slug;
}

export const surveyMeta = asyncHandler(async (req, res) => {
  res.json({ success: true, questionTypes: QUESTION_TYPES });
});

export const listSurveys = asyncHandler(async (req, res) => {
  const data = await Survey.find(ownerFilter(req.user)).sort({ createdAt: -1 });
  res.json({ success: true, data });
});

export const getSurvey = asyncHandler(async (req, res) => {
  const survey = await Survey.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!survey) {
    res.status(404);
    throw new Error("Survey not found");
  }
  res.json({ success: true, data: survey });
});

export const createSurvey = asyncHandler(async (req, res) => {
  const { title, description, questions = [], status = "draft", thankYouMessage } = req.body;
  if (!title) {
    res.status(400);
    throw new Error("title is required");
  }
  const slug = await uniqueSlug(req.body.slug || title);
  const survey = await Survey.create(
    withOwner(req.user, {
      title,
      description,
      slug,
      questions,
      status,
      thankYouMessage,
      createdBy: req.user._id,
    })
  );
  await recordAudit(req, "survey.create", "Survey", survey._id, { title, slug });
  res.status(201).json({ success: true, data: survey });
});

export const updateSurvey = asyncHandler(async (req, res) => {
  const survey = await Survey.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!survey) {
    res.status(404);
    throw new Error("Survey not found");
  }
  const fields = ["title", "description", "questions", "status", "thankYouMessage"];
  for (const f of fields) if (req.body[f] !== undefined) survey[f] = req.body[f];
  if (req.body.slug && req.body.slug !== survey.slug) {
    survey.slug = await uniqueSlug(req.body.slug);
  }
  await survey.save();
  await recordAudit(req, "survey.update", "Survey", survey._id);
  res.json({ success: true, data: survey });
});

export const deleteSurvey = asyncHandler(async (req, res) => {
  const survey = await Survey.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!survey) {
    res.status(404);
    throw new Error("Survey not found");
  }
  await SurveyResponse.deleteMany({ survey: survey._id });
  await survey.deleteOne();
  await recordAudit(req, "survey.delete", "Survey", survey._id);
  res.json({ success: true, message: "Survey deleted" });
});

export const surveyResults = asyncHandler(async (req, res) => {
  const survey = await Survey.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!survey) {
    res.status(404);
    throw new Error("Survey not found");
  }
  const responses = await SurveyResponse.find({ survey: survey._id })
    .populate("contact", "name email phone")
    .sort({ createdAt: -1 });

  const summary = survey.questions.map((q) => {
    const counts = {};
    let answered = 0;
    for (const r of responses) {
      const ans = r.answers.find((a) => String(a.questionId) === String(q._id));
      if (!ans) continue;
      answered += 1;
      const values = Array.isArray(ans.value) ? ans.value : [ans.value];
      for (const v of values) {
        if (v === undefined || v === null || v === "") continue;
        counts[v] = (counts[v] || 0) + 1;
      }
    }
    return { questionId: q._id, label: q.label, type: q.type, answered, counts };
  });

  res.json({
    success: true,
    survey,
    totalResponses: responses.length,
    summary,
    responses,
  });
});

// ---- Public endpoints ----

export const publicGetSurvey = asyncHandler(async (req, res) => {
  const survey = await Survey.findOne({ slug: req.params.slug, status: "active" });
  if (!survey) {
    res.status(404);
    throw new Error("Survey not found or not active");
  }
  res.json({
    success: true,
    data: {
      _id: survey._id,
      title: survey.title,
      description: survey.description,
      slug: survey.slug,
      questions: survey.questions.map((q) => ({
        _id: q._id,
        label: q.label,
        type: q.type,
        options: q.options,
        required: q.required,
      })),
      thankYouMessage: survey.thankYouMessage,
    },
  });
});

export const publicSubmitSurvey = asyncHandler(async (req, res) => {
  const survey = await Survey.findOne({ slug: req.params.slug, status: "active" });
  if (!survey) {
    res.status(404);
    throw new Error("Survey not found or not active");
  }

  const { answers = [], trackingId } = req.body;

  // validate required questions
  for (const q of survey.questions) {
    if (!q.required) continue;
    const ans = answers.find((a) => String(a.questionId) === String(q._id));
    const empty =
      !ans ||
      ans.value === undefined ||
      ans.value === null ||
      ans.value === "" ||
      (Array.isArray(ans.value) && ans.value.length === 0);
    if (empty) {
      res.status(400);
      throw new Error(`"${q.label}" is required`);
    }
  }

  const normalized = answers
    .filter((a) => survey.questions.some((q) => String(q._id) === String(a.questionId)))
    .map((a) => {
      const q = survey.questions.find((x) => String(x._id) === String(a.questionId));
      return { questionId: q._id, label: q.label, value: a.value };
    });

  let contact = null;
  let campaign = null;
  if (trackingId) {
    const recipient = await CampaignRecipient.findOne({ trackingId });
    if (recipient) {
      contact = recipient.contact;
      campaign = recipient.campaign;
      if (recipient.status !== "clicked") {
        recipient.status = "clicked";
        recipient.clickedAt = new Date();
        await recipient.save();
      }
    }
  }

  const response = await SurveyResponse.create({
    survey: survey._id,
    owner: survey.owner || null,
    campaign,
    contact,
    trackingId: trackingId || "",
    answers: normalized,
    meta: {
      ip: req.ip || "",
      userAgent: req.headers["user-agent"] || "",
    },
  });

  survey.responseCount += 1;
  await survey.save();

  res.status(201).json({
    success: true,
    message: survey.thankYouMessage,
    responseId: response._id,
  });
});

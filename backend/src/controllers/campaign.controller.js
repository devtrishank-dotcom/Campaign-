import { Campaign, CAMPAIGN_STATUS } from "../models/Campaign.js";
import { CampaignRecipient } from "../models/CampaignRecipient.js";
import { Contact } from "../models/Contact.js";
import { Template, CHANNELS } from "../models/Template.js";
import { enqueueCampaign } from "../services/queue.js";
import { ensureRecipients } from "../services/audience.js";
import { sendMessage } from "../services/providerService.js";
import { ENV } from "../config/env.js";
import { renderTemplate, buildContactVars } from "../utils/render.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { ownerFilter, withOwner } from "../utils/scope.js";

export const listCampaigns = asyncHandler(async (req, res) => {
  const { status, channel, q, page = 1, limit = 20 } = req.query;
  const filter = { ...ownerFilter(req.user) };
  if (status) filter.status = status;
  if (channel) filter.channel = channel;
  if (q) filter.name = new RegExp(String(q).trim(), "i");

  const pageNum = Math.max(1, Number(page));
  const lim = Math.min(100, Math.max(1, Number(limit)));

  const [data, total] = await Promise.all([
    Campaign.find(filter)
      .populate("template", "name channel")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * lim)
      .limit(lim),
    Campaign.countDocuments(filter),
  ]);

  res.json({ success: true, data, total, page: pageNum, pages: Math.ceil(total / lim) });
});

export const getCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) })
    .populate("template", "name channel")
    .populate("lists", "name contactCount")
    .populate("survey", "title slug status");
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  res.json({ success: true, data: campaign });
});

export const createCampaign = asyncHandler(async (req, res) => {
  const { name, channel, template: templateId, lists = [], survey, scheduledAt } = req.body;
  if (!name || !channel) {
    res.status(400);
    throw new Error("name and channel are required");
  }
  if (!CHANNELS.includes(channel)) {
    res.status(400);
    throw new Error("Invalid channel");
  }

  let subject = req.body.subject || "";
  let body = req.body.body || "";
  let html = req.body.html || "";
  let whatsappTemplateName = "";
  let whatsappLanguage = "en";

  if (templateId) {
    const tpl = await Template.findById(templateId);
    if (!tpl) {
      res.status(404);
      throw new Error("Template not found");
    }
    subject = subject || tpl.subject;
    body = body || tpl.body;
    html = html || tpl.html;
    whatsappTemplateName = tpl.whatsappTemplateName;
    whatsappLanguage = tpl.whatsappLanguage;
  }

  if (!body) {
    res.status(400);
    throw new Error("Campaign body is required (provide body or a template)");
  }

  const needsApproval = !req.user.hasPermission("campaigns.approve");
  const approval = needsApproval
    ? {
        required: true,
        status: "pending",
        requestedBy: req.user._id,
        requestedAt: new Date(),
      }
    : { required: false, status: "not_required" };

  const campaign = await Campaign.create(withOwner(req.user, {
    name,
    channel,
    template: templateId || null,
    subject,
    body,
    html,
    whatsappTemplateName,
    whatsappLanguage,
    lists,
    survey: survey || null,
    scheduledAt: scheduledAt || null,
    status: scheduledAt ? "scheduled" : "draft",
    approval,
    createdBy: req.user._id,
  }));

  await recordAudit(req, "campaign.create", "Campaign", campaign._id, { name, channel });
  res.status(201).json({ success: true, data: campaign });
});

export const updateCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  if (!["draft", "scheduled"].includes(campaign.status)) {
    res.status(400);
    throw new Error("Only draft or scheduled campaigns can be edited");
  }

  const editable = [
    "name",
    "channel",
    "subject",
    "body",
    "html",
    "lists",
    "survey",
    "scheduledAt",
    "whatsappTemplateName",
    "whatsappLanguage",
  ];
  for (const f of editable) if (req.body[f] !== undefined) campaign[f] = req.body[f];

  if (campaign.scheduledAt) {
    campaign.status = "scheduled";
  } else if (campaign.status === "scheduled") {
    campaign.status = "draft";
  }

  await campaign.save();
  await recordAudit(req, "campaign.update", "Campaign", campaign._id);
  res.json({ success: true, data: campaign });
});

export const deleteCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  if (["running", "queued"].includes(campaign.status)) {
    res.status(400);
    throw new Error("Cannot delete a running campaign. Cancel it first.");
  }
  await CampaignRecipient.deleteMany({ campaign: campaign._id });
  await campaign.deleteOne();
  await recordAudit(req, "campaign.delete", "Campaign", campaign._id);
  res.json({ success: true, message: "Campaign deleted" });
});

export const previewAudience = asyncHandler(async (req, res) => {
  const { lists = [], channel } = req.body;
  const query = { status: "subscribed" };
  if (lists.length) query.lists = { $in: lists };
  const contacts = await Contact.find({ ...query, ...ownerFilter(req.user) }).select("email phone whatsapp");
  const seen = new Set();
  let valid = 0;
  for (const c of contacts) {
    const key =
      channel === "email"
        ? (c.email || "").toLowerCase()
        : (c.whatsapp || c.phone || "").replace(/\D/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    valid += 1;
  }
  res.json({ success: true, total: contacts.length, reachable: valid });
});

export const sendCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) }).populate("survey");
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  if (!["draft", "scheduled", "paused", "failed"].includes(campaign.status)) {
    res.status(400);
    throw new Error(`Cannot send a campaign in "${campaign.status}" state`);
  }
  if (campaign.approval?.required && campaign.approval?.status !== "approved") {
    res.status(400);
    throw new Error("This campaign is pending approval and cannot be sent yet");
  }

  // Build audience and recipients (only once)
  const recipientCount = await ensureRecipients(campaign);
  if (recipientCount === 0) {
    res.status(400);
    throw new Error("No reachable contacts found for this campaign");
  }

  campaign.status = "queued";
  await campaign.save();

  enqueueCampaign(campaign._id);
  await recordAudit(req, "campaign.send", "Campaign", campaign._id, { total: campaign.stats.total });

  res.json({ success: true, message: "Campaign queued for sending", data: campaign });
});

export const pauseCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  if (!["running", "queued"].includes(campaign.status)) {
    res.status(400);
    throw new Error("Only running campaigns can be paused");
  }
  campaign.status = "paused";
  await campaign.save();
  await recordAudit(req, "campaign.pause", "Campaign", campaign._id);
  res.json({ success: true, data: campaign });
});

export const resumeCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  if (campaign.status !== "paused") {
    res.status(400);
    throw new Error("Only paused campaigns can be resumed");
  }
  campaign.status = "queued";
  await campaign.save();
  enqueueCampaign(campaign._id);
  await recordAudit(req, "campaign.resume", "Campaign", campaign._id);
  res.json({ success: true, data: campaign });
});

export const cancelCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  if (["completed", "cancelled"].includes(campaign.status)) {
    res.status(400);
    throw new Error("Campaign already finished");
  }
  campaign.status = "cancelled";
  campaign.completedAt = new Date();
  await campaign.save();
  await recordAudit(req, "campaign.cancel", "Campaign", campaign._id);
  res.json({ success: true, data: campaign });
});

export const listRecipients = asyncHandler(async (req, res) => {
  const owned = await Campaign.exists({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!owned) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  const { status, page = 1, limit = 25 } = req.query;
  const filter = { campaign: req.params.id };
  if (status) filter.status = status;

  const pageNum = Math.max(1, Number(page));
  const lim = Math.min(200, Math.max(1, Number(limit)));

  const [data, total] = await Promise.all([
    CampaignRecipient.find(filter)
      .populate("contact", "name email phone")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * lim)
      .limit(lim),
    CampaignRecipient.countDocuments(filter),
  ]);

  res.json({ success: true, data, total, page: pageNum, pages: Math.ceil(total / lim) });
});

export const campaignStats = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  const counts = await CampaignRecipient.aggregate([
    { $match: { campaign: campaign._id } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const byStatus = counts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {});
  res.json({ success: true, stats: campaign.stats, byStatus });
});

export const campaignStatuses = asyncHandler(async (req, res) => {
  res.json({ success: true, data: CAMPAIGN_STATUS });
});

// ---- Test send (does not affect campaign stats) ----
export const testSend = asyncHandler(async (req, res) => {
  const { to } = req.body;
  if (!to) {
    res.status(400);
    throw new Error("'to' is required");
  }
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) }).populate("survey");
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  const sample = await Contact.findOne({ status: "subscribed", ...ownerFilter(req.user) }).select(
    "name email phone whatsapp countryCode customFields"
  );
  const extra = {
    survey_link: campaign.survey?.slug ? `${ENV.PUBLIC_BASE_URL}/s/${campaign.survey.slug}` : "",
    unsubscribe_link: `${ENV.PUBLIC_BASE_URL}/t/unsubscribe/test`,
    open_url: "",
  };
  const vars = buildContactVars(sample || { name: "Test User" }, extra);

  const subject = renderTemplate(campaign.subject || "", vars);
  const html = renderTemplate(campaign.html || "", vars);
  const body = renderTemplate(campaign.body || "", vars);

  try {
    const result = await sendMessage({
      channel: campaign.channel,
      to,
      subject,
      html: html || undefined,
      text: body,
      message: body,
      templateName: campaign.whatsappTemplateName,
      language: campaign.whatsappLanguage,
    });
    await recordAudit(req, "campaign.test_send", "Campaign", campaign._id, { to });
    res.json({ success: true, message: "Test message sent", providerMessageId: result?.providerMessageId || "" });
  } catch (err) {
    res.status(400);
    throw new Error(`Test failed: ${err.message}`);
  }
});

// ---- Approval workflow ----
export const requestApproval = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  campaign.approval = {
    ...campaign.approval,
    required: true,
    status: "pending",
    requestedBy: req.user._id,
    requestedAt: new Date(),
    note: req.body?.note || "",
  };
  await campaign.save();
  await recordAudit(req, "campaign.request_approval", "Campaign", campaign._id);
  res.json({ success: true, data: campaign });
});

export const approveCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  campaign.approval = {
    ...campaign.approval,
    required: true,
    status: "approved",
    approvedBy: req.user._id,
    approvedAt: new Date(),
    note: req.body?.note || "",
  };
  // if it was scheduled for the future, keep it scheduled (scheduler will send when due)
  if (campaign.scheduledAt && campaign.scheduledAt > new Date()) {
    campaign.status = "scheduled";
  }
  await campaign.save();
  await recordAudit(req, "campaign.approve", "Campaign", campaign._id);
  res.json({ success: true, data: campaign });
});

export const rejectCampaign = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  campaign.approval = {
    ...campaign.approval,
    required: true,
    status: "rejected",
    approvedBy: req.user._id,
    approvedAt: new Date(),
    note: req.body?.note || "",
  };
  await campaign.save();
  await recordAudit(req, "campaign.reject", "Campaign", campaign._id, { note: req.body?.note || "" });
  res.json({ success: true, data: campaign });
});

// ---- Retry failed recipients ----
export const retryFailed = asyncHandler(async (req, res) => {
  const campaign = await Campaign.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  const result = await CampaignRecipient.updateMany(
    { campaign: campaign._id, status: "failed" },
    { status: "pending", error: "" }
  );

  if (result.modifiedCount > 0) {
    campaign.stats.failed = Math.max(0, (campaign.stats.failed || 0) - result.modifiedCount);
    campaign.stats.pending = (campaign.stats.pending || 0) + result.modifiedCount;
    campaign.status = "queued";
    campaign.completedAt = null;
    await campaign.save();
    enqueueCampaign(campaign._id);
  }

  await recordAudit(req, "campaign.retry_failed", "Campaign", campaign._id, { count: result.modifiedCount });
  res.json({ success: true, message: `Queued ${result.modifiedCount} failed recipient(s) for retry`, data: campaign });
});

// ---- Export recipients as CSV ----
function csvEscape(value) {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const exportRecipients = asyncHandler(async (req, res) => {
  const owned = await Campaign.exists({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!owned) {
    res.status(404);
    throw new Error("Campaign not found");
  }
  const { status } = req.query;
  const filter = { campaign: req.params.id };
  if (status) filter.status = status;

  const rows = await CampaignRecipient.find(filter).populate("contact", "name email phone").lean();

  const header = ["name", "email", "phone", "channel", "status", "sent_at", "error"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvEscape(r.contact?.name || r.to?.name),
        csvEscape(r.to?.email),
        csvEscape(r.to?.phone),
        csvEscape(r.channel),
        csvEscape(r.status),
        csvEscape(r.sentAt ? new Date(r.sentAt).toISOString() : ""),
        csvEscape(r.error),
      ].join(",")
    );
  }

  const filename = `campaign-${req.params.id}-${status || "all"}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(lines.join("\n"));
});

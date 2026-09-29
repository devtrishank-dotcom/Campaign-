import { Template, extractVariables, CHANNELS } from "../models/Template.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { ownerFilter, withOwner } from "../utils/scope.js";

export const listTemplates = asyncHandler(async (req, res) => {
  const { channel, status, q } = req.query;
  const filter = { ...ownerFilter(req.user) };
  if (channel) filter.channel = channel;
  if (status) filter.status = status;
  if (q) filter.name = new RegExp(String(q).trim(), "i");
  const data = await Template.find(filter).sort({ createdAt: -1 });
  res.json({ success: true, data });
});

export const getTemplate = asyncHandler(async (req, res) => {
  const tpl = await Template.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!tpl) {
    res.status(404);
    throw new Error("Template not found");
  }
  res.json({ success: true, data: tpl });
});

export const createTemplate = asyncHandler(async (req, res) => {
  const { name, channel, subject, body, html, whatsappTemplateName, whatsappLanguage, category } = req.body;
  if (!name || !channel || !body) {
    res.status(400);
    throw new Error("name, channel and body are required");
  }
  if (!CHANNELS.includes(channel)) {
    res.status(400);
    throw new Error("Invalid channel");
  }
  const tpl = await Template.create(
    withOwner(req.user, {
      name,
      channel,
      subject,
      body,
      html,
      whatsappTemplateName,
      whatsappLanguage,
      category,
      createdBy: req.user._id,
    })
  );
  await recordAudit(req, "template.create", "Template", tpl._id, { name, channel });
  res.status(201).json({ success: true, data: tpl });
});

export const updateTemplate = asyncHandler(async (req, res) => {
  const tpl = await Template.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!tpl) {
    res.status(404);
    throw new Error("Template not found");
  }
  const fields = [
    "name",
    "channel",
    "subject",
    "body",
    "html",
    "whatsappTemplateName",
    "whatsappLanguage",
    "whatsappHeaderParams",
    "category",
    "status",
  ];
  for (const f of fields) if (req.body[f] !== undefined) tpl[f] = req.body[f];
  tpl.variables = extractVariables(`${tpl.subject || ""} ${tpl.body || ""}`);
  await tpl.save();
  await recordAudit(req, "template.update", "Template", tpl._id);
  res.json({ success: true, data: tpl });
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  const tpl = await Template.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!tpl) {
    res.status(404);
    throw new Error("Template not found");
  }
  await tpl.deleteOne();
  await recordAudit(req, "template.delete", "Template", tpl._id);
  res.json({ success: true, message: "Template deleted" });
});

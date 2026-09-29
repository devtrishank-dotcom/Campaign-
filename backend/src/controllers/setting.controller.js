import axios from "axios";
import { ProviderSetting, PROVIDERS } from "../models/ProviderSetting.js";
import { AppSetting, getSendingSettings } from "../models/AppSetting.js";
import { encryptObject, decryptObject, maskSecrets } from "../utils/crypto.js";
import { testProvider } from "../services/providerService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { ownerFilter, withOwner, ownerValue } from "../utils/scope.js";

function shape(setting) {
  const obj = setting.toObject();
  return {
    _id: obj._id,
    channel: obj.channel,
    label: obj.label,
    provider: obj.provider,
    isActive: obj.isActive,
    config: maskSecrets(decryptObject(obj.configEnc)),
    lastTestedAt: obj.lastTestedAt,
    lastTestStatus: obj.lastTestStatus,
    lastTestMessage: obj.lastTestMessage,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}

export const providerMeta = asyncHandler(async (req, res) => {
  res.json({ success: true, providers: PROVIDERS });
});

export const listProviders = asyncHandler(async (req, res) => {
  const filter = { ...ownerFilter(req.user) };
  if (req.query.channel) filter.channel = req.query.channel;
  const settings = await ProviderSetting.find(filter).sort({ channel: 1, createdAt: -1 });
  res.json({ success: true, data: settings.map(shape) });
});

export const getProvider = asyncHandler(async (req, res) => {
  const setting = await ProviderSetting.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!setting) {
    res.status(404);
    throw new Error("Provider setting not found");
  }
  res.json({ success: true, data: shape(setting) });
});

export const createProvider = asyncHandler(async (req, res) => {
  const { channel, label, provider, config = {}, isActive = false } = req.body;
  if (!channel || !label || !provider) {
    res.status(400);
    throw new Error("channel, label and provider are required");
  }
  if (!PROVIDERS[channel] || !PROVIDERS[channel].includes(provider)) {
    res.status(400);
    throw new Error(`Invalid provider "${provider}" for channel "${channel}"`);
  }

  if (isActive) {
    await ProviderSetting.updateMany({ channel, ...ownerFilter(req.user) }, { isActive: false });
  }

  const setting = await ProviderSetting.create(
    withOwner(req.user, {
      channel,
      label,
      provider,
      isActive,
      configEnc: encryptObject(config),
      createdBy: req.user._id,
      updatedBy: req.user._id,
    })
  );

  await recordAudit(req, "settings.provider.create", "ProviderSetting", setting._id, { channel, provider });
  res.status(201).json({ success: true, data: shape(setting) });
});

export const updateProvider = asyncHandler(async (req, res) => {
  const setting = await ProviderSetting.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!setting) {
    res.status(404);
    throw new Error("Provider setting not found");
  }

  if (req.body.label !== undefined) setting.label = req.body.label;
  if (req.body.provider !== undefined) {
    if (!PROVIDERS[setting.channel]?.includes(req.body.provider)) {
      res.status(400);
      throw new Error(`Invalid provider for channel "${setting.channel}"`);
    }
    setting.provider = req.body.provider;
  }

  if (req.body.config && typeof req.body.config === "object") {
    const existing = decryptObject(setting.configEnc);
    const merged = { ...existing };
    for (const [k, v] of Object.entries(req.body.config)) {
      // skip untouched masked secrets
      if (typeof v === "string" && v.includes("••")) continue;
      if (v === undefined) continue;
      merged[k] = v;
    }
    setting.configEnc = encryptObject(merged);
  }

  if (req.body.isActive === true) {
    await ProviderSetting.updateMany(
      { channel: setting.channel, _id: { $ne: setting._id }, ...ownerFilter(req.user) },
      { isActive: false }
    );
    setting.isActive = true;
  } else if (req.body.isActive === false) {
    setting.isActive = false;
  }

  setting.updatedBy = req.user._id;
  await setting.save();

  await recordAudit(req, "settings.provider.update", "ProviderSetting", setting._id);
  res.json({ success: true, data: shape(setting) });
});

export const activateProvider = asyncHandler(async (req, res) => {
  const setting = await ProviderSetting.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!setting) {
    res.status(404);
    throw new Error("Provider setting not found");
  }
  await ProviderSetting.updateMany({ channel: setting.channel, ...ownerFilter(req.user) }, { isActive: false });
  setting.isActive = true;
  setting.updatedBy = req.user._id;
  await setting.save();
  await recordAudit(req, "settings.provider.activate", "ProviderSetting", setting._id, { channel: setting.channel });
  res.json({ success: true, data: shape(setting) });
});

export const deleteProvider = asyncHandler(async (req, res) => {
  const setting = await ProviderSetting.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!setting) {
    res.status(404);
    throw new Error("Provider setting not found");
  }
  await setting.deleteOne();
  await recordAudit(req, "settings.provider.delete", "ProviderSetting", setting._id);
  res.json({ success: true, message: "Provider setting deleted" });
});

// ---- Branding / company profile ----
const BRANDING_FIELDS = [
  "companyName",
  "companyEmail",
  "companyPhone",
  "companyWebsite",
  "companyAddress",
  "logoUrl",
  "poweredBy",
];

function brandingOf(doc) {
  const out = {};
  for (const f of BRANDING_FIELDS) out[f] = doc[f] || "";
  return out;
}

export const getBranding = asyncHandler(async (req, res) => {
  const doc = await getSendingSettings(ownerValue(req.user));
  res.json({ success: true, data: brandingOf(doc) });
});

export const updateBranding = asyncHandler(async (req, res) => {
  const doc = await getSendingSettings(ownerValue(req.user));
  for (const f of BRANDING_FIELDS) if (req.body[f] !== undefined) doc[f] = req.body[f];
  doc.updatedBy = req.user._id;
  await doc.save();
  await recordAudit(req, "settings.branding.update", "AppSetting", doc._id);
  res.json({ success: true, data: brandingOf(doc) });
});

export const uploadBrandingLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Logo image is required (field name: logo)");
  }
  const doc = await getSendingSettings(ownerValue(req.user));
  doc.logoUrl = `/uploads/${req.file.filename}`;
  doc.updatedBy = req.user._id;
  await doc.save();
  await recordAudit(req, "settings.branding.logo", "AppSetting", doc._id);
  res.json({ success: true, data: brandingOf(doc) });
});

// ---- Sending rules (window / daily limit) ----
export const getSendingRules = asyncHandler(async (req, res) => {
  const doc = await getSendingSettings(ownerValue(req.user));
  res.json({ success: true, data: doc });
});

export const updateSendingRules = asyncHandler(async (req, res) => {
  const doc = await getSendingSettings(ownerValue(req.user));
  const fields = [
    "sendWindowEnabled",
    "sendWindowStart",
    "sendWindowEnd",
    "timezoneOffsetMinutes",
    "dailyLimit",
    "defaultCountryCode",
  ];
  for (const f of fields) if (req.body[f] !== undefined) doc[f] = req.body[f];
  doc.updatedBy = req.user._id;
  await doc.save();
  await recordAudit(req, "settings.sending_rules.update", "AppSetting", doc._id);
  res.json({ success: true, data: doc });
});

// ---- Fetch approved WhatsApp templates from Meta Cloud API ----
export const fetchWhatsappTemplates = asyncHandler(async (req, res) => {
  const setting = await ProviderSetting.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!setting) {
    res.status(404);
    throw new Error("Provider setting not found");
  }
  if (setting.channel !== "whatsapp" || setting.provider !== "meta_cloud") {
    res.status(400);
    throw new Error("Template fetch is only supported for Meta WhatsApp Cloud API providers");
  }
  const config = decryptObject(setting.configEnc);
  const { wabaId, accessToken, apiVersion = "v21.0" } = config;
  if (!wabaId || !accessToken) {
    res.status(400);
    throw new Error("'wabaId' and 'accessToken' are required in the provider config");
  }

  const url = `https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`;
  const response = await axios.get(url, {
    params: { access_token: accessToken, limit: 200, fields: "name,status,language,category,components" },
    timeout: 30000,
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    res.status(400);
    throw new Error(`Meta API error ${response.status}: ${JSON.stringify(response.data).slice(0, 300)}`);
  }

  const templates = (response.data?.data || []).map((t) => ({
    name: t.name,
    status: t.status,
    language: t.language,
    category: t.category,
  }));
  res.json({ success: true, data: templates });
});

export const testProviderConfig = asyncHandler(async (req, res) => {
  const setting = await ProviderSetting.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!setting) {
    res.status(404);
    throw new Error("Provider setting not found");
  }
  const { to } = req.body;
  if (!to) {
    res.status(400);
    throw new Error("'to' (email/phone) is required for the test");
  }

  try {
    const result = await testProvider(setting, to);
    setting.lastTestedAt = new Date();
    setting.lastTestStatus = "success";
    setting.lastTestMessage = result?.providerMessageId || "Sent";
    await setting.save();
    res.json({ success: true, message: "Test message sent", providerMessageId: result?.providerMessageId || "" });
  } catch (err) {
    setting.lastTestedAt = new Date();
    setting.lastTestStatus = "failed";
    setting.lastTestMessage = err.message;
    await setting.save();
    res.status(400);
    throw new Error(`Test failed: ${err.message}`);
  }
});

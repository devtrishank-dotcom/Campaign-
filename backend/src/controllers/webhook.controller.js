import { ProviderSetting } from "../models/ProviderSetting.js";
import { decryptObject } from "../utils/crypto.js";
import { applyDeliveryStatus } from "../services/deliveryStatus.js";
import { logger } from "../utils/logger.js";

async function getMetaVerifyToken() {
  const settings = await ProviderSetting.find({ channel: "whatsapp", provider: "meta_cloud" });
  for (const s of settings) {
    const cfg = decryptObject(s.configEnc);
    if (cfg.verifyToken) return cfg.verifyToken;
  }
  return "";
}

// Meta Cloud API webhook verification
export async function metaVerify(req, res) {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  const expected = await getMetaVerifyToken();

  if (mode === "subscribe" && (!expected || token === expected)) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

// Meta Cloud API status callbacks
export async function metaWebhook(req, res) {
  // Always ack quickly so Meta doesn't retry
  res.sendStatus(200);
  try {
    const entries = req.body?.entry || [];
    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const st of value.statuses || []) {
          await applyDeliveryStatus({
            providerMessageId: st.id,
            status: st.status,
            error: st.errors?.[0]?.title || st.errors?.[0]?.message || "",
          });
        }
      }
    }
  } catch (err) {
    logger.warn(`Meta webhook error: ${err.message}`);
  }
}

// Twilio status callbacks (form-encoded)
export async function twilioWebhook(req, res) {
  res.sendStatus(200);
  try {
    const { MessageSid, MessageStatus, ErrorMessage } = req.body || {};
    if (MessageSid && MessageStatus) {
      await applyDeliveryStatus({
        providerMessageId: MessageSid,
        status: MessageStatus,
        error: ErrorMessage || "",
      });
    }
  } catch (err) {
    logger.warn(`Twilio webhook error: ${err.message}`);
  }
}

// Generic webhook for custom HTTP providers: { providerMessageId|trackingId, status, error, token }
export async function customWebhook(req, res) {
  try {
    const { providerMessageId, trackingId, status, error, token } = req.body || {};
    if (!providerMessageId && !trackingId) {
      return res.status(400).json({ success: false, message: "providerMessageId or trackingId is required" });
    }
    if (token) {
      const settings = await ProviderSetting.find({ provider: "custom_http" });
      const valid = settings.some((s) => decryptObject(s.configEnc).webhookToken === token);
      if (!valid) return res.status(403).json({ success: false, message: "Invalid token" });
    }
    const result = await applyDeliveryStatus({ providerMessageId, trackingId, status, error });
    return res.json({ success: true, ...result });
  } catch (err) {
    logger.warn(`Custom webhook error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
}

import axios from "axios";
import { sendViaCustomHttp } from "./customHttp.js";

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

async function sendMetaCloud(config, payload) {
  const { phoneNumberId, accessToken, apiVersion = "v21.0" } = config;
  if (!phoneNumberId || !accessToken) {
    throw new Error("Meta Cloud API: 'phoneNumberId' and 'accessToken' are required");
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  const to = normalizePhone(payload.to);

  let body;
  if (payload.templateName) {
    const params = (payload.params || []).map((p) => ({ type: "text", text: String(p) }));
    body = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: payload.templateName,
        language: { code: payload.language || "en" },
        components: params.length ? [{ type: "body", parameters: params }] : undefined,
      },
    };
  } else {
    body = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { preview_url: true, body: payload.message || "" },
    };
  }

  const res = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    timeout: 30000,
    validateStatus: () => true,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Meta WhatsApp error ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
  }
  const id = res.data?.messages?.[0]?.id || "";
  return { providerMessageId: id };
}

async function sendTwilio(config, payload) {
  const { accountSid, authToken, from } = config;
  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio WhatsApp: 'accountSid', 'authToken' and 'from' are required");
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const fromNum = String(from).startsWith("whatsapp:") ? from : `whatsapp:${from}`;
  const toNum = String(payload.to).startsWith("whatsapp:") ? payload.to : `whatsapp:${normalizePhone(payload.to)}`;

  const form = new URLSearchParams();
  form.append("From", fromNum);
  form.append("To", toNum);
  form.append("Body", payload.message || "");

  const res = await axios.post(url, form.toString(), {
    auth: { username: accountSid, password: authToken },
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 30000,
    validateStatus: () => true,
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Twilio WhatsApp error ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
  }
  return { providerMessageId: res.data?.sid || "" };
}

export async function sendWhatsApp({ provider, config = {}, to, message, templateName, language, params }) {
  switch (provider) {
    case "meta_cloud":
      return sendMetaCloud(config, { to, message, templateName, language, params });
    case "twilio":
      return sendTwilio(config, { to, message });
    case "custom_http":
      return sendViaCustomHttp(config, { to, message });
    default:
      throw new Error(`Unsupported WhatsApp provider: ${provider}`);
  }
}

import axios from "axios";
import { sendViaCustomHttp } from "./customHttp.js";

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

async function sendTwilio(config, payload) {
  const { accountSid, authToken, from } = config;
  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio SMS: 'accountSid', 'authToken' and 'from' are required");
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const form = new URLSearchParams();
  form.append("From", from);
  form.append("To", normalizePhone(payload.to));
  form.append("Body", payload.message || "");

  const res = await axios.post(url, form.toString(), {
    auth: { username: accountSid, password: authToken },
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    timeout: 30000,
    validateStatus: () => true,
  });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Twilio SMS error ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
  }
  return { providerMessageId: res.data?.sid || "" };
}

async function sendMsg91(config, payload) {
  const { authKey, senderId, route = "4", country = "91" } = config;
  if (!authKey) throw new Error("MSG91: 'authKey' is required");
  const mobile = normalizePhone(payload.to);

  const res = await axios.post(
    "https://api.msg91.com/api/v2/sendsms",
    {
      sender: senderId || "",
      route,
      country,
      sms: [{ message: payload.message || "", to: [mobile] }],
    },
    {
      headers: { authkey: authKey, "Content-Type": "application/json" },
      timeout: 30000,
      validateStatus: () => true,
    }
  );
  if (res.status < 200 || res.status >= 300 || (res.data && res.data.type === "error")) {
    throw new Error(`MSG91 error: ${JSON.stringify(res.data).slice(0, 300)}`);
  }
  return { providerMessageId: res.data?.message || "" };
}

async function sendFast2Sms(config, payload) {
  const { apiKey, senderId, route = "q", language = "english" } = config;
  if (!apiKey) throw new Error("Fast2SMS: 'apiKey' is required");
  const numbers = normalizePhone(payload.to);

  const res = await axios.post(
    "https://www.fast2sms.com/dev/bulkV2",
    {
      route,
      sender_id: senderId || undefined,
      message: payload.message || "",
      language,
      numbers,
    },
    {
      headers: { authorization: apiKey, "Content-Type": "application/json" },
      timeout: 30000,
      validateStatus: () => true,
    }
  );
  if (res.status < 200 || res.status >= 300 || res.data?.return === false) {
    throw new Error(`Fast2SMS error: ${JSON.stringify(res.data).slice(0, 300)}`);
  }
  return { providerMessageId: res.data?.request_id || "" };
}

export async function sendSms({ provider, config = {}, to, message }) {
  switch (provider) {
    case "twilio":
      return sendTwilio(config, { to, message });
    case "msg91":
      return sendMsg91(config, { to, message });
    case "fast2sms":
      return sendFast2Sms(config, { to, message });
    case "custom_http":
      return sendViaCustomHttp(config, { to, message });
    default:
      throw new Error(`Unsupported SMS provider: ${provider}`);
  }
}

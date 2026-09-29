import { ProviderSetting } from "../models/ProviderSetting.js";
import { decryptObject } from "../utils/crypto.js";
import { sendEmail } from "./providers/email.js";
import { sendWhatsApp } from "./providers/whatsapp.js";
import { sendSms } from "./providers/sms.js";

export async function getActiveProvider(channel, owner = null) {
  return ProviderSetting.findOne({ channel, isActive: true, owner: owner || null });
}

export async function sendMessage({ channel, to, subject, html, text, message, templateName, language, params, headers, owner = null }) {
  const setting = await getActiveProvider(channel, owner);
  if (!setting) {
    throw new Error(`No active ${channel} provider configured. Please configure it in Settings.`);
  }
  const config = decryptObject(setting.configEnc);

  if (channel === "email") {
    return sendEmail({ provider: setting.provider, config, to, subject, html, text, headers });
  }
  if (channel === "whatsapp") {
    return sendWhatsApp({ provider: setting.provider, config, to, message, templateName, language, params });
  }
  if (channel === "sms") {
    return sendSms({ provider: setting.provider, config, to, message });
  }
  throw new Error(`Unsupported channel: ${channel}`);
}

export async function testProvider(setting, to) {
  const config = decryptObject(setting.configEnc);
  if (setting.channel === "email") {
    return sendEmail({
      provider: setting.provider,
      config,
      to,
      subject: "Test email from campaign panel",
      text: "This is a test email. Your email provider is configured correctly.",
    });
  }
  if (setting.channel === "whatsapp") {
    return sendWhatsApp({
      provider: setting.provider,
      config,
      to,
      message: "Test WhatsApp message from campaign panel.",
    });
  }
  if (setting.channel === "sms") {
    return sendSms({
      provider: setting.provider,
      config,
      to,
      message: "Test SMS from campaign panel.",
    });
  }
  throw new Error("Unsupported channel");
}

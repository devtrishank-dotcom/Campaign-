import nodemailer from "nodemailer";
import axios from "axios";
import { sendViaCustomHttp } from "./customHttp.js";

async function sendSmtp(config, payload) {
  const { host, port, secure, user, pass, fromName, fromEmail } = config;
  if (!host) throw new Error("SMTP: 'host' is required");

  const transporter = nodemailer.createTransport({
    host,
    port: Number(port || 587),
    secure: String(secure) === "true" || secure === true,
    auth: user ? { user, pass } : undefined,
  });

  const from = fromEmail ? `"${fromName || ""}" <${fromEmail}>` : user;
  const info = await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject || "(no subject)",
    text: payload.text || "",
    html: payload.html || undefined,
    headers: payload.headers || undefined,
  });
  return { providerMessageId: info.messageId || "" };
}

async function sendSendgrid(config, payload) {
  const { apiKey, fromEmail, fromName } = config;
  if (!apiKey) throw new Error("SendGrid: 'apiKey' is required");
  if (!fromEmail) throw new Error("SendGrid: 'fromEmail' is required");

  const res = await axios.post(
    "https://api.sendgrid.com/v3/mail/send",
    {
      personalizations: [{ to: [{ email: payload.to }] }],
      from: { email: fromEmail, name: fromName || "" },
      headers: payload.headers || undefined,
      subject: payload.subject || "(no subject)",
      content: [
        { type: "text/plain", value: payload.text || "" },
        ...(payload.html ? [{ type: "text/html", value: payload.html }] : []),
      ],
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      timeout: 30000,
      validateStatus: () => true,
    }
  );

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`SendGrid error ${res.status}: ${JSON.stringify(res.data).slice(0, 300)}`);
  }
  return { providerMessageId: res.headers["x-message-id"] || "" };
}

export async function sendEmail({ provider, config = {}, to, subject, html, text, headers }) {
  const payload = { to, subject, html, text: text || (html ? undefined : subject), headers };
  switch (provider) {
    case "smtp":
      return sendSmtp(config, payload);
    case "sendgrid":
      return sendSendgrid(config, payload);
    case "custom_http":
      return sendViaCustomHttp(config, { to, subject, message: text || subject });
    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }
}

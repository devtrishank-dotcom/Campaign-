import axios from "axios";
import { renderTemplate } from "../../utils/render.js";

// Generic HTTP provider so any third-party API can be configured from the admin panel.
// config = {
//   url, method (GET|POST|PUT), headers (object or JSON string),
//   bodyTemplate (JSON string or raw string) with {{to}} {{message}} {{subject}} {{name}} placeholders,
//   successPath (dot path into response, optional), successValue (optional)
// }
export async function sendViaCustomHttp(config = {}, payload = {}) {
  const { url, method = "POST", headers = {}, bodyTemplate = "", successPath, successValue } = config;
  if (!url) throw new Error("Custom HTTP provider: 'url' is required in settings");

  let parsedHeaders = headers;
  if (typeof headers === "string") {
    try {
      parsedHeaders = headers.trim() ? JSON.parse(headers) : {};
    } catch {
      throw new Error("Custom HTTP provider: headers must be valid JSON");
    }
  }

  const vars = {
    to: payload.to || "",
    message: payload.message || "",
    subject: payload.subject || "",
    name: payload.name || "",
  };

  const isJsonBody = typeof bodyTemplate === "string" && bodyTemplate.trim().startsWith("{");
  let data;
  let renderedBody;
  if (bodyTemplate) {
    renderedBody = renderTemplate(bodyTemplate, vars);
    if (isJsonBody) {
      try {
        data = JSON.parse(renderedBody);
      } catch {
        throw new Error("Custom HTTP provider: bodyTemplate is not valid JSON after rendering");
      }
    } else {
      data = renderedBody;
    }
  } else {
    data = vars;
  }

  const response = await axios({
    url,
    method: String(method).toUpperCase(),
    headers: { "Content-Type": "application/json", ...parsedHeaders },
    data,
    timeout: 30000,
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Custom HTTP provider responded ${response.status}: ${JSON.stringify(response.data).slice(0, 300)}`);
  }

  if (successPath) {
    const actual = String(successPath)
      .split(".")
      .reduce((acc, part) => (acc == null ? acc : acc[part]), response.data);
    if (successValue !== undefined && String(actual) !== String(successValue)) {
      throw new Error(`Custom HTTP provider: success check failed (got "${actual}", expected "${successValue}")`);
    }
  }

  const id =
    (response.data && (response.data.id || response.data.messageId || response.data.request_id)) || "";
  return { providerMessageId: String(id || ""), raw: response.data };
}

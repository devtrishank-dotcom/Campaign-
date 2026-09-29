// Render {{variable}} placeholders using contact + system values
export function renderTemplate(text = "", vars = {}) {
  if (!text) return "";
  return String(text).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const value = key.split(".").reduce((acc, part) => (acc == null ? acc : acc[part]), vars);
    return value === undefined || value === null ? "" : String(value);
  });
}

export function buildContactVars(contact = {}, extra = {}) {
  const custom = {};
  if (contact.customFields) {
    const entries =
      typeof contact.customFields.entries === "function"
        ? contact.customFields.entries()
        : Object.entries(contact.customFields);
    for (const [k, v] of entries) custom[k] = v;
  }
  return {
    name: contact.name || "",
    email: contact.email || "",
    phone: contact.phone || "",
    whatsapp: contact.whatsapp || contact.phone || "",
    countryCode: contact.countryCode || "",
    ...custom,
    ...extra,
  };
}

export function appendTrackingPixel(html = "", trackingId = "") {
  if (!trackingId) return html;
  const pixel = `<img src="{{OPEN_URL}}" width="1" height="1" alt="" style="display:none" />`;
  return html.includes("</body>") ? html.replace("</body>", `${pixel}</body>`) : `${html}${pixel}`;
}

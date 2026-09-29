import { useEffect, useState } from "react";
import api, { assetUrl } from "../lib/api";
import { useToast } from "../lib/toast";
import { Modal, Spinner, Empty } from "../components/ui";
import Icon from "../components/Icon";
import { useAuth } from "../lib/auth";
import {
  THEMES,
  COUNTRY_CODES,
  TIMEZONES,
  TIME_OPTIONS,
  META_API_VERSIONS,
  MSG91_ROUTES,
  FAST2SMS_ROUTES,
  FAST2SMS_LANGUAGES,
} from "../lib/constants";

const CHANNELS = [
  { v: "email", l: "Email", icon: "mail" },
  { v: "whatsapp", l: "WhatsApp", icon: "message" },
  { v: "sms", l: "SMS", icon: "message" },
];

const CUSTOM_HTTP_FIELDS = [
  { k: "url", l: "API URL", ph: "https://api.example.com/send" },
  { k: "method", l: "HTTP Method", type: "select", options: ["POST", "GET", "PUT"] },
  { k: "headers", l: "Headers (JSON)", type: "textarea", ph: '{"Authorization":"Bearer xxx"}' },
  {
    k: "bodyTemplate",
    l: "Body template (JSON or text)",
    type: "textarea",
    ph: '{"to":"{{to}}","message":"{{message}}"}',
  },
  { k: "successPath", l: "Success field path (optional)", ph: "status" },
  { k: "successValue", l: "Success expected value (optional)", ph: "true" },
  { k: "webhookToken", l: "Webhook token (optional, for delivery callbacks)", ph: "shared secret" },
];

const SCHEMAS = {
  email: {
    smtp: [
      { k: "host", l: "SMTP Host", ph: "smtp.gmail.com" },
      { k: "port", l: "Port", ph: "587" },
      { k: "secure", l: "Use SSL/TLS (port 465)", type: "checkbox" },
      { k: "user", l: "Username / Email" },
      { k: "pass", l: "Password / App password", type: "password" },
      { k: "fromName", l: "From name" },
      { k: "fromEmail", l: "From email" },
    ],
    sendgrid: [
      { k: "apiKey", l: "SendGrid API Key", type: "password" },
      { k: "fromEmail", l: "From email" },
      { k: "fromName", l: "From name" },
    ],
    custom_http: CUSTOM_HTTP_FIELDS,
  },
  whatsapp: {
    meta_cloud: [
      { k: "phoneNumberId", l: "Phone Number ID" },
      { k: "accessToken", l: "Access Token", type: "password" },
      { k: "apiVersion", l: "API Version", type: "select", options: META_API_VERSIONS },
      { k: "wabaId", l: "WhatsApp Business Account ID (for template list)", ph: "optional" },
      { k: "verifyToken", l: "Webhook Verify Token", ph: "set the same token in Meta dashboard" },
    ],
    twilio: [
      { k: "accountSid", l: "Account SID" },
      { k: "authToken", l: "Auth Token", type: "password" },
      { k: "from", l: "From (whatsapp:+14155238886)" },
    ],
    custom_http: CUSTOM_HTTP_FIELDS,
  },
  sms: {
    twilio: [
      { k: "accountSid", l: "Account SID" },
      { k: "authToken", l: "Auth Token", type: "password" },
      { k: "from", l: "From number" },
    ],
    msg91: [
      { k: "authKey", l: "Auth Key", type: "password" },
      { k: "senderId", l: "Sender ID" },
      { k: "route", l: "Route", type: "select", options: MSG91_ROUTES },
      {
        k: "country",
        l: "Country code",
        type: "select",
        options: COUNTRY_CODES.map((c) => ({ value: c.code.replace("+", ""), label: c.label })),
      },
    ],
    fast2sms: [
      { k: "apiKey", l: "API Key", type: "password" },
      { k: "senderId", l: "Sender ID" },
      { k: "route", l: "Route", type: "select", options: FAST2SMS_ROUTES },
      { k: "language", l: "Language", type: "select", options: FAST2SMS_LANGUAGES },
    ],
    custom_http: CUSTOM_HTTP_FIELDS,
  },
};

const PROVIDER_LABELS = {
  smtp: "SMTP",
  sendgrid: "SendGrid",
  custom_http: "Custom HTTP API",
  meta_cloud: "Meta WhatsApp Cloud API",
  twilio: "Twilio",
  msg91: "MSG91",
  fast2sms: "Fast2SMS",
};

export default function Settings() {
  const toast = useToast();
  const { theme, setTheme } = useAuth();
  const [channel, setChannel] = useState("email");
  const [meta, setMeta] = useState({ email: [], whatsapp: [], sms: [] });
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ label: "", provider: "", config: {} });
  const [busy, setBusy] = useState(false);
  const [testFor, setTestFor] = useState(null);
  const [testTo, setTestTo] = useState("");
  const [rules, setRules] = useState(null);
  const [rulesBusy, setRulesBusy] = useState(false);
  const [branding, setBranding] = useState(null);
  const [brandBusy, setBrandBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const [waTemplates, setWaTemplates] = useState(null);
  const [waBusy, setWaBusy] = useState(false);

  useEffect(() => {
    api
      .get("/settings/sending-rules")
      .then((r) => setRules(r.data.data))
      .catch(() => {});
    api
      .get("/branding")
      .then((r) => setBranding(r.data.data))
      .catch(() => {});
  }, []);

  const saveBranding = async () => {
    setBrandBusy(true);
    try {
      const { data } = await api.put("/settings/branding", branding);
      setBranding(data.data);
      toast.success("Company details saved");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBrandBusy(false);
    }
  };

  const uploadLogo = async (file) => {
    if (!file) return;
    setLogoBusy(true);
    try {
      const fd = new FormData();
      fd.append("logo", file);
      const { data } = await api.post("/settings/branding/logo", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBranding(data.data);
      toast.success("Logo uploaded");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLogoBusy(false);
    }
  };

  const saveRules = async () => {
    setRulesBusy(true);
    try {
      const { data } = await api.put("/settings/sending-rules", rules);
      setRules(data.data);
      toast.success("Sending rules saved");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRulesBusy(false);
    }
  };

  const loadWaTemplates = async (p) => {
    setWaBusy(true);
    setWaTemplates({ provider: p.label, list: [] });
    try {
      const { data } = await api.get(`/settings/providers/${p._id}/whatsapp-templates`);
      setWaTemplates({ provider: p.label, list: data.data });
    } catch (e) {
      toast.error(e.message);
      setWaTemplates(null);
    } finally {
      setWaBusy(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [m, l] = await Promise.all([api.get("/settings/meta"), api.get("/settings/providers", { params: { channel } })]);
      setMeta(m.data.providers);
      setRows(l.data.data);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel]);

  const openCreate = () => {
    const provider = meta[channel]?.[0] || "";
    setEditing(null);
    setForm({ label: "", provider, config: {} });
    setModal(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ label: p.label, provider: p.provider, config: { ...p.config } });
    setModal(true);
  };

  const setConfig = (k, v) => setForm((f) => ({ ...f, config: { ...f.config, [k]: v } }));

  const save = async () => {
    if (!form.label) return toast.error("Label is required");
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/settings/providers/${editing._id}`, form);
        toast.success("Provider updated");
      } else {
        await api.post("/settings/providers", { ...form, channel });
        toast.success("Provider created");
      }
      setModal(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const activate = async (p) => {
    try {
      await api.post(`/settings/providers/${p._id}/activate`);
      toast.success(`${p.label} activated for ${channel}`);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete provider "${p.label}"?`)) return;
    try {
      await api.delete(`/settings/providers/${p._id}`);
      toast.success("Deleted");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const runTest = async () => {
    if (!testTo) return toast.error("Enter a destination");
    setBusy(true);
    try {
      await api.post(`/settings/providers/${testFor._id}/test`, { to: testTo });
      toast.success("Test message sent successfully");
      setTestFor(null);
      setTestTo("");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const schema = SCHEMAS[channel]?.[form.provider] || [];

  return (
    <div>
      <div className="alert info">
        Provider credentials are stored encrypted in the database. Nothing is hardcoded — configure any provider here and
        switch between them anytime. Only the <b>active</b> provider per channel is used for sending.
      </div>

      {branding && (
        <div className="card pad" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="landmark" size={16} /> Company / Branding
          </h3>
          <div className="row" style={{ alignItems: "center", marginBottom: 12 }}>
            <div style={{ flex: "0 0 auto", minWidth: 0 }}>
              {branding.logoUrl ? (
                <img
                  src={assetUrl(branding.logoUrl)}
                  alt="logo"
                  style={{
                    height: 56,
                    maxWidth: 180,
                    objectFit: "contain",
                    background: "#fff",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    padding: 4,
                  }}
                />
              ) : (
                <div
                  style={{
                    height: 56,
                    width: 120,
                    display: "grid",
                    placeItems: "center",
                    border: "1px dashed var(--line)",
                    borderRadius: 10,
                    color: "var(--soft)",
                    fontSize: 11,
                  }}
                >
                  No logo
                </div>
              )}
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Upload logo (png, jpg, svg - max 3MB)</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => uploadLogo(e.target.files[0])}
                disabled={logoBusy}
              />
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Company name</label>
              <input
                value={branding.companyName || ""}
                onChange={(e) => setBranding({ ...branding, companyName: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Company email</label>
              <input
                value={branding.companyEmail || ""}
                onChange={(e) => setBranding({ ...branding, companyEmail: e.target.value })}
                placeholder="support@company.com"
              />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>Company phone</label>
              <input
                value={branding.companyPhone || ""}
                onChange={(e) => setBranding({ ...branding, companyPhone: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Website</label>
              <input
                value={branding.companyWebsite || ""}
                onChange={(e) => setBranding({ ...branding, companyWebsite: e.target.value })}
                placeholder="https://"
              />
            </div>
          </div>
          <div className="field">
            <label>Address</label>
            <textarea
              rows={2}
              value={branding.companyAddress || ""}
              onChange={(e) => setBranding({ ...branding, companyAddress: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Powered by (footer text)</label>
            <input
              value={branding.poweredBy || ""}
              onChange={(e) => setBranding({ ...branding, poweredBy: e.target.value })}
              placeholder="Your company / platform name"
            />
          </div>
          <div className="hint" style={{ marginBottom: 10 }}>
            The company email receives support tickets raised by users. The logo and name appear in the sidebar.
          </div>
          <button className="btn" onClick={saveBranding} disabled={brandBusy}>
            {brandBusy ? "Saving..." : "Save company details"}
          </button>
        </div>
      )}

      <div className="card pad" style={{ marginBottom: 20 }}>
        <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="settings" size={16} /> Appearance
        </h3>
        <div className="hint" style={{ marginBottom: 12 }}>
          Pick a colour theme for this account. Sub-users inherit the admin's theme unless set otherwise.
        </div>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <div
              key={t.key}
              className={`theme-swatch ${theme === t.key ? "active" : ""}`}
              onClick={async () => {
                try {
                  await setTheme(t.key);
                  toast.success(`Theme: ${t.name}`);
                } catch (e) {
                  toast.error(e.message);
                }
              }}
            >
              <div className="theme-dots">
                {t.swatch.map((c) => (
                  <span key={c} style={{ background: c }} />
                ))}
              </div>
              <div className="tname">{t.name}</div>
            </div>
          ))}
        </div>
      </div>

      {rules && (
        <div className="card pad" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="clock" size={16} /> Sending &amp; Contact Rules
          </h3>
          <div className="row">
            <div className="field">
              <label className="check">
                <input
                  type="checkbox"
                  checked={rules.sendWindowEnabled}
                  onChange={(e) => setRules({ ...rules, sendWindowEnabled: e.target.checked })}
                />
                Restrict sending to a time window
              </label>
            </div>
            <div className="field">
              <label>Window start</label>
              <select
                value={rules.sendWindowStart}
                onChange={(e) => setRules({ ...rules, sendWindowStart: e.target.value })}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Window end</label>
              <select
                value={rules.sendWindowEnd}
                onChange={(e) => setRules({ ...rules, sendWindowEnd: e.target.value })}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Daily limit (0 = unlimited)</label>
              <input
                type="number"
                value={rules.dailyLimit}
                onChange={(e) => setRules({ ...rules, dailyLimit: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Timezone</label>
              <select
                value={rules.timezoneOffsetMinutes}
                onChange={(e) => setRules({ ...rules, timezoneOffsetMinutes: Number(e.target.value) })}
              >
                {TIMEZONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Default country code</label>
              <select
                value={rules.defaultCountryCode || "+91"}
                onChange={(e) => setRules({ ...rules, defaultCountryCode: e.target.value })}
              >
                {!COUNTRY_CODES.some((c) => c.code === rules.defaultCountryCode) && rules.defaultCountryCode && (
                  <option value={rules.defaultCountryCode}>{rules.defaultCountryCode}</option>
                )}
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="hint">Applied to contacts when no country code is given</div>
            </div>
          </div>
          <button className="btn" onClick={saveRules} disabled={rulesBusy}>
            {rulesBusy ? "Saving..." : "Save sending rules"}
          </button>
        </div>
      )}

      <div className="chips" style={{ marginBottom: 16 }}>
        {CHANNELS.map((c) => (
          <span key={c.v} className={`chip ${channel === c.v ? "on" : ""}`} onClick={() => setChannel(c.v)}>
            <Icon name={c.icon} size={13} /> {c.l}
          </span>
        ))}
        <div className="spacer" />
        <button className="btn" onClick={openCreate}>
          <Icon name="plus" size={15} /> Add Provider
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty icon="settings" title={`No ${channel} provider configured`}>
            Add a provider to enable sending.
          </Empty>
        </div>
      ) : (
        <div className="grid cols-2">
          {rows.map((p) => (
            <div className="card pad" key={p._id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.label}</div>
                  <div className="muted small">{PROVIDER_LABELS[p.provider] || p.provider}</div>
                </div>
                {p.isActive ? <span className="badge green">Active</span> : <span className="badge">Inactive</span>}
              </div>

              {p.lastTestedAt && (
                <div className="small" style={{ marginTop: 10 }}>
                  Last test:{" "}
                  <span style={{ color: p.lastTestStatus === "success" ? "var(--green)" : "var(--red)" }}>
                    {p.lastTestStatus}
                  </span>{" "}
                  <span className="muted">· {new Date(p.lastTestedAt).toLocaleString()}</span>
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                {!p.isActive && (
                  <button className="btn sm" onClick={() => activate(p)}>
                    Set active
                  </button>
                )}
                <button className="btn secondary sm" onClick={() => setTestFor(p)}>
                  Test
                </button>
                <button className="btn secondary sm" onClick={() => openEdit(p)}>
                  Edit
                </button>
                {p.provider === "meta_cloud" && (
                  <button className="btn secondary sm" onClick={() => loadWaTemplates(p)}>
                    <Icon name="clipboard" size={13} /> Templates
                  </button>
                )}
                <button className="btn ghost sm" style={{ color: "var(--red)" }} onClick={() => remove(p)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          title={editing ? "Edit Provider" : `Add ${channel} Provider`}
          onClose={() => setModal(false)}
          wide
          footer={
            <>
              <button className="btn secondary" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn" onClick={save} disabled={busy}>
                {busy ? "Saving..." : "Save"}
              </button>
            </>
          }
        >
          <div className="row">
            <div className="field">
              <label>Label</label>
              <input
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="e.g. Primary Gmail"
                autoFocus
              />
            </div>
            <div className="field">
              <label>Provider</label>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value, config: {} })}
                disabled={!!editing}
              >
                {(meta[channel] || []).map((pr) => (
                  <option key={pr} value={pr}>
                    {PROVIDER_LABELS[pr] || pr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "8px 0 16px" }} />

          {schema.map((f) => (
            <div className="field" key={f.k}>
              <label>{f.l}</label>
              {f.type === "checkbox" ? (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={form.config[f.k] === true || form.config[f.k] === "true"}
                    onChange={(e) => setConfig(f.k, e.target.checked)}
                  />
                  Enabled
                </label>
              ) : f.type === "select" ? (
                <select
                  value={form.config[f.k] ?? (typeof f.options[0] === "string" ? f.options[0] : f.options[0].value)}
                  onChange={(e) => setConfig(f.k, e.target.value)}
                >
                  {f.options.map((o) => {
                    const val = typeof o === "string" ? o : o.value;
                    const lab = typeof o === "string" ? o : o.label;
                    return (
                      <option key={val} value={val}>
                        {lab}
                      </option>
                    );
                  })}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  rows={3}
                  value={form.config[f.k] || ""}
                  placeholder={f.ph}
                  onChange={(e) => setConfig(f.k, e.target.value)}
                />
              ) : (
                <input
                  type={f.type === "password" ? "text" : "text"}
                  value={form.config[f.k] || ""}
                  placeholder={f.ph}
                  onChange={(e) => setConfig(f.k, e.target.value)}
                />
              )}
              {f.k === "bodyTemplate" && (
                <div className="hint">Placeholders: {"{{to}}"}, {"{{message}}"}, {"{{subject}}"}, {"{{name}}"}</div>
              )}
            </div>
          ))}
        </Modal>
      )}

      {testFor && (
        <Modal
          title={`Test: ${testFor.label}`}
          onClose={() => setTestFor(null)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setTestFor(null)}>
                Cancel
              </button>
              <button className="btn" onClick={runTest} disabled={busy}>
                {busy ? "Sending..." : "Send test"}
              </button>
            </>
          }
        >
          <div className="field">
            <label>Send test to ({channel === "email" ? "email address" : "phone number"})</label>
            <input value={testTo} onChange={(e) => setTestTo(e.target.value)} autoFocus placeholder={channel === "email" ? "you@example.com" : "+919999999999"} />
          </div>
        </Modal>
      )}

      {waTemplates && (
        <Modal title={`WhatsApp templates — ${waTemplates.provider}`} onClose={() => setWaTemplates(null)} wide>
          {waBusy ? (
            <Spinner />
          ) : waTemplates.list.length === 0 ? (
            <Empty icon="clipboard" title="No templates found" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Language</th>
                    <th>Category</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {waTemplates.list.map((t) => (
                    <tr key={`${t.name}-${t.language}`}>
                      <td className="mono">{t.name}</td>
                      <td>{t.language}</td>
                      <td>{t.category}</td>
                      <td>
                        <span className={`badge ${t.status === "APPROVED" ? "green" : "amber"}`}>{t.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

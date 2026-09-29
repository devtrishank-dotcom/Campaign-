import { useEffect, useState } from "react";
import api from "../lib/api";
import { useToast } from "../lib/toast";
import { Modal, Spinner, Empty, StatusBadge } from "../components/ui";
import Icon from "../components/Icon";
import { WA_LANGUAGES } from "../lib/constants";

const EMPTY = {
  name: "",
  channel: "email",
  subject: "",
  body: "",
  html: "",
  whatsappTemplateName: "",
  whatsappLanguage: "en",
  category: "general",
};

const CHANNEL_ICON = { email: "mail", whatsapp: "message", sms: "message" };

export default function Templates() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [categories, setCategories] = useState([]);
  const [catModal, setCatModal] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [catBusy, setCatBusy] = useState(false);

  const loadCategories = async () => {
    try {
      const { data } = await api.get("/categories");
      setCategories(data.data);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    setCatBusy(true);
    try {
      await api.post("/categories", { name });
      setNewCat("");
      await loadCategories();
      toast.success("Category added");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCatBusy(false);
    }
  };

  const removeCategory = async (cat) => {
    if (!window.confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await api.delete(`/categories/${cat._id}`);
      await loadCategories();
      toast.success("Category deleted");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/templates", { params: { channel } });
      setRows(data.data);
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
    setEditing(null);
    setForm(EMPTY);
    setModal(true);
  };
  const openEdit = (t) => {
    setEditing(t);
    setForm({
      name: t.name,
      channel: t.channel,
      subject: t.subject || "",
      body: t.body || "",
      html: t.html || "",
      whatsappTemplateName: t.whatsappTemplateName || "",
      whatsappLanguage: t.whatsappLanguage || "en",
      category: t.category || "general",
    });
    setModal(true);
  };

  const save = async () => {
    if (!form.name || !form.body) return toast.error("Name and body are required");
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/templates/${editing._id}`, form);
        toast.success("Template updated");
      } else {
        await api.post("/templates", form);
        toast.success("Template created");
      }
      setModal(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      await api.delete(`/templates/${t._id}`);
      toast.success("Template deleted");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="chips">
          {["", "email", "whatsapp", "sms"].map((c) => (
            <span key={c || "all"} className={`chip ${channel === c ? "on" : ""}`} onClick={() => setChannel(c)}>
              {c ? (
                <>
                  <Icon name={CHANNEL_ICON[c]} size={13} /> {c}
                </>
              ) : (
                "All"
              )}
            </span>
          ))}
        </div>
        <div className="spacer" />
        <button className="btn" onClick={openCreate}>
          <Icon name="plus" size={15} /> New Template
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty icon="file" title="No templates yet">
            Create reusable message templates with variables like {"{{name}}"}.
          </Empty>
        </div>
      ) : (
        <div className="grid cols-3">
          {rows.map((t) => (
            <div className="card pad" key={t._id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{t.name}</div>
                <span className="badge brand">
                  <Icon name={CHANNEL_ICON[t.channel]} size={12} /> {t.channel}
                </span>
              </div>
              {t.subject && <div className="muted small" style={{ marginTop: 8 }}>Subject: {t.subject}</div>}
              <div
                className="small"
                style={{
                  marginTop: 10,
                  background: "#f8fafc",
                  padding: 10,
                  borderRadius: 8,
                  maxHeight: 80,
                  overflow: "hidden",
                  whiteSpace: "pre-wrap",
                  color: "var(--muted)",
                }}
              >
                {t.body}
              </div>
              <div className="chips" style={{ marginTop: 10 }}>
                {(t.variables || []).slice(0, 4).map((v) => (
                  <span className="badge" key={v}>{`{{${v}}}`}</span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
                <StatusBadge status={t.status} />
                <div className="spacer" />
                <button className="btn secondary sm" onClick={() => openEdit(t)}>
                  Edit
                </button>
                <button className="btn ghost sm" style={{ color: "var(--red)" }} onClick={() => remove(t)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          title={editing ? "Edit Template" : "New Template"}
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
              <label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label>Channel</label>
              <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div className="field">
              <label>Category</label>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {!categories.some((c) => c.name === form.category) && form.category && (
                    <option value={form.category}>{form.category}</option>
                  )}
                  {categories.map((c) => (
                    <option key={c._id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn secondary"
                  style={{ flexShrink: 0 }}
                  onClick={() => setCatModal(true)}
                >
                  <Icon name="settings" size={14} /> Manage
                </button>
              </div>
            </div>
          </div>

          {form.channel === "email" && (
            <div className="field">
              <label>Subject</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
          )}

          <div className="field">
            <label>{form.channel === "email" ? "Plain text body" : "Message body"}</label>
            <textarea
              rows={5}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Hi {{name}}, ..."
            />
            <div className="hint">
              Variables: {"{{name}}"}, {"{{email}}"}, {"{{phone}}"}, {"{{survey_link}}"}, {"{{unsubscribe_link}}"} or any
              custom field.
            </div>
          </div>

          {form.channel === "email" && (
            <div className="field">
              <label>HTML body (optional)</label>
              <textarea rows={5} value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} />
            </div>
          )}

          {form.channel === "whatsapp" && (
            <div className="row">
              <div className="field">
                <label>WhatsApp Template Name (Meta Cloud API)</label>
                <input
                  value={form.whatsappTemplateName}
                  onChange={(e) => setForm({ ...form, whatsappTemplateName: e.target.value })}
                  placeholder="Optional - for approved templates"
                />
              </div>
                <div className="field">
                  <label>Language</label>
                  <select
                    value={form.whatsappLanguage}
                    onChange={(e) => setForm({ ...form, whatsappLanguage: e.target.value })}
                  >
                    {!WA_LANGUAGES.some((l) => l.value === form.whatsappLanguage) && form.whatsappLanguage && (
                      <option value={form.whatsappLanguage}>{form.whatsappLanguage}</option>
                    )}
                    {WA_LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
            </div>
          )}
        </Modal>
      )}

      {catModal && (
        <Modal
          title="Manage Categories"
          onClose={() => setCatModal(false)}
          footer={
            <button className="btn secondary" onClick={() => setCatModal(false)}>
              Done
            </button>
          }
        >
          <div className="field">
            <label>Add a category</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                placeholder="e.g. Festival Offer"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
              />
              <button className="btn" style={{ flexShrink: 0 }} onClick={addCategory} disabled={catBusy}>
                <Icon name="plus" size={14} /> Add
              </button>
            </div>
          </div>
          <div className="field">
            <label>Categories ({categories.length})</label>
            <div className="chips">
              {categories.map((c) => (
                <span key={c._id} className="chip">
                  {c.name}
                  <Icon
                    name="x"
                    size={13}
                    style={{ cursor: "pointer", marginLeft: 2 }}
                    onClick={() => removeCategory(c)}
                  />
                </span>
              ))}
              {categories.length === 0 && <span className="muted small">No categories yet</span>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useToast } from "../lib/toast";
import { Modal, Pagination, Spinner, Empty, StatusBadge, ProgressBar } from "../components/ui";
import Icon from "../components/Icon";

const EMPTY = {
  name: "",
  channel: "email",
  template: "",
  subject: "",
  body: "",
  html: "",
  lists: [],
  survey: "",
  scheduledAt: "",
};

export default function Campaigns() {
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const [lists, setLists] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [surveys, setSurveys] = useState([]);

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/campaigns", { params: { status, page, limit: 15 } });
      setRows(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, page]);

  useEffect(() => {
    Promise.all([
      api.get("/lists"),
      api.get("/templates", { params: { status: "active" } }),
      api.get("/surveys"),
    ])
      .then(([l, t, s]) => {
        setLists(l.data.data);
        setTemplates(t.data.data);
        setSurveys(s.data.data);
      })
      .catch(() => {});
  }, []);

  const channelTemplates = templates.filter((t) => t.channel === form.channel);

  const openCreate = () => {
    setForm(EMPTY);
    setPreview(null);
    setModal(true);
  };

  const applyTemplate = (id) => {
    const t = templates.find((x) => x._id === id);
    setForm((f) => ({
      ...f,
      template: id,
      subject: t?.subject || "",
      body: t?.body || "",
      html: t?.html || "",
    }));
  };

  const create = async () => {
    if (!form.name.trim()) return toast.error("Campaign name is required");
    if (!form.body.trim()) return toast.error("Message body is required (pick a template or type one)");
    setBusy(true);
    try {
      const payload = {
        ...form,
        template: form.template || undefined,
        survey: form.survey || undefined,
        scheduledAt: form.scheduledAt || undefined,
      };
      const { data } = await api.post("/campaigns", payload);
      toast.success("Campaign created");
      setModal(false);
      navigate(`/campaigns/${data.data._id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const previewAudience = async () => {
    try {
      const { data } = await api.post("/campaigns/preview-audience", {
        lists: form.lists,
        channel: form.channel,
      });
      setPreview(data);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete campaign "${c.name}"?`)) return;
    try {
      await api.delete(`/campaigns/${c._id}`);
      toast.success("Campaign deleted");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <select style={{ maxWidth: 200 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {["draft", "scheduled", "queued", "running", "paused", "completed", "failed", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn" onClick={openCreate}>
          <Icon name="plus" size={15} /> New Campaign
        </button>
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty icon="send" title="No campaigns yet">
            Create a campaign to send bulk Email / WhatsApp / SMS.
          </Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Channel</th>
                    <th>Status</th>
                    <th>Sent</th>
                    <th>Failed</th>
                    <th>Progress</th>
                    <th style={{ width: 130 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <Link to={`/campaigns/${c._id}`} style={{ fontWeight: 600, color: "var(--brand)" }}>
                          {c.name}
                        </Link>
                        {c.scheduledAt && (
                          <div className="muted small">Scheduled: {new Date(c.scheduledAt).toLocaleString()}</div>
                        )}
                      </td>
                      <td>
                        <span className="badge brand">{c.channel}</span>
                      </td>
                      <td>
                        <StatusBadge status={c.status} />
                        {c.approval?.required && c.approval?.status !== "approved" && (
                          <span
                            className={`badge ${c.approval.status === "rejected" ? "red" : "amber"}`}
                            style={{ marginLeft: 6 }}
                          >
                            {c.approval.status}
                          </span>
                        )}
                      </td>
                      <td>{c.stats?.sent || 0}</td>
                      <td style={{ color: c.stats?.failed ? "var(--red)" : undefined }}>{c.stats?.failed || 0}</td>
                      <td style={{ minWidth: 130 }}>
                        <ProgressBar value={c.stats?.sent || 0} max={c.stats?.total || 1} />
                      </td>
                      <td>
                        <Link className="btn secondary sm" to={`/campaigns/${c._id}`}>
                          View
                        </Link>
                        <button className="btn ghost sm" style={{ color: "var(--red)" }} onClick={() => remove(c)}>
                          Del
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} total={total} onChange={setPage} />
          </>
        )}
      </div>

      {modal && (
        <Modal
          title="New Campaign"
          onClose={() => setModal(false)}
          wide
          footer={
            <>
              <button className="btn secondary" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn" onClick={create} disabled={busy}>
                {busy ? "Creating..." : "Create Campaign"}
              </button>
            </>
          }
        >
          <div className="row">
            <div className="field">
              <label>Campaign Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label>Channel</label>
              <select
                value={form.channel}
                onChange={(e) => setForm({ ...form, channel: e.target.value, template: "" })}
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Use Template (optional)</label>
            <select value={form.template} onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">-- Manual message --</option>
              {channelTemplates.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {form.channel === "email" && (
            <div className="field">
              <label>Subject</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
          )}

          <div className="field">
            <label>Message Body</label>
            <textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <div className="hint">
              Variables: {"{{name}}"}, {"{{survey_link}}"}, {"{{unsubscribe_link}}"}, plus any custom field.
            </div>
          </div>

          {form.channel === "email" && (
            <div className="field">
              <label>HTML Body (optional, enables open/click tracking)</label>
              <textarea rows={4} value={form.html} onChange={(e) => setForm({ ...form, html: e.target.value })} />
            </div>
          )}

          <div className="field">
            <label>Target Lists</label>
            <div className="chips">
              {lists.map((l) => (
                <span
                  key={l._id}
                  className={`chip ${form.lists.includes(l._id) ? "on" : ""}`}
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      lists: f.lists.includes(l._id) ? f.lists.filter((x) => x !== l._id) : [...f.lists, l._id],
                    }))
                  }
                >
                  {l.name} ({l.contactCount || 0})
                </span>
              ))}
              {lists.length === 0 && <span className="muted small">No lists yet</span>}
            </div>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <button className="btn secondary sm" onClick={previewAudience}>
                Preview audience
              </button>
              {preview && (
                <span className="small muted">
                  {preview.total} contacts · <b>{preview.reachable}</b> reachable on {form.channel}
                </span>
              )}
            </div>
          </div>

          <div className="row">
            <div className="field">
              <label>Attach Survey (voting link)</label>
              <select value={form.survey} onChange={(e) => setForm({ ...form, survey: e.target.value })}>
                <option value="">None</option>
                {surveys.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.title} ({s.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Schedule (optional)</label>
              <input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

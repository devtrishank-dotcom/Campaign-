import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { publicBase } from "../lib/api";
import { useToast } from "../lib/toast";
import { Modal, Spinner, Empty, StatusBadge } from "../components/ui";
import Icon from "../components/Icon";

export default function Surveys() {
  const toast = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", thankYouMessage: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/surveys");
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
  }, []);

  const create = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    setBusy(true);
    try {
      const { data } = await api.post("/surveys", { ...form, status: "draft", questions: [] });
      toast.success("Survey created");
      setModal(false);
      navigate(`/surveys/${data.data._id}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (s) => {
    if (!window.confirm(`Delete survey "${s.title}" and all its responses?`)) return;
    try {
      await api.delete(`/surveys/${s._id}`);
      toast.success("Survey deleted");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const copyLink = (slug) => {
    const url = `${publicBase()}/s/${slug}`;
    navigator.clipboard?.writeText(url);
    toast.success("Public link copied");
  };

  return (
    <div>
      <div className="toolbar">
        <div className="spacer" />
        <button className="btn" onClick={() => setModal(true)}>
          <Icon name="plus" size={15} /> New Survey
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty icon="clipboard" title="No surveys yet">
            Build a feedback form and attach it to campaigns.
          </Empty>
        </div>
      ) : (
        <div className="grid cols-3">
          {rows.map((s) => (
            <div className="card pad" key={s._id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <div style={{ fontWeight: 700 }}>{s.title}</div>
                <StatusBadge status={s.status} />
              </div>
              {s.description && <div className="muted small" style={{ marginTop: 6 }}>{s.description}</div>}
              <div className="muted small" style={{ marginTop: 10 }}>
                {s.questions?.length || 0} questions · {s.responseCount || 0} responses
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <Link className="btn sm" to={`/surveys/${s._id}`}>
                  Open
                </Link>
                <button className="btn secondary sm" onClick={() => copyLink(s.slug)}>
                  <Icon name="link" size={13} /> Copy link
                </button>
                <button className="btn ghost sm" style={{ color: "var(--red)" }} onClick={() => remove(s)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          title="New Survey"
          onClose={() => setModal(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setModal(false)}>
                Cancel
              </button>
              <button className="btn" onClick={create} disabled={busy}>
                {busy ? "Creating..." : "Create & Edit"}
              </button>
            </>
          }
        >
          <div className="field">
            <label>Title</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="field">
            <label>Thank you message</label>
            <input
              value={form.thankYouMessage}
              onChange={(e) => setForm({ ...form, thankYouMessage: e.target.value })}
              placeholder="Thank you for your response!"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

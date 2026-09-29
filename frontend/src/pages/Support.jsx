import { useEffect, useState } from "react";
import api from "../lib/api";
import { useToast } from "../lib/toast";
import { useAuth } from "../lib/auth";
import { Modal, Spinner, Empty, StatusBadge, Pagination } from "../components/ui";
import Icon from "../components/Icon";

const CATEGORIES = ["general", "technical", "billing", "campaign", "feature request", "other"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export default function Support() {
  const toast = useToast();
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission("tickets.manage");

  const [mode, setMode] = useState("mine"); // mine | all
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "general", priority: "normal", message: "" });
  const [busy, setBusy] = useState(false);

  const [detail, setDetail] = useState(null);
  const [reply, setReply] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      if (mode === "all" && canManage) {
        const { data } = await api.get("/tickets", { params: { status, page, limit: 20 } });
        setRows(data.data);
        setTotal(data.total);
        setPages(data.pages);
      } else {
        const { data } = await api.get("/tickets/mine");
        setRows(data.data);
        setTotal(data.data.length);
        setPages(1);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, status, page]);

  const create = async () => {
    if (!form.subject.trim() || !form.message.trim()) return toast.error("Subject and message are required");
    setBusy(true);
    try {
      await api.post("/tickets", form);
      toast.success("Ticket raised");
      setCreateOpen(false);
      setForm({ subject: "", category: "general", priority: "normal", message: "" });
      setMode("mine");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openDetail = async (t) => {
    try {
      const { data } = await api.get(`/tickets/${t._id}`);
      setDetail({ ticket: data.data, isStaff: data.isStaff });
      setReply("");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/tickets/${detail.ticket._id}/reply`, { message: reply });
      setDetail({ ...detail, ticket: data.data });
      setReply("");
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (action, label) => {
    if (!window.confirm(`${label} this ticket?`)) return;
    try {
      const { data } = await api.post(`/tickets/${detail.ticket._id}/${action}`);
      setDetail({ ...detail, ticket: data.data });
      load();
      toast.success(`Ticket ${label.toLowerCase()}`);
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div className="toolbar">
        {canManage && (
          <div className="chips">
            <span className={`chip ${mode === "mine" ? "on" : ""}`} onClick={() => { setMode("mine"); setPage(1); }}>
              My Tickets
            </span>
            <span className={`chip ${mode === "all" ? "on" : ""}`} onClick={() => { setMode("all"); setPage(1); }}>
              All Tickets
            </span>
          </div>
        )}
        {canManage && mode === "all" && (
          <select style={{ maxWidth: 180 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            {["open", "in_progress", "resolved", "closed"].map((s) => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        )}
        <div className="spacer" />
        <button className="btn" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={15} /> Raise Ticket
        </button>
      </div>

      <div className="alert info">
        Facing any issue or have a question? Raise a ticket and our team will reply here and by email.
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty icon="inbox" title="No tickets">
            Raise a ticket if you need any help.
          </Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Subject</th>
                    {canManage && mode === "all" && <th>From</th>}
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t._id}>
                      <td className="mono">#{t.ticketNo}</td>
                      <td style={{ fontWeight: 600 }}>{t.subject}</td>
                      {canManage && mode === "all" && <td className="small muted">{t.requesterName || t.requesterEmail}</td>}
                      <td><StatusBadge status={t.priority} /></td>
                      <td><StatusBadge status={t.status} /></td>
                      <td className="small muted">{new Date(t.updatedAt).toLocaleString()}</td>
                      <td>
                        <button className="btn secondary sm" onClick={() => openDetail(t)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {mode === "all" && <Pagination page={page} pages={pages} total={total} onChange={setPage} />}
          </>
        )}
      </div>

      {createOpen && (
        <Modal
          title="Raise a Ticket"
          onClose={() => setCreateOpen(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button className="btn" onClick={create} disabled={busy}>
                {busy ? "Submitting..." : "Submit Ticket"}
              </button>
            </>
          }
        >
          <div className="field">
            <label>Subject</label>
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} autoFocus />
          </div>
          <div className="row">
            <div className="field">
              <label>Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Describe your issue</label>
            <textarea rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </div>
        </Modal>
      )}

      {detail && (
        <Modal
          title={`Ticket #${detail.ticket.ticketNo} - ${detail.ticket.subject}`}
          onClose={() => setDetail(null)}
          wide
          footer={
            <>
              <div className="spacer" />
              {detail.isStaff && detail.ticket.status !== "closed" && (
                <button className="btn secondary" onClick={() => changeStatus("close", "Close")}>
                  Close ticket
                </button>
              )}
              {detail.isStaff && detail.ticket.status === "closed" && (
                <button className="btn secondary" onClick={() => changeStatus("reopen", "Reopen")}>
                  Reopen
                </button>
              )}
            </>
          }
        >
          <div className="chips" style={{ marginBottom: 12 }}>
            <StatusBadge status={detail.ticket.status} />
            <StatusBadge status={detail.ticket.priority} />
            <span className="badge">{detail.ticket.category}</span>
            <span className="small muted">{detail.ticket.requesterName || detail.ticket.requesterEmail}</span>
          </div>

          <div className="alert info" style={{ whiteSpace: "pre-wrap" }}>{detail.ticket.message}</div>

          {detail.ticket.replies.map((r) => (
            <div
              key={r._id}
              className="card pad"
              style={{
                marginBottom: 8,
                background: r.isStaff ? "var(--cream)" : "#fff",
                borderColor: "var(--line)",
              }}
            >
              <div className="small" style={{ fontWeight: 600 }}>
                {r.authorName} {r.isStaff ? <span className="badge brand">staff</span> : null}
                <span className="muted" style={{ fontWeight: 400 }}> · {new Date(r.createdAt).toLocaleString()}</span>
              </div>
              <div style={{ whiteSpace: "pre-wrap", marginTop: 4 }}>{r.message}</div>
            </div>
          ))}

          {detail.ticket.status !== "closed" ? (
            <div className="field" style={{ marginTop: 12 }}>
              <label>Reply</label>
              <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Type your reply..." />
              <div style={{ marginTop: 8 }}>
                <button className="btn" onClick={sendReply} disabled={busy || !reply.trim()}>
                  Send reply
                </button>
              </div>
            </div>
          ) : (
            <div className="muted small" style={{ marginTop: 12 }}>
              This ticket is closed.
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

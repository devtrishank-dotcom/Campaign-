import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { API_ORIGIN } from "../lib/api";
import { useToast } from "../lib/toast";
import { useAuth } from "../lib/auth";
import { Spinner, StatusBadge, Pagination, ProgressBar, Modal } from "../components/ui";
import Icon from "../components/Icon";

export default function CampaignDetail() {
  const { id } = useParams();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canApprove = hasPermission("campaigns.approve");
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [campaign, setCampaign] = useState(null);
  const [stats, setStats] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  const loadAll = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([api.get(`/campaigns/${id}`), api.get(`/campaigns/${id}/stats`)]);
      setCampaign(c.data.data);
      setStats(s.data);
      return c.data.data;
    } catch (e) {
      toast.error(e.message);
      return null;
    }
  }, [id, toast]);

  const loadRecipients = useCallback(async () => {
    try {
      const { data } = await api.get(`/campaigns/${id}/recipients`, {
        params: { status: statusFilter, page, limit: 20 },
      });
      setRecipients(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      toast.error(e.message);
    }
  }, [id, statusFilter, page, toast]);

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  // Poll while campaign is active
  useEffect(() => {
    if (!campaign) return;
    const active = ["queued", "running"].includes(campaign.status);
    if (!active) return;
    timer.current = setInterval(async () => {
      const c = await loadAll();
      loadRecipients();
      if (c && !["queued", "running"].includes(c.status)) clearInterval(timer.current);
    }, 4000);
    return () => clearInterval(timer.current);
  }, [campaign, loadAll, loadRecipients]);

  const action = async (name, label) => {
    if (!window.confirm(`${label}?`)) return;
    setBusy(true);
    try {
      await api.post(`/campaigns/${id}/${name}`);
      toast.success(`Campaign ${label.toLowerCase()}`);
      await loadAll();
      loadRecipients();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const post = async (path, body, okMsg) => {
    setBusy(true);
    try {
      await api.post(`/campaigns/${id}/${path}`, body || {});
      toast.success(okMsg);
      await loadAll();
      loadRecipients();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    if (!testTo) return toast.error("Enter a destination");
    setBusy(true);
    try {
      await api.post(`/campaigns/${id}/test`, { to: testTo });
      toast.success("Test message sent");
      setTestOpen(false);
      setTestTo("");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const token = localStorage.getItem("token");
    const base = `${API_ORIGIN}/api`;
    fetch(`${base}/campaigns/${id}/recipients/export`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `campaign-${id}-recipients.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error("Export failed"));
  };

  if (loading) return <Spinner />;
  if (!campaign) return <div className="alert err">Campaign not found</div>;

  const s = campaign.stats || {};
  const approval = campaign.approval || {};
  const pct = s.total ? Math.round(((s.sent + s.failed) / s.total) * 100) : 0;

  return (
    <div>
      <div className="toolbar">
        <Link to="/campaigns" className="btn secondary sm">
          <Icon name="arrowLeft" size={14} /> Back
        </Link>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{campaign.name}</div>
        <span className="badge brand">{campaign.channel}</span>
        <StatusBadge status={campaign.status} />
        {approval.required && (
          <span
            className={`badge ${
              approval.status === "approved" ? "green" : approval.status === "rejected" ? "red" : "amber"
            }`}
          >
            approval: {approval.status}
          </span>
        )}
        <div className="spacer" />
        <button className="btn secondary" disabled={busy} onClick={() => setTestOpen(true)}>
          <Icon name="send" size={15} /> Test send
        </button>
        <button className="btn secondary" disabled={busy} onClick={exportCsv}>
          <Icon name="download" size={15} /> Export CSV
        </button>
        {canApprove && approval.required && approval.status !== "approved" && (
          <button className="btn" disabled={busy} onClick={() => post("approve", { note: "" }, "Campaign approved")}>
            <Icon name="check" size={15} /> Approve
          </button>
        )}
        {canApprove && approval.required && approval.status !== "rejected" && (
          <button className="btn danger" disabled={busy} onClick={() => setRejectOpen(true)}>
            <Icon name="x" size={15} /> Reject
          </button>
        )}
        {!canApprove && approval.required && approval.status === "rejected" && (
          <button className="btn secondary" disabled={busy} onClick={() => post("request-approval", {}, "Approval requested")}>
            Request approval
          </button>
        )}
        {["draft", "scheduled", "failed"].includes(campaign.status) && (
          <button className="btn" disabled={busy} onClick={() => action("send", "Send now")}>
            <Icon name="send" size={15} /> Send now
          </button>
        )}
        {["queued", "running"].includes(campaign.status) && (
          <button className="btn secondary" disabled={busy} onClick={() => action("pause", "Pause")}>
            <Icon name="pause" size={15} /> Pause
          </button>
        )}
        {campaign.status === "paused" && (
          <button className="btn" disabled={busy} onClick={() => action("resume", "Resume")}>
            <Icon name="play" size={15} /> Resume
          </button>
        )}
        {!["completed", "cancelled"].includes(campaign.status) && (
          <button className="btn danger" disabled={busy} onClick={() => action("cancel", "Cancel campaign")}>
            Cancel
          </button>
        )}
      </div>

      {campaign.pausedReason && (
        <div className="alert info" style={{ marginBottom: 14 }}>
          Paused: {campaign.pausedReason}. It will resume automatically when allowed.
        </div>
      )}

      {approval.required && approval.status === "rejected" && approval.note && (
        <div className="alert err" style={{ marginBottom: 14 }}>
          Rejected: {approval.note}
        </div>
      )}

      {s.failed > 0 && (
        <div className="alert err" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{s.failed} message(s) failed.</span>
          <button className="btn secondary sm" disabled={busy} onClick={() => post("retry-failed", {}, "Retrying failed messages")}>
            Retry failed
          </button>
        </div>
      )}

      <div className="grid cols-4" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="label">Total</div>
          <div className="value">{s.total || 0}</div>
        </div>
        <div className="stat">
          <div className="label">Sent</div>
          <div className="value" style={{ color: "var(--blue)" }}>{s.sent || 0}</div>
        </div>
        <div className="stat">
          <div className="label">Opened</div>
          <div className="value">{s.opened || 0}</div>
        </div>
        <div className="stat">
          <div className="label">Clicked</div>
          <div className="value" style={{ color: "var(--green)" }}>{s.clicked || 0}</div>
        </div>
      </div>

      <div className="card pad" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="small muted">
            Processed {s.sent + s.failed} of {s.total || 0} ({pct}%)
          </span>
          <span className="small muted">
            Failed: {s.failed || 0} · Pending: {s.pending || 0}
          </span>
        </div>
        <ProgressBar value={(s.sent || 0) + (s.failed || 0)} max={s.total || 1} />
      </div>

      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Message Preview</h3>
          {campaign.subject && <div className="small muted">Subject: {campaign.subject}</div>}
          <pre
            className="mono"
            style={{ whiteSpace: "pre-wrap", background: "#f8fafc", padding: 12, borderRadius: 8, marginTop: 10 }}
          >
            {campaign.body}
          </pre>
        </div>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Details</h3>
          <table>
            <tbody>
              <tr>
                <td className="muted">Lists</td>
                <td>{(campaign.lists || []).map((l) => l.name).join(", ") || "—"}</td>
              </tr>
              <tr>
                <td className="muted">Survey</td>
                <td>{campaign.survey?.title || "—"}</td>
              </tr>
              <tr>
                <td className="muted">Created</td>
                <td>{new Date(campaign.createdAt).toLocaleString()}</td>
              </tr>
              <tr>
                <td className="muted">Started</td>
                <td>{campaign.startedAt ? new Date(campaign.startedAt).toLocaleString() : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Recipients ({total})</h3>
          <select
            style={{ maxWidth: 180 }}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            {["pending", "sent", "opened", "clicked", "failed", "unsubscribed"].map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Destination</th>
                <th>Status</th>
                <th>Sent at</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r._id}>
                  <td style={{ fontWeight: 600 }}>{r.contact?.name || r.to?.name || "—"}</td>
                  <td className="mono">{r.channel === "email" ? r.to?.email : r.to?.phone}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="small muted">{r.sentAt ? new Date(r.sentAt).toLocaleString() : "—"}</td>
                  <td className="small" style={{ color: "var(--red)", maxWidth: 260 }}>
                    {r.error ? r.error.slice(0, 80) : ""}
                  </td>
                </tr>
              ))}
              {recipients.length === 0 && (
                <tr>
                  <td colSpan={5} className="center muted" style={{ padding: 30 }}>
                    No recipients yet. Click "Send now" to build the audience.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={total} onChange={setPage} />
      </div>

      {testOpen && (
        <Modal
          title="Send a test message"
          onClose={() => setTestOpen(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setTestOpen(false)}>
                Cancel
              </button>
              <button className="btn" onClick={runTest} disabled={busy}>
                {busy ? "Sending..." : "Send test"}
              </button>
            </>
          }
        >
          <div className="field">
            <label>{campaign.channel === "email" ? "Email address" : "Phone number"}</label>
            <input
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder={campaign.channel === "email" ? "you@example.com" : "+919999999999"}
              autoFocus
            />
            <div className="hint">A test message is sent using the active {campaign.channel} provider. Stats are not affected.</div>
          </div>
        </Modal>
      )}

      {rejectOpen && (
        <Modal
          title="Reject campaign"
          onClose={() => setRejectOpen(false)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setRejectOpen(false)}>
                Cancel
              </button>
              <button
                className="btn danger"
                disabled={busy}
                onClick={async () => {
                  await post("reject", { note: rejectNote }, "Campaign rejected");
                  setRejectOpen(false);
                  setRejectNote("");
                }}
              >
                Reject
              </button>
            </>
          }
        >
          <div className="field">
            <label>Reason (optional)</label>
            <textarea rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  );
}

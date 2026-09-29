import Icon from "./Icon";

export function Spinner({ label }) {
  return (
    <div className="loading">
      <div className="spinner" />
      {label || "Loading..."}
    </div>
  );
}

export function Empty({ icon = "inbox", title, children }) {
  return (
    <div className="empty">
      <div className="big">
        <Icon name={icon} size={36} />
      </div>
      <div className="title">{title}</div>
      {children}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? "wide" : ""}`}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="x-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({ page, pages, total, onChange }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className="pager">
      <span>
        Page {page} of {pages} · {total} total
      </span>
      <div className="btns">
        <button className="btn secondary sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          Previous
        </button>
        <button className="btn secondary sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  draft: "",
  scheduled: "blue",
  queued: "amber",
  running: "brand",
  paused: "amber",
  completed: "green",
  failed: "red",
  cancelled: "red",
  sent: "blue",
  delivered: "green",
  pending: "",
  opened: "brand",
  clicked: "green",
  unsubscribed: "red",
  active: "green",
  archived: "",
  closed: "red",
  subscribed: "green",
  bounced: "red",
  success: "green",
  open: "amber",
  in_progress: "blue",
  resolved: "green",
  closed: "red",
  low: "",
  normal: "blue",
  high: "amber",
  urgent: "red",
};

export function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || "";
  return <span className={`badge ${color}`}>{status}</span>;
}

export function ProgressBar({ value = 0, max = 100 }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="progress">
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

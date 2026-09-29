import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { Spinner, StatusBadge, ProgressBar, Empty } from "../components/ui";
import Icon from "../components/Icon";

const CARDS = [
  { key: "contacts", label: "Contacts", icon: "users" },
  { key: "lists", label: "Lists", icon: "folder" },
  { key: "campaigns", label: "Campaigns", icon: "send" },
  { key: "templates", label: "Templates", icon: "file" },
  { key: "surveys", label: "Surveys", icon: "clipboard" },
  { key: "responses", label: "Responses", icon: "check" },
  { key: "users", label: "Active Users", icon: "userCog" },
];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/dashboard/overview")
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <div className="alert err">{error}</div>;

  const { counts, messageStats, recentCampaigns } = data;
  const reachRate =
    messageStats.sent > 0 ? Math.round((messageStats.delivered / messageStats.sent) * 100) : 0;

  return (
    <div>
      <div className="grid cols-4" style={{ marginBottom: 20 }}>
        {CARDS.map((c) => (
          <div className="stat" key={c.key}>
            <div className="label">
              <Icon name={c.icon} size={15} /> {c.label}
            </div>
            <div className="value">{counts[c.key] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="grid cols-2" style={{ marginBottom: 20 }}>
        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Message Delivery</h3>
          <div className="grid cols-3" style={{ gap: 12 }}>
            <div className="stat">
              <div className="label">Sent</div>
              <div className="value">{messageStats.sent}</div>
            </div>
            <div className="stat">
              <div className="label">Failed</div>
              <div className="value" style={{ color: "var(--red)" }}>
                {messageStats.failed}
              </div>
            </div>
            <div className="stat">
              <div className="label">Opened</div>
              <div className="value">{messageStats.opened}</div>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <div className="small muted" style={{ marginBottom: 6 }}>
              Total reach: {messageStats.total} recipients · {reachRate}% delivered
            </div>
            <ProgressBar value={messageStats.sent} max={messageStats.total || 1} />
          </div>
        </div>

        <div className="card pad">
          <h3 style={{ marginTop: 0 }}>Engagement</h3>
          {[
            { label: "Sent", value: messageStats.sent },
            { label: "Opened", value: messageStats.opened },
            { label: "Clicked", value: messageStats.clicked },
            { label: "Failed", value: messageStats.failed },
          ].map((r) => (
            <div className="bar-row" key={r.label}>
              <div className="bar-label">{r.label}</div>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{ width: `${messageStats.sent ? (r.value / messageStats.sent) * 100 : 0}%` }}
                />
              </div>
              <div className="bar-val">{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Recent Campaigns</h3>
          <Link className="btn secondary sm" to="/campaigns">
            View all
          </Link>
        </div>
        {recentCampaigns.length === 0 ? (
          <Empty icon="send" title="No campaigns yet">
            Create your first campaign to get started.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Channel</th>
                  <th>Status</th>
                  <th>Sent</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {recentCampaigns.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <Link to={`/campaigns/${c._id}`} style={{ fontWeight: 600, color: "var(--brand)" }}>
                        {c.name}
                      </Link>
                    </td>
                    <td>
                      <span className="badge brand">{c.channel}</span>
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      {c.stats?.sent || 0}/{c.stats?.total || 0}
                    </td>
                    <td style={{ minWidth: 140 }}>
                      <ProgressBar value={c.stats?.sent || 0} max={c.stats?.total || 1} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import api from "../lib/api";
import { useToast } from "../lib/toast";
import { Spinner, Empty, Pagination } from "../components/ui";

export default function Reports() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get("/dashboard/audit-logs", { params: { page, limit: 25, action } })
        .then((r) => {
          setLogs(r.data.data);
          setTotal(r.data.total);
          setPages(r.data.pages);
        })
        .catch((e) => toast.error(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, action]);

  return (
    <div>
      <div className="toolbar">
        <input
          className="grow"
          placeholder="Filter by action (e.g. campaign.send)..."
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : logs.length === 0 ? (
          <Empty icon="chart" title="No activity yet" />
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>User</th>
                    <th>Entity</th>
                    <th>IP</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l) => (
                    <tr key={l._id}>
                      <td>
                        <span className="badge brand">{l.action}</span>
                      </td>
                      <td>{l.actor?.name || l.actorEmail || "—"}</td>
                      <td className="mono small">
                        {l.entity} {l.entityId ? `· ${String(l.entityId).slice(-6)}` : ""}
                      </td>
                      <td className="small muted">{l.ip || "—"}</td>
                      <td className="small muted">{new Date(l.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} pages={pages} total={total} onChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

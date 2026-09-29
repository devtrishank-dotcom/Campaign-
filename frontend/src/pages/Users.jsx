import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../lib/api";
import { useToast } from "../lib/toast";
import { useAuth } from "../lib/auth";
import { Modal, Spinner, Empty, StatusBadge } from "../components/ui";
import Icon from "../components/Icon";

export default function Users() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canManageRoles = hasPermission("roles.manage");
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState({ roles: [], permissions: [] });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'form' | 'import'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "manager",
    isActive: true,
    theme: "",
  });
  const [busy, setBusy] = useState(false);
  const [importFile, setImportFile] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [u, m] = await Promise.all([api.get("/users"), api.get("/users/meta")]);
      setRows(u.data.data);
      setMeta(m.data);
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

  const roleName = (key) => meta.roles.find((r) => r.key === key)?.name || key;

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      email: "",
      password: "",
      role: meta.roles[0]?.key || "manager",
      isActive: true,
      theme: "",
    });
    setModal("form");
  };

  const openEdit = (u) => {
    setEditing(u);
    setForm({
      name: u.name,
      email: u.email,
      password: "",
      role: u.role,
      isActive: u.isActive,
      theme: u.theme || "",
    });
    setModal("form");
  };

  const save = async () => {
    if (!form.name || !form.email) return toast.error("Name and email are required");
    if (!editing && !form.password) return toast.error("Password is required for new users");
    setBusy(true);
    try {
      const payload = { ...form };
      if (!payload.password) delete payload.password;
      if (editing) {
        await api.put(`/users/${editing._id}`, payload);
        toast.success("User updated");
      } else {
        await api.post("/users", payload);
        toast.success("User created");
      }
      setModal(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"?`)) return;
    try {
      await api.delete(`/users/${u._id}`);
      toast.success("User deleted");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const download = async (path, filename) => {
    try {
      const res = await api.get(path, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Download failed");
    }
  };

  const runImport = async () => {
    if (!importFile) return toast.error("Choose a .csv or .xlsx file");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      const { data } = await api.post("/users/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(
        `Imported: ${data.summary.created} created, ${data.summary.skipped} skipped, ${data.summary.failed} failed`
      );
      setModal(null);
      setImportFile(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="spacer" />
        <button
          className="btn secondary"
          onClick={() => download("/users/template?format=xlsx", "users-template.xlsx")}
        >
          <Icon name="fileSpreadsheet" size={15} /> Example Excel
        </button>
        <button className="btn secondary" onClick={() => setModal("import")}>
          <Icon name="upload" size={15} /> Import
        </button>
        <button className="btn secondary" onClick={() => download("/users/export?format=csv", "users.csv")}>
          <Icon name="download" size={15} /> Export CSV
        </button>
        <button className="btn secondary" onClick={() => download("/users/export?format=xlsx", "users.xlsx")}>
          <Icon name="download" size={15} /> Export Excel
        </button>
        <button className="btn" onClick={openCreate}>
          <Icon name="plus" size={15} /> New User
        </button>
      </div>

      <div className="alert info">
        {canManageRoles ? (
          <>
            Roles are managed separately. Go to{" "}
            <Link to="/roles" style={{ textDecoration: "underline" }}>
              Roles
            </Link>{" "}
            to create or edit roles, then assign one here.
          </>
        ) : (
          "You can see and manage only the users in your own account. Assign a role to each user."
        )}
      </div>

      <div className="card">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty icon="userCog" title="No users" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last login</th>
                  <th style={{ width: 140 }}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u._id}>
                    <td style={{ fontWeight: 600 }}>{u.name}</td>
                    <td>{u.email}</td>
                    <td>
                      <span className="badge brand">{roleName(u.role)}</span>
                    </td>
                    <td>
                      <StatusBadge status={u.isActive ? "active" : "closed"} />
                    </td>
                    <td className="small muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "—"}</td>
                    <td>
                      <button className="btn secondary sm" onClick={() => openEdit(u)}>
                        Edit
                      </button>
                      <button className="btn ghost sm" style={{ color: "var(--red)" }} onClick={() => remove(u)}>
                        Del
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === "form" && (
        <Modal
          title={editing ? "Edit User" : "New User"}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setModal(null)}>
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
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>{editing ? "New password (leave blank to keep)" : "Password"}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {meta.roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Colour theme</label>
            <select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })}>
              <option value="">Default</option>
              {(meta.themes || []).map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <div className="hint">This user's app colour. Sub-users inherit the admin's theme if left default.</div>
          </div>

          <label className="check" style={{ marginBottom: 4 }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
          <div className="hint" style={{ marginTop: 10 }}>
            Permissions come from the selected role. To change them, edit the role on the Roles page.
          </div>
        </Modal>
      )}

      {modal === "import" && (
        <Modal
          title="Import Users"
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button className="btn" onClick={runImport} disabled={busy}>
                {busy ? "Importing..." : "Import"}
              </button>
            </>
          }
        >
          <div className="alert info">
            Columns: <b>name, email, password, role</b>. Role must match an existing role key (e.g. manager, viewer).
            Download the example file to see the format.
          </div>
          <div className="field">
            <label>File (.csv or .xlsx)</label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files[0])}
            />
          </div>
          <button
            className="btn secondary sm"
            onClick={() => download("/users/template?format=xlsx", "users-template.xlsx")}
          >
            <Icon name="fileSpreadsheet" size={14} /> Download example Excel
          </button>
        </Modal>
      )}
    </div>
  );
}

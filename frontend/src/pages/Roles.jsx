import { useEffect, useState } from "react";
import api from "../lib/api";
import { useToast } from "../lib/toast";
import { Modal, Spinner, Empty } from "../components/ui";
import Icon from "../components/Icon";

export default function Roles() {
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", key: "", description: "", permissions: [] });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([api.get("/roles"), api.get("/roles/meta")]);
      setRoles(r.data.data);
      setPermissions(m.data.permissions);
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

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", key: "", description: "", permissions: [] });
    setModal(true);
  };

  const openEdit = (role) => {
    setEditing(role);
    setForm({
      name: role.name,
      key: role.key,
      description: role.description || "",
      permissions: role.permissions || [],
    });
    setModal(true);
  };

  const togglePerm = (p) =>
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter((x) => x !== p)
        : [...f.permissions, p],
    }));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Role name is required");
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/roles/${editing._id}`, {
          name: form.name,
          description: form.description,
          permissions: form.permissions,
        });
        toast.success("Role updated");
      } else {
        await api.post("/roles", form);
        toast.success("Role created");
      }
      setModal(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (role) => {
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    try {
      await api.delete(`/roles/${role._id}`);
      toast.success("Role deleted");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const isSuperAdmin = editing?.key === "super_admin";

  return (
    <div>
      <div className="toolbar">
        <div className="alert info" style={{ margin: 0, flex: 1 }}>
          Roles define what a user can do. Assign a role when creating a user.
        </div>
        <button className="btn" onClick={openCreate}>
          <Icon name="plus" size={15} /> New Role
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : roles.length === 0 ? (
        <div className="card">
          <Empty icon="shield" title="No roles yet" />
        </div>
      ) : (
        <div className="grid cols-3">
          {roles.map((r) => (
            <div className="card pad" key={r._id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{r.name}</div>
                  <div className="muted small mono">{r.key}</div>
                </div>
                {r.isSystem ? <span className="badge brand">system</span> : <span className="badge">custom</span>}
              </div>
              {r.description && (
                <p className="muted small" style={{ marginTop: 8, marginBottom: 0 }}>
                  {r.description}
                </p>
              )}
              <div className="muted small" style={{ marginTop: 10 }}>
                {r.permissions?.length || 0} permissions · {r.userCount || 0} user(s)
              </div>
              <div className="chips" style={{ marginTop: 10 }}>
                {(r.permissions || []).slice(0, 3).map((p) => (
                  <span className="badge" key={p}>
                    {p}
                  </span>
                ))}
                {(r.permissions || []).length > 3 && (
                  <span className="badge">+{r.permissions.length - 3}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button className="btn secondary sm" onClick={() => openEdit(r)}>
                  Edit
                </button>
                {!r.isSystem && (
                  <button className="btn ghost sm" style={{ color: "var(--red)" }} onClick={() => remove(r)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          title={editing ? `Edit Role: ${editing.name}` : "New Role"}
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
              <label>Role Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </div>
            <div className="field">
              <label>Key</label>
              <input
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                disabled={!!editing}
                placeholder="auto from name"
              />
            </div>
          </div>
          <div className="field">
            <label>Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="field">
            <label>Permissions</label>
            {isSuperAdmin && <div className="hint" style={{ color: "var(--amber)" }}>Super Admin always has all permissions.</div>}
            <div className="chips">
              {permissions.map((p) => {
                const on = isSuperAdmin || form.permissions.includes(p);
                return (
                  <span
                    key={p}
                    className={`chip ${on ? "on" : ""}`}
                    style={{ opacity: isSuperAdmin ? 0.7 : 1 }}
                    onClick={() => !isSuperAdmin && togglePerm(p)}
                  >
                    {p}
                  </span>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

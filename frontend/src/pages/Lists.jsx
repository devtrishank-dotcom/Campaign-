import { useEffect, useState } from "react";
import api from "../lib/api";
import { useToast } from "../lib/toast";
import { Modal, Spinner, Empty } from "../components/ui";
import Icon from "../components/Icon";

export default function Lists() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/lists");
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

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", description: "" });
    setModal(true);
  };
  const openEdit = (l) => {
    setEditing(l);
    setForm({ name: l.name, description: l.description || "" });
    setModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/lists/${editing._id}`, form);
        toast.success("List updated");
      } else {
        await api.post("/lists", form);
        toast.success("List created");
      }
      setModal(false);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (l) => {
    if (!window.confirm(`Delete list "${l.name}"? Contacts will not be deleted.`)) return;
    try {
      await api.delete(`/lists/${l._id}`);
      toast.success("List deleted");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <div className="toolbar">
        <div className="spacer" />
        <button className="btn" onClick={openCreate}>
          <Icon name="plus" size={15} /> New List
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <div className="card">
          <Empty icon="folder" title="No lists yet">
            Create lists to group contacts for campaigns.
          </Empty>
        </div>
      ) : (
        <div className="grid cols-3">
          {rows.map((l) => (
            <div className="card pad" key={l._id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{l.name}</div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    {l.contactCount || 0} contacts
                  </div>
                </div>
                <span className="badge brand">
                  <Icon name="folder" size={13} />
                </span>
              </div>
              {l.description && (
                <p className="muted small" style={{ marginTop: 10, marginBottom: 0 }}>
                  {l.description}
                </p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button className="btn secondary sm" onClick={() => openEdit(l)}>
                  Edit
                </button>
                <button className="btn ghost sm" style={{ color: "var(--red)" }} onClick={() => remove(l)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          title={editing ? "Edit List" : "New List"}
          onClose={() => setModal(false)}
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
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

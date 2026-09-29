import { useEffect, useMemo, useState, useCallback } from "react";
import api from "../lib/api";
import { useToast } from "../lib/toast";
import { Modal, Pagination, Spinner, Empty, StatusBadge } from "../components/ui";
import Icon from "../components/Icon";
import { COUNTRY_CODES } from "../lib/constants";

const EMPTY_FORM = { name: "", email: "", phone: "", whatsapp: "", countryCode: "+91", tags: "" };

export default function Contacts() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [lists, setLists] = useState([]);
  const [listId, setListId] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);

  const [modal, setModal] = useState(null); // 'create' | 'edit' | 'import'
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [defaultCc, setDefaultCc] = useState("+91");
  const [importFile, setImportFile] = useState(null);
  const [importListIds, setImportListIds] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/contacts", { params: { q, listId, page, limit: 20 } });
      setRows(data.data);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, listId, page, toast]);

  useEffect(() => {
    api.get("/lists").then((r) => setLists(r.data.data)).catch(() => {});
    api
      .get("/contacts/defaults")
      .then((r) => setDefaultCc(r.data.data.defaultCountryCode || "+91"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, countryCode: defaultCc });
    setEditing(null);
    setModal("create");
  };

  const openEdit = (c) => {
    setForm({
      name: c.name || "",
      email: c.email || "",
      phone: c.phone || "",
      whatsapp: c.whatsapp || "",
      countryCode: c.countryCode || "+91",
      tags: (c.tags || []).join(", "),
    });
    setEditing(c);
    setModal("edit");
  };

  const save = async () => {
    setBusy(true);
    try {
      const payload = { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
      if (editing) {
        await api.put(`/contacts/${editing._id}`, payload);
        toast.success("Contact updated");
      } else {
        await api.post("/contacts", payload);
        toast.success("Contact created");
      }
      setModal(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete contact "${c.name || c.email || c.phone}"?`)) return;
    try {
      await api.delete(`/contacts/${c._id}`);
      toast.success("Contact deleted");
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const bulkDelete = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} selected contact(s)?`)) return;
    try {
      await api.post("/contacts/bulk-delete", { ids: selected });
      toast.success("Contacts deleted");
      setSelected([]);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  const runImport = async () => {
    if (!importFile) return toast.error("Please choose a CSV file");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      if (importListIds.length) fd.append("listIds", importListIds.join(","));
      const { data } = await api.post("/contacts/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(
        `Imported: ${data.summary.created} new, ${data.summary.updated} updated, ${data.summary.skipped} skipped`
      );
      setModal(null);
      setImportFile(null);
      setImportListIds([]);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
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

  const exportParams = () => {
    const p = new URLSearchParams();
    if (listId) p.set("listId", listId);
    return p.toString() ? `&${p.toString()}` : "";
  };

  const allChecked = useMemo(() => rows.length > 0 && selected.length === rows.length, [rows, selected]);

  const toggleAll = () => setSelected(allChecked ? [] : rows.map((r) => r._id));
  const toggleOne = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div>
      <div className="toolbar">
        <input
          className="grow"
          placeholder="Search by name, email or phone..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          style={{ maxWidth: 220 }}
          value={listId}
          onChange={(e) => {
            setListId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All lists</option>
          {lists.map((l) => (
            <option key={l._id} value={l._id}>
              {l.name}
            </option>
          ))}
        </select>
        <button
          className="btn secondary"
          onClick={() => download("/contacts/template?format=xlsx", "contacts-template.xlsx")}
        >
          <Icon name="fileSpreadsheet" size={15} /> Example
        </button>
        <button className="btn secondary" onClick={() => setModal("import")}>
          <Icon name="upload" size={15} /> Import
        </button>
        <button
          className="btn secondary"
          onClick={() => download(`/contacts/export?format=csv${exportParams()}`, "contacts.csv")}
        >
          <Icon name="download" size={15} /> Export CSV
        </button>
        <button
          className="btn secondary"
          onClick={() => download(`/contacts/export?format=xlsx${exportParams()}`, "contacts.xlsx")}
        >
          <Icon name="download" size={15} /> Export Excel
        </button>
        <button className="btn" onClick={openCreate}>
          <Icon name="plus" size={15} /> Add Contact
        </button>
      </div>

      {selected.length > 0 && (
        <div className="alert info" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{selected.length} selected</span>
          <button className="btn danger sm" onClick={bulkDelete}>
            Delete selected
          </button>
        </div>
      )}

      <div className="card">
        {loading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <Empty icon="users" title="No contacts found">
            Add contacts manually or import a CSV file.
          </Empty>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                    </th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Tags</th>
                    <th>Status</th>
                    <th style={{ width: 110 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c._id}>
                      <td>
                        <input type="checkbox" checked={selected.includes(c._id)} onChange={() => toggleOne(c._id)} />
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.name || "—"}</td>
                      <td>{c.email || "—"}</td>
                      <td>{c.phone || "—"}</td>
                      <td>
                        <div className="chips">
                          {(c.tags || []).slice(0, 3).map((t) => (
                            <span className="badge" key={t}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td>
                        <button className="btn ghost sm" onClick={() => openEdit(c)}>
                          Edit
                        </button>
                        <button className="btn ghost sm" style={{ color: "var(--red)" }} onClick={() => remove(c)}>
                          Delete
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

      {(modal === "create" || modal === "edit") && (
        <Modal
          title={editing ? "Edit Contact" : "Add Contact"}
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
          <div className="field">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="row">
            <div className="field">
              <label>Email</label>
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label>WhatsApp</label>
              <input
                value={form.whatsapp}
                onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                placeholder="Defaults to phone"
              />
            </div>
            <div className="field">
              <label>Country Code</label>
              <select
                value={form.countryCode}
                onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
              >
                {!COUNTRY_CODES.some((c) => c.code === form.countryCode) && form.countryCode && (
                  <option value={form.countryCode}>{form.countryCode}</option>
                )}
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Tags (comma separated)</label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="voter, ward-1" />
          </div>
        </Modal>
      )}

      {modal === "import" && (
        <Modal
          title="Import Contacts from CSV"
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
            CSV should have headers like <b>name, email, phone, whatsapp, countryCode, tags</b>. Any extra columns are
            stored as custom fields. Tags can be separated with <b>|</b> or <b>,</b>.
          </div>
          <div className="field">
            <label>CSV File</label>
            <input type="file" accept=".csv" onChange={(e) => setImportFile(e.target.files[0])} />
          </div>
          <button
            className="btn secondary sm"
            onClick={() => download("/contacts/template?format=csv", "contacts-template.csv")}
          >
            <Icon name="download" size={14} /> Download example CSV
          </button>
          <div className="field">
            <label>Add to lists (optional)</label>
            <div className="chips">
              {lists.map((l) => (
                <span
                  key={l._id}
                  className={`chip ${importListIds.includes(l._id) ? "on" : ""}`}
                  onClick={() =>
                    setImportListIds((s) => (s.includes(l._id) ? s.filter((x) => x !== l._id) : [...s, l._id]))
                  }
                >
                  {l.name}
                </span>
              ))}
              {lists.length === 0 && <span className="muted small">No lists yet</span>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

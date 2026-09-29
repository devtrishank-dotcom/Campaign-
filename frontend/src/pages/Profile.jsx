import { useState } from "react";
import api from "../lib/api";
import { useAuth } from "../lib/auth";
import { useToast } from "../lib/toast";

export default function Profile() {
  const { user, permissions } = useAuth();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const changePassword = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid cols-2">
      <div className="card pad">
        <h3 style={{ marginTop: 0 }}>Account</h3>
        <table>
          <tbody>
            <tr>
              <td className="muted">Name</td>
              <td style={{ fontWeight: 600 }}>{user?.name}</td>
            </tr>
            <tr>
              <td className="muted">Email</td>
              <td>{user?.email}</td>
            </tr>
            <tr>
              <td className="muted">Role</td>
              <td>
                <span className="badge brand">{user?.role?.replace("_", " ")}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div className="field" style={{ marginTop: 16 }}>
          <label>Your permissions</label>
          <div className="chips">
            {permissions.map((p) => (
              <span className="chip on" key={p}>
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="card pad">
        <h3 style={{ marginTop: 0 }}>Change Password</h3>
        <form onSubmit={changePassword}>
          <div className="field">
            <label>Current password</label>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div className="field">
            <label>New password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <button className="btn" disabled={busy}>
            {busy ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}

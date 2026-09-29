import mongoose from "mongoose";
import { PERMISSIONS, ROLE_PERMISSIONS } from "./User.js";

const roleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const Role = mongoose.model("Role", roleSchema);

const SYSTEM_ROLES = [
  { key: "super_admin", name: "Super Admin", description: "Full access to everything", isSystem: true },
  { key: "admin", name: "Admin", description: "Manages contacts, campaigns and approvals", isSystem: true },
  { key: "manager", name: "Manager", description: "Creates campaigns, needs approval to send", isSystem: true },
  { key: "viewer", name: "Viewer", description: "Read-only access to reports", isSystem: true },
];

// Ensure the built-in roles exist and always match the code-defined permissions.
export async function ensureSystemRoles() {
  for (const r of SYSTEM_ROLES) {
    const permissions = r.key === "super_admin" ? [...PERMISSIONS] : ROLE_PERMISSIONS[r.key] || [];
    const existing = await Role.findOne({ key: r.key });
    if (!existing) {
      await Role.create({ ...r, permissions });
      continue;
    }
    const same =
      existing.permissions.length === permissions.length &&
      permissions.every((p) => existing.permissions.includes(p));
    if (!same) {
      existing.permissions = permissions;
      existing.isSystem = true;
      await existing.save();
    }
  }
}

export { PERMISSIONS };

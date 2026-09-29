import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const ROLES = ["super_admin", "admin", "manager", "viewer"];

export const PERMISSIONS = [
  "dashboard.view",
  "contacts.manage",
  "lists.manage",
  "templates.manage",
  "campaigns.manage",
  "campaigns.send",
  "campaigns.approve",
  "surveys.manage",
  "reports.view",
  "users.manage",
  "roles.manage",
  "settings.manage",
  "tickets.manage",
];

export const ROLE_PERMISSIONS = {
  super_admin: [...PERMISSIONS],
  admin: PERMISSIONS.filter((p) => p !== "roles.manage"),
  manager: [
    "dashboard.view",
    "contacts.manage",
    "lists.manage",
    "templates.manage",
    "campaigns.manage",
    "campaigns.send",
    "surveys.manage",
    "reports.view",
  ],
  viewer: ["dashboard.view", "reports.view"],
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    role: { type: String, default: "manager" },
    extraPermissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // Tenant this user belongs to. null for super_admin and for admins (they are
    // their own tenant root). Sub-users store their admin's _id.
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    // Colour theme for this account (empty = inherit / default)
    theme: { type: String, default: "" },
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.permissions = function permissions() {
  // Prefer the permissions resolved from the Role collection (set by hydratePermissions)
  if (Array.isArray(this._permCache)) return this._permCache;
  const base = ROLE_PERMISSIONS[this.role] || [];
  return Array.from(new Set([...base, ...(this.extraPermissions || [])]));
};

userSchema.methods.hasPermission = function hasPermission(perm) {
  if (this.role === "super_admin") return true;
  return this.permissions().includes(perm);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    extraPermissions: this.extraPermissions,
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
    tenantId: this.tenantId,
    theme: this.theme,
    createdBy: this.createdBy,
    createdAt: this.createdAt,
  };
};

export const User = mongoose.model("User", userSchema);

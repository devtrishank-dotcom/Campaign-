import { Role } from "../models/Role.js";
import { ROLE_PERMISSIONS } from "../models/User.js";

// Resolve effective permissions for a user by combining their role's permissions
// (from the Role collection, falling back to built-in defaults) with any extra
// permissions granted directly on the user.
export async function resolvePermissions(user) {
  if (!user) return [];
  if (user.role === "super_admin") {
    const role = await Role.findOne({ key: "super_admin" });
    return role ? [...role.permissions] : [...(ROLE_PERMISSIONS.super_admin || [])];
  }
  const role = await Role.findOne({ key: user.role });
  const base = role ? role.permissions : ROLE_PERMISSIONS[user.role] || [];
  return Array.from(new Set([...base, ...(user.extraPermissions || [])]));
}

// Attach the resolved permissions to the user document so synchronous
// user.hasPermission() / user.permissions() keep working in controllers.
export async function hydratePermissions(user) {
  const perms = await resolvePermissions(user);
  user._permCache = perms;
  return perms;
}

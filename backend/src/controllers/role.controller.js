import { Role, PERMISSIONS } from "../models/Role.js";
import { User } from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";

function slugifyKey(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s-]+/g, "_")
    .slice(0, 40);
}

export const roleMeta = asyncHandler(async (req, res) => {
  res.json({ success: true, permissions: PERMISSIONS });
});

export const listRoles = asyncHandler(async (req, res) => {
  const roles = await Role.find().sort({ isSystem: -1, createdAt: 1 });
  const counts = await User.aggregate([{ $group: { _id: "$role", count: { $sum: 1 } } }]);
  const countMap = counts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {});
  res.json({
    success: true,
    data: roles.map((r) => ({ ...r.toObject(), userCount: countMap[r.key] || 0 })),
  });
});

export const getRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) {
    res.status(404);
    throw new Error("Role not found");
  }
  res.json({ success: true, data: role });
});

export const createRole = asyncHandler(async (req, res) => {
  const { name, description, permissions = [] } = req.body;
  if (!name) {
    res.status(400);
    throw new Error("Role name is required");
  }
  const key = slugifyKey(req.body.key || name);
  if (!key) {
    res.status(400);
    throw new Error("Invalid role key");
  }
  const exists = await Role.findOne({ key });
  if (exists) {
    res.status(409);
    throw new Error(`A role with key "${key}" already exists`);
  }

  const role = await Role.create({
    key,
    name,
    description,
    permissions: (permissions || []).filter((p) => PERMISSIONS.includes(p)),
    isSystem: false,
    createdBy: req.user._id,
  });
  await recordAudit(req, "role.create", "Role", role._id, { key });
  res.status(201).json({ success: true, data: role });
});

export const updateRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) {
    res.status(404);
    throw new Error("Role not found");
  }

  if (req.body.name !== undefined) role.name = req.body.name;
  if (req.body.description !== undefined) role.description = req.body.description;

  if (req.body.permissions !== undefined) {
    if (role.key === "super_admin") {
      res.status(400);
      throw new Error("Super Admin permissions cannot be changed");
    }
    role.permissions = (req.body.permissions || []).filter((p) => PERMISSIONS.includes(p));
  }

  await role.save();
  await recordAudit(req, "role.update", "Role", role._id);
  res.json({ success: true, data: role });
});

export const deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) {
    res.status(404);
    throw new Error("Role not found");
  }
  if (role.isSystem) {
    res.status(400);
    throw new Error("System roles cannot be deleted");
  }
  const usersWithRole = await User.countDocuments({ role: role.key });
  if (usersWithRole > 0) {
    res.status(400);
    throw new Error(`Cannot delete: ${usersWithRole} user(s) still use this role`);
  }
  await role.deleteOne();
  await recordAudit(req, "role.delete", "Role", role._id, { key: role.key });
  res.json({ success: true, message: "Role deleted" });
});

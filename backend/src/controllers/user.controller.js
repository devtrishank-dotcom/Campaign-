import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { User, PERMISSIONS } from "../models/User.js";
import { Role } from "../models/Role.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { ownerValue } from "../utils/scope.js";
import { THEME_KEYS } from "../config/themes.js";
import { getBrandingFor, notifyEmail } from "../services/notify.js";
import { ENV } from "../config/env.js";

const TENANT_ADMIN_ROLES = ["super_admin", "admin"];

// Roles the actor is allowed to assign. Only super_admin can create admins/super admins.
async function assignableRoleKeys(actor) {
  const roles = await Role.find().select("key");
  const keys = roles.map((r) => r.key);
  if (actor.role === "super_admin") return keys;
  return keys.filter((k) => !TENANT_ADMIN_ROLES.includes(k));
}

// Which tenant a newly created user belongs to.
function tenantIdFor(actor, role) {
  if (actor.role === "super_admin") {
    // admins/super admins are their own tenant root; others created by super admin are global
    return null;
  }
  return ownerValue(actor);
}

// Filter that limits a non-super user to their own tenant (+ themselves).
function tenantUserFilter(actor) {
  if (actor.role === "super_admin") return {};
  const v = ownerValue(actor);
  return { $or: [{ tenantId: v }, { _id: v }] };
}

async function canManage(actor, target) {
  if (actor.role === "super_admin") return true;
  const v = String(ownerValue(actor));
  return String(target.tenantId || "") === v || String(target._id) === v;
}

export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find(tenantUserFilter(req.user)).sort({ createdAt: -1 });
  res.json({ success: true, data: users.map((u) => u.toSafeJSON()) });
});

export const meta = asyncHandler(async (req, res) => {
  const assignable = await assignableRoleKeys(req.user);
  const roles = await Role.find({ key: { $in: assignable } }).sort({ isSystem: -1, createdAt: 1 });
  res.json({
    success: true,
    roles: roles.map((r) => ({ key: r.key, name: r.name })),
    permissions: PERMISSIONS,
    themes: THEME_KEYS,
    isSuperAdmin: req.user.role === "super_admin",
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role = "manager", extraPermissions = [], theme = "" } = req.body;
  if (!name || !email || !password) {
    res.status(400);
    throw new Error("name, email and password are required");
  }
  if (theme && !THEME_KEYS.includes(theme)) {
    res.status(400);
    throw new Error("Unknown theme");
  }

  const assignable = await assignableRoleKeys(req.user);
  if (!assignable.includes(role)) {
    res.status(403);
    throw new Error(`You are not allowed to assign the role "${role}"`);
  }

  const exists = await User.findOne({ email: String(email).toLowerCase() });
  if (exists) {
    res.status(409);
    throw new Error("A user with this email already exists");
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    extraPermissions: (extraPermissions || []).filter((p) => PERMISSIONS.includes(p)),
    tenantId: tenantIdFor(req.user, role),
    theme,
    createdBy: req.user._id,
  });

  await recordAudit(req, "user.create", "User", user._id, { email, role });

  // Best-effort welcome email with the login credentials
  const owner = ownerValue(req.user);
  const branding = await getBrandingFor(owner);
  await notifyEmail(
    owner,
    email,
    `Your ${branding.companyName} account`,
    `Hello ${name},\n\nYour account has been created on ${branding.companyName}.\n\nLogin: ${ENV.PUBLIC_BASE_URL}\nEmail: ${email}\nPassword: ${password}\nRole: ${role}\n\nPlease sign in and change your password.`
  );

  res.status(201).json({ success: true, data: user.toSafeJSON() });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  if (!(await canManage(req.user, user))) {
    res.status(403);
    throw new Error("You can only manage users in your own account");
  }

  const { name, role, isActive, extraPermissions, password, theme } = req.body;

  if (theme !== undefined && theme && !THEME_KEYS.includes(theme)) {
    res.status(400);
    throw new Error("Unknown theme");
  }

  if (user.role === "super_admin" && role && role !== "super_admin") {
    const superCount = await User.countDocuments({ role: "super_admin", isActive: true });
    if (superCount <= 1) {
      res.status(400);
      throw new Error("Cannot demote the last active super admin");
    }
  }

  if (name !== undefined) user.name = name;
  if (role !== undefined) {
    const assignable = await assignableRoleKeys(req.user);
    if (!assignable.includes(role)) {
      res.status(403);
      throw new Error(`You are not allowed to assign the role "${role}"`);
    }
    user.role = role;
  }
  if (isActive !== undefined) user.isActive = isActive;
  if (extraPermissions !== undefined) {
    user.extraPermissions = (extraPermissions || []).filter((p) => PERMISSIONS.includes(p));
  }
  if (theme !== undefined) user.theme = theme || "";
  if (password) user.password = password;

  await user.save();
  await recordAudit(req, "user.update", "User", user._id, { role: user.role, isActive: user.isActive });
  res.json({ success: true, data: user.toSafeJSON() });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  if (String(user._id) === String(req.user._id)) {
    res.status(400);
    throw new Error("You cannot delete your own account");
  }
  if (!(await canManage(req.user, user))) {
    res.status(403);
    throw new Error("You can only manage users in your own account");
  }
  if (user.role === "super_admin") {
    const superCount = await User.countDocuments({ role: "super_admin" });
    if (superCount <= 1) {
      res.status(400);
      throw new Error("Cannot delete the last super admin");
    }
  }

  await user.deleteOne();
  await recordAudit(req, "user.delete", "User", user._id, { email: user.email });
  res.json({ success: true, message: "User deleted" });
});

// ---------- Import / Export / Template ----------

const EXPORT_HEADERS = ["name", "email", "role", "isActive", "lastLoginAt", "createdAt"];

function userToRow(u) {
  return [
    u.name,
    u.email,
    u.role,
    u.isActive ? "true" : "false",
    u.lastLoginAt ? new Date(u.lastLoginAt).toISOString() : "",
    u.createdAt ? new Date(u.createdAt).toISOString() : "",
  ];
}

function csvEscape(value) {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function sendWorkbook(res, filename, headers, rows, format) {
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Users");
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((col) => {
      col.width = 24;
    });
    const buffer = await wb.xlsx.writeBuffer();
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
    return res.send(Buffer.from(buffer));
  }

  const lines = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))];
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
  return res.send(lines.join("\n"));
}

export const exportUsers = asyncHandler(async (req, res) => {
  const format = req.query.format === "xlsx" ? "xlsx" : "csv";
  const users = await User.find(tenantUserFilter(req.user)).sort({ createdAt: -1 });
  await sendWorkbook(res, "users", EXPORT_HEADERS, users.map(userToRow), format);
});

export const userTemplate = asyncHandler(async (req, res) => {
  const format = req.query.format === "csv" ? "csv" : "xlsx";
  const headers = ["name", "email", "password", "role"];
  const rows = [
    ["John Doe", "john@example.com", "Secret@123", "manager"],
    ["Jane Smith", "jane@example.com", "Secret@123", "viewer"],
  ];
  await sendWorkbook(res, "users-template", headers, rows, format);
});

async function parseRowsFromFile(file) {
  const name = file.originalname.toLowerCase();
  const isXlsx =
    name.endsWith(".xlsx") ||
    file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  if (isXlsx) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(file.buffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];
    const headerRow = ws.getRow(1).values.slice(1).map((h) => String(h || "").trim());
    const rows = [];
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      const vals = row.values.slice(1);
      const obj = {};
      headerRow.forEach((h, i) => {
        if (h) obj[h] = vals[i];
      });
      if (Object.values(obj).some((v) => v !== undefined && v !== null && String(v).trim() !== "")) {
        rows.push(obj);
      }
    });
    return rows;
  }

  return parse(file.buffer.toString("utf8"), {
    columns: (header) => header.map((h) => String(h).trim()),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    bom: true,
  });
}

export const importUsers = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("A .csv or .xlsx file is required (field name: file)");
  }

  let records;
  try {
    records = await parseRowsFromFile(req.file);
  } catch (err) {
    res.status(400);
    throw new Error(`Could not read file: ${err.message}`);
  }

  const assignable = await assignableRoleKeys(req.user);
  const assignableSet = new Set(assignable);
  const tenantId = tenantIdFor(req.user);
  let created = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < records.length; i += 1) {
    const raw = records[i];
    const lower = {};
    for (const [k, v] of Object.entries(raw)) lower[String(k).toLowerCase().trim()] = v;

    const name = String(lower.name || "").trim();
    const email = String(lower.email || "").trim().toLowerCase();
    const password = String(lower.password || "").trim();
    const role = String(lower.role || "manager").trim() || "manager";

    if (!email || !password) {
      skipped += 1;
      continue;
    }
    if (!assignableSet.has(role)) {
      errors.push({ row: i + 2, message: `Role "${role}" not allowed` });
      continue;
    }

    const exists = await User.findOne({ email });
    if (exists) {
      skipped += 1;
      continue;
    }

    try {
      await User.create({ name: name || email, email, password, role, tenantId, createdBy: req.user._id });
      created += 1;
    } catch (err) {
      errors.push({ row: i + 2, message: err.message });
    }
  }

  await recordAudit(req, "user.import", "User", "", { created, skipped });
  res.json({
    success: true,
    summary: { totalRows: records.length, created, skipped, failed: errors.length },
    errors: errors.slice(0, 50),
  });
});

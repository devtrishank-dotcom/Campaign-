import { User } from "../models/User.js";
import { signToken } from "../middleware/auth.js";
import { hydratePermissions } from "../services/permissions.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { THEME_KEYS } from "../config/themes.js";

// Effective theme = own theme, else the tenant admin's theme, else default ("")
async function effectiveTheme(user) {
  if (user.theme) return user.theme;
  if (user.tenantId) {
    const admin = await User.findById(user.tenantId).select("theme");
    if (admin?.theme) return admin.theme;
  }
  return "";
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const user = await User.findOne({ email: String(email).toLowerCase() }).select("+password");
  if (!user || !(await user.comparePassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error("Your account has been disabled");
  }

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  await hydratePermissions(user);
  req.user = user;
  await recordAudit(req, "auth.login", "User", user._id);

  res.json({
    success: true,
    token: signToken(user),
    user: user.toSafeJSON(),
    permissions: user.permissions(),
    theme: await effectiveTheme(user),
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: req.user.toSafeJSON(),
    permissions: req.user.permissions(),
    theme: await effectiveTheme(req.user),
  });
});

export const updateTheme = asyncHandler(async (req, res) => {
  const { theme } = req.body;
  if (theme && !THEME_KEYS.includes(theme)) {
    res.status(400);
    throw new Error("Unknown theme");
  }
  req.user.theme = theme || "";
  await req.user.save();
  res.json({ success: true, theme: req.user.theme });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error("currentPassword and newPassword are required");
  }
  if (String(newPassword).length < 6) {
    res.status(400);
    throw new Error("New password must be at least 6 characters");
  }

  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.comparePassword(currentPassword))) {
    res.status(401);
    throw new Error("Current password is incorrect");
  }
  user.password = newPassword;
  await user.save();

  await recordAudit(req, "auth.change_password", "User", user._id);
  res.json({ success: true, message: "Password updated" });
});

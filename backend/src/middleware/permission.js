export const requirePermission = (...perms) => (req, res, next) => {
  if (!req.user) {
    res.status(401);
    return next(new Error("Not authorized"));
  }
  const ok = perms.some((p) => req.user.hasPermission(p));
  if (!ok) {
    res.status(403);
    return next(new Error(`Forbidden: missing permission (${perms.join(" or ")})`));
  }
  next();
};

export const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    res.status(403);
    return next(new Error("Forbidden: insufficient role"));
  }
  next();
};

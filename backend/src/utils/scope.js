// Multi-tenant scoping helpers.
//
// super_admin  -> sees everything (no owner filter)
// admin        -> owns a tenant; owner value = their own _id
// sub-user     -> owner value = their admin's _id (user.tenantId)
//
// Every data document stores `owner` = the tenant id, so a tenant only ever
// sees the documents it created.

export function ownerValue(user) {
  if (!user) return null;
  if (user.role === "super_admin") return null;
  return user.tenantId || user._id;
}

// Mongo filter fragment to scope queries to the user's tenant
export function ownerFilter(user) {
  const v = ownerValue(user);
  return v ? { owner: v } : {};
}

// Merge the owner onto a document payload at creation time
export function withOwner(user, doc = {}) {
  const v = ownerValue(user);
  return v ? { ...doc, owner: v } : { ...doc };
}

// Does the actor belong to the same tenant as the target document/user?
export function isSameTenant(actor, targetOwner) {
  if (!actor) return false;
  if (actor.role === "super_admin") return true;
  const v = ownerValue(actor);
  return String(v) === String(targetOwner || "");
}

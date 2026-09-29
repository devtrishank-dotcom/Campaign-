import { TemplateCategory, DEFAULT_CATEGORIES } from "../models/TemplateCategory.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { ownerFilter, withOwner, ownerValue } from "../utils/scope.js";

// Seed the default categories the first time a tenant opens the list.
async function ensureDefaults(user) {
  const owner = ownerValue(user);
  const count = await TemplateCategory.countDocuments({ owner });
  if (count > 0) return;
  const docs = DEFAULT_CATEGORIES.map((name) => withOwner(user, { name, createdBy: user._id }));
  try {
    await TemplateCategory.insertMany(docs, { ordered: false });
  } catch {
    // ignore race conditions on unique index
  }
}

export const listCategories = asyncHandler(async (req, res) => {
  await ensureDefaults(req.user);
  const data = await TemplateCategory.find(ownerFilter(req.user)).sort({ name: 1 });
  res.json({ success: true, data });
});

export const createCategory = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) {
    res.status(400);
    throw new Error("Category name is required");
  }
  const existing = await TemplateCategory.findOne({ name, ...ownerFilter(req.user) });
  if (existing) {
    res.status(409);
    throw new Error(`Category "${name}" already exists`);
  }
  const category = await TemplateCategory.create(withOwner(req.user, { name, createdBy: req.user._id }));
  await recordAudit(req, "category.create", "TemplateCategory", category._id, { name });
  res.status(201).json({ success: true, data: category });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const category = await TemplateCategory.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  const name = String(req.body.name || "").trim();
  if (!name) {
    res.status(400);
    throw new Error("Category name is required");
  }
  const clash = await TemplateCategory.findOne({ name, _id: { $ne: category._id }, ...ownerFilter(req.user) });
  if (clash) {
    res.status(409);
    throw new Error(`Category "${name}" already exists`);
  }
  category.name = name;
  await category.save();
  await recordAudit(req, "category.update", "TemplateCategory", category._id, { name });
  res.json({ success: true, data: category });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const category = await TemplateCategory.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  await category.deleteOne();
  await recordAudit(req, "category.delete", "TemplateCategory", category._id, { name: category.name });
  res.json({ success: true, message: "Category deleted" });
});

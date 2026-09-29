import { ContactList } from "../models/ContactList.js";
import { Contact } from "../models/Contact.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { ownerFilter, withOwner } from "../utils/scope.js";

export const listLists = asyncHandler(async (req, res) => {
  const lists = await ContactList.find(ownerFilter(req.user)).sort({ createdAt: -1 });
  res.json({ success: true, data: lists });
});

export const getList = asyncHandler(async (req, res) => {
  const list = await ContactList.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!list) {
    res.status(404);
    throw new Error("List not found");
  }
  res.json({ success: true, data: list });
});

export const createList = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400);
    throw new Error("name is required");
  }
  const list = await ContactList.create(withOwner(req.user, { name, description, createdBy: req.user._id }));
  await recordAudit(req, "list.create", "ContactList", list._id, { name });
  res.status(201).json({ success: true, data: list });
});

export const updateList = asyncHandler(async (req, res) => {
  const list = await ContactList.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!list) {
    res.status(404);
    throw new Error("List not found");
  }
  if (req.body.name !== undefined) list.name = req.body.name;
  if (req.body.description !== undefined) list.description = req.body.description;
  await list.save();
  await recordAudit(req, "list.update", "ContactList", list._id);
  res.json({ success: true, data: list });
});

export const deleteList = asyncHandler(async (req, res) => {
  const list = await ContactList.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!list) {
    res.status(404);
    throw new Error("List not found");
  }
  await Contact.updateMany({ lists: list._id, ...ownerFilter(req.user) }, { $pull: { lists: list._id } });
  await list.deleteOne();
  await recordAudit(req, "list.delete", "ContactList", list._id);
  res.json({ success: true, message: "List deleted" });
});

export const addContactsToList = asyncHandler(async (req, res) => {
  const { contactIds = [] } = req.body;
  const list = await ContactList.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!list) {
    res.status(404);
    throw new Error("List not found");
  }
  await Contact.updateMany(
    { _id: { $in: contactIds }, ...ownerFilter(req.user) },
    { $addToSet: { lists: list._id } }
  );
  list.contactCount = await Contact.countDocuments({ lists: list._id });
  await list.save();
  res.json({ success: true, data: list });
});

export const removeContactFromList = asyncHandler(async (req, res) => {
  const { contactId } = req.params;
  const list = await ContactList.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!list) {
    res.status(404);
    throw new Error("List not found");
  }
  await Contact.updateOne(
    { _id: contactId, ...ownerFilter(req.user) },
    { $pull: { lists: list._id } }
  );
  list.contactCount = await Contact.countDocuments({ lists: list._id });
  await list.save();
  res.json({ success: true, data: list });
});

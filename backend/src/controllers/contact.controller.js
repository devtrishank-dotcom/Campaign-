import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { Contact } from "../models/Contact.js";
import { ContactList } from "../models/ContactList.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { ownerFilter, withOwner, ownerValue } from "../utils/scope.js";
import { getSendingSettings } from "../models/AppSetting.js";

async function defaultCountryCode(user) {
  const settings = await getSendingSettings(ownerValue(user));
  return settings.defaultCountryCode || "+91";
}

const KNOWN = ["name", "email", "phone", "whatsapp", "countrycode", "tags", "status", "source"];

async function refreshListCounts(listIds = []) {
  for (const id of listIds) {
    const count = await Contact.countDocuments({ lists: id });
    await ContactList.findByIdAndUpdate(id, { contactCount: count });
  }
}

export const listContacts = asyncHandler(async (req, res) => {
  const { q, listId, tag, status, page = 1, limit = 25 } = req.query;
  const filter = { ...ownerFilter(req.user) };
  if (listId) filter.lists = listId;
  if (tag) filter.tags = tag;
  if (status) filter.status = status;
  if (q) {
    const re = new RegExp(String(q).trim(), "i");
    filter.$or = [{ name: re }, { email: re }, { phone: re }, { whatsapp: re }];
  }

  const pageNum = Math.max(1, Number(page));
  const lim = Math.min(200, Math.max(1, Number(limit)));

  const [data, total] = await Promise.all([
    Contact.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * lim)
      .limit(lim),
    Contact.countDocuments(filter),
  ]);

  res.json({ success: true, data, total, page: pageNum, pages: Math.ceil(total / lim) });
});

export const getContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!contact) {
    res.status(404);
    throw new Error("Contact not found");
  }
  res.json({ success: true, data: contact });
});

export const createContact = asyncHandler(async (req, res) => {
  const { name, email, phone, whatsapp, countryCode, tags, lists, customFields } = req.body;
  if (!email && !phone) {
    res.status(400);
    throw new Error("At least an email or phone is required");
  }

  const or = [];
  if (email) or.push({ email: String(email).toLowerCase() });
  if (phone) or.push({ phone });
  if (or.length) {
    const existing = await Contact.findOne({ $or: or, ...ownerFilter(req.user) });
    if (existing) {
      res.status(409);
      throw new Error(
        `A contact with this ${existing.email === String(email).toLowerCase() ? "email" : "phone"} already exists`
      );
    }
  }

  const contact = await Contact.create(
    withOwner(req.user, {
      name,
      email,
      phone,
      whatsapp,
      countryCode: countryCode || (await defaultCountryCode(req.user)),
      tags: tags || [],
      lists: lists || [],
      customFields: customFields || {},
      source: "manual",
      createdBy: req.user._id,
    })
  );
  if (lists?.length) await refreshListCounts(lists);
  await recordAudit(req, "contact.create", "Contact", contact._id, { email, phone });
  res.status(201).json({ success: true, data: contact });
});

export const updateContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!contact) {
    res.status(404);
    throw new Error("Contact not found");
  }
  const fields = ["name", "email", "phone", "whatsapp", "countryCode", "tags", "lists", "status", "customFields"];
  const prevLists = (contact.lists || []).map(String);
  for (const f of fields) if (req.body[f] !== undefined) contact[f] = req.body[f];
  await contact.save();
  await refreshListCounts([...new Set([...prevLists, ...(contact.lists || []).map(String)])]);
  await recordAudit(req, "contact.update", "Contact", contact._id);
  res.json({ success: true, data: contact });
});

export const deleteContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!contact) {
    res.status(404);
    throw new Error("Contact not found");
  }
  const lists = (contact.lists || []).map(String);
  await contact.deleteOne();
  await refreshListCounts(lists);
  await recordAudit(req, "contact.delete", "Contact", contact._id);
  res.json({ success: true, message: "Contact deleted" });
});

export const bulkDeleteContacts = asyncHandler(async (req, res) => {
  const { ids = [] } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400);
    throw new Error("ids array is required");
  }
  const scope = ownerFilter(req.user);
  const contacts = await Contact.find({ _id: { $in: ids }, ...scope });
  const listIds = new Set();
  contacts.forEach((c) => (c.lists || []).forEach((l) => listIds.add(String(l))));
  const result = await Contact.deleteMany({ _id: { $in: ids }, ...scope });
  await refreshListCounts([...listIds]);
  await recordAudit(req, "contact.bulk_delete", "Contact", "", { count: result.deletedCount });
  res.json({ success: true, deleted: result.deletedCount });
});

export const importContacts = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("CSV file is required (field name: file)");
  }

  const listIds = req.body.listIds
    ? String(req.body.listIds)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const extraTags = req.body.tags
    ? String(req.body.tags)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  let records;
  try {
    records = parse(req.file.buffer.toString("utf8"), {
      columns: (header) => header.map((h) => String(h).trim()),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      bom: true,
    });
  } catch (err) {
    res.status(400);
    throw new Error(`Invalid CSV: ${err.message}`);
  }

  const defaultCc = await defaultCountryCode(req.user);
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < records.length; i += 1) {
    const row = records[i];
    const lower = {};
    for (const [k, v] of Object.entries(row)) lower[String(k).toLowerCase().trim()] = v;

    const email = (lower.email || "").toString().trim().toLowerCase();
    const phone = (lower.phone || lower.mobile || lower.contact || "").toString().trim();
    if (!email && !phone) {
      skipped += 1;
      continue;
    }

    const tagsFromCsv = (lower.tags || "")
      .toString()
      .split(/[|;,]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const tags = Array.from(new Set([...tagsFromCsv, ...extraTags]));

    const customFields = {};
    for (const [k, v] of Object.entries(lower)) {
      if (!KNOWN.includes(k) && v !== undefined && v !== "") customFields[k] = String(v);
    }

    const scope = ownerFilter(req.user);
    const query = email ? { email } : { phone };
    let existing = await Contact.findOne({ ...query, ...scope });
    if (!existing && email && phone) {
      existing = await Contact.findOne({ $or: [{ email }, { phone }], ...scope });
    }

    try {
      if (existing) {
        if (email) existing.email = email;
        if (phone) existing.phone = phone;
        if (lower.name) existing.name = lower.name;
        if (lower.whatsapp) existing.whatsapp = lower.whatsapp;
        if (lower.countrycode) existing.countryCode = lower.countrycode;
        existing.tags = Array.from(new Set([...(existing.tags || []), ...tags]));
        existing.customFields = { ...(existing.customFields || {}), ...customFields };
        existing.lists = Array.from(new Set([...(existing.lists || []).map(String), ...listIds]));
        await existing.save();
        updated += 1;
      } else {
        await Contact.create(
          withOwner(req.user, {
            name: lower.name || "",
            email,
            phone,
            whatsapp: lower.whatsapp || phone,
            countryCode: lower.countrycode || defaultCc,
            tags,
            lists: listIds,
            customFields,
            source: "csv_import",
            createdBy: req.user._id,
          })
        );
        created += 1;
      }
    } catch (err) {
      errors.push({ row: i + 2, message: err.message });
    }
  }

  if (listIds.length) await refreshListCounts(listIds);
  await recordAudit(req, "contact.import", "Contact", "", { created, updated, skipped });

  res.json({
    success: true,
    summary: { totalRows: records.length, created, updated, skipped, failed: errors.length },
    errors: errors.slice(0, 50),
  });
});

export const contactTags = asyncHandler(async (req, res) => {
  const tags = await Contact.distinct("tags", ownerFilter(req.user));
  res.json({ success: true, data: tags.filter(Boolean).sort() });
});

export const contactDefaults = asyncHandler(async (req, res) => {
  const cc = await defaultCountryCode(req.user);
  res.json({ success: true, data: { defaultCountryCode: cc } });
});

// ---------- Export / Template ----------

const EXPORT_HEADERS = ["name", "email", "phone", "whatsapp", "countryCode", "tags", "status", "source", "createdAt"];

function csvEscape(value) {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function sendWorkbook(res, filename, headers, rows, format) {
  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Contacts");
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r));
    ws.columns.forEach((col) => {
      col.width = 22;
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

export const exportContacts = asyncHandler(async (req, res) => {
  const format = req.query.format === "xlsx" ? "xlsx" : "csv";
  const { listId, tag, status } = req.query;
  const filter = { ...ownerFilter(req.user) };
  if (listId) filter.lists = listId;
  if (tag) filter.tags = tag;
  if (status) filter.status = status;

  const contacts = await Contact.find(filter).sort({ createdAt: -1 }).lean();
  const rows = contacts.map((c) => [
    c.name || "",
    c.email || "",
    c.phone || "",
    c.whatsapp || "",
    c.countryCode || "",
    (c.tags || []).join("|"),
    c.status || "",
    c.source || "",
    c.createdAt ? new Date(c.createdAt).toISOString() : "",
  ]);

  await recordAudit(req, "contact.export", "Contact", "", { count: contacts.length, format });
  await sendWorkbook(res, "contacts", EXPORT_HEADERS, rows, format);
});

export const contactTemplate = asyncHandler(async (req, res) => {
  const format = req.query.format === "xlsx" ? "xlsx" : "csv";
  const headers = ["name", "email", "phone", "whatsapp", "countryCode", "tags"];
  const rows = [
    ["John Doe", "john@example.com", "9876543210", "9876543210", "+91", "voter|ward-1"],
    ["Jane Smith", "jane@example.com", "9876500000", "", "+91", "voter"],
  ];
  await sendWorkbook(res, "contacts-template", headers, rows, format);
});

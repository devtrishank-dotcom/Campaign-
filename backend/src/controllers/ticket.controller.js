import { Ticket, TICKET_STATUS, TICKET_PRIORITY } from "../models/Ticket.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordAudit } from "../utils/audit.js";
import { ownerValue, ownerFilter } from "../utils/scope.js";
import { getBrandingFor, notifyEmail } from "../services/notify.js";

async function nextTicketNo(owner) {
  const last = await Ticket.findOne({ owner }).sort({ ticketNo: -1 }).select("ticketNo");
  return (last?.ticketNo || 0) + 1;
}

export const ticketMeta = asyncHandler(async (req, res) => {
  res.json({ success: true, statuses: TICKET_STATUS, priorities: TICKET_PRIORITY });
});

export const createTicket = asyncHandler(async (req, res) => {
  const { subject, message, category = "general", priority = "normal" } = req.body;
  if (!subject || !message) {
    res.status(400);
    throw new Error("subject and message are required");
  }
  const owner = ownerValue(req.user);

  const ticket = await Ticket.create({
    ticketNo: await nextTicketNo(owner),
    subject,
    message,
    category,
    priority: TICKET_PRIORITY.includes(priority) ? priority : "normal",
    requester: req.user._id,
    requesterName: req.user.name,
    requesterEmail: req.user.email,
    owner,
  });

  // Notify the company (platform) email about the new ticket
  const branding = await getBrandingFor(owner);
  if (branding.companyEmail) {
    await notifyEmail(
      owner,
      branding.companyEmail,
      `New ticket #${ticket.ticketNo}: ${subject}`,
      `A new support ticket was raised.\n\n#${ticket.ticketNo} - ${subject}\nFrom: ${req.user.name} <${req.user.email}>\nPriority: ${ticket.priority}\n\n${message}`
    );
  }

  await recordAudit(req, "ticket.create", "Ticket", ticket._id, { ticketNo: ticket.ticketNo });
  res.status(201).json({ success: true, data: ticket });
});

export const myTickets = asyncHandler(async (req, res) => {
  const data = await Ticket.find({ requester: req.user._id }).sort({ createdAt: -1 });
  res.json({ success: true, data });
});

export const listTickets = asyncHandler(async (req, res) => {
  const { status, priority, q, page = 1, limit = 25 } = req.query;
  const filter = { ...ownerFilter(req.user) };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (q) filter.subject = new RegExp(String(q).trim(), "i");

  const pageNum = Math.max(1, Number(page));
  const lim = Math.min(200, Math.max(1, Number(limit)));

  const [data, total] = await Promise.all([
    Ticket.find(filter).sort({ createdAt: -1 }).skip((pageNum - 1) * lim).limit(lim),
    Ticket.countDocuments(filter),
  ]);
  res.json({ success: true, data, total, page: pageNum, pages: Math.ceil(total / lim) });
});

export const ticketStats = asyncHandler(async (req, res) => {
  const counts = await Ticket.aggregate([
    { $match: ownerFilter(req.user) },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const byStatus = counts.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {});
  res.json({ success: true, byStatus });
});

async function findAccessible(req) {
  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return { error: 404 };
  const isStaff = req.user.hasPermission("tickets.manage");
  if (!isStaff && String(ticket.requester) !== String(req.user._id)) return { error: 403 };
  if (isStaff && req.user.role !== "super_admin" && String(ticket.owner || "") !== String(ownerValue(req.user))) {
    return { error: 403 };
  }
  return { ticket, isStaff };
}

export const getTicket = asyncHandler(async (req, res) => {
  const { ticket, isStaff, error } = await findAccessible(req);
  if (error) {
    res.status(error);
    throw new Error(error === 404 ? "Ticket not found" : "Forbidden");
  }
  res.json({ success: true, data: ticket, isStaff });
});

export const replyTicket = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message) {
    res.status(400);
    throw new Error("message is required");
  }
  const { ticket, isStaff, error } = await findAccessible(req);
  if (error) {
    res.status(error);
    throw new Error(error === 404 ? "Ticket not found" : "Forbidden");
  }
  if (ticket.status === "closed") {
    res.status(400);
    throw new Error("This ticket is closed. Reopen it to reply.");
  }

  ticket.replies.push({
    author: req.user._id,
    authorName: req.user.name,
    isStaff,
    message,
  });
  if (isStaff && ticket.status === "open") ticket.status = "in_progress";
  await ticket.save();

  // Notify the other side
  const branding = await getBrandingFor(ticket.owner);
  if (isStaff) {
    await notifyEmail(
      ticket.owner,
      ticket.requesterEmail,
      `Re: Ticket #${ticket.ticketNo} - ${ticket.subject}`,
      `${branding.companyName} replied:\n\n${message}`
    );
  } else if (branding.companyEmail) {
    await notifyEmail(
      ticket.owner,
      branding.companyEmail,
      `Re: Ticket #${ticket.ticketNo} - ${ticket.subject}`,
      `${req.user.name} replied:\n\n${message}`
    );
  }

  await recordAudit(req, "ticket.reply", "Ticket", ticket._id);
  res.json({ success: true, data: ticket });
});

export const closeTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!ticket) {
    res.status(404);
    throw new Error("Ticket not found");
  }
  ticket.status = "closed";
  ticket.closedAt = new Date();
  ticket.closedBy = req.user._id;
  await ticket.save();
  await recordAudit(req, "ticket.close", "Ticket", ticket._id);
  res.json({ success: true, data: ticket });
});

export const reopenTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findOne({ _id: req.params.id, ...ownerFilter(req.user) });
  if (!ticket) {
    res.status(404);
    throw new Error("Ticket not found");
  }
  ticket.status = "open";
  ticket.closedAt = null;
  ticket.closedBy = null;
  await ticket.save();
  await recordAudit(req, "ticket.reopen", "Ticket", ticket._id);
  res.json({ success: true, data: ticket });
});

import { Contact } from "../models/Contact.js";
import { ContactList } from "../models/ContactList.js";
import { Template } from "../models/Template.js";
import { Campaign } from "../models/Campaign.js";
import { Survey } from "../models/Survey.js";
import { SurveyResponse } from "../models/SurveyResponse.js";
import { User } from "../models/User.js";
import { AuditLog } from "../models/AuditLog.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ownerFilter, ownerValue } from "../utils/scope.js";

export const overview = asyncHandler(async (req, res) => {
  const scope = ownerFilter(req.user);
  const userScope = req.user.role === "super_admin" ? {} : { tenantId: ownerValue(req.user) };

  const [
    contacts,
    lists,
    templates,
    campaigns,
    surveys,
    responses,
    users,
    recentCampaigns,
    campaignAgg,
    channelAgg,
  ] = await Promise.all([
    Contact.countDocuments(scope),
    ContactList.countDocuments(scope),
    Template.countDocuments({ status: "active", ...scope }),
    Campaign.countDocuments(scope),
    Survey.countDocuments(scope),
    SurveyResponse.countDocuments(scope),
    User.countDocuments({ isActive: true, ...userScope }),
    Campaign.find(scope).sort({ createdAt: -1 }).limit(5).select("name channel status stats createdAt"),
    Campaign.aggregate([
      { $match: scope },
      {
        $group: {
          _id: null,
          sent: { $sum: "$stats.sent" },
          delivered: { $sum: "$stats.delivered" },
          failed: { $sum: "$stats.failed" },
          opened: { $sum: "$stats.opened" },
          clicked: { $sum: "$stats.clicked" },
          total: { $sum: "$stats.total" },
        },
      },
    ]),
    Campaign.aggregate([{ $match: scope }, { $group: { _id: "$channel", count: { $sum: 1 } } }]),
  ]);

  const agg = campaignAgg[0] || { sent: 0, delivered: 0, failed: 0, opened: 0, clicked: 0, total: 0 };
  delete agg._id;

  res.json({
    success: true,
    counts: { contacts, lists, templates, campaigns, surveys, responses, users },
    messageStats: agg,
    channelBreakdown: channelAgg.reduce((acc, c) => ({ ...acc, [c._id]: c.count }), {}),
    recentCampaigns,
  });
});

export const auditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 30, action } = req.query;
  const filter = { ...ownerFilter(req.user) };
  if (action) filter.action = new RegExp(String(action).trim(), "i");

  const pageNum = Math.max(1, Number(page));
  const lim = Math.min(200, Math.max(1, Number(limit)));

  const [data, total] = await Promise.all([
    AuditLog.find(filter)
      .populate("actor", "name email")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * lim)
      .limit(lim),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ success: true, data, total, page: pageNum, pages: Math.ceil(total / lim) });
});

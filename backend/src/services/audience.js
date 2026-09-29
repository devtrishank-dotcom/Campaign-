import crypto from "crypto";
import { CampaignRecipient } from "../models/CampaignRecipient.js";
import { Contact } from "../models/Contact.js";

const newTrackingId = () => crypto.randomBytes(12).toString("hex");

export async function buildAudience(campaign) {
  const query = { status: "subscribed" };
  if (campaign.owner) query.owner = campaign.owner;
  if (campaign.lists?.length) query.lists = { $in: campaign.lists };

  const contacts = await Contact.find(query).select(
    "name email phone whatsapp countryCode customFields tags"
  );

  const seen = new Set();
  const unique = [];
  for (const c of contacts) {
    const key =
      campaign.channel === "email"
        ? (c.email || "").toLowerCase()
        : (c.whatsapp || c.phone || "").replace(/\D/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  return unique;
}

// Build CampaignRecipient documents for a campaign (only once).
// Returns the number of recipients that exist after this call.
export async function ensureRecipients(campaign) {
  const existing = await CampaignRecipient.countDocuments({ campaign: campaign._id });
  if (existing > 0) return existing;

  const contacts = await buildAudience(campaign);
  if (contacts.length === 0) return 0;

  const docs = contacts.map((c) => ({
    campaign: campaign._id,
    owner: campaign.owner || null,
    contact: c._id,
    channel: campaign.channel,
    trackingId: newTrackingId(),
    to: {
      email: c.email || "",
      phone: c.whatsapp || c.phone || "",
      name: c.name || "",
    },
    status: "pending",
  }));

  await CampaignRecipient.insertMany(docs, { ordered: false });

  campaign.stats.total = docs.length;
  campaign.stats.pending = docs.length;
  campaign.stats.sent = 0;
  campaign.stats.failed = 0;
  campaign.stats.delivered = 0;
  campaign.stats.opened = 0;
  campaign.stats.clicked = 0;
  await campaign.save();

  return docs.length;
}

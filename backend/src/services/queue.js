import { Campaign } from "../models/Campaign.js";
import { CampaignRecipient } from "../models/CampaignRecipient.js";
import { Contact } from "../models/Contact.js";
import { ENV } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { renderTemplate, buildContactVars } from "../utils/render.js";
import { sendMessage } from "./providerService.js";
import { getSendingSettings, isWithinSendWindow } from "../models/AppSetting.js";

const queue = [];
const running = new Set();
let pumping = false;

const SEND_DELAY_MS = Number(process.env.SEND_DELAY_MS || 250);
const MAX_CONCURRENT_CAMPAIGNS = Number(process.env.MAX_CONCURRENT_CAMPAIGNS || 2);
const MAX_SEND_RETRIES = Number(process.env.MAX_SEND_RETRIES || 2);
const RETRY_BACKOFF_MS = Number(process.env.RETRY_BACKOFF_MS || 3000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function trackingUrls(trackingId) {
  const base = ENV.PUBLIC_BASE_URL;
  return {
    openUrl: `${base}/t/open/${trackingId}.gif`,
    clickBase: `${base}/t/click/${trackingId}`,
    unsubscribeUrl: `${base}/t/unsubscribe/${trackingId}`,
  };
}

function wrapLinks(html, clickBase) {
  if (!html) return html;
  return html.replace(/href=["'](https?:\/\/[^"']+)["']/gi, (m, url) => {
    if (url.includes("/t/click/")) return m;
    return `href="${clickBase}?url=${encodeURIComponent(url)}"`;
  });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getDailySentCount(owner = null) {
  const filter = {
    sentAt: { $gte: startOfToday() },
    status: { $in: ["sent", "delivered", "opened", "clicked"] },
  };
  if (owner) filter.owner = owner;
  return CampaignRecipient.countDocuments(filter);
}

export function enqueueCampaign(campaignId) {
  const id = String(campaignId);
  if (running.has(id) || queue.includes(id)) return;
  queue.push(id);
  logger.info(`Campaign ${id} added to queue (queue size: ${queue.length})`);
  pump();
}

function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (queue.length > 0 && running.size < MAX_CONCURRENT_CAMPAIGNS) {
      const campaignId = queue.shift();
      running.add(campaignId);
      processCampaign(campaignId)
        .catch((err) => logger.error(`Campaign ${campaignId} error: ${err.message}`))
        .finally(() => {
          running.delete(campaignId);
          pump();
        });
    }
  } finally {
    pumping = false;
  }
}

async function pauseWithReason(campaignId, reason) {
  await Campaign.updateOne({ _id: campaignId }, { status: "paused", pausedReason: reason });
  logger.info(`Campaign ${campaignId} paused: ${reason}`);
}

async function processCampaign(campaignId) {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) return;
  if (!["queued", "running", "paused"].includes(campaign.status)) return;

  if (!campaign.startedAt) campaign.startedAt = new Date();
  campaign.status = "running";
  campaign.pausedReason = "";
  await campaign.save();

  logger.info(`Starting campaign "${campaign.name}" (${campaign._id})`);

  const BATCH = 50;
  let hasMore = true;

  while (hasMore) {
    const fresh = await Campaign.findById(campaignId).select("status");
    if (!fresh || ["paused", "cancelled"].includes(fresh.status)) {
      logger.info(`Campaign ${campaignId} ${fresh?.status}. Stopping worker.`);
      return;
    }

    // Sending rules: window + daily limit
    const settings = await getSendingSettings(campaign.owner || null);
    const win = isWithinSendWindow(settings);
    if (!win.open) {
      await pauseWithReason(campaignId, win.reason);
      return;
    }
    if (settings.dailyLimit > 0) {
      const sentToday = await getDailySentCount(campaign.owner || null);
      if (sentToday >= settings.dailyLimit) {
        await pauseWithReason(campaignId, `Daily limit reached (${settings.dailyLimit})`);
        return;
      }
    }

    const recipients = await CampaignRecipient.find({ campaign: campaignId, status: "pending" })
      .limit(BATCH)
      .populate("contact");

    if (recipients.length === 0) {
      hasMore = false;
      break;
    }

    for (const recipient of recipients) {
      const stillFresh = await Campaign.findById(campaignId).select("status");
      if (!stillFresh || ["paused", "cancelled"].includes(stillFresh.status)) return;

      // Re-check daily limit inside the batch
      if (settings.dailyLimit > 0) {
        const sentToday = await getDailySentCount(campaign.owner || null);
        if (sentToday >= settings.dailyLimit) {
          await pauseWithReason(campaignId, `Daily limit reached (${settings.dailyLimit})`);
          return;
        }
      }

      await sendOne(campaign, recipient);
      await sleep(SEND_DELAY_MS);
    }
  }

  await Campaign.updateOne({ _id: campaignId }, { status: "completed", completedAt: new Date() });
  logger.info(`Campaign "${campaign.name}" completed`);
}

async function attemptSend(campaign, recipient, payload) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_SEND_RETRIES + 1; attempt += 1) {
    try {
      return await sendMessage(payload);
    } catch (err) {
      lastErr = err;
      logger.warn(`Attempt ${attempt} failed for ${recipient._id}: ${err.message}`);
      if (attempt <= MAX_SEND_RETRIES) await sleep(RETRY_BACKOFF_MS * attempt);
    }
  }
  throw lastErr;
}

async function sendOne(campaign, recipient) {
  const contact = recipient.contact || {};
  const { openUrl, clickBase, unsubscribeUrl } = trackingUrls(recipient.trackingId);

  const extra = {
    survey_link: "",
    unsubscribe_link: unsubscribeUrl,
    open_url: openUrl,
  };
  if (campaign.survey && typeof campaign.survey === "object" && campaign.survey.slug) {
    extra.survey_link = `${ENV.PUBLIC_BASE_URL}/s/${campaign.survey.slug}?t=${recipient.trackingId}`;
  }

  const vars = buildContactVars(contact, extra);

  const to =
    campaign.channel === "email"
      ? recipient.to.email
      : recipient.to.phone || recipient.to.email;

  if (!to) {
    await CampaignRecipient.findByIdAndUpdate(recipient._id, {
      status: "failed",
      error: "No destination address for channel",
    });
    await Campaign.updateOne({ _id: campaign._id }, { $inc: { "stats.failed": 1, "stats.pending": -1 } });
    return;
  }

  try {
    let renderedSubject = "";
    let renderedBody = "";
    let renderedHtml = "";
    const headers = {};

    if (campaign.channel === "email") {
      renderedSubject = renderTemplate(campaign.subject || "", vars);
      renderedHtml = renderTemplate(campaign.html || "", vars);
      renderedBody = renderTemplate(campaign.body || "", vars);
      headers["List-Unsubscribe"] = `<${unsubscribeUrl}>`;
      headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";

      if (renderedHtml) {
        renderedHtml = wrapLinks(renderedHtml, clickBase);
        renderedHtml += `<img src="${openUrl}" width="1" height="1" alt="" style="display:none" />`;
      } else {
        renderedBody += `\n\n${unsubscribeUrl}`;
      }
    } else {
      renderedBody = renderTemplate(campaign.body || "", vars);
      if (campaign.survey) renderedBody += `\n${extra.survey_link}`;
    }

    const result = await attemptSend(campaign, recipient, {
      channel: campaign.channel,
      to,
      subject: renderedSubject,
      html: renderedHtml || undefined,
      text: renderedBody,
      message: renderedBody,
      templateName: campaign.whatsappTemplateName,
      language: campaign.whatsappLanguage,
      headers,
      owner: campaign.owner || null,
    });

    await CampaignRecipient.findByIdAndUpdate(recipient._id, {
      status: "sent",
      sentAt: new Date(),
      attempts: (recipient.attempts || 0) + 1,
      renderedSubject,
      renderedBody: renderedHtml || renderedBody,
      providerMessageId: result?.providerMessageId || "",
      error: "",
    });

    await Campaign.updateOne(
      { _id: campaign._id },
      { $inc: { "stats.sent": 1, "stats.pending": -1 } }
    );

    if (contact?._id) {
      await Contact.updateOne({ _id: contact._id }, { lastContactedAt: new Date() });
    }
  } catch (err) {
    logger.warn(`Send failed for recipient ${recipient._id}: ${err.message}`);
    await CampaignRecipient.findByIdAndUpdate(recipient._id, {
      status: "failed",
      attempts: (recipient.attempts || 0) + 1,
      error: err.message,
    });
    await Campaign.updateOne(
      { _id: campaign._id },
      { $inc: { "stats.failed": 1, "stats.pending": -1 } }
    );
  }
}

// Resume campaigns that were left mid-flight after a restart
export async function resumePendingCampaigns() {
  const stuck = await Campaign.find({ status: { $in: ["queued", "running"] } }).select("_id name");
  if (stuck.length) {
    logger.info(`Resuming ${stuck.length} campaign(s) after restart`);
    stuck.forEach((c) => enqueueCampaign(c._id));
  }
}

export function queueStats() {
  return { queueLength: queue.length, running: Array.from(running) };
}

import { Campaign } from "../models/Campaign.js";
import { CampaignRecipient } from "../models/CampaignRecipient.js";
import { getSendingSettings, isWithinSendWindow } from "../models/AppSetting.js";
import { enqueueCampaign } from "./queue.js";
import { ensureRecipients } from "./audience.js";
import { logger } from "../utils/logger.js";

const INTERVAL_MS = Number(process.env.SCHEDULER_INTERVAL_MS || 30000);
let timer = null;

async function getDailySentCount() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return CampaignRecipient.countDocuments({
    sentAt: { $gte: d },
    status: { $in: ["sent", "delivered", "opened", "clicked"] },
  });
}

async function tick() {
  try {
    // 1) Start scheduled campaigns that are due (and approved if approval required)
    const due = await Campaign.find({
      status: "scheduled",
      scheduledAt: { $ne: null, $lte: new Date() },
    });

    for (const c of due) {
      const needsApproval = c.approval?.required && c.approval?.status !== "approved";
      if (needsApproval) continue;

      const recipients = await ensureRecipients(c);
      if (recipients === 0) {
        c.status = "failed";
        c.pausedReason = "No reachable contacts found";
        await c.save();
        logger.warn(`Scheduled campaign "${c.name}" has no reachable contacts -> failed`);
        continue;
      }

      c.status = "queued";
      c.pausedReason = "";
      await c.save();
      logger.info(`Scheduled campaign "${c.name}" is due -> queued`);
      enqueueCampaign(c._id);
    }

    // 2) Auto-resume campaigns paused by sending rules (window / daily limit)
    const pausedByRules = await Campaign.find({
      status: "paused",
      pausedReason: { $in: [/^Outside send window/, /^Daily limit/] },
    });

    if (pausedByRules.length) {
      const cache = new Map();
      for (const c of pausedByRules) {
        const owner = c.owner || null;
        const cacheKey = String(owner || "global");
        if (!cache.has(cacheKey)) {
          const settings = await getSendingSettings(owner);
          const win = isWithinSendWindow(settings);
          const sentToday = settings.dailyLimit > 0 ? await getDailySentCount(owner) : 0;
          cache.set(cacheKey, { settings, win, sentToday });
        }
        const { settings, win, sentToday } = cache.get(cacheKey);
        const limitOk = settings.dailyLimit === 0 || sentToday < settings.dailyLimit;
        if (!(win.open && limitOk)) continue;

        c.status = "queued";
        c.pausedReason = "";
        await c.save();
        logger.info(`Auto-resuming campaign "${c.name}"`);
        enqueueCampaign(c._id);
      }
    }
  } catch (err) {
    logger.warn(`Scheduler tick error: ${err.message}`);
  }
}

export function startScheduler() {
  if (timer) return;
  timer = setInterval(tick, INTERVAL_MS);
  if (timer.unref) timer.unref();
  logger.info(`Scheduler started (every ${INTERVAL_MS}ms)`);
  // run once shortly after boot
  setTimeout(tick, 3000);
}

export function stopScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}

// ---------------------------------------------------------------------------
// Analytics tracking — called from proxy for public page views
// ---------------------------------------------------------------------------

import { createDb } from "@/lib/db";
import { hashIp } from "@/lib/hash";
import { detectBot, parseDevice } from "@/models/analytics";
import { recordPageView } from "@/data/analytics";

export interface TrackPageViewInput {
  path: string;
  userAgent: string | null;
  ip: string | null;
  referrer: string | null;
  country: string | null;
  city: string | null;
}

/**
 * Track a page view asynchronously. Fire-and-forget — errors are logged
 * but never thrown to avoid blocking the response.
 */
export async function trackPageView(input: TrackPageViewInput): Promise<void> {
  try {
    const workerUrl = process.env.WORKER_URL;
    const workerSecret = process.env.WORKER_SECRET;
    if (!workerUrl || !workerSecret) return;

    const db = createDb(workerUrl, workerSecret);

    const bot = detectBot(input.userAgent);
    const device = parseDevice(input.userAgent);
    const ipHash = input.ip ? await hashIp(input.ip) : null;

    await recordPageView(db, {
      path: input.path,
      referrer: input.referrer,
      userAgent: input.userAgent,
      ipHash,
      country: input.country,
      city: input.city,
      deviceType: device.deviceType,
      browser: device.browser,
      os: device.os,
      isBot: bot.isBot,
      botName: bot.botName,
      botCategory: bot.botCategory,
    });
  } catch (err) {
    // Never let analytics tracking break the user experience
    console.error("Analytics tracking error:", err);
  }
}

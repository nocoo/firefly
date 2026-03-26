// ---------------------------------------------------------------------------
// Bot detection and classification from User-Agent strings
// ---------------------------------------------------------------------------

import type { BotCategory, DeviceType } from "./types";

export interface BotInfo {
  isBot: boolean;
  botName: string | null;
  botCategory: BotCategory | null;
}

export interface DeviceInfo {
  deviceType: DeviceType;
  browser: string | null;
  os: string | null;
}

// ---------------------------------------------------------------------------
// Known bot patterns: [regex, name, category]
// ---------------------------------------------------------------------------

const BOT_PATTERNS: [RegExp, string, BotCategory][] = [
  // Search engines
  [/googlebot/i, "Googlebot", "search"],
  [/bingbot/i, "Bingbot", "search"],
  [/yandexbot/i, "YandexBot", "search"],
  [/baiduspider/i, "Baiduspider", "search"],
  [/duckduckbot/i, "DuckDuckBot", "search"],
  [/sogou/i, "Sogou", "search"],
  [/yisou/i, "YisouSpider", "search"],
  [/slurp/i, "Yahoo! Slurp", "search"],

  // AI crawlers
  [/gptbot/i, "GPTBot", "ai"],
  [/chatgpt-user/i, "ChatGPT-User", "ai"],
  [/claude-web/i, "ClaudeBot", "ai"],
  [/claudebot/i, "ClaudeBot", "ai"],
  [/anthropic-ai/i, "Anthropic", "ai"],
  [/cohere-ai/i, "Cohere", "ai"],
  [/perplexitybot/i, "PerplexityBot", "ai"],
  [/bytespider/i, "Bytespider", "ai"],
  [/ccbot/i, "CCBot", "ai"],
  [/google-extended/i, "Google-Extended", "ai"],

  // Social media
  [/facebookexternalhit/i, "Facebook", "social"],
  [/twitterbot/i, "Twitterbot", "social"],
  [/linkedinbot/i, "LinkedInBot", "social"],
  [/slackbot/i, "Slackbot", "social"],
  [/telegrambot/i, "TelegramBot", "social"],
  [/whatsapp/i, "WhatsApp", "social"],
  [/discordbot/i, "DiscordBot", "social"],

  // Monitoring
  [/uptimerobot/i, "UptimeRobot", "monitor"],
  [/pingdom/i, "Pingdom", "monitor"],
  [/statuscake/i, "StatusCake", "monitor"],
  [/site24x7/i, "Site24x7", "monitor"],

  // Generic bot patterns (last resort)
  [/bot\b/i, "Unknown Bot", "other"],
  [/crawler/i, "Unknown Crawler", "other"],
  [/spider/i, "Unknown Spider", "other"],
  [/scraper/i, "Unknown Scraper", "other"],
  [/headless/i, "Headless Browser", "other"],
];

/**
 * Detect if a User-Agent string belongs to a bot and classify it.
 */
export function detectBot(userAgent: string | null): BotInfo {
  if (!userAgent) {
    return { isBot: false, botName: null, botCategory: null };
  }

  for (const [pattern, name, category] of BOT_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { isBot: true, botName: name, botCategory: category };
    }
  }

  return { isBot: false, botName: null, botCategory: null };
}

/**
 * Parse device type, browser, and OS from User-Agent.
 * Lightweight — not a full UA parser, just enough for analytics.
 */
export function parseDevice(userAgent: string | null): DeviceInfo {
  if (!userAgent) {
    return { deviceType: "desktop", browser: null, os: null };
  }

  // Check bot first
  const bot = detectBot(userAgent);
  if (bot.isBot) {
    return { deviceType: "bot", browser: null, os: null };
  }

  // Device type
  let deviceType: DeviceType = "desktop";
  if (/tablet|ipad/i.test(userAgent)) {
    deviceType = "tablet";
  } else if (/mobile|iphone|android.*mobile/i.test(userAgent)) {
    deviceType = "mobile";
  }

  // Browser
  let browser: string | null = null;
  if (/edg\//i.test(userAgent)) browser = "Edge";
  else if (/opr\//i.test(userAgent) || /opera/i.test(userAgent))
    browser = "Opera";
  else if (/chrome\//i.test(userAgent) && !/edg/i.test(userAgent))
    browser = "Chrome";
  else if (/safari\//i.test(userAgent) && !/chrome/i.test(userAgent))
    browser = "Safari";
  else if (/firefox\//i.test(userAgent)) browser = "Firefox";

  // OS (order matters: check iOS/Android before macOS/Linux)
  let os: string | null = null;
  if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/android/i.test(userAgent)) os = "Android";
  else if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os/i.test(userAgent)) os = "macOS";
  else if (/linux/i.test(userAgent)) os = "Linux";

  return { deviceType, browser, os };
}

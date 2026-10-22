#!/usr/bin/env bun
/**
 * Capture podcast card inside journal article layout with live his.fm /api/card.
 * Requires Next on 7028 (WORKER_URL/SECRET for root layout) and Playwright.
 * Set SCREENSHOT_CAPTURE=true on the dev server to hide the Next dev indicator.
 */
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const OUT = resolve("/workspace/docs/images/podcast-card");
const BASE = process.env.SCREENSHOT_BASE ?? "http://localhost:7028";
const EPISODE = process.env.SCREENSHOT_EPISODE ?? "ep03";

mkdirSync(OUT, { recursive: true });

async function shot(
  page: import("playwright").Page,
  dark: boolean,
  mobile: boolean,
) {
  const width = mobile ? 390 : 1280;
  await page.setViewportSize({ width, height: mobile ? 844 : 900 });
  await page.emulateMedia({ colorScheme: dark ? "dark" : "light" });
  if (dark) {
    await page.evaluate(() => {
      document.documentElement.classList.add("dark");
    });
  } else {
    await page.evaluate(() => {
      document.documentElement.classList.remove("dark");
    });
  }
  await page.goto(`${BASE}/podcast-post-preview?episode=${EPISODE}`, {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.waitForSelector(".podcast-card", { timeout: 30_000 });
  await page.waitForFunction(() => {
    const img = document.querySelector(
      ".podcast-card-cover",
    ) as HTMLImageElement | null;
    return img?.complete && img.naturalWidth > 0;
  });
  await page.waitForTimeout(400);
  const suffix = mobile ? "mobile" : "desktop";
  const theme = dark ? "dark" : "light";
  const article = page.locator(".journal-article-layout");
  await article.screenshot({
    path: resolve(OUT, `podcast-post-${suffix}-${theme}.png`),
  });
}

const browser = await chromium.launch();
const page = await browser.newPage();
await shot(page, false, false);
await shot(page, true, false);
await shot(page, false, true);
await shot(page, true, true);
await browser.close();
console.log(`Saved screenshots under ${OUT}`);

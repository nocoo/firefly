#!/usr/bin/env bun
/**
 * Capture podcast card inside journal article layout with live his.fm /api/card.
 * Requires Next on 7028 (WORKER_URL/SECRET for root layout) and Playwright.
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
  await page.setViewportSize(
    mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
  );
  await page.emulateMedia({ colorScheme: dark ? "dark" : "light" });
  await page.goto(
    `${BASE}/podcast-post-preview?episode=${EPISODE}`,
    { waitUntil: "networkidle", timeout: 60_000 },
  );
  await page.waitForSelector(".podcast-card", { timeout: 30_000 });
  await page.waitForFunction(() => {
    const img = document.querySelector(".podcast-card-cover") as HTMLImageElement | null;
    return img?.complete && img.naturalWidth > 0;
  });
  const suffix = mobile ? "mobile" : "desktop";
  const theme = dark ? "dark" : "light";
  await page.screenshot({
    path: resolve(OUT, `podcast-post-${suffix}-${theme}.png`),
    fullPage: false,
  });
}

const browser = await chromium.launch();
const page = await browser.newPage();
await shot(page, false, false);
await shot(page, true, false);
await shot(page, false, true);
await browser.close();
console.log(`Saved screenshots under ${OUT}`);

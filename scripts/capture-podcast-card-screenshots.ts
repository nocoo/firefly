#!/usr/bin/env bun
/**
 * Renders the podcast card fixture HTML and saves light/dark/mobile screenshots.
 * No Worker/DB — uses Playwright setContent with journal + podcast CSS.
 */
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { mockHisFmCardPayload } from "../src/lib/hisfm/fixtures";
import { parseHisFmCardPayload } from "../src/lib/hisfm/card-schema";
import { buildPodcastCardViewModel } from "../src/models/podcast-card-vm";

const OUT = resolve("/opt/cursor/artifacts/screenshots");
mkdirSync(OUT, { recursive: true });

const card = parseHisFmCardPayload(mockHisFmCardPayload());
if (!card) throw new Error("fixture card invalid");
const model = buildPodcastCardViewModel(card);

const journalCss = readFileSync(
  resolve("src/app/(blog)/journal.css"),
  "utf-8",
);
const podcastCss = readFileSync(
  resolve("src/app/styles/podcast-card.css"),
  "utf-8",
);
const globalsSnippet = `
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
`;

function cardHtml(): string {
  const accent = model.accentColor
    ? `style="--podcast-accent: ${model.accentColor}"`
    : "";
  return `
<div class="blog-shell journal-theme" style="max-width: 36rem; margin: 0 auto; padding: 2rem;">
  <div class="podcast-card" data-has-accent="${model.accentColor ? "true" : "false"}" ${accent}>
    <a href="${model.episodePageUrl}" class="podcast-card-link-hit" target="_blank" rel="noopener">
      <span class="sr-only">${model.title}</span>
    </a>
    <div class="podcast-card-cover-wrap">
      <img class="podcast-card-cover" src="${model.coverUrl}" alt="" width="112" height="112" />
    </div>
    <div class="podcast-card-body">
      <p class="podcast-card-series">${model.seriesLabel ?? ""}</p>
      <h2 class="podcast-card-title">${model.title}</h2>
      <p class="podcast-card-summary">${model.summary ?? ""}</p>
      <div class="podcast-card-player" role="group" aria-label="播客播放器">
        <button type="button" class="podcast-card-play" aria-label="播放">▶</button>
        <div class="podcast-card-progress-wrap">
          <input type="range" class="podcast-card-progress" min="0" max="${model.durationSeconds}" value="420" />
          <span class="podcast-card-time">7:00 / ${model.durationLabel}</span>
        </div>
        <button type="button" class="podcast-card-speed">1x</button>
        <span class="podcast-card-source">his.fm</span>
      </div>
    </div>
  </div>
</div>`;
}

function pageHtml(dark: boolean): string {
  return `<!DOCTYPE html><html class="${dark ? "dark" : ""}"><head><meta charset="utf-8" />
<style>${globalsSnippet}${journalCss}${podcastCss}</style></head><body>${cardHtml()}</body></html>`;
}

const browser = await chromium.launch();
const desktop = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await desktop.setContent(pageHtml(false), { waitUntil: "networkidle" });
await desktop.screenshot({ path: resolve(OUT, "podcast-card-desktop-light.png") });

await desktop.setContent(pageHtml(true), { waitUntil: "networkidle" });
await desktop.screenshot({ path: resolve(OUT, "podcast-card-desktop-dark.png") });

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
});
await mobile.setContent(pageHtml(false), { waitUntil: "networkidle" });
await mobile.screenshot({ path: resolve(OUT, "podcast-card-mobile-light.png") });

await browser.close();
console.log(`Saved screenshots to ${OUT}`);

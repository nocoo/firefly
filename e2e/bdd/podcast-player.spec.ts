import { test, expect } from "./fixtures";
import { readFileSync } from "node:fs";
import type { HisFmPublishedCard } from "../../src/lib/hisfm/card-schema";

const episode = JSON.parse(readFileSync(new URL("../../src/lib/hisfm/fixtures/ep03-published.json", import.meta.url), "utf8")) as HisFmPublishedCard;

const PREVIEW_PATH = "/podcast-post-preview?episode=ep03";

function silentWav(): Buffer {
  const samples = 8_000 * 30;
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8_000, 24);
  wav.writeUInt32LE(16_000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  return wav;
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 768, 1280]) {
    test(`inline player fits ${width}px in ${theme} mode below the article cover`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.goto(PREVIEW_PATH);
      const player = page.locator(".podcast-player");
      await expect(player).toBeVisible();
      await expect(page.locator(".podcast-brand svg")).toHaveCount(2);
      await expect(page.getByRole("slider", { name: "播放进度" })).toBeVisible();
      await expect(page.locator(".podcast-time")).toBeVisible();
      await expect(page.locator(".podcast-speed")).toHaveText("1x");
      await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
      const metrics = await player.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const cover = document.querySelector(".blog-featured-image")!.getBoundingClientRect();
        const body = document.querySelector(".blog-content")!.getBoundingClientRect();
        const style = getComputedStyle(element);
        const visible = [".podcast-play", ".podcast-progress", ".podcast-time", ".podcast-speed", ".podcast-brand"];
        return {
          afterCover: rect.top >= cover.bottom,
          beforeBody: rect.bottom <= body.top,
          fits: element.scrollWidth <= element.clientWidth + 1 && visible.every((selector) => {
            const child = element.querySelector(selector)!.getBoundingClientRect();
            return child.left >= rect.left - 1 && child.right <= rect.right + 1;
          }),
          height: rect.height,
          background: style.backgroundColor,
          border: style.borderTopWidth,
          shadow: style.boxShadow,
          brandColor: getComputedStyle(element.querySelector(".podcast-brand")!).color,
          color: style.color,
          track: getComputedStyle(element.querySelector(".podcast-progress > span")!).backgroundColor,
          mediaImages: element.querySelectorAll("img").length,
        };
      });
      expect(metrics.afterCover).toBe(true);
      expect(metrics.beforeBody).toBe(true);
      expect(metrics.fits).toBe(true);
      expect(metrics.height).toBeLessThanOrEqual(40);
      expect(metrics.background).toBe("rgba(0, 0, 0, 0)");
      expect(metrics.border).toBe("0px");
      expect(metrics.shadow).toBe("none");
      expect(metrics.brandColor).toBe(metrics.color);
      expect(metrics.track).not.toBe("rgba(0, 0, 0, 0)");
      expect(metrics.mediaImages).toBe(0);
    });
  }
}

test("play, pause, seek and speed control real audio without navigating", async ({ page, context }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const wav = silentWav();
  await page.route(episode.audio!.url, (route) => {
    const range = route.request().headers().range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Number(range[2]) : wav.length - 1;
    return route.fulfill({
      status: range ? 206 : 200,
      contentType: "audio/wav",
      headers: {
        "Accept-Ranges": "bytes",
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${wav.length}` } : {}),
      },
      body: wav.subarray(start, end + 1),
    });
  });
  await page.goto(PREVIEW_PATH);
  await expect(page.locator("audio")).toHaveAttribute("preload", "none");
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect(page.getByRole("button", { name: "暂停", exact: true })).toBeVisible();
  await expect.poll(() => page.locator("audio").evaluate((audio) => audio.currentTime)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  expect(await page.locator("audio").evaluate((audio) => audio.paused)).toBe(true);
  for (const speed of [1.5, 2, 1]) {
    await page.locator(".podcast-speed").click();
    expect(await page.locator("audio").evaluate((audio) => audio.playbackRate)).toBe(speed);
  }
  const slider = page.getByRole("slider", { name: "播放进度" });
  await slider.focus();
  await slider.press("End");
  await expect.poll(() => page.locator("audio").evaluate((audio) => audio.currentTime)).toBeGreaterThan(29);
  await slider.press("Home");
  await expect.poll(() => page.locator("audio").evaluate((audio) => audio.currentTime)).toBe(0);
  await expect(page.locator(".podcast-time")).toHaveText("0:00 / 0:30");
  expect(page.url()).toContain(PREVIEW_PATH);
  expect(context.pages()).toHaveLength(1);
  await context.route("https://his.fm/episodes/**", (route) => route.fulfill({ body: "Episode" }));
  const popup = context.waitForEvent("page");
  await page.locator(".podcast-brand").click();
  await expect(await popup).toHaveURL(episode.page_url);
  expect(errors).toEqual([]);
});

test("a failed play request is handled and can be retried", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new Error("Media unavailable"));
  });
  await page.goto(PREVIEW_PATH);
  await page.getByRole("button", { name: "播放", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("音频暂时无法播放");
  await expect(page.getByRole("button", { name: "播放", exact: true })).toBeEnabled();
});

test("missing audio retains only the his.fm brand link", async ({ page }) => {
  await page.goto("/podcast-post-preview?episode=silent");
  await expect(page.locator(".podcast-brand")).toBeVisible();
  await expect(page.locator(".podcast-player button, .podcast-player audio, .podcast-player [role=slider]")).toHaveCount(0);
});

test("articles without a cover keep the player between header and body", async ({ page }) => {
  await page.goto(`${PREVIEW_PATH}&cover=none`);
  await expect(page.locator(".blog-featured-image")).toHaveCount(0);
  expect(await page.locator(".podcast-player").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= document.querySelector(".journal-article-header")!.getBoundingClientRect().bottom
      && rect.bottom <= document.querySelector(".blog-content")!.getBoundingClientRect().top;
  })).toBe(true);
});

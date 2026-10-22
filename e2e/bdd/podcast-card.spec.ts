import { test, expect } from "./fixtures";

const PREVIEW_PATH = "/podcast-post-preview?episode=ep03";

async function assertPodcastCardFitsViewport(
  page: import("@playwright/test").Page,
  width: number,
) {
  await page.setViewportSize({ width, height: 720 });
  await page.goto(PREVIEW_PATH, { waitUntil: "networkidle" });
  const card = page.locator(".podcast-card");
  await expect(card).toBeVisible();
  await expect(page.locator(".podcast-card-time")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const card = document.querySelector(".podcast-card");
    const time = document.querySelector(".podcast-card-time");
    if (!card || !time) return { ok: false };
    const cardRect = card.getBoundingClientRect();
    const timeRect = time.getBoundingClientRect();
    const overflowsCard = card.scrollWidth > card.clientWidth + 1;
    const timeClipped =
      timeRect.right > cardRect.right + 1 ||
      timeRect.left < cardRect.left - 1;
    return {
      ok: !overflowsCard && !timeClipped,
      overflowsCard,
      timeClipped,
    };
  });
  expect(metrics.ok, JSON.stringify(metrics)).toBe(true);
}

async function assertDesktopDescriptionAlignsWithCover(
  page: import("@playwright/test").Page,
) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(PREVIEW_PATH, { waitUntil: "networkidle" });
  await expect(page.locator(".podcast-card-summary")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const cover = document.querySelector(".podcast-card-cover-wrap");
    const summary = document.querySelector(".podcast-card-summary");
    const title = document.querySelector(".podcast-card-title");
    if (!cover || !summary || !title) return { ok: false, reason: "missing" };
    const coverRect = cover.getBoundingClientRect();
    const summaryTop = summary.getBoundingClientRect().top;
    const titleBottom = title.getBoundingClientRect().bottom;
    const withinCoverSpan = summaryTop < coverRect.bottom - 1;
    const tightToTitle = summaryTop <= titleBottom + 20;
    return {
      ok: withinCoverSpan && tightToTitle,
      withinCoverSpan,
      tightToTitle,
      summaryTop,
      coverBottom: coverRect.bottom,
      titleBottom,
    };
  });
  expect(metrics.ok, JSON.stringify(metrics)).toBe(true);
}

test.describe("Feature: his.fm podcast card layout", () => {
  test("Given the preview page, When viewport is 320px or 390px, Then the card does not clip the player time", async ({
    page,
  }) => {
    const probe = await page.goto(PREVIEW_PATH, { waitUntil: "commit" });
    test.skip(probe?.status() === 404, "Preview route disabled in this run");
    for (const width of [320, 390]) {
      await assertPodcastCardFitsViewport(page, width);
    }
  });

  test("Given desktop width, When the card renders, Then the description sits under the title within the cover height", async ({
    page,
  }) => {
    const probe = await page.goto(PREVIEW_PATH, { waitUntil: "commit" });
    test.skip(probe?.status() === 404, "Preview route disabled in this run");
    await assertDesktopDescriptionAlignsWithCover(page);
  });

  test("Given the preview page, When cover srcset is present, Then only allowlisted hosts appear", async ({
    page,
  }) => {
    const probe = await page.goto(PREVIEW_PATH, { waitUntil: "commit" });
    test.skip(probe?.status() === 404, "Preview route disabled in this run");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PREVIEW_PATH, { waitUntil: "networkidle" });
    const srcset = await page
      .locator(".podcast-card-cover")
      .getAttribute("srcset");
    expect(srcset).toBeTruthy();
    const urls = srcset!
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0]);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/(his\.fm|f\.no\.mt)\//);
    }
  });

  test("Given desktop width, When I click the title, Then his.fm opens and play does not navigate", async ({
    page,
    context,
  }) => {
    const probe = await page.goto(PREVIEW_PATH, { waitUntil: "commit" });
    test.skip(probe?.status() === 404, "Preview route disabled in this run");
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(PREVIEW_PATH, { waitUntil: "networkidle" });

    const link = page.locator(".podcast-card-link-hit");
    await expect(link).toHaveAttribute(
      "href",
      /his\.fm\/episodes\/manager-notes\//,
    );

    const title = page.locator(".podcast-card-title");
    const box = await title.boundingBox();
    expect(box).not.toBeNull();
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      page.mouse.click(box!.x + 8, box!.y + 8),
    ]);
    await expect(popup).toHaveURL(/his\.fm\/episodes\//);
    await popup.close();

    const urlBefore = page.url();
    await page.locator(".podcast-card-play").click();
    expect(page.url()).toBe(urlBefore);
  });
});

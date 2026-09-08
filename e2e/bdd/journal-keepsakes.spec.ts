import type { Page } from "@playwright/test";
import { keepsakeIds } from "../../src/lib/journal-keepsake";
import { test, expect } from "./fixtures";

async function chooseKeepsake(page: Page, id: string) {
  await page.addInitScript((choice) => {
    const apply = () => {
      if (!document.documentElement) return false;
      document.documentElement.dataset.keepsake = choice;
      return true;
    };
    if (!apply()) {
      const observer = new MutationObserver(() => { if (apply()) observer.disconnect(); });
      observer.observe(document, { childList: true });
    }
  }, id);
}

test("all four surfaces remain visible in the journal header, including mobile and 404", async ({ page }) => {
  for (const path of ["/", "/a-journal-page-that-does-not-exist"]) {
    await page.goto(path);
    const nav = page.getByRole("navigation", { name: "访问面" });
    await expect(nav.getByRole("link", { name: "Play", exact: true })).toHaveAttribute("href", "https://lizheng.me/");
    await expect(nav.getByRole("link", { name: "Journal", exact: true })).toHaveAttribute("aria-current", "true");
    await expect(nav.getByRole("link", { name: "Résumé", exact: true })).toHaveAttribute("href", "https://lizheng.dev/");
    await expect(nav.getByRole("link", { name: "Portfolio", exact: true })).toHaveAttribute("href", "https://hexly.ai");
    for (const width of [320, 390, 640, 768, 769, 820, 1100, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      for (const link of await nav.getByRole("link").all()) await expect(link).toBeVisible();
      const dimensions = await page.locator(".blog-topbar-inner").evaluate((el) => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }));
      expect(dimensions.width).toBe(Math.min(width, 1500));
      expect(dimensions.height).toBe(width <= 640 ? 108 : width <= 768 ? 72 : 88);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});

for (const id of keepsakeIds) {
  test(`${id}: journal illustration stays fixed through theme changes and client navigation`, async ({ page }, info) => {
    await chooseKeepsake(page, id);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const image = page.locator(".journal-keepsake");
    await expect(image).toHaveAttribute("src", `/journal-keepsakes/${id}.svg`);
    await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(image).toHaveAttribute("aria-hidden", "true");
    for (const width of [1440, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const box = await image.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.x).toBeGreaterThanOrEqual(0);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
      for (let theme = 0; theme < 2; theme++) {
        await page.locator(".journal-theme-toggle").click();
        await expect(image).toHaveAttribute("src", `/journal-keepsakes/${id}.svg`);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { document.documentElement.dataset.navigationSession = "same-document"; });
    await page.locator('.journal-footer a[href="/archive"]').click();
    await expect(page).toHaveURL(/\/archive$/);
    await expect(image).toHaveCount(0);
    await page.locator('.journal-surfaces a[href="/"]').click();
    await expect(image).toHaveAttribute("src", `/journal-keepsakes/${id}.svg`);
    await expect(page.locator("html")).toHaveAttribute("data-navigation-session", "same-document");
    await page.evaluate(() => document.fonts.ready);
    await info.attach(`${id}-journal`, { body: await page.locator(".journal-intro").screenshot({ animations: "disabled" }), contentType: "image/png" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.locator(".journal-intro").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    await page.emulateMedia({ media: "print" });
    await expect(image).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test("the first server-selected illustration survives delayed hydration without an image swap", async ({ page }) => {
  // The previous client-only draw always chose Honda here, replacing the
  // server's Game Boy fallback. A server choice must now remain authoritative.
  await page.addInitScript(() => { Math.random = () => .99; });
  let releaseScripts: () => void = () => {};
  const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve; });
  await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/, async (route) => {
    await scriptsReady;
    await route.continue();
  });
  const requestedImages = new Set<string>();
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/journal-keepsakes/")) requestedImages.add(path);
  });
  try {
    await page.goto("/", { waitUntil: "commit" });
    const image = page.locator(".journal-keepsake");
    await expect(image).toBeVisible();
    const scene = await image.getAttribute("data-keepsake");
    expect(keepsakeIds).toContain(scene);
    const initialSrc = `/journal-keepsakes/${scene}.svg`;
    await expect(image).toHaveAttribute("src", initialSrc);
    await image.evaluate((el) => (el as HTMLImageElement).decode());
    await page.evaluate(() => document.fonts.ready);
    await page.locator(".journal-intro").evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished)));
    const before = await image.boundingBox();

    releaseScripts();
    await expect(page.locator("html")).toHaveAttribute("data-keepsake", scene ?? "");
    await expect(image).toHaveAttribute("src", initialSrc);
    expect(await image.boundingBox()).toEqual(before);
    expect([...requestedImages]).toEqual([initialSrc]);
  } finally {
    releaseScripts();
  }
});

test("a complete selected illustration and surface links are available without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 700 } });
  const page = await context.newPage();
  await page.goto(process.env.E2E_BASE_URL ?? "http://localhost:27028");
  const image = page.locator(".journal-keepsake");
  const scene = await image.getAttribute("data-keepsake");
  expect(keepsakeIds).toContain(scene);
  await expect(image).toHaveAttribute("src", `/journal-keepsakes/${scene}.svg`);
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  for (const link of await page.locator(".journal-surfaces a").all()) await expect(link).toBeVisible();
  await context.close();
});

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { test, expect } from "./fixtures";

const styles = readFileSync("src/app/(blog)/journal.css", "utf8");

function renderArchives(archives: { year: number; month: number; count: number }[]): string {
  // Bun is the project's renderer runtime and resolves Next's package entrypoints.
  return execFileSync("bun", ["-e", `
    import { createElement } from "react";
    import { renderToStaticMarkup } from "react-dom/server";
    import { ArchiveNavigation } from "./src/components/blog/archive-navigation";
    const archives = await Bun.stdin.json();
    process.stdout.write(renderToStaticMarkup(createElement(ArchiveNavigation, { archives })));
  `], { input: JSON.stringify(archives), encoding: "utf8" });
}

test("archives limit the initial list and expand by keyboard without JavaScript", async ({ browser }) => {
  // Render the actual component with isolated data. No DB writes, cached page
  // contents, authentication, or application JavaScript are needed for details.
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await context.route("**/*", (route) => route.abort());
  const page = await context.newPage();
  const year = new Date().getFullYear();
  for (const count of [0, 3, 12, 20]) {
    const archives = Array.from({ length: count }, (_, index) => {
      const date = new Date(Date.UTC(year, 11 - index, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, count: 1 };
    });
    if (count > 12) archives.push({ year: year - 3, month: 2, count: 2 }, { year: year - 3, month: 1, count: 3 });
    const markup = renderArchives(archives);
    await page.setContent(`<!doctype html><html lang="zh-CN"><head><style>${styles}</style></head><body><div class="blog-shell journal-theme" style="padding:24px;width:220px">${markup}</div></body></html>`);
    if (count === 0) {
      await expect(page.getByRole("navigation")).toHaveCount(0);
      continue;
    }
    const archive = page.getByRole("navigation", { name: "归档", exact: true });
    await expect(archive.getByRole("link")).toHaveCount(Math.min(count, 12));
    if (count <= 12) {
      await expect(archive.locator("summary")).toHaveCount(0);
      continue;
    }
    const summary = archive.locator("summary");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(archive.locator("details")).toHaveAttribute("open");
    await expect(archive.getByRole("link")).toHaveCount(21);
    const oldest = archive.getByRole("link").last();
    await expect(oldest).toHaveAttribute("href", `/archive/${year - 3}`);
    await expect(oldest).toContainText("5");
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(archive.locator("details")).not.toHaveAttribute("open");
    await expect(archive.getByRole("link")).toHaveCount(12);
  }
  await context.close();
});


test("the mobile drawer traps focus around collapsed and expanded archives", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const year = new Date().getFullYear();
  const markup = renderArchives(Array.from({ length: 15 }, (_, index) => {
    const date = new Date(Date.UTC(year, 11 - index, 1));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, count: 1 };
  }));
  // Mount actual server-rendered archive markup into the real drawer, so the
  // focus trap is exercised independently of the site's cached archive data.
  await page.locator(".blog-sidebar-bottom").evaluate((el, html) => {
    el.querySelector("#blog-archive-heading")?.closest("nav")?.remove();
    el.insertAdjacentHTML("beforeend", html);
  }, markup);
  await page.getByRole("button", { name: "打开侧边栏" }).click();
  const drawer = page.getByRole("dialog", { name: "Site navigation" });
  await drawer.evaluate(async (el) => {
    await Promise.all(el.getAnimations().map((animation) => animation.finished));
  });
  const first = drawer.locator("a[href], button, input, summary").filter({ visible: true }).first();
  const summary = drawer.locator("summary");
  await summary.focus();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(summary).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(drawer.locator("details")).toHaveAttribute("open");
  const last = drawer.getByRole("link").last();
  await last.focus();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(last).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "打开侧边栏" })).toBeFocused();
});

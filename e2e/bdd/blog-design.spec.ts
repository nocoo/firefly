import { test, expect, seedPostIdempotent } from "./fixtures";

test("connected public surfaces retain standard navigation and a single page title", async ({ page }) => {
  await page.goto("/");
  const surfaces = page.getByRole("navigation", { name: "访问面" });
  await expect(surfaces.getByRole("link", { name: "Journal", exact: true })).toHaveAttribute("href", "/");
  await expect(surfaces.getByRole("link", { name: "Play", exact: true })).toHaveAttribute("href", "https://lizheng.me/");
  await expect(surfaces.getByRole("link", { name: "Résumé", exact: true })).toHaveAttribute("href", "https://lizheng.dev/");
  await expect(page.locator("h1")).toHaveCount(1);
  // Canonical follows the deployment URL; isolated CI uses HTTP on localhost.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href", process.env.AUTH_URL ?? "http://localhost:3000",
  );
  await expect(page.getByRole("link", { name: "RSS", exact: true })).toHaveAttribute("href", "/feed.xml");
});

test("the narrow navigation drawer preserves focus, scroll and document access", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "打开侧边栏" });
  await trigger.click();
  const drawer = page.getByRole("dialog", { name: "Site navigation" });
  await expect(drawer).toBeVisible();
  await expect(page.locator("main")).toHaveAttribute("inert");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  await trigger.click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.locator("main")).not.toHaveAttribute("inert");
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("public theme styles do not change the admin after client navigation", async ({ page }) => {
  await page.goto("/admin");
  const before = await page.locator("body").evaluate((el) => {
    const style = getComputedStyle(el);
    return { font: style.fontFamily, background: style.backgroundColor, foreground: style.color };
  });
  await page.goto("/");
  await expect(page.locator(".journal-theme")).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.locator(".journal-theme")).toHaveCount(0);
  const after = await page.locator("body").evaluate((el) => {
    const style = getComputedStyle(el);
    return { font: style.fontFamily, background: style.backgroundColor, foreground: style.color };
  });
  expect(after).toEqual(before);
});

test("reduced motion and no JavaScript retain the journal and its links", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(process.env.E2E_BASE_URL ?? "http://localhost:27028");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator('.journal-footer a[href="/search"]')).toBeVisible();
  await expect(page.locator('.journal-footer a[href="/llms.txt"]')).toBeVisible();
  expect(await page.locator(".journal-intro").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await page.locator('.journal-footer a[href="/search"]').click();
  await expect(page.locator("main h1")).toHaveText("搜索");
  await page.getByRole("searchbox", { name: "关键词" }).fill("journal");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(page.locator("main h1")).toContainText('搜索 "journal"');
  await context.close();
});


test("long articles keep a readable measure and their current section through jumps and resize", async ({ page }) => {
  // This scenario creates content only inside the project's isolated L3 runner.
  const base = process.env.E2E_BASE_URL ?? "http://localhost:27028";
  expect(new URL(base).origin).toBe("http://localhost:27028");
  expect(process.env.E2E_TEST_RUNNER).toBe("true");
  const slug = `journal-reading-${Date.now()}-${test.info().workerIndex}`;
  const paragraph = "阅读不是扫描。段落需要留出呼吸的空间，让思考有时间发生。标点、行距和文字宽度共同决定长文是否舒适。";
  await seedPostIdempotent(base, {
    slug, title: "A journal for long reads · 长文阅读", status: "published",
    published_at: 1788512400,
    content: ["## Opening", ...Array(8).fill(paragraph), "## Middle", ...Array(8).fill(paragraph),
      "## Closing", ...Array(8).fill(paragraph),
      ["```ts", `const sentence = "${"long ".repeat(70)}";`, "```"].join("\n"),
      ["| First | Second | Third | Fourth |", "| --- | --- | --- | --- |",
        `| ${"wide-column-without-break-".repeat(20)} | Data | Data | Data |`].join("\n")].join("\n\n"),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/2026/09/${slug}`);
  const body = page.locator(".prose-firefly");
  const toc = page.getByRole("navigation", { name: "目录" });
  await expect(toc).toBeVisible();
  await expect(body.locator("table")).toHaveCount(1);
  await expect(body.locator("pre")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);
  expect((await body.boundingBox())?.width).toBeLessThanOrEqual(760);
  const closing = toc.getByRole("link", { name: "Closing", exact: true });
  await closing.click();
  await expect(closing).toHaveAttribute("aria-current", "location");
  const closingHeading = page.getByRole("heading", { name: "Closing", exact: true });
  await expect.poll(async () => {
    const heading = await closingHeading.boundingBox();
    const header = await page.locator(".blog-topbar").boundingBox();
    return heading && header ? heading.y - header.height : -1;
  }).toBeGreaterThanOrEqual(24);
  await page.getByRole("heading", { name: "Middle", exact: true }).evaluate((el) => el.scrollIntoView());
  await expect(toc.getByRole("link", { name: "Middle", exact: true })).toHaveAttribute("aria-current", "location");
  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(toc).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await body.boundingBox())?.width).toBeLessThanOrEqual(760);
  }
});

test("theme changes preserve the journal palette across navigation and reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("theme", "light"));
  await page.reload();
  const toggle = page.locator(".blog-topbar-end button").last();
  await expect(page.locator(".journal-theme")).toHaveCSS("background-color", "rgb(240, 240, 233)");
  await toggle.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".journal-theme")).toHaveCSS("background-color", "rgb(30, 40, 36)");
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#1e2824");
  await page.locator('.journal-footer a[href="/archive"]').click();
  await expect(page).toHaveURL(/\/archive$/);
  await page.reload();
  await expect(page.locator(".journal-theme")).toHaveCSS("background-color", "rgb(30, 40, 36)");
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#1e2824");
});

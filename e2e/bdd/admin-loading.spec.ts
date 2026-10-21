import { test, expect } from "./fixtures";

for (const resource of ["authors", "ai-agents"]) {
  test(`Missing ${resource} retains HTTP 404 before loading can stream`, async ({ page }) => {
    const response = await page.goto(`/admin/${resource}/00000000-0000-0000-0000-000000000000`, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
  });
}

for (const [path, endpoint, title, settledText] of [
  ["/admin", "**/api/analytics?*", "概览", "已发布文章"],
  ["/admin/system", "**/api/system/memory", "系统监控", "刷新"],
] as const) {
  test(`${path} retains its heading while loading real client data`, async ({ page }) => {
    let release = () => {};
    let requested = () => {};
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const arrived = new Promise<void>((resolve) => { requested = resolve; });
    await page.route(endpoint, async (route) => {
      requested();
      await blocked;
      await route.continue();
    });
    try {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await arrived;
      const loading = page.getByRole("status", { name: /加载/ });
      await expect(loading).toBeVisible();
      await expect(loading).toHaveAttribute("aria-busy", "true");
      const header = page.locator("[data-admin-page-header]");
      await expect(header.getByRole("heading", { name: title, exact: true })).toBeVisible();
      await expect(header.getByRole("link", { name: /^返回/ })).toHaveText("");
      release();
      await expect(loading).toBeHidden();
      await expect(page.getByText(settledText, { exact: true })).toBeVisible();
    } finally {
      release();
    }
  });
}

test("Failed analytics loading reveals the error rather than an endless skeleton", async ({ page }) => {
  await page.route("**/api/analytics?*", (route) => route.fulfill({ status: 500, json: { error: "Acceptance failure" } }));
  await page.goto("/admin", { waitUntil: "networkidle" });
  await expect(page.getByText("获取分析数据失败", { exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: /加载/ })).toBeHidden();
  await expect(page.locator("[data-admin-page-header]").getByRole("heading", { name: "概览", exact: true })).toBeVisible();
});

test("Empty media search shows square placeholders and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/media?*", (route) => route.fulfill({ json: { media: [], total: 0 } }));
  await page.goto("/admin/media", { waitUntil: "networkidle" });
  const search = page.getByPlaceholder("搜索文件...", { exact: true });
  await search.fill("empty-skeleton-fixture");
  await expect(page.getByText("无匹配结果", { exact: true })).toBeVisible();
  await page.unroute("**/api/media?*");
  let release = () => {};
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/media?*", async (route) => {
    await blocked;
    await route.fulfill({ json: { media: [], total: 0 } });
  });
  try {
    await search.fill("next-skeleton-fixture");
    const loading = page.getByRole("status", { name: "正在加载媒体库", exact: true });
    await expect(loading).toBeVisible();
    const shimmer = loading.locator(".animate-basalt-shimmer").first();
    await expect(shimmer).toHaveCSS("animation-name", "none");
    const bounds = await shimmer.evaluate((node) => node.parentElement!.getBoundingClientRect().toJSON());
    expect(bounds.width).toBeGreaterThan(30);
    expect(Math.abs(bounds.width - bounds.height)).toBeLessThan(1);
    release();
    await expect(loading).toBeHidden();
    await expect(page.getByText("无匹配结果", { exact: true })).toBeVisible();
  } finally {
    release();
  }
});

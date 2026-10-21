import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";

test("Every admin page has a title, subtitle and icon-only parent link", async ({ page, request }) => {
  test.setTimeout(180_000);
  const slug = `header-${randomUUID()}`;
  const categoryResponse = await request.post("/api/categories", { data: { name: slug, slug } });
  expect(categoryResponse.status()).toBe(201);
  const category = await categoryResponse.json();
  const authorResponse = await request.post("/api/admin/authors", { data: { name: slug, slug } });
  expect(authorResponse.status()).toBe(201);
  const { author } = await authorResponse.json();
  const agentResponse = await request.post("/api/admin/ai-agents", { data: { name: slug, slug, categoryId: category.id } });
  expect(agentResponse.status()).toBe(201);
  const { agent } = await agentResponse.json();
  const postResponse = await request.post("/api/posts", { data: { title: slug, slug, content: "Header acceptance", status: "draft" } });
  expect(postResponse.status()).toBe(201);
  const post = await postResponse.json();

  const routes = [
    ["/admin", "概览", "/"],
    ["/admin/posts", "文章", "/admin"],
    ["/admin/posts/new", "新建文章", "/admin/posts"],
    [`/admin/posts/${post.id}/edit`, "编辑文章", "/admin/posts"],
    ["/admin/categories", "分类", "/admin"],
    ["/admin/tags", "标签", "/admin"],
    ["/admin/media", "媒体库", "/admin"],
    ["/admin/authors", "作者", "/admin"],
    ["/admin/authors/new", "创建作者", "/admin/authors"],
    [`/admin/authors/${author.id}`, "编辑作者", "/admin/authors"],
    ["/admin/ai-agents", "AI 代理", "/admin"],
    ["/admin/ai-agents/new", "创建 AI 代理", "/admin/ai-agents"],
    [`/admin/ai-agents/${agent.id}`, "编辑 AI 代理", "/admin/ai-agents"],
    ["/admin/settings", "设置", "/admin"],
    ["/admin/site-identity", "站点身份", "/admin"],
    ["/admin/ai-settings", "AI 设置", "/admin"],
    ["/admin/mcp", "MCP 令牌", "/admin"],
    ["/admin/backup", "备份", "/admin"],
    ["/admin/system", "系统监控", "/admin"],
  ] as const;
  try {
    for (const [path, title, backHref] of routes) {
      await test.step(path, async () => {
        await page.goto(path, { waitUntil: "networkidle" });
        const header = page.locator("[data-admin-page-header]");
        await expect(header).toHaveCount(1);
        const heading = header.getByRole("heading", { level: 1, name: title, exact: true });
        await expect(heading).toBeVisible();
        await expect(header.locator("header p")).toHaveText(/\S/);
        const back = header.getByRole("link", { name: /^返回/ });
        await expect(back).toHaveCount(1);
        await expect(back).toHaveAttribute("href", backHref);
        await expect(back).toHaveText("");
        await expect(back.locator("svg")).toHaveCount(1);
        const buttonBox = await back.boundingBox();
        const titleBox = await heading.boundingBox();
        expect(buttonBox).not.toBeNull();
        expect(titleBox).not.toBeNull();
        expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(titleBox!.x);
        await back.click();
        await expect(page).toHaveURL(new RegExp(`${backHref}/?$`));
      });
    }
  } finally {
    const cleanup = [
      await request.delete(`/api/posts/${slug}`),
      await request.delete(`/api/admin/ai-agents/${agent.id}`),
      await request.delete(`/api/admin/authors/${author.id}`),
      await request.delete(`/api/categories/${slug}`),
    ];
    for (const response of cleanup) expect(response.status()).toBe(200);
  }
});

for (const width of [390, 1440]) {
  test(`At ${width}px back stays in the title band and filters retain the full left edge`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const [path, label] of [["/admin/posts", "筛选文章"], ["/admin/media", "筛选媒体"]]) {
      await page.goto(path, { waitUntil: "networkidle" });
      const header = page.locator("[data-admin-page-header]");
      const back = header.getByRole("link", { name: /^返回/ });
      const filters = header.getByRole("group", { name: label, exact: true });
      await expect(filters).toBeVisible();
      const outer = await header.boundingBox();
      const filter = await filters.boundingBox();
      const button = await back.boundingBox();
      const subtitle = await header.locator("header p").boundingBox();
      expect(outer).not.toBeNull();
      expect(filter).not.toBeNull();
      expect(button).not.toBeNull();
      expect(subtitle).not.toBeNull();
      expect(Math.abs(filter!.x - outer!.x)).toBeLessThan(1);
      expect(Math.abs(filter!.width - outer!.width)).toBeLessThan(1);
      const content = await page.locator("[data-basalt-island]").evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        return {
          left: bounds.left + node.clientLeft + parseFloat(style.paddingLeft),
          right: bounds.left + node.clientLeft + node.clientWidth - parseFloat(style.paddingRight),
        };
      });
      expect(Math.abs(filter!.x - content.left)).toBeLessThan(1);
      expect(Math.abs(filter!.x + filter!.width - content.right)).toBeLessThan(1);
      expect(button!.y + button!.height).toBeLessThanOrEqual(subtitle!.y + subtitle!.height);
      expect(filter!.y).toBeGreaterThan(subtitle!.y + subtitle!.height);
      await expect(back).toHaveText("");
    }

    await page.goto("/admin/posts?status=draft", { waitUntil: "networkidle" });
    const filters = page.getByRole("group", { name: "筛选文章", exact: true });
    await expect(filters.getByRole("combobox").first()).toHaveText("草稿");
    await page.reload({ waitUntil: "networkidle" });
    await expect(filters.getByRole("combobox").first()).toHaveText("草稿");
    await filters.getByRole("button", { name: "重置", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/posts$/);
    await page.getByRole("link", { name: "新建文章", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/posts\/new$/);
  });
}

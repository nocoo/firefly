import { test, expect } from "./fixtures";

test("published content refreshes after editing and disappears after withdrawal", async ({ page, request }) => {
  const slug = `browser-cache-${crypto.randomUUID()}`;
  const created = await request.post("/api/posts", { data: {
    slug, title: "Browser cache original", content: "Public cache body", status: "published",
  } });
  expect(created.status()).toBe(201);
  const post = await created.json();
  const date = new Date(post.published_at * 1000).toISOString();
  const path = `/${date.slice(0, 4)}/${date.slice(5, 7)}/${slug}`;
  try {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Browser cache original", exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Browser cache original", exact: true })).toBeVisible();
    const updated = await request.put(`/api/posts/${slug}`, { data: { title: "Browser cache edited" } });
    expect(updated.status()).toBe(200);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Browser cache edited", exact: true })).toBeVisible();
    const withdrawn = await request.put(`/api/posts/${slug}`, { data: { status: "private" } });
    expect(withdrawn.status()).toBe(200);
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Browser cache edited", exact: true })).toHaveCount(0);
    expect((await request.get(`/api/posts/${slug}`)).status()).toBe(404);
  } finally {
    await request.delete(`/api/posts/${slug}`);
  }
});

/**
 * L3 E2E: Admin post edit page
 *
 * Covers: /admin/posts/[id]/edit
 *
 * Discovers a real post ID by walking from the admin posts list rather than
 * hardcoding a fixture ID — the seed DB content is not guaranteed. Tests
 * skip themselves when the list is empty. Only UI presence + interactivity
 * is verified here; actual save/update flows live in the L2 API specs.
 */
import { test, expect, type Page } from "@playwright/test";

/** Navigate from the admin posts list to the first post's edit page.
 *  Returns the post ID, or null when the list has no posts. */
async function gotoFirstPostEdit(page: Page): Promise<string | null> {
  await page.goto("/admin/posts", { waitUntil: "networkidle" });

  const editLink = page.locator('a[href*="/admin/posts/"][href$="/edit"]').first();
  if ((await editLink.count()) === 0) return null;

  const href = await editLink.getAttribute("href");
  const match = href?.match(/\/admin\/posts\/([^/]+)\/edit/);
  if (!match) return null;

  await editLink.click();
  await page.waitForURL(/\/admin\/posts\/[^/]+\/edit/, { timeout: 10_000 });
  return match[1] ?? null;
}

test.describe("Admin post edit page", () => {
  test("edit page loads from admin posts list", async ({ page }) => {
    const postId = await gotoFirstPostEdit(page);
    if (postId === null) return;

    await expect(page).toHaveURL(/\/admin\/posts\/[^/]+\/edit/);
  });

  test("edit form pre-fills the title input", async ({ page }) => {
    if ((await gotoFirstPostEdit(page)) === null) return;

    const titleInput = page
      .locator('input[placeholder*="标题"], input[placeholder*="Title"]')
      .first();
    await expect(titleInput).toBeVisible({ timeout: 10_000 });

    // Editing an existing post must hydrate the title field.
    const value = await titleInput.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test("edit form exposes the markdown content editor", async ({ page }) => {
    if ((await gotoFirstPostEdit(page)) === null) return;

    // post-form-content-editor mounts a textarea#content (the underlying
    // CodeMirror surface). Existence is what matters at the UI layer.
    const contentArea = page.locator("textarea#content, textarea").first();
    await expect(contentArea).toBeAttached({ timeout: 10_000 });
  });

  test("edit form exposes category and status selects plus tag controls", async ({
    page,
  }) => {
    if ((await gotoFirstPostEdit(page)) === null) return;

    // Status + category share one row via PostStatusCategoryRow — both render
    // <select> elements with id="status" / id="category".
    await expect(page.locator("select#status")).toBeVisible();
    await expect(page.locator("select#category")).toBeVisible();

    // Tag pills render as buttons under a "标签" label. If the test DB has no
    // tags, PostTagsField renders a "暂无标签" placeholder instead.
    const tagsLabel = page.getByText("标签", { exact: true });
    await expect(tagsLabel).toBeVisible();
  });

  test("edit form has update and delete actions", async ({ page }) => {
    if ((await gotoFirstPostEdit(page)) === null) return;

    await expect(
      page.locator('button[type="submit"]:has-text("更新文章")'),
    ).toBeVisible();
    await expect(
      page.locator('button:has-text("删除文章")'),
    ).toBeVisible();
  });

  test("cancel button navigates back to the posts list", async ({ page }) => {
    if ((await gotoFirstPostEdit(page)) === null) return;

    const cancel = page.locator('button:has-text("取消")').first();
    await expect(cancel).toBeVisible();
    await cancel.click();
    await page.waitForURL(/\/admin\/posts(?!\/[^/]+\/edit)/, { timeout: 10_000 });
  });

  test("non-existent post ID returns 404", async ({ page }) => {
    // 00000000-0000-0000-0000-000000000000 will not match any real post —
    // getPostById returns null and the page fires notFound().
    const response = await page.goto(
      "/admin/posts/00000000-0000-0000-0000-000000000000/edit",
      { waitUntil: "networkidle" },
    );
    expect(response?.status()).toBe(404);
  });
});

import { readFileSync } from "node:fs";
import type { Locator } from "@playwright/test";
import { test, expect } from "./fixtures";

async function expectImageLoaded(image: Locator) {
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element) => {
    const img = element as HTMLImageElement;
    return img.complete && img.naturalWidth > 0;
  })).toBe(true);
}

test("WeChat identity saves uploaded and pasted images and refreshes the responsive sidebar", async ({ page, request }) => {
  const headers = { "x-forwarded-proto": "https" };
  const settings = await (await request.get("/api/settings", { headers })).json();
  const mediaIds: string[] = [];
  try {
    await page.goto("/admin/site-identity");
    await expect(page.getByRole("heading", { name: "微信公众号", exact: true })).toBeVisible();
    await expect(page.getByLabel("二维码图片", { exact: true })).toHaveValue(settings.wechatQrImageUrl);
    const name = `WeChat acceptance ${Date.now()}`;
    await page.getByLabel("公众号名称", { exact: true }).fill(name);
    const uploaded = page.waitForResponse((response) => response.url().endsWith("/api/media") && response.request().method() === "POST");
    await page.getByLabel("选择二维码图片文件").setInputFiles({ name: "wechat-qr.png", mimeType: "image/png", buffer: readFileSync("public/journal-wechat-cat.png") });
    const qr = await (await uploaded).json();
    mediaIds.push(qr.id);
    await expect(page.getByLabel("二维码图片", { exact: true })).toHaveValue(qr.url);
    expect(new URL(qr.url).origin).toBe(new URL(page.url()).origin);
    await expectImageLoaded(page.getByRole("img", { name: "二维码图片预览", exact: true }));

    const pasted = page.waitForResponse((response) => response.url().endsWith("/api/media") && response.request().method() === "POST");
    await page.getByLabel("公众号头像", { exact: true }).evaluate((input, bytes) => {
      const clipboard = new DataTransfer();
      clipboard.items.add(new File([new Uint8Array(bytes)], "wechat-avatar.png", { type: "image/png" }));
      input.dispatchEvent(new ClipboardEvent("paste", { clipboardData: clipboard, bubbles: true, cancelable: true }));
    }, Array.from(readFileSync("public/journal-wechat-cat.png")));
    const avatar = await (await pasted).json();
    mediaIds.push(avatar.id);
    await expect(page.getByLabel("公众号头像", { exact: true })).toHaveValue(avatar.url);
    await expectImageLoaded(page.getByRole("img", { name: "公众号头像预览", exact: true }));
    await page.getByRole("button", { name: "保存设置", exact: true }).click();
    await expect(page.getByText("设置已保存。", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("公众号名称", { exact: true })).toHaveValue(name);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    const card = page.getByRole("region", { name: `微信公众号 ${name}` });
    await expect(card).toBeVisible();
    await expect(card.getByRole("img", { name: `微信公众号「${name}」二维码` })).toHaveAttribute("src", qr.url);
    await expect(card.locator(".journal-wechat-seal img")).toHaveAttribute("src", avatar.url);
    await expectImageLoaded(card.getByRole("img", { name: `微信公众号「${name}」二维码` }));
    await expectImageLoaded(card.locator(".journal-wechat-seal img"));

    const originalCard = { wechat_name: settings.wechatName, wechat_qr_image_url: settings.wechatQrImageUrl, wechat_avatar_url: settings.wechatAvatarUrl };
    expect((await request.put("/api/settings", { headers, data: originalCard })).status()).toBe(200);
    await page.reload();
    const seededCard = page.getByRole("region", { name: `微信公众号 ${settings.wechatName}` });
    await expectImageLoaded(seededCard.locator(".journal-wechat-qr"));
    await expectImageLoaded(seededCard.locator(".journal-wechat-seal img"));
    await seededCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: ".wrangler/wechat-desktop.png" });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await expect(seededCard).toBeVisible();
    await page.screenshot({ path: ".wrangler/wechat-dark.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "打开侧边栏" }).click();
    await expect(seededCard).toBeVisible();
    await seededCard.scrollIntoViewIfNeeded();
    await page.screenshot({ path: ".wrangler/wechat-mobile.png" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "打开侧边栏" })).toBeFocused();
  } finally {
    expect((await request.put("/api/settings", { headers, data: { wechat_name: settings.wechatName, wechat_qr_image_url: settings.wechatQrImageUrl, wechat_avatar_url: settings.wechatAvatarUrl } })).status()).toBe(200);
    for (const id of mediaIds) expect((await request.delete(`/api/media/${id}`, { headers })).status()).toBe(204);
  }
});

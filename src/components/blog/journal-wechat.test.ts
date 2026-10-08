import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JournalWechat } from "./journal-wechat";

const settings = { wechatName: "Configured account", wechatQrImageUrl: "/qr.png", wechatAvatarUrl: "/avatar.png" };

describe("JournalWechat", () => {
  it("renders the configured name, QR image and avatar", () => {
    const html = renderToStaticMarkup(createElement(JournalWechat, settings));
    expect(html).toContain("Configured account");
    expect(html).toContain('src="/qr.png"');
    expect(html).toContain('src="/avatar.png"');
    expect(html).not.toContain("journal-wechat-cat.png");
  });

  it.each([
    { ...settings, wechatName: "" },
    { ...settings, wechatQrImageUrl: "" },
    { ...settings, wechatQrImageUrl: "javascript:bad" },
  ])("hides incomplete or unsafe QR configuration", (value) => {
    expect(renderToStaticMarkup(createElement(JournalWechat, value))).toBe("");
  });

  it.each(["", "data:bad"])("omits a missing or invalid avatar", (wechatAvatarUrl) => {
    const html = renderToStaticMarkup(createElement(JournalWechat, { ...settings, wechatAvatarUrl }));
    expect(html).toContain('src="/qr.png"');
    expect(html).not.toContain("journal-wechat-seal");
  });
});

import { describe, expect, it } from "vitest";
import { isImageUrl, wechatSettingsSchema } from "./wechat";

describe("WeChat image settings", () => {
  it.each(["", "/journal-wechat-qr.svg", "/images/avatar.png?v=2", "https://example.com/qr.png", "http://localhost/avatar.png"])("accepts %s", (value) => {
    expect(isImageUrl(value)).toBe(true);
  });

  it.each(["//example.com/qr.png", "/\\example.com/qr.png", "/image name.png", "javascript:alert(1)", "data:image/png;base64,test", "file:///tmp/qr.png", "not-a-url", "https://user:password@example.com/qr.png"])("rejects %s", (value) => {
    expect(isImageUrl(value)).toBe(false);
  });

  it("validates and trims snake_case boundary fields", () => {
    expect(wechatSettingsSchema.parse({
      wechat_name: " Account ",
      wechat_qr_image_url: " /qr.png ",
      wechat_avatar_url: "",
    })).toEqual({ wechat_name: "Account", wechat_qr_image_url: "/qr.png", wechat_avatar_url: "" });
    expect(wechatSettingsSchema.parse({})).toEqual({});
  });

  it.each([
    { wechat_name: "x".repeat(256) },
    { wechat_name: null },
    { wechat_qr_image_url: "https://example.com/" + "x".repeat(2048) },
    { wechat_avatar_url: 1 },
  ])("rejects invalid field values", (value) => {
    expect(wechatSettingsSchema.safeParse(value).success).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { t, zhCN, type TranslationKey } from "./index";

describe("i18n dictionary (zh-CN)", () => {
  it("returns the translated string for a known key", () => {
    expect(t("theme.toggle.label.system")).toBe("跟随系统");
    expect(t("footer.link.home")).toBe("首页");
    expect(t("admin.page.posts")).toBe("文章");
  });

  it("falls back to default locale for an unknown locale code", () => {
    expect(t("footer.link.home", "fr-FR")).toBe("首页");
  });

  it("returns the key itself for an unknown key (typed casts only)", () => {
    // Cast to satisfy TS — production paths can't call with an unknown key.
    expect(t("not.a.real.key" as TranslationKey)).toBe("not.a.real.key");
  });

  it("every dictionary entry is non-empty", () => {
    for (const [key, value] of Object.entries(zhCN)) {
      expect(value, `empty translation for ${key}`).not.toBe("");
    }
  });
});

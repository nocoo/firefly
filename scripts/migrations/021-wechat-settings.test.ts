import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

describe("021 WeChat settings", () => {
  it("seeds the existing account and assets without changing other settings", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec("CREATE TABLE site_settings (id INTEGER PRIMARY KEY, site_name TEXT, updated_at INTEGER); INSERT INTO site_settings VALUES (1, 'Keep blog name', 0)");
      db.exec(readFileSync(new URL("./021-wechat-settings.sql", import.meta.url), "utf8"));
      expect(db.prepare("SELECT site_name, wechat_name, wechat_qr_image_url, wechat_avatar_url FROM site_settings WHERE id = 1").get()).toEqual({
        site_name: "Keep blog name",
        wechat_name: "不如喝杯咖啡",
        wechat_qr_image_url: "/journal-wechat-qr.svg",
        wechat_avatar_url: "/journal-wechat-cat.png",
      });
      expect(db.prepare("SELECT updated_at FROM site_settings WHERE id = 1").get()?.updated_at).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });
});

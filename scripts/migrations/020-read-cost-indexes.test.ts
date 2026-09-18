import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { TIME_WINDOW_WHERE, PREV_WINDOW_WHERE, EXCLUDE_MONITORS } from "../../src/data/analytics-helpers";

describe("020 read cost indexes and analytics windows", () => {
  it("preserves rows and ordering, supports range scans, and excludes monitor history", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE posts(id TEXT PRIMARY KEY, status TEXT, published_at INTEGER, created_at INTEGER);
        CREATE INDEX idx_posts_status ON posts(status);
        CREATE TABLE page_views(id INTEGER PRIMARY KEY, viewed_at INTEGER, is_bot INTEGER, bot_category TEXT, user_agent TEXT);
        CREATE INDEX idx_page_views_bot ON page_views(is_bot, bot_category);
        CREATE INDEX idx_page_views_time ON page_views(viewed_at);
        INSERT INTO posts VALUES ('old','published',100,100), ('new','published',100,200), ('private','private',300,300);
      `);
      const midnight = db.prepare("SELECT unixepoch('now', 'start of day') AS t").get()?.t as number;
      const insert = db.prepare("INSERT INTO page_views VALUES(?, ?, ?, ?, ?)");
      const day = 86400;
      insert.run(1, midnight - 7 * day, 0, null, null);
      insert.run(2, midnight - 1, 0, null, "Browser");
      insert.run(3, midnight, 0, null, "Browser");
      insert.run(4, midnight - 14 * day, 0, null, "Browser");
      insert.run(5, midnight - 14 * day - 1, 0, null, "Browser");
      insert.run(6, midnight - day, 0, null, "Uptime-Kuma/2.3.2");
      insert.run(7, midnight - day, 1, "monitor", "UptimeRobot/2.0");
      insert.run(8, midnight - day, 1, "search", "Googlebot/2.1");
      const list = "SELECT id FROM posts WHERE status = 'published' ORDER BY published_at DESC, created_at DESC LIMIT 10";
      const before = db.prepare(list).all();
      db.exec(readFileSync(new URL("./020-read-cost-indexes.sql", import.meta.url), "utf8"));
      expect(db.prepare(list).all()).toEqual(before);
      const plan = JSON.stringify(db.prepare(`EXPLAIN QUERY PLAN ${list}`).all());
      expect(plan).toContain("idx_posts_status_published_created");
      expect(plan).not.toContain("TEMP B-TREE");
      expect(db.prepare("SELECT COUNT(*) AS n FROM page_views").get()?.n).toBe(8);
      const current = db.prepare(`SELECT id FROM page_views WHERE ${TIME_WINDOW_WHERE} ORDER BY id`).all(7);
      expect(current.map((row) => row.id)).toEqual([1, 2, 8]);
      expect(db.prepare(`SELECT id FROM page_views WHERE ${PREV_WINDOW_WHERE} ORDER BY id`).all(7, 7).map((row) => row.id)).toEqual([4]);
      const old = db.prepare(`SELECT id FROM page_views WHERE date(viewed_at, 'unixepoch') BETWEEN date('now', '-7 days') AND date('now', '-1 day') AND ${EXCLUDE_MONITORS} ORDER BY id`).all();
      expect(current).toEqual(old);
      const analyticsPlan = JSON.stringify(db.prepare(`EXPLAIN QUERY PLAN SELECT COUNT(*) FROM page_views WHERE ${TIME_WINDOW_WHERE} AND is_bot = 0`).all(7));
      expect(analyticsPlan).toContain("idx_page_views_bot_time");
      expect(analyticsPlan).toContain("viewed_at>");
      expect(db.prepare("PRAGMA index_list(page_views)").all().map((row) => row.name)).not.toContain("idx_page_views_bot");
    } finally {
      db.close();
    }
  });
});

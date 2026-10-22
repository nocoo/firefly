import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { splitSqlStatements } from "./db-adapter";

const SQL_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "022-podcast-url.sql",
);
const MIGRATION_SQL = readFileSync(SQL_PATH, "utf-8");

function applyStatements(db: DatabaseSync, sql: string): void {
  for (const stmt of splitSqlStatements(sql)) {
    db.exec(stmt);
  }
}

function seedPostsFixture(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL
    )
  `);
  db.exec(
    "INSERT INTO posts (id, title, slug) VALUES ('post-1', 'Hello', 'hello')",
  );
}

describe("022-podcast-url migration", () => {
  it("adds nullable podcast_url to posts", () => {
    const db = new DatabaseSync(":memory:");
    seedPostsFixture(db);
    applyStatements(db, MIGRATION_SQL);

    const columns = db
      .prepare("PRAGMA table_info(posts)")
      .all() as { name: string; notnull: number }[];
    const podcast = columns.find((c) => c.name === "podcast_url");
    expect(podcast).toBeDefined();
    expect(podcast?.notnull).toBe(0);

    db.prepare(
      "UPDATE posts SET podcast_url = ? WHERE id = 'post-1'",
    ).run("https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless");

    const row = db
      .prepare("SELECT podcast_url FROM posts WHERE id = 'post-1'")
      .get() as { podcast_url: string | null };
    expect(row.podcast_url).toBe(
      "https://his.fm/episodes/manager-notes/same-mindset-makes-expansion-pointless",
    );
  });
});

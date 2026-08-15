import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { splitSqlStatements } from "./db-adapter";

const SQL_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "019-human-authors.sql",
);
const MIGRATION_SQL = readFileSync(SQL_PATH, "utf-8");

function applyStatements(db: DatabaseSync, sql: string): void {
  for (const stmt of splitSqlStatements(sql)) {
    db.exec(stmt);
  }
}

function seed018Fixture(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE ai_agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      category_id TEXT NOT NULL REFERENCES categories(id)
    )
  `);
  db.exec(`
    CREATE TABLE posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      ai_agent_id TEXT REFERENCES ai_agents(id)
    )
  `);
  db.exec(`
    CREATE TABLE site_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      site_author TEXT NOT NULL DEFAULT '',
      site_name TEXT NOT NULL DEFAULT '',
      author_email TEXT NOT NULL DEFAULT ''
    )
  `);
  db.exec("INSERT INTO categories (id, name, slug) VALUES ('cat-1', 'Diary', 'diary')");
  db.exec(
    "INSERT INTO ai_agents (id, name, slug, category_id) VALUES ('agent-1', 'Claude', 'claude', 'cat-1')",
  );
  db.exec(
    "INSERT INTO posts (id, title, slug, ai_agent_id) VALUES ('post-agent', 'Agent Post', 'agent-post', 'agent-1')",
  );
  db.exec(
    "INSERT INTO posts (id, title, slug, ai_agent_id) VALUES ('post-human', 'Human Post', 'human-post', NULL)",
  );
  db.exec(
    "INSERT INTO site_settings (id, site_author, site_name, author_email) VALUES (1, 'Li Zheng', 'Firefly', 'ed@example.com')",
  );
}

describe("019-human-authors migration", () => {
  it("backfills non-agent posts and leaves agent rows untouched", () => {
    const db = new DatabaseSync(":memory:");
    seed018Fixture(db);
    applyStatements(db, MIGRATION_SQL);

    const agent = db
      .prepare("SELECT ai_agent_id, human_id FROM posts WHERE id = 'post-agent'")
      .get() as { ai_agent_id: string | null; human_id: string | null };
    expect(agent.ai_agent_id).toBe("agent-1");
    expect(agent.human_id).toBeNull();

    const humanPost = db
      .prepare("SELECT ai_agent_id, human_id FROM posts WHERE id = 'post-human'")
      .get() as { ai_agent_id: string | null; human_id: string | null };
    expect(humanPost.ai_agent_id).toBeNull();
    expect(humanPost.human_id).toBeTruthy();

    const settings = db
      .prepare("SELECT default_human_id FROM site_settings WHERE id = 1")
      .get() as { default_human_id: string | null };
    expect(settings.default_human_id).toBe(humanPost.human_id);

    const cols = (
      db.prepare("PRAGMA table_info(site_settings)").all() as { name: string }[]
    ).map((c) => c.name);
    expect(cols).not.toContain("site_author");
    expect(cols).toContain("default_human_id");

    const human = db
      .prepare("SELECT name, slug, profile_public FROM humans WHERE id = ?")
      .get(settings.default_human_id) as {
      name: string;
      slug: string;
      profile_public: number;
    };
    expect(human.name).toBe("Li Zheng");
    expect(human.slug.startsWith("human-")).toBe(true);
    expect(human.slug).toBe(`human-${settings.default_human_id}`);
    expect(human.profile_public).toBe(0);

    db.close();
  });

  it("aborts before dropping site_author when default_human_id is missing", () => {
    const db = new DatabaseSync(":memory:");
    seed018Fixture(db);
    const parts = splitSqlStatements(MIGRATION_SQL);
    const dropIdx = parts.findIndex((s) => /DROP COLUMN site_author/i.test(s));
    const insertHumanIdx = parts.findIndex((s) => /INSERT INTO humans/i.test(s));
    expect(dropIdx).toBeGreaterThan(0);
    expect(insertHumanIdx).toBeGreaterThan(0);

    expect(() => {
      for (let i = 0; i < parts.length; i++) {
        if (i === insertHumanIdx) continue;
        db.exec(parts[i]);
      }
    }).toThrow(/CHECK constraint failed/);

    const cols = (
      db.prepare("PRAGMA table_info(site_settings)").all() as { name: string }[]
    ).map((c) => c.name);
    expect(cols).toContain("site_author");
    db.close();
  });

  it("aborts before dropping site_author when a post would be authorless", () => {
    const db = new DatabaseSync(":memory:");
    seed018Fixture(db);
    const parts = splitSqlStatements(MIGRATION_SQL);
    const backfillIdx = parts.findIndex(
      (s) => /UPDATE posts/i.test(s) && /human_id/i.test(s),
    );
    expect(backfillIdx).toBeGreaterThan(0);

    expect(() => {
      for (let i = 0; i < parts.length; i++) {
        if (i === backfillIdx) continue;
        db.exec(parts[i]);
      }
    }).toThrow(/CHECK constraint failed/);

    const cols = (
      db.prepare("PRAGMA table_info(site_settings)").all() as { name: string }[]
    ).map((c) => c.name);
    expect(cols).toContain("site_author");
    db.close();
  });
});

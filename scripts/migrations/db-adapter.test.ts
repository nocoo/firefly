import { describe, it, expect } from "vitest";
import { splitSqlStatements } from "./db-adapter";

describe("splitSqlStatements", () => {
  it("splits simple statements on semicolons", () => {
    const sql = "CREATE TABLE a (id INT); CREATE TABLE b (id INT);";
    expect(splitSqlStatements(sql)).toEqual([
      "CREATE TABLE a (id INT)",
      "CREATE TABLE b (id INT)",
    ]);
  });

  it("handles trailing statement without semicolon", () => {
    const sql = "INSERT INTO a VALUES (1)";
    expect(splitSqlStatements(sql)).toEqual(["INSERT INTO a VALUES (1)"]);
  });

  it("ignores semicolons inside single-quoted strings", () => {
    const sql = "INSERT INTO a (name) VALUES ('hello; world'); SELECT 1;";
    expect(splitSqlStatements(sql)).toEqual([
      "INSERT INTO a (name) VALUES ('hello; world')",
      "SELECT 1",
    ]);
  });

  it("handles escaped quotes in single-quoted strings", () => {
    const sql = "INSERT INTO a (val) VALUES ('it''s; fine'); SELECT 2;";
    expect(splitSqlStatements(sql)).toEqual([
      "INSERT INTO a (val) VALUES ('it''s; fine')",
      "SELECT 2",
    ]);
  });

  it("ignores semicolons inside double-quoted identifiers", () => {
    const sql = 'SELECT "col;name" FROM t; SELECT 1;';
    expect(splitSqlStatements(sql)).toEqual([
      'SELECT "col;name" FROM t',
      "SELECT 1",
    ]);
  });

  it("skips -- line comments", () => {
    const sql = `-- this is a comment; not a split
CREATE TABLE a (id INT);
-- another comment;
SELECT 1;`;
    expect(splitSqlStatements(sql)).toEqual([
      "CREATE TABLE a (id INT)",
      "SELECT 1",
    ]);
  });

  it("skips /* block comments */", () => {
    const sql = `/* semi; in comment */ CREATE TABLE a (id INT); /* more; */ SELECT 1;`;
    expect(splitSqlStatements(sql)).toEqual([
      "CREATE TABLE a (id INT)",
      "SELECT 1",
    ]);
  });

  it("handles mixed quotes, comments, and statements", () => {
    const sql = `
-- Migration 017
INSERT INTO config (key, val) VALUES ('delim', ';'); /* note: semicolons */
CREATE TABLE "test;table" (id TEXT);
`;
    expect(splitSqlStatements(sql)).toEqual([
      "INSERT INTO config (key, val) VALUES ('delim', ';')",
      'CREATE TABLE "test;table" (id TEXT)',
    ]);
  });

  it("returns empty array for empty/whitespace input", () => {
    expect(splitSqlStatements("")).toEqual([]);
    expect(splitSqlStatements("   \n  ")).toEqual([]);
  });

  it("returns empty array for comment-only input", () => {
    expect(splitSqlStatements("-- just a comment\n/* and a block */")).toEqual(
      [],
    );
  });
});

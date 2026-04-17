import { describe, it, expect } from "vitest";
import { sqlContains } from "./test-utils";

describe("sqlContains", () => {
  it("matches fragment case-insensitively", () => {
    expect(sqlContains("SELECT * FROM users", "select")).toBe(true);
    expect(sqlContains("SELECT * FROM users", "FROM USERS")).toBe(true);
  });

  it("normalizes whitespace before comparing", () => {
    expect(sqlContains("SELECT  *\n  FROM   users", "select * from users")).toBe(true);
  });

  it("returns false when fragment is absent", () => {
    expect(sqlContains("SELECT * FROM users", "DELETE")).toBe(false);
  });
});

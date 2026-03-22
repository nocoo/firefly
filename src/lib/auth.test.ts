import { describe, it, expect, afterEach } from "vitest";
import { isEmailAllowed } from "./auth-utils";

describe("isEmailAllowed", () => {
  const originalEnv = process.env.AUTH_ALLOWED_EMAILS;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.AUTH_ALLOWED_EMAILS = originalEnv;
    } else {
      delete process.env.AUTH_ALLOWED_EMAILS;
    }
  });

  it("returns true for an allowed email", () => {
    process.env.AUTH_ALLOWED_EMAILS = "admin@example.com";
    expect(isEmailAllowed("admin@example.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    process.env.AUTH_ALLOWED_EMAILS = "Admin@Example.COM";
    expect(isEmailAllowed("admin@example.com")).toBe(true);
  });

  it("handles multiple emails (comma-separated)", () => {
    process.env.AUTH_ALLOWED_EMAILS = "a@test.com, b@test.com, c@test.com";
    expect(isEmailAllowed("b@test.com")).toBe(true);
    expect(isEmailAllowed("d@test.com")).toBe(false);
  });

  it("returns false for non-allowed email", () => {
    process.env.AUTH_ALLOWED_EMAILS = "admin@example.com";
    expect(isEmailAllowed("hacker@evil.com")).toBe(false);
  });

  it("returns false when whitelist is empty", () => {
    process.env.AUTH_ALLOWED_EMAILS = "";
    expect(isEmailAllowed("anyone@example.com")).toBe(false);
  });

  it("returns false when env var is not set", () => {
    delete process.env.AUTH_ALLOWED_EMAILS;
    expect(isEmailAllowed("anyone@example.com")).toBe(false);
  });

  it("trims whitespace around emails", () => {
    process.env.AUTH_ALLOWED_EMAILS = "  user@test.com  ,  admin@test.com  ";
    expect(isEmailAllowed("user@test.com")).toBe(true);
    expect(isEmailAllowed("admin@test.com")).toBe(true);
  });

  it("ignores empty entries from extra commas", () => {
    process.env.AUTH_ALLOWED_EMAILS = "user@test.com,,,,admin@test.com,";
    expect(isEmailAllowed("user@test.com")).toBe(true);
    expect(isEmailAllowed("admin@test.com")).toBe(true);
    expect(isEmailAllowed("")).toBe(false);
  });
});

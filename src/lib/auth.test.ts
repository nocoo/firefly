import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { isEmailAllowed, isE2EMode } from "./auth-utils";

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
    process.env.AUTH_ALLOWED_EMAILS = "user@test.com,,admin@test.com,";
    expect(isEmailAllowed("user@test.com")).toBe(true);
    expect(isEmailAllowed("admin@test.com")).toBe(true);
    expect(isEmailAllowed("")).toBe(false);
  });
});

describe("isE2EMode", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when both E2E_SKIP_AUTH and E2E_TEST_RUNNER are true", () => {
    vi.stubEnv("E2E_SKIP_AUTH", "true");
    vi.stubEnv("E2E_TEST_RUNNER", "true");
    expect(isE2EMode()).toBe(true);
  });

  it("returns true even with NODE_ENV=production (next start forces it)", () => {
    vi.stubEnv("E2E_SKIP_AUTH", "true");
    vi.stubEnv("E2E_TEST_RUNNER", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(isE2EMode()).toBe(true);
  });

  it("returns false when E2E_TEST_RUNNER is missing", () => {
    vi.stubEnv("E2E_SKIP_AUTH", "true");
    expect(isE2EMode()).toBe(false);
  });

  it("returns false when E2E_SKIP_AUTH is unset", () => {
    vi.stubEnv("E2E_SKIP_AUTH", "");
    vi.stubEnv("E2E_TEST_RUNNER", "true");
    expect(isE2EMode()).toBe(false);
  });

  it("returns false when E2E_SKIP_AUTH is not exactly 'true'", () => {
    vi.stubEnv("E2E_SKIP_AUTH", "1");
    vi.stubEnv("E2E_TEST_RUNNER", "true");
    expect(isE2EMode()).toBe(false);
  });
});

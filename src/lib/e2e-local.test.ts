import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isLocalE2EMode, resolveLocalR2Path } from "./e2e-local";

const E2E_VARS = ["E2E_R2_LOCAL_DIR", "E2E_SKIP_AUTH", "E2E_TEST_RUNNER"];

describe("isLocalE2EMode", () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const k of E2E_VARS) {
      saved[k] = process.env[k];
      Reflect.deleteProperty(process.env, k);
    }
  });

  afterEach(() => {
    for (const k of E2E_VARS) {
      if (saved[k] === undefined) Reflect.deleteProperty(process.env, k);
      else process.env[k] = saved[k];
    }
  });

  it("returns false when no env vars set", () => {
    expect(isLocalE2EMode()).toBe(false);
  });

  it("returns false when only the dir is set", () => {
    process.env.E2E_R2_LOCAL_DIR = "/tmp/x";
    expect(isLocalE2EMode()).toBe(false);
  });

  it("returns false when SKIP_AUTH is not 'true' literally", () => {
    process.env.E2E_R2_LOCAL_DIR = "/tmp/x";
    process.env.E2E_SKIP_AUTH = "yes";
    process.env.E2E_TEST_RUNNER = "true";
    expect(isLocalE2EMode()).toBe(false);
  });

  it("returns false when TEST_RUNNER is missing", () => {
    process.env.E2E_R2_LOCAL_DIR = "/tmp/x";
    process.env.E2E_SKIP_AUTH = "true";
    expect(isLocalE2EMode()).toBe(false);
  });

  it("returns true when all three flags are set correctly", () => {
    process.env.E2E_R2_LOCAL_DIR = "/tmp/x";
    process.env.E2E_SKIP_AUTH = "true";
    process.env.E2E_TEST_RUNNER = "true";
    expect(isLocalE2EMode()).toBe(true);
  });
});

describe("resolveLocalR2Path", () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.E2E_R2_LOCAL_DIR;
    process.env.E2E_R2_LOCAL_DIR = "/tmp/firefly-e2e-r2";
  });

  afterEach(() => {
    if (saved === undefined) Reflect.deleteProperty(process.env, "E2E_R2_LOCAL_DIR");
    else process.env.E2E_R2_LOCAL_DIR = saved;
  });

  it("throws if E2E_R2_LOCAL_DIR is not set", () => {
    Reflect.deleteProperty(process.env, "E2E_R2_LOCAL_DIR");
    expect(() => resolveLocalR2Path("foo.png")).toThrow(
      "E2E_R2_LOCAL_DIR is not set",
    );
  });

  it("rejects keys containing '..'", () => {
    expect(() => resolveLocalR2Path("../etc/passwd")).toThrow(
      "path traversal",
    );
  });

  it("rejects absolute keys", () => {
    expect(() => resolveLocalR2Path("/etc/passwd")).toThrow("path traversal");
  });

  it("rejects keys containing backslash", () => {
    expect(() => resolveLocalR2Path("foo\\bar")).toThrow("path traversal");
  });

  it("returns an absolute path under the root for a safe key", () => {
    const out = resolveLocalR2Path("uploads/img.png");
    expect(out).toBe("/tmp/firefly-e2e-r2/uploads/img.png");
  });

  it("throws when target would escape the root (e.g. localDir='/' edge case)", () => {
    // When localDir resolves to '/', the guard's prefix check (`root + "/"` = '//')
    // fails for every legitimate target (e.g. '/foo'), so the escapes-root branch
    // fires. This documents the defensive guard's behaviour on degenerate roots.
    process.env.E2E_R2_LOCAL_DIR = "/";
    expect(() => resolveLocalR2Path("foo")).toThrow(
      "resolved path escapes local R2 root",
    );
  });

  it("allows empty key resolving exactly to the root (target === root)", () => {
    // Empty key normalises to '.', which resolves to the root itself.
    // The escapes-root guard's right operand (target !== root) must be false
    // here so the throw branch is skipped.
    const out = resolveLocalR2Path("");
    expect(out).toBe("/tmp/firefly-e2e-r2");
  });
});

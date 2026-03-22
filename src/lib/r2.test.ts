import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateR2Key, validateUpload } from "./r2";

// ---------------------------------------------------------------------------
// generateR2Key
// ---------------------------------------------------------------------------

describe("generateR2Key", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T12:00:00Z"));
  });

  it("generates key with correct year/month prefix", () => {
    const key = generateR2Key("photo.jpg");
    expect(key).toMatch(/^uploads\/2026\/03\//);
  });

  it("includes timestamp in key", () => {
    const key = generateR2Key("photo.jpg");
    const ts = new Date("2026-03-23T12:00:00Z").getTime();
    expect(key).toContain(String(ts));
  });

  it("sanitizes filename to lowercase", () => {
    const key = generateR2Key("My Photo.JPG");
    expect(key).toMatch(/my-photo\.jpg$/);
  });

  it("replaces spaces with hyphens", () => {
    const key = generateR2Key("my great photo.png");
    expect(key).toMatch(/my-great-photo\.png$/);
  });

  it("removes unsafe characters", () => {
    const key = generateR2Key("photo (1) [copy].png");
    expect(key).toMatch(/photo-1-copy\.png$/);
  });

  it("handles Chinese characters (removes them)", () => {
    const key = generateR2Key("截图.png");
    expect(key).toMatch(/\.png$/);
  });

  it("produces correct month for January (zero-padded)", () => {
    vi.setSystemTime(new Date("2026-01-05T00:00:00Z"));
    const key = generateR2Key("test.jpg");
    expect(key).toMatch(/^uploads\/2026\/01\//);
  });
});

// ---------------------------------------------------------------------------
// validateUpload
// ---------------------------------------------------------------------------

describe("validateUpload", () => {
  it("accepts jpeg", () => {
    expect(validateUpload(1024, "image/jpeg")).toBeNull();
  });

  it("accepts png", () => {
    expect(validateUpload(1024, "image/png")).toBeNull();
  });

  it("accepts gif", () => {
    expect(validateUpload(1024, "image/gif")).toBeNull();
  });

  it("accepts webp", () => {
    expect(validateUpload(1024, "image/webp")).toBeNull();
  });

  it("accepts svg", () => {
    expect(validateUpload(1024, "image/svg+xml")).toBeNull();
  });

  it("accepts avif", () => {
    expect(validateUpload(1024, "image/avif")).toBeNull();
  });

  it("rejects unsupported mime type", () => {
    const err = validateUpload(1024, "application/pdf");
    expect(err).toContain("Unsupported file type");
  });

  it("rejects text/plain", () => {
    const err = validateUpload(1024, "text/plain");
    expect(err).toContain("Unsupported file type");
  });

  it("rejects file exceeding 10MB", () => {
    const size = 11 * 1024 * 1024;
    const err = validateUpload(size, "image/jpeg");
    expect(err).toContain("File too large");
    expect(err).toContain("10MB limit");
  });

  it("accepts file exactly at 10MB", () => {
    const size = 10 * 1024 * 1024;
    expect(validateUpload(size, "image/jpeg")).toBeNull();
  });

  it("accepts small file", () => {
    expect(validateUpload(100, "image/png")).toBeNull();
  });
});

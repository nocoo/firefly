import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateR2Key, validateUpload, detectMimeType } from "./r2";

// ---------------------------------------------------------------------------
// Test helpers — real magic byte headers for each format
// ---------------------------------------------------------------------------

function makeBytes(header: number[], totalSize: number = 1024): Uint8Array {
  const buf = new Uint8Array(totalSize);
  for (let i = 0; i < header.length; i++) buf[i] = header[i];
  return buf;
}

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const GIF_HEADER = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0, 0, 0, 0, 0];
// RIFF....WEBP
const WEBP_HEADER = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
// ....ftypavif
const AVIF_HEADER = [0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66];

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
// detectMimeType
// ---------------------------------------------------------------------------

describe("detectMimeType", () => {
  it("detects PNG", () => {
    expect(detectMimeType(makeBytes(PNG_HEADER))).toBe("image/png");
  });

  it("detects JPEG", () => {
    expect(detectMimeType(makeBytes(JPEG_HEADER))).toBe("image/jpeg");
  });

  it("detects GIF", () => {
    expect(detectMimeType(makeBytes(GIF_HEADER))).toBe("image/gif");
  });

  it("detects WebP", () => {
    expect(detectMimeType(makeBytes(WEBP_HEADER))).toBe("image/webp");
  });

  it("detects AVIF", () => {
    expect(detectMimeType(makeBytes(AVIF_HEADER))).toBe("image/avif");
  });

  it("returns null for unknown bytes", () => {
    expect(detectMimeType(makeBytes([0x00, 0x00, 0x00, 0x00, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
  });

  it("returns null for too-short data", () => {
    expect(detectMimeType(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateUpload
// ---------------------------------------------------------------------------

describe("validateUpload", () => {
  it("accepts jpeg with matching magic bytes", () => {
    expect(validateUpload(makeBytes(JPEG_HEADER), "image/jpeg")).toBeNull();
  });

  it("accepts png with matching magic bytes", () => {
    expect(validateUpload(makeBytes(PNG_HEADER), "image/png")).toBeNull();
  });

  it("accepts gif with matching magic bytes", () => {
    expect(validateUpload(makeBytes(GIF_HEADER), "image/gif")).toBeNull();
  });

  it("accepts webp with matching magic bytes", () => {
    expect(validateUpload(makeBytes(WEBP_HEADER), "image/webp")).toBeNull();
  });

  it("accepts avif with matching magic bytes", () => {
    expect(validateUpload(makeBytes(AVIF_HEADER), "image/avif")).toBeNull();
  });

  it("rejects svg (executable format)", () => {
    const svgBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const err = validateUpload(svgBytes, "image/svg+xml");
    expect(err).toContain("Unsupported file type");
  });

  it("rejects unsupported mime type", () => {
    const err = validateUpload(makeBytes(PNG_HEADER), "application/pdf");
    expect(err).toContain("Unsupported file type");
  });

  it("rejects text/plain", () => {
    const err = validateUpload(makeBytes(PNG_HEADER), "text/plain");
    expect(err).toContain("Unsupported file type");
  });

  it("rejects file exceeding 10MB", () => {
    const size = 11 * 1024 * 1024;
    const err = validateUpload(makeBytes(JPEG_HEADER, size), "image/jpeg");
    expect(err).toContain("File too large");
    expect(err).toContain("10MB limit");
  });

  it("accepts file exactly at 10MB", () => {
    const size = 10 * 1024 * 1024;
    expect(validateUpload(makeBytes(JPEG_HEADER, size), "image/jpeg")).toBeNull();
  });

  it("accepts small file", () => {
    expect(validateUpload(makeBytes(PNG_HEADER, 100), "image/png")).toBeNull();
  });

  // --- Magic byte mismatch ---

  it("rejects when declared mime does not match actual content", () => {
    // Declare JPEG but content is PNG
    const err = validateUpload(makeBytes(PNG_HEADER), "image/jpeg");
    expect(err).toContain("MIME type mismatch");
    expect(err).toContain("declared image/jpeg");
    expect(err).toContain("content is image/png");
  });

  it("rejects when content has no recognizable magic bytes", () => {
    const garbage = new Uint8Array(1024);
    garbage[0] = 0x01;
    const err = validateUpload(garbage, "image/jpeg");
    expect(err).toContain("does not match any supported image format");
  });

  it("rejects executable disguised as image (ELF header)", () => {
    // ELF magic: 0x7f 0x45 0x4c 0x46
    const elfBytes = makeBytes([0x7f, 0x45, 0x4c, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]);
    const err = validateUpload(elfBytes, "image/png");
    expect(err).toContain("does not match any supported image format");
  });
});

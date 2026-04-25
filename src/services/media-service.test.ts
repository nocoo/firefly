import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Db } from "@/lib/db";
import { createMockDb } from "@/data/core/test-utils";
import { MediaService } from "./media-service";
import type { R2Client } from "./media-service";
import type { Attachment } from "@/models/types";

// Mock media entity functions
vi.mock("@/data/entities/media", () => ({
  createMedia: vi.fn(),
  deleteMedia: vi.fn(),
  getMediaById: vi.fn(),
}));

import {
  createMedia,
  deleteMedia,
  getMediaById,
} from "@/data/entities/media";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = Math.floor(Date.now() / 1000);

const sampleAttachment: Attachment = {
  id: "att-1",
  filename: "photo.jpg",
  r2_key: "uploads/2026/03/photo.jpg",
  mime_type: "image/jpeg",
  size: 12345,
  width: 800,
  height: 600,
  alt_text: null,
  post_id: null,
  wp_id: null,
  created_at: now,
};

function createMockR2(): R2Client {
  return {
    upload: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// MediaService.upload
// ---------------------------------------------------------------------------

describe("MediaService.upload", () => {
  let db: Db;
  let r2: R2Client;
  beforeEach(() => {
    db = createMockDb();
    r2 = createMockR2();
    vi.clearAllMocks();
  });

  it("uploads to R2 then creates DB record", async () => {
    vi.mocked(createMedia).mockResolvedValue(sampleAttachment);

    const result = await MediaService.upload(db, r2, {
      filename: "photo.jpg",
      r2Key: "uploads/2026/03/photo.jpg",
      mimeType: "image/jpeg",
      data: new Uint8Array([1, 2, 3]),
      size: 12345,
    });

    expect(r2.upload).toHaveBeenCalledWith(
      "uploads/2026/03/photo.jpg",
      expect.any(Uint8Array),
      "image/jpeg",
    );
    expect(createMedia).toHaveBeenCalledOnce();
    expect(result.filename).toBe("photo.jpg");
  });

  it("passes postId when provided", async () => {
    vi.mocked(createMedia).mockResolvedValue(sampleAttachment);

    await MediaService.upload(db, r2, {
      filename: "photo.jpg",
      r2Key: "uploads/photo.jpg",
      mimeType: "image/jpeg",
      data: new Uint8Array([1]),
      postId: "post-1",
    });

    const input = vi.mocked(createMedia).mock.calls[0][1];
    expect(input.postId).toBe("post-1");
  });

  it("passes width and height when provided", async () => {
    vi.mocked(createMedia).mockResolvedValue(sampleAttachment);

    await MediaService.upload(db, r2, {
      filename: "photo.jpg",
      r2Key: "uploads/photo.jpg",
      mimeType: "image/jpeg",
      data: new Uint8Array([1]),
      width: 1920,
      height: 1080,
    });

    const input = vi.mocked(createMedia).mock.calls[0][1];
    expect(input.width).toBe(1920);
    expect(input.height).toBe(1080);
  });

  it("omits width and height when not provided", async () => {
    vi.mocked(createMedia).mockResolvedValue(sampleAttachment);

    await MediaService.upload(db, r2, {
      filename: "photo.jpg",
      r2Key: "uploads/photo.jpg",
      mimeType: "image/jpeg",
      data: new Uint8Array([1]),
    });

    const input = vi.mocked(createMedia).mock.calls[0][1];
    expect(input.width).toBeUndefined();
    expect(input.height).toBeUndefined();
  });

  it("throws when R2 upload fails (primary)", async () => {
    vi.mocked(r2.upload).mockRejectedValue(new Error("R2 timeout"));

    await expect(
      MediaService.upload(db, r2, {
        filename: "photo.jpg",
        r2Key: "uploads/photo.jpg",
        mimeType: "image/jpeg",
        data: new Uint8Array([1]),
      }),
    ).rejects.toThrow("R2 timeout");

    expect(createMedia).not.toHaveBeenCalled();
  });

  it("logs orphan R2 key when DB record creation fails", async () => {
    vi.mocked(r2.upload).mockResolvedValue(undefined);
    vi.mocked(createMedia).mockRejectedValue(new Error("DB error"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      MediaService.upload(db, r2, {
        filename: "photo.jpg",
        r2Key: "uploads/photo.jpg",
        mimeType: "image/jpeg",
        data: new Uint8Array([1]),
      }),
    ).rejects.toThrow("DB error");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Orphan R2 key: uploads/photo.jpg"),
      expect.any(Error),
    );
    errorSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// MediaService.delete
// ---------------------------------------------------------------------------

describe("MediaService.delete", () => {
  let db: Db;
  let r2: R2Client;
  beforeEach(() => {
    db = createMockDb();
    r2 = createMockR2();
    vi.clearAllMocks();
  });

  it("fetches media, deletes DB record, then deletes from R2", async () => {
    vi.mocked(getMediaById).mockResolvedValue(sampleAttachment);
    vi.mocked(deleteMedia).mockResolvedValue(true);

    const result = await MediaService.delete(db, r2, "att-1");

    expect(getMediaById).toHaveBeenCalledWith(db, "att-1");
    expect(deleteMedia).toHaveBeenCalledWith(db, "att-1");
    expect(r2.delete).toHaveBeenCalledWith("uploads/2026/03/photo.jpg");
    expect(result).toBe(true);
  });

  it("returns false when media not found", async () => {
    vi.mocked(getMediaById).mockResolvedValue(null);

    const result = await MediaService.delete(db, r2, "nope");

    expect(result).toBe(false);
    expect(deleteMedia).not.toHaveBeenCalled();
    expect(r2.delete).not.toHaveBeenCalled();
  });

  it("returns false when DB delete fails", async () => {
    vi.mocked(getMediaById).mockResolvedValue(sampleAttachment);
    vi.mocked(deleteMedia).mockResolvedValue(false);

    const result = await MediaService.delete(db, r2, "att-1");

    expect(result).toBe(false);
    expect(r2.delete).not.toHaveBeenCalled();
  });

  it("continues when R2 delete fails (best-effort secondary)", async () => {
    vi.mocked(getMediaById).mockResolvedValue(sampleAttachment);
    vi.mocked(deleteMedia).mockResolvedValue(true);
    vi.mocked(r2.delete).mockRejectedValue(new Error("R2 error"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Should NOT throw
    const result = await MediaService.delete(db, r2, "att-1");
    expect(result).toBe(true);
    expect(errSpy).toHaveBeenCalled();
  });
});

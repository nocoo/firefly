// ---------------------------------------------------------------------------
// MediaService — R2 + DB orchestration (D1)
// Upload: R2 is primary truth (orphaned R2 objects cleaned by periodic GC).
// Delete: DB is primary truth; R2 deletion is best-effort secondary (D6).
// ---------------------------------------------------------------------------

import type { Db } from "@/lib/db";
import type { Attachment } from "@/models/types";
import {
  createMedia,
  deleteMedia,
  getMediaById,
} from "@/data/entities/media";

// ---------------------------------------------------------------------------
// R2 client interface (injected for testability)
// ---------------------------------------------------------------------------

export interface R2Client {
  upload(key: string, data: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Upload input
// ---------------------------------------------------------------------------

export interface UploadMediaInput {
  filename: string;
  r2Key: string;
  mimeType: string;
  data: Uint8Array;
  size?: number;
  width?: number;
  height?: number;
  postId?: string;
}

// ---------------------------------------------------------------------------
// MediaService
// ---------------------------------------------------------------------------

export const MediaService = {
  // -------------------------------------------------------------------------
  // upload — primary: R2 upload; then: DB record creation
  // -------------------------------------------------------------------------

  async upload(
    db: Db,
    r2: R2Client,
    input: UploadMediaInput,
  ): Promise<Attachment> {
    // Primary: upload to R2 — throws on failure
    await r2.upload(input.r2Key, input.data, input.mimeType);

    // Create DB record — if this fails, R2 object becomes orphaned
    // (cleaned by periodic GC). Log the orphan key for observability.
    let attachment: Attachment;
    try {
      attachment = await createMedia(db, {
        filename: input.filename,
        r2Key: input.r2Key,
        mimeType: input.mimeType,
        ...(input.size != null && { size: input.size }),
        ...(input.width != null && { width: input.width }),
        ...(input.height != null && { height: input.height }),
        ...(input.postId != null && { postId: input.postId }),
      });
    } catch (err) {
      console.error(
        `[MediaService] DB record creation failed after R2 upload. Orphan R2 key: ${input.r2Key}`,
        err,
      );
      throw err;
    }

    return attachment;
  },

  // -------------------------------------------------------------------------
  // delete — primary: DB delete; secondary: R2 delete (best-effort)
  // -------------------------------------------------------------------------

  async delete(
    db: Db,
    r2: R2Client,
    id: string,
  ): Promise<boolean> {
    // Fetch media to get R2 key before deletion
    const media = await getMediaById(db, id);
    if (!media) return false;

    // Primary: remove DB record
    const deleted = await deleteMedia(db, id);
    if (!deleted) return false;

    // Secondary: delete from R2 — best-effort (D6)
    try {
      await r2.delete(media.r2_key);
    } catch (err) {
      console.error(
        `[MediaService] R2 delete failed for ${media.r2_key} (best-effort):`,
        err,
      );
    }

    return true;
  },
};

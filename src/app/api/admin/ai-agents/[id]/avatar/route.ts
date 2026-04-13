import { NextRequest } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import { validateUpload } from "@/lib/r2";
import { uploadBufferToR2 } from "@/lib/r2-client";
import { getAiAgentById, updateAvatarVersion } from "@/data/entities/ai-agent";
import {
  getAgentAvatarR2Key,
  getAgentAvatarUrl,
  AVATAR_SIZES,
  type AvatarSize,
} from "@/lib/ai-agent/avatar";

type RouteContext = { params: Promise<{ id: string }> };

// ---------------------------------------------------------------------------
// POST /api/admin/ai-agents/[id]/avatar — upload agent avatar
// ---------------------------------------------------------------------------

/**
 * Upload an agent avatar image.
 *
 * Validates square aspect ratio (min 256px), resizes to all standard sizes,
 * uploads all variants to R2 under a versioned path, then updates
 * avatar_version in the database.
 *
 * All 4 variants must upload successfully before the DB is updated.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const db = getDb();

    // Check agent exists
    const agent = await getAiAgentById(db, id);
    if (!agent) {
      return notFoundResponse("Agent");
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return errorResponse("No file provided", 400);
    }

    const buffer = new Uint8Array(await file.arrayBuffer());

    // Validate via standard upload checks (size, MIME, magic bytes)
    const validationError = validateUpload(buffer, file.type);
    if (validationError) {
      return errorResponse(validationError, 400);
    }

    // Validate square aspect ratio and minimum size
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height || metadata.width !== metadata.height) {
      return errorResponse(
        `Image must be square: got ${metadata.width ?? 0}x${metadata.height ?? 0}`,
        400,
      );
    }
    if (metadata.width < 256) {
      return errorResponse(
        `Image must be at least 256x256 pixels: got ${metadata.width}x${metadata.height}`,
        400,
      );
    }

    // Generate versioned path
    const version = crypto.randomUUID().slice(0, 8);

    // Resize to all sizes and convert to JPEG with compression
    const resized = await Promise.all(
      AVATAR_SIZES.map(async (size: AvatarSize) => {
        const jpeg = await sharp(buffer)
          .resize(size, size, { fit: "cover" })
          .jpeg({ quality: 85 })
          .toBuffer();
        return { size, data: new Uint8Array(jpeg) };
      }),
    );

    // Upload all variants — all must succeed before DB update
    // Use agent.id (not slug) for stable paths that survive slug changes
    await Promise.all(
      resized.map(async ({ size, data }) => {
        const key = getAgentAvatarR2Key(agent.id, version, size);
        await uploadBufferToR2(key, data, "image/jpeg");
      }),
    );

    // All uploads succeeded — persist version to DB
    await updateAvatarVersion(db, id, version);

    // Get URLs for response (use agent.id for stable paths)
    const urls = AVATAR_SIZES.reduce(
      (acc, size) => {
        // version is always set here (just generated), so URL will not be null
        const url = getAgentAvatarUrl(agent.id, version, size);
        if (url) acc[size] = url;
        return acc;
      },
      {} as Record<AvatarSize, string>,
    );

    return jsonResponse({ version, urls }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Avatar upload failed";

    if (
      message.includes("File too large") ||
      message.includes("Unsupported file type") ||
      message.includes("Image must be") ||
      message.includes("MIME type mismatch")
    ) {
      return errorResponse(message, 400);
    }

    console.error("Avatar upload error:", err);
    return errorResponse(message, 500);
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/admin/ai-agents/[id]/avatar — remove agent avatar
// ---------------------------------------------------------------------------

/**
 * Remove an agent avatar.
 *
 * Clears avatar_version in the database. Old R2 files are not deleted
 * (orphan cleanup is a separate concern).
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const db = getDb();

    const agent = await getAiAgentById(db, id);
    if (!agent) {
      return notFoundResponse("Agent");
    }

    if (!agent.avatar_version) {
      return errorResponse("No avatar to remove", 404);
    }

    await updateAvatarVersion(db, id, null);
    return jsonResponse({ removed: true });
  } catch (err) {
    console.error("Avatar delete error:", err);
    const message = err instanceof Error ? err.message : "Avatar delete failed";
    return errorResponse(message, 500);
  }
}

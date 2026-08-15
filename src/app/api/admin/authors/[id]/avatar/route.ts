import type { NextRequest } from "next/server";
import sharp from "sharp";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jsonResponse, errorResponse, notFoundResponse } from "@/lib/api";
import { validateUpload } from "@/lib/r2";
import { uploadBufferToR2 } from "@/lib/r2-client";
import { getHumanById, updateHumanAvatarVersion } from "@/data/entities/human";
import {
  getHumanAvatarR2Key,
  getHumanAvatarUrl,
  HUMAN_AVATAR_SIZES,
  type HumanAvatarSize,
} from "@/lib/human-avatar";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const db = getDb();
    const human = await getHumanById(db, id);
    if (!human) return notFoundResponse("Author");

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return errorResponse("No file provided", 400);
    }

    const buffer = new Uint8Array(await file.arrayBuffer());
    const validationError = validateUpload(buffer, file.type);
    if (validationError) return errorResponse(validationError, 400);

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

    const version = crypto.randomUUID().slice(0, 8);
    const resized = await Promise.all(
      HUMAN_AVATAR_SIZES.map(async (size: HumanAvatarSize) => {
        const jpeg = await sharp(buffer)
          .resize(size, size, { fit: "cover" })
          .jpeg({ quality: 85 })
          .toBuffer();
        return { size, data: new Uint8Array(jpeg) };
      }),
    );

    await Promise.all(
      resized.map(async ({ size, data }) => {
        const key = getHumanAvatarR2Key(human.id, version, size);
        await uploadBufferToR2(key, data, "image/jpeg");
      }),
    );

    await updateHumanAvatarVersion(db, id, version);

    const urls = HUMAN_AVATAR_SIZES.reduce(
      (acc, size) => {
        const url = getHumanAvatarUrl(human.id, version, size);
        if (url) acc[size] = url;
        return acc;
      },
      {} as Record<HumanAvatarSize, string>,
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
    console.error("Human avatar upload error:", err);
    return errorResponse(message, 500);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const { id } = await params;
    const db = getDb();
    const human = await getHumanById(db, id);
    if (!human) return notFoundResponse("Author");
    if (!human.avatar_version) {
      return errorResponse("No avatar to remove", 404);
    }
    await updateHumanAvatarVersion(db, id, null);
    return jsonResponse({ removed: true });
  } catch (err) {
    console.error("Human avatar delete error:", err);
    const message = err instanceof Error ? err.message : "Avatar delete failed";
    return errorResponse(message, 500);
  }
}

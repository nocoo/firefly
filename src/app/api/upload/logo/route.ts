import { NextRequest } from "next/server";
import sharp from "sharp";
import { jsonResponse, errorResponse } from "@/lib/api";
import { validateUpload } from "@/lib/r2";
import { uploadBufferToR2 } from "@/lib/r2-client";
import { getLogoR2Key, LOGO_SIZES, type LogoSize } from "@/lib/logo";
import { getDb } from "@/lib/db";
import { getSiteSettings, updateSiteLogoVersion } from "@/data/settings";

/**
 * POST /api/upload/logo — upload a site logo image.
 *
 * Validates square aspect ratio, resizes to all standard sizes,
 * uploads all variants to R2 under a versioned path, then updates
 * site_logo_version in the database.
 *
 * All 7 variants must upload successfully before the DB is updated.
 */
export async function POST(request: NextRequest) {
  try {
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

    // Validate square aspect ratio (strict: width must equal height)
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height || metadata.width !== metadata.height) {
      return errorResponse(
        `Image must be square: got ${metadata.width ?? 0}×${metadata.height ?? 0}`,
        400,
      );
    }

    // Generate versioned path
    const version = crypto.randomUUID().slice(0, 8);

    // Resize to all sizes
    const resized = await Promise.all(
      LOGO_SIZES.map(async (size: LogoSize) => {
        const png = await sharp(buffer)
          .resize(size, size, { fit: "cover" })
          .png()
          .toBuffer();
        return { size, data: new Uint8Array(png) };
      }),
    );

    // Upload all variants — all must succeed before DB update
    const uploads = await Promise.all(
      resized.map(async ({ size, data }) => {
        const key = getLogoR2Key(version, size);
        const result = await uploadBufferToR2(key, data, "image/png");
        return { size, url: result.url };
      }),
    );

    // All uploads succeeded — persist version to DB
    const db = getDb();
    await updateSiteLogoVersion(db, version);

    return jsonResponse({ version, sizes: uploads }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Logo upload failed";

    if (
      message.includes("File too large") ||
      message.includes("Unsupported file type") ||
      message.includes("Image must be square") ||
      message.includes("MIME type mismatch")
    ) {
      return errorResponse(message, 400);
    }

    console.error("Logo upload error:", err);
    return errorResponse(message, 500);
  }
}

/**
 * DELETE /api/upload/logo — remove the site logo.
 *
 * Clears site_logo_version in the database. Old R2 files are not deleted
 * (orphan cleanup is a separate concern).
 */
export async function DELETE() {
  try {
    const db = getDb();
    const settings = await getSiteSettings(db);

    if (!settings.siteLogoVersion) {
      return errorResponse("No logo to remove", 404);
    }

    await updateSiteLogoVersion(db, null);
    return jsonResponse({ removed: true });
  } catch (err) {
    console.error("Logo delete error:", err);
    const message = err instanceof Error ? err.message : "Logo delete failed";
    return errorResponse(message, 500);
  }
}

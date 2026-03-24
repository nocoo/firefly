import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api";
import { uploadToR2 } from "@/lib/r2-client";
import { generateFireflyR2Key } from "@/lib/r2";

/**
 * POST /api/upload — upload an image to R2.
 * Accepts multipart/form-data with a single "file" field.
 * Protected by proxy (requires auth).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return errorResponse("No file provided", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = generateFireflyR2Key(file.name);
    const result = await uploadToR2(buffer, file.name, file.type, key);

    return jsonResponse(result, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";

    // Validation errors → 400, everything else → 500
    if (
      message.includes("File too large") ||
      message.includes("Unsupported file type") ||
      message.includes("MIME type mismatch") ||
      message.includes("does not match any supported image format")
    ) {
      return errorResponse(message, 400);
    }

    console.error("Upload error:", err);
    return errorResponse(message, 500);
  }
}

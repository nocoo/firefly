// ---------------------------------------------------------------------------
// R2 upload helpers — pure validation & key generation logic
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Allowed types & size limit
// ---------------------------------------------------------------------------

export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  // SVG intentionally excluded — it is an executable format (can embed
  // <script> tags) and should not be accepted for user-uploaded images.
]);

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// ---------------------------------------------------------------------------
// Magic-byte detection
// ---------------------------------------------------------------------------

/**
 * Magic-byte signatures for allowed image formats.
 * Used to verify actual file content regardless of client-declared MIME.
 */
const MAGIC_SIGNATURES: { mime: string; check: (buf: Uint8Array) => boolean }[] = [
  {
    mime: "image/png",
    check: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    mime: "image/jpeg",
    check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/gif",
    check: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46, // GIF
  },
  {
    mime: "image/webp",
    // RIFF....WEBP
    check: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    mime: "image/avif",
    // ....ftypavif  or  ....ftypavis
    check: (b) =>
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 &&
      b[8] === 0x61 && b[9] === 0x76 && b[10] === 0x69,
  },
];

/**
 * Detect MIME type from file magic bytes.
 * Returns the detected MIME or null if unrecognized.
 */
export function detectMimeType(data: Uint8Array): string | null {
  if (data.length < 12) return null;
  for (const sig of MAGIC_SIGNATURES) {
    if (sig.check(data)) return sig.mime;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
}

/**
 * Extract lowercase file extension from a filename.
 * Returns empty string if no extension is found.
 */
export function extractExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1 || dot === filename.length - 1) return "";
  return filename.slice(dot + 1).toLowerCase();
}

/**
 * Generate a unique R2 key for an uploaded file.
 * Format: uploads/YYYY/MM/timestamp-filename
 */
export function generateR2Key(filename: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const timestamp = now.getTime();

  // Sanitize filename: lowercase, replace spaces with hyphens, remove unsafe chars
  const safe = filename
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9.\-_]/g, "");

  return `uploads/${year}/${month}/${timestamp}-${safe}`;
}

/**
 * Generate a GUID-based R2 key under the Firefly upload path.
 * Format: lizhengblog/wp-content/uploads/firefly/{uuid}.{ext}
 */
export function generateFireflyR2Key(filename: string): string {
  const ext = extractExtension(filename);
  const uuid = crypto.randomUUID();
  const suffix = ext ? `.${ext}` : "";
  return `lizhengblog/wp-content/uploads/firefly/${uuid}${suffix}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate upload input before sending to R2.
 * Checks size limit, declared MIME against allowlist, and verifies
 * actual content via magic-byte detection to prevent spoofed types.
 * Returns error message if invalid, null if valid.
 */
export function validateUpload(
  data: Uint8Array,
  declaredMime: string,
): string | null {
  if (data.length > MAX_FILE_SIZE) {
    return `File too large: ${(data.length / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`;
  }
  if (!ALLOWED_MIME_TYPES.has(declaredMime)) {
    return `Unsupported file type: ${declaredMime}`;
  }

  // Verify magic bytes match an allowed image format
  const detected = detectMimeType(data);
  if (!detected) {
    return "File content does not match any supported image format";
  }
  if (detected !== declaredMime) {
    return `MIME type mismatch: declared ${declaredMime} but content is ${detected}`;
  }

  return null;
}

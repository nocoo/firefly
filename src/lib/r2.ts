// ---------------------------------------------------------------------------
// R2 client — upload images to Cloudflare R2 via S3-compatible API
// ---------------------------------------------------------------------------

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string; // e.g. https://assets.lizheng.me
}

function getR2Config(): R2Config {
  const accountId = process.env.CF_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME ?? "lizhengblog";
  const publicUrl =
    process.env.R2_PUBLIC_URL ?? "https://assets.lizheng.me";

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials not configured: CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY required",
    );
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

// ---------------------------------------------------------------------------
// S3 client singleton
// ---------------------------------------------------------------------------

let _client: S3Client | undefined;
let _config: R2Config | undefined;

function getClient(): { client: S3Client; config: R2Config } {
  if (!_client || !_config) {
    _config = getR2Config();
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${_config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: _config.accessKeyId,
        secretAccessKey: _config.secretAccessKey,
      },
    });
  }
  return { client: _client, config: _config };
}

/** Reset singleton (for testing). */
export function resetR2Client(): void {
  _client = undefined;
  _config = undefined;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export interface UploadResult {
  key: string;
  url: string;
  size: number;
  mimeType: string;
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
 * Validate upload input before sending to R2.
 * Returns error message if invalid, null if valid.
 */
export function validateUpload(
  size: number,
  mimeType: string,
): string | null {
  if (size > MAX_FILE_SIZE) {
    return `File too large: ${(size / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`;
  }
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return `Unsupported file type: ${mimeType}`;
  }
  return null;
}

/**
 * Upload a file to R2.
 */
export async function uploadToR2(
  data: Buffer | Uint8Array,
  filename: string,
  mimeType: string,
): Promise<UploadResult> {
  const validationError = validateUpload(data.length, mimeType);
  if (validationError) {
    throw new Error(validationError);
  }

  const key = generateR2Key(filename);
  const { client, config } = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: data,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return {
    key,
    url: `${config.publicUrl}/${key}`,
    size: data.length,
    mimeType,
  };
}

/**
 * Delete a file from R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  const { client, config } = getClient();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    }),
  );
}

// ---------------------------------------------------------------------------
// R2 client — S3-compatible upload/delete via Cloudflare R2
//
// This is integration glue over @aws-sdk/client-s3 and is tested via E2E,
// not unit tests. Pure validation/key-generation logic lives in r2.ts.
// ---------------------------------------------------------------------------

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import {
  validateUpload,
  generateR2Key,
  type UploadResult,
} from "./r2";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

/**
 * Get the public URL for R2 assets.
 * Used by server-only modules (e.g. logo.ts) to construct public URLs
 * without importing the full S3 client.
 *
 * Requires R2_PUBLIC_URL in .env (or Railway env vars for prod).
 */
export function getR2PublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) {
    throw new Error("R2_PUBLIC_URL environment variable is not configured");
  }
  return url;
}

function getR2Config(): R2Config {
  const accountId = process.env.CF_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 credentials not configured: CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY required",
    );
  }
  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME environment variable is not configured");
  }
  if (!publicUrl) {
    throw new Error("R2_PUBLIC_URL environment variable is not configured");
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
// Core upload (shared by all upload paths)
// ---------------------------------------------------------------------------

async function putObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const { client, config } = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return { key, url: `${config.publicUrl}/${key}` };
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a file to R2.
 * If `customKey` is provided, it is used as the R2 object key instead of
 * generating one from the filename via `generateR2Key`.
 */
export async function uploadToR2(
  data: Buffer | Uint8Array,
  filename: string,
  mimeType: string,
  customKey?: string,
): Promise<UploadResult> {
  const validationError = validateUpload(
    data instanceof Uint8Array ? data : new Uint8Array(data),
    mimeType,
  );
  if (validationError) {
    throw new Error(validationError);
  }

  const key = customKey ?? generateR2Key(filename);
  const { url } = await putObject(key, data, mimeType);

  return {
    key,
    url,
    size: data.length,
    mimeType,
  };
}

/**
 * Upload a raw buffer to R2 with a pre-determined key.
 * Unlike `uploadToR2`, this skips validation — caller is responsible for
 * ensuring the data is valid (used for server-generated content like resized logos).
 */
export async function uploadBufferToR2(
  key: string,
  body: Uint8Array,
  contentType: string,
): Promise<{ key: string; url: string }> {
  return putObject(key, body, contentType);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// R2Client adapter for MediaService
// ---------------------------------------------------------------------------

import type { R2Client } from "@/services/media-service";

/**
 * Returns an R2Client adapter backed by the S3-compatible R2 client.
 * Suitable for injection into MediaService.upload / MediaService.delete.
 */
export function getR2ClientAdapter(): R2Client {
  return {
    async upload(key: string, data: Uint8Array, contentType: string) {
      await putObject(key, data, contentType);
    },
    async delete(key: string) {
      await deleteFromR2(key);
    },
  };
}

/**
 * Tigris (S3-compatible) object storage client. Used for merchant-uploaded
 * store logos, tracked through the existing `file_assets` table and
 * `merchants.logo_asset_id` column.
 */

import {
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const ENDPOINT = process.env.AWS_ENDPOINT_URL_S3?.trim();
const BUCKET_NAME = process.env.TIGRIS_BUCKET_NAME?.trim();
const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID?.trim();
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY?.trim();

if (!ENDPOINT || !BUCKET_NAME || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
  throw new Error(
    "Tigris object storage is not configured. Set AWS_ENDPOINT_URL_S3, TIGRIS_BUCKET_NAME, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.",
  );
}

export const TIGRIS_BUCKET_NAME = BUCKET_NAME;

export const LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const ALLOWED_LOGO_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
]);

const s3Client = new S3Client({
  region: process.env.AWS_REGION?.trim() || "auto",
  endpoint: ENDPOINT,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

/**
 * Uploads an object to the configured bucket under the given key.
 *
 * Parameters:
 * - key: Storage path, persisted verbatim in `file_assets.storage_path`.
 * - buffer: Raw file bytes.
 * - contentType: MIME type stored alongside the object.
 */
export async function uploadObject(params: {
  buffer: Buffer;
  contentType: string;
  key: string;
}): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Body: params.buffer,
      Bucket: BUCKET_NAME,
      CacheControl: "public, max-age=31536000, immutable",
      ContentType: params.contentType,
      Key: params.key,
    }),
  );
}

/**
 * Fetches a previously uploaded object for streaming back through an app
 * route.
 *
 * Returns:
 * - Object bytes and content type when the key exists in the bucket.
 * - `null` when the key doesn't exist (or the credentials lack list
 *   permission on the bucket, which Tigris also reports as a 403/404).
 */
export async function getObject(params: {
  key: string;
}): Promise<{ buffer: Uint8Array; contentType: string } | null> {
  try {
    const object = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: params.key,
      }),
    );

    if (!object.Body) {
      return null;
    }

    return {
      buffer: await object.Body.transformToByteArray(),
      contentType: object.ContentType ?? "application/octet-stream",
    };
  } catch (error) {
    if (error instanceof NoSuchKey) {
      return null;
    }

    const statusCode = (error as { $metadata?: { httpStatusCode?: number } })
      ?.$metadata?.httpStatusCode;

    if (statusCode === 403 || statusCode === 404) {
      return null;
    }

    throw error;
  }
}

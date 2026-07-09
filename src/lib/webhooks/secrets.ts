/**
 * AES-256-GCM helpers for merchant webhook signing secrets.
 *
 * The database keeps a hash and prefix for operator-visible rotation checks,
 * but outbound delivery needs reversible encryption so the dispatcher can sign
 * real HTTP requests without persisting plaintext.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTION_VERSION = "v1";
const ENCRYPTION_IV_BYTES = 12;
const ENCRYPTION_TAG_BYTES = 16;

export class WebhookSecretConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSecretConfigurationError";
  }
}

/**
 * Encrypts a merchant webhook secret for database storage.
 *
 * Parameters:
 * - plaintextSecret: Raw webhook signing secret shown to the merchant once.
 * - env: Process environment containing the encryption key.
 *
 * Returns:
 * - Versioned ciphertext encoded as dot-separated base64url segments.
 */
export function encryptWebhookSigningSecret(
  plaintextSecret: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const key = getWebhookSecretEncryptionKey(env);
  const iv = randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintextSecret, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/**
 * Decrypts an encrypted merchant webhook secret from the database.
 *
 * Parameters:
 * - encryptedSecret: Ciphertext stored in `webhook_endpoints`.
 * - env: Process environment containing the encryption key.
 *
 * Returns:
 * - Plaintext signing secret for HMAC generation.
 */
export function decryptWebhookSigningSecret(
  encryptedSecret: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const [version, ivEncoded, authTagEncoded, ciphertextEncoded] =
    encryptedSecret.split(".");

  if (
    version !== ENCRYPTION_VERSION ||
    !ivEncoded ||
    !authTagEncoded ||
    !ciphertextEncoded
  ) {
    throw new WebhookSecretConfigurationError(
      "Stored webhook secret is not in the expected encrypted format.",
    );
  }

  const key = getWebhookSecretEncryptionKey(env);
  const iv = Buffer.from(ivEncoded, "base64url");
  const authTag = Buffer.from(authTagEncoded, "base64url");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url");

  if (iv.byteLength !== ENCRYPTION_IV_BYTES) {
    throw new WebhookSecretConfigurationError(
      "Stored webhook secret uses an invalid IV length.",
    );
  }

  if (authTag.byteLength !== ENCRYPTION_TAG_BYTES) {
    throw new WebhookSecretConfigurationError(
      "Stored webhook secret uses an invalid authentication tag length.",
    );
  }

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Resolves the AES-256-GCM key used for webhook secret encryption.
 *
 * Parameters:
 * - env: Process environment containing the key material.
 *
 * Returns:
 * - 32-byte symmetric key.
 *
 * Throws:
 * - `WebhookSecretConfigurationError` when the key is missing or malformed.
 */
export function getWebhookSecretEncryptionKey(
  env: NodeJS.ProcessEnv = process.env,
): Buffer {
  const rawValue = env.MERCHANT_WEBHOOK_SECRET_ENCRYPTION_KEY?.trim();

  if (!rawValue) {
    throw new WebhookSecretConfigurationError(
      "MERCHANT_WEBHOOK_SECRET_ENCRYPTION_KEY must be configured as a 32-byte base64, base64url, hex, or raw string.",
    );
  }

  const decodedCandidates = [
    tryDecodeBuffer(rawValue, "base64"),
    tryDecodeBuffer(rawValue, "base64url"),
    tryDecodeBuffer(rawValue, "hex"),
    Buffer.from(rawValue, "utf8"),
  ].filter((candidate): candidate is Buffer => candidate !== null);

  const matchingKey = decodedCandidates.find(
    (candidate) => candidate.byteLength === 32,
  );

  if (!matchingKey) {
    throw new WebhookSecretConfigurationError(
      "MERCHANT_WEBHOOK_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes for AES-256-GCM.",
    );
  }

  return matchingKey;
}

function tryDecodeBuffer(
  value: string,
  encoding: "base64" | "base64url" | "hex",
): Buffer | null {
  try {
    const decoded = Buffer.from(value, encoding);
    return decoded.byteLength > 0 ? decoded : null;
  } catch {
    return null;
  }
}

/**
 * API key parsing and verification helpers for the public merchant REST API.
 * This module supports the current `ck_<env>_<prefix>_<secret>` contract and
 * preserves compatibility with older `outpay_<env>_...` keys already created
 * before the public API shipped.
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { connectToDatabase } from "@/lib/database/client";

export interface StoredApiKeyRecord {
  environment: "live" | "test";
  id: string;
  keyPrefix: string;
  merchantId: string;
  scopes: string[];
  secretHash: string;
}

export interface ApiKeyAuthRecord {
  apiKeyId: string;
  environment: "live" | "test";
  merchantId: string;
  scopes: string[];
}

interface ParsedApiKeyToken {
  environment: "live" | "test";
  hashInput: string;
  keyPrefix: string;
}

interface AuthenticateApiKeyDependencies {
  findActiveApiKeyByPrefix: (
    keyPrefix: string,
  ) => Promise<StoredApiKeyRecord | null>;
  touchLastUsedAt: (apiKeyId: string) => Promise<void>;
}

/**
 * Hashes the opaque API-key secret segment for database comparison.
 *
 * Parameters:
 * - value: Plaintext secret input extracted from the bearer token.
 *
 * Returns:
 * - Hex-encoded SHA-256 digest.
 */
export function hashApiKeySecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Parses the supported bearer-token formats into lookup components.
 *
 * Parameters:
 * - token: Raw bearer token string without the `Bearer` prefix.
 *
 * Returns:
 * - Normalized lookup data or `null` when the token is malformed.
 */
export function parseApiKeyToken(token: string): ParsedApiKeyToken | null {
  const trimmedToken = token.trim();
  const newFormatMatch = /^ck_(test|live)_([a-f0-9]+)_([a-f0-9]+)$/iu.exec(
    trimmedToken,
  );

  if (newFormatMatch) {
    const environment = newFormatMatch[1] as "live" | "test";
    const publicPrefix = newFormatMatch[2];
    const secret = newFormatMatch[3];

    return {
      environment,
      hashInput: secret,
      keyPrefix: `ck_${environment}_${publicPrefix}`,
    };
  }

  const legacyFormatMatch = /^outpay_(test|live)_[a-f0-9]+$/iu.exec(
    trimmedToken,
  );

  if (legacyFormatMatch) {
    const environment = legacyFormatMatch[1] as "live" | "test";

    return {
      environment,
      hashInput: trimmedToken,
      keyPrefix: trimmedToken.slice(0, 14),
    };
  }

  return null;
}

/**
 * Verifies a bearer token against the stored API-key record without leaking
 * whether the prefix exists or only the secret mismatched.
 *
 * Parameters:
 * - authorizationHeader: Full `Authorization` header value from the request.
 * - dependencies: Lookup and last-used side effects supplied by the caller.
 *
 * Returns:
 * - Resolved merchant/auth context or `null` when authentication fails.
 */
export async function authenticateApiKey(
  authorizationHeader: string | null,
  dependencies: AuthenticateApiKeyDependencies,
): Promise<ApiKeyAuthRecord | null> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  const parsedToken = parseApiKeyToken(authorizationHeader.slice(7));

  if (!parsedToken) {
    return null;
  }

  const record = await dependencies.findActiveApiKeyByPrefix(
    parsedToken.keyPrefix,
  );
  const candidateHash = hashApiKeySecret(parsedToken.hashInput);
  const storedHash = record?.secretHash ?? "0".repeat(candidateHash.length);

  if (storedHash.length !== candidateHash.length) {
    return null;
  }

  const isValid =
    record &&
    record.environment === parsedToken.environment &&
    timingSafeEqual(Buffer.from(candidateHash), Buffer.from(storedHash));

  if (!isValid || !record) {
    return null;
  }

  await dependencies.touchLastUsedAt(record.id);

  return {
    apiKeyId: record.id,
    environment: record.environment,
    merchantId: record.merchantId,
    scopes: record.scopes,
  };
}

/**
 * Resolves the authenticated merchant/API-key context from the live database.
 *
 * Parameters:
 * - request: Incoming route-handler request carrying the Authorization header.
 *
 * Returns:
 * - Merchant-scoped API key context or `null` on uniform authentication
 *   failure.
 */
export async function authenticateApiKeyRequest(
  request: Request,
): Promise<ApiKeyAuthRecord | null> {
  const database = await connectToDatabase();

  try {
    return await authenticateApiKey(request.headers.get("Authorization"), {
      findActiveApiKeyByPrefix: async (keyPrefix) => {
        const rows = await database.sql<
          {
            environment: "live" | "test";
            id: string;
            key_prefix: string;
            merchant_id: string;
            scopes: string[];
            secret_hash: string;
          }[]
        >`
          select
            id::text as id,
            merchant_id::text as merchant_id,
            environment::text as environment,
            key_prefix,
            secret_hash,
            scopes
          from api_keys
          join merchants
            on merchants.id = api_keys.merchant_id
          where api_keys.key_prefix = ${keyPrefix}
            and api_keys.status = 'active'
            and merchants.status = 'active'
          limit 1
        `;
        const apiKey = rows[0];

        return apiKey
          ? {
              environment: apiKey.environment,
              id: apiKey.id,
              keyPrefix: apiKey.key_prefix,
              merchantId: apiKey.merchant_id,
              scopes: apiKey.scopes,
              secretHash: apiKey.secret_hash,
            }
          : null;
      },
      touchLastUsedAt: async (apiKeyId) => {
        await database.sql`
          update api_keys
          set last_used_at = now()
          where id = ${apiKeyId}
        `;
      },
    });
  } finally {
    await database.release();
  }
}

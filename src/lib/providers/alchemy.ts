/**
 * Alchemy provider helpers for webhook verification, Base JSON-RPC access,
 * and Address Activity webhook address registration.
 */

import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { isAddress } from "viem";

const ALCHEMY_BASE_RPC_URL = process.env.ALCHEMY_BASE_RPC_URL?.trim();
const ALCHEMY_WEBHOOK_SIGNING_KEY =
  process.env.ALCHEMY_WEBHOOK_SIGNING_KEY?.trim();
const ALCHEMY_NOTIFY_WEBHOOK_ID =
  process.env.ALCHEMY_NOTIFY_WEBHOOK_ID?.trim();
const ALCHEMY_NOTIFY_API_BASE_URL =
  process.env.ALCHEMY_NOTIFY_API_BASE_URL?.trim() ||
  "https://dashboard.alchemy.com/api";
const ALCHEMY_RPC_TIMEOUT_MS = Number.parseInt(
  process.env.RPC_TIMEOUT_MS?.trim() || "8000",
  10,
);

if (
  !ALCHEMY_BASE_RPC_URL ||
  !ALCHEMY_WEBHOOK_SIGNING_KEY ||
  !ALCHEMY_NOTIFY_WEBHOOK_ID
) {
  throw new Error(
    "Alchemy is not configured. Set ALCHEMY_BASE_RPC_URL, ALCHEMY_WEBHOOK_SIGNING_KEY, and ALCHEMY_NOTIFY_WEBHOOK_ID.",
  );
}

if (!URL.canParse(ALCHEMY_BASE_RPC_URL)) {
  throw new Error("ALCHEMY_BASE_RPC_URL must be a valid absolute URL.");
}

if (!URL.canParse(ALCHEMY_NOTIFY_API_BASE_URL)) {
  throw new Error("ALCHEMY_NOTIFY_API_BASE_URL must be a valid absolute URL.");
}

if (!Number.isInteger(ALCHEMY_RPC_TIMEOUT_MS) || ALCHEMY_RPC_TIMEOUT_MS <= 0) {
  throw new Error("RPC_TIMEOUT_MS must be a positive integer.");
}

const ALCHEMY_CONFIG = {
  baseRpcUrl: ALCHEMY_BASE_RPC_URL,
  notifyApiBaseUrl: `${ALCHEMY_NOTIFY_API_BASE_URL.replace(/\/+$/u, "")}/`,
  notifyWebhookId: ALCHEMY_NOTIFY_WEBHOOK_ID,
  rpcTimeoutMs: ALCHEMY_RPC_TIMEOUT_MS,
  webhookSigningKey: ALCHEMY_WEBHOOK_SIGNING_KEY,
} as const;

export interface AlchemyWebhookRegistrationResult {
  addressCount: number;
  ok: boolean;
  webhookId: string;
}

interface JsonRpcErrorPayload {
  code: number;
  data?: unknown;
  message: string;
}

interface JsonRpcResponse<T> {
  error?: JsonRpcErrorPayload;
  id?: number | string | null;
  jsonrpc?: string;
  result?: T;
}

/**
 * Error raised when an Alchemy JSON-RPC call fails at the HTTP or provider
 * payload layer.
 */
export class AlchemyRpcError extends Error {
  code?: number;
  data?: unknown;

  constructor(message: string, options?: { code?: number; data?: unknown }) {
    super(message);
    this.name = "AlchemyRpcError";
    this.code = options?.code;
    this.data = options?.data;
  }
}

/**
 * Verifies an Alchemy webhook signature over the raw request body.
 *
 * Parameters:
 * - rawBody: Exact UTF-8 request body bytes as a string.
 * - signatureHeader: `X-Alchemy-Signature` header value.
 *
 * Returns:
 * - `true` when the HMAC SHA-256 signature matches the configured signing key.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const normalizedSignature = normalizeAlchemySignature(signatureHeader);

  if (!normalizedSignature) {
    return false;
  }

  const expectedDigest = createHmac("sha256", ALCHEMY_CONFIG.webhookSigningKey)
    .update(rawBody, "utf8")
    .digest("hex");
  const expectedBuffer = Buffer.from(expectedDigest, "hex");
  const receivedBuffer = Buffer.from(normalizedSignature, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Sends a JSON-RPC request to the configured Base Alchemy endpoint.
 *
 * Parameters:
 * - method: JSON-RPC method name.
 * - params: Ordered JSON-RPC parameters.
 *
 * Returns:
 * - Parsed `result` field from the JSON-RPC response.
 *
 * Throws:
 * - `AlchemyRpcError` when the HTTP call fails or Alchemy returns a JSON-RPC
 *   error payload.
 */
export async function alchemyRpcRequest<T>(
  method: string,
  params: readonly unknown[] = [],
): Promise<T> {
  const response = await fetch(ALCHEMY_CONFIG.baseRpcUrl, {
    body: JSON.stringify({
      id: Date.now(),
      jsonrpc: "2.0",
      method,
      params,
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(ALCHEMY_CONFIG.rpcTimeoutMs),
  });

  if (!response.ok) {
    throw new AlchemyRpcError(
      `Alchemy RPC request failed with HTTP ${response.status}.`,
    );
  }

  const payload = (await response.json()) as JsonRpcResponse<T>;

  if (payload.error) {
    throw new AlchemyRpcError(payload.error.message, {
      code: payload.error.code,
      data: payload.error.data,
    });
  }

  if (!("result" in payload)) {
    throw new AlchemyRpcError(
      "Alchemy RPC response did not include a result field.",
    );
  }

  return payload.result as T;
}

/**
 * Registers one or more payout wallet addresses on the configured Alchemy
 * Address Activity webhook.
 *
 * Parameters:
 * - addresses: EVM addresses to add to the webhook watchlist.
 *
 * Returns:
 * - Summary metadata about the registration request.
 *
 * Throws:
 * - `Error` when the input is invalid or the Alchemy management API rejects
 *   the request.
 */
export async function addAlchemyWebhookAddresses(
  addresses: readonly string[],
): Promise<AlchemyWebhookRegistrationResult> {
  const normalizedAddresses = [...new Set(addresses.map(normalizeAddressInput))];

  if (!normalizedAddresses.length) {
    throw new Error("At least one wallet address is required.");
  }

  const response = await fetch(
    new URL("update-webhook-addresses", ALCHEMY_CONFIG.notifyApiBaseUrl),
    {
      body: JSON.stringify({
        addresses_to_add: normalizedAddresses,
        webhook_id: ALCHEMY_CONFIG.notifyWebhookId,
      }),
      headers: {
        authorization: `Bearer ${extractAlchemyApiKey()}`,
        "content-type": "application/json",
        "x-alchemy-token": extractAlchemyApiKey(),
      },
      method: "PATCH",
      signal: AbortSignal.timeout(ALCHEMY_CONFIG.rpcTimeoutMs),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Alchemy address registration failed with HTTP ${response.status}. ${errorBody.slice(0, 300)}`,
    );
  }

  return {
    addressCount: normalizedAddresses.length,
    ok: true,
    webhookId: ALCHEMY_CONFIG.notifyWebhookId,
  };
}

/**
 * Extracts a stable idempotency key for a raw Alchemy delivery.
 *
 * Parameters:
 * - payload: Parsed webhook payload, if JSON parsing succeeded.
 * - rawBody: Exact raw request body.
 *
 * Returns:
 * - Stable provider event identifier derived from payload metadata or a raw
 *   body hash fallback.
 */
export function extractAlchemyProviderEventId(
  payload: unknown,
  rawBody: string,
): string {
  const payloadRecord = asRecord(payload);
  const topLevelId = readString(payloadRecord?.id);

  if (topLevelId) {
    return topLevelId;
  }

  const eventRecord = asRecord(payloadRecord?.event);
  const eventId = readString(eventRecord?.id);

  if (eventId) {
    return eventId;
  }

  const firstActivity = readFirstActivity(payload);
  const uniqueActivityId =
    readString(asRecord(firstActivity)?.uniqueId) ||
    readString(asRecord(firstActivity)?.eventId);

  if (uniqueActivityId) {
    return uniqueActivityId;
  }

  const txHash =
    readString(asRecord(firstActivity)?.hash) ||
    readString(asRecord(firstActivity)?.transactionHash);
  const logIndex = readNumberish(asRecord(firstActivity)?.logIndex);

  if (txHash && logIndex !== null) {
    return `${txHash.toLowerCase()}:${logIndex}`;
  }

  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

/**
 * Wraps the raw delivery body in a JSON-serializable shape that preserves the
 * original bytes for replay even when JSON parsing fails.
 *
 * Parameters:
 * - rawBody: Exact request body.
 * - parsedPayload: Parsed JSON payload, or `null` when parsing failed.
 * - parseError: Human-readable parsing failure details, if any.
 *
 * Returns:
 * - JSON-safe object ready for `provider_events_raw.payload`.
 */
export function buildStoredAlchemyPayload(
  rawBody: string,
  parsedPayload: unknown,
  parseError?: string,
): Record<string, unknown> {
  const payloadRecord = asRecord(parsedPayload);

  if (payloadRecord) {
    return {
      ...payloadRecord,
      __outpayRawBody: rawBody,
    };
  }

  return {
    __outpayParsedBody: parsedPayload ?? null,
    __outpayParseError: parseError ?? null,
    __outpayRawBody: rawBody,
  };
}

/**
 * Registers a single primary payout wallet address with Alchemy.
 *
 * Parameters:
 * - address: EVM address that should be tracked by the Address Activity webhook.
 *
 * Returns:
 * - Management API summary for the registration request.
 */
export async function registerPrimaryWalletWithAlchemy(address: string) {
  return addAlchemyWebhookAddresses([address]);
}

/**
 * Normalizes an address string and rejects invalid EVM wallet inputs before a
 * provider call is attempted.
 *
 * Parameters:
 * - address: Candidate wallet address.
 *
 * Returns:
 * - Lowercase address suitable for provider registration.
 */
function normalizeAddressInput(address: string): string {
  const trimmed = address.trim();

  if (!isAddress(trimmed)) {
    throw new Error(`Invalid EVM wallet address: ${trimmed || "<empty>"}.`);
  }

  return trimmed.toLowerCase();
}

/**
 * Extracts the Alchemy API key from the configured RPC URL so the same project
 * credential can be reused for webhook management calls.
 *
 * Returns:
 * - Non-empty API key suffix parsed from `/v2/<apiKey>`.
 */
function extractAlchemyApiKey(): string {
  const pathname = new URL(ALCHEMY_CONFIG.baseRpcUrl).pathname;
  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments.at(-1)?.trim();

  if (!lastSegment) {
    throw new Error(
      "Unable to extract the Alchemy API key from ALCHEMY_BASE_RPC_URL.",
    );
  }

  return lastSegment;
}

/**
 * Parses the webhook signature header into a lowercase hex digest.
 *
 * Parameters:
 * - signatureHeader: Raw incoming header value.
 *
 * Returns:
 * - Lowercase hex digest, or `null` when the header is absent/malformed.
 */
function normalizeAlchemySignature(signatureHeader: string | null): string | null {
  const trimmed = signatureHeader?.trim();

  if (!trimmed) {
    return null;
  }

  const withoutPrefix = trimmed.replace(/^sha256=/i, "").trim().toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(withoutPrefix)) {
    return null;
  }

  return withoutPrefix;
}

/**
 * Reads the first activity object from the common Alchemy Address Activity
 * payload locations.
 *
 * Parameters:
 * - payload: Parsed webhook payload.
 *
 * Returns:
 * - First activity object when present, otherwise `null`.
 */
function readFirstActivity(payload: unknown): Record<string, unknown> | null {
  const payloadRecord = asRecord(payload);
  const topLevelActivities = payloadRecord?.activity;

  if (Array.isArray(topLevelActivities)) {
    return asRecord(topLevelActivities[0]);
  }

  const eventRecord = asRecord(payloadRecord?.event);
  const nestedActivities = eventRecord?.activity;

  if (Array.isArray(nestedActivities)) {
    return asRecord(nestedActivities[0]);
  }

  return null;
}

/**
 * Narrows unknown values to object records.
 *
 * Parameters:
 * - value: Candidate value.
 *
 * Returns:
 * - Object record when the value is a plain object, otherwise `null`.
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

/**
 * Reads a string field from an unknown value.
 *
 * Parameters:
 * - value: Candidate field value.
 *
 * Returns:
 * - Trimmed string when valid, otherwise `null`.
 */
function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Parses a number-like field into a decimal string.
 *
 * Parameters:
 * - value: Candidate number/string input.
 *
 * Returns:
 * - Decimal string representation, or `null` when unavailable.
 */
function readNumberish(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

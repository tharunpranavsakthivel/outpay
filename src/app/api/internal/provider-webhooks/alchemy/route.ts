/**
 * Alchemy Address Activity webhook intake endpoint. Verifies authenticity,
 * stores raw payloads idempotently, and schedules post-response normalization.
 */

import { createHash } from "node:crypto";
import { after } from "next/server";
import { jsonError } from "@/lib/dashboard/http";
import { connectToDatabase } from "@/lib/database/client";
import { normalizeAlchemyAddressActivityPayload } from "@/lib/payments/normalize-event";
import {
  buildStoredAlchemyPayload,
  extractAlchemyProviderEventId,
  verifyWebhookSignature,
} from "@/lib/providers/alchemy";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 300;
const rateLimitBuckets = new Map<string, { count: number; windowStartedAt: number }>();

/**
 * Handles incoming Alchemy webhook deliveries.
 *
 * Parameters:
 * - request: Raw route-handler request containing the signed webhook payload.
 *
 * Returns:
 * - `200` after durable storage and async follow-up scheduling succeed.
 * - `401` when the signature is invalid.
 * - `429` when the caller exceeds the provider-specific intake rate limit.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-alchemy-signature");
  const sourceIp = readSourceIp(request);

  if (!consumeRateLimitToken(sourceIp)) {
    logAlchemyWebhook("warn", "Alchemy webhook rate limit exceeded", {
      sourceIp,
    });
    return jsonError(
      429,
      "ALCHEMY_WEBHOOK_RATE_LIMITED",
      "Too many provider webhook requests. Retry later.",
    );
  }

  let parsedPayload: unknown = null;
  let parseError: string | undefined;

  try {
    parsedPayload = rawBody ? JSON.parse(rawBody) : null;
  } catch (error) {
    parseError =
      error instanceof Error ? error.message : "Unable to parse webhook body.";
  }

  const signatureValid = verifyWebhookSignature(rawBody, signatureHeader);
  const providerEventId = signatureValid
    ? extractAlchemyProviderEventId(parsedPayload, rawBody)
    : hashRawBody(rawBody);
  const storedPayload = buildStoredAlchemyPayload(
    rawBody,
    parsedPayload,
    parseError,
  );

  try {
    const insertedRawEventId = await persistRawAlchemyEvent({
      payload: storedPayload,
      providerEventId,
      signatureValid,
    });

    if (!signatureValid) {
      logAlchemyWebhook("warn", "Rejected Alchemy webhook with invalid signature", {
        providerEventId,
        signaturePresent: Boolean(signatureHeader),
        sourceIp,
      });

      return jsonError(
        401,
        "ALCHEMY_SIGNATURE_INVALID",
        "Alchemy webhook signature verification failed.",
      );
    }

    if (insertedRawEventId && parseError === undefined) {
      after(async () => {
        try {
          const normalizedEvents =
            normalizeAlchemyAddressActivityPayload(parsedPayload);
          await enqueueNormalizedAlchemyEvents({
            normalizedEvents,
            rawEventId: insertedRawEventId,
          });
        } catch (error) {
          logAlchemyWebhook(
            "error",
            "Alchemy webhook async follow-up failed",
            {
              error:
                error instanceof Error ? error.message : "Unknown async error",
              providerEventId,
            },
          );
        }
      });
    } else if (parseError) {
      after(() => {
        logAlchemyWebhook("warn", "Stored malformed Alchemy webhook payload", {
          parseError,
          providerEventId,
        });
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    logAlchemyWebhook("error", "Alchemy webhook intake failed", {
      error: error instanceof Error ? error.message : "Unknown intake error",
      providerEventId,
      signatureValid,
      sourceIp,
    });

    return jsonError(
      500,
      "ALCHEMY_WEBHOOK_INTAKE_FAILED",
      "Unable to store the provider webhook delivery.",
    );
  }
}

/**
 * Persists a raw Alchemy provider event idempotently.
 *
 * Parameters:
 * - payload: JSON-safe stored payload object.
 * - providerEventId: Stable idempotency key for the delivery.
 * - signatureValid: Whether signature verification succeeded.
 *
 * Returns:
 * - Inserted `provider_events_raw.id`, or `null` when the delivery was a
 *   duplicate and the unique constraint ignored it.
 */
async function persistRawAlchemyEvent(input: {
  payload: Record<string, unknown>;
  providerEventId: string;
  signatureValid: boolean;
}): Promise<string | null> {
  const database = await connectToDatabase();

  try {
    const rows = await database.sql<{ id: string }[]>`
      insert into provider_events_raw (
        provider,
        provider_event_id,
        chain,
        payload,
        signature_valid
      ) values (
        'alchemy',
        ${input.providerEventId},
        'base',
        ${JSON.stringify(input.payload)}::jsonb,
        ${input.signatureValid}
      )
      on conflict (provider, provider_event_id) do nothing
      returning id::text as id
    `;

    return rows[0]?.id ?? null;
  } finally {
    await database.release();
  }
}

/**
 * Schedules normalized chain events for downstream processing. T-7 will replace
 * this stub with a real queue publisher.
 *
 * Parameters:
 * - normalizedEvents: Events extracted from the verified webhook payload.
 * - rawEventId: `provider_events_raw.id` for audit linkage.
 */
async function enqueueNormalizedAlchemyEvents(input: {
  normalizedEvents: ReturnType<typeof normalizeAlchemyAddressActivityPayload>;
  rawEventId: string;
}): Promise<void> {
  logAlchemyWebhook("info", "Alchemy webhook normalized for downstream queue", {
    eventCount: input.normalizedEvents.length,
    queue: "chain-events",
    rawEventId: input.rawEventId,
    skippedEnqueue: true,
  });
}

/**
 * Applies a lightweight, separate in-process rate limit for Alchemy deliveries.
 *
 * Parameters:
 * - sourceIp: Provider source IP address or fallback identifier.
 *
 * Returns:
 * - `true` when the request is allowed, otherwise `false`.
 */
function consumeRateLimitToken(sourceIp: string): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(sourceIp);

  if (!bucket || now - bucket.windowStartedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(sourceIp, {
      count: 1,
      windowStartedAt: now,
    });
    pruneOldRateLimitBuckets(now);
    return true;
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  bucket.count += 1;
  return true;
}

/**
 * Removes expired in-memory rate-limit buckets to keep the module cache bounded.
 *
 * Parameters:
 * - now: Current wall-clock timestamp in milliseconds.
 */
function pruneOldRateLimitBuckets(now: number): void {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (now - bucket.windowStartedAt >= RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitBuckets.delete(key);
    }
  }
}

/**
 * Reads a best-effort source IP identifier from common proxy headers.
 *
 * Parameters:
 * - request: Incoming route request.
 *
 * Returns:
 * - Source IP string used for logging and rate limiting.
 */
function readSourceIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

/**
 * Hashes the raw request body for security logging and invalid-signature
 * idempotency without trusting the payload contents.
 *
 * Parameters:
 * - rawBody: Exact request body string.
 *
 * Returns:
 * - SHA-256 hex digest of the raw body.
 */
function hashRawBody(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}

/**
 * Emits a structured JSON log entry for the Alchemy webhook intake path.
 *
 * Parameters:
 * - level: Log severity.
 * - message: Human-readable event message.
 * - metadata: Structured metadata for diagnostics.
 */
function logAlchemyWebhook(
  level: "error" | "info" | "warn",
  message: string,
  metadata: Record<string, unknown>,
): void {
  const payload = JSON.stringify({
    level,
    message,
    module: "alchemy-webhook-intake",
    timestamp: new Date().toISOString(),
    ...metadata,
  });

  if (level === "error") {
    console.error(payload);
    return;
  }

  if (level === "warn") {
    console.warn(payload);
    return;
  }

  console.info(payload);
}

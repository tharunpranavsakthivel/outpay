/**
 * HTTP dispatch helpers for merchant webhooks.
 *
 * The webhook worker uses this module to build signed headers, enforce a
 * request timeout, refuse redirects, and capture response metadata for the
 * dashboard delivery history.
 */

import { buildSignedWebhookHeaders, OUTPAY_WEBHOOK_HEADER_NAMES } from "./sign";

const WEBHOOK_TIMEOUT_MS = 10_000;
const RESPONSE_EXCERPT_LIMIT = 1_000;

export type WebhookAttemptOutcome =
  | "http_error"
  | "network_error"
  | "success"
  | "timeout";

export interface WebhookDispatchResult {
  durationMs: number;
  outcome: WebhookAttemptOutcome;
  requestHeaders: Record<string, string>;
  requestTimestamp: string;
  responseBodyExcerpt: string | null;
  responseStatusCode: number | null;
}

/**
 * Sends a signed merchant webhook to the configured destination.
 *
 * Parameters:
 * - body: Exact JSON body string stored for the webhook event.
 * - deliveryId: Stable delivery-attempt identifier for traceability.
 * - eventType: Event type included in the signed headers.
 * - secret: Plaintext merchant signing secret.
 * - url: Destination webhook URL.
 *
 * Returns:
 * - Outcome, timing, request headers, and response excerpt for persistence.
 */
export async function dispatchWebhookRequest(input: {
  body: string;
  deliveryId: string;
  eventType: string;
  secret: string;
  url: string;
}): Promise<WebhookDispatchResult> {
  const requestTimestamp = Math.floor(Date.now() / 1_000).toString();
  const requestHeaders = buildSignedWebhookHeaders({
    body: input.body,
    deliveryId: input.deliveryId,
    eventType: input.eventType,
    secret: input.secret,
    timestamp: requestTimestamp,
  });
  const startedAt = performance.now();

  try {
    const response = await fetch(input.url, {
      body: input.body,
      headers: requestHeaders,
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    const durationMs = Math.max(1, Math.round(performance.now() - startedAt));
    const responseBodyExcerpt = truncateResponseBody(await response.text());

    return {
      durationMs,
      outcome: response.ok ? "success" : "http_error",
      requestHeaders: sanitizeRequestHeaders(requestHeaders),
      requestTimestamp,
      responseBodyExcerpt,
      responseStatusCode: response.status,
    };
  } catch (error) {
    const durationMs = Math.max(1, Math.round(performance.now() - startedAt));

    return {
      durationMs,
      outcome: isTimeoutError(error) ? "timeout" : "network_error",
      requestHeaders: sanitizeRequestHeaders(requestHeaders),
      requestTimestamp,
      responseBodyExcerpt:
        error instanceof Error
          ? truncateResponseBody(error.message)
          : "Unknown webhook dispatch failure.",
      responseStatusCode: null,
    };
  }
}

/**
 * Returns the four signed header names emitted by Outpay webhooks.
 */
export function getSignedWebhookHeaderNames(): readonly string[] {
  return Object.values(OUTPAY_WEBHOOK_HEADER_NAMES);
}

function sanitizeRequestHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  return {
    ...headers,
  };
}

function truncateResponseBody(body: string): string | null {
  const trimmedBody = body.trim();

  if (!trimmedBody) {
    return null;
  }

  return trimmedBody.slice(0, RESPONSE_EXCERPT_LIMIT);
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    error.message.toLowerCase().includes("timed out")
  );
}

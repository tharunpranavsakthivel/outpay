/**
 * HMAC signing helpers for merchant webhook payloads.
 *
 * This module implements the `X-Outpay-*` signature format used by outbound
 * merchant webhooks so merchants can verify authenticity and replay windows.
 */

import { createHmac } from "node:crypto";

export const OUTPAY_WEBHOOK_HEADER_NAMES = {
  deliveryId: "X-Outpay-Delivery-ID",
  event: "X-Outpay-Event",
  signature: "X-Outpay-Signature",
  timestamp: "X-Outpay-Timestamp",
} as const;

/**
 * Builds the canonical webhook signature for a payload body.
 *
 * Parameters:
 * - secret: Plaintext webhook signing secret.
 * - timestamp: Unix timestamp string sent in the signed headers.
 * - body: Exact JSON request body string sent over HTTP.
 *
 * Returns:
 * - `v1=<hex>` HMAC-SHA256 signature over `timestamp.body`.
 */
export function signPayload(
  secret: string,
  timestamp: string,
  body: string,
): string {
  const digest = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  return `v1=${digest}`;
}

/**
 * Returns the signed outbound headers for an Outpay webhook request.
 *
 * Parameters:
 * - body: Exact JSON request body string.
 * - deliveryId: Stable delivery-attempt identifier for observability.
 * - eventType: Event type emitted to the merchant.
 * - secret: Plaintext webhook signing secret.
 * - timestamp: Unix timestamp string for replay validation.
 *
 * Returns:
 * - Header record ready for `fetch`.
 */
export function buildSignedWebhookHeaders(input: {
  body: string;
  deliveryId: string;
  eventType: string;
  secret: string;
  timestamp: string;
}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "User-Agent": "Outpay-Webhooks/1.0",
    [OUTPAY_WEBHOOK_HEADER_NAMES.deliveryId]: input.deliveryId,
    [OUTPAY_WEBHOOK_HEADER_NAMES.event]: input.eventType,
    [OUTPAY_WEBHOOK_HEADER_NAMES.signature]: signPayload(
      input.secret,
      input.timestamp,
      input.body,
    ),
    [OUTPAY_WEBHOOK_HEADER_NAMES.timestamp]: input.timestamp,
  };
}

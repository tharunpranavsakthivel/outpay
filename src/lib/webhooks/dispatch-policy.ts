/**
 * Lifecycle policy for outbound merchant webhook delivery.
 *
 * This module keeps the worker's final delivery decision pure and testable so
 * disabled endpoints and inactive merchants cannot reach the HTTP dispatcher.
 */

/**
 * Determines whether a webhook job may send an outbound request.
 *
 * Parameters:
 * - input.merchantStatus: Persisted merchant lifecycle status.
 * - input.endpointStatus: Persisted webhook endpoint lifecycle status.
 *
 * Returns:
 * - `true` only when both the merchant and endpoint are active.
 */
export function isWebhookDispatchAllowed(input: {
  endpointStatus: string;
  merchantStatus: string;
}): boolean {
  return input.merchantStatus === "active" && input.endpointStatus === "active";
}

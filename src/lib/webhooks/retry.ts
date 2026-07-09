/**
 * Shared retry policy helpers for merchant webhook delivery jobs.
 *
 * This module centralizes the architecture-defined retry schedule so the queue
 * layer, dispatcher worker, and tests all derive timing and attempt numbers
 * from one source of truth.
 */

export const WEBHOOK_DELIVERY_MAX_ATTEMPTS = 7;
export const WEBHOOK_ENDPOINT_AUTO_DISABLE_FAILURE_THRESHOLD = 3;

const WEBHOOK_RETRY_DELAYS_MS = [
  0, 30_000, 120_000, 600_000, 1_800_000, 7_200_000, 43_200_000,
] as const;

/**
 * Returns the within-cycle attempt number for a BullMQ job execution.
 *
 * Parameters:
 * - attemptsMade: BullMQ's completed-attempt count before the current run.
 *
 * Returns:
 * - One-based attempt number within the current seven-attempt delivery cycle.
 */
export function getWebhookCycleAttemptNumber(attemptsMade: number): number {
  return attemptsMade + 1;
}

/**
 * Returns the persisted delivery-attempt number stored in PostgreSQL.
 *
 * Parameters:
 * - baseAttemptNumber: First attempt number reserved for the current queue job.
 * - attemptsMade: BullMQ's completed-attempt count before the current run.
 *
 * Returns:
 * - One-based attempt number that remains unique across manual retries.
 */
export function getPersistedWebhookAttemptNumber(
  baseAttemptNumber: number,
  attemptsMade: number,
): number {
  return baseAttemptNumber + attemptsMade;
}

/**
 * Returns the delay before the next retry after a failed attempt.
 *
 * Parameters:
 * - cycleAttemptNumber: One-based attempt number within the current cycle.
 *
 * Returns:
 * - Milliseconds until the next retry, or `null` when the cycle is exhausted.
 */
export function getWebhookRetryDelayMsAfterFailure(
  cycleAttemptNumber: number,
): number | null {
  return WEBHOOK_RETRY_DELAYS_MS[cycleAttemptNumber] ?? null;
}

/**
 * Returns whether another automatic retry remains in the current cycle.
 *
 * Parameters:
 * - cycleAttemptNumber: One-based attempt number within the current cycle.
 *
 * Returns:
 * - `true` when BullMQ should still have a scheduled retry remaining.
 */
export function hasWebhookRetryRemaining(cycleAttemptNumber: number): boolean {
  return cycleAttemptNumber < WEBHOOK_DELIVERY_MAX_ATTEMPTS;
}

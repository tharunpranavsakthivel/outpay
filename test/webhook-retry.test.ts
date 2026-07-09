/**
 * Unit tests for merchant webhook retry policy helpers.
 */

import { describe, expect, it } from "bun:test";
import {
  getPersistedWebhookAttemptNumber,
  getWebhookCycleAttemptNumber,
  getWebhookRetryDelayMsAfterFailure,
  hasWebhookRetryRemaining,
  WEBHOOK_DELIVERY_MAX_ATTEMPTS,
} from "@/lib/webhooks/retry";

describe("webhook retry policy", () => {
  it("matches the architecture retry delays after each failure", () => {
    expect(getWebhookRetryDelayMsAfterFailure(1)).toBe(30_000);
    expect(getWebhookRetryDelayMsAfterFailure(2)).toBe(120_000);
    expect(getWebhookRetryDelayMsAfterFailure(3)).toBe(600_000);
    expect(getWebhookRetryDelayMsAfterFailure(4)).toBe(1_800_000);
    expect(getWebhookRetryDelayMsAfterFailure(5)).toBe(7_200_000);
    expect(getWebhookRetryDelayMsAfterFailure(6)).toBe(43_200_000);
    expect(getWebhookRetryDelayMsAfterFailure(7)).toBeNull();
  });

  it("derives cycle and persisted attempt numbers for manual retries", () => {
    expect(getWebhookCycleAttemptNumber(0)).toBe(1);
    expect(getWebhookCycleAttemptNumber(3)).toBe(4);
    expect(getPersistedWebhookAttemptNumber(1, 0)).toBe(1);
    expect(getPersistedWebhookAttemptNumber(1, 4)).toBe(5);
    expect(getPersistedWebhookAttemptNumber(8, 0)).toBe(8);
    expect(getPersistedWebhookAttemptNumber(8, 2)).toBe(10);
  });

  it("stops retrying after the seventh cycle attempt", () => {
    expect(WEBHOOK_DELIVERY_MAX_ATTEMPTS).toBe(7);
    expect(hasWebhookRetryRemaining(1)).toBe(true);
    expect(hasWebhookRetryRemaining(6)).toBe(true);
    expect(hasWebhookRetryRemaining(7)).toBe(false);
  });
});

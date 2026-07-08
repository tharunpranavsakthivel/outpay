/**
 * Unit tests for the provider health monitor worker and alert fan-out.
 */

import { describe, expect, it, mock } from "bun:test";

process.env.ALCHEMY_BASE_RPC_URL =
  process.env.ALCHEMY_BASE_RPC_URL ||
  "https://base-mainnet.g.alchemy.com/v2/test-api-key";
process.env.ALCHEMY_WEBHOOK_SIGNING_KEY =
  process.env.ALCHEMY_WEBHOOK_SIGNING_KEY || "alchemy-test-signing-key";
process.env.ALCHEMY_NOTIFY_WEBHOOK_ID =
  process.env.ALCHEMY_NOTIFY_WEBHOOK_ID || "wh_test_123";
process.env.CHAINSTACK_BASE_RPC_URL =
  process.env.CHAINSTACK_BASE_RPC_URL ||
  "https://base-mainnet.core.chainstack.com/test";

const { buildProviderHealthAlertPayload, createProviderHealthWorker } =
  await import("@/../workers/provider-health");

describe("provider health worker", () => {
  it("queues one alert for each provider state transition", async () => {
    const enqueueAlert = mock(async () => undefined);
    const logEvent = mock(() => undefined);
    const worker = createProviderHealthWorker({
      enqueueAlert,
      logEvent,
      runChecks: async () => [
        {
          blockNumber: 12_345_678n,
          chain: "base" as const,
          checkedAt: new Date("2026-07-08T12:10:00.000Z"),
          error: "request timeout",
          latencyMs: null,
          previousStatus: "healthy" as const,
          provider: "alchemy" as const,
          rollingWindow: {
            consecutiveFailures: 6,
            consecutiveSuccesses: 0,
            errorCount: 6,
            errorRate: 1,
            highLatencyCount: 0,
            highLatencyRate: 0,
            observationCount: 6,
            rateLimitCount: 0,
            rateLimitRate: 0,
            timeoutCount: 3,
            timeoutRate: 0.5,
          },
          status: "degraded" as const,
          transition: {
            nextStatus: "degraded" as const,
            previousStatus: "healthy" as const,
          },
        },
        {
          blockNumber: 12_345_679n,
          chain: "base" as const,
          checkedAt: new Date("2026-07-08T12:10:00.000Z"),
          error: null,
          latencyMs: 180,
          previousStatus: "healthy" as const,
          provider: "chainstack" as const,
          rollingWindow: {
            consecutiveFailures: 0,
            consecutiveSuccesses: 4,
            errorCount: 0,
            errorRate: 0,
            highLatencyCount: 0,
            highLatencyRate: 0,
            observationCount: 4,
            rateLimitCount: 0,
            rateLimitRate: 0,
            timeoutCount: 0,
            timeoutRate: 0,
          },
          status: "healthy" as const,
          transition: null,
        },
      ],
    });

    const summary = await worker.runCycle();

    expect(summary.alertsQueued).toBe(1);
    expect(enqueueAlert).toHaveBeenCalledTimes(1);
    expect(enqueueAlert.mock.calls[0]?.[0]).toMatchObject({
      dedupeKey: "provider-health:alchemy:degraded",
      severity: "warning",
      source: "alchemy",
    });
  });

  it("maps down transitions to critical alert severity", () => {
    const payload = buildProviderHealthAlertPayload({
      blockNumber: null,
      chain: "base",
      checkedAt: new Date("2026-07-08T12:12:00.000Z"),
      error: "request timeout",
      latencyMs: null,
      previousStatus: "degraded",
      provider: "alchemy",
      rollingWindow: {
        consecutiveFailures: 4,
        consecutiveSuccesses: 0,
        errorCount: 6,
        errorRate: 1,
        highLatencyCount: 0,
        highLatencyRate: 0,
        observationCount: 6,
        rateLimitCount: 0,
        rateLimitRate: 0,
        timeoutCount: 4,
        timeoutRate: 0.66,
      },
      status: "down",
      transition: {
        nextStatus: "down",
        previousStatus: "degraded",
      },
    });

    expect(payload).toMatchObject({
      dedupeKey: "provider-health:alchemy:down",
      severity: "critical",
      source: "alchemy",
    });
    expect(payload.message).toContain("from degraded to down");
  });
});

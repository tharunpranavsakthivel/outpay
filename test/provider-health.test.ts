/**
 * Unit tests for the provider-health status state machine.
 */

import { describe, expect, it } from "bun:test";

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

const { deriveProviderHealthStatus } = await import(
  "@/lib/providers/health"
);

describe("provider health state machine", () => {
  it("marks providers as rate_limited on rate-limit failures", () => {
    const checkedAt = new Date("2026-07-08T12:00:00.000Z");

    expect(
      deriveProviderHealthStatus({
        currentObservation: {
          checkedAt,
          error: "HTTP 429 rate limit",
          latencyMs: null,
          ok: false,
          provider: "alchemy",
          rateLimited: true,
          status: null,
          timedOut: false,
        },
        previousStatus: "healthy",
        recentObservations: [],
      }),
    ).toBe("rate_limited");
  });

  it("marks providers as down after sustained timeout failures", () => {
    const checkedAt = new Date("2026-07-08T12:00:30.000Z");

    expect(
      deriveProviderHealthStatus({
        currentObservation: {
          checkedAt,
          error: "request timeout",
          latencyMs: null,
          ok: false,
          provider: "alchemy",
          rateLimited: false,
          status: null,
          timedOut: true,
        },
        previousStatus: "degraded",
        recentObservations: [
          {
            checkedAt: new Date("2026-07-08T12:00:20.000Z"),
            error: "request timeout",
            latencyMs: null,
            ok: false,
            provider: "alchemy",
            rateLimited: false,
            status: "degraded",
            timedOut: true,
          },
          {
            checkedAt: new Date("2026-07-08T12:00:10.000Z"),
            error: "request timeout",
            latencyMs: null,
            ok: false,
            provider: "alchemy",
            rateLimited: false,
            status: "degraded",
            timedOut: true,
          },
        ],
      }),
    ).toBe("down");
  });

  it("keeps providers degraded after more than five failures in two minutes", () => {
    const checkedAt = new Date("2026-07-08T12:01:00.000Z");

    expect(
      deriveProviderHealthStatus({
        currentObservation: {
          checkedAt,
          error: null,
          latencyMs: 450,
          ok: true,
          provider: "alchemy",
          rateLimited: false,
          status: null,
          timedOut: false,
        },
        previousStatus: "healthy",
        recentObservations: Array.from({ length: 6 }, (_, index) => ({
          checkedAt: new Date(checkedAt.getTime() - (index + 1) * 10_000),
          error: "upstream error",
          latencyMs: null,
          ok: false,
          provider: "alchemy" as const,
          rateLimited: false,
          status: "degraded" as const,
          timedOut: false,
        })),
      }),
    ).toBe("degraded");
  });

  it("moves a recovered provider into recovering before healthy", () => {
    const checkedAt = new Date("2026-07-08T12:02:00.000Z");

    expect(
      deriveProviderHealthStatus({
        currentObservation: {
          checkedAt,
          error: null,
          latencyMs: 300,
          ok: true,
          provider: "chainstack",
          rateLimited: false,
          status: null,
          timedOut: false,
        },
        previousStatus: "down",
        recentObservations: [
          {
            checkedAt: new Date("2026-07-08T12:01:50.000Z"),
            error: null,
            latencyMs: 310,
            ok: true,
            provider: "chainstack",
            rateLimited: false,
            status: "recovering",
            timedOut: false,
          },
          {
            checkedAt: new Date("2026-07-08T12:01:40.000Z"),
            error: null,
            latencyMs: 320,
            ok: true,
            provider: "chainstack",
            rateLimited: false,
            status: "recovering",
            timedOut: false,
          },
        ],
      }),
    ).toBe("recovering");
  });

  it("returns a recovered provider to healthy after five consecutive good checks", () => {
    const checkedAt = new Date("2026-07-08T12:03:00.000Z");

    expect(
      deriveProviderHealthStatus({
        currentObservation: {
          checkedAt,
          error: null,
          latencyMs: 250,
          ok: true,
          provider: "chainstack",
          rateLimited: false,
          status: null,
          timedOut: false,
        },
        previousStatus: "recovering",
        recentObservations: Array.from({ length: 4 }, (_, index) => ({
          checkedAt: new Date(checkedAt.getTime() - (index + 1) * 10_000),
          error: null,
          latencyMs: 250,
          ok: true,
          provider: "chainstack" as const,
          rateLimited: false,
          status: "recovering" as const,
          timedOut: false,
        })),
      }),
    ).toBe("healthy");
  });
});

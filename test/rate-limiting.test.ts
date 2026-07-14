/**
 * Unit tests for the shared route rate-limiting helper.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import {
  buildRateLimitKey,
  consumeRateLimit,
  createRateLimitHeaders,
  formatRateLimitMessage,
  getInMemoryRateLimitStore,
  InMemorySlidingWindowRateLimitStore,
  isSignupRateLimitEnabled,
  RATE_LIMIT_POLICIES,
  type RateLimitStorage,
} from "@/lib/security/rate-limit";

describe("route rate limiting", () => {
  beforeEach(() => {
    getInMemoryRateLimitStore().reset();
  });

  test("keeps signup rate limiting disabled unless explicitly enabled", () => {
    expect(
      isSignupRateLimitEnabled({ OUTPAY_SIGNUP_RATE_LIMIT_ENABLED: "false" }),
    ).toBe(false);
    expect(isSignupRateLimitEnabled({})).toBe(false);
    expect(
      isSignupRateLimitEnabled({ OUTPAY_SIGNUP_RATE_LIMIT_ENABLED: "true" }),
    ).toBe(true);
  });

  test("blocks once a rolling window exceeds the configured limit", async () => {
    let now = 1_000;
    const store = new InMemorySlidingWindowRateLimitStore(() => now);
    const policy = {
      ...RATE_LIMIT_POLICIES.defaultPublicRoute,
      maxRequests: 2,
      windowMs: 60_000,
    };
    const key = buildRateLimitKey({
      policy,
      scopeType: "ip",
      scopeValue: "203.0.113.10",
    });

    expect(
      await consumeRateLimit({
        key,
        policy,
        routeId: "/test/limit-1",
        storage: store,
      }),
    ).toMatchObject({ allowed: true, retryAfterSeconds: 0 });
    expect(
      await consumeRateLimit({
        key,
        policy,
        routeId: "/test/limit-2",
        storage: store,
      }),
    ).toMatchObject({ allowed: true, retryAfterSeconds: 0 });

    const blocked = await consumeRateLimit({
      key,
      policy,
      routeId: "/test/limit-3",
      storage: store,
    });

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);

    now += 60_001;

    expect(
      await consumeRateLimit({
        key,
        policy,
        routeId: "/test/limit-reset",
        storage: store,
      }),
    ).toMatchObject({ allowed: true, retryAfterSeconds: 0 });
  });

  test("scopes public checkout polling by checkout id as well as caller", async () => {
    const store = new InMemorySlidingWindowRateLimitStore(() => 5_000);
    const policy = {
      ...RATE_LIMIT_POLICIES.publicCheckoutStatus,
      maxRequests: 1,
    };
    const firstCheckoutKey = buildRateLimitKey({
      policy,
      resourceId: "chk_alpha",
      scopeType: "ip",
      scopeValue: "203.0.113.20",
    });
    const secondCheckoutKey = buildRateLimitKey({
      policy,
      resourceId: "chk_beta",
      scopeType: "ip",
      scopeValue: "203.0.113.20",
    });

    await consumeRateLimit({
      key: firstCheckoutKey,
      policy,
      routeId: "/api/public/checkouts/chk_alpha",
      storage: store,
    });

    const secondCheckoutDecision = await consumeRateLimit({
      key: secondCheckoutKey,
      policy,
      routeId: "/api/public/checkouts/chk_beta",
      storage: store,
    });

    expect(secondCheckoutDecision.allowed).toBe(true);
  });

  test("fails open for routes that should not hard-block traffic on store errors", async () => {
    const failingStore: RateLimitStorage = {
      consume: async () => {
        throw new Error("redis unavailable");
      },
    };

    const decision = await consumeRateLimit({
      key: "rate-limit:test",
      policy: RATE_LIMIT_POLICIES.publicCheckoutStatus,
      routeId: "/api/public/checkouts/[id]",
      storage: failingStore,
    });

    expect(decision).toMatchObject({
      allowed: true,
      retryAfterSeconds: 0,
      storeFailure: true,
    });
  });

  test("fails closed for login when the backing store is unavailable", async () => {
    const failingStore: RateLimitStorage = {
      consume: async () => {
        throw new Error("redis unavailable");
      },
    };

    const decision = await consumeRateLimit({
      key: "rate-limit:auth-login",
      policy: RATE_LIMIT_POLICIES.authLogin,
      routeId: "/api/auth/sign-in/email",
      storage: failingStore,
    });

    expect(decision).toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
      storeFailure: true,
    });
    expect(createRateLimitHeaders(decision.retryAfterSeconds)).toEqual({
      "Retry-After": "60",
      "X-Retry-After": "60",
    });
    expect(formatRateLimitMessage(RATE_LIMIT_POLICIES.authLogin, 60)).toBe(
      "Too many login attempts. Try again in 60s.",
    );
  });
});

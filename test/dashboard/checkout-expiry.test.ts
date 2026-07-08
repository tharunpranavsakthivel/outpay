/**
 * Unit tests for shared checkout-expiry policy helpers used by dashboard and
 * public checkout reads.
 */

import { describe, expect, it } from "bun:test";
import {
  calculateCheckoutExpiryFromNow,
  getCheckoutExpiryPolicy,
  resolveCheckoutExpiryResolution,
} from "@/lib/dashboard/checkout-expiry";

describe("checkout expiry policy helpers", () => {
  it("uses defaults when no environment overrides are present", () => {
    const policy = getCheckoutExpiryPolicy({});

    expect(policy).toEqual({
      detectedGraceSeconds: 600,
      ttlSeconds: 1800,
    });
  });

  it("accepts test-friendly second-based overrides", () => {
    const policy = getCheckoutExpiryPolicy({
      OUTPAY_CHECKOUT_DETECTED_GRACE_SECONDS: "5",
      OUTPAY_CHECKOUT_TTL_SECONDS: "1",
    });

    expect(policy).toEqual({
      detectedGraceSeconds: 5,
      ttlSeconds: 1,
    });
  });

  it("backfills legacy null expiry timestamps from created_at and expires pending checkouts on the next read", () => {
    const policy = getCheckoutExpiryPolicy({
      OUTPAY_CHECKOUT_TTL_SECONDS: "1",
    });
    const createdAt = new Date("2026-07-08T10:00:00.000Z");
    const resolution = resolveCheckoutExpiryResolution({
      createdAt,
      expiresAt: null,
      now: new Date("2026-07-08T10:00:01.100Z"),
      policy,
      status: "pending",
    });

    expect(
      calculateCheckoutExpiryFromNow(createdAt, policy).toISOString(),
    ).toBe("2026-07-08T10:00:01.000Z");
    expect(resolution.effectiveExpiresAt.toISOString()).toBe(
      "2026-07-08T10:00:01.000Z",
    );
    expect(resolution.shouldExpire).toBe(true);
  });

  it("keeps detected checkouts alive inside the grace window", () => {
    const policy = getCheckoutExpiryPolicy({
      OUTPAY_CHECKOUT_DETECTED_GRACE_SECONDS: "5",
      OUTPAY_CHECKOUT_TTL_SECONDS: "1",
    });
    const resolution = resolveCheckoutExpiryResolution({
      createdAt: "2026-07-08T10:00:00.000Z",
      expiresAt: "2026-07-08T10:00:01.000Z",
      now: "2026-07-08T10:00:03.000Z",
      policy,
      status: "detected",
    });

    expect(resolution.isWithinGraceWindow).toBe(true);
    expect(resolution.shouldExpire).toBe(false);
  });

  it("expires detected checkouts after the grace window elapses", () => {
    const policy = getCheckoutExpiryPolicy({
      OUTPAY_CHECKOUT_DETECTED_GRACE_SECONDS: "5",
      OUTPAY_CHECKOUT_TTL_SECONDS: "1",
    });
    const resolution = resolveCheckoutExpiryResolution({
      createdAt: "2026-07-08T10:00:00.000Z",
      expiresAt: "2026-07-08T10:00:01.000Z",
      now: "2026-07-08T10:00:06.100Z",
      policy,
      status: "detected",
    });

    expect(resolution.expireAfter.toISOString()).toBe(
      "2026-07-08T10:00:06.000Z",
    );
    expect(resolution.shouldExpire).toBe(true);
  });
});

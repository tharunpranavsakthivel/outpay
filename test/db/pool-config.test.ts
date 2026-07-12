/**
 * Regression coverage for the bounded PostgreSQL pool configuration shared by
 * the app client and Better Auth.
 */

import { describe, expect, it } from "bun:test";
import { getAuthPoolMax, getDatabasePoolMax } from "@/lib/database/config";

describe("database pool configuration", () => {
  it("uses bounded defaults for the app and Better Auth pools", () => {
    const env = { ...process.env };

    delete env.OUTPAY_DATABASE_POOL_MAX;
    delete env.OUTPAY_AUTH_POOL_MAX;

    expect(getDatabasePoolMax(env)).toBe(10);
    expect(getAuthPoolMax(env)).toBe(5);
  });

  it("accepts explicit pool ceilings", () => {
    const env = {
      ...process.env,
      OUTPAY_AUTH_POOL_MAX: "3",
      OUTPAY_DATABASE_POOL_MAX: "12",
    };

    expect(getDatabasePoolMax(env)).toBe(12);
    expect(getAuthPoolMax(env)).toBe(3);
  });

  it("rejects zero, fractional, and oversized pool ceilings", () => {
    for (const value of ["0", "1.5", "101", "not-a-number"]) {
      const env = {
        ...process.env,
        OUTPAY_DATABASE_POOL_MAX: value,
      };

      expect(() => getDatabasePoolMax(env)).toThrow(
        "OUTPAY_DATABASE_POOL_MAX must be an integer between 1 and 100.",
      );
    }
  });
});

/**
 * Unit tests for merchant lifecycle gates shared by checkout creation.
 */

import { describe, expect, it } from "bun:test";
import {
  assertMerchantActive,
  MerchantInactiveError,
} from "@/lib/dashboard/server";

describe("merchant lifecycle checkout gate", () => {
  it("allows checkout creation for active merchants", () => {
    expect(() => assertMerchantActive("active")).not.toThrow();
  });

  it("rejects deactivated merchants with an actionable error", () => {
    expect(() => assertMerchantActive("deactivated")).toThrow(
      "Checkout creation is disabled while the merchant status is 'deactivated'.",
    );

    try {
      assertMerchantActive("deactivated");
    } catch (error) {
      expect(error).toBeInstanceOf(MerchantInactiveError);
      expect((error as MerchantInactiveError).code).toBe("MERCHANT_NOT_ACTIVE");
    }
  });
});

/**
 * Regression tests for auth and merchant-context redirects on dashboard routes.
 * The loader is mocked so these tests never require a session or database.
 */

import { describe, expect, it } from "bun:test";
import { withMerchantContext } from "@/lib/dashboard/route";
import {
  MissingMerchantContextError,
  UnauthenticatedMerchantContextError,
} from "@/lib/dashboard/server";

const merchantRoutes = [
  "/dashboard",
  "/dashboard/first-login",
  "/checkouts",
  "/checkouts/new",
  "/payments",
  "/settings",
  "/settings/account",
  "/developers",
] as const;

describe("merchant dashboard route redirects", () => {
  it("returns loaded data when merchant context is available", async () => {
    const data = await withMerchantContext(
      async () => ({ merchantId: "merchant_123" }),
      "/checkouts",
    );

    expect(data).toEqual({ merchantId: "merchant_123" });
  });

  for (const route of merchantRoutes) {
    it(`${route} redirects unauthenticated requests to login`, async () => {
      await expect(
        withMerchantContext(async () => {
          throw new UnauthenticatedMerchantContextError();
        }, route),
      ).rejects.toMatchObject({
        digest: `NEXT_REDIRECT;replace;/login?returnTo=${encodeURIComponent(route)};307;`,
      });
    });

    it(`${route} redirects users without a merchant to onboarding`, async () => {
      await expect(
        withMerchantContext(async () => {
          throw new MissingMerchantContextError("Merchant is not provisioned.");
        }, route),
      ).rejects.toMatchObject({
        digest: "NEXT_REDIRECT;replace;/onboarding;307;",
      });
    });
  }

  it("rethrows unexpected loader failures", async () => {
    const error = new Error("Database unavailable.");

    await expect(
      withMerchantContext(async () => {
        throw error;
      }, "/payments"),
    ).rejects.toBe(error);
  });
});

/**
 * Unit coverage for the Zod request schemas used by Outpay API routes.
 */

import { describe, expect, it } from "bun:test";
import {
  accountAvatarColorBodySchema,
  accountProfileBodySchema,
  alchemyWebhookPayloadSchema,
  apiKeyActionBodySchema,
  apiKeyBodySchema,
  assetIdParamsSchema,
  checkoutActionBodySchema,
  checkoutParamsSchema,
  dashboardCheckoutBodySchema,
  dashboardPaymentsQuerySchema,
  idParamsSchema,
  notificationActionBodySchema,
  onboardingBodySchema,
  payoutWalletBodySchema,
  publicCreateCheckoutBodySchema,
  publicPaymentsQuerySchema,
  storeProfileBodySchema,
  storeStatusBodySchema,
  webhookEndpointBodySchema,
} from "@/lib/validation/routes";

const validWalletAddress = `0x${"a".repeat(40)}`;
const validChecksummedWalletAddress =
  "0x52908400098527886E0F7030069857D2E4169EE7";
const invalidChecksumWalletAddress = validChecksummedWalletAddress.replace(
  "E",
  "e",
);
const validWalletSignature = `0x${"a".repeat(130)}`;

describe("route parameter schemas", () => {
  it("accepts non-empty checkout, resource, and asset identifiers", () => {
    expect(
      checkoutParamsSchema.safeParse({ checkoutRef: "chk_123" }).success,
    ).toBe(true);
    expect(idParamsSchema.safeParse({ id: "resource_123" }).success).toBe(true);
    expect(
      assetIdParamsSchema.safeParse({ assetId: "asset_123" }).success,
    ).toBe(true);
  });

  it("rejects empty dynamic identifiers", () => {
    expect(checkoutParamsSchema.safeParse({ checkoutRef: "" }).success).toBe(
      false,
    );
    expect(idParamsSchema.safeParse({ id: "" }).success).toBe(false);
    expect(assetIdParamsSchema.safeParse({ assetId: "" }).success).toBe(false);
  });
});

describe("dashboard query and body schemas", () => {
  it("defaults a valid payments query", () => {
    expect(dashboardPaymentsQuerySchema.parse({})).toEqual({
      dateRange: "30d",
      page: 1,
      search: "",
      status: "all",
    });
  });

  it("rejects a non-numeric payments page with a page issue", () => {
    const result = dashboardPaymentsQuerySchema.safeParse({ page: "abc" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["page"]);
    }
  });

  it("accepts and rejects dashboard checkout fields", () => {
    expect(
      dashboardCheckoutBodySchema.safeParse({
        amountUsd: "12.50",
        label: "Coffee",
        orderReference: "order-1",
        redirectUrl: "https://merchant.example/paid",
      }).success,
    ).toBe(true);
    expect(
      dashboardCheckoutBodySchema.safeParse({
        amountUsd: "",
        label: "",
      }).success,
    ).toBe(false);
  });

  it("accepts only the supported dashboard actions", () => {
    expect(
      checkoutActionBodySchema.safeParse({ action: "deactivate" }).success,
    ).toBe(true);
    expect(
      notificationActionBodySchema.safeParse({ action: "mark-all-read" })
        .success,
    ).toBe(true);
    expect(
      checkoutActionBodySchema.safeParse({ action: "delete" }).success,
    ).toBe(false);
  });
});

describe("settings and onboarding body schemas", () => {
  it("requires a real support email when one is supplied", () => {
    expect(
      storeProfileBodySchema.safeParse({
        storeName: "Acme",
        supportEmail: "support@example.com",
      }).success,
    ).toBe(true);
    expect(
      storeProfileBodySchema.safeParse({
        storeName: "Acme",
        supportEmail: "support@example",
      }).success,
    ).toBe(false);
  });

  it("accepts wallet onboarding data and rejects malformed addresses", () => {
    const valid = {
      storeName: "Acme",
      walletAddress: validWalletAddress,
      walletConfirmed: true,
      walletSignature: validWalletSignature,
      walletSignatureTimestampMs: Date.now(),
    };

    expect(onboardingBodySchema.safeParse(valid).success).toBe(true);
    expect(
      onboardingBodySchema.safeParse({
        ...valid,
        walletAddress: validChecksummedWalletAddress,
      }).success,
    ).toBe(true);
    expect(
      onboardingBodySchema.safeParse({
        ...valid,
        walletAddress: `0x${validChecksummedWalletAddress.slice(2).toUpperCase()}`,
      }).success,
    ).toBe(true);
    const invalidChecksumOnboarding = onboardingBodySchema.safeParse({
      ...valid,
      walletAddress: invalidChecksumWalletAddress,
    });
    expect(invalidChecksumOnboarding.success).toBe(false);
    if (!invalidChecksumOnboarding.success) {
      expect(invalidChecksumOnboarding.error.issues[0]?.message).toBe(
        "This address's checksum doesn't match — please copy it directly from your wallet.",
      );
    }
    expect(
      onboardingBodySchema.safeParse({ ...valid, walletAddress: "0x123" })
        .success,
    ).toBe(false);
    expect(
      payoutWalletBodySchema.safeParse({
        confirmed: valid.walletConfirmed,
        walletAddress: valid.walletAddress,
        walletSignature: valid.walletSignature,
        walletSignatureTimestampMs: valid.walletSignatureTimestampMs,
      }).success,
    ).toBe(true);
    expect(
      payoutWalletBodySchema.safeParse({
        confirmed: valid.walletConfirmed,
        walletAddress: invalidChecksumWalletAddress,
        walletSignature: valid.walletSignature,
        walletSignatureTimestampMs: valid.walletSignatureTimestampMs,
      }).success,
    ).toBe(false);
  });

  it("validates account, avatar, and store status bodies", () => {
    expect(
      accountProfileBodySchema.safeParse({ fullName: "Ada" }).success,
    ).toBe(true);
    expect(
      accountAvatarColorBodySchema.safeParse({ avatarColor: "#60A5FA" })
        .success,
    ).toBe(true);
    expect(
      accountAvatarColorBodySchema.safeParse({ avatarColor: "blue" }).success,
    ).toBe(false);
    expect(
      storeStatusBodySchema.safeParse({
        action: "deactivate",
        confirmationText: "Acme",
      }).success,
    ).toBe(true);
  });
});

describe("developer and public API schemas", () => {
  it("validates API key, webhook, and public payment inputs", () => {
    expect(
      apiKeyBodySchema.safeParse({ environment: "test", name: "Local key" })
        .success,
    ).toBe(true);
    expect(apiKeyActionBodySchema.safeParse({ action: "revoke" }).success).toBe(
      true,
    );
    expect(
      webhookEndpointBodySchema.safeParse({
        url: "https://merchant.example/webhooks",
      }).success,
    ).toBe(true);
    expect(publicPaymentsQuerySchema.parse({ limit: "25" })).toEqual({
      limit: 25,
    });
  });

  it("validates the public checkout contract and normalizes nullable fields", () => {
    const result = publicCreateCheckoutBodySchema.safeParse({
      amount: "12.50",
      chain: "base",
      currency: "USDC",
      metadata: { orderId: "order-1" },
      successUrl: "https://merchant.example/success",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cancelUrl).toBeNull();
      expect(result.data.customerEmail).toBeNull();
    }
    expect(
      publicCreateCheckoutBodySchema.safeParse({
        amount: "not-money",
        chain: "base",
        currency: "USDC",
        successUrl: "https://merchant.example/success",
      }).success,
    ).toBe(false);
  });

  it("accepts object webhook payloads and rejects arrays", () => {
    expect(
      alchemyWebhookPayloadSchema.safeParse({ event: "activity" }).success,
    ).toBe(true);
    expect(alchemyWebhookPayloadSchema.safeParse([]).success).toBe(false);
  });
});

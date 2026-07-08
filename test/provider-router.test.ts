/**
 * Unit tests for ProviderRouter failover behavior across Alchemy and
 * Chainstack.
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
process.env.RPC_PRIMARY_PROVIDER =
  process.env.RPC_PRIMARY_PROVIDER || "alchemy";
process.env.RPC_SECONDARY_PROVIDER =
  process.env.RPC_SECONDARY_PROVIDER || "chainstack";
process.env.RPC_FAILOVER_ENABLED =
  process.env.RPC_FAILOVER_ENABLED || "true";

const { ProviderRouterError, createProviderRouter } = await import(
  "@/lib/providers/provider-router"
);

describe("ProviderRouter", () => {
  it("retries the primary once, then fails over to the secondary and logs failures", async () => {
    const primary = mock(async () => {
      throw new Error("alchemy unavailable");
    });
    const secondary = mock(async () => "0x1234");
    const logEvent = mock(() => undefined);
    const router = createProviderRouter({
      failoverEnabled: true,
      logEvent,
      primaryProvider: "alchemy",
      providers: {
        alchemy: primary,
        chainstack: secondary,
      },
      resolvePrimaryState: async () => null,
      secondaryProvider: "chainstack",
    });

    const result = await router.callRpc<string>("eth_blockNumber", []);

    expect(result).toBe("0x1234");
    expect(primary).toHaveBeenCalledTimes(2);
    expect(secondary).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledTimes(3);
    expect(logEvent.mock.calls[0]?.[0]).toMatchObject({
      attempt: 1,
      event: "failure",
      method: "eth_blockNumber",
      provider: "alchemy",
    });
    expect(logEvent.mock.calls[2]?.[0]).toMatchObject({
      event: "failover",
      method: "eth_blockNumber",
      provider: "alchemy",
      secondaryProvider: "chainstack",
    });
  });

  it("throws when both providers fail", async () => {
    const router = createProviderRouter({
      failoverEnabled: true,
      logEvent: () => undefined,
      primaryProvider: "alchemy",
      providers: {
        alchemy: async () => {
          throw new Error("alchemy unavailable");
        },
        chainstack: async () => {
          throw new Error("chainstack unavailable");
        },
      },
      resolvePrimaryState: async () => null,
      secondaryProvider: "chainstack",
    });

    await expect(router.callRpc("eth_chainId", [])).rejects.toBeInstanceOf(
      ProviderRouterError,
    );
  });

  it("prefers the secondary first when the primary is degraded and the caller requests it", async () => {
    const primary = mock(async () => "0x1");
    const secondary = mock(async () => "0x2");
    const router = createProviderRouter({
      failoverEnabled: true,
      logEvent: () => undefined,
      primaryProvider: "alchemy",
      providers: {
        alchemy: primary,
        chainstack: secondary,
      },
      resolvePrimaryState: async () => "degraded",
      secondaryProvider: "chainstack",
    });

    const result = await router.callRpc<string>("eth_chainId", [], {
      preferSecondaryOnDegradedPrimary: true,
    });

    expect(result).toBe("0x2");
    expect(secondary).toHaveBeenCalledTimes(1);
    expect(primary).toHaveBeenCalledTimes(0);
  });
});

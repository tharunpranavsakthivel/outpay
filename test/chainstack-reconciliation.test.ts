/**
 * Unit tests for the reconciliation worker's missed-webhook recovery path.
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

const { createReconciler } = await import("@/../workers/reconciler");
const EVENT = {
  amountUnits: 4_999_000n,
  blockHash: "0xblockhash",
  blockNumber: 12_345_600n,
  chain: "base",
  eventName: "Transfer",
  fromAddress: "0x1111111111111111111111111111111111111111",
  logIndex: 7,
  provider: "alchemy",
  toAddress: "0x2222222222222222222222222222222222222222",
  tokenContract: "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913",
  txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
} as const;

describe("reconciliation worker", () => {
  it("prioritizes Chainstack scans when the provider order resolver says Alchemy is degraded", async () => {
    const scannedProviders: string[] = [];
    const reconciler = createReconciler({
      fetchLatestBlockNumber: async () => 12_345_678n,
      fetchTransferLogs: async (provider) => {
        scannedProviders.push(provider);
        return [];
      },
      loadCursor: async () => 12_345_599n,
      logEvent: () => undefined,
      markCursorError: async () => undefined,
      matchEvent: async () => ({ evaluation: null }),
      recheckPayment: async () => ({ evaluation: null }),
      resolveProviderScanOrder: async () => ["chainstack", "alchemy"],
      reserveRawEvent: async () => ({
        id: "raw-recent-priority",
        processed_at: null,
      }),
      saveCursorSuccess: async () => undefined,
      selectConfirmationCheckoutSessionIds: async () => [],
    });

    const summary = await reconciler.runRecentScanCycle();

    expect(scannedProviders).toEqual(["chainstack", "alchemy"]);
    expect(summary.providers[0]?.provider).toBe("chainstack");
    expect(summary.providers[1]?.provider).toBe("alchemy");
  });

  it("recovers a missed transfer during one recent scan cycle", async () => {
    const saveCursorSuccess = mock(async () => undefined);
    const reserveRawEvent = mock(async () => ({
      id: "raw-recent-1",
      processed_at: null,
    }));
    const matchEvent = mock(async () => ({
      evaluation: {
        amountPolicy: "exact" as const,
        confirmations: 1,
        outcome: "accepted_paid" as const,
      },
    }));
    const reconciler = createReconciler({
      fetchLatestBlockNumber: async () => 12_345_678n,
      fetchTransferLogs: async (provider) =>
        provider === "alchemy" ? [EVENT] : [],
      loadCursor: async () => 12_345_599n,
      logEvent: () => undefined,
      markCursorError: async () => undefined,
      matchEvent,
      recheckPayment: async () => ({ evaluation: null }),
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
      reserveRawEvent,
      saveCursorSuccess,
      selectConfirmationCheckoutSessionIds: async () => [],
    });

    const summary = await reconciler.runRecentScanCycle();

    expect(summary.providers[0]).toMatchObject({
      provider: "alchemy",
      recoveredEvents: 1,
      scannedEvents: 1,
      skippedProcessedEvents: 0,
    });
    expect(matchEvent).toHaveBeenCalledTimes(1);
    expect(matchEvent.mock.calls[0]?.[0]).toMatchObject({
      chainEvent: EVENT,
      rawEventId: "raw-recent-1",
    });
    expect(saveCursorSuccess).toHaveBeenCalledTimes(2);
    expect(saveCursorSuccess.mock.calls[0]?.[0]).toMatchObject({
      cursorType: "recent",
      lastScannedBlock: 12_345_678n,
      provider: "alchemy",
    });
  });

  it("does not advance the cursor when a recovered transfer fails to persist", async () => {
    const saveCursorSuccess = mock(async () => undefined);
    const markCursorError = mock(async () => undefined);
    const reconciler = createReconciler({
      fetchLatestBlockNumber: async () => 901n,
      fetchTransferLogs: async (provider) =>
        provider === "alchemy" ? [EVENT] : [],
      loadCursor: async () => 900n,
      logEvent: () => undefined,
      markCursorError,
      matchEvent: async () => {
        throw new Error("database write failed");
      },
      recheckPayment: async () => ({ evaluation: null }),
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
      reserveRawEvent: async () => ({
        id: "raw-failure-1",
        processed_at: null,
      }),
      saveCursorSuccess,
      selectConfirmationCheckoutSessionIds: async () => [],
    });

    await expect(reconciler.runRecentScanCycle()).rejects.toThrow(
      "database write failed",
    );
    expect(markCursorError).toHaveBeenCalledTimes(1);
    expect(saveCursorSuccess).toHaveBeenCalledTimes(0);
  });
});

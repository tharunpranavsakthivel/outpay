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

const {
  addressToTopic,
  classifyDatabaseSizeTier,
  createReconciler,
  computeBackoffWithJitter,
  extractRetryAfterMs,
  filterProvidersForCursorType,
  isRetryableRpcError,
} = await import("@/../workers/reconciler");
const { AlchemyRpcError } = await import("@/lib/providers/alchemy");
const { ChainstackRpcError } = await import("@/lib/providers/chainstack");
const { ProviderRouterError } = await import("@/lib/providers/provider-router");

import type { ReconcilerDependencies } from "@/../workers/reconciler";

const EVENT = {
  amountUnits: BigInt(4_999_000),
  blockHash: "0xblockhash",
  blockNumber: BigInt(12_345_600),
  chain: "base",
  eventName: "Transfer",
  fromAddress: "0x1111111111111111111111111111111111111111",
  logIndex: 7,
  provider: "alchemy",
  toAddress: "0x2222222222222222222222222222222222222222",
  tokenContract: "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913",
  txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
} as const;

/** Every test scans on behalf of this single watched payment address unless
 * it's specifically exercising the watched-address filtering itself. */
const WATCHED_ADDRESSES = [EVENT.toAddress];

/**
 * Shared dependency baseline covering the fields most tests don't care
 * about, so each test only spells out what it actually exercises.
 */
function baseDependencies(): ReconcilerDependencies {
  return {
    fetchLatestBlockNumber: async () => BigInt(0),
    fetchTransferLogs: async () => [],
    getDatabaseSizeStatus: async () => ({
      ratio: 0,
      sizeBytes: BigInt(0),
      tier: "ok",
    }),
    loadCursor: async () => null,
    loadWatchedPaymentAddresses: async () => WATCHED_ADDRESSES,
    logEvent: () => undefined,
    markCursorError: async () => undefined,
    matchEvent: async () => ({ evaluation: null }),
    recheckPayment: async () => ({ evaluation: null }),
    reserveRawEvent: async () => ({ id: "unused", processed_at: null }),
    runRetentionCleanup: async () => ({ deletedCount: 0 }),
    saveCursorSuccess: async () => undefined,
    selectConfirmationCheckoutSessionIds: async () => [],
  };
}

describe("reconciliation worker", () => {
  it("scans in 10-block chunks and never requests more than 10 blocks at once", async () => {
    const requestedRanges: Array<{ from: bigint; to: bigint }> = [];
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(12_345_678),
      fetchTransferLogs: async (_provider, fromBlock, toBlock) => {
        requestedRanges.push({ from: fromBlock, to: toBlock });
        return [];
      },
      loadCursor: async () => BigInt(12_345_599),
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
    });

    await reconciler.runRecentScanCycle();

    // fromBlock 12_345_600 .. toBlock 12_345_678 is 79 blocks => 8 chunks of <=10.
    expect(requestedRanges).toHaveLength(8);
    for (const range of requestedRanges) {
      expect(range.to - range.from).toBeLessThan(BigInt(10));
    }
    expect(requestedRanges[0]).toEqual({
      from: BigInt(12_345_600),
      to: BigInt(12_345_609),
    });
    expect(requestedRanges[requestedRanges.length - 1]).toEqual({
      from: BigInt(12_345_670),
      to: BigInt(12_345_678),
    });
  });

  it("falls through to Chainstack for a chunk when Alchemy's request fails, without skipping the chunk", async () => {
    const scannedProviders: string[] = [];
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(12_345_609),
      fetchTransferLogs: async (provider, fromBlock, _toBlock) => {
        scannedProviders.push(provider);
        if (provider === "alchemy") {
          throw new Error("Alchemy RPC request failed with HTTP 400.");
        }
        return provider === "chainstack" && fromBlock === BigInt(12_345_600)
          ? [{ ...EVENT, provider: "chainstack" }]
          : [];
      },
      loadCursor: async () => BigInt(12_345_599),
      matchEvent: async () => ({
        evaluation: {
          amountPolicy: "exact" as const,
          confirmations: 1,
          outcome: "accepted_paid" as const,
        },
      }),
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
      reserveRawEvent: async () => ({ id: "raw-fallback", processed_at: null }),
    });

    const summary = await reconciler.runRecentScanCycle();

    expect(scannedProviders).toEqual(["alchemy", "chainstack"]);
    expect(summary.providers[0]).toMatchObject({
      provider: "chainstack",
      recoveredEvents: 1,
      scannedEvents: 1,
    });
  });

  it("does not try Chainstack when Alchemy already returned events", async () => {
    const scannedProviders: string[] = [];
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(12_345_609),
      fetchTransferLogs: async (provider) => {
        scannedProviders.push(provider);
        return provider === "alchemy" ? [EVENT] : [];
      },
      loadCursor: async () => BigInt(12_345_599),
      matchEvent: async () => ({
        evaluation: {
          amountPolicy: "exact" as const,
          confirmations: 1,
          outcome: "accepted_paid" as const,
        },
      }),
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
      reserveRawEvent: async () => ({ id: "raw-primary", processed_at: null }),
    });

    await reconciler.runRecentScanCycle();

    expect(scannedProviders).toEqual(["alchemy"]);
  });

  it("recovers a missed transfer and persists cursor progress per chunk", async () => {
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
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(12_345_609),
      fetchTransferLogs: async (provider) =>
        provider === "alchemy" ? [EVENT] : [],
      loadCursor: async () => BigInt(12_345_599),
      matchEvent,
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
      reserveRawEvent,
      saveCursorSuccess,
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
    // fromBlock 12_345_600 .. toBlock 12_345_609 is exactly one 10-block chunk.
    expect(saveCursorSuccess).toHaveBeenCalledTimes(1);
    expect(saveCursorSuccess.mock.calls[0]?.[0]).toMatchObject({
      cursorType: "recent",
      lastScannedBlock: BigInt(12_345_609),
      provider: "alchemy",
    });
  });

  it("does not advance the cursor when a recovered transfer fails to persist, and does not fall through to the next provider", async () => {
    const saveCursorSuccess = mock(async () => undefined);
    const markCursorError = mock(async () => undefined);
    const scannedProviders: string[] = [];
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(901),
      fetchTransferLogs: async (provider) => {
        scannedProviders.push(provider);
        return provider === "alchemy" ? [EVENT] : [];
      },
      loadCursor: async () => BigInt(900),
      markCursorError,
      matchEvent: async () => {
        throw new Error("database write failed");
      },
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
      reserveRawEvent: async () => ({
        id: "raw-failure-1",
        processed_at: null,
      }),
      saveCursorSuccess,
    });

    await expect(reconciler.runRecentScanCycle()).rejects.toThrow(
      "database write failed",
    );
    // A persistence failure is not a data-source problem: Chainstack must
    // never be tried for this chunk once Alchemy's fetch already succeeded.
    expect(scannedProviders).toEqual(["alchemy"]);
    expect(markCursorError).toHaveBeenCalledTimes(1);
    expect(markCursorError.mock.calls[0]).toEqual([
      "alchemy",
      "recent",
      BigInt(901),
    ]);
    expect(saveCursorSuccess).toHaveBeenCalledTimes(0);
  });

  it("fails the chunk when every provider's eth_getLogs call fails", async () => {
    const markCursorError = mock(async () => undefined);
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(909),
      fetchTransferLogs: async () => {
        throw new Error("Alchemy RPC request failed with HTTP 400.");
      },
      loadCursor: async () => BigInt(900),
      markCursorError,
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
    });

    await expect(reconciler.runRecentScanCycle()).rejects.toThrow(
      "Alchemy RPC request failed with HTTP 400.",
    );
    expect(markCursorError).toHaveBeenCalledTimes(1);
    expect(markCursorError.mock.calls[0]).toEqual([
      "chainstack",
      "recent",
      BigInt(901),
    ]);
  });

  it("bounds deep-scan lookback instead of replaying the whole chain when the cursor is missing", async () => {
    const requestedRanges: Array<{ from: bigint; to: bigint }> = [];
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(1_000_000),
      fetchTransferLogs: async (_provider, fromBlock, toBlock) => {
        requestedRanges.push({ from: fromBlock, to: toBlock });
        return [];
      },
      loadCursor: async () => null,
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
    });

    await reconciler.runDeepScanCycle();

    // Default deep lookback is 4000 blocks: earliest requested block must not
    // go further back than latest - 4000 + 1, regardless of the missing cursor.
    const earliestRequested = requestedRanges.reduce(
      (min, range) => (range.from < min ? range.from : min),
      requestedRanges[0]?.from ?? BigInt(1_000_000),
    );
    expect(earliestRequested).toBe(BigInt(996_001));
  });

  it("does nothing and does not call fetchTransferLogs when already caught up to the chain tip", async () => {
    const fetchTransferLogs = mock(async () => []);
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(12_345_600),
      fetchTransferLogs,
      loadCursor: async () => BigInt(12_345_600),
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
    });

    const summary = await reconciler.runRecentScanCycle();

    expect(fetchTransferLogs).not.toHaveBeenCalled();
    expect(summary.providers).toEqual([]);
  });
});

describe("RPC retry/backoff helpers", () => {
  it("classifies provider-layer errors as retryable and everything else as not", () => {
    expect(isRetryableRpcError(new AlchemyRpcError("boom"))).toBe(true);
    expect(isRetryableRpcError(new ChainstackRpcError("boom"))).toBe(true);
    expect(
      isRetryableRpcError(new ProviderRouterError("All RPC providers failed.")),
    ).toBe(true);
    expect(isRetryableRpcError(new Error("database write failed"))).toBe(false);
    expect(isRetryableRpcError("not an error")).toBe(false);
  });

  it("reads retryAfterMs directly off a provider error", () => {
    const error = new AlchemyRpcError("rate limited", {
      httpStatus: 429,
      retryAfterMs: 2000,
    });

    expect(extractRetryAfterMs(error)).toBe(2000);
  });

  it("reads retryAfterMs out of a ProviderRouterError's wrapped secondary error first", () => {
    const error = new ProviderRouterError("All RPC providers failed.", {
      primaryError: new AlchemyRpcError("rate limited", {
        retryAfterMs: 5000,
      }),
      secondaryError: new ChainstackRpcError("rate limited", {
        retryAfterMs: 1500,
      }),
    });

    expect(extractRetryAfterMs(error)).toBe(1500);
  });

  it("falls back to the wrapped primary error when the secondary has no hint", () => {
    const error = new ProviderRouterError("All RPC providers failed.", {
      primaryError: new AlchemyRpcError("rate limited", {
        retryAfterMs: 5000,
      }),
      secondaryError: new ChainstackRpcError("forbidden"),
    });

    expect(extractRetryAfterMs(error)).toBe(5000);
  });

  it("returns null when no retryAfterMs hint is present anywhere", () => {
    expect(extractRetryAfterMs(new Error("boom"))).toBeNull();
    expect(
      extractRetryAfterMs(
        new ProviderRouterError("All RPC providers failed.", {
          primaryError: new AlchemyRpcError("boom"),
          secondaryError: new ChainstackRpcError("boom"),
        }),
      ),
    ).toBeNull();
  });

  it("computes exponential backoff with jitter, capped and monotonically bounded", () => {
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const delay = computeBackoffWithJitter(attempt);
      const exponential = Math.min(1000 * 2 ** (attempt - 1), 30_000);

      expect(delay).toBeGreaterThanOrEqual(exponential / 2);
      expect(delay).toBeLessThanOrEqual(exponential);
      expect(delay).toBeLessThanOrEqual(30_000);
    }
  });
});

describe("provider archive-capability filtering", () => {
  it("leaves the recent-scan provider order untouched", () => {
    expect(
      filterProvidersForCursorType(["alchemy", "chainstack"], "recent"),
    ).toEqual(["alchemy", "chainstack"]);
    expect(
      filterProvidersForCursorType(["chainstack", "alchemy"], "recent"),
    ).toEqual(["chainstack", "alchemy"]);
  });

  it("drops Chainstack from the deep-scan provider order, in either input order", () => {
    expect(
      filterProvidersForCursorType(["alchemy", "chainstack"], "deep"),
    ).toEqual(["alchemy"]);
    expect(
      filterProvidersForCursorType(["chainstack", "alchemy"], "deep"),
    ).toEqual(["alchemy"]);
  });

  it("never lets a deep scan chunk reach Chainstack, even when Chainstack is ordered first", async () => {
    const scannedProviders: string[] = [];
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(12_345_609),
      fetchTransferLogs: async (provider) => {
        scannedProviders.push(provider);
        return [];
      },
      loadCursor: async () => BigInt(12_345_599),
      // Alchemy marked degraded: the default resolver would put Chainstack
      // first. A deep scan must still never call it.
      resolveProviderScanOrder: async () => ["chainstack", "alchemy"],
    });

    await reconciler.runDeepScanCycle();

    expect(scannedProviders).toEqual(["alchemy"]);
  });
});

describe("watched-address filtering", () => {
  it("loads watched addresses once per cycle and threads them into fetchTransferLogs", async () => {
    const loadWatchedPaymentAddresses = mock(async () => WATCHED_ADDRESSES);
    const receivedAddresses: string[][] = [];
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(12_345_678),
      fetchTransferLogs: async (_provider, _from, _to, watchedAddresses) => {
        receivedAddresses.push(watchedAddresses);
        return [];
      },
      loadCursor: async () => BigInt(12_345_599),
      loadWatchedPaymentAddresses,
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
    });

    await reconciler.runRecentScanCycle();

    // One cycle spans 8 chunks (see chunking test above); the watched-address
    // set is resolved once for the whole cycle, not per chunk.
    expect(loadWatchedPaymentAddresses).toHaveBeenCalledTimes(1);
    expect(receivedAddresses).toHaveLength(8);
    for (const addresses of receivedAddresses) {
      expect(addresses).toEqual(WATCHED_ADDRESSES);
    }
  });

  it("skips fetchTransferLogs entirely and still advances the cursor when there are no watched addresses", async () => {
    const fetchTransferLogs = mock(async () => []);
    const saveCursorSuccess = mock(async () => undefined);
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(12_345_678),
      fetchTransferLogs,
      loadCursor: async () => BigInt(12_345_599),
      loadWatchedPaymentAddresses: async () => [],
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
      saveCursorSuccess,
    });

    const summary = await reconciler.runRecentScanCycle();

    expect(fetchTransferLogs).not.toHaveBeenCalled();
    expect(summary.providers).toEqual([]);
    expect(saveCursorSuccess).toHaveBeenCalledTimes(1);
    expect(saveCursorSuccess.mock.calls[0]?.[0]).toMatchObject({
      cursorType: "recent",
      lastScannedBlock: BigInt(12_345_678),
    });
  });

  it("discards a fetched event whose recipient is not a watched address, as a defense-in-depth check independent of fetchTransferLogs' own filtering", async () => {
    const reserveRawEvent = mock(async () => ({
      id: "should-not-be-used",
      processed_at: null,
    }));
    const matchEvent = mock(async () => ({ evaluation: null }));
    const unwatchedEvent = {
      ...EVENT,
      toAddress: "0x9999999999999999999999999999999999999999",
    };
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(12_345_609),
      // Simulates a provider (or a buggy dependency) that ignored the
      // requested topics filter and returned an unrelated transfer anyway.
      fetchTransferLogs: async (provider) =>
        provider === "alchemy" ? [unwatchedEvent] : [],
      loadCursor: async () => BigInt(12_345_599),
      loadWatchedPaymentAddresses: async () => WATCHED_ADDRESSES,
      matchEvent,
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
      reserveRawEvent,
    });

    const summary = await reconciler.runRecentScanCycle();

    expect(reserveRawEvent).not.toHaveBeenCalled();
    expect(matchEvent).not.toHaveBeenCalled();
    expect(summary.providers[0]).toMatchObject({
      recoveredEvents: 0,
      scannedEvents: 1,
      skippedProcessedEvents: 0,
    });
  });
});

describe("database size safeguards", () => {
  it("classifies size ratios into the correct tier at each boundary", () => {
    expect(classifyDatabaseSizeTier(0)).toBe("ok");
    expect(classifyDatabaseSizeTier(0.69)).toBe("ok");
    expect(classifyDatabaseSizeTier(0.7)).toBe("warn");
    expect(classifyDatabaseSizeTier(0.79)).toBe("warn");
    expect(classifyDatabaseSizeTier(0.8)).toBe("cleanup");
    expect(classifyDatabaseSizeTier(0.89)).toBe("cleanup");
    expect(classifyDatabaseSizeTier(0.9)).toBe("pause");
    expect(classifyDatabaseSizeTier(1.5)).toBe("pause");
  });

  it("pauses ingestion and does not scan when the database size tier is pause", async () => {
    const fetchTransferLogs = mock(async () => []);
    const loadCursor = mock(async () => BigInt(12_345_599));
    const saveCursorSuccess = mock(async () => undefined);
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(12_345_609),
      fetchTransferLogs,
      getDatabaseSizeStatus: async () => ({
        ratio: 0.95,
        sizeBytes: BigInt(475 * 1024 * 1024),
        tier: "pause",
      }),
      loadCursor,
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
      saveCursorSuccess,
    });

    const summary = await reconciler.runRecentScanCycle();

    expect(fetchTransferLogs).not.toHaveBeenCalled();
    expect(loadCursor).not.toHaveBeenCalled();
    expect(saveCursorSuccess).not.toHaveBeenCalled();
    expect(summary.providers).toEqual([]);
  });

  it("still runs the confirmation recheck cycle when ingestion is paused, since it only updates existing rows", async () => {
    const recheckPayment = mock(async () => ({ evaluation: null }));
    const reconciler = createReconciler({
      ...baseDependencies(),
      getDatabaseSizeStatus: async () => ({
        ratio: 0.95,
        sizeBytes: BigInt(475 * 1024 * 1024),
        tier: "pause",
      }),
      recheckPayment,
      selectConfirmationCheckoutSessionIds: async () => ["checkout-1"],
    });

    const summary = await reconciler.runConfirmationScanCycle();

    expect(recheckPayment).toHaveBeenCalledTimes(1);
    expect(summary.checkoutSessionIds).toEqual(["checkout-1"]);
  });

  it("runs retention cleanup before scanning when the database size tier is cleanup", async () => {
    const runRetentionCleanup = mock(async () => ({ deletedCount: 42 }));
    const fetchTransferLogs = mock(async () => []);
    const reconciler = createReconciler({
      ...baseDependencies(),
      fetchLatestBlockNumber: async () => BigInt(12_345_609),
      fetchTransferLogs,
      getDatabaseSizeStatus: async () => ({
        ratio: 0.85,
        sizeBytes: BigInt(425 * 1024 * 1024),
        tier: "cleanup",
      }),
      loadCursor: async () => BigInt(12_345_599),
      resolveProviderScanOrder: async () => ["alchemy", "chainstack"],
      runRetentionCleanup,
    });

    await reconciler.runRecentScanCycle();

    expect(runRetentionCleanup).toHaveBeenCalledTimes(1);
    // Cleanup is a proactive measure, not a block: scanning still proceeds.
    expect(fetchTransferLogs).toHaveBeenCalled();
  });
});

describe("address topic encoding", () => {
  it("left-pads a 20-byte address into a 32-byte, lowercased eth_getLogs topic", () => {
    const address = "0x2222222222222222222222222222222222222222";
    const topic = addressToTopic(address);

    expect(topic).toBe(`0x${address.slice(2).padStart(64, "0")}`);
    expect(topic).toHaveLength(66);
  });

  it("lowercases a mixed-case address before padding", () => {
    const address = "0xAbCdEf0123456789AbCdEf0123456789aBcDeF01";

    expect(addressToTopic(address)).toBe(
      `0x${address.toLowerCase().slice(2).padStart(64, "0")}`,
    );
  });
});

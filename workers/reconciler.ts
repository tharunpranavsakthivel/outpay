/**
 * Chain reconciliation worker for recovering missed Base USDC transfers from
 * block-range scans and rechecking detected payments for new confirmations.
 *
 * Exports:
 * - `createReconciler`: Testable reconciliation engine with injectable I/O.
 * - `startReconciliationWorker`: Interval-driven worker entrypoint for Bun.
 *
 * Critical dependencies:
 * - `provider-router` and provider RPC adapters for block/log reads.
 * - `match-payment` for durable, idempotent settlement updates.
 * - `chain_cursors` and `provider_events_raw` for safe replay semantics.
 */

import { connectToDatabase } from "@/lib/database/client";
import { logger } from "@/lib/logging/logger";
import { emitMetric, METRIC_NAMES } from "@/lib/observability/metrics";
import {
  type MatchChainEventResult,
  matchNormalizedChainEvent,
  recheckDetectedPayment,
} from "@/lib/payments/match-payment";
import {
  type NormalizedChainEvent,
  normalizeRpcTransferLogs,
} from "@/lib/payments/normalize-event";
import { AlchemyRpcError, alchemyRpcRequest } from "@/lib/providers/alchemy";
import {
  ChainstackRpcError,
  chainstackRpcRequest,
} from "@/lib/providers/chainstack";
import { getLatestProviderHealthStatus } from "@/lib/providers/health";
import {
  createProviderRouter,
  ProviderRouterError,
  type RpcProviderName,
} from "@/lib/providers/provider-router";

type CursorType = "deep" | "recent";
type LoggerLevel = "error" | "info" | "warn";

interface ChainCursorRow {
  last_scanned_block: string;
}

interface ProviderEventRawRow {
  id: string;
  processed_at: string | null;
}

interface ConfirmationCheckoutRow {
  checkout_session_id: string;
}

interface ReconcilerLoggerEvent {
  cursorType?: CursorType | "confirmation";
  error?: string;
  fromBlock?: string;
  level: LoggerLevel;
  message: string;
  provider?: RpcProviderName;
  recoveredEvents?: number;
  toBlock?: string;
}

export interface ReconciliationCycleSummary {
  cursorType: CursorType;
  latestBlock: bigint;
  providers: Array<{
    fromBlock: bigint;
    provider: RpcProviderName;
    recoveredEvents: number;
    scannedEvents: number;
    skippedProcessedEvents: number;
    toBlock: bigint;
  }>;
}

export interface ConfirmationCycleSummary {
  checkoutSessionIds: string[];
}

export interface ReconcilerDependencies {
  fetchLatestBlockNumber: () => Promise<bigint>;
  fetchTransferLogs: (
    provider: RpcProviderName,
    fromBlock: bigint,
    toBlock: bigint,
  ) => Promise<NormalizedChainEvent[]>;
  loadCursor: (
    provider: RpcProviderName,
    cursorType: CursorType,
  ) => Promise<bigint | null>;
  logEvent: (event: ReconcilerLoggerEvent) => void;
  markCursorError: (
    provider: RpcProviderName,
    cursorType: CursorType,
    failedFromBlock: bigint,
  ) => Promise<void>;
  matchEvent: (input: {
    chainEvent: NormalizedChainEvent;
    rawEventId: string;
  }) => Promise<MatchChainEventResult>;
  recheckPayment: (input: {
    checkoutSessionId: string;
  }) => Promise<MatchChainEventResult>;
  resolveProviderScanOrder?: () => Promise<RpcProviderName[]>;
  reserveRawEvent: (input: {
    cursorType: CursorType;
    event: NormalizedChainEvent;
    fromBlock: bigint;
    provider: RpcProviderName;
    toBlock: bigint;
  }) => Promise<ProviderEventRawRow>;
  saveCursorSuccess: (input: {
    cursorType: CursorType;
    lastScannedBlock: bigint;
    provider: RpcProviderName;
  }) => Promise<void>;
  selectConfirmationCheckoutSessionIds: (limit: number) => Promise<string[]>;
}

const BASE_CHAIN = "base";
const BASE_USDC_CONTRACT = "0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913";
const ERC20_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/**
 * Alchemy's Free-tier plan rejects `eth_getLogs` calls spanning more than 10
 * blocks (HTTP 400). Every scan walks its target range in chunks of this
 * size regardless of which provider ends up serving it, so scanning doesn't
 * silently fail against the account's actual plan limits.
 */
const SCAN_CHUNK_BLOCKS = readPositiveIntegerEnv(
  process.env.RECONCILER_CHUNK_BLOCKS?.trim(),
  10,
);

/**
 * One logical scan now spans both providers (Alchemy tried first, Chainstack
 * as fallback), so there is a single progress cursor per cursor type rather
 * than one per provider. It is stored under this provider name for schema
 * compatibility with the existing `chain_cursors` table.
 */
const CURSOR_PROGRESS_PROVIDER: RpcProviderName = "alchemy";

/**
 * Confirmed against the live endpoints: Chainstack's current plan rejects
 * both `eth_getLogs` and `eth_getBlockByNumber` for anything outside a
 * near-tip window with HTTP 403 ("Archive, Debug and Trace requests are not
 * available on your current plan"). It is a valid fallback for the `recent`
 * scan (a shallow, near-tip range) but can never serve a `deep` scan, which
 * by design reads hundreds to thousands of blocks behind the tip. Deep scans
 * skip non-archive providers entirely instead of wasting a request (and a
 * retry budget) on a call that can never succeed.
 */
const PROVIDER_ARCHIVE_CAPABILITY: Record<RpcProviderName, boolean> = {
  alchemy: true,
  chainstack: false,
};

export function filterProvidersForCursorType(
  providerOrder: RpcProviderName[],
  cursorType: CursorType,
): RpcProviderName[] {
  if (cursorType !== "deep") {
    return providerOrder;
  }

  return providerOrder.filter(
    (provider) => PROVIDER_ARCHIVE_CAPABILITY[provider],
  );
}

const RECENT_LOOKBACK_BLOCKS = readPositiveIntegerEnv(
  process.env.RECONCILER_RECENT_WINDOW_BLOCKS?.trim(),
  180,
);
const DEEP_LOOKBACK_BLOCKS = readPositiveIntegerEnv(
  process.env.RECONCILER_DEEP_WINDOW_BLOCKS?.trim(),
  4000,
);
const RECENT_SCAN_INTERVAL_MS = readPositiveIntegerEnv(
  process.env.RECONCILER_RECENT_INTERVAL_MS?.trim(),
  5 * 60_000,
);
const CONFIRMATION_SCAN_INTERVAL_MS = readPositiveIntegerEnv(
  process.env.RECONCILER_CONFIRMATION_INTERVAL_MS?.trim(),
  90_000,
);
const DEEP_SCAN_INTERVAL_MS = readPositiveIntegerEnv(
  process.env.RECONCILER_DEEP_INTERVAL_MS?.trim(),
  24 * 60 * 60_000,
);
const CONFIRMATION_SCAN_BATCH_SIZE = readPositiveIntegerEnv(
  process.env.RECONCILER_CONFIRMATION_BATCH_SIZE?.trim(),
  50,
);

/**
 * Alchemy's Free-tier plan enforces a short-term throughput cap (~500
 * Compute Units Per Second), not just the eth_getLogs block-range cap. A
 * burst of chunk scans and per-event lookups during catch-up can exceed it
 * and get HTTP 429'd. Every RPC request the reconciler issues — including
 * each internal attempt inside the provider router's own retry/failover —
 * is spaced at least this far apart from the previous one.
 */
const RPC_MIN_REQUEST_INTERVAL_MS = readPositiveIntegerEnv(
  process.env.RECONCILER_RPC_MIN_INTERVAL_MS?.trim(),
  275,
);

/** Bounded retry count for a single RPC-triggering operation before giving
 * up on this chunk for the current cycle. The chunk is retried again on the
 * next scheduled cycle since its cursor position is never advanced past it. */
const RPC_RETRY_MAX_ATTEMPTS = readPositiveIntegerEnv(
  process.env.RECONCILER_RPC_MAX_RETRY_ATTEMPTS?.trim(),
  6,
);
const RPC_RETRY_BASE_DELAY_MS = readPositiveIntegerEnv(
  process.env.RECONCILER_RPC_RETRY_BASE_DELAY_MS?.trim(),
  1000,
);
const RPC_RETRY_MAX_DELAY_MS = readPositiveIntegerEnv(
  process.env.RECONCILER_RPC_RETRY_MAX_DELAY_MS?.trim(),
  30_000,
);

let lastRpcRequestAt = 0;

/**
 * Blocks until at least `RPC_MIN_REQUEST_INTERVAL_MS` has elapsed since the
 * previous paced request, enforcing a single sequential request stream
 * (effective concurrency 1) against the configured throughput budget.
 */
async function pacedRpcGate(): Promise<void> {
  const elapsed = Date.now() - lastRpcRequestAt;

  if (elapsed < RPC_MIN_REQUEST_INTERVAL_MS) {
    await sleep(RPC_MIN_REQUEST_INTERVAL_MS - elapsed);
  }

  lastRpcRequestAt = Date.now();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pacedAlchemyRpcRequest<T>(
  method: string,
  params?: readonly unknown[],
): Promise<T> {
  await pacedRpcGate();
  return alchemyRpcRequest<T>(method, params);
}

async function pacedChainstackRpcRequest<T>(
  method: string,
  params?: readonly unknown[],
): Promise<T> {
  await pacedRpcGate();
  return chainstackRpcRequest<T>(method, params);
}

const ROUTED_RPC = createProviderRouter({
  failoverEnabled: true,
  logEvent: (event) => {
    logReconcilerEvent({
      error: event.error,
      level: event.event === "failure" ? "warn" : "info",
      message:
        event.event === "failure"
          ? `Provider router ${event.provider} request failed`
          : `Provider router failed over from ${event.provider} to ${event.secondaryProvider}`,
      provider:
        event.event === "failure" ? event.provider : event.secondaryProvider,
    });
  },
  primaryProvider: "alchemy",
  providers: {
    alchemy: pacedAlchemyRpcRequest,
    chainstack: pacedChainstackRpcRequest,
  },
  resolvePrimaryState: (provider) =>
    getLatestProviderHealthStatus(provider, BASE_CHAIN),
  secondaryProvider: "chainstack",
});

/**
 * Detects RPC/provider-layer failures, as opposed to persistence failures
 * (e.g. a database write error inside `matchEvent`). Only the former is
 * worth retrying with backoff — retrying a storage failure would just waste
 * up to a minute repeating a write that will keep failing for the same
 * reason.
 */
export function isRetryableRpcError(error: unknown): boolean {
  return (
    error instanceof AlchemyRpcError ||
    error instanceof ChainstackRpcError ||
    error instanceof ProviderRouterError
  );
}

/**
 * Reads a `retryAfterMs` hint off a thrown error, including one wrapped
 * inside a `ProviderRouterError`'s `primaryError`/`secondaryError`.
 */
export function extractRetryAfterMs(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }

  const candidate = error as {
    primaryError?: unknown;
    retryAfterMs?: unknown;
    secondaryError?: unknown;
  };

  if (typeof candidate.retryAfterMs === "number") {
    return candidate.retryAfterMs;
  }

  return (
    extractRetryAfterMs(candidate.secondaryError) ??
    extractRetryAfterMs(candidate.primaryError)
  );
}

/**
 * Full jitter exponential backoff: doubles the base delay per attempt (capped
 * at `RPC_RETRY_MAX_DELAY_MS`), then returns a random point between half of
 * that value and the full value.
 */
export function computeBackoffWithJitter(attempt: number): number {
  const exponential = Math.min(
    RPC_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1),
    RPC_RETRY_MAX_DELAY_MS,
  );
  const floor = exponential / 2;

  return Math.round(floor + Math.random() * floor);
}

/**
 * Retries an RPC-triggering operation with exponential backoff and jitter,
 * respecting a `Retry-After` hint when the provider sends one. Non-RPC
 * failures (e.g. a database write error) are not retried and propagate on
 * the first attempt.
 *
 * Parameters:
 * - operation: The RPC-triggering call to attempt.
 * - context: Logging label and an optional retryability predicate.
 *
 * Returns:
 * - The operation's result once it succeeds.
 *
 * Throws:
 * - The last error once `RPC_RETRY_MAX_ATTEMPTS` is exhausted, or
 *   immediately for a non-retryable error.
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  context: { isRetryable?: (error: unknown) => boolean; label: string },
): Promise<T> {
  const isRetryable = context.isRetryable ?? (() => true);
  let lastError: unknown;

  for (let attempt = 1; attempt <= RPC_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error)) {
        throw error;
      }

      const isLastAttempt = attempt >= RPC_RETRY_MAX_ATTEMPTS;

      logReconcilerEvent({
        error: error instanceof Error ? error.message : "Unknown RPC failure",
        level: "warn",
        message: `${context.label} failed on attempt ${attempt}/${RPC_RETRY_MAX_ATTEMPTS}${
          isLastAttempt
            ? "; giving up for this cycle"
            : "; retrying with backoff"
        }`,
      });

      if (isLastAttempt) {
        break;
      }

      const retryAfterMs = extractRetryAfterMs(error);
      await sleep(retryAfterMs ?? computeBackoffWithJitter(attempt));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        `${context.label} failed after ${RPC_RETRY_MAX_ATTEMPTS} attempts.`,
      );
}

/**
 * Creates a reusable reconciliation engine for scan and confirmation cycles.
 *
 * Parameters:
 * - dependencies: Storage, RPC, and payment-matching integrations.
 *
 * Returns:
 * - Object with recent, deep, and confirmation cycle executors.
 */
export function createReconciler(dependencies: ReconcilerDependencies) {
  return {
    /**
     * Executes one recent reconciliation cycle: catches up from the cursor
     * (bounded to `RECENT_LOOKBACK_BLOCKS` on cold start) to the chain tip.
     */
    async runRecentScanCycle(): Promise<ReconciliationCycleSummary> {
      return runScanCycle({
        cursorType: "recent",
        dependencies,
        latestBlock: await dependencies.fetchLatestBlockNumber(),
        lookbackBlocks: BigInt(RECENT_LOOKBACK_BLOCKS),
      });
    },

    /**
     * Executes one deep reconciliation cycle. Lookback is capped at
     * `DEEP_LOOKBACK_BLOCKS` so a stale or missing cursor doesn't trigger an
     * unbounded replay of the chain's history.
     */
    async runDeepScanCycle(): Promise<ReconciliationCycleSummary> {
      return runScanCycle({
        cursorType: "deep",
        dependencies,
        latestBlock: await dependencies.fetchLatestBlockNumber(),
        lookbackBlocks: BigInt(DEEP_LOOKBACK_BLOCKS),
      });
    },

    /**
     * Rechecks detected payments so confirmation counts can advance without a
     * fresh webhook delivery.
     */
    async runConfirmationScanCycle(): Promise<ConfirmationCycleSummary> {
      const checkoutSessionIds =
        await dependencies.selectConfirmationCheckoutSessionIds(
          CONFIRMATION_SCAN_BATCH_SIZE,
        );

      for (const checkoutSessionId of checkoutSessionIds) {
        await dependencies.recheckPayment({ checkoutSessionId });
      }

      dependencies.logEvent({
        cursorType: "confirmation",
        level: "info",
        message: "Completed reconciliation confirmation scan",
      });

      return { checkoutSessionIds };
    },
  };
}

/**
 * Starts the long-running Bun worker with recent, confirmation, and deep scan
 * intervals. Recent scans run every `RECONCILER_RECENT_INTERVAL_MS`
 * (default 5 minutes); deep scans run every `RECONCILER_DEEP_INTERVAL_MS`
 * (default once daily).
 */
export async function startReconciliationWorker(): Promise<void> {
  const reconciler = createReconciler(createDefaultDependencies());
  const scheduledTasks = [
    scheduleRecurringTask(
      "recent reconciliation scan",
      RECENT_SCAN_INTERVAL_MS,
      () => reconciler.runRecentScanCycle(),
    ),
    scheduleRecurringTask(
      "confirmation reconciliation scan",
      CONFIRMATION_SCAN_INTERVAL_MS,
      () => reconciler.runConfirmationScanCycle(),
    ),
    scheduleRecurringTask(
      "deep reconciliation scan",
      DEEP_SCAN_INTERVAL_MS,
      () => reconciler.runDeepScanCycle(),
    ),
  ];

  logReconcilerEvent({
    level: "info",
    message: "Reconciliation worker started",
  });

  const shutdown = async () => {
    for (const scheduledTask of scheduledTasks) {
      scheduledTask.stop();
    }

    await Promise.all(
      scheduledTasks.map((scheduledTask) => scheduledTask.waitForIdle()),
    );

    logReconcilerEvent({
      level: "info",
      message: "Reconciliation worker stopped",
    });

    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

/**
 * Runs one scan cycle for the given cursor type: resolves the bounded block
 * range since the last successful cursor position, then walks it in
 * `SCAN_CHUNK_BLOCKS`-sized chunks so no single `eth_getLogs` call exceeds
 * the configured provider's range limit. Cursor progress is persisted after
 * every chunk (not just at the end of the cycle), so a chunk that fails
 * partway through only loses that chunk's progress, not the whole cycle's.
 */
async function runScanCycle(input: {
  cursorType: CursorType;
  dependencies: ReconcilerDependencies;
  latestBlock: bigint;
  lookbackBlocks: bigint;
}): Promise<ReconciliationCycleSummary> {
  const lastScannedBlock = await input.dependencies.loadCursor(
    CURSOR_PROGRESS_PROVIDER,
    input.cursorType,
  );
  const { fromBlock, toBlock } = resolveScanWindow({
    latestBlock: input.latestBlock,
    lastScannedBlock,
    windowSize: input.lookbackBlocks,
  });
  const chunkSummaries: ReconciliationCycleSummary["providers"] = [];

  if (fromBlock > toBlock) {
    input.dependencies.logEvent({
      cursorType: input.cursorType,
      level: "info",
      message: "No new blocks to reconcile",
    });

    return {
      cursorType: input.cursorType,
      latestBlock: input.latestBlock,
      providers: chunkSummaries,
    };
  }

  const providerOrder = filterProvidersForCursorType(
    await resolveReconciliationProviderOrder(input.dependencies),
    input.cursorType,
  );
  let chunkStart = fromBlock;

  while (chunkStart <= toBlock) {
    const chunkEnd = minBigInt(
      chunkStart + BigInt(SCAN_CHUNK_BLOCKS) - BigInt(1),
      toBlock,
    );

    const chunkSummary = await scanChunkWithFallback({
      cursorType: input.cursorType,
      dependencies: input.dependencies,
      fromBlock: chunkStart,
      providerOrder,
      toBlock: chunkEnd,
    });

    chunkSummaries.push(chunkSummary);
    await input.dependencies.saveCursorSuccess({
      cursorType: input.cursorType,
      lastScannedBlock: chunkEnd,
      provider: CURSOR_PROGRESS_PROVIDER,
    });
    chunkStart = chunkEnd + BigInt(1);
  }

  input.dependencies.logEvent({
    cursorType: input.cursorType,
    level: "info",
    message: "Completed reconciliation scan cycle",
  });

  return {
    cursorType: input.cursorType,
    latestBlock: input.latestBlock,
    providers: chunkSummaries,
  };
}

/**
 * Resolves the provider scan order for reconciliation. When Alchemy is
 * degraded, down, or rate-limited, Chainstack is scanned first so recovery
 * work continues against the healthier upstream.
 *
 * Parameters:
 * - dependencies: Reconciler dependencies with optional custom order
 *   resolution.
 *
 * Returns:
 * - Ordered provider list for the upcoming scan cycle.
 */
export async function resolveReconciliationProviderOrder(
  dependencies: ReconcilerDependencies,
): Promise<RpcProviderName[]> {
  if (dependencies.resolveProviderScanOrder) {
    return dependencies.resolveProviderScanOrder();
  }

  const alchemyStatus = await getLatestProviderHealthStatus(
    "alchemy",
    BASE_CHAIN,
  );

  if (
    alchemyStatus === "degraded" ||
    alchemyStatus === "down" ||
    alchemyStatus === "rate_limited"
  ) {
    return ["chainstack", "alchemy"];
  }

  return ["alchemy", "chainstack"];
}

/**
 * Scans a single bounded chunk, trying each provider in `providerOrder`
 * until one successfully returns logs — a provider whose `eth_getLogs` call
 * itself fails (rate limit, plan limit, outage) is skipped in favor of the
 * next one. Once logs are fetched, a failure while persisting them is a
 * storage problem, not a data-source problem: it is not retried against
 * another provider and propagates immediately, so the cursor does not
 * advance past this chunk.
 */
async function scanChunkWithFallback(input: {
  cursorType: CursorType;
  dependencies: ReconcilerDependencies;
  fromBlock: bigint;
  providerOrder: RpcProviderName[];
  toBlock: bigint;
}): Promise<ReconciliationCycleSummary["providers"][number]> {
  let events: NormalizedChainEvent[] | null = null;
  let usedProvider: RpcProviderName | null = null;
  let fetchError: unknown;

  for (const provider of input.providerOrder) {
    try {
      events = await input.dependencies.fetchTransferLogs(
        provider,
        input.fromBlock,
        input.toBlock,
      );
      usedProvider = provider;
      break;
    } catch (error) {
      fetchError = error;
      input.dependencies.logEvent({
        cursorType: input.cursorType,
        error: error instanceof Error ? error.message : "Unknown scan failure",
        fromBlock: input.fromBlock.toString(),
        level: "warn",
        message: "Provider reconciliation scan failed, trying next provider",
        provider,
        toBlock: input.toBlock.toString(),
      });
    }
  }

  if (events === null || usedProvider === null) {
    const failedProvider =
      input.providerOrder[input.providerOrder.length - 1] ??
      CURSOR_PROGRESS_PROVIDER;

    await input.dependencies.markCursorError(
      failedProvider,
      input.cursorType,
      input.fromBlock,
    );
    input.dependencies.logEvent({
      cursorType: input.cursorType,
      error:
        fetchError instanceof Error
          ? fetchError.message
          : "All providers failed",
      fromBlock: input.fromBlock.toString(),
      level: "error",
      message: "All providers failed for reconciliation chunk",
      toBlock: input.toBlock.toString(),
    });

    throw fetchError instanceof Error
      ? fetchError
      : new Error("All providers failed for reconciliation chunk");
  }

  let recoveredEvents = 0;
  let skippedProcessedEvents = 0;

  try {
    for (const event of events) {
      const reservedRawEvent = await input.dependencies.reserveRawEvent({
        cursorType: input.cursorType,
        event,
        fromBlock: input.fromBlock,
        provider: usedProvider,
        toBlock: input.toBlock,
      });

      if (reservedRawEvent.processed_at) {
        skippedProcessedEvents += 1;
        continue;
      }

      const matchResult = await input.dependencies.matchEvent({
        chainEvent: event,
        rawEventId: reservedRawEvent.id,
      });

      if (
        matchResult.evaluation?.outcome === "accepted_paid" ||
        matchResult.evaluation?.outcome === "accepted_pending"
      ) {
        recoveredEvents += 1;
      }
    }
  } catch (error) {
    await input.dependencies.markCursorError(
      usedProvider,
      input.cursorType,
      input.fromBlock,
    );
    input.dependencies.logEvent({
      cursorType: input.cursorType,
      error: error instanceof Error ? error.message : "Unknown scan failure",
      fromBlock: input.fromBlock.toString(),
      level: "error",
      message: "Reconciliation chunk processing failed",
      provider: usedProvider,
      toBlock: input.toBlock.toString(),
    });

    throw error;
  }

  input.dependencies.logEvent({
    cursorType: input.cursorType,
    fromBlock: input.fromBlock.toString(),
    level: "info",
    message: "Completed provider reconciliation scan",
    provider: usedProvider,
    recoveredEvents,
    toBlock: input.toBlock.toString(),
  });

  return {
    fromBlock: input.fromBlock,
    provider: usedProvider,
    recoveredEvents,
    scannedEvents: events.length,
    skippedProcessedEvents,
    toBlock: input.toBlock,
  };
}

/**
 * Resolves the block range for one scan cycle. When the cursor is stale, the
 * scan falls back to the latest bounded window instead of attempting an
 * unbounded catch-up that would violate the architecture's scan sizes.
 */
export function resolveScanWindow(input: {
  latestBlock: bigint;
  lastScannedBlock: bigint | null;
  windowSize: bigint;
}): { fromBlock: bigint; toBlock: bigint } {
  const boundedStart =
    input.latestBlock >= input.windowSize
      ? input.latestBlock - input.windowSize + BigInt(1)
      : BigInt(0);
  const resumedStart =
    input.lastScannedBlock === null
      ? boundedStart
      : input.lastScannedBlock + BigInt(1);
  const fromBlock = resumedStart > boundedStart ? resumedStart : boundedStart;

  return {
    fromBlock,
    toBlock: input.latestBlock,
  };
}

function createDefaultDependencies(): ReconcilerDependencies {
  return {
    fetchLatestBlockNumber: async () =>
      withRetry(
        async () => {
          const latestBlockHex = await ROUTED_RPC.callRpc<string>(
            "eth_blockNumber",
            [],
            { preferSecondaryOnDegradedPrimary: true },
          );
          return BigInt(latestBlockHex);
        },
        { label: "fetchLatestBlockNumber" },
      ),
    fetchTransferLogs: async (provider, fromBlock, toBlock) =>
      withRetry(
        async () => {
          const request = getProviderRequest(provider);
          const logs = await request<unknown[]>("eth_getLogs", [
            {
              address: BASE_USDC_CONTRACT,
              fromBlock: toRpcHex(fromBlock),
              toBlock: toRpcHex(toBlock),
              topics: [ERC20_TRANSFER_TOPIC],
            },
          ]);

          return normalizeRpcTransferLogs(logs, provider);
        },
        { label: `fetchTransferLogs(${provider})` },
      ),
    loadCursor: async (provider, cursorType) => {
      const database = await connectToDatabase();

      try {
        const rows = await database.sql<ChainCursorRow[]>`
          select last_scanned_block::text as last_scanned_block
          from chain_cursors
          where chain = ${BASE_CHAIN}
            and provider = ${provider}
            and cursor_type = ${cursorType}
          limit 1
        `;

        return rows[0] ? BigInt(rows[0].last_scanned_block) : null;
      } finally {
        await database.release();
      }
    },
    logEvent: logReconcilerEvent,
    markCursorError: async (provider, cursorType, failedFromBlock) => {
      const database = await connectToDatabase();

      try {
        const fallbackBlock =
          failedFromBlock > BigInt(0) ? failedFromBlock - BigInt(1) : BigInt(0);

        await database.sql`
          insert into chain_cursors (
            chain,
            provider,
            cursor_type,
            last_scanned_block,
            last_error_at,
            updated_at
          ) values (
            ${BASE_CHAIN},
            ${provider},
            ${cursorType},
            ${fallbackBlock.toString()}::bigint,
            now(),
            now()
          )
          on conflict (chain, provider, cursor_type)
          do update set
            last_error_at = now(),
            updated_at = now()
        `;
      } finally {
        await database.release();
      }
    },
    matchEvent: async (input) => {
      await pacedRpcGate();
      return withRetry(() => matchNormalizedChainEvent(input), {
        isRetryable: isRetryableRpcError,
        label: "matchEvent",
      });
    },
    recheckPayment: async (input) => {
      await pacedRpcGate();
      return withRetry(() => recheckDetectedPayment(input), {
        isRetryable: isRetryableRpcError,
        label: "recheckPayment",
      });
    },
    reserveRawEvent: async ({
      cursorType,
      event,
      fromBlock,
      provider,
      toBlock,
    }) => {
      const database = await connectToDatabase();

      try {
        const providerEventId = buildReconciliationProviderEventId(event);
        const rows = await database.sql<ProviderEventRawRow[]>`
          insert into provider_events_raw (
            provider,
            provider_event_id,
            chain,
            payload,
            signature_valid
          ) values (
            ${provider},
            ${providerEventId},
            ${BASE_CHAIN},
            ${JSON.stringify({
              __outpayRecoverySource: "missed_webhook",
              __outpaySource: "reconciler",
              cursorType,
              event: serializeChainEvent(event),
              fromBlock: fromBlock.toString(),
              observedAt: new Date().toISOString(),
              toBlock: toBlock.toString(),
            })}::jsonb,
            true
          )
          on conflict (provider, provider_event_id)
          do update set
            payload = excluded.payload
          returning
            id::text as id,
            processed_at::text as processed_at
        `;

        if (rows[0]) {
          emitMetric(METRIC_NAMES.missedWebhookRecoveredTotal, 1, {
            provider,
            source: "reconciler",
          });
        }

        return rows[0] as ProviderEventRawRow;
      } finally {
        await database.release();
      }
    },
    saveCursorSuccess: async ({ cursorType, lastScannedBlock, provider }) => {
      const database = await connectToDatabase();

      try {
        await database.sql`
          insert into chain_cursors (
            chain,
            provider,
            cursor_type,
            last_scanned_block,
            last_success_at,
            updated_at
          ) values (
            ${BASE_CHAIN},
            ${provider},
            ${cursorType},
            ${lastScannedBlock.toString()}::bigint,
            now(),
            now()
          )
          on conflict (chain, provider, cursor_type)
          do update set
            last_scanned_block = excluded.last_scanned_block,
            last_success_at = now(),
            updated_at = now()
        `;
      } finally {
        await database.release();
      }
    },
    selectConfirmationCheckoutSessionIds: async (limit) => {
      const database = await connectToDatabase();

      try {
        const rows = await database.sql<ConfirmationCheckoutRow[]>`
          select cs.id::text as checkout_session_id
          from payment_intents pi
          join checkout_sessions cs
            on cs.id = pi.checkout_session_id
          where pi.match_status = 'detected'::payment_match_status_enum
            and pi.detected_tx_id is not null
            and cs.status = 'detected'::checkout_status_enum
          order by pi.updated_at asc
          limit ${limit}
        `;

        return rows.map((row) => row.checkout_session_id);
      } finally {
        await database.release();
      }
    },
  };
}

function getProviderRequest(provider: RpcProviderName) {
  return provider === "alchemy"
    ? pacedAlchemyRpcRequest
    : pacedChainstackRpcRequest;
}

function buildReconciliationProviderEventId(
  event: NormalizedChainEvent,
): string {
  return [
    "reconcile",
    event.provider,
    event.chain,
    event.txHash.toLowerCase(),
    String(event.logIndex),
  ].join(":");
}

/**
 * `NormalizedChainEvent` carries `amountUnits`/`blockNumber` as `bigint`,
 * which `JSON.stringify` cannot serialize directly. This converts both to
 * strings so the event can be embedded in the `provider_events_raw.payload`
 * JSON column.
 */
function serializeChainEvent(
  event: NormalizedChainEvent,
): Record<string, unknown> {
  return {
    ...event,
    amountUnits: event.amountUnits.toString(),
    blockNumber: event.blockNumber.toString(),
  };
}

function scheduleRecurringTask(
  taskName: string,
  intervalMs: number,
  handler: () => Promise<unknown>,
): {
  stop: () => void;
  waitForIdle: () => Promise<void>;
} {
  let running = false;
  let disposed = false;
  let currentRun: Promise<void> | null = null;

  const execute = async () => {
    if (disposed || running) {
      if (running) {
        logReconcilerEvent({
          level: "warn",
          message: `Skipped overlapping ${taskName}`,
        });
      }
      return;
    }

    running = true;
    currentRun = (async () => {
      try {
        await handler();
      } catch (error) {
        logReconcilerEvent({
          error: error instanceof Error ? error.message : "Unknown task error",
          level: "error",
          message: `${taskName} failed`,
        });
      } finally {
        running = false;
        currentRun = null;
      }
    })();

    await currentRun;
  };

  void execute();
  const timer = setInterval(() => {
    void execute();
  }, intervalMs);

  return {
    stop: () => {
      disposed = true;
      clearInterval(timer);
    },
    waitForIdle: async () => {
      if (currentRun) {
        await currentRun;
      }
    },
  };
}

function minBigInt(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

function toRpcHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

function logReconcilerEvent(event: ReconcilerLoggerEvent): void {
  if (event.recoveredEvents && event.recoveredEvents > 0) {
    emitMetric(
      METRIC_NAMES.reconciliationEventsFoundTotal,
      event.recoveredEvents,
      {
        provider: event.provider,
      },
    );
  }

  const fields = {
    cursorType: event.cursorType ?? null,
    error: event.error ?? null,
    fromBlock: event.fromBlock ?? null,
    module: "workers/reconciler",
    provider: event.provider ?? null,
    recoveredEvents: event.recoveredEvents ?? null,
    toBlock: event.toBlock ?? null,
  };

  if (event.level === "error") {
    logger.error(fields, event.message);
  } else if (event.level === "warn") {
    logger.warn(fields, event.message);
  } else {
    logger.info(fields, event.message);
  }
}

function readPositiveIntegerEnv(
  rawValue: string | undefined,
  fallback: number,
) {
  const parsedValue = Number.parseInt(rawValue || "", 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

if (import.meta.main) {
  await startReconciliationWorker();
}

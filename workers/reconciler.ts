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
import {
  type MatchChainEventResult,
  matchNormalizedChainEvent,
  recheckDetectedPayment,
} from "@/lib/payments/match-payment";
import {
  type NormalizedChainEvent,
  normalizeRpcTransferLogs,
} from "@/lib/payments/normalize-event";
import { alchemyRpcRequest } from "@/lib/providers/alchemy";
import { chainstackRpcRequest } from "@/lib/providers/chainstack";
import { getLatestProviderHealthStatus } from "@/lib/providers/health";
import {
  createProviderRouter,
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
const RECENT_SCAN_WINDOW_BLOCKS = readPositiveIntegerEnv(
  process.env.RECONCILER_RECENT_WINDOW_BLOCKS?.trim(),
  180,
);
const DEEP_SCAN_WINDOW_BLOCKS = readPositiveIntegerEnv(
  process.env.RECONCILER_DEEP_WINDOW_BLOCKS?.trim(),
  4000,
);
const RECENT_SCAN_INTERVAL_MS = readPositiveIntegerEnv(
  process.env.RECONCILER_RECENT_INTERVAL_MS?.trim(),
  90_000,
);
const CONFIRMATION_SCAN_INTERVAL_MS = readPositiveIntegerEnv(
  process.env.RECONCILER_CONFIRMATION_INTERVAL_MS?.trim(),
  90_000,
);
const DEEP_SCAN_INTERVAL_MS = readPositiveIntegerEnv(
  process.env.RECONCILER_DEEP_INTERVAL_MS?.trim(),
  1_800_000,
);
const CONFIRMATION_SCAN_BATCH_SIZE = readPositiveIntegerEnv(
  process.env.RECONCILER_CONFIRMATION_BATCH_SIZE?.trim(),
  50,
);

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
    alchemy: alchemyRpcRequest,
    chainstack: chainstackRpcRequest,
  },
  resolvePrimaryState: (provider) =>
    getLatestProviderHealthStatus(provider, BASE_CHAIN),
  secondaryProvider: "chainstack",
});

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
     * Executes one recent reconciliation cycle across both configured
     * providers.
     */
    async runRecentScanCycle(): Promise<ReconciliationCycleSummary> {
      return runScanCycle({
        cursorType: "recent",
        dependencies,
        latestBlock: await dependencies.fetchLatestBlockNumber(),
        windowSize: BigInt(RECENT_SCAN_WINDOW_BLOCKS),
      });
    },

    /**
     * Executes one deep reconciliation cycle across both configured providers.
     */
    async runDeepScanCycle(): Promise<ReconciliationCycleSummary> {
      return runScanCycle({
        cursorType: "deep",
        dependencies,
        latestBlock: await dependencies.fetchLatestBlockNumber(),
        windowSize: BigInt(DEEP_SCAN_WINDOW_BLOCKS),
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
 * intervals.
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

  const shutdown = () => {
    for (const stopTask of scheduledTasks) {
      stopTask();
    }

    logReconcilerEvent({
      level: "info",
      message: "Reconciliation worker stopped",
    });

    process.exit(0);
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

async function runScanCycle(input: {
  cursorType: CursorType;
  dependencies: ReconcilerDependencies;
  latestBlock: bigint;
  windowSize: bigint;
}): Promise<ReconciliationCycleSummary> {
  const providers: ReconciliationCycleSummary["providers"] = [];

  for (const provider of ["alchemy", "chainstack"] as const) {
    providers.push(
      await scanProviderWindow({
        cursorType: input.cursorType,
        dependencies: input.dependencies,
        latestBlock: input.latestBlock,
        provider,
        windowSize: input.windowSize,
      }),
    );
  }

  input.dependencies.logEvent({
    cursorType: input.cursorType,
    level: "info",
    message: "Completed reconciliation scan cycle",
  });

  return {
    cursorType: input.cursorType,
    latestBlock: input.latestBlock,
    providers,
  };
}

async function scanProviderWindow(input: {
  cursorType: CursorType;
  dependencies: ReconcilerDependencies;
  latestBlock: bigint;
  provider: RpcProviderName;
  windowSize: bigint;
}): Promise<ReconciliationCycleSummary["providers"][number]> {
  const lastScannedBlock = await input.dependencies.loadCursor(
    input.provider,
    input.cursorType,
  );
  const { fromBlock, toBlock } = resolveScanWindow({
    latestBlock: input.latestBlock,
    lastScannedBlock,
    windowSize: input.windowSize,
  });

  try {
    const events = await input.dependencies.fetchTransferLogs(
      input.provider,
      fromBlock,
      toBlock,
    );
    let recoveredEvents = 0;
    let skippedProcessedEvents = 0;

    for (const event of events) {
      const reservedRawEvent = await input.dependencies.reserveRawEvent({
        cursorType: input.cursorType,
        event,
        fromBlock,
        provider: input.provider,
        toBlock,
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

    await input.dependencies.saveCursorSuccess({
      cursorType: input.cursorType,
      lastScannedBlock: toBlock,
      provider: input.provider,
    });

    input.dependencies.logEvent({
      cursorType: input.cursorType,
      fromBlock: fromBlock.toString(),
      level: "info",
      message: "Completed provider reconciliation scan",
      provider: input.provider,
      recoveredEvents,
      toBlock: toBlock.toString(),
    });

    return {
      fromBlock,
      provider: input.provider,
      recoveredEvents,
      scannedEvents: events.length,
      skippedProcessedEvents,
      toBlock,
    };
  } catch (error) {
    await input.dependencies.markCursorError(
      input.provider,
      input.cursorType,
      fromBlock,
    );

    input.dependencies.logEvent({
      cursorType: input.cursorType,
      error: error instanceof Error ? error.message : "Unknown scan failure",
      fromBlock: fromBlock.toString(),
      level: "error",
      message: "Provider reconciliation scan failed",
      provider: input.provider,
      toBlock: toBlock.toString(),
    });

    throw error;
  }
}

/**
 * Resolves the block range for one provider/cursor scan. When the cursor is
 * stale, the scan falls back to the latest bounded window instead of attempting
 * an unbounded catch-up that would violate the architecture's scan sizes.
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
    fetchLatestBlockNumber: async () => {
      const latestBlockHex = await ROUTED_RPC.callRpc<string>(
        "eth_blockNumber",
        [],
        { preferSecondaryOnDegradedPrimary: true },
      );
      return BigInt(latestBlockHex);
    },
    fetchTransferLogs: async (provider, fromBlock, toBlock) => {
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
    matchEvent: matchNormalizedChainEvent,
    recheckPayment: recheckDetectedPayment,
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
              event,
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
  return provider === "alchemy" ? alchemyRpcRequest : chainstackRpcRequest;
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

function scheduleRecurringTask(
  taskName: string,
  intervalMs: number,
  handler: () => Promise<unknown>,
): () => void {
  let running = false;
  let disposed = false;

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
    }
  };

  void execute();
  const timer = setInterval(() => {
    void execute();
  }, intervalMs);

  return () => {
    disposed = true;
    clearInterval(timer);
  };
}

function toRpcHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

function logReconcilerEvent(event: ReconcilerLoggerEvent): void {
  const logger =
    event.level === "error"
      ? console.error
      : event.level === "warn"
        ? console.warn
        : console.info;

  logger(
    JSON.stringify({
      cursorType: event.cursorType ?? null,
      error: event.error ?? null,
      fromBlock: event.fromBlock ?? null,
      level: event.level,
      message: event.message,
      module: "workers/reconciler",
      provider: event.provider ?? null,
      recoveredEvents: event.recoveredEvents ?? null,
      timestamp: new Date().toISOString(),
      toBlock: event.toBlock ?? null,
    }),
  );
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

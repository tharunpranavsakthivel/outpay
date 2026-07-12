/**
 * Provider health checks and health-state transitions for Base RPC providers.
 * Each run probes both providers independently, persists a durable health row,
 * and exposes a pure state machine for unit testing.
 */

import { connectToDatabase } from "@/lib/database/client";
import { logger } from "@/lib/logging/logger";
import { alchemyRpcRequest } from "@/lib/providers/alchemy";
import { chainstackRpcRequest } from "@/lib/providers/chainstack";
import type {
  ProviderHealthStatus,
  RpcProviderName,
} from "@/lib/providers/provider-router";

const BASE_CHAIN = "base";
const BASE_CHAIN_ID_HEX = "0x2105";
const BASE_USDC_CONTRACT_ADDRESS = "0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913";
const TRANSFER_EVENT_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const HEALTH_CHECK_INTERVAL_SECONDS = parsePositiveIntegerEnv(
  process.env.RPC_HEALTH_CHECK_INTERVAL_SECONDS?.trim(),
  30,
  "RPC_HEALTH_CHECK_INTERVAL_SECONDS",
);
const HEALTH_FAILURE_WINDOW_MS = 2 * 60_000;
const HEALTH_FAILURE_THRESHOLD = 5;
const HEALTH_RECOVERY_SUCCESS_COUNT = 5;
const HIGH_LATENCY_THRESHOLD_MS = 3_000;
const HIGH_LATENCY_RATE_THRESHOLD = 0.5;
const DOWN_CONSECUTIVE_FAILURE_THRESHOLD = 3;

export interface ProviderHealthCheckResult {
  blockNumber: bigint | null;
  chain: "base";
  checkedAt: Date;
  error: string | null;
  latencyMs: number | null;
  previousStatus: ProviderHealthStatus | null;
  provider: RpcProviderName;
  rollingWindow: ProviderHealthWindowSnapshot;
  status: ProviderHealthStatus;
  transition: ProviderHealthTransition | null;
}

export interface ProviderHealthObservation {
  checkedAt: Date;
  error: string | null;
  latencyMs: number | null;
  ok: boolean;
  provider: RpcProviderName;
  rateLimited: boolean;
  status?: ProviderHealthStatus | null;
  timedOut: boolean;
}

export interface ProviderHealthTransition {
  nextStatus: ProviderHealthStatus;
  previousStatus: ProviderHealthStatus | null;
}

export interface ProviderHealthWindowSnapshot {
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  errorCount: number;
  errorRate: number;
  highLatencyCount: number;
  highLatencyRate: number;
  observationCount: number;
  rateLimitCount: number;
  rateLimitRate: number;
  timeoutCount: number;
  timeoutRate: number;
}

interface StoredProviderHealthRow {
  checked_at: string;
  error: string | null;
  latency_ms: number | null;
  status: ProviderHealthStatus;
}

type RpcProbeFunction = <T>(
  method: string,
  params?: readonly unknown[],
) => Promise<T>;

const PROVIDER_REQUESTERS: Record<RpcProviderName, RpcProbeFunction> = {
  alchemy: alchemyRpcRequest,
  chainstack: chainstackRpcRequest,
};

/**
 * Runs health checks for both configured RPC providers.
 *
 * Returns:
 * - Durable health-check results in provider order.
 */
export async function runAllProviderHealthChecks(): Promise<
  ProviderHealthCheckResult[]
> {
  const results: ProviderHealthCheckResult[] = [];

  for (const provider of ["alchemy", "chainstack"] as const) {
    results.push(await runProviderHealthCheck(provider));
  }

  return results;
}

/**
 * Runs a single provider health check, persists the result, and returns the
 * computed status row.
 *
 * Parameters:
 * - provider: Provider name to probe.
 *
 * Returns:
 * - Persisted provider health-check result.
 */
export async function runProviderHealthCheck(
  provider: RpcProviderName,
): Promise<ProviderHealthCheckResult> {
  const checkedAt = new Date();
  const recentHistory = await loadRecentProviderHealthRows(
    provider,
    BASE_CHAIN,
  );
  const previousStatus = recentHistory[0]?.status ?? null;

  try {
    const startTime = performance.now();
    const chainIdHex = await PROVIDER_REQUESTERS[provider]<string>(
      "eth_chainId",
      [],
    );

    if (chainIdHex.toLowerCase() !== BASE_CHAIN_ID_HEX) {
      throw new Error(
        `Unexpected chain id ${chainIdHex}; expected ${BASE_CHAIN_ID_HEX}.`,
      );
    }

    const blockNumberHex = await PROVIDER_REQUESTERS[provider]<string>(
      "eth_blockNumber",
      [],
    );
    const blockNumber = parseHexBigInt(blockNumberHex);

    await PROVIDER_REQUESTERS[provider]("eth_getBlockByNumber", [
      "latest",
      false,
    ]);

    const fromBlock =
      blockNumber > BigInt(0) ? blockNumber - BigInt(1) : BigInt(0);

    await PROVIDER_REQUESTERS[provider]("eth_getLogs", [
      {
        address: BASE_USDC_CONTRACT_ADDRESS,
        fromBlock: toRpcHex(fromBlock),
        toBlock: toRpcHex(blockNumber),
        topics: [TRANSFER_EVENT_TOPIC],
      },
    ]);

    const latencyMs = Math.round(performance.now() - startTime);
    const currentObservation: ProviderHealthObservation = {
      checkedAt,
      error: null,
      latencyMs,
      ok: true,
      provider,
      rateLimited: false,
      status: null,
      timedOut: false,
    };
    const rollingWindow = summarizeProviderHealthWindow([
      currentObservation,
      ...recentHistory.map(mapStoredRowToObservation(provider)),
    ]);
    const status = deriveProviderHealthStatus({
      currentObservation,
      previousStatus,
      recentObservations: recentHistory.map(
        mapStoredRowToObservation(provider),
      ),
    });
    const transition = deriveProviderHealthTransition(previousStatus, status);

    await insertProviderHealthCheck({
      blockNumber,
      chain: BASE_CHAIN,
      checkedAt,
      error: null,
      latencyMs,
      provider,
      status,
    });

    return {
      blockNumber,
      chain: BASE_CHAIN,
      checkedAt,
      error: null,
      latencyMs,
      previousStatus,
      provider,
      rollingWindow,
      status,
      transition,
    };
  } catch (error) {
    const currentObservation = classifyFailedObservation(
      provider,
      checkedAt,
      error,
    );
    const rollingWindow = summarizeProviderHealthWindow([
      currentObservation,
      ...recentHistory.map(mapStoredRowToObservation(provider)),
    ]);
    const status = deriveProviderHealthStatus({
      currentObservation,
      previousStatus,
      recentObservations: recentHistory.map(
        mapStoredRowToObservation(provider),
      ),
    });
    const transition = deriveProviderHealthTransition(previousStatus, status);

    await insertProviderHealthCheck({
      blockNumber: null,
      chain: BASE_CHAIN,
      checkedAt,
      error: currentObservation.error,
      latencyMs: currentObservation.latencyMs,
      provider,
      status,
    });
    logProviderHealthEvent({
      error: currentObservation.error,
      provider,
      rollingWindow,
      status,
      transition,
    });

    return {
      blockNumber: null,
      chain: BASE_CHAIN,
      checkedAt,
      error: currentObservation.error,
      latencyMs: currentObservation.latencyMs,
      previousStatus,
      provider,
      rollingWindow,
      status,
      transition,
    };
  }
}

/**
 * Returns the latest stored health status for a provider, if any.
 *
 * Parameters:
 * - provider: Provider name to inspect.
 * - chain: Blockchain identifier, defaults to `base`.
 *
 * Returns:
 * - Latest stored health status, or `null` when no checks have been recorded.
 */
export async function getLatestProviderHealthStatus(
  provider: RpcProviderName,
  chain = BASE_CHAIN,
): Promise<ProviderHealthStatus | null> {
  const database = await connectToDatabase();

  try {
    const rows = await database.sql<{ status: ProviderHealthStatus }[]>`
      select status
      from provider_health_checks
      where provider = ${provider}
        and chain = ${chain}
      order by checked_at desc
      limit 1
    `;

    return rows[0]?.status ?? null;
  } finally {
    await database.release();
  }
}

/**
 * Computes the provider health status from the latest observation and recent
 * history window.
 *
 * Parameters:
 * - currentObservation: Current probe result.
 * - previousStatus: Most recent persisted provider status before this probe.
 * - recentObservations: Recent checks in descending recency order.
 *
 * Returns:
 * - Provider health state that should be persisted for the current probe.
 */
export function deriveProviderHealthStatus(input: {
  currentObservation: ProviderHealthObservation;
  previousStatus: ProviderHealthStatus | null;
  recentObservations: ProviderHealthObservation[];
}): ProviderHealthStatus {
  const relevantHistory = [
    input.currentObservation,
    ...input.recentObservations.filter(
      (observation) =>
        input.currentObservation.checkedAt.getTime() -
          observation.checkedAt.getTime() <=
        HEALTH_FAILURE_WINDOW_MS,
    ),
  ].sort((left, right) => right.checkedAt.getTime() - left.checkedAt.getTime());
  const rollingWindow = summarizeProviderHealthWindow(relevantHistory);
  const currentObservation = input.currentObservation;
  const recoveringBaseline =
    input.previousStatus === "degraded" ||
    input.previousStatus === "down" ||
    input.previousStatus === "rate_limited" ||
    input.previousStatus === "recovering";
  const degradedForWindow =
    rollingWindow.errorCount > HEALTH_FAILURE_THRESHOLD ||
    rollingWindow.highLatencyRate >= HIGH_LATENCY_RATE_THRESHOLD;

  if (currentObservation.rateLimited) {
    return "rate_limited";
  }

  if (!currentObservation.ok) {
    if (
      (input.previousStatus === "degraded" ||
        input.previousStatus === "down" ||
        input.previousStatus === "rate_limited") &&
      rollingWindow.consecutiveFailures >= DOWN_CONSECUTIVE_FAILURE_THRESHOLD &&
      (currentObservation.timedOut || degradedForWindow)
    ) {
      return "down";
    }

    if (degradedForWindow) {
      return "degraded";
    }

    return input.previousStatus === "recovering"
      ? "degraded"
      : (input.previousStatus ?? "healthy");
  }

  if (
    recoveringBaseline &&
    rollingWindow.consecutiveSuccesses < HEALTH_RECOVERY_SUCCESS_COUNT
  ) {
    return "recovering";
  }

  if (degradedForWindow) {
    return "degraded";
  }

  if (
    recoveringBaseline &&
    rollingWindow.consecutiveSuccesses >= HEALTH_RECOVERY_SUCCESS_COUNT
  ) {
    return "healthy";
  }

  return "healthy";
}

/**
 * Builds a transition record when the provider changes state.
 *
 * Parameters:
 * - previousStatus: Latest persisted state before the current probe.
 * - nextStatus: Newly derived provider state.
 *
 * Returns:
 * - Transition metadata for alert fan-out, or `null` when the state did not
 *   change.
 */
export function deriveProviderHealthTransition(
  previousStatus: ProviderHealthStatus | null,
  nextStatus: ProviderHealthStatus,
): ProviderHealthTransition | null {
  if (previousStatus === nextStatus) {
    return null;
  }

  return {
    nextStatus,
    previousStatus,
  };
}

/**
 * Summarizes the rolling provider-health window used by the failover state
 * machine.
 *
 * Parameters:
 * - observations: Recent observations ordered newest-first or unsorted.
 *
 * Returns:
 * - Counts and rates for failures, timeouts, rate limits, and latency.
 */
export function summarizeProviderHealthWindow(
  observations: ProviderHealthObservation[],
): ProviderHealthWindowSnapshot {
  const orderedObservations = [...observations].sort(
    (left, right) => right.checkedAt.getTime() - left.checkedAt.getTime(),
  );
  const observationCount = orderedObservations.length;
  const errorCount = orderedObservations.filter(
    (observation) => !observation.ok,
  ).length;
  const timeoutCount = orderedObservations.filter(
    (observation) => observation.timedOut,
  ).length;
  const rateLimitCount = orderedObservations.filter(
    (observation) => observation.rateLimited,
  ).length;
  const highLatencyCount = orderedObservations.filter(
    (observation) =>
      observation.ok &&
      observation.latencyMs !== null &&
      observation.latencyMs >= HIGH_LATENCY_THRESHOLD_MS,
  ).length;

  return {
    consecutiveFailures: countLeadingObservations(
      orderedObservations,
      (observation) => !observation.ok,
    ),
    consecutiveSuccesses: countLeadingObservations(
      orderedObservations,
      (observation) => observation.ok,
    ),
    errorCount,
    errorRate: divideSafely(errorCount, observationCount),
    highLatencyCount,
    highLatencyRate: divideSafely(highLatencyCount, observationCount),
    observationCount,
    rateLimitCount,
    rateLimitRate: divideSafely(rateLimitCount, observationCount),
    timeoutCount,
    timeoutRate: divideSafely(timeoutCount, observationCount),
  };
}

/**
 * Exposes the configured health-check interval for future schedulers/workers.
 *
 * Returns:
 * - Health-check cadence in seconds.
 */
export function getProviderHealthCheckIntervalSeconds(): number {
  return HEALTH_CHECK_INTERVAL_SECONDS;
}

/**
 * Loads recent provider-health rows for status derivation.
 *
 * Parameters:
 * - provider: Provider name to inspect.
 * - chain: Blockchain identifier.
 *
 * Returns:
 * - Recent stored rows ordered from newest to oldest.
 */
async function loadRecentProviderHealthRows(
  provider: RpcProviderName,
  chain: string,
): Promise<StoredProviderHealthRow[]> {
  const database = await connectToDatabase();

  try {
    return await database.sql<StoredProviderHealthRow[]>`
      select
        checked_at::text,
        error,
        latency_ms,
        status
      from provider_health_checks
      where provider = ${provider}
        and chain = ${chain}
      order by checked_at desc
      limit 20
    `;
  } finally {
    await database.release();
  }
}

/**
 * Persists a provider-health check row.
 *
 * Parameters:
 * - input: Provider health-check values ready for insertion.
 */
async function insertProviderHealthCheck(input: {
  blockNumber: bigint | null;
  chain: string;
  checkedAt: Date;
  error: string | null;
  latencyMs: number | null;
  provider: RpcProviderName;
  status: ProviderHealthStatus;
}): Promise<void> {
  const database = await connectToDatabase();

  try {
    await database.sql`
      insert into provider_health_checks (
        provider,
        chain,
        status,
        latency_ms,
        block_number,
        error,
        checked_at
      ) values (
        ${input.provider},
        ${input.chain},
        ${input.status},
        ${input.latencyMs},
        ${input.blockNumber?.toString() ?? null},
        ${input.error},
        ${input.checkedAt.toISOString()}
      )
    `;
  } finally {
    await database.release();
  }
}

/**
 * Maps a stored provider-health row back into the observation shape used by
 * the pure status-derivation logic.
 *
 * Parameters:
 * - provider: Provider name associated with the stored row.
 *
 * Returns:
 * - Mapper function for stored rows.
 */
function mapStoredRowToObservation(provider: RpcProviderName) {
  return (row: StoredProviderHealthRow): ProviderHealthObservation => ({
    checkedAt: new Date(row.checked_at),
    error: row.error,
    latencyMs: row.latency_ms,
    ok: row.error === null,
    provider,
    rateLimited:
      row.status === "rate_limited" || isRateLimitedErrorMessage(row.error),
    status: row.status,
    timedOut: isTimeoutErrorMessage(row.error),
  });
}

/**
 * Classifies a failed RPC probe into the normalized observation shape.
 *
 * Parameters:
 * - provider: Provider that failed.
 * - checkedAt: Probe timestamp.
 * - error: Caught RPC exception.
 *
 * Returns:
 * - Failed observation metadata for status derivation and persistence.
 */
function classifyFailedObservation(
  provider: RpcProviderName,
  checkedAt: Date,
  error: unknown,
): ProviderHealthObservation {
  const errorMessage =
    error instanceof Error ? error.message : "Unknown provider health error";

  return {
    checkedAt,
    error: sanitizeErrorMessage(errorMessage),
    latencyMs: null,
    ok: false,
    provider,
    rateLimited: isRateLimitedErrorMessage(errorMessage),
    status: null,
    timedOut: isTimeoutErrorMessage(errorMessage),
  };
}

/**
 * Counts leading observations while a predicate remains true. The input is
 * expected to be ordered newest-first.
 *
 * Parameters:
 * - observations: Observation list ordered newest-first.
 * - predicate: Condition that each leading observation must satisfy.
 *
 * Returns:
 * - Number of consecutive leading observations matching the predicate.
 */
function countLeadingObservations(
  observations: ProviderHealthObservation[],
  predicate: (observation: ProviderHealthObservation) => boolean,
): number {
  let count = 0;

  for (const observation of observations) {
    if (!predicate(observation)) {
      break;
    }

    count += 1;
  }

  return count;
}

/**
 * Parses a hex-encoded block number into bigint.
 *
 * Parameters:
 * - value: RPC hex quantity string.
 *
 * Returns:
 * - Parsed bigint value.
 */
function parseHexBigInt(value: string): bigint {
  return BigInt(value);
}

/**
 * Formats a bigint into an RPC hex quantity.
 *
 * Parameters:
 * - value: Non-negative bigint value.
 *
 * Returns:
 * - Hex quantity string for JSON-RPC calls.
 */
function toRpcHex(value: bigint): string {
  return `0x${value.toString(16)}`;
}

/**
 * Parses a positive integer environment variable.
 *
 * Parameters:
 * - rawValue: Raw environment-variable value.
 * - defaultValue: Fallback when the variable is unset.
 * - variableName: Variable name used in error messages.
 *
 * Returns:
 * - Positive integer configuration value.
 */
function parsePositiveIntegerEnv(
  rawValue: string | undefined,
  defaultValue: number,
  variableName: string,
): number {
  if (!rawValue) {
    return defaultValue;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${variableName} must be a positive integer.`);
  }

  return parsed;
}

/**
 * Divides two numbers while treating an empty observation set as zero.
 *
 * Parameters:
 * - numerator: Count for the metric of interest.
 * - denominator: Total observations in the rolling window.
 *
 * Returns:
 * - Decimal rate in the inclusive range `[0, 1]`.
 */
function divideSafely(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

/**
 * Detects whether a provider error looks like rate limiting.
 *
 * Parameters:
 * - message: Error message to inspect.
 *
 * Returns:
 * - `true` when the error likely indicates provider-side rate limiting.
 */
function isRateLimitedErrorMessage(message: string | null): boolean {
  if (!message) {
    return false;
  }

  return /429|rate.?limit|too many requests|-32005/iu.test(message);
}

/**
 * Detects whether a provider error looks like a timeout.
 *
 * Parameters:
 * - message: Error message to inspect.
 *
 * Returns:
 * - `true` when the error likely indicates a timeout.
 */
function isTimeoutErrorMessage(message: string | null): boolean {
  if (!message) {
    return false;
  }

  return /timeout|timed out|abort/iu.test(message);
}

/**
 * Emits a structured provider-health log line without exposing RPC URLs.
 *
 * Parameters:
 * - provider: Provider name.
 * - status: Computed health status.
 * - error: Sanitized error message, if any.
 */
function logProviderHealthEvent(input: {
  error: string | null;
  provider: RpcProviderName;
  rollingWindow: ProviderHealthWindowSnapshot;
  status: ProviderHealthStatus;
  transition: ProviderHealthTransition | null;
}): void {
  logger.error(
    {
      chain: BASE_CHAIN,
      error: input.error,
      errorRate: input.rollingWindow.errorRate,
      highLatencyRate: input.rollingWindow.highLatencyRate,
      module: "provider-health",
      provider: input.provider,
      rateLimitRate: input.rollingWindow.rateLimitRate,
      status: input.status,
      timeoutRate: input.rollingWindow.timeoutRate,
      transitionFrom: input.transition?.previousStatus ?? null,
      transitionTo: input.transition?.nextStatus ?? null,
    },
    "Provider health check failed or degraded",
  );
}

/**
 * Removes any URL-looking substrings from provider error messages before they
 * are persisted or logged.
 *
 * Parameters:
 * - message: Raw provider error message.
 *
 * Returns:
 * - Sanitized message safe for logs/database rows.
 */
function sanitizeErrorMessage(message: string): string {
  return message.replace(/https?:\/\/\S+/giu, "[redacted-url]");
}

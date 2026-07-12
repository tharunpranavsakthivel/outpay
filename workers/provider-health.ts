/**
 * Interval-driven provider health monitor for Alchemy and Chainstack.
 *
 * Exports:
 * - `createProviderHealthWorker`: Testable worker with injectable checks and
 *   alert fan-out.
 * - `startProviderHealthWorker`: Bun entrypoint for the long-running monitor.
 *
 * Critical dependencies:
 * - `src/lib/providers/health.ts` for durable probes and state transitions.
 * - BullMQ alert queue helpers for operator-visible transition fan-out.
 */

import { logger } from "@/lib/logging/logger";
import { emitMetric, METRIC_NAMES } from "@/lib/observability/metrics";
import {
  getProviderHealthCheckIntervalSeconds,
  type ProviderHealthCheckResult,
  runAllProviderHealthChecks,
} from "@/lib/providers/health";
import {
  type AlertJobPayload,
  closeQueues,
  enqueueAlertJob,
} from "@/lib/queues/jobs";
import { closeSharedRedisConnection } from "@/lib/queues/redis";

interface ProviderHealthWorkerDependencies {
  enqueueAlert: (payload: AlertJobPayload) => Promise<void>;
  logEvent: (event: ProviderHealthWorkerLogEvent) => void;
  runChecks: () => Promise<ProviderHealthCheckResult[]>;
}

interface ProviderHealthWorkerLogEvent {
  alertsQueued?: number;
  error?: string;
  level: "error" | "info" | "warn";
  message: string;
  provider?: string;
  status?: string;
  transitionFrom?: string | null;
  transitionTo?: string | null;
}

export interface ProviderHealthCycleSummary {
  alertsQueued: number;
  checks: ProviderHealthCheckResult[];
}

const HEALTH_CHECK_INTERVAL_MS =
  getProviderHealthCheckIntervalSeconds() * 1_000;

/**
 * Creates the provider health worker so tests can supply fake probes and alert
 * sinks.
 *
 * Parameters:
 * - dependencies: Probe runner, alert publisher, and structured logger.
 *
 * Returns:
 * - Worker with a single `runCycle` method.
 */
export function createProviderHealthWorker(
  dependencies: ProviderHealthWorkerDependencies,
) {
  return {
    /**
     * Executes one full health-monitoring cycle across both providers.
     *
     * Returns:
     * - Probe results plus the number of alerts queued for transitions.
     */
    async runCycle(): Promise<ProviderHealthCycleSummary> {
      const checks = await dependencies.runChecks();
      let alertsQueued = 0;

      for (const check of checks) {
        const latencyMetric =
          check.provider === "alchemy"
            ? METRIC_NAMES.alchemyRpcLatencyMs
            : METRIC_NAMES.chainstackRpcLatencyMs;
        if (check.latencyMs !== null) {
          emitMetric(latencyMetric, check.latencyMs, {
            provider: check.provider,
            status: check.status,
          });
        }

        if (!check.transition) {
          continue;
        }

        await dependencies.enqueueAlert(buildProviderHealthAlertPayload(check));
        alertsQueued += 1;
        dependencies.logEvent({
          level: check.status === "healthy" ? "info" : "warn",
          message: "Queued provider health transition alert",
          provider: check.provider,
          status: check.status,
          transitionFrom: check.transition.previousStatus,
          transitionTo: check.transition.nextStatus,
        });
      }

      dependencies.logEvent({
        alertsQueued,
        level: "info",
        message: "Completed provider health cycle",
      });

      return {
        alertsQueued,
        checks,
      };
    },
  };
}

/**
 * Starts the recurring provider health monitor.
 */
export async function startProviderHealthWorker(): Promise<void> {
  const worker = createProviderHealthWorker({
    enqueueAlert: enqueueAlertJob,
    logEvent: logProviderHealthWorkerEvent,
    runChecks: runAllProviderHealthChecks,
  });
  const scheduledTask = scheduleRecurringTask(
    "provider health cycle",
    HEALTH_CHECK_INTERVAL_MS,
    () => worker.runCycle(),
  );

  logProviderHealthWorkerEvent({
    level: "info",
    message: "Provider health worker started",
  });

  const shutdown = async () => {
    scheduledTask.stop();
    await scheduledTask.waitForIdle();
    await closeQueues().catch(() => undefined);
    await closeSharedRedisConnection().catch(() => undefined);
    logProviderHealthWorkerEvent({
      level: "info",
      message: "Provider health worker stopped",
    });
    process.exit(0);
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
}

/**
 * Builds the alert payload expected by the architecture's `alerts` queue.
 *
 * Parameters:
 * - check: Completed provider health check with transition metadata.
 *
 * Returns:
 * - Deterministic alert payload for the new provider state.
 */
export function buildProviderHealthAlertPayload(
  check: ProviderHealthCheckResult,
): AlertJobPayload {
  return {
    dedupeKey: `provider-health:${check.provider}:${check.status}`,
    message: [
      `Provider ${check.provider} transitioned`,
      `from ${check.transition?.previousStatus ?? "unknown"}`,
      `to ${check.status}.`,
    ].join(" "),
    metadata: {
      blockNumber: check.blockNumber?.toString() ?? null,
      chain: check.chain,
      checkedAt: check.checkedAt.toISOString(),
      error: check.error,
      latencyMs: check.latencyMs,
      previousStatus: check.previousStatus,
      rollingWindow: check.rollingWindow,
      status: check.status,
    },
    severity: mapAlertSeverity(check.status),
    source: check.provider,
  };
}

/**
 * Maps provider state to the alert severity used by the queue payload.
 *
 * Parameters:
 * - status: Provider state after the current transition.
 *
 * Returns:
 * - Alert severity representing operational urgency.
 */
function mapAlertSeverity(
  status: ProviderHealthCheckResult["status"],
): AlertJobPayload["severity"] {
  if (status === "down") {
    return "critical";
  }

  if (status === "rate_limited") {
    return "error";
  }

  if (status === "degraded" || status === "recovering") {
    return "warning";
  }

  return "info";
}

/**
 * Schedules a recurring async task while preventing overlapping executions.
 *
 * Parameters:
 * - taskName: Human-readable task identifier for logs.
 * - intervalMs: Interval between attempts.
 * - handler: Async task body.
 *
 * Returns:
 * - Cleanup function that stops future runs.
 */
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
        logProviderHealthWorkerEvent({
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
        logProviderHealthWorkerEvent({
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

/**
 * Emits a structured log line for provider-health worker operations.
 *
 * Parameters:
 * - event: Log metadata for the completed worker step.
 */
function logProviderHealthWorkerEvent(
  event: ProviderHealthWorkerLogEvent,
): void {
  const fields = {
    alertsQueued: event.alertsQueued ?? null,
    error: event.error ?? null,
    module: "workers/provider-health",
    provider: event.provider ?? null,
    status: event.status ?? null,
    transitionFrom: event.transitionFrom ?? null,
    transitionTo: event.transitionTo ?? null,
  };

  if (event.level === "error") {
    logger.error(fields, event.message);
  } else if (event.level === "warn") {
    logger.warn(fields, event.message);
  } else {
    logger.info(fields, event.message);
  }
}

if (import.meta.main) {
  await startProviderHealthWorker();
}

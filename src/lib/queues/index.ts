/**
 * Central BullMQ queue registry for Outpay's durable background processing.
 *
 * This module defines the architecture-mandated queues, queue-specific retry
 * behavior, deterministic job IDs, dead-letter handling, and lightweight
 * admin-facing inspection helpers.
 */

import {
  type Queue as BullMqQueue,
  type ConnectionOptions,
  Job,
  type JobsOptions,
  Queue,
  type Worker,
} from "bullmq";
import type { SerializedChainEvent } from "@/lib/payments/normalize-event";
import {
  getWebhookRetryDelayMsAfterFailure,
  WEBHOOK_DELIVERY_MAX_ATTEMPTS,
} from "@/lib/webhooks/retry";
import { getSharedRedisConnection } from "./redis";

const COMPLETED_JOB_RETENTION = { count: 1000 } as const;
const FAILED_JOB_RETENTION = { count: 5000 } as const;
const DEFAULT_QUEUE_PREFIX = "bull";

export const QUEUE_NAMES = {
  alerts: "alerts",
  chainEvents: "chain-events",
  confirmations: "confirmations",
  deadLetter: "dead-letter",
  merchantWebhooks: "merchant-webhooks",
  paymentMatching: "payment-matching",
  reconciliation: "reconciliation",
} as const;

export const QUEUE_WORKER_RECOVERY_OPTIONS = {
  lockDuration: 60_000,
  maxStalledCount: 2,
  stalledInterval: 30_000,
} as const;

export const MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME = "merchant-webhook-retry";

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface ChainEventJobPayload {
  chainEvent: SerializedChainEvent;
  rawEventId: string;
}

export interface PaymentMatchJobPayload {
  checkoutSessionId: string;
}

export interface ConfirmationJobPayload {
  checkoutSessionId: string;
}

export interface MerchantWebhookJobPayload {
  attemptNumber: number;
  webhookEventId: string;
}

export interface ReconciliationJobPayload {
  chain: string;
  cursorType: "confirmation" | "deep" | "daily-audit" | "recent";
  fromBlock: bigint | number | string;
  reason:
    | "manual-repair"
    | "payment-match-fallback"
    | "provider-gap"
    | "scheduled";
  toBlock: bigint | number | string;
}

export interface AlertJobPayload {
  dedupeKey: string;
  message: string;
  metadata?: Record<string, unknown>;
  severity: "critical" | "error" | "info" | "warning";
  source: "alchemy" | "chainstack" | "database" | "queue" | "webhook-worker";
}

export interface DeadLetterJobPayload {
  attemptsMade: number;
  failedAt: string;
  originalJobId: string;
  originalJobName: string;
  originalPayload: unknown;
  originalQueue: QueueName;
  failureMessage: string;
}

export interface DeadLetterJobRecord extends DeadLetterJobPayload {
  deadLetterJobId: string;
  enqueuedAt: string | null;
}

type QueuePayloadMap = {
  [QUEUE_NAMES.alerts]: AlertJobPayload;
  [QUEUE_NAMES.chainEvents]: ChainEventJobPayload;
  [QUEUE_NAMES.confirmations]: ConfirmationJobPayload;
  [QUEUE_NAMES.deadLetter]: DeadLetterJobPayload;
  [QUEUE_NAMES.merchantWebhooks]: MerchantWebhookJobPayload;
  [QUEUE_NAMES.paymentMatching]: PaymentMatchJobPayload;
  [QUEUE_NAMES.reconciliation]: ReconciliationJobPayload;
};

const queueRegistry = new Map<
  QueueName,
  BullMqQueue<QueuePayloadMap[QueueName], void, string>
>();

const queueDefaultJobOptions: Record<QueueName, JobsOptions> = {
  [QUEUE_NAMES.alerts]: {
    attempts: 5,
    backoff: {
      delay: 60_000,
      type: "fixed",
    },
    removeOnComplete: COMPLETED_JOB_RETENTION,
    removeOnFail: FAILED_JOB_RETENTION,
  },
  [QUEUE_NAMES.chainEvents]: {
    attempts: 5,
    backoff: {
      delay: 1_000,
      type: "exponential",
    },
    removeOnComplete: COMPLETED_JOB_RETENTION,
    removeOnFail: FAILED_JOB_RETENTION,
  },
  [QUEUE_NAMES.confirmations]: {
    attempts: 4,
    backoff: {
      delay: 30_000,
      type: "fixed",
    },
    removeOnComplete: COMPLETED_JOB_RETENTION,
    removeOnFail: FAILED_JOB_RETENTION,
  },
  [QUEUE_NAMES.deadLetter]: {
    attempts: 1,
    removeOnComplete: false,
    removeOnFail: false,
  },
  [QUEUE_NAMES.merchantWebhooks]: {
    attempts: WEBHOOK_DELIVERY_MAX_ATTEMPTS,
    backoff: {
      type: MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME,
    },
    removeOnComplete: COMPLETED_JOB_RETENTION,
    removeOnFail: FAILED_JOB_RETENTION,
  },
  [QUEUE_NAMES.paymentMatching]: {
    attempts: 3,
    backoff: {
      delay: 5_000,
      type: "fixed",
    },
    removeOnComplete: COMPLETED_JOB_RETENTION,
    removeOnFail: FAILED_JOB_RETENTION,
  },
  [QUEUE_NAMES.reconciliation]: {
    attempts: 4,
    backoff: {
      delay: 30_000,
      type: "exponential",
    },
    removeOnComplete: COMPLETED_JOB_RETENTION,
    removeOnFail: FAILED_JOB_RETENTION,
  },
};

/**
 * Returns the retry delay for the custom merchant webhook schedule declared in
 * `ARCHITECTURE.md` section 13.4.
 *
 * Parameters:
 * - attemptsMade: Completed attempts before the upcoming retry.
 * - type: BullMQ backoff strategy name.
 *
 * Returns:
 * - Delay in milliseconds before the next retry, or `undefined` when another
 *   backoff strategy should handle the job.
 */
export function resolveQueueBackoffDelay(
  attemptsMade: number,
  type?: string,
): number | undefined {
  if (type !== MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME) {
    return undefined;
  }

  return getWebhookRetryDelayMsAfterFailure(attemptsMade) ?? 0;
}

/**
 * Returns the configured BullMQ prefix, allowing tests to isolate queues
 * without changing the production queue names.
 */
export function getQueuePrefix(env: NodeJS.ProcessEnv = process.env): string {
  return env.OUTPAY_QUEUE_PREFIX?.trim() || DEFAULT_QUEUE_PREFIX;
}

/**
 * Returns the shared BullMQ queue instance for the requested queue name.
 *
 * Parameters:
 * - queueName: Architecture-defined queue identifier.
 *
 * Returns:
 * - Singleton `Queue` instance.
 */
export function getQueue<Name extends QueueName>(
  queueName: Name,
): BullMqQueue<QueuePayloadMap[Name], void, string> {
  const existingQueue = queueRegistry.get(queueName);

  if (existingQueue) {
    return existingQueue as BullMqQueue<QueuePayloadMap[Name], void, string>;
  }

  const queue = new Queue<QueuePayloadMap[Name], void, string>(queueName, {
    // BullMQ and the app may resolve `ioredis` from different package trees,
    // so the cast is limited to this construction boundary while still
    // reusing one runtime client across queue publishers.
    connection: getBullMqSharedConnection(),
    defaultJobOptions: queueDefaultJobOptions[queueName],
    prefix: getQueuePrefix(),
  });

  queueRegistry.set(
    queueName,
    queue as BullMqQueue<QueuePayloadMap[QueueName], void, string>,
  );

  return queue;
}

/**
 * Returns the queue-level default job options for diagnostics and tests.
 *
 * Parameters:
 * - queueName: Queue identifier.
 *
 * Returns:
 * - `JobsOptions` configured for the queue.
 */
export function getQueueDefaultJobOptions(queueName: QueueName): JobsOptions {
  return queueDefaultJobOptions[queueName];
}

/**
 * Enqueues a normalized chain event using the architecture-mandated job id.
 */
export async function enqueueChainEventJob(
  payload: ChainEventJobPayload,
): Promise<void> {
  await getQueue(QUEUE_NAMES.chainEvents).add("chain-event", payload, {
    jobId: buildChainEventJobId(payload.chainEvent),
  });
}

/**
 * Enqueues a checkout-scoped payment matching job using a stable job id.
 */
export async function enqueuePaymentMatchJob(
  payload: PaymentMatchJobPayload,
): Promise<void> {
  await getQueue(QUEUE_NAMES.paymentMatching).add("payment-match", payload, {
    jobId: buildPaymentMatchJobId(payload.checkoutSessionId),
  });
}

/**
 * Enqueues a delayed confirmation recheck for a detected payment.
 *
 * Parameters:
 * - payload: Checkout to recheck.
 * - delayMs: Delay before the next confirmation attempt.
 */
export async function enqueueConfirmationJob(
  payload: ConfirmationJobPayload,
  delayMs = 0,
): Promise<void> {
  await getQueue(QUEUE_NAMES.confirmations).add(
    "confirmation-recheck",
    payload,
    {
      delay: delayMs,
      jobId: buildConfirmationJobId(payload.checkoutSessionId),
    },
  );
}

/**
 * Enqueues a merchant webhook delivery attempt using deterministic queue
 * deduplication by webhook event and attempt number.
 */
export async function enqueueMerchantWebhookJob(
  payload: MerchantWebhookJobPayload,
): Promise<void> {
  await getQueue(QUEUE_NAMES.merchantWebhooks).add(
    "merchant-webhook",
    payload,
    {
      jobId: buildMerchantWebhookJobId(
        payload.webhookEventId,
        payload.attemptNumber,
      ),
    },
  );
}

/**
 * Enqueues a reconciliation block range scan.
 */
export async function enqueueReconciliationJob(
  payload: ReconciliationJobPayload,
): Promise<void> {
  await getQueue(QUEUE_NAMES.reconciliation).add(
    "reconciliation-scan",
    payload,
    {
      jobId: buildReconciliationJobId(payload),
    },
  );
}

/**
 * Enqueues an alert with a deterministic dedupe key.
 */
export async function enqueueAlertJob(payload: AlertJobPayload): Promise<void> {
  await getQueue(QUEUE_NAMES.alerts).add("alert", payload, {
    jobId: buildAlertJobId(payload),
  });
}

/**
 * Sends an exhausted job into the dead-letter queue for admin inspection.
 *
 * Parameters:
 * - input: Failed job metadata.
 */
export async function enqueueDeadLetterJob(
  input: DeadLetterJobPayload,
): Promise<void> {
  await getQueue(QUEUE_NAMES.deadLetter).add("dead-letter", input, {
    jobId: buildDeadLetterJobId({
      attemptsMade: input.attemptsMade,
      originalJobId: input.originalJobId,
      originalQueue: input.originalQueue,
    }),
  });
}

/**
 * Lists the most recent dead-letter jobs for future admin tooling.
 *
 * Parameters:
 * - limit: Maximum number of records to return.
 *
 * Returns:
 * - Serialized dead-letter jobs ordered by recency.
 */
export async function listDeadLetterJobs(
  limit = 100,
): Promise<DeadLetterJobRecord[]> {
  const jobs = await getQueue(QUEUE_NAMES.deadLetter).getJobs(
    ["active", "delayed", "failed", "waiting"],
    0,
    Math.max(limit - 1, 0),
    true,
  );

  return jobs.map((job) => ({
    attemptsMade: job.data.attemptsMade,
    deadLetterJobId: job.id ?? "",
    enqueuedAt: job.timestamp ? new Date(job.timestamp).toISOString() : null,
    failedAt: job.data.failedAt,
    failureMessage: job.data.failureMessage,
    originalJobId: job.data.originalJobId,
    originalJobName: job.data.originalJobName,
    originalPayload: job.data.originalPayload,
    originalQueue: job.data.originalQueue,
  }));
}

/**
 * Attaches dead-letter forwarding to a worker so exhausted jobs are preserved
 * outside BullMQ's failed set.
 *
 * Parameters:
 * - queueName: Source queue name.
 * - worker: Worker instance processing that queue.
 */
export function attachDeadLetterHandler<
  Name extends Exclude<QueueName, typeof QUEUE_NAMES.deadLetter>,
>(queueName: Name, worker: Worker<QueuePayloadMap[Name], void, string>): void {
  worker.on("failed", async (job, error) => {
    if (!job) {
      return;
    }

    const allowedAttempts = job.opts.attempts ?? 1;

    if (job.attemptsMade < allowedAttempts) {
      return;
    }

    await enqueueDeadLetterJob({
      attemptsMade: job.attemptsMade,
      failedAt: new Date().toISOString(),
      failureMessage: error.message,
      originalJobId: job.id ?? "",
      originalJobName: job.name,
      originalPayload: job.data,
      originalQueue: queueName,
    });
  });
}

/**
 * Returns the stable chain-event job id defined in `ARCHITECTURE.md`.
 */
export function buildChainEventJobId(
  chainEvent: Pick<SerializedChainEvent, "chain" | "logIndex" | "txHash">,
): string {
  return `chain-event:${chainEvent.chain}:${chainEvent.txHash.toLowerCase()}:${chainEvent.logIndex}`;
}

/**
 * Returns the stable payment-match job id defined in `ARCHITECTURE.md`.
 */
export function buildPaymentMatchJobId(checkoutSessionId: string): string {
  return `payment-match:${checkoutSessionId}`;
}

/**
 * Returns the stable confirmation recheck job id for one checkout.
 */
export function buildConfirmationJobId(checkoutSessionId: string): string {
  return `confirmation:${checkoutSessionId}`;
}

/**
 * Returns the stable merchant webhook delivery job id defined in the
 * architecture examples.
 */
export function buildMerchantWebhookJobId(
  webhookEventId: string,
  attemptNumber: number,
): string {
  return `webhook-delivery:${webhookEventId}:${attemptNumber}`;
}

/**
 * Returns the stable reconciliation job id defined in `ARCHITECTURE.md`.
 */
export function buildReconciliationJobId(
  payload: Pick<ReconciliationJobPayload, "chain" | "fromBlock" | "toBlock">,
): string {
  return `reconcile:${payload.chain}:${String(payload.fromBlock)}:${String(payload.toBlock)}`;
}

/**
 * Returns a deterministic dedupe id for alert fan-out.
 */
export function buildAlertJobId(payload: AlertJobPayload): string {
  return `alert:${payload.source}:${payload.severity}:${payload.dedupeKey}`;
}

/**
 * Returns a deterministic dead-letter record id so the same exhausted job is
 * not copied repeatedly during worker restarts.
 */
export function buildDeadLetterJobId(input: {
  attemptsMade: number;
  originalJobId: string;
  originalQueue: QueueName;
}): string {
  return `dead-letter:${input.originalQueue}:${input.originalJobId}:${input.attemptsMade}`;
}

/**
 * Drains and closes every queue instance created through this registry.
 *
 * This is primarily used by tests and short-lived scripts.
 */
export async function closeQueues(): Promise<void> {
  const queues = [...queueRegistry.values()];
  queueRegistry.clear();

  await Promise.all(queues.map(async (queue) => queue.close()));
}

/**
 * Returns the next retry attempt number for a merchant webhook job.
 */
export function getNextMerchantWebhookAttemptNumber(
  currentAttemptNumber: number,
): number {
  return currentAttemptNumber + 1;
}

/**
 * Returns a queue job by id for diagnostics and tests.
 *
 * Parameters:
 * - queueName: Queue to inspect.
 * - jobId: Deterministic job identifier.
 */
export async function getQueueJob<Name extends QueueName>(
  queueName: Name,
  jobId: string,
): Promise<Job<QueuePayloadMap[Name], void, string> | undefined> {
  return Job.fromId(getQueue(queueName), jobId);
}

function getBullMqSharedConnection(): ConnectionOptions {
  return getSharedRedisConnection() as unknown as ConnectionOptions;
}

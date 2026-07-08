/**
 * BullMQ workers for chain-event processing, checkout rechecks, and durable
 * follow-up queue fan-out after payment state changes commit successfully.
 */

import { type ConnectionOptions, Worker } from "bullmq";
import {
  matchNormalizedChainEvent,
  recheckDetectedPayment,
} from "@/lib/payments/match-payment";
import {
  attachDeadLetterHandler,
  type ChainEventJobPayload,
  type ConfirmationJobPayload,
  enqueueConfirmationJob,
  enqueueMerchantWebhookJob,
  type PaymentMatchJobPayload,
  QUEUE_NAMES,
  QUEUE_WORKER_RECOVERY_OPTIONS,
} from "@/lib/queues/jobs";
import {
  closeSharedRedisConnection,
  getSharedRedisConnection,
} from "@/lib/queues/redis";

const WORKER_CONCURRENCY = readPositiveInteger(
  process.env.OUTPAY_WORKER_CONCURRENCY,
  5,
);

const connection = getSharedRedisConnection() as unknown as ConnectionOptions;

const chainEventWorker = new Worker<ChainEventJobPayload>(
  QUEUE_NAMES.chainEvents,
  async (job) => {
    const result = await matchNormalizedChainEvent(job.data);
    await enqueueFollowUps(result);
    logWorkerEvent("info", "Processed chain-event job", {
      evaluation: result.evaluation?.outcome ?? null,
      jobId: job.id,
      queue: QUEUE_NAMES.chainEvents,
    });
  },
  {
    connection,
    concurrency: WORKER_CONCURRENCY,
    ...QUEUE_WORKER_RECOVERY_OPTIONS,
  },
);

const paymentMatchingWorker = new Worker<PaymentMatchJobPayload>(
  QUEUE_NAMES.paymentMatching,
  async (job) => {
    const result = await recheckDetectedPayment(job.data);
    await enqueueFollowUps(result);
    logWorkerEvent("info", "Processed payment-match job", {
      evaluation: result.evaluation?.outcome ?? null,
      jobId: job.id,
      queue: QUEUE_NAMES.paymentMatching,
    });
  },
  {
    connection,
    concurrency: WORKER_CONCURRENCY,
    ...QUEUE_WORKER_RECOVERY_OPTIONS,
  },
);

const confirmationsWorker = new Worker<ConfirmationJobPayload>(
  QUEUE_NAMES.confirmations,
  async (job) => {
    const result = await recheckDetectedPayment(job.data);
    await enqueueFollowUps(result);
    logWorkerEvent("info", "Processed confirmation job", {
      evaluation: result.evaluation?.outcome ?? null,
      jobId: job.id,
      queue: QUEUE_NAMES.confirmations,
    });
  },
  {
    connection,
    concurrency: WORKER_CONCURRENCY,
    ...QUEUE_WORKER_RECOVERY_OPTIONS,
  },
);

attachDeadLetterHandler(QUEUE_NAMES.chainEvents, chainEventWorker);
attachDeadLetterHandler(QUEUE_NAMES.paymentMatching, paymentMatchingWorker);
attachDeadLetterHandler(QUEUE_NAMES.confirmations, confirmationsWorker);

chainEventWorker.on("failed", (job, error) => {
  logWorkerEvent("error", "Chain-event job failed", {
    error: error.message,
    jobId: job?.id ?? null,
    queue: QUEUE_NAMES.chainEvents,
  });
});

paymentMatchingWorker.on("failed", (job, error) => {
  logWorkerEvent("error", "Payment-match job failed", {
    error: error.message,
    jobId: job?.id ?? null,
    queue: QUEUE_NAMES.paymentMatching,
  });
});

confirmationsWorker.on("failed", (job, error) => {
  logWorkerEvent("error", "Confirmation job failed", {
    error: error.message,
    jobId: job?.id ?? null,
    queue: QUEUE_NAMES.confirmations,
  });
});

logWorkerEvent("info", "Payment listener worker started", {
  concurrency: WORKER_CONCURRENCY,
  queues: [
    QUEUE_NAMES.chainEvents,
    QUEUE_NAMES.paymentMatching,
    QUEUE_NAMES.confirmations,
  ],
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    logWorkerEvent("info", "Shutting down payment listener worker", {
      signal,
    });
    await Promise.all([
      chainEventWorker.close(),
      confirmationsWorker.close(),
      paymentMatchingWorker.close(),
    ])
      .then(async () => closeSharedRedisConnection())
      .finally(() => process.exit(0));
  });
}

async function enqueueFollowUps(
  input: Awaited<ReturnType<typeof matchNormalizedChainEvent>>,
): Promise<void> {
  if (input.followUpConfirmation) {
    await enqueueConfirmationJob(
      {
        checkoutSessionId: input.followUpConfirmation.checkoutSessionId,
      },
      input.followUpConfirmation.delayMs,
    );
  }

  if (input.followUpWebhook) {
    await enqueueMerchantWebhookJob(input.followUpWebhook);
  }
}

function logWorkerEvent(
  level: "error" | "info",
  message: string,
  details: Record<string, unknown>,
): void {
  console[level](
    JSON.stringify({
      details,
      level,
      message,
      module: "workers/payment-listener",
      timestamp: new Date().toISOString(),
    }),
  );
}

function readPositiveInteger(
  rawValue: string | undefined,
  fallback: number,
): number {
  const parsedValue = Number.parseInt(rawValue?.trim() || "", 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

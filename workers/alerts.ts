/**
 * Alert fan-out worker and low-volume operational condition monitor.
 *
 * Consumes the architecture-defined `alerts` queue, sends configured
 * Slack-compatible notifications, and checks webhook success rate plus queue
 * backlog age every minute. It is intentionally separate from the web process
 * so alert delivery remains available when API traffic is unhealthy.
 */

import { type ConnectionOptions, Worker } from "bullmq";
import { connectToDatabase } from "@/lib/database/client";
import { logger } from "@/lib/logging/logger";
import { sendAlertNotification } from "@/lib/observability/alerts";
import { emitMetric, METRIC_NAMES } from "@/lib/observability/metrics";
import {
  type AlertJobPayload,
  closeQueues,
  enqueueAlertJob,
  getQueue,
  QUEUE_NAMES,
} from "@/lib/queues/jobs";
import {
  closeSharedRedisConnection,
  getSharedRedisConnection,
} from "@/lib/queues/redis";

const MONITOR_INTERVAL_MS = 60_000;
const QUEUE_BACKLOG_THRESHOLD_MS = 5 * 60_000;
const connection = getSharedRedisConnection() as unknown as ConnectionOptions;

const alertWorker = new Worker<AlertJobPayload>(
  QUEUE_NAMES.alerts,
  async (job) => {
    const delivered = await sendAlertNotification(job.data);

    if (!delivered && process.env.OUTPAY_ALERT_WEBHOOK_URL?.trim()) {
      throw new Error("Alert webhook did not accept the notification.");
    }
  },
  { connection },
);

alertWorker.on("failed", (job, error) => {
  logger.error(
    {
      err: error,
      job_id: job?.id ?? null,
      queue: QUEUE_NAMES.alerts,
    },
    "Alert notification job failed",
  );
});

/**
 * Checks the operational conditions with concrete thresholds from T-23.
 * Database query failures are reported by the database connector itself.
 */
export async function monitorOperationalConditions(): Promise<void> {
  await monitorWebhookDeliveryRate();
  await monitorQueueBacklogAge();
}

async function monitorWebhookDeliveryRate(): Promise<void> {
  const database = await connectToDatabase();

  try {
    const rows = await database.sql<
      { failure_count: string; success_count: string; total_count: string }[]
    >`
      select
        count(*) filter (where outcome = 'success')::text as success_count,
        count(*) filter (where outcome <> 'success')::text as failure_count,
        count(*)::text as total_count
      from webhook_delivery_attempts
      where created_at >= now() - interval '5 minutes'
    `;
    const row = rows[0];
    const successCount = Number(row?.success_count ?? 0);
    const failureCount = Number(row?.failure_count ?? 0);
    const totalCount = Number(row?.total_count ?? 0);
    const successRate = totalCount === 0 ? 1 : successCount / totalCount;

    emitMetric(METRIC_NAMES.webhookDeliverySuccessRate, successRate, {
      window_seconds: 300,
    });

    if (totalCount > 0) {
      if (successRate < 0.95) {
        await enqueueAlertJob({
          dedupeKey: "webhook-success-rate-below-95-percent",
          message: `Webhook delivery success rate is ${(successRate * 100).toFixed(1)}% over the last five minutes (${failureCount} failures).`,
          metadata: { failureCount, successCount, successRate, totalCount },
          severity: "critical",
          source: "webhook-worker",
        });
      }
    }
  } finally {
    await database.release();
  }
}

async function monitorQueueBacklogAge(): Promise<void> {
  const queueNames = Object.values(QUEUE_NAMES).filter(
    (queueName) => queueName !== QUEUE_NAMES.alerts,
  );

  for (const queueName of queueNames) {
    const jobs = await getQueue(queueName).getJobs(
      ["waiting", "active", "delayed"],
      0,
      0,
      true,
    );
    const oldestJob = jobs[0];
    const oldestJobAgeMs = oldestJob ? Date.now() - oldestJob.timestamp : 0;

    if (oldestJobAgeMs > QUEUE_BACKLOG_THRESHOLD_MS) {
      await enqueueAlertJob({
        dedupeKey: `queue-backlog:${queueName}`,
        message: `Queue ${queueName} has a job older than five minutes.`,
        metadata: {
          ageSeconds: Math.floor(oldestJobAgeMs / 1000),
          jobId: oldestJob.id,
          queue: queueName,
        },
        severity: "critical",
        source: "queue",
      });
    }
  }
}

async function start(): Promise<void> {
  const monitor = setInterval(() => {
    void monitorOperationalConditions().catch((error) => {
      logger.error({ err: error }, "Operational condition monitor failed");
    });
  }, MONITOR_INTERVAL_MS);

  await monitorOperationalConditions().catch((error) => {
    logger.error(
      { err: error },
      "Initial operational condition monitor failed",
    );
  });

  logger.info({ queue: QUEUE_NAMES.alerts }, "Alert worker started");

  const shutdown = async () => {
    clearInterval(monitor);
    await alertWorker.close();
    await closeQueues();
    await closeSharedRedisConnection();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());
}

if (import.meta.main) {
  await start();
}

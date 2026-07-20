/**
 * Unit and conditional integration tests for the T-7 BullMQ queue
 * infrastructure.
 */

import { describe, expect, it } from "bun:test";
import { createConnection } from "node:net";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import {
  buildAlertJobId,
  buildChainEventJobId,
  buildConfirmationJobId,
  buildDeadLetterJobId,
  buildMerchantWebhookJobId,
  buildPaymentMatchJobId,
  buildReconciliationJobId,
  getQueueDefaultJobOptions,
  MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME,
  QUEUE_NAMES,
  resolveQueueBackoffDelay,
} from "@/lib/queues";
import { getRedisUrl } from "@/lib/queues/redis";

const redisAvailability = await detectRedisAvailability();

describe("queue infrastructure", () => {
  it("defines the six architecture queues plus a dead-letter queue", () => {
    expect(QUEUE_NAMES).toEqual({
      alerts: "alerts",
      chainEvents: "chain-events",
      confirmations: "confirmations",
      deadLetter: "dead-letter",
      merchantWebhooks: "merchant-webhooks",
      paymentMatching: "payment-matching",
      reconciliation: "reconciliation",
    });
  });

  it("builds deterministic job ids for deduplication", () => {
    expect(
      buildChainEventJobId({
        chain: "base",
        logIndex: 7,
        txHash: "0xABCDEF",
      }),
    ).toBe("chain-event|base|0xabcdef|7");
    expect(buildPaymentMatchJobId("chk_123")).toBe("payment-match|chk_123");
    expect(buildMerchantWebhookJobId("whd_456", 3)).toBe(
      "webhook-delivery|whd_456|3",
    );
    expect(
      buildReconciliationJobId({
        chain: "base",
        fromBlock: 12345000n,
        toBlock: 12345100n,
      }),
    ).toBe("reconcile|base|12345000|12345100");
  });

  it("never produces a job id BullMQ would reject (colons must split into exactly 3 parts)", () => {
    const ids = [
      buildChainEventJobId({ chain: "base", logIndex: 7, txHash: "0xabc" }),
      buildPaymentMatchJobId("chk_123"),
      buildConfirmationJobId("chk_123"),
      buildMerchantWebhookJobId("whd_456", 3),
      buildReconciliationJobId({
        chain: "base",
        fromBlock: BigInt(1),
        toBlock: BigInt(2),
      }),
      buildAlertJobId({
        dedupeKey: "database-connection-error",
        message: "Database connection failed",
        severity: "critical",
        source: "database",
      }),
      buildDeadLetterJobId({
        attemptsMade: 3,
        originalJobId: buildChainEventJobId({
          chain: "base",
          logIndex: 7,
          txHash: "0xabc",
        }),
        originalQueue: "chain-events",
      }),
    ];

    for (const id of ids) {
      const isValid = !id.includes(":") || id.split(":").length === 3;
      expect(isValid).toBe(true);
    }
  });

  it("uses the architecture's seven-step merchant webhook backoff schedule", () => {
    expect(MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME).toBe(
      "merchant-webhook-retry",
    );
    expect(
      resolveQueueBackoffDelay(1, MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME),
    ).toBe(30_000);
    expect(
      resolveQueueBackoffDelay(2, MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME),
    ).toBe(120_000);
    expect(
      resolveQueueBackoffDelay(3, MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME),
    ).toBe(600_000);
    expect(
      resolveQueueBackoffDelay(4, MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME),
    ).toBe(1_800_000);
    expect(
      resolveQueueBackoffDelay(5, MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME),
    ).toBe(7_200_000);
    expect(
      resolveQueueBackoffDelay(6, MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME),
    ).toBe(43_200_000);
  });

  it("keeps payment-matching retries low and webhook retries durable", () => {
    expect(
      getQueueDefaultJobOptions(QUEUE_NAMES.paymentMatching),
    ).toMatchObject({
      attempts: 3,
    });
    expect(
      getQueueDefaultJobOptions(QUEUE_NAMES.merchantWebhooks),
    ).toMatchObject({
      attempts: 7,
      backoff: {
        type: MERCHANT_WEBHOOK_BACKOFF_STRATEGY_NAME,
      },
    });
  });

  (redisAvailability.reachable ? it : it.skip)(
    "reclaims an in-flight job after a forced worker shutdown without duplicating completion",
    async () => {
      const connection = new IORedis(redisAvailability.url, {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        retryStrategy: () => null,
      });
      connection.on("error", () => undefined);
      await connection.connect();
      const prefix = `outpay-t7-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const queue = new Queue<{ checkoutSessionId: string }>(
        QUEUE_NAMES.confirmations,
        {
          connection,
          defaultJobOptions: getQueueDefaultJobOptions(
            QUEUE_NAMES.confirmations,
          ),
          prefix,
        },
      );
      let attemptCount = 0;
      let completionCount = 0;
      let releaseFirstAttempt: (() => void) | null = null;
      const firstAttemptStarted = new Promise<void>((resolve) => {
        releaseFirstAttempt = resolve;
      });

      const worker1 = new Worker<{ checkoutSessionId: string }>(
        QUEUE_NAMES.confirmations,
        async () => {
          attemptCount += 1;

          if (attemptCount === 1) {
            releaseFirstAttempt?.();
            await new Promise<void>(() => undefined);
          }

          completionCount += 1;
        },
        {
          connection,
          lockDuration: 250,
          maxStalledCount: 2,
          prefix,
          stalledInterval: 100,
        },
      );

      await queue.add(
        "confirmation-recheck",
        { checkoutSessionId: "chk_restart_test" },
        {
          jobId: "confirmation:chk_restart_test",
        },
      );

      await firstAttemptStarted;
      await worker1.close(true);

      const worker2 = new Worker<{ checkoutSessionId: string }>(
        QUEUE_NAMES.confirmations,
        async () => {
          attemptCount += 1;
          completionCount += 1;
        },
        {
          connection,
          lockDuration: 250,
          maxStalledCount: 2,
          prefix,
          stalledInterval: 100,
        },
      );

      await waitFor(() => completionCount === 1, 5_000);

      expect(attemptCount).toBe(2);
      expect(completionCount).toBe(1);

      await worker2.close();
      await queue.obliterate({ force: true });
      await queue.close();
      connection.disconnect();
    },
  );
});

async function detectRedisAvailability(): Promise<{
  reachable: boolean;
  url: string;
}> {
  const url = process.env.REDIS_URL?.trim() ? getRedisUrl() : "";

  if (!url) {
    return {
      reachable: false,
      url,
    };
  }

  const parsedUrl = new URL(url);
  const port = Number.parseInt(parsedUrl.port || "6379", 10);
  const reachable = await canConnectTcp(parsedUrl.hostname, port, 250);

  return {
    reachable,
    url,
  };
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
): Promise<void> {
  const startedAt = Date.now();

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for queue state transition.");
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

async function canConnectTcp(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({
      host,
      port,
    });

    const finish = (reachable: boolean) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(reachable);
    };

    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(timeoutMs, () => finish(false));
  });
}

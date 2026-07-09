/**
 * BullMQ worker for real merchant webhook delivery.
 *
 * This worker signs outbound payloads, sends HTTP POST requests, records every
 * attempt in PostgreSQL, and updates endpoint/event status as retries succeed
 * or exhaust.
 */

import { randomUUID } from "node:crypto";
import { type ConnectionOptions, Worker } from "bullmq";
import { connectToDatabase } from "@/lib/database/client";
import {
  attachDeadLetterHandler,
  type MerchantWebhookJobPayload,
  QUEUE_NAMES,
  QUEUE_WORKER_RECOVERY_OPTIONS,
} from "@/lib/queues/jobs";
import {
  closeSharedRedisConnection,
  getSharedRedisConnection,
} from "@/lib/queues/redis";
import { dispatchWebhookRequest } from "@/lib/webhooks/dispatch";
import {
  getPersistedWebhookAttemptNumber,
  getWebhookCycleAttemptNumber,
  getWebhookRetryDelayMsAfterFailure,
  hasWebhookRetryRemaining,
  WEBHOOK_ENDPOINT_AUTO_DISABLE_FAILURE_THRESHOLD,
} from "@/lib/webhooks/retry";
import { decryptWebhookSigningSecret } from "@/lib/webhooks/secrets";

const WORKER_CONCURRENCY = readPositiveInteger(
  process.env.OUTPAY_WEBHOOK_WORKER_CONCURRENCY,
  5,
);

const connection = getSharedRedisConnection() as unknown as ConnectionOptions;

const webhookWorker = new Worker<MerchantWebhookJobPayload>(
  QUEUE_NAMES.merchantWebhooks,
  async (job) => {
    await processWebhookJob(job.data, job.attemptsMade);
    logWorkerEvent("info", "Processed merchant webhook job", {
      baseAttemptNumber: job.data.attemptNumber,
      jobId: job.id,
      queue: QUEUE_NAMES.merchantWebhooks,
      webhookEventId: job.data.webhookEventId,
    });
  },
  {
    connection,
    concurrency: WORKER_CONCURRENCY,
    ...QUEUE_WORKER_RECOVERY_OPTIONS,
  },
);

attachDeadLetterHandler(QUEUE_NAMES.merchantWebhooks, webhookWorker);

webhookWorker.on("failed", (job, error) => {
  logWorkerEvent("error", "Merchant webhook job failed", {
    error: error.message,
    jobId: job?.id ?? null,
    queue: QUEUE_NAMES.merchantWebhooks,
    webhookEventId: job?.data.webhookEventId ?? null,
  });
});

logWorkerEvent("info", "Webhook dispatcher worker started", {
  concurrency: WORKER_CONCURRENCY,
  queue: QUEUE_NAMES.merchantWebhooks,
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    logWorkerEvent("info", "Shutting down webhook dispatcher worker", {
      signal,
    });
    await webhookWorker
      .close()
      .then(async () => closeSharedRedisConnection())
      .finally(() => process.exit(0));
  });
}

async function processWebhookJob(
  payload: MerchantWebhookJobPayload,
  attemptsMade: number,
): Promise<void> {
  const cycleAttemptNumber = getWebhookCycleAttemptNumber(attemptsMade);
  const persistedAttemptNumber = getPersistedWebhookAttemptNumber(
    payload.attemptNumber,
    attemptsMade,
  );
  const database = await connectToDatabase();

  try {
    const context = await loadWebhookDispatchContext(
      database.sql,
      payload.webhookEventId,
    );

    if (!context) {
      logWorkerEvent("error", "Webhook event context is missing", {
        webhookEventId: payload.webhookEventId,
      });
      return;
    }

    if (context.endpointStatus !== "active") {
      await persistSkippedAttempt(database.sql, {
        deliveryAttemptId: randomUUID(),
        endpointId: context.endpointId,
        eventId: context.eventId,
        attemptNumber: persistedAttemptNumber,
        body: context.payload,
        message:
          "Webhook endpoint is disabled. Re-save the endpoint before retrying delivery.",
      });
      await markEventFailed(database.sql, context.eventId);
      return;
    }

    if (!context.encryptedSecret) {
      await persistSkippedAttempt(database.sql, {
        deliveryAttemptId: randomUUID(),
        endpointId: context.endpointId,
        eventId: context.eventId,
        attemptNumber: persistedAttemptNumber,
        body: context.payload,
        message:
          "Webhook signing secret is unavailable. Save the endpoint again to rotate a new secret.",
      });
      await markEventFailed(database.sql, context.eventId);
      return;
    }

    const deliveryAttemptId = randomUUID();
    const signingSecret = decryptWebhookSigningSecret(context.encryptedSecret);
    await markEventProcessing(database.sql, context.eventId);

    const dispatchResult = await dispatchWebhookRequest({
      body: context.payload,
      deliveryId: deliveryAttemptId,
      eventType: context.eventType,
      secret: signingSecret,
      url: context.url,
    });

    if (dispatchResult.outcome === "success") {
      await persistSuccessfulAttempt(database.sql, {
        deliveryAttemptId,
        dispatchResult,
        endpointId: context.endpointId,
        eventId: context.eventId,
        payload: context.payload,
        persistedAttemptNumber,
      });
      return;
    }

    await persistFailedAttempt(database.sql, {
      cycleAttemptNumber,
      deliveryAttemptId,
      dispatchResult,
      endpointId: context.endpointId,
      eventId: context.eventId,
      payload: context.payload,
      persistedAttemptNumber,
    });

    if (hasWebhookRetryRemaining(cycleAttemptNumber)) {
      throw new Error(
        `Webhook delivery attempt ${persistedAttemptNumber} failed and will be retried automatically.`,
      );
    }
  } finally {
    await database.release();
  }
}

async function loadWebhookDispatchContext(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
  webhookEventId: string,
): Promise<{
  encryptedSecret: string | null;
  endpointId: string;
  endpointStatus: string;
  eventId: string;
  eventType: string;
  merchantId: string;
  payload: string;
  url: string;
} | null> {
  const rows = await sql<
    {
      encrypted_secret: string | null;
      endpoint_id: string;
      endpoint_status: string;
      event_id: string;
      event_type: string;
      merchant_id: string;
      payload: string;
      url: string;
    }[]
  >`
    select
      we.id::text as event_id,
      we.merchant_id::text as merchant_id,
      we.event_type::text as event_type,
      we.payload::text as payload,
      ep.id::text as endpoint_id,
      ep.url,
      ep.status::text as endpoint_status,
      ep.signing_secret_encrypted as encrypted_secret
    from webhook_events we
    join webhook_endpoints ep
      on ep.merchant_id = we.merchant_id
     and ep.environment = 'live'
    where we.id = ${webhookEventId}::uuid
    limit 1
  `;

  if (!rows[0]) {
    return null;
  }

  return {
    encryptedSecret: rows[0].encrypted_secret,
    endpointId: rows[0].endpoint_id,
    endpointStatus: rows[0].endpoint_status,
    eventId: rows[0].event_id,
    eventType: rows[0].event_type,
    merchantId: rows[0].merchant_id,
    payload: rows[0].payload,
    url: rows[0].url,
  };
}

async function markEventProcessing(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
  eventId: string,
): Promise<void> {
  await sql`
    update webhook_events
    set delivery_status = 'processing'
    where id = ${eventId}::uuid
  `;
}

async function markEventFailed(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
  eventId: string,
): Promise<void> {
  await sql`
    update webhook_events
    set delivery_status = 'failed'
    where id = ${eventId}::uuid
  `;
}

async function persistSkippedAttempt(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
  input: {
    attemptNumber: number;
    body: string;
    deliveryAttemptId: string;
    endpointId: string;
    eventId: string;
    message: string;
  },
): Promise<void> {
  await sql`
    insert into webhook_delivery_attempts (
      id,
      webhook_event_id,
      webhook_endpoint_id,
      attempt_number,
      request_body,
      response_body_excerpt,
      outcome
    ) values (
      ${input.deliveryAttemptId}::uuid,
      ${input.eventId}::uuid,
      ${input.endpointId}::uuid,
      ${input.attemptNumber},
      ${input.body}::jsonb,
      ${input.message},
      'skipped'
    )
    on conflict (webhook_event_id, attempt_number) do nothing
  `;
}

async function persistSuccessfulAttempt(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
  input: {
    deliveryAttemptId: string;
    dispatchResult: Awaited<ReturnType<typeof dispatchWebhookRequest>>;
    endpointId: string;
    eventId: string;
    payload: string;
    persistedAttemptNumber: number;
  },
): Promise<void> {
  await sql.begin(async (transaction) => {
    await transaction`
      insert into webhook_delivery_attempts (
        id,
        webhook_event_id,
        webhook_endpoint_id,
        attempt_number,
        request_headers,
        request_body,
        response_status_code,
        response_body_excerpt,
        outcome,
        duration_ms
      ) values (
        ${input.deliveryAttemptId}::uuid,
        ${input.eventId}::uuid,
        ${input.endpointId}::uuid,
        ${input.persistedAttemptNumber},
        ${JSON.stringify(input.dispatchResult.requestHeaders)}::jsonb,
        ${input.payload}::jsonb,
        ${input.dispatchResult.responseStatusCode},
        ${input.dispatchResult.responseBodyExcerpt},
        ${input.dispatchResult.outcome}::webhook_attempt_outcome_enum,
        ${input.dispatchResult.durationMs}
      )
      on conflict (webhook_event_id, attempt_number) do update
        set
          request_headers = excluded.request_headers,
          request_body = excluded.request_body,
          response_status_code = excluded.response_status_code,
          response_body_excerpt = excluded.response_body_excerpt,
          outcome = excluded.outcome,
          next_retry_at = null,
          duration_ms = excluded.duration_ms
    `;

    await transaction`
      update webhook_events
      set delivery_status = 'delivered'
      where id = ${input.eventId}::uuid
    `;

    await transaction`
      update webhook_endpoints
      set
        failure_count = 0,
        updated_at = now()
      where id = ${input.endpointId}::uuid
    `;
  });
}

async function persistFailedAttempt(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
  input: {
    cycleAttemptNumber: number;
    deliveryAttemptId: string;
    dispatchResult: Awaited<ReturnType<typeof dispatchWebhookRequest>>;
    endpointId: string;
    eventId: string;
    payload: string;
    persistedAttemptNumber: number;
  },
): Promise<void> {
  const nextRetryDelayMs = getWebhookRetryDelayMsAfterFailure(
    input.cycleAttemptNumber,
  );
  const nextRetryAt =
    nextRetryDelayMs === null ? null : new Date(Date.now() + nextRetryDelayMs);

  await sql.begin(async (transaction) => {
    await transaction`
      insert into webhook_delivery_attempts (
        id,
        webhook_event_id,
        webhook_endpoint_id,
        attempt_number,
        request_headers,
        request_body,
        response_status_code,
        response_body_excerpt,
        outcome,
        next_retry_at,
        duration_ms
      ) values (
        ${input.deliveryAttemptId}::uuid,
        ${input.eventId}::uuid,
        ${input.endpointId}::uuid,
        ${input.persistedAttemptNumber},
        ${JSON.stringify(input.dispatchResult.requestHeaders)}::jsonb,
        ${input.payload}::jsonb,
        ${input.dispatchResult.responseStatusCode},
        ${input.dispatchResult.responseBodyExcerpt},
        ${input.dispatchResult.outcome}::webhook_attempt_outcome_enum,
        ${nextRetryAt?.toISOString() ?? null},
        ${input.dispatchResult.durationMs}
      )
      on conflict (webhook_event_id, attempt_number) do update
        set
          request_headers = excluded.request_headers,
          request_body = excluded.request_body,
          response_status_code = excluded.response_status_code,
          response_body_excerpt = excluded.response_body_excerpt,
          outcome = excluded.outcome,
          next_retry_at = excluded.next_retry_at,
          duration_ms = excluded.duration_ms
    `;

    if (nextRetryAt) {
      await transaction`
        update webhook_events
        set delivery_status = 'pending'
        where id = ${input.eventId}::uuid
      `;

      return;
    }

    const endpointRows = await transaction<{ failure_count: number }[]>`
      update webhook_endpoints
      set
        failure_count = failure_count + 1,
        status = case
          when failure_count + 1 >= ${WEBHOOK_ENDPOINT_AUTO_DISABLE_FAILURE_THRESHOLD}
            then 'disabled'::webhook_endpoint_status_enum
          else status
        end,
        updated_at = now()
      where id = ${input.endpointId}::uuid
      returning failure_count
    `;

    await transaction`
      update webhook_events
      set delivery_status = 'failed'
      where id = ${input.eventId}::uuid
    `;

    await transaction`
      insert into notifications (
        merchant_id,
        type,
        title,
        body,
        resource_type,
        resource_id
      )
      select
        we.merchant_id,
        'webhook_failed'::notification_type_enum,
        ${"Webhook delivery exhausted all retries"},
        ${
          (endpointRows[0]?.failure_count ?? 0) >=
          WEBHOOK_ENDPOINT_AUTO_DISABLE_FAILURE_THRESHOLD
            ? "Outpay disabled your webhook endpoint after repeated full delivery failures. Re-save the endpoint to rotate its secret and re-enable delivery."
            : "Outpay exhausted all seven delivery attempts for a merchant webhook event. You can retry the failed delivery from the dashboard."
        },
        'webhook_delivery'::resource_type_enum,
        ${input.deliveryAttemptId}::uuid
      from webhook_events we
      where we.id = ${input.eventId}::uuid
        and not exists (
          select 1
          from notifications n
          where n.resource_id = ${input.deliveryAttemptId}::uuid
            and n.type = 'webhook_failed'::notification_type_enum
        )
    `;
  });
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
      module: "workers/webhook-dispatcher",
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

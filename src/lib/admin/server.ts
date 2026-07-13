/**
 * Server-side authorization, queries, and mutations for the cross-merchant
 * operations dashboard. Every exported operation requires an active row in
 * `admin_users` and records its request in `audit_logs`.
 */

import type { TransactionSql } from "postgres";
import { getServerSession } from "@/lib/auth/server";
import { connectToDatabase } from "@/lib/database/client";
import { getRequestLogContext, logger } from "@/lib/logging/logger";
import {
  enqueueMerchantWebhookJob,
  enqueueReconciliationJob,
} from "@/lib/queues";

const ADMIN_RESULT_LIMIT = 100;
const MAX_RECONCILIATION_BLOCK_RANGE = 2_000_000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AdminSql = TransactionSql<Record<string, unknown>>;
type AdminResourceType =
  | "checkout"
  | "merchant"
  | "payment"
  | "webhook_delivery";

export interface AdminContext {
  email: string;
  fullName: string | null;
  userId: string;
}

export interface AdminPaymentRecord {
  amountToken: string;
  checkoutId: string;
  checkoutRef: string;
  createdAt: string;
  merchantId: string;
  merchantName: string;
  paymentId: string;
  paymentRef: string;
  status: string;
  txHash: string | null;
}

export interface AdminProviderHealthRecord {
  blockNumber: string | null;
  chain: string;
  checkedAt: string;
  error: string | null;
  id: string;
  latencyMs: number | null;
  provider: string;
  status: string;
}

export interface AdminWebhookFailureRecord {
  attemptNumber: number;
  createdAt: string;
  deliveryAttemptId: string;
  endpointStatus: string;
  eventType: string;
  lastError: string | null;
  merchantId: string;
  merchantName: string;
  responseStatusCode: number | null;
  webhookEventId: string;
}

export interface AdminMerchantRecord {
  activeCheckouts: number;
  createdAt: string;
  displayName: string;
  id: string;
  reviewCount: number;
  status: string;
  supportEmail: string | null;
}

export interface AdminCheckoutRecord {
  amountToken: string;
  checkoutId: string;
  checkoutRef: string;
  createdAt: string;
  merchantId: string;
  merchantName: string;
  status: string;
}

export interface AdminRiskRecord {
  createdAt: string;
  merchantId: string;
  merchantName: string;
  reviewId: string;
  reviewType: string;
  status: string;
}

export class AdminAuthenticationError extends Error {
  readonly code = "ADMIN_AUTHENTICATION_REQUIRED" as const;

  constructor() {
    super("Sign in before using the admin dashboard.");
    this.name = "AdminAuthenticationError";
  }
}

export class AdminAuthorizationError extends Error {
  readonly code = "ADMIN_ACCESS_DENIED" as const;

  constructor() {
    super("This account is not authorized to use the admin dashboard.");
    this.name = "AdminAuthorizationError";
  }
}

export class AdminOperationError extends Error {
  readonly code = "ADMIN_OPERATION_FAILED" as const;

  constructor(message: string) {
    super(message);
    this.name = "AdminOperationError";
  }
}

/**
 * Evaluates the database-backed admin membership result without trusting a
 * merchant role or a client-provided claim.
 *
 * Parameters:
 * - access: Session/profile/admin-row state resolved by the server.
 *
 * Returns:
 * - `true` only when an existing profile has an active admin row.
 */
export function isAdminAccessGranted(access: {
  adminRowFound: boolean;
  authenticated: boolean;
  profileFound: boolean;
}): boolean {
  return access.authenticated && access.profileFound && access.adminRowFound;
}

/**
 * Resolves the current session to an active admin user.
 *
 * Returns:
 * - The UUID-based profile identity used by audit logs.
 *
 * Throws:
 * - `AdminAuthenticationError` when no authenticated session exists.
 * - `AdminAuthorizationError` when the profile is not actively allow-listed.
 */
export async function requireAdmin(): Promise<AdminContext> {
  const session = await getServerSession();

  if (!session?.user?.email) {
    throw new AdminAuthenticationError();
  }

  const database = await connectToDatabase();

  try {
    const [access] = await database.sql<
      {
        admin_row_found: boolean;
        email: string;
        full_name: string | null;
        profile_found: boolean;
        user_id: string | null;
      }[]
    >`
      select
        exists (
          select 1
          from user_profiles up
          where lower(up.email::text) = lower(${session.user.email})
        ) as profile_found,
        (
          select up.id::text
          from user_profiles up
          where lower(up.email::text) = lower(${session.user.email})
          limit 1
        ) as user_id,
        (
          select up.email::text
          from user_profiles up
          where lower(up.email::text) = lower(${session.user.email})
          limit 1
        ) as email,
        (
          select up.full_name
          from user_profiles up
          where lower(up.email::text) = lower(${session.user.email})
          limit 1
        ) as full_name,
        exists (
          select 1
          from admin_users au
          join user_profiles up on up.id = au.user_id
          where lower(up.email::text) = lower(${session.user.email})
            and au.is_active = true
        ) as admin_row_found
    `;

    const granted = isAdminAccessGranted({
      adminRowFound: access?.admin_row_found === true,
      authenticated: true,
      profileFound: access?.profile_found === true,
    });

    if (!granted || !access?.user_id || !access.email) {
      logger.warn(
        { email: session.user.email.trim().toLowerCase() },
        "Admin access denied.",
      );
      throw new AdminAuthorizationError();
    }

    return {
      email: access.email,
      fullName: access.full_name,
      userId: access.user_id,
    };
  } finally {
    await database.release();
  }
}

/**
 * Executes one admin operation and writes its immutable audit record in the
 * same PostgreSQL transaction as the read or mutation.
 *
 * Parameters:
 * - database: Shared application database client.
 * - context: Authenticated admin actor.
 * - operation: Stable operation name stored in audit metadata.
 * - resourceType: Existing audit resource enum value.
 * - resourceId: UUID of the affected row, or `null` for aggregate reads.
 * - metadata: Secret-safe operational context.
 * - callback: Transaction-scoped operation.
 *
 * Returns:
 * - The callback result after the audit row has committed.
 */
async function withAdminAudit<T>(input: {
  callback: (sql: AdminSql) => Promise<T>;
  context: AdminContext;
  database: Awaited<ReturnType<typeof connectToDatabase>>;
  metadata: Record<string, unknown>;
  operation: string;
  resourceId: string | null;
  resourceType: AdminResourceType;
}): Promise<T> {
  const result = (await input.database.sql.begin(async (sql) => {
    const result = await input.callback(sql);

    await sql`
      insert into audit_logs (
        actor_user_id,
        actor_type,
        action,
        resource_type,
        resource_id,
        request_id,
        metadata
      ) values (
        ${input.context.userId}::uuid,
        'user'::actor_type_enum,
        'admin_action'::audit_action_enum,
        ${input.resourceType}::resource_type_enum,
        ${input.resourceId}::uuid,
        ${getRequestLogContext()?.request_id ?? null},
        ${JSON.stringify({ operation: input.operation, ...input.metadata })}::jsonb
      )
    `;

    return result;
  })) as T;

  logger.info(
    {
      admin_user_id: input.context.userId,
      operation: input.operation,
      resource_id: input.resourceId,
      request_id: getRequestLogContext()?.request_id,
    },
    "Admin action completed.",
  );

  return result;
}

function normalizedSearch(search: string): string {
  return search.trim().slice(0, 200);
}

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new AdminOperationError(`${label} must be a valid UUID.`);
  }
}

function assertBlockRange(fromBlock: number, toBlock: number): void {
  if (fromBlock > toBlock) {
    throw new AdminOperationError(
      "The start block must not exceed the end block.",
    );
  }

  if (toBlock - fromBlock > MAX_RECONCILIATION_BLOCK_RANGE) {
    throw new AdminOperationError(
      `Reconciliation ranges are limited to ${MAX_RECONCILIATION_BLOCK_RANGE.toLocaleString()} blocks.`,
    );
  }
}

/**
 * Searches payments across all merchants by transaction hash, payment ref,
 * checkout ref, or internal checkout UUID.
 */
export async function searchAdminPayments(
  search: string,
): Promise<AdminPaymentRecord[]> {
  const context = await requireAdmin();
  const database = await connectToDatabase();
  const term = normalizedSearch(search);

  try {
    return await withAdminAudit({
      callback: async (sql) => {
        const rows = await sql<
          {
            amount_token: string;
            checkout_id: string;
            checkout_ref: string;
            created_at: string;
            merchant_id: string;
            merchant_name: string;
            payment_id: string;
            payment_ref: string;
            status: string;
            tx_hash: string | null;
          }[]
        >`
          select
            p.id::text as payment_id,
            p.payment_ref,
            p.amount_token::text as amount_token,
            p.status::text as status,
            p.created_at::text as created_at,
            cs.id::text as checkout_id,
            cs.checkout_ref,
            m.id::text as merchant_id,
            m.display_name as merchant_name,
            ot.tx_hash
          from payments p
          join checkout_sessions cs on cs.id = p.checkout_session_id
          join merchants m on m.id = p.merchant_id
          left join onchain_transactions ot on ot.id = p.onchain_transaction_id
          where (
            ${term} = ''
            or lower(p.payment_ref) = lower(${term})
            or lower(cs.checkout_ref) = lower(${term})
            or cs.id::text = lower(${term})
            or lower(coalesce(ot.tx_hash, '')) = lower(${term})
            or lower(coalesce(ot.tx_hash_normalized, '')) = lower(${term})
          )
          order by p.created_at desc
          limit ${ADMIN_RESULT_LIMIT}
        `;

        return rows.map(toAdminPaymentRecord);
      },
      context,
      database,
      metadata: { search: term },
      operation: "payment_search",
      resourceId: null,
      resourceType: "payment",
    });
  } finally {
    await database.release();
  }
}

/**
 * Lists recent provider health observations for operational diagnosis.
 */
export async function listAdminProviderHealth(): Promise<
  AdminProviderHealthRecord[]
> {
  const context = await requireAdmin();
  const database = await connectToDatabase();

  try {
    return await withAdminAudit({
      callback: async (sql) => {
        const rows = await sql<
          {
            block_number: string | null;
            chain: string;
            checked_at: string;
            error: string | null;
            id: string;
            latency_ms: number | null;
            provider: string;
            status: string;
          }[]
        >`
          select
            id::text as id,
            provider,
            chain,
            status,
            latency_ms,
            block_number::text as block_number,
            error,
            checked_at::text as checked_at
          from provider_health_checks
          order by checked_at desc
          limit ${ADMIN_RESULT_LIMIT}
        `;

        return rows.map((row) => ({
          blockNumber: row.block_number,
          chain: row.chain,
          checkedAt: row.checked_at,
          error: row.error,
          id: row.id,
          latencyMs: row.latency_ms,
          provider: row.provider,
          status: row.status,
        }));
      },
      context,
      database,
      metadata: {},
      operation: "provider_health_view",
      resourceId: null,
      resourceType: "merchant",
    });
  } finally {
    await database.release();
  }
}

/**
 * Lists the latest exhausted/failed delivery attempt for each merchant webhook
 * event so support can retry it without direct database access.
 */
export async function listAdminWebhookFailures(): Promise<
  AdminWebhookFailureRecord[]
> {
  const context = await requireAdmin();
  const database = await connectToDatabase();

  try {
    return await withAdminAudit({
      callback: async (sql) => {
        const rows = await sql<
          {
            attempt_number: number;
            created_at: string;
            delivery_attempt_id: string;
            endpoint_status: string;
            event_type: string;
            last_error: string | null;
            merchant_id: string;
            merchant_name: string;
            response_status_code: number | null;
            webhook_event_id: string;
          }[]
        >`
          select
            wda.id::text as delivery_attempt_id,
            wda.webhook_event_id::text as webhook_event_id,
            wda.attempt_number,
            wda.created_at::text as created_at,
            wda.response_status_code,
            wda.response_body_excerpt as last_error,
            we.event_type::text as event_type,
            m.id::text as merchant_id,
            m.display_name as merchant_name,
            ep.status::text as endpoint_status
          from webhook_delivery_attempts wda
          join webhook_events we on we.id = wda.webhook_event_id
          join merchants m on m.id = we.merchant_id
          join webhook_endpoints ep on ep.id = wda.webhook_endpoint_id
          where we.delivery_status::text in ('failed', 'exhausted')
            and wda.attempt_number = (
              select max(latest.attempt_number)
              from webhook_delivery_attempts latest
              where latest.webhook_event_id = wda.webhook_event_id
            )
          order by wda.created_at desc
          limit ${ADMIN_RESULT_LIMIT}
        `;

        return rows.map((row) => ({
          attemptNumber: row.attempt_number,
          createdAt: row.created_at,
          deliveryAttemptId: row.delivery_attempt_id,
          endpointStatus: row.endpoint_status,
          eventType: row.event_type,
          lastError: row.last_error,
          merchantId: row.merchant_id,
          merchantName: row.merchant_name,
          responseStatusCode: row.response_status_code,
          webhookEventId: row.webhook_event_id,
        }));
      },
      context,
      database,
      metadata: {},
      operation: "webhook_failure_view",
      resourceId: null,
      resourceType: "webhook_delivery",
    });
  } finally {
    await database.release();
  }
}

/**
 * Reopens one exhausted merchant webhook and enqueues its next durable retry.
 *
 * Parameters:
 * - deliveryAttemptId: UUID of the exhausted attempt selected by support.
 *
 * Returns:
 * - The event id and queued attempt number.
 *
 * Throws:
 * - `AdminOperationError` for invalid, non-exhausted, or disabled deliveries.
 */
export async function retryAdminWebhook(deliveryAttemptId: string): Promise<{
  attemptNumber: number;
  queued: true;
  webhookEventId: string;
}> {
  const context = await requireAdmin();
  assertUuid(deliveryAttemptId, "Delivery attempt id");
  const database = await connectToDatabase();

  try {
    const queued = await withAdminAudit({
      callback: async (sql) => {
        const [delivery] = await sql<
          {
            delivery_status: string;
            endpoint_status: string;
            latest_attempt_number: number;
            merchant_id: string;
            webhook_event_id: string;
          }[]
        >`
          select
            we.id::text as webhook_event_id,
            we.merchant_id::text as merchant_id,
            we.delivery_status::text as delivery_status,
            ep.status::text as endpoint_status,
            (
              select max(latest.attempt_number)
              from webhook_delivery_attempts latest
              where latest.webhook_event_id = we.id
            )::integer as latest_attempt_number
          from webhook_delivery_attempts selected_attempt
          join webhook_events we on we.id = selected_attempt.webhook_event_id
          join webhook_endpoints ep on ep.id = selected_attempt.webhook_endpoint_id
          where selected_attempt.id = ${deliveryAttemptId}::uuid
            and we.delivery_status::text in ('failed', 'exhausted')
          limit 1
        `;

        if (!delivery) {
          throw new AdminOperationError(
            "Only an exhausted webhook delivery can be retried.",
          );
        }

        if (delivery.endpoint_status !== "active") {
          throw new AdminOperationError(
            "The webhook endpoint is disabled. Re-enable it before retrying delivery.",
          );
        }

        const attemptNumber = delivery.latest_attempt_number + 1;

        await sql`
          update webhook_events
          set delivery_status = 'pending'
          where id = ${delivery.webhook_event_id}::uuid
        `;

        return {
          attemptNumber,
          deliveryStatus: delivery.delivery_status,
          merchantId: delivery.merchant_id,
          webhookEventId: delivery.webhook_event_id,
        };
      },
      context,
      database,
      metadata: { delivery_attempt_id: deliveryAttemptId },
      operation: "webhook_failure_retry",
      resourceId: deliveryAttemptId,
      resourceType: "webhook_delivery",
    });

    try {
      await enqueueMerchantWebhookJob({
        attemptNumber: queued.attemptNumber,
        webhookEventId: queued.webhookEventId,
      });
    } catch (error) {
      logger.error(
        {
          delivery_attempt_id: deliveryAttemptId,
          err: error,
          webhook_event_id: queued.webhookEventId,
        },
        "Admin webhook retry was persisted but could not be queued.",
      );

      try {
        await database.sql`
          update webhook_events
          set delivery_status = ${queued.deliveryStatus}::webhook_delivery_status_enum
          where id = ${queued.webhookEventId}::uuid
        `;
      } catch (restoreError) {
        logger.error(
          {
            err: restoreError,
            webhook_event_id: queued.webhookEventId,
          },
          "Unable to restore webhook failure state after queue failure.",
        );
      }

      throw new AdminOperationError(
        "The retry was recorded but could not be queued. Check the webhook worker and try again.",
      );
    }

    return {
      attemptNumber: queued.attemptNumber,
      queued: true,
      webhookEventId: queued.webhookEventId,
    };
  } finally {
    await database.release();
  }
}

/**
 * Enqueues a manual block-range reconciliation scan and audits the request.
 */
export async function forceAdminReconciliation(input: {
  chain: "base";
  fromBlock: number;
  toBlock: number;
}): Promise<{ queued: true; jobId: string }> {
  const context = await requireAdmin();
  assertBlockRange(input.fromBlock, input.toBlock);
  const database = await connectToDatabase();
  const jobId = `reconcile:${input.chain}:${input.fromBlock}:${input.toBlock}`;

  try {
    await withAdminAudit({
      callback: async () => ({ queued: true }),
      context,
      database,
      metadata: {
        chain: input.chain,
        from_block: input.fromBlock,
        to_block: input.toBlock,
      },
      operation: "reconciliation_force_scan",
      resourceId: null,
      resourceType: "payment",
    });

    try {
      await enqueueReconciliationJob({
        chain: input.chain,
        cursorType: "daily-audit",
        fromBlock: input.fromBlock,
        reason: "manual-repair",
        toBlock: input.toBlock,
      });
    } catch (error) {
      logger.error(
        {
          chain: input.chain,
          err: error,
          from_block: input.fromBlock,
          to_block: input.toBlock,
        },
        "Admin reconciliation request was audited but could not be queued.",
      );
      throw new AdminOperationError(
        "The reconciliation request was recorded but could not be queued. Check the reconciliation worker and try again.",
      );
    }

    return { jobId, queued: true };
  } finally {
    await database.release();
  }
}

/**
 * Searches merchants and returns operational status/count summaries.
 */
export async function searchAdminMerchants(
  search: string,
): Promise<AdminMerchantRecord[]> {
  const context = await requireAdmin();
  const database = await connectToDatabase();
  const term = normalizedSearch(search);

  try {
    return await withAdminAudit({
      callback: async (sql) => {
        const rows = await sql<
          {
            active_checkouts: number;
            created_at: string;
            display_name: string;
            id: string;
            review_count: number;
            status: string;
            support_email: string | null;
          }[]
        >`
          select
            m.id::text as id,
            m.display_name,
            m.support_email::text as support_email,
            m.status::text as status,
            m.created_at::text as created_at,
            (
              select count(*)
              from checkout_sessions cs
              where cs.merchant_id = m.id
                and cs.status in ('pending', 'detected')
            )::integer as active_checkouts,
            (
              select count(*)
              from merchant_reviews mr
              where mr.merchant_id = m.id
                and mr.status in ('open', 'in_review')
            )::integer as review_count
          from merchants m
          where (
            ${term} = ''
            or lower(m.display_name) like lower('%' || ${term} || '%')
            or lower(coalesce(m.support_email::text, '')) like lower('%' || ${term} || '%')
            or m.id::text = lower(${term})
          )
          order by m.created_at desc
          limit ${ADMIN_RESULT_LIMIT}
        `;

        return rows.map((row) => ({
          activeCheckouts: row.active_checkouts,
          createdAt: row.created_at,
          displayName: row.display_name,
          id: row.id,
          reviewCount: row.review_count,
          status: row.status,
          supportEmail: row.support_email,
        }));
      },
      context,
      database,
      metadata: { search: term },
      operation: "merchant_search",
      resourceId: null,
      resourceType: "merchant",
    });
  } finally {
    await database.release();
  }
}

/**
 * Disables a merchant and its active transaction surfaces after exact-name
 * confirmation, then records the cross-merchant mutation in the audit trail.
 */
export async function disableAdminMerchant(input: {
  confirmationText: string;
  merchantId: string;
  reason: string;
}): Promise<AdminMerchantRecord> {
  const context = await requireAdmin();
  assertUuid(input.merchantId, "Merchant id");
  const database = await connectToDatabase();

  try {
    return await withAdminAudit({
      callback: async (sql) => {
        const [merchant] = await sql<{ display_name: string }[]>`
          select display_name
          from merchants
          where id = ${input.merchantId}::uuid
          limit 1
        `;

        if (!merchant) {
          throw new AdminOperationError("Merchant was not found.");
        }

        if (merchant.display_name !== input.confirmationText.trim()) {
          throw new AdminOperationError(
            "Type the exact merchant name to confirm disabling it.",
          );
        }

        const [updated] = await sql<
          {
            active_checkouts: number;
            created_at: string;
            display_name: string;
            id: string;
            review_count: number;
            status: string;
            support_email: string | null;
          }[]
        >`
          with changed_merchant as (
            update merchants
            set
              status = 'deactivated',
              deactivated_at = now(),
              deactivated_reason = ${input.reason.trim()},
              updated_at = now()
            where id = ${input.merchantId}::uuid
            returning *
          ), disabled_surfaces as (
            update api_keys
            set status = 'revoked', revoked_at = coalesce(revoked_at, now())
            where merchant_id = ${input.merchantId}::uuid
              and status = 'active'
          ), disabled_webhooks as (
            update webhook_endpoints
            set status = 'disabled', updated_at = now()
            where merchant_id = ${input.merchantId}::uuid
              and status = 'active'
          ), disabled_checkouts as (
            update checkout_sessions
            set
              status = 'deactivated',
              deactivated_at = now(),
              deactivated_by_user_id = ${context.userId}::uuid,
              updated_at = now()
            where merchant_id = ${input.merchantId}::uuid
              and status in ('pending', 'detected')
          )
          select
            changed_merchant.id::text as id,
            changed_merchant.display_name,
            changed_merchant.support_email::text as support_email,
            changed_merchant.status::text as status,
            changed_merchant.created_at::text as created_at,
            0::integer as active_checkouts,
            (
              select count(*)
              from merchant_reviews mr
              where mr.merchant_id = changed_merchant.id
                and mr.status in ('open', 'in_review')
            )::integer as review_count
          from changed_merchant
        `;

        if (!updated) {
          throw new AdminOperationError("Merchant could not be disabled.");
        }

        return {
          activeCheckouts: updated.active_checkouts,
          createdAt: updated.created_at,
          displayName: updated.display_name,
          id: updated.id,
          reviewCount: updated.review_count,
          status: updated.status,
          supportEmail: updated.support_email,
        };
      },
      context,
      database,
      metadata: { reason: input.reason.trim() },
      operation: "merchant_disable",
      resourceId: input.merchantId,
      resourceType: "merchant",
    });
  } finally {
    await database.release();
  }
}

/**
 * Lists open and recently resolved merchant review records for risk triage.
 */
export async function listAdminRisk(): Promise<AdminRiskRecord[]> {
  const context = await requireAdmin();
  const database = await connectToDatabase();

  try {
    return await withAdminAudit({
      callback: async (sql) => {
        const rows = await sql<
          {
            created_at: string;
            merchant_id: string;
            merchant_name: string;
            review_id: string;
            review_type: string;
            status: string;
          }[]
        >`
          select
            mr.id::text as review_id,
            mr.merchant_id::text as merchant_id,
            m.display_name as merchant_name,
            mr.review_type::text as review_type,
            mr.status::text as status,
            mr.created_at::text as created_at
          from merchant_reviews mr
          join merchants m on m.id = mr.merchant_id
          order by mr.created_at desc
          limit ${ADMIN_RESULT_LIMIT}
        `;

        return rows.map((row) => ({
          createdAt: row.created_at,
          merchantId: row.merchant_id,
          merchantName: row.merchant_name,
          reviewId: row.review_id,
          reviewType: row.review_type,
          status: row.status,
        }));
      },
      context,
      database,
      metadata: {},
      operation: "risk_review_view",
      resourceId: null,
      resourceType: "merchant",
    });
  } finally {
    await database.release();
  }
}

/**
 * Searches checkouts by public ref, internal UUID, or merchant name.
 */
export async function searchAdminCheckouts(
  search: string,
): Promise<AdminCheckoutRecord[]> {
  const context = await requireAdmin();
  const database = await connectToDatabase();
  const term = normalizedSearch(search);

  try {
    return await withAdminAudit({
      callback: async (sql) => {
        const rows = await sql<
          {
            amount_token: string;
            checkout_id: string;
            checkout_ref: string;
            created_at: string;
            merchant_id: string;
            merchant_name: string;
            status: string;
          }[]
        >`
          select
            cs.id::text as checkout_id,
            cs.checkout_ref,
            cs.amount_token::text as amount_token,
            cs.status::text as status,
            cs.created_at::text as created_at,
            m.id::text as merchant_id,
            m.display_name as merchant_name
          from checkout_sessions cs
          join merchants m on m.id = cs.merchant_id
          where (
            ${term} = ''
            or lower(cs.checkout_ref) = lower(${term})
            or cs.id::text = lower(${term})
            or lower(m.display_name) like lower('%' || ${term} || '%')
          )
          order by cs.created_at desc
          limit ${ADMIN_RESULT_LIMIT}
        `;

        return rows.map((row) => ({
          amountToken: row.amount_token,
          checkoutId: row.checkout_id,
          checkoutRef: row.checkout_ref,
          createdAt: row.created_at,
          merchantId: row.merchant_id,
          merchantName: row.merchant_name,
          status: row.status,
        }));
      },
      context,
      database,
      metadata: { search: term },
      operation: "checkout_search",
      resourceId: null,
      resourceType: "checkout",
    });
  } finally {
    await database.release();
  }
}

function toAdminPaymentRecord(row: {
  amount_token: string;
  checkout_id: string;
  checkout_ref: string;
  created_at: string;
  merchant_id: string;
  merchant_name: string;
  payment_id: string;
  payment_ref: string;
  status: string;
  tx_hash: string | null;
}): AdminPaymentRecord {
  return {
    amountToken: row.amount_token,
    checkoutId: row.checkout_id,
    checkoutRef: row.checkout_ref,
    createdAt: row.created_at,
    merchantId: row.merchant_id,
    merchantName: row.merchant_name,
    paymentId: row.payment_id,
    paymentRef: row.payment_ref,
    status: row.status,
    txHash: row.tx_hash,
  };
}

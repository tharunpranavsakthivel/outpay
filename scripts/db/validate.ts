/**
 * Verifies that the expected PostgreSQL schema objects exist after migrations
 * have been applied successfully.
 */

import {
  closeDatabasePool,
  connectToDatabase,
} from "../../src/lib/database/client";

const REQUIRED_EXTENSIONS = ["citext", "pgcrypto"] as const;
const REQUIRED_ENUMS = [
  "actor_type_enum",
  "api_environment_enum",
  "api_key_status_enum",
  "audit_action_enum",
  "checkout_source_enum",
  "checkout_status_enum",
  "checkout_status_reason_enum",
  "enterprise_request_status_enum",
  "enterprise_request_type_enum",
  "error_severity_enum",
  "error_source_enum",
  "fee_entry_type_enum",
  "integration_provider_enum",
  "integration_status_enum",
  "member_status_enum",
  "merchant_review_status_enum",
  "merchant_review_type_enum",
  "merchant_role_enum",
  "merchant_status_enum",
  "merchant_verification_status_enum",
  "notification_type_enum",
  "onboarding_status_enum",
  "payment_failure_type_enum",
  "payment_match_status_enum",
  "payment_status_enum",
  "plan_status_enum",
  "rate_limit_scope_enum",
  "resource_type_enum",
  "two_factor_status_enum",
  "wallet_change_status_enum",
  "wallet_status_enum",
  "wallet_type_enum",
  "webhook_attempt_outcome_enum",
  "webhook_delivery_status_enum",
  "webhook_endpoint_status_enum",
  "webhook_event_type_enum",
] as const;
const REQUIRED_TABLES = [
  "api_idempotency_keys",
  "api_keys",
  "api_rate_limit_counters",
  "audit_logs",
  "blockchains",
  "chain_cursors",
  "checkout_sessions",
  "checkout_status_history",
  "customers",
  "enterprise_contact_requests",
  "error_logs",
  "event_logs",
  "fee_ledger_entries",
  "file_assets",
  "integration_installations",
  "merchant_members",
  "merchant_onboarding",
  "merchant_plan_assignments",
  "merchant_reviews",
  "merchant_usage_monthly",
  "merchants",
  "notifications",
  "onchain_transactions",
  "payment_intents",
  "payment_match_failures",
  "payments",
  "pricing_plans",
  "provider_health_checks",
  "provider_events_raw",
  "schema_migrations",
  "tokens",
  "user_profiles",
  "wallet_addresses",
  "wallet_change_requests",
  "webhook_delivery_attempts",
  "webhook_endpoints",
  "webhook_events",
] as const;
const REQUIRED_INDEXES = [
  "idx_api_idempotency_keys_expires_at",
  "idx_api_keys_merchant_environment",
  "idx_api_keys_status",
  "idx_api_rate_limit_counters_api_key_id",
  "idx_api_rate_limit_counters_scope_window",
  "idx_audit_logs_actor_user_id",
  "idx_audit_logs_merchant_created_at",
  "idx_audit_logs_resource",
  "idx_checkout_sessions_expires_at",
  "idx_checkout_sessions_merchant_created_at",
  "idx_checkout_sessions_merchant_status",
  "idx_checkout_sessions_order_reference",
  "idx_checkout_sessions_public_token",
  "idx_checkout_status_history_checkout_created_at",
  "idx_customers_email",
  "idx_customers_merchant_id",
  "idx_enterprise_contact_requests_status",
  "idx_enterprise_contact_requests_work_email",
  "idx_error_logs_error_code",
  "idx_error_logs_merchant_created_at",
  "idx_error_logs_source_created_at",
  "idx_event_logs_event_name_occurred_at",
  "idx_event_logs_merchant_occurred_at",
  "idx_fee_ledger_entries_merchant_month",
  "idx_file_assets_owner_merchant_id",
  "idx_file_assets_storage_path",
  "idx_integration_installations_merchant_provider",
  "idx_merchant_members_merchant_role",
  "idx_merchant_members_user_id",
  "idx_merchant_onboarding_status",
  "idx_merchant_plan_assignments_merchant_active",
  "idx_merchant_reviews_merchant_status",
  "idx_merchant_usage_monthly_merchant_month",
  "idx_merchants_directory_listed_true",
  "idx_merchants_public_slug",
  "idx_merchants_status",
  "idx_merchants_verification_status",
  "idx_notifications_merchant_created_at",
  "idx_notifications_user_unread",
  "idx_onchain_transactions_from_address_normalized",
  "idx_onchain_transactions_observed_at",
  "idx_onchain_transactions_to_address_normalized",
  "idx_onchain_transactions_tx_hash_normalized",
  "idx_payment_intents_expires_at",
  "idx_payment_intents_match_status",
  "idx_payment_intents_merchant_id",
  "idx_payment_match_failures_checkout_session_id",
  "idx_payment_match_failures_failure_type",
  "idx_payments_confirmed_at",
  "idx_payments_merchant_created_at",
  "idx_payments_merchant_status",
  "idx_payments_onchain_transaction_id",
  "idx_payments_payment_intent_id",
  "idx_payments_recipient_address",
  "idx_payments_sender_address",
  "idx_provider_health_recent",
  "idx_tokens_chain_symbol",
  "idx_user_profiles_email",
  "idx_wallet_addresses_address_normalized",
  "idx_wallet_addresses_customer_id",
  "idx_wallet_addresses_merchant_primary",
  "idx_wallet_change_requests_created_at",
  "idx_wallet_change_requests_merchant_id",
  "idx_webhook_delivery_attempts_event_attempt",
  "idx_webhook_delivery_attempts_next_retry_at",
  "idx_webhook_delivery_attempts_response_status_code",
  "idx_webhook_endpoints_merchant_environment",
  "idx_webhook_events_checkout_session_id",
  "idx_webhook_events_delivery_status",
  "idx_webhook_events_merchant_emitted_at",
  "idx_webhook_events_payment_id",
  "uq_checkout_sessions_merchant_idempotency_key",
  "uq_customers_merchant_external_customer_ref",
  "uq_integration_installations_merchant_provider_external_store",
  "uq_onchain_transactions_hash_log",
  "uq_wallet_addresses_merchant_address",
] as const;
const REQUIRED_FUNCTIONS = ["set_updated_at"] as const;
const REQUIRED_TRIGGERS = [
  "trg_checkout_sessions_updated_at",
  "trg_customers_updated_at",
  "trg_enterprise_contact_requests_updated_at",
  "trg_integration_installations_updated_at",
  "trg_merchant_members_updated_at",
  "trg_merchant_onboarding_updated_at",
  "trg_merchant_usage_monthly_updated_at",
  "trg_merchants_updated_at",
  "trg_payment_intents_updated_at",
  "trg_payments_updated_at",
  "trg_user_profiles_updated_at",
  "trg_wallet_addresses_updated_at",
  "trg_webhook_endpoints_updated_at",
] as const;

/**
 * Runs catalog checks against the active database connection.
 */
async function main(): Promise<void> {
  const { source, sql } = await connectToDatabase();

  try {
    await assertNamedObjectsExist(
      sql,
      "extensions",
      REQUIRED_EXTENSIONS,
      `
        select extname as name
        from pg_extension
      `,
    );
    await assertNamedObjectsExist(
      sql,
      "enums",
      REQUIRED_ENUMS,
      `
        select t.typname as name
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e'
      `,
    );
    await assertNamedObjectsExist(
      sql,
      "tables",
      REQUIRED_TABLES,
      `
        select tablename as name
        from pg_tables
        where schemaname = 'public'
      `,
    );
    await assertNamedObjectsExist(
      sql,
      "indexes",
      REQUIRED_INDEXES,
      `
        select indexname as name
        from pg_indexes
        where schemaname = 'public'
      `,
    );
    await assertNamedObjectsExist(
      sql,
      "functions",
      REQUIRED_FUNCTIONS,
      `
        select proname as name
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
      `,
    );
    await assertNamedObjectsExist(
      sql,
      "triggers",
      REQUIRED_TRIGGERS,
      `
        select tgname as name
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and not t.tgisinternal
      `,
    );

    const authUsers = await sql<{ exists: boolean }[]>`
      select exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'auth' and c.relname = 'users'
      ) as exists
    `;

    if (!authUsers[0]?.exists) {
      throw new Error(
        "Missing required auth.users table for user_profiles foreign keys.",
      );
    }

    console.log(`Schema validation succeeded using ${source}.`);
  } finally {
    await closeDatabasePool();
  }
}

async function assertNamedObjectsExist(
  sql: Awaited<ReturnType<typeof connectToDatabase>>["sql"],
  label: string,
  requiredNames: readonly string[],
  catalogQuery: string,
): Promise<void> {
  const rows = await sql.unsafe(catalogQuery);
  const actualNames = new Set(rows.map((row) => String(row.name)));
  const missing = requiredNames.filter((name) => !actualNames.has(name));

  if (missing.length > 0) {
    throw new Error(`Missing ${label}: ${missing.join(", ")}`);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});

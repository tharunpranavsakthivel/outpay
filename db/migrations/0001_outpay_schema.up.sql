-- Creates the initial Outpay PostgreSQL schema from DATABASE_SCHEMA.md.
-- This migration intentionally implements the documented tables, enums,
-- indexes, constraints, and triggers without introducing app-specific data.

create extension if not exists pgcrypto;
create extension if not exists citext;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type two_factor_status_enum as enum ('disabled', 'pending_setup', 'enabled');
create type merchant_status_enum as enum ('active', 'paused', 'deactivated', 'under_review');
create type merchant_verification_status_enum as enum ('unverified', 'pending_review', 'verified', 'rejected');
create type merchant_role_enum as enum ('owner', 'admin', 'developer', 'finance', 'support', 'member', 'viewer');
create type member_status_enum as enum ('invited', 'active', 'suspended', 'removed');
create type onboarding_status_enum as enum ('store_details', 'wallet_address', 'confirm', 'completed');
create type wallet_type_enum as enum ('merchant_payout', 'customer_sender');
create type wallet_status_enum as enum ('active', 'replaced', 'disabled');
create type wallet_change_status_enum as enum ('pending', 'applied', 'rejected');
create type checkout_status_enum as enum ('pending', 'detected', 'paid', 'expired', 'deactivated', 'failed');
create type checkout_status_reason_enum as enum ('created', 'payment_detected', 'payment_confirmed', 'expired_timeout', 'manual_deactivation', 'invalid_payment', 'reactivated');
create type checkout_source_enum as enum ('dashboard', 'api', 'integration');
create type payment_match_status_enum as enum ('awaiting_payment', 'detected', 'confirmed', 'mismatched', 'expired');
create type payment_status_enum as enum ('pending', 'paid', 'failed', 'expired');
create type payment_failure_type_enum as enum ('wrong_network', 'wrong_token', 'amount_mismatch', 'late_payment', 'duplicate_payment', 'recipient_mismatch', 'unknown');
create type plan_status_enum as enum ('active', 'archived');
create type enterprise_request_type_enum as enum ('pricing', 'implementation', 'partnership', 'general');
create type enterprise_request_status_enum as enum ('new', 'qualified', 'contacted', 'closed');
create type merchant_review_type_enum as enum ('onboarding', 'verification', 'reactivation', 'risk');
create type merchant_review_status_enum as enum ('open', 'in_review', 'approved', 'rejected', 'closed');
create type notification_type_enum as enum ('payment_paid', 'payment_pending', 'checkout_expired', 'webhook_failed', 'webhook_recovered', 'store_status_changed');
create type resource_type_enum as enum ('merchant', 'wallet', 'checkout', 'payment', 'webhook_event', 'webhook_delivery', 'api_key', 'contact_request');
create type api_environment_enum as enum ('test', 'live');
create type api_key_status_enum as enum ('active', 'revoked');
create type webhook_endpoint_status_enum as enum ('active', 'disabled');
create type webhook_event_type_enum as enum ('checkout.paid');
create type webhook_delivery_status_enum as enum ('pending', 'processing', 'delivered', 'failed', 'exhausted');
create type webhook_attempt_outcome_enum as enum ('success', 'http_error', 'timeout', 'network_error', 'skipped');
create type integration_provider_enum as enum ('custom', 'shopify', 'woocommerce', 'bigcommerce', 'headless');
create type integration_status_enum as enum ('active', 'disabled', 'error');
create type rate_limit_scope_enum as enum ('merchant', 'api_key', 'ip');
create type actor_type_enum as enum ('user', 'system', 'worker', 'api_key');
create type fee_entry_type_enum as enum ('usage_fee', 'manual_adjustment', 'credit');
create type audit_action_enum as enum ('merchant_created', 'merchant_updated', 'wallet_changed', 'checkout_created', 'checkout_deactivated', 'payment_confirmed', 'webhook_endpoint_updated', 'api_key_created', 'api_key_revoked', 'store_deactivated', 'store_reactivated');
create type error_source_enum as enum ('web', 'api', 'worker', 'webhook');
create type error_severity_enum as enum ('warning', 'error', 'critical');

create table file_assets (
  id uuid primary key default gen_random_uuid(),
  owner_merchant_id uuid,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  sha256 text,
  uploaded_by_user_id uuid,
  created_at timestamptz not null default now()
);

create table pricing_plans (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  name text not null,
  status plan_status_enum not null default 'active',
  monthly_free_paid_transactions integer not null default 0 check (monthly_free_paid_transactions >= 0),
  usage_fee_rate numeric(8,6) not null default 0 check (usage_fee_rate >= 0),
  description text,
  created_at timestamptz not null default now()
);

create table blockchains (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  display_name text not null,
  chain_numeric_id integer not null unique,
  is_enabled boolean not null default true,
  confirmations_required integer not null default 1 check (confirmations_required >= 0),
  explorer_tx_url_template text not null,
  rpc_label text,
  created_at timestamptz not null default now()
);

create table tokens (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references blockchains(id),
  symbol citext not null,
  display_name text not null,
  contract_address text not null,
  contract_address_normalized text not null,
  decimals smallint not null check (decimals >= 0),
  is_enabled boolean not null default true,
  is_mvp_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (chain_id, symbol),
  unique (chain_id, contract_address_normalized)
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  full_name text,
  avatar_url text,
  password_changed_at timestamptz,
  two_factor_status two_factor_status_enum not null default 'disabled',
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table merchants (
  id uuid primary key default gen_random_uuid(),
  public_slug citext not null unique,
  legal_name text,
  display_name text not null,
  description text,
  logo_asset_id uuid references file_assets(id),
  support_email citext,
  website_url text,
  status merchant_status_enum not null default 'active',
  verification_status merchant_verification_status_enum not null default 'unverified',
  is_directory_listed boolean not null default false,
  directory_summary text,
  default_pricing_plan_id uuid references pricing_plans(id),
  deactivated_at timestamptz,
  deactivated_reason text,
  created_by_user_id uuid not null references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table file_assets
  add constraint file_assets_owner_merchant_fk
  foreign key (owner_merchant_id) references merchants(id);

alter table file_assets
  add constraint file_assets_uploaded_by_user_fk
  foreign key (uploaded_by_user_id) references user_profiles(id);

create table merchant_members (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  role merchant_role_enum not null default 'member',
  status member_status_enum not null default 'active',
  invited_by_user_id uuid references user_profiles(id),
  invited_email citext,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, user_id)
);

create table merchant_onboarding (
  merchant_id uuid primary key references merchants(id) on delete cascade,
  primary_user_id uuid not null references user_profiles(id),
  onboarding_status onboarding_status_enum not null default 'store_details',
  store_details_completed_at timestamptz,
  wallet_added_at timestamptz,
  wallet_confirmation_checked_at timestamptz,
  first_checkout_created_at timestamptz,
  test_webhook_sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  external_customer_ref text,
  email citext,
  name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table wallet_addresses (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  chain_id uuid not null references blockchains(id),
  address text not null check (address ~ '^0x[a-fA-F0-9]{40}$'),
  address_normalized text not null,
  wallet_type wallet_type_enum not null default 'merchant_payout',
  label text,
  is_primary boolean not null default false,
  status wallet_status_enum not null default 'active',
  verified_at timestamptz,
  replaced_by_wallet_id uuid references wallet_addresses(id),
  created_by_user_id uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  check ((merchant_id is not null) <> (customer_id is not null))
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  environment api_environment_enum not null,
  name text not null,
  key_prefix text not null unique,
  secret_hash text not null,
  last_four text not null,
  status api_key_status_enum not null default 'active',
  created_by_user_id uuid references user_profiles(id),
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  environment api_environment_enum not null default 'live',
  url text not null,
  signing_secret_hash text not null,
  signing_secret_prefix text not null,
  status webhook_endpoint_status_enum not null default 'active',
  subscribed_events text[] not null default array['checkout.paid']::text[],
  last_test_sent_at timestamptz,
  created_by_user_id uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, environment)
);

create table integration_installations (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  provider integration_provider_enum not null,
  status integration_status_enum not null default 'active',
  external_store_id text,
  config jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  checkout_ref text not null unique,
  public_token text not null unique,
  merchant_id uuid not null references merchants(id) on delete cascade,
  customer_id uuid references customers(id),
  token_id uuid not null references tokens(id),
  recipient_wallet_id uuid not null references wallet_addresses(id),
  label text not null,
  order_reference text,
  amount_usd numeric(20,2) not null check (amount_usd > 0),
  amount_token numeric(20,8) not null check (amount_token > 0),
  status checkout_status_enum not null default 'pending',
  redirect_url text,
  success_url text,
  cancel_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  detected_at timestamptz,
  deactivated_at timestamptz,
  deactivated_by_user_id uuid references user_profiles(id),
  source checkout_source_enum not null default 'dashboard',
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references user_profiles(id),
  created_via_api_key_id uuid references api_keys(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table wallet_change_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  old_wallet_id uuid references wallet_addresses(id),
  new_wallet_id uuid not null references wallet_addresses(id),
  requested_by_user_id uuid not null references user_profiles(id),
  confirmation_text_acknowledged boolean not null default false,
  status wallet_change_status_enum not null default 'applied',
  applied_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table checkout_status_history (
  id bigserial primary key,
  checkout_session_id uuid not null references checkout_sessions(id) on delete cascade,
  from_status checkout_status_enum,
  to_status checkout_status_enum not null,
  reason_code checkout_status_reason_enum,
  message text,
  actor_type actor_type_enum not null default 'system',
  actor_user_id uuid references user_profiles(id),
  created_at timestamptz not null default now()
);

create table payment_intents (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid not null unique references checkout_sessions(id) on delete cascade,
  merchant_id uuid not null references merchants(id) on delete cascade,
  token_id uuid not null references tokens(id),
  recipient_wallet_id uuid not null references wallet_addresses(id),
  expected_amount_token numeric(20,8) not null check (expected_amount_token > 0),
  match_status payment_match_status_enum not null default 'awaiting_payment',
  required_confirmations integer not null default 1 check (required_confirmations >= 0),
  current_confirmations integer not null default 0 check (current_confirmations >= 0),
  detected_tx_id uuid,
  confirmed_payment_id uuid,
  expires_at timestamptz,
  detected_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table onchain_transactions (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references blockchains(id),
  token_id uuid not null references tokens(id),
  tx_hash text not null,
  tx_hash_normalized text not null,
  block_number bigint,
  block_hash text,
  log_index integer,
  from_address text not null,
  from_address_normalized text not null,
  to_address text not null,
  to_address_normalized text not null,
  amount_token numeric(20,8) not null check (amount_token > 0),
  confirmations integer not null default 0 check (confirmations >= 0),
  observed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  raw_event jsonb,
  created_at timestamptz not null default now()
);

create unique index uq_onchain_transactions_hash_log
on onchain_transactions (chain_id, tx_hash_normalized, coalesce(log_index, -1));

create table payments (
  id uuid primary key default gen_random_uuid(),
  payment_ref text not null unique,
  merchant_id uuid not null references merchants(id) on delete cascade,
  checkout_session_id uuid not null unique references checkout_sessions(id) on delete cascade,
  payment_intent_id uuid not null references payment_intents(id) on delete cascade,
  onchain_transaction_id uuid references onchain_transactions(id),
  sender_wallet_id uuid references wallet_addresses(id),
  sender_address text not null,
  recipient_address text not null,
  token_id uuid not null references tokens(id),
  amount_token numeric(20,8) not null check (amount_token > 0),
  amount_usd numeric(20,2) not null check (amount_usd > 0),
  status payment_status_enum not null default 'pending',
  confirmations integer not null default 0 check (confirmations >= 0),
  confirmed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payment_intents
  add constraint payment_intents_detected_tx_fk
  foreign key (detected_tx_id) references onchain_transactions(id);

alter table payment_intents
  add constraint payment_intents_confirmed_payment_fk
  foreign key (confirmed_payment_id) references payments(id);

create table payment_match_failures (
  id uuid primary key default gen_random_uuid(),
  checkout_session_id uuid references checkout_sessions(id) on delete cascade,
  payment_intent_id uuid references payment_intents(id) on delete cascade,
  onchain_transaction_id uuid references onchain_transactions(id),
  failure_type payment_failure_type_enum not null,
  expected_amount_token numeric(20,8),
  observed_amount_token numeric(20,8),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table webhook_events (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  checkout_session_id uuid references checkout_sessions(id) on delete cascade,
  payment_id uuid references payments(id) on delete cascade,
  event_type webhook_event_type_enum not null,
  payload jsonb not null,
  payload_sha256 text not null,
  delivery_status webhook_delivery_status_enum not null default 'pending',
  emitted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table webhook_delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id uuid not null references webhook_events(id) on delete cascade,
  webhook_endpoint_id uuid not null references webhook_endpoints(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  request_headers jsonb,
  request_body jsonb,
  response_status_code integer,
  response_body_excerpt text,
  outcome webhook_attempt_outcome_enum not null,
  next_retry_at timestamptz,
  duration_ms integer,
  created_at timestamptz not null default now(),
  unique (webhook_event_id, attempt_number)
);

create table merchant_plan_assignments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  pricing_plan_id uuid not null references pricing_plans(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by_user_id uuid references user_profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table merchant_usage_monthly (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  usage_month date not null,
  paid_checkout_count integer not null default 0 check (paid_checkout_count >= 0),
  free_allowance_count integer not null default 1000 check (free_allowance_count >= 0),
  billable_checkout_count integer not null default 0 check (billable_checkout_count >= 0),
  gross_volume_usd numeric(20,2) not null default 0,
  platform_fee_usd numeric(20,2) not null default 0,
  pricing_plan_id uuid references pricing_plans(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, usage_month)
);

create table fee_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  payment_id uuid references payments(id),
  usage_month date not null,
  entry_type fee_entry_type_enum not null,
  amount_usd numeric(20,2) not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table enterprise_contact_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id),
  request_type enterprise_request_type_enum not null,
  work_email citext not null,
  company_name text not null,
  monthly_transaction_volume text,
  message text not null,
  status enterprise_request_status_enum not null default 'new',
  assigned_to_user_id uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table merchant_reviews (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  review_type merchant_review_type_enum not null,
  status merchant_review_status_enum not null default 'open',
  opened_by_user_id uuid references user_profiles(id),
  assigned_to_user_id uuid references user_profiles(id),
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  user_id uuid references user_profiles(id) on delete cascade,
  type notification_type_enum not null,
  title text not null,
  body text not null,
  resource_type resource_type_enum,
  resource_id uuid,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id bigserial primary key,
  merchant_id uuid references merchants(id) on delete cascade,
  actor_user_id uuid references user_profiles(id),
  actor_type actor_type_enum not null,
  api_key_id uuid references api_keys(id),
  action audit_action_enum not null,
  resource_type resource_type_enum not null,
  resource_id uuid,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table event_logs (
  id bigserial primary key,
  merchant_id uuid references merchants(id) on delete cascade,
  user_id uuid references user_profiles(id),
  checkout_session_id uuid references checkout_sessions(id) on delete cascade,
  event_name text not null,
  event_properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create table error_logs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id) on delete cascade,
  checkout_session_id uuid references checkout_sessions(id) on delete cascade,
  payment_id uuid references payments(id) on delete cascade,
  webhook_event_id uuid references webhook_events(id) on delete cascade,
  source error_source_enum not null,
  severity error_severity_enum not null,
  error_code text not null,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  api_key_id uuid references api_keys(id),
  idempotency_key text not null,
  request_method text not null,
  request_path text not null,
  request_hash text not null,
  response_status_code integer,
  response_body jsonb,
  checkout_session_id uuid references checkout_sessions(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (merchant_id, request_method, request_path, idempotency_key)
);

create table api_rate_limit_counters (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  api_key_id uuid references api_keys(id),
  scope rate_limit_scope_enum not null,
  window_starts_at timestamptz not null,
  window_ends_at timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  limit_count integer not null check (limit_count >= 0),
  created_at timestamptz not null default now()
);

create index idx_user_profiles_email on user_profiles(email);
create index idx_merchants_public_slug on merchants(public_slug);
create index idx_merchants_status on merchants(status);
create index idx_merchants_verification_status on merchants(verification_status);
create index idx_merchants_directory_listed_true on merchants(is_directory_listed) where is_directory_listed = true;
create index idx_merchant_members_user_id on merchant_members(user_id);
create index idx_merchant_members_merchant_role on merchant_members(merchant_id, role);
create index idx_merchant_onboarding_status on merchant_onboarding(onboarding_status);
create index idx_file_assets_owner_merchant_id on file_assets(owner_merchant_id);
create index idx_file_assets_storage_path on file_assets(storage_bucket, storage_path);
create index idx_customers_merchant_id on customers(merchant_id);
create index idx_customers_email on customers(email);
create unique index uq_customers_merchant_external_customer_ref
  on customers(merchant_id, external_customer_ref)
  where external_customer_ref is not null;
create index idx_tokens_chain_symbol on tokens(chain_id, symbol);
create index idx_wallet_addresses_merchant_primary on wallet_addresses(merchant_id, is_primary);
create index idx_wallet_addresses_address_normalized on wallet_addresses(address_normalized);
create index idx_wallet_addresses_customer_id on wallet_addresses(customer_id);
create unique index uq_wallet_addresses_merchant_address
  on wallet_addresses(chain_id, address_normalized, wallet_type, merchant_id)
  where merchant_id is not null;
create index idx_wallet_change_requests_merchant_id on wallet_change_requests(merchant_id);
create index idx_wallet_change_requests_created_at on wallet_change_requests(created_at desc);
create index idx_checkout_sessions_merchant_created_at on checkout_sessions(merchant_id, created_at desc);
create index idx_checkout_sessions_merchant_status on checkout_sessions(merchant_id, status);
create index idx_checkout_sessions_public_token on checkout_sessions(public_token);
create index idx_checkout_sessions_order_reference on checkout_sessions(order_reference);
create index idx_checkout_sessions_expires_at on checkout_sessions(expires_at) where status in ('pending', 'detected');
create index idx_checkout_status_history_checkout_created_at on checkout_status_history(checkout_session_id, created_at desc);
create index idx_payment_intents_match_status on payment_intents(match_status);
create index idx_payment_intents_expires_at on payment_intents(expires_at);
create index idx_payment_intents_merchant_id on payment_intents(merchant_id);
create index idx_onchain_transactions_tx_hash_normalized on onchain_transactions(tx_hash_normalized);
create index idx_onchain_transactions_to_address_normalized on onchain_transactions(to_address_normalized, observed_at desc);
create index idx_onchain_transactions_from_address_normalized on onchain_transactions(from_address_normalized);
create index idx_onchain_transactions_observed_at on onchain_transactions(observed_at desc);
create index idx_payments_merchant_created_at on payments(merchant_id, created_at desc);
create index idx_payments_merchant_status on payments(merchant_id, status, confirmed_at desc);
create index idx_payments_sender_address on payments(sender_address);
create index idx_payments_recipient_address on payments(recipient_address);
create index idx_payments_confirmed_at on payments(confirmed_at desc);
create index idx_payment_match_failures_checkout_session_id on payment_match_failures(checkout_session_id);
create index idx_payment_match_failures_failure_type on payment_match_failures(failure_type);
create index idx_api_keys_merchant_environment on api_keys(merchant_id, environment);
create index idx_api_keys_status on api_keys(status);
create index idx_webhook_endpoints_merchant_environment on webhook_endpoints(merchant_id, environment);
create unique index uq_integration_installations_merchant_provider_external_store
  on integration_installations(merchant_id, provider, coalesce(external_store_id, ''));
create index idx_integration_installations_merchant_provider on integration_installations(merchant_id, provider);
create index idx_webhook_events_merchant_emitted_at on webhook_events(merchant_id, emitted_at desc);
create index idx_webhook_events_delivery_status on webhook_events(delivery_status);
create index idx_webhook_delivery_attempts_event_attempt on webhook_delivery_attempts(webhook_event_id, attempt_number);
create index idx_webhook_delivery_attempts_next_retry_at on webhook_delivery_attempts(next_retry_at);
create index idx_webhook_delivery_attempts_response_status_code on webhook_delivery_attempts(response_status_code);
create index idx_merchant_plan_assignments_merchant_active on merchant_plan_assignments(merchant_id, starts_at desc);
create index idx_merchant_usage_monthly_merchant_month on merchant_usage_monthly(merchant_id, usage_month desc);
create index idx_fee_ledger_entries_merchant_month on fee_ledger_entries(merchant_id, usage_month desc);
create index idx_enterprise_contact_requests_status on enterprise_contact_requests(status, created_at desc);
create index idx_enterprise_contact_requests_work_email on enterprise_contact_requests(work_email);
create index idx_merchant_reviews_merchant_status on merchant_reviews(merchant_id, status);
create index idx_notifications_user_unread on notifications(user_id, is_read, created_at desc);
create index idx_notifications_merchant_created_at on notifications(merchant_id, created_at desc);
create index idx_audit_logs_merchant_created_at on audit_logs(merchant_id, created_at desc);
create index idx_audit_logs_resource on audit_logs(resource_type, resource_id);
create index idx_audit_logs_actor_user_id on audit_logs(actor_user_id, created_at desc);
create index idx_event_logs_merchant_occurred_at on event_logs(merchant_id, occurred_at desc);
create index idx_event_logs_event_name_occurred_at on event_logs(event_name, occurred_at desc);
create index idx_error_logs_source_created_at on error_logs(source, created_at desc);
create index idx_error_logs_merchant_created_at on error_logs(merchant_id, created_at desc);
create index idx_error_logs_error_code on error_logs(error_code, created_at desc);
create index idx_api_idempotency_keys_expires_at on api_idempotency_keys(expires_at);
create index idx_api_rate_limit_counters_scope_window on api_rate_limit_counters(scope, window_starts_at, window_ends_at);
create index idx_api_rate_limit_counters_api_key_id on api_rate_limit_counters(api_key_id);

create trigger trg_user_profiles_updated_at
before update on user_profiles
for each row execute function set_updated_at();

create trigger trg_merchants_updated_at
before update on merchants
for each row execute function set_updated_at();

create trigger trg_merchant_members_updated_at
before update on merchant_members
for each row execute function set_updated_at();

create trigger trg_merchant_onboarding_updated_at
before update on merchant_onboarding
for each row execute function set_updated_at();

create trigger trg_customers_updated_at
before update on customers
for each row execute function set_updated_at();

create trigger trg_webhook_endpoints_updated_at
before update on webhook_endpoints
for each row execute function set_updated_at();

create trigger trg_integration_installations_updated_at
before update on integration_installations
for each row execute function set_updated_at();

create trigger trg_checkout_sessions_updated_at
before update on checkout_sessions
for each row execute function set_updated_at();

create trigger trg_payment_intents_updated_at
before update on payment_intents
for each row execute function set_updated_at();

create trigger trg_payments_updated_at
before update on payments
for each row execute function set_updated_at();

create trigger trg_merchant_usage_monthly_updated_at
before update on merchant_usage_monthly
for each row execute function set_updated_at();

create trigger trg_enterprise_contact_requests_updated_at
before update on enterprise_contact_requests
for each row execute function set_updated_at();

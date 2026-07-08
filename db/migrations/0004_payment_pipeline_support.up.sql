-- Adds the payment-detection pipeline schema documented in ARCHITECTURE.md
-- (provider_events_raw, chain_cursors) that was never carried into the real
-- migrations, plus structural hardening for existing payment-adjacent
-- tables: checkout idempotency, wallet_addresses.updated_at, and missing
-- indexes on payments/webhook_events join columns.

create table provider_events_raw (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text,
  chain text not null,
  payload jsonb not null,
  signature_valid boolean not null default false,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, provider_event_id)
);

create table chain_cursors (
  id uuid primary key default gen_random_uuid(),
  chain text not null,
  provider text not null,
  cursor_type text not null,
  last_scanned_block bigint not null,
  last_success_at timestamptz,
  last_error_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (chain, provider, cursor_type)
);

alter table checkout_sessions
  add column idempotency_key text;

alter table checkout_sessions
  add constraint uq_checkout_sessions_merchant_idempotency_key
  unique (merchant_id, idempotency_key);

alter table wallet_addresses
  add column updated_at timestamptz not null default now();

create trigger trg_wallet_addresses_updated_at
before update on wallet_addresses
for each row execute function set_updated_at();

create index idx_payments_onchain_transaction_id on payments(onchain_transaction_id);
create index idx_payments_payment_intent_id on payments(payment_intent_id);
create index idx_webhook_events_checkout_session_id on webhook_events(checkout_session_id);
create index idx_webhook_events_payment_id on webhook_events(payment_id);

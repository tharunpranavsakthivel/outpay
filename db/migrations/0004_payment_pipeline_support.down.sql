-- Reverts the payment-detection pipeline schema support added in
-- 0004_payment_pipeline_support.up.sql, in reverse dependency order.

drop index if exists public.idx_webhook_events_payment_id;
drop index if exists public.idx_webhook_events_checkout_session_id;
drop index if exists public.idx_payments_payment_intent_id;
drop index if exists public.idx_payments_onchain_transaction_id;

drop trigger if exists trg_wallet_addresses_updated_at on wallet_addresses;

alter table wallet_addresses
  drop column if exists updated_at;

alter table checkout_sessions
  drop constraint if exists uq_checkout_sessions_merchant_idempotency_key;

alter table checkout_sessions
  drop column if exists idempotency_key;

drop table if exists public.chain_cursors cascade;
drop table if exists public.provider_events_raw cascade;

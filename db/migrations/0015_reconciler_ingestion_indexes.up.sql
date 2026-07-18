-- Supports the reconciler's redesigned ingestion path: it now loads the
-- small set of currently-watched payout wallet addresses (via
-- payment_intents.recipient_wallet_id) before every scan instead of storing
-- every USDC transfer on Base, and periodically deletes processed
-- provider_events_raw rows past their retention window. Both new query
-- patterns lacked a supporting index; payment_intents.recipient_wallet_id
-- was also a previously-unindexed foreign key.

create index idx_payment_intents_recipient_wallet_id
  on payment_intents(recipient_wallet_id);

create index idx_provider_events_raw_processed_at
  on provider_events_raw(processed_at)
  where processed_at is not null;

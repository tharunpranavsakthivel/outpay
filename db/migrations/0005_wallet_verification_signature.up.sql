-- Retains the wallet-ownership signature proof captured when a merchant
-- verifies control of a payout wallet (see T-2), so the verification can be
-- audited later. `verified_at` already existed but was previously dead;
-- pairing it with the raw signature makes the proof independently checkable.

alter table wallet_addresses
  add column verification_signature text;

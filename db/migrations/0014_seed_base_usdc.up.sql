-- Seeds the catalog rows required for the Base mainnet USDC checkout flow.
-- The inserts are idempotent so this migration is safe after the historical
-- onboarding fallback has already created either row.

insert into public.blockchains (
  slug,
  display_name,
  chain_numeric_id,
  explorer_tx_url_template,
  rpc_label
) values (
  'base',
  'Base',
  8453,
  'https://basescan.org/tx/{tx_hash}',
  'Base mainnet'
)
on conflict do nothing;

insert into public.tokens (
  chain_id,
  symbol,
  display_name,
  contract_address,
  contract_address_normalized,
  decimals,
  is_enabled,
  is_mvp_default
)
select
  blockchain.id,
  'USDC',
  'USD Coin',
  '0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913',
  '0x833589fdc6edb6e08f4c7c32d4f71b54bda02913',
  6,
  true,
  true
from public.blockchains blockchain
where blockchain.slug::text = 'base'
   or blockchain.chain_numeric_id = 8453
order by blockchain.created_at asc
limit 1
on conflict do nothing;

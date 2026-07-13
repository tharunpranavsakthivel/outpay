-- Removes the exact Base/USDC catalog rows seeded by 0014.
-- This rollback intentionally does not cascade into wallets or other data.

delete from public.tokens
where chain_id in (
  select id
  from public.blockchains
  where slug::text = 'base'
    and chain_numeric_id = 8453
)
  and symbol::text = 'USDC'
  and contract_address_normalized = '0x833589fdc6edb6e08f4c7c32d4f71b54bda02913';

delete from public.blockchains
where slug::text = 'base'
  and chain_numeric_id = 8453;

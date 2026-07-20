-- 0014_seed_base_usdc seeded contract_address_normalized with a
-- transposed-character typo (833589f**dc**6ed... instead of
-- 833589f**cd**6ed...), so the payment matcher's token-contract comparison
-- never matched a real USDC transfer on Base. Every payment attempt against
-- this token row was rejected with failure_type = 'wrong_token' regardless
-- of amount or recipient correctness. Corrects the stored value to the
-- lowercased form of the token's own (correct) contract_address.
update tokens
set contract_address_normalized = lower(contract_address)
where contract_address = '0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913'
  and contract_address_normalized = '0x833589fdc6edb6e08f4c7c32d4f71b54bda02913';

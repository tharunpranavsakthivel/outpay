update tokens
set contract_address_normalized = '0x833589fdc6edb6e08f4c7c32d4f71b54bda02913'
where contract_address = '0x833589fCD6EDb6E08f4c7C32D4f71b54bdA02913'
  and contract_address_normalized = lower(contract_address);

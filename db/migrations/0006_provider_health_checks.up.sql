-- Adds durable provider health-check history so failover decisions can be
-- based on recent provider behavior rather than only transient in-memory
-- process state.

create table provider_health_checks (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  chain text not null,
  status text not null,
  latency_ms integer,
  block_number bigint,
  error text,
  checked_at timestamptz not null default now()
);

create index idx_provider_health_recent
on provider_health_checks(provider, chain, checked_at desc);

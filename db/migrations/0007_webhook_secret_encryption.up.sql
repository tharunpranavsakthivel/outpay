alter table webhook_endpoints
  add column signing_secret_encrypted text,
  add column failure_count integer not null default 0 check (failure_count >= 0);

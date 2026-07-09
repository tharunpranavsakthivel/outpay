-- Adds explicit API-key scopes so the public v1 REST API can enforce
-- permission checks at request time.

alter table api_keys
  add column scopes text[] not null
  default array['checkouts:create', 'payments:read']::text[];

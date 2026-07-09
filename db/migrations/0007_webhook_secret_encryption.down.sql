alter table webhook_endpoints
  drop column if exists failure_count,
  drop column if exists signing_secret_encrypted;

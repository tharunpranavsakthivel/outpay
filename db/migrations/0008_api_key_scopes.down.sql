-- Removes API-key scope support introduced for the public v1 REST API.

alter table api_keys
  drop column if exists scopes;

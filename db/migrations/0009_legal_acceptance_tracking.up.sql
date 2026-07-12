-- Stores server-generated signup acceptance timestamps in Better Auth and the
-- app-owned compatibility profile used by merchant workflows.

alter table "user"
  add column "privacy_accepted_at" timestamptz,
  add column "terms_accepted_at" timestamptz;

alter table user_profiles
  add column privacy_accepted_at timestamptz,
  add column terms_accepted_at timestamptz;

-- Removes legal acceptance timestamps introduced for signup defensibility.

alter table user_profiles
  drop column if exists privacy_accepted_at,
  drop column if exists terms_accepted_at;

alter table "user"
  drop column if exists "privacy_accepted_at",
  drop column if exists "terms_accepted_at";

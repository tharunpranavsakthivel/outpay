-- Rolls back the Better Auth core tables introduced for first-party auth.

drop index if exists "verification_identifier_idx";
drop index if exists "account_userId_idx";
drop index if exists "session_userId_idx";

drop table if exists "verification";
drop table if exists "account";
drop table if exists "session";
drop table if exists "user";

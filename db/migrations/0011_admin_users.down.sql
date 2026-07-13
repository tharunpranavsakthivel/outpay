-- Removes the admin access table. The additive audit enum value is retained
-- because PostgreSQL cannot safely remove enum labels without rewriting every
-- dependent audit row; leaving it is harmless and preserves audit history.

drop trigger if exists trg_admin_users_updated_at on admin_users;
drop index if exists idx_admin_users_active;
drop table if exists admin_users;

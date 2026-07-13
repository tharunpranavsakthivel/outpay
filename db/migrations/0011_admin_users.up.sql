-- Adds the fail-closed admin access boundary used by the support and
-- operations dashboard. Admin membership is deliberately separate from
-- merchant membership so merchant role changes cannot grant global access.

alter type audit_action_enum add value if not exists 'admin_action';

create table admin_users (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  granted_by_user_id uuid references user_profiles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_admin_users_active
on admin_users(user_id)
where is_active = true;

create trigger trg_admin_users_updated_at
before update on admin_users
for each row execute function set_updated_at();

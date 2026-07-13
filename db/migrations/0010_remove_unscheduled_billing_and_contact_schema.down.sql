-- Recreates the schema removed by migration 0010. Dropped rows are not
-- recoverable from this rollback; restore them from a pre-migration backup.

create type plan_status_enum as enum ('active', 'archived');
create type enterprise_request_type_enum as enum ('pricing', 'implementation', 'partnership', 'general');
create type enterprise_request_status_enum as enum ('new', 'qualified', 'contacted', 'closed');
create type fee_entry_type_enum as enum ('usage_fee', 'manual_adjustment', 'credit');

create table pricing_plans (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  name text not null,
  status plan_status_enum not null default 'active',
  monthly_free_paid_transactions integer not null default 0 check (monthly_free_paid_transactions >= 0),
  usage_fee_rate numeric(8,6) not null default 0 check (usage_fee_rate >= 0),
  description text,
  created_at timestamptz not null default now()
);

alter table public.merchants
  add column default_pricing_plan_id uuid references public.pricing_plans(id);

create table merchant_plan_assignments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  pricing_plan_id uuid not null references pricing_plans(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by_user_id uuid references user_profiles(id),
  notes text,
  created_at timestamptz not null default now()
);

create table merchant_usage_monthly (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  usage_month date not null,
  paid_checkout_count integer not null default 0 check (paid_checkout_count >= 0),
  free_allowance_count integer not null default 1000 check (free_allowance_count >= 0),
  billable_checkout_count integer not null default 0 check (billable_checkout_count >= 0),
  gross_volume_usd numeric(20,2) not null default 0,
  platform_fee_usd numeric(20,2) not null default 0,
  pricing_plan_id uuid references pricing_plans(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, usage_month)
);

create table fee_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references merchants(id) on delete cascade,
  payment_id uuid references payments(id),
  usage_month date not null,
  entry_type fee_entry_type_enum not null,
  amount_usd numeric(20,2) not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table enterprise_contact_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references merchants(id),
  request_type enterprise_request_type_enum not null,
  work_email citext not null,
  company_name text not null,
  monthly_transaction_volume text,
  message text not null,
  status enterprise_request_status_enum not null default 'new',
  assigned_to_user_id uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_merchant_plan_assignments_merchant_active
  on merchant_plan_assignments(merchant_id, starts_at desc);
create index idx_merchant_usage_monthly_merchant_month
  on merchant_usage_monthly(merchant_id, usage_month desc);
create index idx_fee_ledger_entries_merchant_month
  on fee_ledger_entries(merchant_id, usage_month desc);
create index idx_enterprise_contact_requests_status
  on enterprise_contact_requests(status, created_at desc);
create index idx_enterprise_contact_requests_work_email
  on enterprise_contact_requests(work_email);

create trigger trg_merchant_usage_monthly_updated_at
before update on merchant_usage_monthly
for each row execute function set_updated_at();

create trigger trg_enterprise_contact_requests_updated_at
before update on enterprise_contact_requests
for each row execute function set_updated_at();

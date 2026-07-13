-- Restores the scheduled pricing and usage objects, seeds the public plans,
-- and meters only confirmed paid payment transitions inside PostgreSQL.

create type public.plan_status_enum as enum ('active', 'archived');
create type public.fee_entry_type_enum as enum ('usage_fee', 'manual_adjustment', 'credit');

create table public.pricing_plans (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  name text not null,
  status public.plan_status_enum not null default 'active',
  monthly_free_paid_transactions integer not null default 0 check (monthly_free_paid_transactions >= 0),
  usage_fee_rate numeric(8,6) not null default 0 check (usage_fee_rate >= 0),
  description text,
  created_at timestamptz not null default now()
);

alter table public.merchants
  add column default_pricing_plan_id uuid references public.pricing_plans(id);

create table public.merchant_plan_assignments (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  pricing_plan_id uuid not null references public.pricing_plans(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  assigned_by_user_id uuid references public.user_profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.merchant_usage_monthly (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  usage_month date not null,
  paid_checkout_count integer not null default 0 check (paid_checkout_count >= 0),
  free_allowance_count integer not null default 1000 check (free_allowance_count >= 0),
  billable_checkout_count integer not null default 0 check (billable_checkout_count >= 0),
  gross_volume_usd numeric(20,2) not null default 0 check (gross_volume_usd >= 0),
  platform_fee_usd numeric(20,2) not null default 0 check (platform_fee_usd >= 0),
  pricing_plan_id uuid references public.pricing_plans(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (merchant_id, usage_month)
);

create table public.fee_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  payment_id uuid references public.payments(id),
  usage_month date not null,
  entry_type public.fee_entry_type_enum not null,
  amount_usd numeric(20,2) not null,
  description text not null,
  created_at timestamptz not null default now()
);

create index idx_merchant_plan_assignments_merchant_active
  on public.merchant_plan_assignments(merchant_id, starts_at desc);
create index idx_merchant_usage_monthly_merchant_month
  on public.merchant_usage_monthly(merchant_id, usage_month desc);
create index idx_fee_ledger_entries_merchant_month
  on public.fee_ledger_entries(merchant_id, usage_month desc);
create unique index uq_fee_ledger_entries_usage_payment
  on public.fee_ledger_entries(payment_id)
  where entry_type = 'usage_fee';

create trigger trg_merchant_usage_monthly_updated_at
before update on public.merchant_usage_monthly
for each row execute function public.set_updated_at();

insert into public.pricing_plans (
  code,
  name,
  status,
  monthly_free_paid_transactions,
  usage_fee_rate,
  description
) values
  ('free', 'Free', 'active', 1000, 0, '1,000 confirmed paid transactions each month with no platform fee.'),
  ('standard_usage', 'Standard usage', 'active', 1000, 0.015, '1,000 confirmed paid transactions free each month, then 1.5% per billable payment.'),
  ('corporate', 'Corporate', 'active', 0, 0, 'Custom commercial terms managed through a signed merchant agreement.')
on conflict (code) do update set
  name = excluded.name,
  status = excluded.status,
  monthly_free_paid_transactions = excluded.monthly_free_paid_transactions,
  usage_fee_rate = excluded.usage_fee_rate,
  description = excluded.description;

update public.merchants
set default_pricing_plan_id = (
  select id from public.pricing_plans where code = 'standard_usage'
)
where default_pricing_plan_id is null;

create or replace function public.record_paid_payment_usage()
returns trigger
language plpgsql
as $$
declare
  payment_timestamp timestamptz := coalesce(new.confirmed_at, new.created_at, now());
  usage_month_value date := date_trunc('month', payment_timestamp)::date;
  plan_id_value uuid;
  free_allowance_value integer;
  fee_rate_value numeric(8,6);
  current_paid_count integer;
  current_free_allowance integer;
  current_gross_volume numeric(20,2);
  current_platform_fee numeric(20,2);
  next_paid_count integer;
  next_billable_count integer;
  fee_amount numeric(20,2);
begin
  -- The trigger fires for pending-to-paid transitions and initial paid rows.
  -- A paid-to-paid retry must not count the same payment twice.
  if new.status <> 'paid' or (tg_op = 'UPDATE' and old.status = 'paid') then
    return new;
  end if;

  select selected_plan.id,
         selected_plan.monthly_free_paid_transactions,
         selected_plan.usage_fee_rate
    into plan_id_value, free_allowance_value, fee_rate_value
  from public.merchants merchant
  join lateral (
    select plan.id,
           plan.monthly_free_paid_transactions,
           plan.usage_fee_rate
    from public.pricing_plans plan
    where plan.id = coalesce(
      (
        select assignment.pricing_plan_id
        from public.merchant_plan_assignments assignment
        where assignment.merchant_id = merchant.id
          and assignment.starts_at <= payment_timestamp
          and (assignment.ends_at is null or assignment.ends_at > payment_timestamp)
        order by assignment.starts_at desc
        limit 1
      ),
      merchant.default_pricing_plan_id,
      (select fallback.id from public.pricing_plans fallback where fallback.code = 'standard_usage')
    )
  ) selected_plan on true
  where merchant.id = new.merchant_id;

  if plan_id_value is null then
    raise exception 'Unable to meter paid payment %: merchant % has no active pricing plan', new.id, new.merchant_id;
  end if;

  insert into public.merchant_usage_monthly (
    merchant_id,
    usage_month,
    free_allowance_count,
    pricing_plan_id
  ) values (
    new.merchant_id,
    usage_month_value,
    free_allowance_value,
    plan_id_value
  ) on conflict (merchant_id, usage_month) do nothing;

  select paid_checkout_count,
         free_allowance_count,
         gross_volume_usd,
         platform_fee_usd
    into current_paid_count,
         current_free_allowance,
         current_gross_volume,
         current_platform_fee
  from public.merchant_usage_monthly
  where merchant_id = new.merchant_id
    and usage_month = usage_month_value
  for update;

  next_paid_count := current_paid_count + 1;
  next_billable_count := greatest(0, next_paid_count - current_free_allowance);
  fee_amount := case
    when next_paid_count > current_free_allowance
      then round(new.amount_usd * fee_rate_value, 2)
    else 0
  end;

  update public.merchant_usage_monthly
  set paid_checkout_count = next_paid_count,
      billable_checkout_count = next_billable_count,
      gross_volume_usd = current_gross_volume + new.amount_usd,
      platform_fee_usd = current_platform_fee + fee_amount,
      pricing_plan_id = plan_id_value,
      updated_at = now()
  where merchant_id = new.merchant_id
    and usage_month = usage_month_value;

  if fee_amount > 0 then
    insert into public.fee_ledger_entries (
      merchant_id,
      payment_id,
      usage_month,
      entry_type,
      amount_usd,
      description
    ) values (
      new.merchant_id,
      new.id,
      usage_month_value,
      'usage_fee',
      fee_amount,
      format('Usage fee for confirmed payment %s at configured plan rate %s', new.payment_ref, fee_rate_value)
    ) on conflict (payment_id) where entry_type = 'usage_fee' do nothing;
  end if;

  return new;
end;
$$;

create trigger trg_payments_usage_metering
after insert or update of status on public.payments
for each row execute function public.record_paid_payment_usage();

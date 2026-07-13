-- Removes usage metering and restores the post-0010 schema state.

drop trigger if exists trg_payments_usage_metering on public.payments;
drop function if exists public.record_paid_payment_usage();
drop trigger if exists trg_merchant_usage_monthly_updated_at on public.merchant_usage_monthly;
drop index if exists public.uq_fee_ledger_entries_usage_payment;
drop index if exists public.idx_fee_ledger_entries_merchant_month;
drop index if exists public.idx_merchant_usage_monthly_merchant_month;
drop index if exists public.idx_merchant_plan_assignments_merchant_active;

drop table if exists public.fee_ledger_entries;
drop table if exists public.merchant_usage_monthly;
drop table if exists public.merchant_plan_assignments;

alter table public.merchants
  drop column if exists default_pricing_plan_id;

drop table if exists public.pricing_plans;
drop type if exists public.fee_entry_type_enum;
drop type if exists public.plan_status_enum;

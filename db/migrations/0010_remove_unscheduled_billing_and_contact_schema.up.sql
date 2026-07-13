-- Removes schema for billing/metering and enterprise-contact workflows that
-- have no active consumers. Reintroduce them with a new migration when those
-- features are scheduled.

drop table if exists public.merchant_plan_assignments;
drop table if exists public.merchant_usage_monthly;
drop table if exists public.fee_ledger_entries;
drop table if exists public.enterprise_contact_requests;

alter table public.merchants
  drop column if exists default_pricing_plan_id;

drop table if exists public.pricing_plans;

drop type if exists public.fee_entry_type_enum;
drop type if exists public.enterprise_request_status_enum;
drop type if exists public.enterprise_request_type_enum;
drop type if exists public.plan_status_enum;

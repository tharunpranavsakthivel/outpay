-- Restores the public enterprise contact workflow scheduled by T-44 after
-- migration 0010 removed its unused schema.

create type public.enterprise_request_type_enum as enum (
  'pricing',
  'implementation',
  'partnership',
  'general'
);

create type public.enterprise_request_status_enum as enum (
  'new',
  'qualified',
  'contacted',
  'closed'
);

create table public.enterprise_contact_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id),
  request_type public.enterprise_request_type_enum not null,
  work_email citext not null,
  company_name text not null,
  monthly_transaction_volume text,
  message text not null,
  status public.enterprise_request_status_enum not null default 'new',
  assigned_to_user_id uuid references public.user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_enterprise_contact_requests_status
  on public.enterprise_contact_requests(status, created_at desc);
create index idx_enterprise_contact_requests_work_email
  on public.enterprise_contact_requests(work_email);

create trigger trg_enterprise_contact_requests_updated_at
before update on public.enterprise_contact_requests
for each row execute function public.set_updated_at();

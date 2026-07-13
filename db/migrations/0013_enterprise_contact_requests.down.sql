-- Removes the T-44 contact workflow during rollback. Contact rows created
-- after this migration are not recoverable from the schema rollback alone.

drop trigger if exists public.trg_enterprise_contact_requests_updated_at
  on public.enterprise_contact_requests;
drop index if exists public.idx_enterprise_contact_requests_status;
drop index if exists public.idx_enterprise_contact_requests_work_email;
drop table if exists public.enterprise_contact_requests;
drop type if exists public.enterprise_request_status_enum;
drop type if exists public.enterprise_request_type_enum;

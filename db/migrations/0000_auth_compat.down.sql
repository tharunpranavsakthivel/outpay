-- Reverts the local auth compatibility table only when this repo created it.

do $$
declare
  auth_schema_comment text;
  auth_users_comment text;
begin
  if to_regclass('auth.users') is not null then
    select obj_description('auth.users'::regclass, 'pg_class')
      into auth_users_comment;

    if auth_users_comment = 'outpay-auth-compat' then
      execute 'drop table auth.users';
    end if;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'auth') then
    select obj_description(oid, 'pg_namespace')
      into auth_schema_comment
    from pg_namespace
    where nspname = 'auth';

    if auth_schema_comment = 'outpay-auth-compat'
      and not exists (
        select 1
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'auth'
      ) then
      execute 'drop schema auth';
    end if;
  end if;
end;
$$;

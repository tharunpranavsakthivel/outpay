-- Provides a minimal auth.users compatibility surface for local PostgreSQL
-- instances that are not running the Supabase auth schema already.

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    execute 'create schema auth';
    comment on schema auth is 'outpay-auth-compat';
  end if;
end;
$$;

do $$
begin
  if to_regclass('auth.users') is null then
    execute $sql$
      create table auth.users (
        id uuid primary key,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    $sql$;

    comment on table auth.users is 'outpay-auth-compat';
  end if;
end;
$$;

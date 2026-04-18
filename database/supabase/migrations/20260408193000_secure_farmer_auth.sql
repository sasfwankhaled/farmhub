-- Secure farmer login by linking farmer_accounts with Supabase Auth users.

alter table public.farmer_accounts
  add column if not exists email text,
  add column if not exists auth_user_id uuid;

alter table public.farmer_accounts
  alter column username drop not null,
  alter column password drop not null;

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'farmer_accounts'
      and constraint_name = 'farmer_accounts_username_key'
      and constraint_type = 'UNIQUE'
  ) then
    alter table public.farmer_accounts drop constraint farmer_accounts_username_key;
  end if;
end $$;

create unique index if not exists farmer_accounts_email_unique
  on public.farmer_accounts (lower(email))
  where email is not null;

create unique index if not exists farmer_accounts_auth_user_id_unique
  on public.farmer_accounts (auth_user_id)
  where auth_user_id is not null;

-- Keep backward compatibility for old rows, but require email/auth_user_id for new secure flow.
comment on column public.farmer_accounts.email is 'Supabase Auth email linked to the farmer account.';
comment on column public.farmer_accounts.auth_user_id is 'auth.users.id linked to the farmer account.';

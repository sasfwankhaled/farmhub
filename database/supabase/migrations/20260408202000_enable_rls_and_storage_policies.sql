-- Security hardening: enable RLS and add role-aware policies.

begin;

-- Shared helper functions used by policies.
create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select
    auth.uid() is not null
    and (
      lower(coalesce(auth.jwt() ->> 'email', '')) in ('saafwanrawashdeh@gmail.com')
      or lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')) = 'admin'
    );
$$;

create or replace function public.current_farmer_account()
returns public.farmer_accounts
language sql
stable
as $$
  select fa.*
  from public.farmer_accounts fa
  where fa.auth_user_id = auth.uid()
    and fa.is_active = true
  limit 1;
$$;

create or replace function public.can_access_farmer_row(row_farmer_id text, row_farm_id text default null)
returns boolean
language sql
stable
as $$
  select
    public.is_admin_user()
    or exists (
      select 1
      from public.farmer_accounts fa
      where fa.auth_user_id = auth.uid()
        and fa.is_active = true
        and (
          (row_farmer_id is not null and fa.farmer_id = row_farmer_id)
          or (row_farm_id is not null and fa.farm_id = row_farm_id)
        )
    );
$$;

create or replace function public.trip_id_from_storage_name(obj_name text)
returns text
language sql
immutable
as $$
  -- expected format: "<prefix>/<tripId>_<timestamp>_<file>"
  select split_part(split_part(obj_name, '/', 2), '_', 1);
$$;

create or replace function public.can_access_receipt_object(obj_name text)
returns boolean
language sql
stable
as $$
  select
    public.is_admin_user()
    or exists (
      select 1
      from public.trips t
      join public.farmer_accounts fa
        on fa.auth_user_id = auth.uid()
       and fa.is_active = true
      where t.id = public.trip_id_from_storage_name(obj_name)
        and fa.farmer_id = t.farmer_id
    );
$$;

alter table public.entities enable row level security;
alter table public.crops enable row level security;
alter table public.farms enable row level security;
alter table public.farmer_accounts enable row level security;
alter table public.settings enable row level security;
alter table public.global_prices enable row level security;
alter table public.trips enable row level security;
alter table public.farm_expenses enable row level security;
alter table public.vehicle_expenses enable row level security;
alter table public.attendance enable row level security;
alter table public.worker_payments enable row level security;

-- entities
drop policy if exists entities_admin_all on public.entities;
drop policy if exists entities_farmer_read on public.entities;
create policy entities_admin_all on public.entities
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
create policy entities_farmer_read on public.entities
for select
to authenticated
using (public.current_farmer_account() is not null);

-- crops
drop policy if exists crops_admin_all on public.crops;
drop policy if exists crops_farmer_read on public.crops;
create policy crops_admin_all on public.crops
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
create policy crops_farmer_read on public.crops
for select
to authenticated
using (public.current_farmer_account() is not null);

-- farms
drop policy if exists farms_admin_all on public.farms;
drop policy if exists farms_farmer_read on public.farms;
create policy farms_admin_all on public.farms
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
create policy farms_farmer_read on public.farms
for select
to authenticated
using (public.can_access_farmer_row(null, id));

-- farmer_accounts
drop policy if exists farmer_accounts_admin_all on public.farmer_accounts;
drop policy if exists farmer_accounts_self_read on public.farmer_accounts;
create policy farmer_accounts_admin_all on public.farmer_accounts
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
create policy farmer_accounts_self_read on public.farmer_accounts
for select
to authenticated
using (auth.uid() = auth_user_id);

-- settings
drop policy if exists settings_admin_all on public.settings;
drop policy if exists settings_farmer_read on public.settings;
create policy settings_admin_all on public.settings
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
create policy settings_farmer_read on public.settings
for select
to authenticated
using (public.current_farmer_account() is not null);

-- global_prices
drop policy if exists global_prices_admin_all on public.global_prices;
drop policy if exists global_prices_farmer_read on public.global_prices;
create policy global_prices_admin_all on public.global_prices
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
create policy global_prices_farmer_read on public.global_prices
for select
to authenticated
using (public.current_farmer_account() is not null);

-- trips
drop policy if exists trips_admin_all on public.trips;
drop policy if exists trips_farmer_read on public.trips;
create policy trips_admin_all on public.trips
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
create policy trips_farmer_read on public.trips
for select
to authenticated
using (public.can_access_farmer_row(farmer_id, farm_id));

-- farm_expenses
drop policy if exists farm_expenses_admin_all on public.farm_expenses;
drop policy if exists farm_expenses_farmer_rw on public.farm_expenses;
create policy farm_expenses_admin_all on public.farm_expenses
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
create policy farm_expenses_farmer_rw on public.farm_expenses
for all
to authenticated
using (public.can_access_farmer_row(farmer_id, farm_id))
with check (public.can_access_farmer_row(farmer_id, farm_id));

-- vehicle_expenses
drop policy if exists vehicle_expenses_admin_all on public.vehicle_expenses;
drop policy if exists vehicle_expenses_farmer_rw on public.vehicle_expenses;
create policy vehicle_expenses_admin_all on public.vehicle_expenses
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
create policy vehicle_expenses_farmer_rw on public.vehicle_expenses
for all
to authenticated
using (public.can_access_farmer_row(farmer_id, farm_id))
with check (public.can_access_farmer_row(farmer_id, farm_id));

-- attendance
drop policy if exists attendance_admin_all on public.attendance;
drop policy if exists attendance_farmer_rw on public.attendance;
create policy attendance_admin_all on public.attendance
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
create policy attendance_farmer_rw on public.attendance
for all
to authenticated
using (public.can_access_farmer_row(farmer_id, farm_id))
with check (public.can_access_farmer_row(farmer_id, farm_id));

-- worker_payments
drop policy if exists worker_payments_admin_all on public.worker_payments;
drop policy if exists worker_payments_farmer_rw on public.worker_payments;
create policy worker_payments_admin_all on public.worker_payments
for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());
create policy worker_payments_farmer_rw on public.worker_payments
for all
to authenticated
using (public.can_access_farmer_row(farmer_id, farm_id))
with check (public.can_access_farmer_row(farmer_id, farm_id));

-- storage.objects policies for receipts bucket.
drop policy if exists receipts_admin_all on storage.objects;
drop policy if exists receipts_farmer_access on storage.objects;
create policy receipts_admin_all on storage.objects
for all
to authenticated
using (bucket_id = 'receipts' and public.is_admin_user())
with check (bucket_id = 'receipts' and public.is_admin_user());

create policy receipts_farmer_access on storage.objects
for all
to authenticated
using (bucket_id = 'receipts' and public.can_access_receipt_object(name))
with check (bucket_id = 'receipts' and public.can_access_receipt_object(name));

commit;

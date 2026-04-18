-- Initial FarmHub schema on Supabase (PostgreSQL)

create extension if not exists "pgcrypto";

create table if not exists public.entities (
  id text primary key,
  name text not null,
  type text not null check (type in ('farmer', 'merchant', 'worker')),
  commission_rate numeric default 0,
  hourly_rate numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.crops (
  id text primary key,
  name text not null,
  unit text not null check (unit in ('box', 'kg')),
  created_at timestamptz default now()
);

create table if not exists public.farms (
  id text primary key,
  name text not null,
  farmer_ids text[] not null default '{}',
  created_at timestamptz default now()
);

create table if not exists public.farmer_accounts (
  id text primary key,
  username text not null unique,
  password text not null,
  farmer_id text not null,
  farm_id text not null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

create table if not exists public.settings (
  id text primary key,
  box_price numeric default 0,
  water_price numeric default 0,
  transport_fee_per_unit numeric default 0,
  created_at timestamptz default now()
);

create table if not exists public.global_prices (
  id text primary key,
  name text not null,
  value numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.trips (
  id text primary key,
  trip_number text not null,
  farmer_id text not null,
  farm_id text,
  merchant_id text not null,
  crop_id text not null,
  quantity numeric not null default 0,
  status text not null check (status in ('waiting', 'delivered', 'sold', 'collected')),
  total_sale_amount numeric default 0,
  weight_kg numeric default 0,
  receipt_image_url text,
  date date not null,
  due_date date,
  created_at timestamptz default now(),
  day text,
  packages_count integer default 0,
  farmer_delivery_status text,
  farmer_delivered_at timestamptz
);

create table if not exists public.farm_expenses (
  id text primary key,
  farmer_id text not null,
  farm_id text,
  crop_id text,
  date date not null,
  due_date date,
  day text,
  type text not null check (type in ('water', 'workers', 'supplies', 'boxes')),
  quantity numeric not null default 0,
  cost numeric not null default 0,
  total numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.vehicle_expenses (
  id text primary key,
  farmer_id text not null,
  farm_id text,
  date date not null,
  due_date date,
  day text,
  type text not null check (type in ('diesel', 'maintenance', 'insurance', 'license', 'other')),
  cost numeric not null default 0,
  notes text default '',
  created_at timestamptz default now()
);

create table if not exists public.attendance (
  id text primary key,
  farmer_id text not null,
  farm_id text,
  worker_id text not null,
  worker_name text not null,
  date date not null,
  day text,
  start_time text not null,
  end_time text not null,
  total_hours numeric not null default 0,
  hourly_rate numeric not null default 0,
  total_cost numeric not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.worker_payments (
  id text primary key,
  farmer_id text not null,
  farm_id text,
  worker_id text not null,
  date date not null,
  due_date date,
  day text,
  amount numeric not null default 0,
  notes text default '',
  created_at timestamptz default now()
);

create index if not exists idx_entities_type on public.entities(type);
create index if not exists idx_trips_farmer_id on public.trips(farmer_id);
create index if not exists idx_trips_merchant_id on public.trips(merchant_id);
create index if not exists idx_trips_status on public.trips(status);
create index if not exists idx_trips_date on public.trips(date);
create index if not exists idx_farm_expenses_farmer_id on public.farm_expenses(farmer_id);
create index if not exists idx_vehicle_expenses_farmer_id on public.vehicle_expenses(farmer_id);
create index if not exists idx_attendance_farmer_id on public.attendance(farmer_id);
create index if not exists idx_worker_payments_farmer_id on public.worker_payments(farmer_id);

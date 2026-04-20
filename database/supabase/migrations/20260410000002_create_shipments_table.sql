-- إنشاء جدول الطرود المرسلة
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_number text not null,
  farmer_id text not null,
  crop_id text not null,
  merchant_id text,
  packages_count integer not null default 0,
  weight_kg numeric,
  date text not null,
  day text,
  status text not null default 'loaded' check (status in ('loaded', 'delivered', 'collected')),
  total_sale_amount numeric,
  receipt_image_url text,
  notes text,
  created_at timestamptz not null default now()
);

-- تفعيل الأمان على مستوى الصف
alter table public.shipments enable row level security;

-- فهرس لتسريع الاستعلامات حسب المزارع
create index if not exists idx_shipments_farmer_id on public.shipments(farmer_id);
create index if not exists idx_shipments_status on public.shipments(status);
create index if not exists idx_shipments_date on public.shipments(date);

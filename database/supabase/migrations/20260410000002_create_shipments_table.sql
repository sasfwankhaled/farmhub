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
  status text not null default 'loaded' check (status in ('loaded', 'delivered_to_merchant', 'collected', 'farmer_delivered', 'archived')),
  total_sale_amount numeric,
  merchant_commission_rate numeric,
  merchant_commission_amount numeric,
  box_rental_per_unit numeric,
  box_rental_total numeric,
  farmer_net_amount numeric,
  sale_method text check (sale_method in ('kg', 'box')),
  uniform_price boolean default true,
  price_per_unit numeric,
  sale_batches jsonb,
  receipt_image_url text,
  collected_at timestamptz,
  farmer_delivered_at timestamptz,
  merchant_name text,
  crop_name text,
  notes text,
  created_at timestamptz not null default now()
);

-- تفعيل إرسال كافة البيانات في الوقت الفعلي
alter table public.shipments replica identity full;

-- تفعيل الأمان على مستوى الصف
alter table public.shipments enable row level security;

-- فهرس لتسريع الاستعلامات حسب المزارع
create index if not exists idx_shipments_farmer_id on public.shipments(farmer_id);
create index if not exists idx_shipments_status on public.shipments(status);
create index if not exists idx_shipments_date on public.shipments(date);

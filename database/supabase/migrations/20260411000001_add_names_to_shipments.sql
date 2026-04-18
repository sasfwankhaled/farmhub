-- إضافة أعمدة لأسماء المحاصيل والتجار لتجاوز قيود RLS للمزارعين
alter table public.shipments 
add column if not exists crop_name text,
add column if not exists merchant_name text;

-- تحديث البيانات القديمة إذا كانت الجداول الأخرى متاحة (اختياري)
update public.shipments s
set crop_name = c.name
from public.crops c
where s.crop_id::uuid = c.id
and s.crop_name is null;

update public.shipments s
set merchant_name = e.name
from public.entities e
where s.merchant_id::uuid = e.id
and s.merchant_name is null;

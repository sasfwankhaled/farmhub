alter table public.trips
  add column if not exists delivery_image_url text;

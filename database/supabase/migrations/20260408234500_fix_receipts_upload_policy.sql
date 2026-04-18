-- Allow authenticated users to upload invoice/delivery images to receipts bucket.
-- Keeps existing read-access policy logic unchanged.

begin;

drop policy if exists receipts_authenticated_insert on storage.objects;

create policy receipts_authenticated_insert on storage.objects
for insert
to authenticated
with check (bucket_id = 'receipts');

commit;

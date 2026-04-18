begin;

alter table public.crops drop constraint if exists crops_unit_check;
alter table public.crops add constraint crops_unit_check check (unit in ('box', 'kg', 'box_and_kg'));

commit;

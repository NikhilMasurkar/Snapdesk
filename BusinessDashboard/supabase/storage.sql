-- Supabase Storage: bucket + policies for item photos and logos.
-- Run this whole file in the Supabase SQL editor (safe to re-run).
--
-- Layout: business-assets/<business_id>/items/<uuid>.webp
--         business-assets/<business_id>/logo.webp
-- Owners can only write inside their OWN business folder; everyone can read
-- (the bucket is public — photos render on the public menu).

insert into storage.buckets (id, name, public)
values ('business-assets', 'business-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "public read business assets" on storage.objects;
create policy "public read business assets" on storage.objects
  for select using (bucket_id = 'business-assets');

drop policy if exists "owner upload business assets" on storage.objects;
create policy "owner upload business assets" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] in (
      select id::text from businesses where owner_id = auth.uid()
    )
  );

drop policy if exists "owner update business assets" on storage.objects;
create policy "owner update business assets" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] in (
      select id::text from businesses where owner_id = auth.uid()
    )
  );

drop policy if exists "owner delete business assets" on storage.objects;
create policy "owner delete business assets" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'business-assets'
    and (storage.foldername(name))[1] in (
      select id::text from businesses where owner_id = auth.uid()
    )
  );

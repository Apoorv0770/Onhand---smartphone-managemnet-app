-- =============================================================================
-- Onhand · 0002_storage
-- Image storage: one public bucket, writable only inside your own folder.
--
-- Run after 0001_init.sql (it uses private.current_business_ids()).
-- Supabase only: this file touches the storage schema, which exists on
-- Supabase projects but not in a plain Postgres database.
--
-- Layout
--   bucket   device-images (public: files are served from
--            <project url>/storage/v1/object/public/device-images/<path>)
--   path     <business id>/<uuid>.<jpg|png|webp>
--
-- The database stores only that path (devices' image_path, businesses'
-- logo_path and banner_path), and CHECK constraints in 0001 require it to
-- start with the row's own business id. Together with the policies below, a
-- retailer can upload, list and delete files only in their own folder, and can
-- never reference a file that belongs to someone else.
--
-- Safe to run more than once.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'device-images',
  'device-images',
  true,
  6291456, -- 6 MB, matching the app's upload limit
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Reading through the public URL needs no policy: that is what a public
-- bucket means. There is deliberately no SELECT policy for visitors (anon),
-- so nobody can list a shop's folder through the API.

drop policy if exists "Onhand members upload to their business folder" on storage.objects;
create policy "Onhand members upload to their business folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'device-images'
    and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
    and (storage.foldername(name))[1] in (
      select business_id::text from private.current_business_ids() as business_id
    )
  );

drop policy if exists "Onhand members read their business folder" on storage.objects;
create policy "Onhand members read their business folder" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'device-images'
    and (storage.foldername(name))[1] in (
      select business_id::text from private.current_business_ids() as business_id
    )
  );

drop policy if exists "Onhand members delete from their business folder" on storage.objects;
create policy "Onhand members delete from their business folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'device-images'
    and (storage.foldername(name))[1] in (
      select business_id::text from private.current_business_ids() as business_id
    )
  );

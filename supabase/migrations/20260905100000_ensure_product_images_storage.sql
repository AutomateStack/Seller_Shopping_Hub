-- Product image uploads use this bucket from the admin catalog editor.
-- This migration is safe to run on a project where the bucket already exists.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Replace old overlapping policies with one consistent rule set.
drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Admins can upload images" on storage.objects;
drop policy if exists "Admins can update product images" on storage.objects;
drop policy if exists "Admins can delete product images" on storage.objects;
drop policy if exists "Anyone can view product images" on storage.objects;
drop policy if exists "Public can read product image objects" on storage.objects;
drop policy if exists "ShopHub product images: public read" on storage.objects;
drop policy if exists "ShopHub product images: admin insert" on storage.objects;
drop policy if exists "ShopHub product images: admin update" on storage.objects;
drop policy if exists "ShopHub product images: admin delete" on storage.objects;

create policy "ShopHub product images: public read"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

create policy "ShopHub product images: admin insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] in ('products', 'blog')
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);

create policy "ShopHub product images: admin update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
)
with check (
  bucket_id = 'product-images'
  and (storage.foldername(name))[1] in ('products', 'blog')
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);

create policy "ShopHub product images: admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.has_role(auth.uid(), 'admin'::public.app_role)
);

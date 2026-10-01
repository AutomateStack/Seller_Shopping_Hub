-- The production project was partially configured manually before its first
-- migration deployment. Remove only the incomplete application bootstrap so
-- the canonical initial migrations can create it consistently. `auth.users`
-- is deliberately untouched, preserving the existing Supabase Auth accounts.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.has_role(uuid, public.app_role) cascade;

drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;
drop type if exists public.app_role cascade;

drop policy if exists "ShopHub product images: public read" on storage.objects;
drop policy if exists "ShopHub product images: admin insert" on storage.objects;
drop policy if exists "ShopHub product images: admin update" on storage.objects;
drop policy if exists "ShopHub product images: admin delete" on storage.objects;
drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Admins can upload images" on storage.objects;
drop policy if exists "Admins can update product images" on storage.objects;
drop policy if exists "Admins can delete product images" on storage.objects;
drop policy if exists "Anyone can view product images" on storage.objects;
drop policy if exists "Public can read product image objects" on storage.objects;

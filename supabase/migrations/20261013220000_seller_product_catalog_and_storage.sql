-- Seller product catalog with owner-scoped RLS and product image storage.
create schema if not exists catalog;

create table if not exists catalog.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references seller.seller_profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 3 and 160),
  description text not null default '',
  category text not null default '',
  brand text not null default '',
  sku text,
  price numeric(12,2) not null check (price > 0),
  mrp numeric(12,2) check (mrp is null or mrp >= price),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  image_urls text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft','pending_review','approved','rejected','changes_requested')),
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists products_seller_id_idx on catalog.products(seller_id);
create index if not exists products_status_idx on catalog.products(status);
create index if not exists products_created_at_idx on catalog.products(created_at desc);
alter table catalog.products enable row level security;

drop policy if exists "Sellers can read their own products" on catalog.products;
create policy "Sellers can read their own products" on catalog.products for select to authenticated
using (exists (select 1 from seller.seller_profiles sp where sp.id=products.seller_id and sp.user_id=auth.uid()));
drop policy if exists "Admins can read all products" on catalog.products;
create policy "Admins can read all products" on catalog.products for select to authenticated using (public.is_current_marketplace_admin());
drop policy if exists "Approved sellers can create their own products" on catalog.products;
create policy "Approved sellers can create their own products" on catalog.products for insert to authenticated
with check (status in ('draft','pending_review') and exists (select 1 from seller.seller_profiles sp where sp.id=products.seller_id and sp.user_id=auth.uid() and sp.onboarding_status='approved' and sp.account_status='active'));
drop policy if exists "Sellers can update their own unapproved products" on catalog.products;
create policy "Sellers can update their own unapproved products" on catalog.products for update to authenticated
using (status in ('draft','rejected','changes_requested') and exists (select 1 from seller.seller_profiles sp where sp.id=products.seller_id and sp.user_id=auth.uid()))
with check (status in ('draft','pending_review','rejected','changes_requested') and exists (select 1 from seller.seller_profiles sp where sp.id=products.seller_id and sp.user_id=auth.uid() and sp.onboarding_status='approved' and sp.account_status='active'));
drop policy if exists "Admins can update product review status" on catalog.products;
create policy "Admins can update product review status" on catalog.products for update to authenticated using (public.is_current_marketplace_admin()) with check (public.is_current_marketplace_admin());
grant usage on schema catalog to authenticated, service_role;
grant select, insert, update on catalog.products to authenticated;
grant all on catalog.products to service_role;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists "Product images are public" on storage.objects;
create policy "Product images are public" on storage.objects for select using (bucket_id='product-images');
drop policy if exists "Sellers upload own product images" on storage.objects;
create policy "Sellers upload own product images" on storage.objects for insert to authenticated
with check (bucket_id='product-images' and (storage.foldername(name))[1]=auth.uid()::text and exists (select 1 from seller.seller_profiles sp where sp.user_id=auth.uid() and sp.onboarding_status='approved' and sp.account_status='active'));
drop policy if exists "Sellers update own product images" on storage.objects;
create policy "Sellers update own product images" on storage.objects for update to authenticated
using (bucket_id='product-images' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='product-images' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Sellers delete own product images" on storage.objects;
create policy "Sellers delete own product images" on storage.objects for delete to authenticated
using (bucket_id='product-images' and (storage.foldername(name))[1]=auth.uid()::text);

-- Product identity and safe public visibility for approved seller listings.
create unique index if not exists products_seller_sku_unique_idx
on catalog.products (seller_id, lower(trim(sku)))
where sku is not null and trim(sku) <> '';

drop policy if exists "Anyone can view approved products" on catalog.products;
create policy "Anyone can view approved products"
on catalog.products for select to anon, authenticated
using (status = 'approved');

create or replace function catalog.set_product_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at on catalog.products;
create trigger set_products_updated_at before update on catalog.products
for each row execute function catalog.set_product_updated_at();

grant usage on schema catalog to anon, authenticated;
grant select on catalog.products to anon, authenticated;
